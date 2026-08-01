import uuid
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import pos_settings, stock_fifo, uom
from .models import Contact, SaldoKasHarian
from .pos_models import POSSale, POSSaleItem
from .product_models import Product, ProductVariant, ProductStockMovement

MONEY = Decimal('0.01')
QTY = Decimal('0.01')

def money(value):
    try:
        return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({'error': 'Nilai uang tidak valid.'})

def percentage(value, field):
    try:
        result = Decimal(str(value or 0))
    except (InvalidOperation, TypeError, ValueError):
        raise ValidationError({'error': f'{field} tidak valid.'})
    if result < 0 or result > 100:
        raise ValidationError({'error': f'{field} harus antara 0 dan 100.'})
    return result

def _nomor():
    now = timezone.now()
    return f"POS-{now.strftime('%Y%m%d%H%M%S%f')}-{uuid.uuid4().hex[:6].upper()}"

def _server_price(product, variant):
    if variant and variant.harga_jual_toko is not None:
        return money(variant.harga_jual_toko)
    return money(product.harga_jual_toko)

def create_sale(*, user, data):
    items = data.get('items') or []
    if not items:
        raise ValidationError({'error': 'Tidak ada item dalam keranjang.'})
    status_val = data.get('status', 'paid')
    if status_val not in ('paid', 'hold'):
        raise ValidationError({'error': 'Status transaksi tidak valid.'})
    if status_val == 'hold' and pos_settings.blokir_tahan_pesanan():
        raise ValidationError({'error': 'Menahan pesanan dinonaktifkan.'})

    discount_pct = percentage(data.get('diskon_persen', 0), 'diskon_persen')
    tax_pct = percentage(data.get('pajak_persen', 0), 'pajak_persen')
    paid = money(data.get('dibayar', 0))

    with transaction.atomic():
        shift = (SaldoKasHarian.objects.select_for_update()
                 .filter(kasir=user, kas_akhir__isnull=True, waktu_tutup__isnull=True)
                 .order_by('-id').first())
        if pos_settings.wajib_shift_aktif() and shift is None:
            raise ValidationError({'error': 'Buka shift Anda sendiri sebelum transaksi.'})

        prepared = []
        subtotal = Decimal('0')
        requested = {}
        prepared = []
        subtotal = Decimal('0')
        requested = {}
        for raw in items:
            product_id = raw.get('product_id')
            if not product_id:
                if pos_settings.ext('disable_add_custom_item'):
                    raise ValidationError({'error': 'Penambahan item kustom (non-katalog) dinonaktifkan di Pengaturan POS.'})
                item_nama = str(raw.get('nama') or 'Item Kustom')
                price_base = money(raw.get('harga', 0))
                try:
                    qty_base = Decimal(str(raw.get('qty', 1))).quantize(QTY)
                except (InvalidOperation, TypeError, ValueError):
                    qty_base = Decimal('1.00')
                if qty_base <= 0:
                    raise ValidationError({'error': f"Qty '{item_nama}' harus lebih dari nol."})
                line_total = money(price_base * qty_base)
                conversion = {
                    'qty_dasar': qty_base,
                    'harga_dasar': price_base,
                    'uom_kode': '',
                    'uom_konverter': Decimal('1'),
                    'uom_qty': qty_base,
                }
                prepared.append((raw, None, None, conversion, qty_base, price_base, line_total, item_nama))
                subtotal += line_total
                continue

            product = Product.objects.select_for_update().filter(pk=product_id).first()
            if not product:
                raise ValidationError({'error': f"Produk dengan ID {product_id} tidak ditemukan."})
            variant = None
            if raw.get('variant_id'):
                variant = ProductVariant.objects.select_for_update().filter(
                    pk=raw['variant_id'], product=product
                ).first()
                if not variant:
                    raise ValidationError({'error': f"Varian untuk {product.nama} tidak valid."})
            try:
                input_qty = Decimal(str(raw.get('qty', 1)))
            except (InvalidOperation, TypeError, ValueError):
                raise ValidationError({'error': f"Qty {product.nama} tidak valid."})
            if input_qty <= 0:
                raise ValidationError({'error': f"Qty {product.nama} harus lebih dari nol."})
            conversion = uom.resolve(product, raw.get('uom_kode'), input_qty, None, variant)
            qty_base = Decimal(str(conversion['qty_dasar'])).quantize(QTY)
            price_base = _server_price(product, variant)
            line_total = money(price_base * qty_base)
            key = (product.id, variant.id if variant else None)
            requested[key] = requested.get(key, Decimal('0')) + qty_base
            prepared.append((raw, product, variant, conversion, qty_base, price_base, line_total, product.nama))
            subtotal += line_total

        if status_val == 'paid' and pos_settings.pos_mengurangi_stok():
            for raw, product, variant, conversion, qty_base, price_base, line_total, item_nama in prepared:
                if not product:
                    continue
                owner = variant or product
                if product.lacak_inventori and requested.get((product.id, variant.id if variant else None), Decimal('0')) > Decimal(str(owner.qty_stok or 0)):
                    raise ValidationError({'error': f"Stok '{owner}' tidak mencukupi."})

        customer = None
        if data.get('pelanggan'):
            customer = Contact.objects.filter(pk=data['pelanggan']).first()
            if customer is None:
                raise ValidationError({'error': 'Pelanggan tidak valid.'})

        # Karyawan yang melayani (service order) — opsional, dipilih kasir.
        dilayani_oleh = None
        if data.get('dilayani_oleh_id'):
            from django.contrib.auth import get_user_model
            dilayani_oleh = get_user_model().objects.filter(
                pk=data['dilayani_oleh_id'], is_active=True
            ).first()
            if dilayani_oleh is None:
                raise ValidationError({'error': 'Karyawan pelayan tidak valid atau nonaktif.'})

        # ── Kupon manual (kode) & Diskon Penjualan otomatis (tanpa kode) ──
        # Baris keranjang & konteks promo dibangun SELALU (bukan hanya saat ada
        # kupon_kode) karena Diskon Penjualan harus dievaluasi meski kasir tidak
        # menerapkan kupon apa pun.
        from .promo_engine import BarisKeranjang, KonteksPromo, evaluate_coupon_code, evaluate_sales_discount
        from .marketing_models import KANAL_POS
        baris_promo = [
            BarisKeranjang(product=p, variant=v, qty=qb, harga=pb, subtotal=lt)
            for raw, p, v, conv, qb, pb, lt, item_nama in prepared
            if p is not None
        ]
        konteks = KonteksPromo(baris=baris_promo, subtotal=subtotal, pelanggan=customer, kanal=KANAL_POS)

        kupon_obj = None
        coupon_discount = Decimal('0')
        sales_discount_amount = Decimal('0')
        sales_discount_rule = None
        kupon_kode = data.get('kupon_kode') or (data.get('kupon', {}).get('kode') if isinstance(data.get('kupon'), dict) else (data.get('kupon') if isinstance(data.get('kupon'), str) else None))

        metode_diskon = data.get('metode_diskon')
        if metode_diskon == 'kupon':
            if not kupon_kode:
                raise ValidationError({'error': 'Kode kupon wajib diisi untuk metode diskon Kupon.'})
            hasil = evaluate_coupon_code(kupon_kode, konteks)
            if not hasil.ok:
                raise ValidationError({'error': f'Kupon ditolak: {hasil.alasan}'})
            kupon_obj = hasil.kupon
            coupon_discount = hasil.diskon
        elif metode_diskon == 'otomatis':
            sales_discount_amount, sales_discount_rule = evaluate_sales_discount(konteks)
        elif metode_diskon in (None, ''):
            if kupon_kode:
                hasil = evaluate_coupon_code(kupon_kode, konteks)
                if not hasil.ok:
                    raise ValidationError({'error': f'Kupon ditolak: {hasil.alasan}'})
                kupon_obj = hasil.kupon
                coupon_discount = hasil.diskon
            sales_discount_amount, sales_discount_rule = evaluate_sales_discount(konteks)
            if sales_discount_amount > coupon_discount:
                kupon_obj = None
                coupon_discount = Decimal('0')
            else:
                sales_discount_amount = Decimal('0')
                sales_discount_rule = None
        # metode_diskon == 'tidak_ada' (atau nilai tak dikenal lain): tidak ada
        # kupon maupun diskon penjualan yang diterapkan sama sekali.

        # ── Penebusan poin loyalty (hanya transaksi lunas & pelanggan tertaut member) ──
        loyalty_obj = None
        loyalty_customer = None
        loyalty_discount = Decimal('0')
        loyalty_redemption_id = data.get('loyalty_redemption_id')
        if loyalty_redemption_id and status_val == 'paid':
            from .marketing_models import LoyaltyPointRedemption
            from .customer_models import Customer
            from . import loyalty as loyalty_svc
            member_id = getattr(customer, 'customer_id', None) if customer else None
            if not member_id:
                raise ValidationError({'error': 'Pelanggan belum tertaut ke akun member; tidak bisa tebus poin.'})
            loyalty_customer = Customer.objects.select_for_update().filter(pk=member_id).first()
            if loyalty_customer is None:
                raise ValidationError({'error': 'Akun member pelanggan tidak ditemukan.'})
            loyalty_obj = LoyaltyPointRedemption.objects.filter(pk=loyalty_redemption_id).first()
            if loyalty_obj is None:
                raise ValidationError({'error': 'Opsi penukaran poin tidak ditemukan.'})
            if loyalty_customer.loyalty_points < loyalty_obj.besar_point:
                raise ValidationError({'error': (
                    f'Poin tidak cukup: butuh {loyalty_obj.besar_point}, '
                    f'tersedia {loyalty_customer.loyalty_points}.'
                )})
            loyalty_discount = loyalty_svc.compute_redemption_discount(loyalty_obj, subtotal)

        discount = money(subtotal * discount_pct / Decimal('100'))
        taxable = max(Decimal('0'), subtotal - discount - coupon_discount - sales_discount_amount - loyalty_discount)
        tax = money(taxable * tax_pct / Decimal('100'))
        total = money(max(Decimal('0'), subtotal - discount - coupon_discount - sales_discount_amount - loyalty_discount + tax))
        if status_val == 'paid' and paid < total:
            raise ValidationError({'error': 'Jumlah pembayaran belum mencukupi total server.'})
        client_total = data.get('total')
        if client_total not in (None, '') and money(client_total) != total:
            raise ValidationError({'error': 'Total transaksi berubah. Muat ulang harga produk lalu coba lagi.', 'server_total': total})

        sale = POSSale.objects.create(
            nomor=_nomor(), kasir=user, pelanggan=customer, shift=shift, dilayani_oleh=dilayani_oleh,
            subtotal=money(subtotal), diskon=discount, kupon=kupon_obj, diskon_kupon=coupon_discount,
            sales_discount=sales_discount_rule, diskon_penjualan=sales_discount_amount,
            loyalty_redemption=loyalty_obj, diskon_loyalti=loyalty_discount,
            pajak=tax, total=total,
            metode_bayar=str(data.get('metode_bayar') or 'Cash')[:50], dibayar=paid,
            kembalian=money(max(Decimal('0'), paid-total)),
            catatan=str(data.get('catatan') or '')[:2000], status=status_val,
        )
        now = timezone.localdate()
        if kupon_obj:
            from .marketing_models import CouponUsage
            CouponUsage.objects.create(
                kupon=kupon_obj, pelanggan=customer, pos_sale=sale,
                nilai_diskon=coupon_discount, tanggal=now
            )
            kupon_obj.penggunaan_count = CouponUsage.objects.filter(kupon=kupon_obj).count()
            kupon_obj.save(update_fields=['penggunaan_count'])
        for raw, product, variant, conversion, qty_base, price_base, line_total, item_nama in prepared:
            POSSaleItem.objects.create(
                sale=sale, product=product, variant=variant, nama_snapshot=item_nama,
                harga_snapshot=price_base, qty=qty_base, subtotal=line_total,
                catatan=str(raw.get('catatan') or '')[:2000],
                uom_kode=conversion['uom_kode'], uom_konverter=conversion['uom_konverter'],
                uom_qty=conversion['uom_qty'],
                uom_harga=(money(price_base * conversion['uom_konverter']) if conversion['uom_kode'] else None),
            )
            if status_val == 'paid' and pos_settings.pos_mengurangi_stok() and product and product.lacak_inventori:
                owner = variant or product
                start = owner.qty_stok
                owner.qty_stok = start - qty_base
                owner.save(update_fields=['qty_stok'])
                movement = ProductStockMovement.objects.create(
                    product=product, variant=variant, user=user, tipe='penjualan', qty=qty_base,
                    stok_awal=start, stok_akhir=owner.qty_stok, pos_sale=sale,
                    catatan=f'Penjualan POS {sale.nomor}', tanggal=now,
                )
                stock_fifo.consume_layers(product, variant, qty_base, movement=movement)

        if status_val == 'paid':
            from . import loyalty as loyalty_svc
            if loyalty_customer is None and customer is not None and getattr(customer, 'customer_id', None):
                from .customer_models import Customer
                loyalty_customer = Customer.objects.select_for_update().filter(pk=customer.customer_id).first()

            if loyalty_customer is not None:
                setting = loyalty_svc.get_setting()
                poin_ditebus = 0
                if loyalty_obj is not None:
                    poin_ditebus = int(loyalty_obj.besar_point or 0)
                    loyalty_customer.loyalty_points = max(0, loyalty_customer.loyalty_points - poin_ditebus)

                # Earn: dilewati bila menebus poin & setelan melarang "dapat poin saat tebus".
                poin_didapat = 0
                boleh_earn = setting is not None and (loyalty_obj is None or setting.dapat_poin_saat_tebus)
                if boleh_earn:
                    earn_items = [(p, v, qb) for (raw, p, v, conv, qb, pb, lt) in prepared]
                    poin_didapat = loyalty_svc.earn_points(
                        customer=loyalty_customer, setting=setting, sale_total=total, items=earn_items,
                    )
                    loyalty_customer.loyalty_points += poin_didapat

                if poin_ditebus or poin_didapat:
                    loyalty_customer.save(update_fields=['loyalty_points'])
                    sale.poin_ditebus = poin_ditebus
                    sale.poin_didapat = poin_didapat
                    sale.save(update_fields=['poin_ditebus', 'poin_didapat'])

        # Resolve accounting_payment_method & settlement_status (T-103)
        resolve_and_assign_payment_method(sale)
        sale.save(update_fields=['accounting_payment_method', 'settlement_status'])

        # Post Journal Entry (M2, M5) if status is 'paid'
        if status_val == 'paid':
            from accounting.services.pos_posting import post_pos_sale_journal
            post_pos_sale_journal(sale, actor=user)

        return sale


def resolve_and_assign_payment_method(sale):
    """
    Resolve accounting_payment_method dan settlement_status untuk POSSale.
    """
    from .models import POSPaymentMethod
    from accounting.models import PaymentMethod

    metode_str = (sale.metode_bayar or '').strip()
    pm_accounting = None

    pos_pm = POSPaymentMethod.objects.filter(nama__iexact=metode_str).first()
    if not pos_pm:
        pos_pm = POSPaymentMethod.objects.filter(tipe__iexact=metode_str).first()
    if pos_pm and pos_pm.accounting_payment_method_id:
        pm_accounting = pos_pm.accounting_payment_method

    if not pm_accounting:
        pm_accounting = PaymentMethod.objects.filter(name__iexact=metode_str).first()
    if not pm_accounting:
        pm_accounting = PaymentMethod.objects.filter(payment_type__iexact=metode_str).first()

    sale.accounting_payment_method = pm_accounting

    if pm_accounting:
        is_cash_method = pm_accounting.is_cash
    else:
        is_cash_method = (metode_str.lower() in ('cash', 'tunai')) or (bool(pos_pm and pos_pm.tipe == 'Tunai'))

    if is_cash_method:
        sale.settlement_status = 'not_applicable'
    elif sale.settlement_status != 'settled':
        sale.settlement_status = 'unsettled'

    return sale

def void_sale(*, sale_id, user):
    with transaction.atomic():
        sale = POSSale.objects.select_for_update().prefetch_related('items').get(pk=sale_id)
        if sale.status == 'void':
            raise ValidationError({'error': 'Transaksi sudah dibatalkan sebelumnya.'})
        if sale.settlement_status == 'settled':
            raise ValidationError({'error': 'Transaksi POS yang sudah ter-settle tidak dapat di-void secara langsung.'})
        if sale.status == 'paid' and pos_settings.pos_mengurangi_stok():
            for item in sale.items.select_related('product', 'variant'):
                if not item.product or not item.product.lacak_inventori:
                    continue
                product = Product.objects.select_for_update().get(pk=item.product_id)
                variant = (ProductVariant.objects.select_for_update().get(pk=item.variant_id)
                           if item.variant_id else None)
                owner = variant or product
                start = owner.qty_stok
                owner.qty_stok = start + item.qty
                owner.save(update_fields=['qty_stok'])
                original = (ProductStockMovement.objects.filter(
                    product=product, variant=variant, tipe='penjualan',
                    catatan=f'Penjualan POS {sale.nomor}'
                ).order_by('id').first())
                restored_hpp = Decimal('0')
                if original:
                    for consumption in original.layer_consumptions.select_related('layer').all():
                        restored_hpp += consumption.qty * consumption.harga_beli
                        if consumption.layer_id:
                            layer = consumption.layer
                            layer.sisa_qty += consumption.qty
                            layer.save(update_fields=['sisa_qty'])
                ProductStockMovement.objects.create(
                    product=product, variant=variant, user=user, tipe='pengembalian', qty=item.qty,
                    stok_awal=start, stok_akhir=owner.qty_stok, hpp_total=restored_hpp,
                    catatan=f'Pembatalan POS (Void) {sale.nomor}', tanggal=timezone.localdate(),
                )
        if sale.kupon:
            from .marketing_models import CouponUsage
            CouponUsage.objects.filter(pos_sale=sale).delete()
            sale.kupon.penggunaan_count = CouponUsage.objects.filter(kupon=sale.kupon).count()
            sale.kupon.save(update_fields=['penggunaan_count'])

        if sale.status == 'paid' and (sale.poin_ditebus or sale.poin_didapat):
            member = sale.pelanggan.customer if (sale.pelanggan and sale.pelanggan.customer_id) else None
            if member is not None:
                from .customer_models import Customer
                member = Customer.objects.select_for_update().get(pk=member.pk)
                member.loyalty_points = max(0, member.loyalty_points + int(sale.poin_ditebus or 0) - int(sale.poin_didapat or 0))
                member.save(update_fields=['loyalty_points'])

        sale.status = 'void'
        sale.settlement_status = 'void'
        sale.save(update_fields=['status', 'settlement_status'])

        from accounting.services.pos_posting import post_pos_void_journal
        post_pos_void_journal(sale, actor=user)

        return sale

