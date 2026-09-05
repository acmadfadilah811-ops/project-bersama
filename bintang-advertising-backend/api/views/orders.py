import uuid
import logging
import csv
import io
import datetime
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db import transaction
from django.db.models import Q, Count, Sum
from django.http import HttpResponse


from .. import spk
from ..models import (
    Order, OrderItem, JobBoard, CustomUser, Contact, OrderActivityLog, TahapProses,
    PengembalianOrder, OrderPayment, SaldoKasHarian,
)
from ..serializers import (
    OrderSerializer, OrderItemSerializer, JobBoardSerializer, PengembalianOrderSerializer
)
from ..permissions import IsOwnerOrManager, IsOwnerManagerAdminOrKasir, IsClockedIn
from users.models import SecurityAuditLog

from .jobs import deduct_job_materials_if_needed

logger = logging.getLogger(__name__)


def _active_shift_for(user):
    """Shift terbuka kasir saat pembayaran dicatat, bila ada."""
    if not user or not getattr(user, 'pk', None):
        return None
    return SaldoKasHarian.objects.filter(
        kasir=user, waktu_tutup__isnull=True,
    ).order_by('-waktu_buka', '-id').first()


def _record_order_payment(*, order, activity_log, actor, jumlah, metode, referensi='',
                          idempotency_key=None, is_dp=False):
    """Simpan peristiwa pembayaran tanpa mengubah saldo agregat pada Order."""
    return OrderPayment.objects.create(
        order=order,
        activity_log=activity_log,
        shift=_active_shift_for(actor),
        jumlah=jumlah,
        metode_pembayaran=(metode or 'tunai')[:50],
        referensi_pembayaran=(referensi or '')[:255],
        idempotency_key=idempotency_key or None,
        is_dp=is_dp,
        dibuat_oleh=actor,
    )


class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_qs = Order.objects.prefetch_related(
            'items__jobs',
            'items__jobs__tahap',
            'items__jobs__tahap__divisi',
            'items__jobs__pic_staff',
            'items__jobs__pic_staff__divisi',
            # OrderItemSerializer mengekspos product_nama/sku/brand/kategori dan
            # variant_nama. Tanpa prefetch ini tiap item memicu query sendiri.
            'items__product__brand',
            'items__product__kategori',
            'items__variant',
            # OrderSerializer menyertakan activity_logs beserta user tiap log —
            # penyumbang query terbesar bila tidak di-prefetch.
            'activity_logs__user',
            'payments__dibuat_oleh',
            'payments__shift',
        ).order_by('-waktu', '-id')
        
        # ✅ Filter by nomor_wa if provided in query params (optimasi query detail customer)
        nomor_wa = self.request.query_params.get('nomor_wa')
        if nomor_wa:
            base_qs = base_qs.filter(nomor_wa=nomor_wa)
            
        # ✅ Filter search di database level
        search = self.request.query_params.get('search')
        if search:
            base_qs = base_qs.filter(
                Q(id__icontains=search) |
                Q(nama__icontains=search) |
                Q(nomor_wa__icontains=search)
            )
            
        # Filter status_global/sumber eksplisit. Sebelumnya hanya `tab` yang
        # dikenali, sehingga permintaan seperti ?status_global=review&sumber=wa
        # (dipakai antrean WA dan badge topbar kasir) diabaikan diam-diam dan
        # mengembalikan SELURUH order — badge pun menghitung semuanya.
        status_global = self.request.query_params.get('status_global')
        if status_global:
            valid_status = {kode for kode, _ in Order.STATUS_GLOBAL_CHOICES}
            if status_global in valid_status:
                base_qs = base_qs.filter(status_global=status_global)

        sumber = self.request.query_params.get('sumber')
        if sumber:
            base_qs = base_qs.filter(sumber=sumber)

        # ✅ Filter tab/status di database level
        tab = self.request.query_params.get('tab')
        if tab:
            tab_map = {
                'pending': 'review',
                'printing': 'proses',
                'completed': 'selesai',
                'cancelled': 'batal'
            }
            mapped_tab = tab_map.get(tab, tab)
            if mapped_tab == 'piutang':
                base_qs = base_qs.filter(sisa_tagihan__gt=0).exclude(status_global='batal')
            elif mapped_tab in ['draft', 'quotation', 'review', 'desain', 'proses', 'ready', 'selesai', 'batal']:
                base_qs = base_qs.filter(status_global=mapped_tab)
            
        # Kasir ikut melihat seluruh order: perannya di meja depan — menerima
        # antrean WA, membuat order, menagih pesanan yang siap diambil. Batasan
        # pic_staff di bawah ditujukan untuk staff produksi, yang memang hanya
        # boleh melihat pekerjaannya sendiri. Tanpa kasir di daftar ini, semua
        # layar kasir yang membaca /orders/ menerima daftar kosong.
        if user.role in ['owner', 'manager', 'admin', 'kasir']:
            return base_qs
        my_order_ids = JobBoard.objects.filter(
            pic_staff=user
        ).values_list('order_item__order_id', flat=True)
        return base_qs.filter(id__in=my_order_ids)

    @transaction.atomic
    def perform_create(self, serializer):
        # ── Staff hanya boleh mencatat detail pesanan (pelanggan + item) ──
        # Uang & status TETAP wewenang kasir — dipaksa di sini, bukan
        # dipercaya dari body request, supaya staff tidak bisa langsung
        # menandai order "selesai" atau mencatat DP tanpa uang benar-benar
        # diterima kasir (kelas bug sama dengan guard status_global di
        # perform_update, sekarang versi CREATE-nya). Order staff masuk
        # sumber='staff', diproses kasir lewat antrean terpisah sebelum
        # diterbitkan SPK (fitur "Buat Order" staff, 2026-09-06).
        if self.request.user.role == 'staff':
            serializer.validated_data['sumber'] = 'staff'
            serializer.validated_data['dilayani_oleh'] = self.request.user
            serializer.validated_data['status_global'] = 'review'
            serializer.validated_data['dp_dibayar'] = 0
            serializer.validated_data['diskon_persen'] = 0
            serializer.validated_data['metode_diskon'] = 'tidak_ada'
            serializer.validated_data.pop('kupon', None)

        # ── Validasi data pelanggan & pelayan WAJIB sebelum order tersimpan ──
        # Sebelumnya order bisa dibuat dengan nomor asal-asalan (mis. bukan
        # format WA sama sekali) — hanya field kosong yang tertolak DRF secara
        # default, format & kelengkapan lain tidak pernah dicek. Order tanpa
        # data pelanggan yang jelas / tanpa penanggung jawab (dilayani_oleh)
        # tidak bisa dipertanggungjawabkan, jadi ditolak di sini SEBELUM
        # baris apa pun tersimpan.
        import re
        nomor_wa = (serializer.validated_data.get('nomor_wa') or '').strip()
        cleaned_wa = re.sub(r'[\s\-()]+', '', nomor_wa)
        if not re.match(r'^\+?\d{8,15}$', cleaned_wa):
            raise ValidationError({
                'error': 'Nomor WhatsApp pelanggan tidak valid. Gunakan format angka 8-15 digit (boleh diawali +).',
            })

        dilayani_oleh_obj = serializer.validated_data.get('dilayani_oleh')
        if not dilayani_oleh_obj:
            raise ValidationError({'error': 'Karyawan yang melayani (Dilayani Oleh) wajib dipilih.'})
        if not dilayani_oleh_obj.is_active:
            raise ValidationError({'error': 'Karyawan yang melayani tidak aktif.'})

        # Auto-generate ID: ORD-20260517-A3F2
        today = timezone.now().strftime('%Y%m%d')
        short_id = uuid.uuid4().hex[:4].upper()
        order_id = f'ORD-{today}-{short_id}'
        instance = serializer.save(id=order_id, _current_user=self.request.user)

        # Simpan penggunaan kupon HANYA bila kasir memilih metode 'kupon' —
        # eksplisit lewat selector diskon di frontend (tidak lagi otomatis
        # dibandingkan diam-diam dengan Diskon Penjualan).
        kupon_kode = self.request.data.get('kupon_kode')
        diskon_kupon = self.request.data.get('diskon_kupon', 0)
        if kupon_kode and instance.metode_diskon == 'kupon':
            try:
                from api.marketing_models import DiscountCoupon, CouponUsage
                from api.models import Contact
                kupon_obj = DiscountCoupon.objects.filter(kode__iexact=kupon_kode.strip()).first()
                if not kupon_obj:
                    raise ValidationError({'kupon_kode': 'Kupon tidak ditemukan atau sudah tidak aktif.'})
                if kupon_obj:
                    # Hubungkan kupon dan nilai diskon ke order.
                    # PENTING: save() TANPA update_fields — Order.save() menghitung
                    # ulang total_harga/sisa_tagihan dari item+diskon+kupon, tapi
                    # bila update_fields dibatasi ke ['kupon','diskon_kupon'] saja,
                    # Django hanya menulis kolom itu ke DB dan total_harga yang
                    # sudah dihitung ulang di memori TIDAK PERNAH tersimpan (bug lama).
                    instance.kupon = kupon_obj
                    instance.diskon_kupon = int(diskon_kupon or 0)
                    if instance.diskon_kupon < 0:
                        raise ValidationError({'diskon_kupon': 'Nilai diskon tidak boleh negatif.'})
                    instance.save()

                    customer = Contact.objects.filter(nomor_wa=instance.nomor_wa).first()
                    CouponUsage.objects.create(
                        kupon=kupon_obj,
                        pelanggan=customer,
                        order=instance,
                        nilai_diskon=int(diskon_kupon or 0),
                        tanggal=timezone.localdate(),
                        kanal='pos'
                    )
                    kupon_obj.penggunaan_count = CouponUsage.objects.filter(kupon=kupon_obj).count()
                    kupon_obj.save(update_fields=['penggunaan_count'])
            except Exception:
                logger.exception("Failed to record CouponUsage for order %s", order_id)
                raise

        # Catatan: Diskon Penjualan otomatis TIDAK dievaluasi di sini — order baru
        # dibuat TANPA item (frontend mengirim item lewat POST /order-items/
        # terpisah setelah ini), jadi subtotal masih 0 di titik ini. Evaluasinya
        # dilakukan reaktif di OrderItemViewSet setiap kali item berubah — lihat
        # `_terapkan_diskon_penjualan_otomatis` di bawah.

        # Log pembuatan pesanan
        OrderActivityLog.objects.create(
            order=instance,
            user=self.request.user,
            tindakan="CREATE_ORDER",
            keterangan=f"Pesanan baru '{instance.id}' berhasil dibuat."
        )

        # T-202: satu-satunya writer jurnal pembayaran Order.
        if instance.dp_dibayar > 0:
            from decimal import Decimal as _Decimal
            from accounting.services.order_posting import post_order_payment_journal as _post_order_payment
            _dp_log = OrderActivityLog.objects.create(
                order=instance,
                user=self.request.user,
                tindakan='PAYMENT',
                keterangan=f'DP awal {instance.dp_dibayar} [dp-create]',
            )
            _record_order_payment(
                order=instance, activity_log=_dp_log, actor=self.request.user,
                jumlah=instance.dp_dibayar, metode=instance.metode_pembayaran,
                referensi=instance.referensi_pembayaran, is_dp=True,
            )
            _post_order_payment(
                order=instance,
                activity_log=_dp_log,
                actor=self.request.user,
                jumlah_bayar=_Decimal(str(instance.dp_dibayar)),
                is_dp=True,
            )

    @action(detail=False, methods=['post'], url_path='checkout-pos',
            permission_classes=[IsOwnerManagerAdminOrKasir])
    @transaction.atomic
    def checkout_pos(self, request):
        """Buat order dari keranjang POS, terima DP, dan terbitkan SPK dalam satu transaksi.

        Berbeda dengan ``POST /orders/`` lama (header lalu item terpisah), endpoint
        ini menjaga order, item, pembayaran, jurnal, dan JobBoard tetap atomik.
        DP tetap merupakan nominal pembayaran; metode seperti tunai/QRIS/transfer
        adalah kanal pembayaran.
        """
        from decimal import Decimal
        from django.contrib.auth import get_user_model
        from ..product_models import Product, ProductVariant, ProductStockMovement
        from ..services.package_sales import resolve_package_for_sale
        from .. import pos_settings, stock_fifo
        from ..services.addon_sales import apply_addons, resolve_addons
        from accounting.services.order_posting import (
            post_order_payment_journal,
            resolve_and_assign_order_payment_method,
        )

        if request.user.role not in ('owner', 'manager', 'admin', 'kasir'):
            return Response({'error': 'Anda tidak memiliki izin membuat order dari kasir.'},
                            status=status.HTTP_403_FORBIDDEN)

        raw_key = str(request.data.get('idempotency_key') or '').strip()
        try:
            checkout_key = uuid.UUID(raw_key)
        except (ValueError, AttributeError):
            return Response({'error': 'idempotency_key UUID wajib diisi.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # ID deterministik membuat klik ulang/timeout tidak menciptakan order kedua.
        order_id = f'POS-ORD-{checkout_key.hex.upper()}'
        existing = Order.objects.filter(pk=order_id).first()
        if existing:
            return Response(OrderSerializer(existing, context={'request': request}).data,
                            status=status.HTTP_200_OK)

        nama = str(request.data.get('nama') or '').strip()
        nomor_wa = str(request.data.get('nomor_wa') or '').strip()
        if not nama:
            return Response({'error': 'Nama pelanggan wajib diisi untuk transaksi DP.'},
                            status=status.HTTP_400_BAD_REQUEST)
        import re
        if not re.match(r'^\+?\d{8,15}$', re.sub(r'[\s\-()]+', '', nomor_wa)):
            return Response({'error': 'Nomor WhatsApp pelanggan tidak valid.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            dilayani_oleh_id = int(request.data.get('dilayani_oleh_id'))
        except (TypeError, ValueError):
            return Response({'error': 'Karyawan yang melayani wajib dipilih.'},
                            status=status.HTTP_400_BAD_REQUEST)
        dilayani_oleh = get_user_model().objects.filter(pk=dilayani_oleh_id, is_active=True).first()
        if not dilayani_oleh:
            return Response({'error': 'Karyawan yang melayani tidak valid atau nonaktif.'},
                            status=status.HTTP_400_BAD_REQUEST)

        items_data = request.data.get('items') or []
        if not isinstance(items_data, list) or not items_data:
            return Response({'error': 'Keranjang pesanan tidak boleh kosong.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            diskon_persen = float(request.data.get('diskon_persen') or 0)
        except (TypeError, ValueError):
            return Response({'error': 'Diskon pesanan tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)
        if not 0 <= diskon_persen <= 100:
            return Response({'error': 'Diskon pesanan harus antara 0 sampai 100.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if diskon_persen:
            return Response({
                'error': 'Diskon manual tidak diizinkan. Gunakan kupon atau Diskon Penjualan yang aktif di Marketing.',
            }, status=status.HTTP_400_BAD_REQUEST)

        metode_diskon = str(request.data.get('metode_diskon') or 'tidak_ada').strip()
        if metode_diskon not in ('tidak_ada', 'kupon', 'otomatis'):
            return Response({'error': 'Metode diskon tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)
        kupon_kode = str(request.data.get('kupon_kode') or '').strip()
        if metode_diskon == 'kupon' and not kupon_kode:
            return Response({'error': 'Kode kupon wajib dipilih dari Diskon Pesanan.'},
                            status=status.HTTP_400_BAD_REQUEST)

        due_date_raw = str(request.data.get('jatuh_tempo') or '').strip()
        due_date = parse_date(due_date_raw) if due_date_raw else None
        if not due_date:
            return Response({'error': 'Jatuh tempo wajib diisi untuk transaksi DP.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if due_date < timezone.localdate():
            return Response({'error': 'Jatuh tempo tidak boleh sebelum hari ini.'},
                            status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.create(
            id=order_id,
            nama=nama,
            nomor_wa=nomor_wa,
            sumber='pos',
            status_global='review',
            catatan_pelanggan=str(request.data.get('catatan') or '')[:2000],
            metode_pembayaran=str(request.data.get('metode_pembayaran') or 'tunai')[:20],
            diskon_persen=0,
            metode_diskon=metode_diskon,
            jatuh_tempo=due_date,
            dilayani_oleh=dilayani_oleh,
            dp_dibayar=0,
        )
        order._current_user = request.user

        # Pelacakan stok — dikumpulkan sepanjang loop item (termasuk komponen
        # paket) lalu divalidasi & dikurangi sekaligus setelah semua item
        # tersimpan, mengikuti pola create_sale() di pos_services.py (M8:
        # mutasi stok hanya lewat service FIFO resmi, bukan langsung di view).
        stock_requested = {}
        stock_owners = {}
        stock_lines = []

        for raw_item in items_data:
            try:
                qty = int(raw_item.get('qty') or 0)
                harga_satuan = int(raw_item.get('harga_satuan') or 0)
            except (TypeError, ValueError):
                raise ValidationError({'error': 'Qty atau harga item tidak valid.'})
            if qty <= 0 or harga_satuan < 0:
                raise ValidationError({'error': 'Qty harus lebih dari nol dan harga tidak boleh negatif.'})

            product = None
            variant = None
            package = None
            item_addons = []
            addon_total = Decimal('0')
            package_id = raw_item.get('package_id') or raw_item.get('paket_id')
            if package_id:
                package, package_qty, package_price = resolve_package_for_sale(
                    package_id, qty, channel='pos', lock=True,
                )
                qty = int(package_qty)
                harga_satuan = int(package_price)
                # Paket tidak punya stok sendiri — mutasi dihitung dari komponen
                # master paket, sama seperti create_sale() di pos_services.py.
                for component in package.items.all():
                    component_product = Product.objects.select_for_update().get(pk=component.product_id)
                    component_variant = None
                    if component.variant_id:
                        component_variant = ProductVariant.objects.select_for_update().filter(
                            pk=component.variant_id, product=component_product,
                        ).first()
                        if not component_variant:
                            raise ValidationError({'error': f"Komponen varian paket '{package.nama}' tidak valid."})
                    component_qty = Decimal(str(qty)) * Decimal(str(component.qty))
                    key = (component_product.id, component_variant.id if component_variant else None)
                    stock_requested[key] = stock_requested.get(key, Decimal('0')) + component_qty
                    stock_owners[key] = (component_product, component_variant)
                    stock_lines.append((component_product, component_variant, component_qty, package.nama))
            elif raw_item.get('product_id'):
                product = Product.objects.select_for_update().filter(pk=raw_item['product_id']).first()
                if not product:
                    raise ValidationError({'error': 'Produk pada keranjang tidak ditemukan.'})
                if raw_item.get('variant_id'):
                    variant = ProductVariant.objects.select_for_update().filter(pk=raw_item['variant_id'], product=product).first()
                    if not variant:
                        raise ValidationError({'error': 'Varian produk pada keranjang tidak valid.'})
                # Harga katalog dihitung server; harga kustom hanya diizinkan untuk
                # item yang memang membawa spesifikasi kalkulator cetak.
                if not raw_item.get('is_custom_priced'):
                    harga_satuan = int(variant.harga_jual_toko if variant and variant.harga_jual_toko is not None else product.harga_jual_toko or 0)
                qty_decimal = Decimal(str(qty))
                key = (product.id, variant.id if variant else None)
                stock_requested[key] = stock_requested.get(key, Decimal('0')) + qty_decimal
                stock_owners[key] = (product, variant)
                stock_lines.append((product, variant, qty_decimal, None))
                # Addon: harga & qty SELALU dihitung ulang dari Addon.harga di
                # server (M6); qty per addon default ikut qty item induk kalau
                # klien cuma kirim daftar ID polos (kompatibel mundur).
                item_addons = resolve_addons(
                    raw_item.get('addons') or raw_item.get('addon_ids'), product, default_qty=qty_decimal,
                )
                addon_total = sum((Decimal(str(a.harga or 0)) * q for a, q in item_addons), Decimal('0'))

            detail = raw_item.get('detail') if isinstance(raw_item.get('detail'), dict) else {}
            item = OrderItem(
                order=order,
                jenis_produk=str(
                    getattr(package, 'nama', None) or raw_item.get('nama') or getattr(product, 'nama', None) or 'Item Kustom'
                )[:100],
                product=product,
                variant=variant,
                paket=package,
                panjang=float(raw_item.get('panjang') or 0),
                lebar=float(raw_item.get('lebar') or 0),
                harga_per_m2=int(raw_item.get('harga_per_m2') or 0),
                qty=qty,
                harga_jual=harga_satuan * qty + int(addon_total),
                detail=[detail] if detail else [],
                keterangan_detail=str(raw_item.get('catatan') or '')[:2000],
                # Stok komponen paket dipotong lewat produk komponennya (bukan
                # field product milik OrderItem ini), jadi flag ini hanya untuk
                # item produk langsung — supaya OrderItemSerializer tidak ikut
                # memotong stok lagi kalau item ini diedit lewat /order-items/.
                stok_dikurangi=bool(product and not package and product.lacak_inventori and pos_settings.pos_mengurangi_stok()),
            )
            item._current_user = request.user
            item.save()
            if item_addons:
                apply_addons(
                    addons=item_addons, user=request.user, tanggal=timezone.localdate(),
                    order_item=item, order=order, deduct_stock=pos_settings.pos_mengurangi_stok(),
                )

        if pos_settings.pos_mengurangi_stok():
            for key, total_qty in stock_requested.items():
                stock_product, stock_variant = stock_owners[key]
                owner = stock_variant or stock_product
                if stock_product.lacak_inventori and total_qty > Decimal(str(owner.qty_stok or 0)):
                    raise ValidationError({'error': f"Stok '{owner}' tidak mencukupi untuk pesanan ini."})
            now_date = timezone.localdate()
            for stock_product, stock_variant, stock_qty, package_name in stock_lines:
                if not stock_product.lacak_inventori:
                    continue
                owner = stock_variant or stock_product
                start = owner.qty_stok
                owner.qty_stok = start - stock_qty
                owner.save(update_fields=['qty_stok'])
                suffix = f' - Paket {package_name}' if package_name else ''
                movement = ProductStockMovement.objects.create(
                    product=stock_product, variant=stock_variant, user=request.user, tipe='penjualan',
                    qty=stock_qty, stok_awal=start, stok_akhir=owner.qty_stok, order=order,
                    catatan=f'Order POS {order.id}{suffix}', tanggal=now_date,
                )
                stock_fifo.consume_layers(stock_product, stock_variant, stock_qty, movement=movement)

        # Item.save menghitung subtotal; simpan header sekali agar diskon dan sisa
        # tagihan dihitung dari seluruh keranjang sebelum nominal DP divalidasi.
        order.refresh_from_db()
        order._current_user = request.user
        order.save()
        order.refresh_from_db()

        # Terapkan ulang aturan Marketing di server. Nilai preview UI tidak
        # dipercaya: kupon, syarat pelanggan/produk, dan kuota harus valid saat
        # transaksi benar-benar disimpan.
        from ..marketing_models import CouponUsage, KANAL_POS
        from ..promo_engine import BarisKeranjang, KonteksPromo, evaluate_coupon_code, evaluate_sales_discount
        customer = Contact.objects.filter(nomor_wa=order.nomor_wa).first()
        baris_promo = []
        for item in order.items.all():
            qty_decimal = Decimal(str(item.qty or 1))
            line_total = Decimal(str(item.harga_jual or 0))
            unit_price = line_total / qty_decimal if qty_decimal else Decimal('0')
            baris_promo.append(BarisKeranjang(
                product=item.product,
                variant=item.variant,
                package=item.paket,
                qty=qty_decimal,
                harga=unit_price,
                subtotal=line_total,
            ))
        konteks_promo = KonteksPromo(
            baris=baris_promo,
            subtotal=Decimal(str(order.total_harga or 0)),
            pelanggan=customer,
            kanal=KANAL_POS,
        )
        if metode_diskon == 'kupon':
            hasil_kupon = evaluate_coupon_code(kupon_kode, konteks_promo)
            if not hasil_kupon.ok:
                raise ValidationError({'error': f'Kupon ditolak: {hasil_kupon.alasan}'})
            order.kupon = hasil_kupon.kupon
            order.diskon_kupon = int(round(hasil_kupon.diskon))
            order._current_user = request.user
            order.save()
            CouponUsage.objects.create(
                kupon=hasil_kupon.kupon,
                pelanggan=customer,
                order=order,
                nilai_diskon=hasil_kupon.diskon,
                tanggal=timezone.localdate(),
                kanal=KANAL_POS,
            )
            hasil_kupon.kupon.penggunaan_count = CouponUsage.objects.filter(kupon=hasil_kupon.kupon).count()
            hasil_kupon.kupon.save(update_fields=['penggunaan_count'])
            # Model Order membaca CouponUsage sebagai sumber historis diskon.
            order._current_user = request.user
            order.save()
        elif metode_diskon == 'otomatis':
            diskon_otomatis, _aturan = evaluate_sales_discount(konteks_promo)
            order.diskon_otomatis = int(round(diskon_otomatis))
            order._current_user = request.user
            order.save()
        order.refresh_from_db()

        try:
            jumlah_bayar = int(request.data.get('jumlah_bayar') or 0)
        except (TypeError, ValueError):
            raise ValidationError({'error': 'Nominal pembayaran tidak valid.'})
        if jumlah_bayar <= 0 or jumlah_bayar > order.sisa_tagihan:
            raise ValidationError({'error': 'Nominal DP harus lebih dari nol dan tidak melebihi total tagihan.'})

        order.dp_dibayar = jumlah_bayar
        order._current_user = request.user
        order.save()
        resolve_and_assign_order_payment_method(order, order.metode_pembayaran)
        order.save(update_fields=['accounting_payment_method', 'settlement_status'])
        payment_log = OrderActivityLog.objects.create(
            order=order,
            user=request.user,
            tindakan='PAYMENT',
            keterangan=f'Pembayaran POS {jumlah_bayar} [{checkout_key}]',
        )
        _record_order_payment(
            order=order, activity_log=payment_log, actor=request.user,
            jumlah=jumlah_bayar, metode=order.metode_pembayaran,
            referensi=order.referensi_pembayaran, idempotency_key=str(checkout_key),
            is_dp=jumlah_bayar < order.total_harga,
        )
        post_order_payment_journal(
            order=order,
            activity_log=payment_log,
            actor=request.user,
            jumlah_bayar=Decimal(str(jumlah_bayar)),
            is_dp=jumlah_bayar < order.total_harga,
        )

        spk_payload = request.data.get('spk')
        if not isinstance(spk_payload, dict):
            raise ValidationError({'error': 'Tujuan divisi dan deadline SPK wajib diisi.'})
        try:
            staff = spk.resolve_staff(spk_payload.get('staff_id'), pemohon=request.user)
            deadline = spk.resolve_deadline(spk_payload.get('deadline'))
            if not deadline:
                raise spk.SpkError('Deadline SPK wajib diisi.')
            tahap = spk.resolve_tahap(
                tahap_id=spk_payload.get('tahap_id'),
                divisi_id=spk_payload.get('divisi_id'),
                staff=staff,
            )
            jobs = spk.terbitkan(order.items.all(), field='order_item', tahap=tahap, staff=staff, deadline=deadline)
        except spk.SpkError as exc:
            raise ValidationError({'error': exc.pesan})

        order.status_global = 'desain' if spk.is_divisi_desain(staff, tahap) else 'proses'
        order._current_user = request.user
        order.save()
        OrderActivityLog.objects.create(
            order=order,
            user=request.user,
            tindakan='TERBITKAN_SPK',
            keterangan=f"SPK POS diterbitkan ke {spk.nama_target(staff, tahap)}.",
        )
        # Invoice DP harus dikirim setelah seluruh transaksi (termasuk jurnal dan
        # SPK) committed. Gangguan gateway tidak boleh membatalkan order.
        from ..services.order_invoice_whatsapp import jadwalkan_invoice_dp_otomatis
        jadwalkan_invoice_dp_otomatis(order.id)
        payload = OrderSerializer(order, context={'request': request}).data
        payload['jobs'] = jobs
        return Response(payload, status=status.HTTP_201_CREATED)

    def _ensure_write_role(self):
        if self.request.user.role not in ('owner', 'manager', 'admin', 'kasir'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Anda tidak memiliki izin untuk mengubah pesanan.')

    def perform_update(self, serializer):
        self._ensure_write_role()
        # 'batal'/'selesai' WAJIB lewat /batalkan/ atau /selesaikan/ (pemulihan
        # stok FIFO + jurnal pembalik/HPP — lihat order_actions.py). PATCH
        # langsung ke field ini akan menimpa status TANPA efek samping itu
        # sama sekali. Sebelumnya endpoint generik ini tidak menjaga field ini
        # sama sekali, sehingga beberapa layar (menu Pesanan, panel Produksi)
        # memakainya sebagai jalan pintas dan diam-diam merusak stok/jurnal
        # akuntansi tanpa error apa pun (bug ditemukan & diperbaiki 2026-09-05,
        # audit modul Transaksi & Pembayaran — sama seperti bug import-status-csv
        # yang lebih dulu ditemukan & diperbaiki via jalur yang berbeda).
        new_status = serializer.validated_data.get('status_global')
        if new_status in ('batal', 'selesai'):
            raise ValidationError({
                'status_global': (
                    f"Ubah status ke '{new_status}' wajib lewat tombol Batalkan/Selesaikan resmi "
                    "(memastikan stok & jurnal akuntansi ikut benar), bukan lewat edit langsung."
                ),
            })
        serializer.instance._current_user = self.request.user
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        # Proteksi Keamanan: Hanya Owner dan Manager yang boleh menghapus pesanan
        if request.user.role not in ['owner', 'manager']:
            SecurityAuditLog.objects.create(
                user=request.user,
                event="PERMISSION_DENIED",
                ip_address=request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0].strip(),
                user_agent=request.META.get("HTTP_USER_AGENT", ""),
                keterangan=f"Ditolak menghapus pesanan {kwargs.get('pk')} karena hak akses tidak mencukupi (role: {request.user.role})",
                berhasil=False,
            )
            return Response({'error': 'Hanya Owner atau Manager yang diperbolehkan menghapus pesanan secara permanen.'}, status=status.HTTP_403_FORBIDDEN)
        
        order = self.get_object()
        # Catat audit log penghapusan sebelum dihapus
        SecurityAuditLog.objects.create(
            user=request.user,
            event="TOKEN_REVOKED", # Menggunakan token_revoked sebagai representasi general admin revoke action
            ip_address=request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")).split(",")[0].strip(),
            keterangan=f"Berhasil menghapus permanen pesanan '{order.id}' milik pelanggan '{order.nama}'",
            berhasil=True,
        )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        """
        GET /api/orders/stats/
        Mendapatkan data statistik ringkasan pesanan untuk dashboard pesanan secara cepat dari database.
        """
        user = self.request.user
        base_qs = Order.objects.all()
        
        # Sesuai get_queryset, batasi data jika bukan admin/owner/manager
        if user.role not in ['owner', 'manager', 'admin']:
            my_order_ids = JobBoard.objects.filter(
                pic_staff=user
            ).values_list('order_item__order_id', flat=True)
            base_qs = base_qs.filter(id__in=my_order_ids)
            
        stats_agg = base_qs.aggregate(
            total_count=Count('id'),
            total_piutang=Sum('sisa_tagihan'),
            piutang_count=Count('id', filter=Q(sisa_tagihan__gt=0) & ~Q(status_global='batal'))
        )
        
        # Kelompokkan berdasarkan status_global
        status_counts = base_qs.values('status_global').annotate(count=Count('id'))
        status_map = {item['status_global']: item['count'] for item in status_counts}
        
        # Hitung sisa tagihan khusus yang tidak batal
        piutang_non_batal = base_qs.exclude(status_global='batal').aggregate(
            total=Sum('sisa_tagihan')
        )['total'] or 0
        
        return Response({
            'total_count': stats_agg['total_count'] or 0,
            'total_piutang': piutang_non_batal,
            'piutang_count': stats_agg['piutang_count'] or 0,
            'draft': status_map.get('draft', 0),
            'quotation': status_map.get('quotation', 0),
            'review': status_map.get('review', 0),
            'desain': status_map.get('desain', 0),
            'proses': status_map.get('proses', 0),
            'ready': status_map.get('ready', 0),
            'selesai': status_map.get('selesai', 0),
            'batal': status_map.get('batal', 0),
        })

    @action(detail=True, methods=['get'], url_path='print-return')
    def print_return(self, request, pk=None):
        """
        GET /api/orders/{order_id}/print-return/
        Generate HTML untuk print/download PDF pengembalian pesanan.
        """
        try:
            order = self.get_object()
        except Order.DoesNotExist:
            return Response({'error': 'Order tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        # Parse return info dari catatan_pelanggan
        def get_return_info(catatan):
            if not catatan:
                return None
            import re
            match = re.search(
                r'\[PENGEMBALIAN - Tanggal:\s*([^\s,]+),\s*Status:\s*([^,]*),\s*Catatan:\s*([^\]]*)\]',
                catatan
            ) or re.search(
                r'\[PENGEMBALIAN - Tanggal:\s*([^\s,]+),\s*Catatan:\s*([^\]]*)\]',
                catatan
            )
            if match:
                if len(match.groups()) == 3:
                    return {'tanggal': match.group(1), 'status': match.group(2), 'catatan': match.group(3)}
                return {'tanggal': match.group(1), 'status': 'Tunda', 'catatan': match.group(2)}
            return None

        return_info = get_return_info(order.catatan_pelanggan)
        if not return_info:
            return Response({'error': 'Data pengembalian tidak ditemukan.'}, status=status.HTTP_400_BAD_REQUEST)

        # Ambil nama akun yang membuat order (dari activity_logs)
        creator_name = 'System'
        create_log = order.activity_logs.filter(tindakan='CREATE_ORDER').first()
        if create_log and create_log.user:
            creator_name = create_log.user.username

        # Generate return ID (SR format)
        order_time = order.waktu
        return_id = f"SR{order_time.strftime('%y%m%d')}0000000{order.id}"

        # Generate HTML
        html = self._generate_return_html(
            return_id=return_id,
            order=order,
            return_info=return_info,
            creator_name=creator_name
        )

        response = HttpResponse(html, content_type='text/html')
        return response

    def _generate_return_html(self, return_id, order, return_info, creator_name):
        """Generate HTML untuk print return order"""
        return f"""
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Pengembalian - {return_id}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; }}
        .container {{ max-width: 800px; margin: 20px auto; background: white; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}

        .header {{ text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 20px; }}
        .header h1 {{ font-size: 28px; color: #333; margin-bottom: 5px; }}
        .header p {{ color: #999; font-size: 12px; }}

        .content {{ margin: 30px 0; }}
        .section {{ margin-bottom: 25px; }}
        .section-title {{ color: #2563eb; font-weight: bold; font-size: 13px; margin-bottom: 12px; text-transform: uppercase; }}

        .info-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }}
        .info-box {{ }}
        .info-label {{ color: #999; font-size: 11px; font-weight: 500; margin-bottom: 3px; }}
        .info-value {{ color: #333; font-size: 13px; font-weight: 600; }}

        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        th {{ background: #f9f9f9; border: 1px solid #e0e0e0; padding: 10px; text-align: left; font-size: 12px; font-weight: 600; color: #666; }}
        td {{ border: 1px solid #e0e0e0; padding: 10px; font-size: 12px; color: #333; }}

        .total-section {{ background: #f9f9f9; padding: 15px; border: 1px solid #e0e0e0; text-align: right; }}
        .total-row {{ display: flex; justify-content: flex-end; margin-bottom: 8px; }}
        .total-label {{ color: #666; margin-right: 20px; font-size: 12px; }}
        .total-value {{ color: #333; font-weight: 600; font-size: 12px; min-width: 80px; text-align: right; }}

        .footer {{ margin-top: 40px; border-top: 2px solid #e0e0e0; padding-top: 20px; text-align: center; }}
        .footer-line {{ display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-bottom: 3px; }}

        .notes {{ background: #fffbf0; border-left: 3px solid #fb923c; padding: 12px; margin-top: 15px; }}
        .notes-label {{ font-weight: 600; color: #333; font-size: 12px; margin-bottom: 5px; }}
        .notes-value {{ color: #666; font-size: 12px; white-space: pre-wrap; }}

        @media print {{
            body {{ background: white; }}
            .container {{ box-shadow: none; margin: 0; padding: 20px; }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <!-- Header dengan ID Pengembalian -->
        <div class="header">
            <h1>🎈 No. Pengembalian #{return_id}</h1>
            <p>{creator_name}</p>
        </div>

        <!-- Tanggal & No. Pesanan -->
        <div class="content">
            <div style="text-align: right; margin-bottom: 30px; font-size: 12px; color: #666;">
                <strong>Tanggal Pengembalian :</strong> {return_info.get('tanggal', '-')}
            </div>

            <!-- Pelanggan -->
            <div class="section">
                <div class="section-title">Pelanggan</div>
                <div class="info-grid">
                    <div class="info-box">
                        <div class="info-label">Nama</div>
                        <div class="info-value">{order.nama or '-'}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">No. WA</div>
                        <div class="info-value">{order.nomor_wa or 'N/A'}</div>
                    </div>
                </div>
                <div class="info-box">
                    <div class="info-label">No. Pesanan</div>
                    <div class="info-value" style="font-family: monospace;">#{order.id}</div>
                </div>
            </div>

            <!-- Tabel Produk -->
            <div class="section">
                <div class="section-title">Deskripsi</div>
                <table>
                    <thead>
                        <tr>
                            <th>Deskripsi</th>
                            <th style="width: 80px;">Qty</th>
                            <th style="width: 100px;">Harga</th>
                            <th style="width: 100px;">Total Harga</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="background: #fafafa;">
                            <td colspan="4" style="text-align: center; padding: 20px; color: #999; font-style: italic;">Total Pengembalian</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Total Pengembalian -->
            <div class="total-section">
                <div class="total-row">
                    <span class="total-label">Subtotal</span>
                    <span class="total-value">IDR 0</span>
                </div>
                <div class="total-row">
                    <span class="total-label">Tambahan</span>
                    <span class="total-value">IDR 0</span>
                </div>
                <div class="total-row" style="font-size: 13px; font-weight: bold; color: #333; margin-top: 10px; border-top: 1px solid #e0e0e0; padding-top: 10px;">
                    <span class="total-label">Total</span>
                    <span class="total-value">IDR 0</span>
                </div>
            </div>

            <!-- Catatan -->
            {f'<div class="notes"><div class="notes-label">Catatan :</div><div class="notes-value">{return_info.get("catatan", "-")}</div></div>' if return_info.get('catatan') else ''}
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-line">
                <span><strong>Diketahui oleh:</strong> {creator_name}</span>
                <span><strong>Tanggal Cetak:</strong> {datetime.datetime.now().strftime('%d-%b-%Y')}</span>
            </div>
        </div>
    </div>

    <script>
        // Auto-print saat halaman selesai load
        // window.print();
    </script>
</body>
</html>
"""

    @action(detail=True, methods=['post'], url_path='bayar')
    @transaction.atomic
    def bayar(self, request, pk=None):
        # Penerimaan pembayaran adalah tugas owner/manager/admin/kasir. Tanpa
        # guard ini endpoint aksi DRF melewati perform_update dan staff
        # produksi yang login dapat mencatat pelunasan langsung lewat API.
        self._ensure_write_role()
        order = Order.objects.select_for_update().get(pk=pk)
        idem = str(request.data.get('idempotency_key') or '').strip()
        if idem and OrderActivityLog.objects.filter(order=order, tindakan='PAYMENT', keterangan__contains='[' + idem + ']').exists():
            return Response(OrderSerializer(order).data)
        jumlah_bayar = request.data.get('jumlah_bayar')
        metode = request.data.get('metode_pembayaran', 'tunai')
        referensi = str(request.data.get('referensi_pembayaran') or '').strip()

        if jumlah_bayar is None:
            return Response({'error': 'jumlah_bayar wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            jumlah_bayar = int(jumlah_bayar)
        except (ValueError, TypeError):
            return Response({'error': 'jumlah_bayar harus berupa angka bulat.'}, status=status.HTTP_400_BAD_REQUEST)

        if jumlah_bayar <= 0:
            return Response({'error': 'jumlah_bayar harus lebih dari nol.'}, status=status.HTTP_400_BAD_REQUEST)

        # T-203: cegah overpayment — sisa_tagihan sudah mencerminkan
        # total_harga (setelah diskon/kupon/pembulatan, lihat Order.save()).
        # Tanpa guard ini, jumlah_bayar berlebih tetap ter-posting penuh ke
        # jurnal (over-recognized revenue) sementara sisa_tagihan cuma
        # floor ke 0 secara diam-diam (M6: hitung ulang server-side, jangan
        # percaya input mentah).
        if jumlah_bayar > order.sisa_tagihan:
            return Response({
                'error': f'Jumlah bayar (Rp{jumlah_bayar:,}) melebihi sisa tagihan (Rp{order.sisa_tagihan:,}).',
            }, status=status.HTTP_400_BAD_REQUEST)

        order.dp_dibayar += jumlah_bayar
        order.metode_pembayaran = metode
        if referensi:
            order.referensi_pembayaran = referensi
        order._current_user = request.user
        order.save()
        payment_log = OrderActivityLog.objects.create(order=order, user=request.user, tindakan='PAYMENT', keterangan='Pembayaran %s [%s]' % (jumlah_bayar, idem or 'no-key'))
        _record_order_payment(
            order=order, activity_log=payment_log, actor=request.user,
            jumlah=jumlah_bayar, metode=metode, referensi=referensi,
            idempotency_key=idem or None, is_dp=order.dp_dibayar < order.total_harga,
        )

        # T-202: satu-satunya writer jurnal pembayaran Order.
        from decimal import Decimal as _Decimal
        from accounting.services.order_posting import (
            post_order_payment_journal as _post_order_payment,
            resolve_and_assign_order_payment_method,
        )
        # Setiap pembayaran membawa metode pembayaran aktual. Jangan
        # mempertahankan mapping lama (mis. Tunai) ketika user membayar
        # cicilan berikutnya via QRIS/Transfer, karena itu akan memposting ke
        # akun yang salah dan menghilangkan order dari batch settlement yang
        # benar.
        resolve_and_assign_order_payment_method(order, metode)
        order.save(update_fields=["accounting_payment_method", "settlement_status"])
        _post_order_payment(
            order=order,
            activity_log=payment_log,
            actor=request.user,
            jumlah_bayar=_Decimal(str(jumlah_bayar)),
            is_dp=False,
        )

        # Update statistik Contact
        try:
            contact = Contact.objects.get(nomor_wa=order.nomor_wa)
            my_orders = Order.objects.filter(nomor_wa=contact.nomor_wa).prefetch_related('items')
            contact.total_spent = sum(
                item.harga_jual
                for o in my_orders
                for item in o.items.all()
            )
            contact.save()
        except Contact.DoesNotExist:
            pass

        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='selesaikan')
    def selesaikan(self, request, pk=None):
        """
        POST /api/orders/{id}/selesaikan/
        Aksi dedicated untuk menyelesaiakan pesanan. Logic sesungguhnya ada di
        api/services/order_actions.py::selesaikan_order() — dipakai bareng
        dengan import_status_csv() supaya jurnal HPP tidak pernah terlewat
        lewat jalur mana pun (bug ditemukan & diperbaiki 2026-09-05).
        """
        self._ensure_write_role()
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Pesanan tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        from ..services.order_actions import selesaikan_order, SelesaikanOrderError
        try:
            order = selesaikan_order(order, actor=request.user)
        except SelesaikanOrderError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='minta-otp-void')
    def minta_otp_void(self, request, pk=None):
        """
        POST /api/orders/{id}/minta-otp-void/
        Kasir mengajukan permintaan pembatalan — perlu persetujuan OTP owner
        (lihat api/services/order_void_otp.py) sebelum /batalkan/ bisa
        dipanggil. Owner/manager/admin tidak perlu endpoint ini, mereka bisa
        langsung /batalkan/.
        """
        self._ensure_write_role()
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Pesanan tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        alasan = str(request.data.get('alasan') or '').strip()

        from ..services.order_void_otp import ajukan_permintaan_void, VoidOtpError
        try:
            void_request = ajukan_permintaan_void(order=order, kasir=request.user, alasan=alasan)
        except VoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        from ..serializers import OrderVoidRequestSerializer
        return Response(
            OrderVoidRequestSerializer(void_request, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='batalkan')
    @transaction.atomic
    def batalkan(self, request, pk=None):
        """
        POST /api/orders/{id}/batalkan/
        Aksi dedicated untuk membatalkan pesanan. Logic sesungguhnya ada di
        api/services/order_actions.py::batalkan_order() — dipakai bareng oleh
        endpoint ini dan bot WhatsApp (lihat api/views/whatsapp.py).

        Role di luar owner/manager/admin (kasir) wajib menyertakan
        `void_request_id` + `otp_code` dari permintaan yang sudah disetujui
        owner lewat /minta-otp-void/ (instruksi user 2026-08-14 — kasir tidak
        boleh membatalkan order tanpa persetujuan).
        """
        self._ensure_write_role()
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Pesanan tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        alasan = str(request.data.get('alasan') or request.data.get('alasan_pembatalan') or '').strip()

        from ..services.order_void_otp import ROLE_BYPASS_OTP, VoidOtpError, verifikasi_dan_gunakan_otp
        if request.user.role not in ROLE_BYPASS_OTP:
            try:
                void_request = verifikasi_dan_gunakan_otp(
                    order=order, kasir=request.user,
                    void_request_id=request.data.get('void_request_id'),
                    otp_code=request.data.get('otp_code'),
                )
            except VoidOtpError as e:
                return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)
            if not alasan:
                alasan = void_request.alasan

        from ..services.order_actions import batalkan_order, BatalkanOrderError
        try:
            order = batalkan_order(order, actor=request.user, alasan=alasan)
        except BatalkanOrderError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='retur')
    @transaction.atomic
    def retur(self, request, pk=None):
        """
        POST /api/orders/{id}/retur/
        Aksi dedicated untuk mengajukan pengembalian / retur pesanan (T-210 Tahap 3).
        Selalu membuat record PengembalianOrder BARU tiap dipanggil.
        """
        self._ensure_write_role()
        try:
            order = Order.objects.select_for_update().get(pk=pk)
        except Order.DoesNotExist:
            return Response({'error': 'Pesanan tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if order.status_global != 'selesai':
            return Response({'error': "Hanya pesanan berstatus 'Selesai' yang dapat diajukan pengembalian."}, status=status.HTTP_400_BAD_REQUEST)

        catatan = str(request.data.get('catatan') or '').strip()
        tgl_param = request.data.get('tanggal_pengembalian') or request.data.get('tanggal')
        
        if tgl_param:
            try:
                if isinstance(tgl_param, str):
                    tgl_pengembalian = datetime.datetime.strptime(tgl_param, '%Y-%m-%d').date()
                else:
                    tgl_pengembalian = tgl_param
            except ValueError:
                tgl_pengembalian = timezone.now().date()
        else:
            tgl_pengembalian = timezone.now().date()

        nominal_param = request.data.get('nominal_refund')
        if nominal_param is not None:
            try:
                nominal_refund = int(nominal_param)
            except (ValueError, TypeError):
                nominal_refund = order.total_harga or 0
        else:
            nominal_refund = order.total_harga or 0

        status_retur = request.data.get('status', 'Tunda')

        retur_obj = PengembalianOrder.objects.create(
            order=order,
            tanggal_pengembalian=tgl_pengembalian,
            status=status_retur,
            catatan=catatan,
            nominal_refund=nominal_refund,
            dibuat_oleh=request.user
        )

        if retur_obj.status == 'Dikonfirmasi':
            from ..services.order_return_inventory import restore_stock_for_confirmed_return
            restore_stock_for_confirmed_return(retur=retur_obj, actor=request.user)

        OrderActivityLog.objects.create(
            order=order,
            user=request.user,
            tindakan='RETURN',
            keterangan=f'Pengembalian pesanan diajukan (Status: {retur_obj.status}, Catatan: {retur_obj.catatan})'
        )

        # M5: sama seperti batalkan() — jangan tangkap exception, biarkan
        # @transaction.atomic rollback PengembalianOrder & activity log kalau
        # jurnal pembalik gagal terposting.
        from accounting.services.order_posting import post_order_reversal_journal
        post_order_reversal_journal(order=order, actor=request.user, description_prefix="Retur Order")

        return Response(OrderSerializer(order, context={'request': request}).data, status=status.HTTP_201_CREATED)


    @action(detail=False, methods=['post'], url_path='import-status-csv', parser_classes=[MultiPartParser])
    def import_status_csv(self, request):
        """
        POST /api/orders/import-status-csv/
        Impor status pesanan massal dari CSV (max. 500 baris) dengan validasi.
        Legenda: P = Tunda, A = Dikonfirmasi, S = Dikirim, T = Terkirim, Z = Selesai, X = Batal
        """
        upload = request.FILES.get('file')
        if not upload:
            return Response({'error': 'File CSV tidak ditemukan.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded = upload.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'File harus berupa CSV dengan encoding UTF-8.'}, status=status.HTTP_400_BAD_REQUEST)

        rows = list(csv.DictReader(io.StringIO(decoded)))
        MAX_IMPORT_ROWS = 500
        if len(rows) > MAX_IMPORT_ROWS:
            return Response(
                {'error': f'Maksimal {MAX_IMPORT_ROWS} baris per import (file ini berisi {len(rows)} baris).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not rows:
            return Response({'error': 'File CSV kosong atau tidak memiliki baris data.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mencocokkan nama header secara fleksibel (case-insensitive)
        first_row = rows[0]
        order_id_key = None
        status_key = None
        shipping_date_key = None

        for k in first_row.keys():
            k_clean = k.strip().lower()
            if k_clean in ['no. pesanan', 'no pesanan', 'order id', 'order_id', 'no', 'order_no']:
                order_id_key = k
            elif k_clean in ['status', 'status_code', 'status code', 'update_status', 'update status']:
                status_key = k
            elif k_clean in ['tanggal kirim', 'tanggal_kirim', 'shipping date', 'shipping_date']:
                shipping_date_key = k

        if not order_id_key:
            return Response(
                {'error': 'Header CSV harus memuat kolom nomor pesanan ("order_no" atau "No. Pesanan").'},
                status=status.HTTP_400_BAD_REQUEST
            )

        status_map = {
            'P': 'review',   # Tunda -> Menunggu Review
            'A': 'desain',   # Dikonfirmasi -> Proses Desain
            'S': 'proses',   # Dikirim -> Proses Produksi
            'T': 'ready',    # Terkirim -> Siap Diambil
            'Z': 'selesai',  # Selesai -> Selesai
            'X': 'batal'     # Batal -> Dibatalkan
        }

        row_errors = []
        orders_to_update = []
        seen_order_ids = set()

        for idx, row in enumerate(rows, start=2):  # Baris 1 adalah header
            order_id = (row.get(order_id_key) or '').strip()
            status_code = (row.get(status_key) or '').strip().upper() if status_key else ''
            shipping_date_str = (row.get(shipping_date_key) or '').strip() if shipping_date_key else ''

            if not order_id:
                # Lewati jika baris benar-benar kosong
                if not status_code and not shipping_date_str:
                    continue
                row_errors.append({
                    'row': idx,
                    'order_id': '-',
                    'tanggal_kirim': shipping_date_str,
                    'message': 'No. Pesanan (order_no) wajib diisi.'
                })
                continue

            if order_id in seen_order_ids:
                row_errors.append({
                    'row': idx,
                    'order_id': order_id,
                    'tanggal_kirim': shipping_date_str,
                    'message': f'No. Pesanan "{order_id}" duplikat dalam berkas CSV.'
                })
                continue
            seen_order_ids.add(order_id)

            # Jika status dan tanggal kirim dua-duanya kosong untuk order_id ini, lewati saja
            if not status_code and not shipping_date_str:
                continue

            new_status = None
            if status_code:
                if status_code not in status_map:
                    row_errors.append({
                        'row': idx,
                        'order_id': order_id,
                        'tanggal_kirim': shipping_date_str,
                        'message': f'Kode status "{status_code}" tidak valid. Gunakan P, A, S, T, Z, atau X.'
                    })
                    continue
                new_status = status_map[status_code]

            try:
                order = Order.objects.get(id=order_id)
            except Order.DoesNotExist:
                row_errors.append({
                    'row': idx,
                    'order_id': order_id,
                    'tanggal_kirim': shipping_date_str,
                    'message': f'Pesanan dengan ID "{order_id}" tidak ditemukan.'
                })
                continue

            # Kode Z/X (selesai/batal) WAJIB lewat batalkan_order()/selesaikan_order()
            # (lihat loop eksekusi di bawah) supaya stok & jurnal ikut benar — cek
            # transisi tidak valid di sini SEBELUM tulis apa pun, konsisten dengan
            # validasi baris lain di atas (satu file CSV: semua valid atau ditolak
            # semua, tidak ada commit sebagian). Pesan disamakan persis dengan
            # BatalkanOrderError/SelesaikanOrderError supaya tidak menyimpang kalau
            # salah satu diubah nanti (bug ditemukan & diperbaiki 2026-09-05 — CSV
            # ini sebelumnya menimpa status_global mentah, melewati pemulihan stok,
            # jurnal pembalik/HPP, dan validasi transisi ini sama sekali).
            if new_status == 'batal' and order.status_global in ('batal', 'selesai'):
                pesan = ('Pesanan sudah berstatus dibatalkan.' if order.status_global == 'batal'
                         else "Pesanan yang sudah selesai tidak dapat dibatalkan langsung. Gunakan alur Retur.")
                row_errors.append({'row': idx, 'order_id': order_id, 'tanggal_kirim': shipping_date_str, 'message': pesan})
                continue
            if new_status == 'selesai' and order.status_global in ('selesai', 'batal'):
                pesan = ('Pesanan sudah berstatus selesai.' if order.status_global == 'selesai'
                         else 'Pesanan yang sudah dibatalkan tidak dapat diselesaikan.')
                row_errors.append({'row': idx, 'order_id': order_id, 'tanggal_kirim': shipping_date_str, 'message': pesan})
                continue

            # Validasi format tanggal kirim jika ada
            parsed_date = None
            if shipping_date_str:
                success = False
                for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d', '%m/%d/%Y', '%m-%d-%Y'):
                    try:
                        parsed_date = datetime.datetime.strptime(shipping_date_str, fmt).date()
                        success = True
                        break
                    except ValueError:
                        continue
                if not success:
                    row_errors.append({
                        'row': idx,
                        'order_id': order_id,
                        'tanggal_kirim': shipping_date_str,
                        'message': f'Format Tanggal Kirim "{shipping_date_str}" tidak valid. Gunakan YYYY-MM-DD, DD/MM/YYYY, atau MM/DD/YYYY.'
                    })
                    continue

            orders_to_update.append((order, new_status, parsed_date, shipping_date_str))

        if row_errors:
            return Response({'errors': row_errors}, status=status.HTTP_400_BAD_REQUEST)

        # Jika hanya dry-run/validasi saja, return OK tanpa menyimpan
        if request.query_params.get('dry_run') == 'true':
            return Response({
                'success': True,
                'message': f'Semua {len(orders_to_update)} baris valid.',
                'valid_count': len(orders_to_update)
            }, status=status.HTTP_200_OK)

        # Proses pembaruan dalam satu transaksi database atomic
        from ..services.order_actions import batalkan_order, selesaikan_order
        updated_count = 0
        with transaction.atomic():
            for order, new_status, parsed_date, orig_date_str in orders_to_update:
                row_changed = False

                if new_status and order.status_global != new_status:
                    # Z/X WAJIB lewat service resmi (pemulihan stok FIFO + jurnal
                    # pembalik/HPP) — bukan menimpa status_global mentah seperti
                    # sebelumnya. Guard transisi tidak valid sudah dicek di loop
                    # validasi di atas, jadi di sini tidak akan pernah melempar,
                    # tapi service tetap idempoten-aman (select_for_update) kalau
                    # status berubah di antara kedua loop.
                    if new_status == 'batal':
                        order = batalkan_order(order, actor=request.user, alasan='Diimpor lewat Perbarui Status (CSV).')
                    elif new_status == 'selesai':
                        order = selesaikan_order(order, actor=request.user)
                    else:
                        order._current_user = request.user
                        order.status_global = new_status
                        order.save()
                        OrderActivityLog.objects.create(
                            order=order, user=request.user, tindakan="UPDATE_STATUS",
                            keterangan=f"Status diperbarui menjadi '{new_status}' via impor CSV.",
                        )
                    row_changed = True

                if orig_date_str:
                    OrderActivityLog.objects.create(
                        order=order, user=request.user, tindakan="UPDATE_STATUS",
                        keterangan=f"Tanggal Kirim: {orig_date_str} (via impor CSV).",
                    )
                    row_changed = True

                if row_changed:
                    updated_count += 1

        return Response({
            'success': True,
            'message': f'Berhasil memperbarui status {updated_count} pesanan.',
            'updated_count': updated_count
        }, status=status.HTTP_200_OK)



class AssignOrderView(APIView):
    """POST /api/orders/{order_id}/assign/ — publish/assign SPK ke semua item dalam order.

    Kasir ikut diizinkan karena menerbitkan SPK adalah bagian dari alur Buat
    Order di terminal kasir, tetapi hanya ke antrean divisi. Penunjukan staff
    tertentu ditolak di spk.resolve_staff().
    """
    permission_classes = [IsOwnerManagerAdminOrKasir]

    def post(self, request, order_id):
        staff_id = request.data.get('staff_id')  # ditolak bila pemohon kasir
        tahap_id = request.data.get('tahap_id', None)
        divisi_id = request.data.get('divisi_id', None)
        status_global = request.data.get('status_global', None)
        try:
            biaya_desain = int(request.data.get('biaya_desain', 0) or 0)
        except (ValueError, TypeError):
            biaya_desain = 0
        try:
            insentif = int(request.data.get('insentif', 0) or 0)
        except (ValueError, TypeError):
            insentif = 0

        order_item_id = request.data.get('order_item_id', None)

        # Validasi order ada
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            return Response({'error': 'Order tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        # Resolusi staff/tahap dipusatkan di api/spk.py — dipakai bersama
        # dengan penerbitan SPK dari terminal POS agar aturannya tidak bercabang.
        try:
            staff = spk.resolve_staff(staff_id, pemohon=request.user)
            deadline = spk.resolve_deadline(request.data.get('deadline'))
            tahap = spk.resolve_tahap(tahap_id=tahap_id, divisi_id=divisi_id, staff=staff)
        except spk.SpkError as exc:
            return Response({'error': exc.pesan}, status=exc.status_code)

        # Buat atau update JobBoard untuk setiap OrderItem
        items = order.items.all()
        if order_item_id:
            items = items.filter(pk=order_item_id)

        if not items.exists():
            return Response({'error': 'Order ini belum memiliki item produk atau item tidak cocok.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            created_jobs = spk.terbitkan(
                items, field='order_item', tahap=tahap, staff=staff,
                biaya_desain=biaya_desain, insentif=insentif, deadline=deadline,
            )
        except spk.SpkError as exc:
            return Response({'error': exc.pesan}, status=exc.status_code)

        target_name = spk.nama_target(staff, tahap)
        tahap_desc = tahap.nama if tahap else "Tahap Awal"
        action_desc = "TUGASKAN_STAFF" if staff else "TERBITKAN_SPK"
        for item in items:
            OrderActivityLog.objects.create(
                order=order,
                user=request.user,
                tindakan=action_desc,
                keterangan=f"Menerbitkan SPK item '{item.jenis_produk}' ke {target_name} untuk tahap '{tahap_desc}'"
            )

        # Update status order
        if status_global:
            order.status_global = status_global
        else:
            # Fallback cerdas berdasarkan divisi staff/tahap
            is_desain = False
            if tahap and tahap.divisi and tahap.divisi.nama.lower() == 'desain':
                is_desain = True
            elif staff and staff.divisi and staff.divisi.nama.lower() == 'desain':
                is_desain = True
                
            if is_desain:
                order.status_global = 'desain'
            else:
                order.status_global = 'proses'
        
        order._current_user = request.user
        order.save()

        return Response({
            'message': f'Order {order_id} berhasil di-publish/assign ke {target_name}.',
            'jobs': created_jobs,
        }, status=status.HTTP_200_OK)


class OrderItemViewSet(viewsets.ModelViewSet):
    queryset = OrderItem.objects.select_related(
        'order'
    ).order_by('-id')
    serializer_class = OrderItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in ('owner', 'manager', 'admin', 'kasir'):
            return qs
        return qs.filter(order__items__jobs__pic_staff=user).distinct()

    def _ensure_write_role(self, order=None):
        role = self.request.user.role
        if role in ('owner', 'manager', 'admin', 'kasir'):
            return
        # Staff dikecualikan HANYA untuk mengisi item pesanan miliknya
        # sendiri lewat fitur "Buat Order" (sumber='staff'), selama order
        # itu masih 'review' -- begitu kasir mulai memverifikasi/mengubah
        # statusnya, staff tidak boleh lagi ikut mengubah item (mencegah
        # race condition dengan verifikasi harga kasir). Order lain (WA/POS/
        # manual/order staff lain) tetap tertutup total untuk staff.
        if (
            role == 'staff' and order is not None
            and order.sumber == 'staff'
            and order.dilayani_oleh_id == self.request.user.id
            and order.status_global == 'review'
        ):
            return
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Anda tidak boleh mengubah item order.')

    def _ensure_order_editable(self, order):
        """Item pesanan yang statusnya sudah 'selesai'/'batal' terkunci —
        sebelumnya endpoint ini tidak menjaga sama sekali, jadi harga/qty
        item pada pesanan yang SUDAH LUNAS & DITUTUP tetap bisa diubah lewat
        API langsung. total_harga/sisa_tagihan Order dihitung ulang otomatis
        di OrderItem.save() TANPA mengecek status sama sekali — dibuktikan
        pesanan 'selesai' dengan sisa_tagihan Rp0 bisa mendadak punya
        "utang" lagi cuma dengan mengubah harga satu item (bug ditemukan &
        diperbaiki 2026-09-05, audit Transaksi & Pembayaran). Pesanan
        'selesai' yang perlu dikoreksi WAJIB lewat alur Retur, bukan edit
        item langsung.
        """
        if order.status_global == 'selesai':
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': "Pesanan sudah 'Selesai' — item tidak dapat diubah. Gunakan alur Retur untuk koreksi."})
        if order.status_global == 'batal':
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'error': "Pesanan sudah 'Batal' — item tidak dapat diubah."})

    def _terapkan_diskon_penjualan_otomatis(self, order):
        """Evaluasi ulang Diskon Penjualan otomatis untuk `order`, HANYA bila
        kasir eksplisit memilih metode 'otomatis' (lihat Order.metode_diskon).

        Dipanggil setiap kali item berubah (tambah/ubah/hapus) karena order
        dibuat TANPA item lebih dulu (lihat OrderViewSet.perform_create) —
        subtotal hanya diketahui setelah item-item ini masuk.

        Sebelumnya fungsi ini membandingkan otomatis dengan kupon manual dan
        memilih yang lebih besar (silent best-of). Sekarang eksklusivitas
        Kupon vs Diskon Penjualan ditentukan oleh PILIHAN EKSPLISIT kasir di
        selector diskon frontend — kalau metode_diskon bukan 'otomatis',
        fungsi ini tidak melakukan apa-apa (kupon, jika dipilih, sudah
        diproses terpisah di OrderViewSet.perform_create).
        """
        if order.metode_diskon != 'otomatis':
            return

        from decimal import Decimal
        from ..promo_engine import BarisKeranjang, KonteksPromo, evaluate_sales_discount
        from ..marketing_models import KANAL_POS
        from ..models import Contact

        try:
            items_qs = list(order.items.all())
            subtotal_now = sum(it.harga_jual for it in items_qs)
            baris = [
                BarisKeranjang(
                    product=it.product, qty=Decimal(str(it.qty or 1)),
                    harga=(Decimal(str(it.harga_jual)) / Decimal(str(it.qty)) if it.qty else Decimal(str(it.harga_jual))),
                    subtotal=Decimal(str(it.harga_jual)),
                )
                for it in items_qs
            ]
            konteks = KonteksPromo(
                baris=baris, subtotal=Decimal(str(subtotal_now)),
                pelanggan=Contact.objects.filter(nomor_wa=order.nomor_wa).first(), kanal=KANAL_POS,
            )
            nilai_otomatis, _aturan = evaluate_sales_discount(konteks)
            nilai_otomatis = int(nilai_otomatis)
            if order.diskon_otomatis != nilai_otomatis:
                order.diskon_otomatis = nilai_otomatis
                order.save()  # full save (bukan update_fields) — recompute total_harga ikut tersimpan
        except Exception:
            # Jangan menyimpan item dengan diskon lama ketika evaluasi promo
            # gagal. Pemanggil dibungkus atomic agar perubahan item ikut
            # di-rollback dan kasir mendapat error yang dapat ditindaklanjuti.
            logger.exception("Failed evaluating sales discount for order %s", order.pk)
            raise

    @transaction.atomic
    def perform_create(self, serializer):
        target_order = serializer.validated_data.get('order')
        self._ensure_write_role(target_order)
        if target_order is not None:
            self._ensure_order_editable(target_order)
        instance = serializer.save(_current_user=self.request.user)
        self._terapkan_diskon_penjualan_otomatis(instance.order)

    @transaction.atomic
    def perform_update(self, serializer):
        self._ensure_write_role(serializer.instance.order)
        self._ensure_order_editable(serializer.instance.order)
        serializer.instance._current_user = self.request.user
        instance = serializer.save()
        self._terapkan_diskon_penjualan_otomatis(instance.order)

    @transaction.atomic
    def perform_destroy(self, instance):
        self._ensure_write_role(instance.order)
        self._ensure_order_editable(instance.order)
        instance._current_user = self.request.user
        order = instance.order
        instance.delete()
        self._terapkan_diskon_penjualan_otomatis(order)


class ForwardJobView(APIView):
    """
    POST /api/jobs/{job_id}/forward/
    Body:
      aksi        : 'forward' | 'selesai'
      tahap_id    : (wajib jika aksi='forward') ID TahapProses tujuan
      pic_staff_id: (opsional) ID staff untuk tahap baru
    """
    permission_classes = [IsAuthenticated, IsClockedIn]

    def post(self, request, job_id):
        # Ambil job
        try:
            job = JobBoard.objects.get(pk=job_id)
        except JobBoard.DoesNotExist:
            return Response({'error': 'Job tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        # Staff hanya bisa forward job miliknya
        if request.user.role == 'staff' and job.pic_staff != request.user:
            return Response({'error': 'Anda tidak memiliki akses ke job ini.'}, status=status.HTTP_403_FORBIDDEN)

        aksi         = request.data.get('aksi')          # 'forward' atau 'selesai'
        tahap_id     = request.data.get('tahap_id')
        pic_staff_id = request.data.get('pic_staff_id')

        if aksi not in ('forward', 'selesai'):
            return Response(
                {'error': 'Aksi tidak valid. Gunakan "forward" atau "selesai".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Guard: jangan proses job yang sudah selesai/gagal (mencegah duplikasi)
        if job.status_pekerjaan in ('selesai', 'gagal'):
            return Response(
                {'error': f'Job sudah berstatus "{job.status_pekerjaan}", tidak bisa diforward ulang.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validasi tahap_id dan ambil tahap_baru SEBELUM transaction.atomic()
        tahap_baru = None
        if aksi == 'forward':
            if not tahap_id:
                return Response(
                    {'error': 'tahap_id wajib diisi jika aksi=forward.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Ambil tahap tujuan
            try:
                tahap_baru = TahapProses.objects.get(pk=tahap_id)
            except TahapProses.DoesNotExist:
                return Response({'error': 'Tahap tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        # SPK dapat berasal dari OrderItem atau POSSaleItem. Penerusan harus
        # mempertahankan sumber yang sama agar job POS tidak crash/kehilangan
        # relasi ketika dikirim ke tahap atau divisi berikutnya.
        if job.order_item_id:
            source_field = 'order_item'
            source_object = job.order_item
        elif job.pos_sale_item_id:
            source_field = 'pos_sale_item'
            source_object = job.pos_sale_item
        else:
            return Response({'error': 'Sumber SPK tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Tandai job saat ini sebagai SELESAI
            job.status_pekerjaan = 'selesai'
            job.waktu_selesai    = timezone.now()
            job.otp_code         = ''
            job.otp_requested    = False
            job.otp_sent         = False
            job.save()

            # Potong bahan otomatis ke inventori
            deduct_job_materials_if_needed(job, request.user)

            if aksi == 'forward':
                # Siapkan catatan dari divisi sebelumnya
                catatan_sebelumnya = job.catatan_staff if isinstance(job.catatan_staff, list) else []
                if catatan_sebelumnya or job.gdrive_output_link:
                    separator = {
                        "keterangan": f"--- Dari Divisi: {job.tahap.nama if job.tahap else 'Sebelumnya'} ---",
                        "qty": "-",
                        "satuan": "-",
                        "catatan": f"Oleh: {job.pic_staff.username if job.pic_staff else 'Staff'}",
                        "gdrive_link": job.gdrive_output_link or ""  # ← link file dari divisi sebelumnya
                    }
                    catatan_sebelumnya = catatan_sebelumnya + [separator]

                # Cek apakah sudah ada job untuk tahap ini di order item yang sama
                existing = JobBoard.objects.filter(
                    **{source_field: source_object, 'tahap': tahap_baru}
                ).first()

                if existing:
                    # Reset job yang sudah ada ke antrean
                    existing.status_pekerjaan = 'antrean'
                    existing.waktu_mulai      = None
                    existing.waktu_selesai    = None
                    
                    # Gabung catatan lama dengan catatan dari divisi sebelumnya
                    existing_cat = existing.catatan_staff if isinstance(existing.catatan_staff, list) else []
                    existing.catatan_staff = existing_cat + catatan_sebelumnya
                    
                    if pic_staff_id:
                        try:
                            existing.pic_staff = CustomUser.objects.get(pk=pic_staff_id, role='staff')
                        except CustomUser.DoesNotExist:
                            pass
                    existing.save()
                    new_job_id = existing.id
                else:
                    # Buat job baru
                    new_job = JobBoard(
                        **{source_field: source_object},
                        tahap           = tahap_baru,
                        status_pekerjaan = 'antrean',
                        catatan_staff   = catatan_sebelumnya
                    )
                    if pic_staff_id:
                        try:
                            new_job.pic_staff = CustomUser.objects.get(pk=pic_staff_id, role='staff')
                        except CustomUser.DoesNotExist:
                            pass
                    new_job.save()
                    new_job_id = new_job.id

                return Response({
                    'message': f'Job diteruskan ke tahap "{tahap_baru.nama}" (Divisi: {tahap_baru.divisi.nama}).',
                    'new_job_id': new_job_id,
                }, status=status.HTTP_201_CREATED)

            elif aksi == 'selesai':
                # Cek apakah seluruh job dari semua item dalam pesanan ini sudah selesai
                if job.order_item_id:
                    order = job.order_item.order
                    active_jobs_exist = JobBoard.objects.filter(
                        order_item__order=order,
                        status_pekerjaan__in=['antrean', 'dikerjakan', 'kendala']
                    ).exists()

                    if not active_jobs_exist:
                        order.status_global = 'ready'
                        order.save()

                    return Response(
                        {'message': 'Job ditandai selesai. Tidak ada tahap lanjutan.' + (' Order secara global telah siap diambil (READY).' if not active_jobs_exist else '')},
                        status=status.HTTP_200_OK
                    )

                return Response(
                    {'message': 'Job POS ditandai selesai. Tidak ada tahap lanjutan.'},
                    status=status.HTTP_200_OK
                )


class PengembalianOrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet resmi untuk mencatat dan memperbarui status Pengembalian / Return Order (T-208 Revisi 2).
    HANYA mendukung GET (list/detail) dan PATCH/PUT (update).
    Pembuatan retur baru dilakukan murni melalui POST /api/orders/{id}/retur/ (T-210).
    """
    queryset = PengembalianOrder.objects.all().select_related('order', 'dibuat_oleh').order_by('-dibuat_pada')
    serializer_class = PengembalianOrderSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'put', 'head', 'options']

    def _ensure_write_role(self):
        user = getattr(self.request, 'user', None)
        if not user or not hasattr(user, 'role'):
            return
        allowed_roles = {'owner', 'manager', 'admin', 'kasir'}
        if user.role not in allowed_roles:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Role Anda tidak diizinkan mengubah status pengembalian.')

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        status_param = self.request.query_params.get('status')
        order_id = self.request.query_params.get('order') or self.request.query_params.get('order_id')
        if status_param:
            queryset = queryset.filter(status=status_param)
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        return queryset

    @transaction.atomic
    def perform_update(self, serializer):
        self._ensure_write_role()
        instance = serializer.instance
        if instance.status in ('Dikonfirmasi', 'Batal'):
            # Data terkunci setelah Dikonfirmasi/Batal. Satu-satunya perubahan
            # yang tetap diizinkan: toggle "Batal Post" (Dikonfirmasi -> Tunda)
            # dari daftar Return Penjualan — bukan edit tanggal/catatan/dsb.
            payload_fields = set(self.request.data.keys())
            is_unconfirm_toggle = (
                instance.status == 'Dikonfirmasi'
                and payload_fields == {'status'}
                and serializer.validated_data.get('status') == 'Tunda'
            )
            if not is_unconfirm_toggle:
                from rest_framework.exceptions import ValidationError
                raise ValidationError('Return yang sudah Dikonfirmasi/Batal terkunci dan tidak dapat diubah.')
        old_status = instance.status
        target_status = serializer.validated_data.get('status', old_status)
        if old_status == 'Dikonfirmasi' and target_status == 'Tunda':
            from ..services.order_return_inventory import reverse_stock_for_unconfirmed_return
            reverse_stock_for_unconfirmed_return(retur=instance, actor=self.request.user)

        updated = serializer.save()
        if old_status != 'Dikonfirmasi' and target_status == 'Dikonfirmasi':
            from ..services.order_return_inventory import restore_stock_for_confirmed_return
            restore_stock_for_confirmed_return(retur=updated, actor=self.request.user)

