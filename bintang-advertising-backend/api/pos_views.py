import random
import re
from django.db import transaction
from django.core.cache import cache
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Q
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
from .pos_models import POSSale, POSSaleItem
from .pos_serializers import POSSaleSerializer
from .models import SaldoKasHarian, Contact, OrderPayment
from .product_models import Product, ProductVariant, ProductStockMovement
from . import stock_fifo
from . import uom
from . import pos_settings
from . import spk
from .permissions import IsOwnerManagerAdminOrKasir
from .throttles import PasskeyRateThrottle
from .pos_services import create_sale, void_sale
from .services.pos_receipt_whatsapp import (
    format_waktu_dokumen, hitung_total_diskon_resi, kirim_resi_pos_whatsapp,
)

class POSSaleViewSet(viewsets.ModelViewSet):
    queryset = POSSale.objects.all().order_by('-created_at')
    serializer_class = POSSaleSerializer
    permission_classes = [IsOwnerManagerAdminOrKasir]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        # Allow filtering by shift or kasir or status
        qs = super().get_queryset()
        shift_id = self.request.query_params.get('shift')
        kasir_id = self.request.query_params.get('kasir')
        status_val = self.request.query_params.get('status')
        date_from = parse_date(self.request.query_params.get('date_from') or '')
        date_to = parse_date(self.request.query_params.get('date_to') or '')
        search = (self.request.query_params.get('search') or '').strip()

        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        if kasir_id:
            qs = qs.filter(kasir_id=kasir_id)
        if status_val:
            qs = qs.filter(status=status_val)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if search:
            qs = qs.filter(Q(nomor__icontains=search) | Q(catatan__icontains=search))

        # Pembatasan visibilitas dari Pengaturan POS. Diterapkan di server agar
        # tidak bisa dilewati; pemilik/manajer tetap melihat semuanya.
        user = self.request.user
        is_atasan = getattr(user, 'role', '') in ('owner', 'manager') or user.is_superuser
        if not is_atasan:
            if pos_settings.staf_hanya_transaksi_hari_ini():
                qs = qs.filter(created_at__date=timezone.localdate())
            if pos_settings.sembunyikan_transaksi_perangkat_lain():
                qs = qs.filter(kasir=user)
        return qs

    @action(detail=False, methods=['post'], url_path='verify-passkey', throttle_classes=[PasskeyRateThrottle])
    def verify_passkey(self, request):
        """Verifikasi PIN PassKey untuk tindakan sensitif di POS.

        Body: {"aksi": "diskon|pelanggan|belum_bayar|sudah_bayar", "pin": "1234"}
        PIN dicocokkan di server supaya tidak bisa dibaca/dilewati dari browser.
        """
        aksi = request.data.get('aksi')
        if aksi not in pos_settings.PASSKEY_AKSI:
            return Response({'error': 'Aksi PassKey tidak dikenal.'}, status=status.HTTP_400_BAD_REQUEST)
        if not pos_settings.passkey_aktif(aksi):
            return Response({'ok': True, 'aktif': False})
        if pos_settings.passkey_cocok(aksi, request.data.get('pin')):
            return Response({'ok': True, 'aktif': True})
        return Response({'ok': False, 'aktif': True, 'error': 'PIN salah.'},
                        status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['get'], url_path='pos-rules')
    def pos_rules(self, request):
        """Ringkasan aturan POS yang sedang aktif — dipakai UI kasir agar
        tampilannya selaras dengan yang ditegakkan server."""
        return Response({
            'blokir_stok_kosong': pos_settings.blokir_jual_jika_stok_kosong(),
            'blokir_harga_dibawah_beli': pos_settings.blokir_harga_dibawah_harga_beli(),
            'blokir_tahan_pesanan': pos_settings.blokir_tahan_pesanan(),
            'wajib_shift_aktif': pos_settings.wajib_shift_aktif(),
            'sembunyikan_stok': pos_settings.ext('hide_remaining_stock'),
            'sembunyikan_daftar_pelanggan': pos_settings.ext('hide_customer_list'),
            'disable_add_custom_item': pos_settings.ext('disable_add_custom_item'),
            'hide_splitbill': pos_settings.ext('hide_splitbill'),
            'blokir_cetak_ulang': pos_settings.ext('disable_reprint'),
            'blokir_cetak_pengecekan': pos_settings.ext('disable_print_checking'),
            'passkey': {
                aksi: pos_settings.passkey_aktif(aksi)
                for aksi in pos_settings.PASSKEY_AKSI
            },
        })

    @action(detail=False, methods=['get'], url_path='staff-list')
    def staff_list(self, request):
        """GET /api/pos/sales/staff-list/

        Daftar ringkas karyawan aktif (id + nama) untuk pilihan "Dilayani oleh"
        di POS. Sengaja endpoint tersendiri karena /users/ tertutup untuk kasir,
        padahal di Bintang semua karyawan bisa melayani pelanggan.
        """
        from django.contrib.auth import get_user_model
        users = get_user_model().objects.filter(is_active=True).order_by('first_name', 'username')
        data = [{
            'id': u.id,
            'nama': (f"{u.first_name} {u.last_name}".strip() or u.username),
            'role': getattr(u, 'role', ''),
        } for u in users]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='rekap-harian')
    def rekap_harian(self, request):
        """GET /api/pos/sales/rekap-harian/?tanggal=YYYY-MM-DD[&kasir=<id>][&shift=<id>]

        Rekap kas harian untuk tab Pemasukan/Pengeluaran di kasir. Menggabungkan:
        - Pemasukan: penjualan POS lunas (per metode bayar) + DP/pelunasan Order
          yang dicatat kasir (OrderPayment) + Pendapatan lain
          (CashTransaction arah='pendapatan').
        - Pengeluaran: CashTransaction arah='pengeluaran' (per tipe transaksi).

        OrderPayment WAJIB ikut dihitung di sini — endpoint ini adalah sumber
        angka "Total Diharapkan" yang tampil live di layar Shift (PosShift.jsx)
        maupun Ringkasan Shift v2, dan HARUS sinkron dengan
        calculate_shift_cash_summary() yang dipakai saat shift ditutup
        (SaldoKasHarianViewSet.close()) — kalau tidak, kasir akan melihat
        selisih tak terduga saat tutup shift walau uang di laci sudah benar.

        Aman UOM & FIFO: modal dihitung dari qty SATUAN DASAR (POSSaleItem.qty)
        dikali harga_beli per satuan dasar — tidak menyentuh qty/harga UOM
        terpilih maupun lapisan FIFO, sehingga tidak pernah error walau item
        memakai konversi satuan atau stok berlapis.
        """
        from django.utils.dateparse import parse_date
        from .finance_models import CashTransaction

        tgl = parse_date(request.query_params.get('tanggal') or '') or timezone.localdate()
        kasir_id = request.query_params.get('kasir')
        shift_id = request.query_params.get('shift')

        # --- Pemasukan dari penjualan POS ---
        sales = POSSale.objects.filter(status='paid').prefetch_related('items__product')
        if shift_id:
            # Layar Shift harus menampilkan transaksi dari shift aktif saja.
            # Filter tanggal akan mencampurkan transaksi shift sebelumnya bila
            # kasir membuka shift baru pada hari yang sama.
            sales = sales.filter(shift_id=shift_id)
        else:
            sales = sales.filter(created_at__date=tgl)
        if kasir_id:
            sales = sales.filter(kasir_id=kasir_id)

        total_penjualan = Decimal('0')
        total_modal = Decimal('0')
        jumlah_transaksi = 0
        per_metode = {}
        for s in sales:
            total = s.total or Decimal('0')
            total_penjualan += total
            jumlah_transaksi += 1
            metode = s.metode_bayar or 'Cash'
            per_metode[metode] = per_metode.get(metode, Decimal('0')) + total
            for it in s.items.all():
                if it.product:
                    total_modal += (it.product.harga_beli or Decimal('0')) * (it.qty or Decimal('0'))

        # --- Pemasukan dari DP/pelunasan Order (uang fisik di laci juga) ---
        order_payments = OrderPayment.objects.all()
        if shift_id:
            order_payments = order_payments.filter(shift_id=shift_id)
        else:
            order_payments = order_payments.filter(dibuat_pada__date=tgl)
        if kasir_id:
            order_payments = order_payments.filter(dibuat_oleh_id=kasir_id)

        for p in order_payments:
            jumlah = Decimal(str(p.jumlah or 0))
            total_penjualan += jumlah
            jumlah_transaksi += 1
            metode = p.metode_pembayaran or 'tunai'
            per_metode[metode] = per_metode.get(metode, Decimal('0')) + jumlah

        # --- Pendapatan/Pengeluaran lain (CashTransaction) ---
        ct = CashTransaction.objects.select_related('tipe_transaksi', 'staff')
        if shift_id:
            ct = ct.filter(shift_id=shift_id)
        else:
            ct = ct.filter(waktu__date=tgl)
        if kasir_id:
            ct = ct.filter(staff_id=kasir_id)

        pendapatan_lain, pengeluaran = [], []
        total_pendapatan_lain = Decimal('0')
        total_pengeluaran = Decimal('0')
        for t in ct:
            entri = {
                'id': t.id,
                'nomor': t.nomor,
                'tipe': t.tipe_transaksi.nama if t.tipe_transaksi else 'Lainnya',
                'jumlah': t.jumlah,
                'catatan': t.catatan,
                'staff': t.staff.username if t.staff else '',
                'waktu': t.waktu,
            }
            if t.arah == 'pendapatan':
                pendapatan_lain.append(entri)
                total_pendapatan_lain += t.jumlah or Decimal('0')
            else:
                pengeluaran.append(entri)
                total_pengeluaran += t.jumlah or Decimal('0')

        total_pemasukan = total_penjualan + total_pendapatan_lain
        laba_kotor = total_penjualan - total_modal
        arus_kas_bersih = total_pemasukan - total_pengeluaran

        return Response({
            'tanggal': tgl.isoformat(),
            'ringkasan': {
                'total_pemasukan': total_pemasukan,
                'total_pengeluaran': total_pengeluaran,
                'total_penjualan': total_penjualan,
                'total_modal': total_modal,
                'laba_kotor': laba_kotor,
                'arus_kas_bersih': arus_kas_bersih,
                'jumlah_transaksi': jumlah_transaksi,
            },
            'penjualan_per_metode': [
                {'metode': k, 'jumlah': v} for k, v in sorted(per_metode.items())
            ],
            'pendapatan_lain': pendapatan_lain,
            'pengeluaran': pengeluaran,
        })

    def _validasi_aturan_pos(self, items, status_val):
        """Terapkan setelan Pengaturan POS sebelum transaksi dibuat.

        Divalidasi di depan (bukan sambil memotong stok) supaya tidak ada
        transaksi setengah jadi saat salah satu item melanggar aturan.
        Mengembalikan pesan error, atau None bila lolos.
        """
        cek_stok = pos_settings.blokir_jual_jika_stok_kosong()
        cek_harga = pos_settings.blokir_harga_dibawah_harga_beli()
        cek_kustom = pos_settings.ext('disable_add_custom_item')
        # Ketiganya harus ikut dalam guard ini. Kalau tidak, aturan item kustom
        # ikut terlewat begitu cek stok & harga sama-sama nonaktif.
        if not (cek_stok or cek_harga or cek_kustom):
            return None

        # Akumulasi qty per produk/varian: 2 baris produk sama harus dijumlahkan
        # dulu, kalau tidak masing-masing lolos padahal totalnya melebihi stok.
        butuh = {}
        for item in items:
            product_id = item.get('product_id')
            if not product_id:
                # Item kustom (non-katalog): tidak punya stok/harga beli untuk
                # divalidasi, jadi hanya aturan boleh-tidaknya yang diperiksa.
                if cek_kustom:
                    return "Penambahan item kustom (non-katalog) dinonaktifkan di Pengaturan POS."
                continue

            product = Product.objects.filter(id=product_id).first()
            if not product:
                return f"Produk dengan id {product_id} tidak ditemukan."
            variant = None
            if item.get('variant_id'):
                variant = ProductVariant.objects.filter(id=item.get('variant_id')).first()

            u = uom.resolve(product, item.get('uom_kode'), item.get('qty', 1),
                            item.get('harga', 0), variant)
            qty_dasar = Decimal(str(u['qty_dasar']))
            harga_dasar = u['harga_dasar']
            if harga_dasar is None:
                harga_dasar = Decimal(str(item.get('harga', 0) or 0))

            if cek_harga and harga_dasar < Decimal(str(product.harga_beli or 0)):
                return (f"'{product.nama}' tidak boleh dijual di bawah harga beli "
                        f"(harga beli Rp {product.harga_beli:,.0f}). "
                        f"Aturan ini aktif di Pengaturan POS.")

            if cek_stok and status_val == 'paid' and product.lacak_inventori:
                kunci = (product.id, variant.id if variant else None)
                b = butuh.setdefault(kunci, {'qty': Decimal('0'), 'produk': product, 'varian': variant})
                b['qty'] += qty_dasar

        if cek_stok and status_val == 'paid':
            for b in butuh.values():
                tersedia = Decimal(str((b['varian'] or b['produk']).qty_stok or 0))
                if b['qty'] > tersedia:
                    nama = b['produk'].nama + (f" ({b['varian'].nama_varian})" if b['varian'] else '')
                    return (f"Stok '{nama}' tidak mencukupi: tersedia {tersedia:g}, "
                            f"dibutuhkan {b['qty']:g}.")
        return None

    def create(self, request, *args, **kwargs):
        sale = create_sale(user=request.user, data=request.data)
        return Response(self.get_serializer(sale).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], permission_classes=[IsOwnerManagerAdminOrKasir])
    @transaction.atomic
    def void(self, request, pk=None):
        """
        POST /api/pos/sales/{id}/void/
        Owner/manager/admin bisa langsung void. Kasir (2026-08-14, sama
        seperti Order — lihat OrderViewSet.batalkan) wajib menyertakan
        `void_request_id` + `otp_code` dari permintaan yang sudah disetujui
        owner lewat /minta-otp-void/.
        """
        from .services.pos_void_otp import ROLE_BYPASS_OTP, PosVoidOtpError, verifikasi_dan_gunakan_otp
        if request.user.role not in ROLE_BYPASS_OTP:
            sale_obj = self.get_object()
            try:
                verifikasi_dan_gunakan_otp(
                    sale=sale_obj, kasir=request.user,
                    void_request_id=request.data.get('void_request_id'),
                    otp_code=request.data.get('otp_code'),
                )
            except PosVoidOtpError as e:
                return Response({'error': str(e)}, status=status.HTTP_403_FORBIDDEN)

        sale = void_sale(sale_id=pk, user=request.user)
        return Response(self.get_serializer(sale).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='minta-otp-void')
    def minta_otp_void(self, request, pk=None):
        """
        POST /api/pos/sales/{id}/minta-otp-void/
        Kasir mengajukan permintaan void transaksi POS Lunas — perlu
        persetujuan OTP owner (lihat api/services/pos_void_otp.py) sebelum
        /void/ bisa dipanggil. Owner/manager/admin tidak perlu endpoint
        ini, mereka bisa langsung /void/.
        """
        sale = self.get_object()
        alasan = str(request.data.get('alasan') or '').strip()

        from .services.pos_void_otp import ajukan_permintaan_void, PosVoidOtpError
        try:
            void_request = ajukan_permintaan_void(sale=sale, kasir=request.user, alasan=alasan)
        except PosVoidOtpError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        from .pos_serializers import POSVoidRequestSerializer
        return Response(
            POSVoidRequestSerializer(void_request, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'])
    def produksi(self, request):
        """Transaksi POS Lunas yang punya SPK produksi (job dari pos_sale_item),
        belum ditandai diambil pelanggan — padanan `/orders/?status_global=`
        utk panel "Pesanan & Pelunasan" (SiapDiambilPanel.jsx). Status
        'ready'/'proses' dihitung langsung dari status job saat request
        (tidak disimpan), karena logic auto-ready di views/jobs.py sengaja
        cuma menangani job asal order_item (bug ditemukan 2026-08-13 — job
        POS sebelumnya tidak pernah punya representasi status siap-diambil
        sama sekali).
        """
        status_produksi = request.query_params.get('status_produksi')
        sales = (
            self.get_queryset()
            .filter(status='paid', diambil_pada__isnull=True, items__jobs__isnull=False)
            .prefetch_related('items__jobs__tahap__divisi', 'items__jobs__pic_staff')
            .distinct()
        )
        hasil = []
        for sale in sales:
            jobs = [job for item in sale.items.all() for job in item.jobs.all()]
            if not jobs:
                continue
            aktif = any(j.status_pekerjaan in ('antrean', 'dikerjakan', 'kendala') for j in jobs)
            computed_status = 'proses' if aktif else 'ready'
            if status_produksi and computed_status != status_produksi:
                continue
            data = self.get_serializer(sale).data
            data['status_produksi'] = computed_status
            hasil.append(data)
        return Response(hasil)

    @action(detail=True, methods=['post'])
    def selesaikan(self, request, pk=None):
        """Tandai transaksi POS (dengan SPK) sudah diambil pelanggan —
        padanan Order `/orders/{id}/selesaikan/`."""
        sale = self.get_object()
        if sale.diambil_pada:
            return Response({'error': 'Pesanan ini sudah ditandai diambil sebelumnya.'}, status=status.HTTP_400_BAD_REQUEST)
        jobs = [job for item in sale.items.all() for job in item.jobs.all()]
        if not jobs:
            return Response({'error': 'Transaksi ini tidak punya SPK produksi.'}, status=status.HTTP_400_BAD_REQUEST)
        if any(j.status_pekerjaan in ('antrean', 'dikerjakan', 'kendala') for j in jobs):
            return Response({'error': 'Masih ada job produksi yang belum selesai.'}, status=status.HTTP_400_BAD_REQUEST)
        sale.diambil_pada = timezone.now()
        sale.save(update_fields=['diambil_pada'])
        return Response(self.get_serializer(sale).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='email-resi',
            permission_classes=[IsOwnerManagerAdminOrKasir])
    def email_resi(self, request, pk=None):
        """POST /api/pos/sales/{id}/email-resi/ {"email": "..."}

        Pakai SMTP yang sama dengan fitur keamanan (OTP login/reset password
        di users/views.py, django.core.mail.send_mail) — bukan integrasi
        baru. Alamat tujuan diambil dari input kasir langsung (bukan
        Contact.email — model Contact tidak punya field itu sama sekali,
        hanya Customer yang tertaut opsional yang punya).
        """
        from django.core.mail import send_mail
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError

        sale = self.get_object()
        email = str(request.data.get('email') or '').strip()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'error': 'Alamat email tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)

        subject = f"Resi Transaksi {sale.nomor}"
        baris_item = '\n'.join(
            f"- {it.nama_snapshot} x{it.qty} = Rp {it.subtotal:,.0f}"
            for it in sale.items.all()
        )
        message = (
            f"Terima kasih telah berbelanja.\n\n"
            f"Nomor: {sale.nomor}\n"
            f"Tanggal: {format_waktu_dokumen(sale.created_at)}\n\n"
            f"{baris_item}\n\n"
            f"Subtotal: Rp {sale.subtotal:,.0f}\n"
            f"Diskon: Rp {hitung_total_diskon_resi(sale):,.0f}\n"
            f"Pajak: Rp {sale.pajak:,.0f}\n"
            f"Total: Rp {sale.total:,.0f}\n"
            f"Metode Bayar: {sale.metode_bayar}\n"
            f"Dibayar: Rp {sale.dibayar:,.0f}\n"
            f"Kembalian: Rp {sale.kembalian:,.0f}\n"
        )
        try:
            send_mail(subject, message, None, [email], fail_silently=False)
        except Exception:
            return Response(
                {'error': 'Layanan email sedang tidak tersedia. Coba lagi nanti.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({'ok': True, 'message': f'Resi dikirim ke {email}.'})

    @action(detail=True, methods=['post'], url_path='whatsapp-resi',
            permission_classes=[IsOwnerManagerAdminOrKasir])
    def whatsapp_resi(self, request, pk=None):
        """Kirim resi POS melalui instance Evolution API yang aktif.

        Body: {"number": "081234567890"}. Pengiriman dilakukan server-side
        agar UI tidak pernah mengklaim resi terkirim sebelum gateway menerima
        permintaan pengiriman.
        """
        sale = self.get_object()
        result = kirim_resi_pos_whatsapp(
            sale_id=sale.id,
            number=request.data.get('number'),
            otomatis=False,
        )
        if result['status'] == 'skipped' and result.get('reason') == 'invalid_number':
            return Response({'error': 'Nomor WhatsApp tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)
        if not result['ok']:
            return Response(
                {'error': 'Gateway WhatsApp tidak dapat mengirim resi. Coba lagi nanti.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Pesan manual dari kasir menahan auto-reply bot sementara untuk nomor ini.
        cache.set(f"wa_handover_{result['number']}", True, timeout=900)
        return Response({'ok': True, 'message': f"Resi dikirim ke WhatsApp {result['number']}."})

    @action(detail=True, methods=['post'], url_path='terbitkan-spk',
            permission_classes=[IsOwnerManagerAdminOrKasir])
    def terbitkan_spk(self, request, pk=None):
        """POST /api/pos/sales/{id}/terbitkan-spk/

        Menerbitkan SPK produksi untuk item transaksi POS — padanan
        /api/orders/{id}/assign/ pada alur pesanan. Dipakai terminal kasir
        saat melayani pesanan custom yang perlu dikerjakan divisi produksi.
        """
        sale = self.get_object()

        if sale.status != 'paid':
            return Response(
                {'error': 'Hanya transaksi lunas yang bisa diterbitkan SPK-nya.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item_ids = request.data.get('item_ids') or []
        items = sale.items.all()
        if item_ids:
            items = items.filter(pk__in=item_ids)

        try:
            biaya_desain = int(request.data.get('biaya_desain', 0) or 0)
            insentif = int(request.data.get('insentif', 0) or 0)
        except (TypeError, ValueError):
            return Response({'error': 'biaya_desain dan insentif harus berupa angka.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                staff = spk.resolve_staff(request.data.get('staff_id'), pemohon=request.user)
                deadline = spk.resolve_deadline(request.data.get('deadline'))
                tahap = spk.resolve_tahap(
                    tahap_id=request.data.get('tahap_id'),
                    divisi_id=request.data.get('divisi_id'),
                    staff=staff,
                )
                jobs = spk.terbitkan(
                    items, field='pos_sale_item', tahap=tahap, staff=staff,
                    biaya_desain=biaya_desain, insentif=insentif, deadline=deadline,
                )
        except spk.SpkError as exc:
            return Response({'error': exc.pesan}, status=exc.status_code)

        target = spk.nama_target(staff, tahap)
        return Response({
            'message': f'SPK nota {sale.nomor} berhasil diterbitkan ke {target}.',
            'jobs': jobs,
        }, status=status.HTTP_200_OK)
