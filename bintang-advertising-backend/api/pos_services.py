import uuid
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import pos_settings, stock_fifo, uom
from .models import Contact, SaldoKasHarian
from .pos_models import POSSale, POSSaleItem
from .product_models import Product, ProductVariant, ProductStockMovement
from .services.package_sales import resolve_package_for_sale
from .services.addon_sales import apply_addons, resolve_addons
from .services.product_pricing import hitung_harga as hitung_harga_produk, HargaProdukError

MONEY = Decimal('0.01')
QTY = Decimal('0.01')


def _potong_bahan_baku_bom(product, variant, qty_base, sale, user):
    """Potong stok bahan baku (Bill of Materials) otomatis begitu produk yang
    PUNYA resep terjual lunas lewat kasir — sebelumnya BoM cuma dipotong
    otomatis utk alur Order/cetak (deduct_job_materials_if_needed di
    views/jobs.py), transaksi kasir langsung dilewati sama sekali (instruksi
    user 2026-08-15). POSSaleItem tidak punya field luas/bahan seperti
    OrderItem, jadi formulanya SELALU qty-based (qty terjual x
    qty_required_per_unit per bahan) — tidak ada cabang per-m2. Independen
    dari `product.lacak_inventori` (jasa yang finished-good-nya tidak
    dihitung stok tetap boleh konsumsi bahan baku per transaksi)."""
    from .models import BillOfMaterials, RestockHistory, InventoryItem
    from .views.inventory import record_material_consumption_to_general_ledger

    bom = BillOfMaterials.objects.filter(product_id=product.id, variant_id=variant.id if variant else None).first()
    if not bom and variant:
        bom = BillOfMaterials.objects.filter(product_id=product.id, variant__isnull=True).first()
    if not bom:
        return

    marker = f"POS {sale.nomor} - Produk #{product.id}" + (f"/{variant.id}" if variant else "")
    if RestockHistory.objects.filter(keterangan__icontains=marker).exists():
        return

    for bom_item in bom.items.select_related('inventory_item'):
        item = InventoryItem.objects.select_for_update().get(pk=bom_item.inventory_item_id)
        qty_needed = round(float(qty_base) * bom_item.qty_required_per_unit, 4)
        if qty_needed <= 0:
            continue
        if qty_needed > item.stok:
            raise ValidationError({'error': f"Stok bahan '{item.nama}' tidak mencukupi untuk {product.nama}."})

        stok_awal = item.stok
        stok_akhir = max(0.0, round(item.stok - qty_needed, 4))
        RestockHistory.objects.create(
            item=item, user=user, delta=-qty_needed,
            stok_awal=stok_awal, stok_akhir=stok_akhir,
            keterangan=f"Pemakaian BoM otomatis | {marker} | {bom.nama}",
        )
        item.stok = stok_akhir
        item.save()

        record_material_consumption_to_general_ledger(
            item, qty_needed, ref_no=marker,
            keterangan_konteks=f"Penjualan POS {sale.nomor} - {product.nama}",
            source_id=sale.id,
        )

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
    if discount_pct:
        raise ValidationError({
            'error': 'Diskon manual tidak diizinkan. Gunakan kupon atau Diskon Penjualan yang aktif di Marketing.',
        })

    with transaction.atomic():
        shift = (SaldoKasHarian.objects.select_for_update()
                 .filter(kasir=user, kas_akhir__isnull=True, waktu_tutup__isnull=True)
                 .order_by('-id').first())
        if pos_settings.wajib_shift_aktif() and shift is None:
            raise ValidationError({'error': 'Buka shift Anda sendiri sebelum transaksi.'})

        customer = None
        if data.get('pelanggan'):
            customer = Contact.objects.filter(pk=data['pelanggan']).first()
            if customer is None:
                raise ValidationError({'error': 'Pelanggan tidak valid.'})
        # Tipe Pelanggan (CustomerGroup) member yang tertaut — dipakai supaya
        # tier harga per tipe pelanggan (mis. Reseller, Guest) benar-benar
        # dipakai saat checkout, bukan cuma tersimpan (bug ditemukan
        # 2026-08-13). Diresolusi di sini (sebelum loop harga item) karena
        # harga per item dihitung di bawah, butuh nilai ini sebelum baris
        # pertama diproses.
        # "Guest" WAJIB ditautkan eksplisit ke Customer (kategori asli di
        # menu Pelanggan & Supplier > Tipe Pelanggan, lihat migration
        # 0117_seed_customer_group_guest) — bukan default diam-diam untuk
        # transaksi tanpa pelanggan (instruksi user 2026-08-13, supaya tidak
        # rancu dengan konvensi lama "Guest" = label tampilan utk pelanggan
        # tanpa tipe, lihat CustomerEditModal.jsx). Tanpa tipe pelanggan
        # tertaut = None, jatuh ke tier Umum seperti sebelumnya.
        customer_group_nama = None
        if customer and customer.customer_id and customer.customer.customer_group_id:
            customer_group_nama = customer.customer.customer_group.nama

        prepared = []
        subtotal = Decimal('0')
        requested = {}
        stock_owners = {}
        stock_lines = []
        # No. Seri yang dipakai baris manapun di transaksi ini — product_id ->
        # {no_seri terpilih}. Dipakai (a) cegah nomor seri sama dipilih dua
        # kali dalam satu transaksi, (b) tandai "terjual" di pool
        # Product.serial_numbers setelah `sale` (nomornya) terbentuk di bawah.
        serial_pool_updates = {}
        for raw in items:
            package_id = raw.get('package_id') or raw.get('paket_id')
            if package_id:
                package, qty_base, price_base = resolve_package_for_sale(
                    package_id, raw.get('qty', 1), channel='pos', lock=True,
                )
                line_total = money(price_base * qty_base)
                conversion = {
                    'qty_dasar': qty_base,
                    'harga_dasar': price_base,
                    'uom_kode': '',
                    'uom_konverter': Decimal('1'),
                    'uom_qty': qty_base,
                }
                # Paket tidak mempunyai stok terpisah. Ketersediaan dan mutasi
                # selalu dihitung dari seluruh komponen master paket.
                for component in package.items.all():
                    component_product = Product.objects.select_for_update().get(pk=component.product_id)
                    component_variant = None
                    if component.variant_id:
                        component_variant = ProductVariant.objects.select_for_update().filter(
                            pk=component.variant_id, product=component_product,
                        ).first()
                        if not component_variant:
                            raise ValidationError({'error': f"Komponen varian paket '{package.nama}' tidak valid."})
                    component_qty = (qty_base * Decimal(str(component.qty))).quantize(QTY)
                    key = (component_product.id, component_variant.id if component_variant else None)
                    requested[key] = requested.get(key, Decimal('0')) + component_qty
                    stock_owners[key] = (component_product, component_variant)
                    stock_lines.append((component_product, component_variant, component_qty, package.nama))
                prepared.append((
                    raw, None, None, conversion, qty_base, price_base, line_total, package.nama, package,
                    [], 0.0, 0.0, Decimal('0'), [],
                ))
                subtotal += line_total
                continue

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
                prepared.append((
                    raw, None, None, conversion, qty_base, price_base, line_total, item_nama, None,
                    [], 0.0, 0.0, Decimal('0'), [],
                ))
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

            # Produk meteran (price_type='per_m2') & Finishing — sebelumnya item
            # begini dikirim TANPA product_id sama sekali (dianggap item kustom),
            # sehingga addon (wajib product) & potong stok otomatis tidak pernah
            # jalan untuknya. Sekarang product/variant TETAP tertaut; harga tetap
            # dihitung ulang di server (M6) lewat kalkulator resmi yang sama
            # dipakai bot WA & Order DP — bukan dipercaya dari browser.
            panjang = raw.get('panjang')
            lebar = raw.get('lebar')
            try:
                finishing_biaya = money(raw.get('finishing_biaya', 0))
            except ValidationError:
                raise ValidationError({'error': f"Biaya finishing {product.nama} tidak valid."})
            # Kasir bisa pakai mode "Meteran (P x L)" di Detail Item utk produk
            # APA PUN, tidak cuma yang price_type='per_m2' di katalog (instruksi
            # user 2026-08-12, sama seperti /products/:id/hitung-harga/ dipakai
            # Antrean WA). Tanpa paksa_per_m2 di sini, produk 'flat' yang dipakai
            # dgn ukuran akan dihitung ulang TANPA dikali luas saat checkout —
            # beda dari harga yang kasir/pelanggan lihat di layar (bug uang).
            paksa_per_m2 = bool(panjang) and bool(lebar) and product.price_type != 'per_m2'
            try:
                hasil_harga = hitung_harga_produk(
                    product, qty=qty_base, panjang=panjang, lebar=lebar, variant=variant, kanal='toko',
                    paksa_per_m2=paksa_per_m2, customer_group_nama=customer_group_nama,
                )
            except HargaProdukError as e:
                raise ValidationError({'error': str(e)})
            price_base = money(hasil_harga['harga_satuan'])

            # No. Seri — produk dengan `pesanan_no_seri=True` wajib pilih 1
            # nomor seri per unit dari pool Product.serial_numbers. Sebelum
            # ini, nomor seri tersimpan di kartu produk tapi tidak pernah
            # tercatat terjual (laporan "No. Seri" selalu kosong; bug
            # ditemukan & diperbaiki 2026-08-13).
            serial_numbers_line = []
            if product.pesanan_no_seri:
                seri_input = raw.get('serial_numbers') or []
                if not isinstance(seri_input, list):
                    raise ValidationError({'error': f"Nomor seri {product.nama} tidak valid."})
                seri_input = [str(s).strip() for s in seri_input if str(s).strip()]
                if qty_base != qty_base.to_integral_value():
                    raise ValidationError({'error': f"Qty {product.nama} harus bilangan bulat karena produk ini wajib No. Seri."})
                qty_int = int(qty_base)
                if len(seri_input) != qty_int:
                    raise ValidationError({'error': f"Pilih {qty_int} No. Seri untuk {product.nama} (qty {qty_int})."})
                if len(set(seri_input)) != len(seri_input):
                    raise ValidationError({'error': f"No. Seri untuk {product.nama} tidak boleh duplikat."})
                pool = product.serial_numbers if isinstance(product.serial_numbers, list) else []
                pool_by_no = {str(p.get('no_seri', '')).strip(): p for p in pool if isinstance(p, dict)}
                sudah_dipilih = serial_pool_updates.get(product.id, set())
                for no in seri_input:
                    entry = pool_by_no.get(no)
                    if entry is None:
                        raise ValidationError({'error': f"No. Seri '{no}' tidak terdaftar untuk produk {product.nama}."})
                    if entry.get('no_pesanan'):
                        raise ValidationError({'error': f"No. Seri '{no}' sudah terjual (No. Pesanan {entry['no_pesanan']})."})
                    if no in sudah_dipilih:
                        raise ValidationError({'error': f"No. Seri '{no}' dipilih lebih dari sekali dalam transaksi ini."})
                serial_pool_updates.setdefault(product.id, set()).update(seri_input)
                serial_numbers_line = seri_input

            # Addon: harga & qty SELALU dihitung ulang dari Addon.harga di server
            # (M6), payload klien hanya berupa pilihan id + qty per addon.
            item_addons = resolve_addons(raw.get('addons') or raw.get('addon_ids'), product, default_qty=qty_base)
            addon_total = sum((Decimal(str(a.harga or 0)) * q for a, q in item_addons), Decimal('0'))
            line_total = money(price_base * qty_base + finishing_biaya * qty_base + addon_total)
            key = (product.id, variant.id if variant else None)
            requested[key] = requested.get(key, Decimal('0')) + qty_base
            stock_owners[key] = (product, variant)
            stock_lines.append((product, variant, qty_base, ''))
            prepared.append((
                raw, product, variant, conversion, qty_base, price_base, line_total, product.nama, None,
                item_addons, float(panjang or 0), float(lebar or 0), finishing_biaya, serial_numbers_line,
            ))
            subtotal += line_total

        if status_val == 'paid' and pos_settings.pos_mengurangi_stok():
            for key, total_qty in requested.items():
                product, variant = stock_owners[key]
                owner = variant or product
                if product.lacak_inventori and total_qty > Decimal(str(owner.qty_stok or 0)):
                    raise ValidationError({'error': f"Stok '{owner}' tidak mencukupi."})

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
        from .promo_engine import (
            BarisKeranjang, KonteksPromo, evaluate_coupon_code, evaluate_sales_discount,
            evaluate_promotions,
        )
        from .marketing_models import KANAL_POS
        baris_promo = [
            BarisKeranjang(product=p, variant=v, package=package, qty=qb, harga=pb, subtotal=lt)
            for raw, p, v, conv, qb, pb, lt, item_nama, package, item_addons, pj, lb, fb, sn in prepared
            if p is not None or package is not None
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

        # ── Promosi POS (BX/DQ/DA/FI) — mekanisme marketing terpisah dari
        # kupon/Diskon Penjualan di atas, jadi SELALU dievaluasi & boleh
        # menumpuk dengan salah satu diskon order-level itu (desain Olsera).
        # PENTING: sebelum perbaikan ini evaluate_promotions() tidak pernah
        # dipanggil dari create_sale sama sekali — Promosi (POS) tersimpan &
        # tampak aktif di menu Marketing tapi tidak pernah berdampak ke
        # transaksi kasir manapun (bug ditemukan & diperbaiki 2026-09-05).
        hasil_promo = evaluate_promotions(konteks)
        promo_discount = hasil_promo.diskon
        promo_gratis_items = hasil_promo.items_gratis

        # Pre-check stok item gratis (BX/FI) sebelum menulis apa pun, digabung
        # dengan qty yang sudah diminta di keranjang (requested) kalau
        # kebetulan produk yang sama juga dibeli di baris lain — supaya tidak
        # oversell. Produk dengan varian atau No. Seri wajib DILEWATI (bukan
        # cuma di sini, juga saat pemotongan stok di bawah): produk_gratis
        # cuma ManyToMany ke Product, tidak ada info varian/No. Seri mana yang
        # digratiskan, jadi stoknya harus disesuaikan manual (Stok Opname).
        gratis_locked_products = {}
        if status_val == 'paid' and pos_settings.pos_mengurangi_stok():
            gratis_qty_by_product = {}
            for gratis in promo_gratis_items:
                qty_g = Decimal(str(gratis.qty or 0)).quantize(QTY)
                if qty_g <= 0:
                    continue
                gratis_qty_by_product[gratis.product.id] = gratis_qty_by_product.get(gratis.product.id, Decimal('0')) + qty_g
            for product_id, qty_g in gratis_qty_by_product.items():
                produk_gratis = Product.objects.select_for_update().filter(pk=product_id).first()
                if not produk_gratis or produk_gratis.has_variant or produk_gratis.pesanan_no_seri:
                    continue
                gratis_locked_products[product_id] = produk_gratis
                if not produk_gratis.lacak_inventori:
                    continue
                already_requested = sum(
                    (qty for (pid, _vid), qty in requested.items() if pid == product_id),
                    Decimal('0'),
                )
                if qty_g + already_requested > Decimal(str(produk_gratis.qty_stok or 0)):
                    raise ValidationError({'error': f"Stok '{produk_gratis}' tidak mencukupi untuk item gratis promosi."})

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
        taxable = max(Decimal('0'), subtotal - discount - coupon_discount - sales_discount_amount - loyalty_discount - promo_discount)
        tax = money(taxable * tax_pct / Decimal('100'))
        total = money(max(Decimal('0'), subtotal - discount - coupon_discount - sales_discount_amount - loyalty_discount - promo_discount + tax))
        if status_val == 'paid' and paid < total:
            raise ValidationError({'error': 'Jumlah pembayaran belum mencukupi total server.'})
        client_total = data.get('total')
        if client_total not in (None, '') and money(client_total) != total:
            raise ValidationError({'error': 'Total transaksi berubah. Muat ulang harga produk lalu coba lagi.', 'server_total': total})

        sale = POSSale.objects.create(
            nomor=_nomor(), kasir=user, pelanggan=customer, shift=shift, dilayani_oleh=dilayani_oleh,
            subtotal=money(subtotal), diskon=discount, kupon=kupon_obj, diskon_kupon=coupon_discount,
            sales_discount=sales_discount_rule, diskon_penjualan=sales_discount_amount,
            diskon_promo=promo_discount,
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
        for (raw, product, variant, conversion, qty_base, price_base, line_total, item_nama, package,
             item_addons, panjang, lebar, finishing_biaya, serial_numbers_line) in prepared:
            sale_item = POSSaleItem.objects.create(
                sale=sale, product=product, variant=variant, paket=package, nama_snapshot=item_nama,
                harga_snapshot=price_base, qty=qty_base, subtotal=line_total,
                catatan=str(raw.get('catatan') or '')[:2000],
                uom_kode=conversion['uom_kode'], uom_konverter=conversion['uom_konverter'],
                uom_qty=conversion['uom_qty'],
                uom_harga=(money(price_base * conversion['uom_konverter']) if conversion['uom_kode'] else None),
                panjang=panjang, lebar=lebar, finishing_biaya=finishing_biaya,
                serial_numbers=serial_numbers_line,
            )
            if item_addons:
                apply_addons(
                    addons=item_addons, user=user, tanggal=now,
                    pos_sale_item=sale_item, pos_sale=sale,
                    deduct_stock=(status_val == 'paid' and pos_settings.pos_mengurangi_stok()),
                )

        # ── Baris item gratis dari Promosi POS (BX/FI) — harga 0, ditandai
        # is_gratis supaya struk & laporan bisa membedakan dari baris beli.
        for gratis in promo_gratis_items:
            qty_g = Decimal(str(gratis.qty or 0)).quantize(QTY)
            if qty_g <= 0:
                continue
            POSSaleItem.objects.create(
                sale=sale, product=gratis.product, variant=None,
                nama_snapshot=f"{gratis.product.nama} (Gratis)",
                harga_snapshot=Decimal('0'), qty=qty_g, subtotal=Decimal('0'),
                catatan=f"Gratis - Promosi {gratis.promo.judul}",
                uom_kode='', uom_konverter=Decimal('1'), uom_qty=qty_g,
                is_gratis=True, promo=gratis.promo,
            )

        # Tandai No. Seri yang terjual di transaksi ini supaya tidak bisa
        # dipilih lagi di transaksi berikutnya (`entry['no_pesanan']` diisi
        # nomor nota) — dilepas lagi kalau transaksi ini di-void (void_sale).
        for product_id, terjual_set in serial_pool_updates.items():
            prod = Product.objects.select_for_update().get(pk=product_id)
            pool = prod.serial_numbers if isinstance(prod.serial_numbers, list) else []
            berubah = False
            for entry in pool:
                if isinstance(entry, dict) and str(entry.get('no_seri', '')).strip() in terjual_set:
                    entry['no_pesanan'] = sale.nomor
                    berubah = True
            if berubah:
                prod.serial_numbers = pool
                prod.save(update_fields=['serial_numbers'])

        if status_val == 'paid' and pos_settings.pos_mengurangi_stok():
            for product, variant, qty_base, package_name in stock_lines:
                if product.lacak_inventori:
                    owner = variant or product
                    start = owner.qty_stok
                    owner.qty_stok = start - qty_base
                    owner.save(update_fields=['qty_stok'])
                    suffix = f' - Paket {package_name}' if package_name else ''
                    movement = ProductStockMovement.objects.create(
                        product=product, variant=variant, user=user, tipe='penjualan', qty=qty_base,
                        stok_awal=start, stok_akhir=owner.qty_stok, pos_sale=sale,
                        catatan=f'Penjualan POS {sale.nomor}{suffix}', tanggal=now,
                    )
                    stock_fifo.consume_layers(product, variant, qty_base, movement=movement)

                # Potong bahan baku (BoM) kalau produk ini punya resep —
                # independen dari lacak_inventori (instruksi user 2026-08-15).
                _potong_bahan_baku_bom(product, variant, qty_base, sale, user)

            # Item gratis dari Promosi POS (BX/FI) — lihat batasan varian/No.
            # Seri di blok pre-check di atas (gratis_locked_products).
            for gratis in promo_gratis_items:
                qty_g = Decimal(str(gratis.qty or 0)).quantize(QTY)
                if qty_g <= 0:
                    continue
                produk_gratis = gratis_locked_products.get(gratis.product.id)
                if produk_gratis is None:
                    continue
                if produk_gratis.lacak_inventori:
                    start = produk_gratis.qty_stok
                    produk_gratis.qty_stok = start - qty_g
                    produk_gratis.save(update_fields=['qty_stok'])
                    movement = ProductStockMovement.objects.create(
                        product=produk_gratis, variant=None, user=user, tipe='penjualan', qty=qty_g,
                        stok_awal=start, stok_akhir=produk_gratis.qty_stok, pos_sale=sale,
                        catatan=f'Penjualan POS {sale.nomor} - Gratis Promosi {gratis.promo.judul}', tanggal=now,
                    )
                    stock_fifo.consume_layers(produk_gratis, None, qty_g, movement=movement)
                _potong_bahan_baku_bom(produk_gratis, None, qty_g, sale, user)

        # SPK untuk transaksi lunas diterbitkan dalam transaksi database yang sama
        # dengan nota POS. Targetnya selalu antrean divisi bagi akun kasir; aturan
        # tersebut tetap dipusatkan di api.spk seperti alur Antrean WA.
        spk_payload = data.get('spk')
        if spk_payload is not None:
            if status_val != 'paid':
                raise ValidationError({'error': 'SPK hanya dapat diterbitkan untuk transaksi POS yang lunas.'})
            if not isinstance(spk_payload, dict):
                raise ValidationError({'error': 'Data tujuan SPK tidak valid.'})
            from . import spk as spk_service
            try:
                staff = spk_service.resolve_staff(spk_payload.get('staff_id'), pemohon=user)
                deadline = spk_service.resolve_deadline(spk_payload.get('deadline'))
                if not deadline:
                    raise spk_service.SpkError('Deadline SPK wajib diisi.')
                tahap = spk_service.resolve_tahap(
                    tahap_id=spk_payload.get('tahap_id'),
                    divisi_id=spk_payload.get('divisi_id'),
                    staff=staff,
                )
                spk_service.terbitkan(
                    sale.items.all(), field='pos_sale_item', tahap=tahap, staff=staff,
                    deadline=deadline,
                )
            except spk_service.SpkError as exc:
                raise ValidationError({'error': exc.pesan})

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
                    earn_items = [
                        (p, v, qb)
                        for (raw, p, v, conv, qb, pb, lt, item_nama, package, item_addons, pj, lb, fb, sn) in prepared
                        if p is not None
                    ]
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
            from .services.pos_receipt_whatsapp import jadwalkan_resi_pos_otomatis
            jadwalkan_resi_pos_otomatis(sale.id)

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
        if sale.diambil_pada:
            raise ValidationError({'error': 'Transaksi ini sudah ditandai diambil pelanggan, tidak dapat di-void.'})
        if sale.status == 'paid' and pos_settings.pos_mengurangi_stok():
            for item in sale.items.select_related('product', 'variant'):
                if not item.product or not item.product.lacak_inventori:
                    continue
                if item.is_gratis and (item.product.has_variant or item.product.pesanan_no_seri):
                    # Simetris dengan create_sale: stok item gratis (BX/FI) dari
                    # Promosi POS untuk produk bervarian/No. Seri sengaja TIDAK
                    # dipotong saat transaksi dibuat (tidak ada info varian/No.
                    # Seri mana yang digratiskan), jadi jangan dikembalikan juga
                    # di sini — kalau tetap dijalankan, stok akan bertambah
                    # padahal tidak pernah dikurangi (bug ganda).
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
            # Stok bahan addon (linked_product) juga dipulihkan — independen dari
            # `item.product.lacak_inventori` di atas, karena bahan addon adalah
            # produk terpisah dari item induknya.
            for sale_item in sale.items.all():
                for addon_link in sale_item.addons.select_related('addon'):
                    if not addon_link.addon_id or not addon_link.addon.linked_product_id:
                        continue
                    linked_product = Product.objects.select_for_update().get(pk=addon_link.addon.linked_product_id)
                    if not linked_product.lacak_inventori:
                        continue
                    linked_variant = (
                        ProductVariant.objects.select_for_update().get(pk=addon_link.addon.linked_variant_id)
                        if addon_link.addon.linked_variant_id else None
                    )
                    consume_qty = Decimal(str(addon_link.addon.linked_qty or 0)) * addon_link.qty
                    if consume_qty <= 0:
                        continue
                    owner = linked_variant or linked_product
                    start = owner.qty_stok
                    owner.qty_stok = start + consume_qty
                    owner.save(update_fields=['qty_stok'])
                    original = (ProductStockMovement.objects.filter(
                        product=linked_product, variant=linked_variant, tipe='penjualan', pos_sale=sale,
                        catatan=f"Addon '{addon_link.nama_snapshot}'",
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
                        product=linked_product, variant=linked_variant, user=user, tipe='pengembalian',
                        qty=consume_qty, stok_awal=start, stok_akhir=owner.qty_stok, hpp_total=restored_hpp,
                        pos_sale=sale, catatan=f"Pembatalan POS (Void) Addon '{addon_link.nama_snapshot}' {sale.nomor}",
                        tanggal=timezone.localdate(),
                    )
        # Lepas No. Seri yang tadinya ditandai terjual di transaksi ini,
        # supaya bisa dipilih lagi di transaksi lain — independen dari
        # setelan `pos_mengurangi_stok()` (No. Seri bukan soal qty stok).
        for item in sale.items.all():
            if not item.product_id or not item.serial_numbers:
                continue
            prod = Product.objects.select_for_update().get(pk=item.product_id)
            pool = prod.serial_numbers if isinstance(prod.serial_numbers, list) else []
            terjual_set = set(item.serial_numbers)
            berubah = False
            for entry in pool:
                if isinstance(entry, dict) and str(entry.get('no_seri', '')).strip() in terjual_set:
                    entry['no_pesanan'] = ''
                    berubah = True
            if berubah:
                prod.serial_numbers = pool
                prod.save(update_fields=['serial_numbers'])

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
        sale.voided_at = timezone.now()
        sale.voided_by = user
        sale.save(update_fields=['status', 'settlement_status', 'voided_at', 'voided_by'])

        from accounting.services.pos_posting import post_pos_void_journal
        post_pos_void_journal(sale, actor=user)

        return sale

