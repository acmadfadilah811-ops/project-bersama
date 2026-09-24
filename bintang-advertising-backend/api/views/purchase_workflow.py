from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsOwnerManagerAdminFinanceOrReadOnly
from ..product_models import Purchase, StockInDocument, StockInDocumentItem
from ..product_serializers import PurchaseSerializer, StockInDocumentSerializer
from ..purchase_workflow_models import PurchaseActivityLog, catat_purchase
from ..product_views import _next_document_number, _parse_bool_flag, post_stock_in_document
from ..services.purchase_completion import selesaikan_otomatis_jika_siap


def _get_user(request):
    return request.user if (request.user and request.user.is_authenticated) else None


def _no_terima_otomatis(purchase):
    return f"TRM{timezone.localdate().strftime('%y%m%d')}-{purchase.pk}"


def _catat_penerimaan(purchase, user, *, tanggal, no_terima, lanjut_tambah_stok, penerima_nama):
    """Satu-satunya tempat penerimaan barang dicatat (dipakai tombol Terima di
    Info Penerimaan DAN dropdown status "Diterima"): set field penerimaan, lalu
    -- bila `lanjut_tambah_stok` -- pastikan ada dokumen Stok Masuk draft.

    Sebelumnya dropdown "Diterima" cuma membalik status tanpa membuat Stok Masuk,
    sehingga tombol Terima sesudahnya ditolak ("tidak dapat disiapkan ulang") dan
    stok tidak pernah bertambah. Mengembalikan (dokumen_stok_masuk | None, dibuat_baru)."""
    purchase.tanggal_diterima = tanggal
    purchase.no_terima = no_terima
    purchase.receive_status = 'diterima'
    purchase.penerima_nama = penerima_nama
    purchase.lanjut_tambah_stok = lanjut_tambah_stok
    purchase.save(update_fields=['tanggal_diterima', 'no_terima', 'receive_status', 'penerima_nama', 'lanjut_tambah_stok', 'updated_at'])

    # OFF berarti penerimaan dicatat, tetapi tidak membuat dokumen stok masuk.
    if not lanjut_tambah_stok:
        catat_purchase(purchase, user, 'RECEIVED', f'Penerimaan {no_terima} dicatat tanpa membuat stok masuk.')
        return None, False

    existing = purchase.stock_in_documents.filter(status='draft').first()
    if existing:
        existing.nama_penerima = penerima_nama
        existing.save(update_fields=['nama_penerima', 'updated_at'])
        return existing, False

    # Diskon dokumen dialokasikan proporsional ke harga beli tiap item, jadi
    # Stok Masuk / lapisan FIFO / HPP memakai biaya BERSIH (2026-09-24).
    ringkasan = purchase.hitung_ringkasan()
    faktor = (
        (ringkasan['subtotal'] - ringkasan['diskon']) / ringkasan['subtotal']
        if ringkasan['subtotal'] > 0 else Decimal('1')
    )

    today = timezone.localdate()
    doc = StockInDocument.objects.create(
        nomor=_next_document_number(StockInDocument, f"IN{today.strftime('%y%m%d')}"),
        tanggal=tanggal, catatan=purchase.catatan,
        nama_penerima=penerima_nama,
        supplier=purchase.supplier, dibuat_oleh=user, purchase=purchase,
    )
    for item in purchase.items.all():
        StockInDocumentItem.objects.create(
            document=doc, product=item.product, variant=item.variant, qty=item.qty,
            harga_beli=(item.harga_beli * faktor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP),
            tanggal_kadaluwarsa=item.tanggal_kadaluwarsa,
            uom_kode=item.uom_kode, uom_konverter=item.uom_konverter, uom_qty=item.uom_qty,
        )
    catat_purchase(purchase, user, 'STOCK_DRAFT', f'Stok masuk {doc.nomor} dibuat sebagai draft dengan nomor penerimaan {no_terima}. Status penerimaan menjadi Diterima.')
    return doc, True


class PurchaseWorkflowView(APIView):
    permission_classes = [IsOwnerManagerAdminFinanceOrReadOnly]

    def get_purchase(self, pk):
        return get_object_or_404(Purchase.objects.prefetch_related('items'), pk=pk, is_retur=False)

    def get(self, request, pk, action):
        if action != 'logs':
            return Response({'error': 'Aksi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        # Riwayat bersifat read-only dan juga boleh dilihat pada dokumen retur.
        purchase = get_object_or_404(Purchase, pk=pk)
        logs = PurchaseActivityLog.objects.filter(purchase=purchase).select_related('user')
        return Response([{
            'id': log.id, 'tindakan': log.tindakan, 'keterangan': log.keterangan,
            'waktu': log.created_at, 'user_nama': (log.user.get_full_name() or log.user.username) if log.user else 'Sistem',
        } for log in logs])

    def post(self, request, pk, action):
        purchase = self.get_purchase(pk)
        if action == 'siapkan-stok-masuk':
            return self.siapkan_stok_masuk(request, purchase)
        if action == 'selesaikan':
            return self.selesaikan(request, purchase)
        if action == 'batalkan':
            return self.batalkan(request, purchase)
        if action == 'toggle-payment':
            return self.toggle_payment(request, purchase)
        if action == 'update-status':
            return self.update_status(request, purchase)
        return Response({'error': 'Aksi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

    @transaction.atomic
    def siapkan_stok_masuk(self, request, purchase):
        purchase = Purchase.objects.select_for_update().prefetch_related('items').get(pk=purchase.pk)
        if purchase.status != 'draft':
            return Response({'error': 'Pembelian yang sudah selesai atau dibatalkan tidak dapat diterima lagi.'}, status=status.HTTP_400_BAD_REQUEST)
        if not purchase.items.exists():
            return Response({'error': 'Tambahkan minimal satu produk sebelum mengisi penerimaan.'}, status=status.HTTP_400_BAD_REQUEST)
        tanggal = request.data.get('tanggal_diterima') or timezone.localdate()
        no_terima = (request.data.get('no_terima') or '').strip() or _no_terima_otomatis(purchase)
        lanjut_tambah_stok = _parse_bool_flag(request.data.get('lanjut_tambah_stok', True))
        user = _get_user(request)
        penerima = None
        penerima_id = request.data.get('penerima_id')
        if penerima_id:
            from django.contrib.auth import get_user_model
            penerima = get_user_model().objects.filter(pk=penerima_id, is_active=True).first()
            if not penerima:
                return Response({'error': 'Akun penerima tidak valid atau sudah nonaktif.'}, status=status.HTTP_400_BAD_REQUEST)
        penerima_nama = (
            (penerima.get_full_name() or penerima.username) if penerima
            else purchase.penerima_nama or ((user.get_full_name() or user.username) if user else 'Admin')
        )

        # Sudah ditandai Diterima (mis. lewat dropdown status atau klik Terima
        # sebelumnya): jangan ditolak -- arahkan ke Stok Masuk yang sudah ada,
        # atau buatkan kalau belum pernah dibuat.
        if purchase.receive_status == 'diterima':
            draft_doc = purchase.stock_in_documents.filter(status='draft').first()
            if draft_doc:
                return Response({'stock_document': StockInDocumentSerializer(draft_doc).data})
            if purchase.stock_in_documents.exclude(status='batal').exists():
                return Response({'error': 'Barang sudah diterima dan stok masuk sudah diposting.'}, status=status.HTTP_400_BAD_REQUEST)
            if not lanjut_tambah_stok:
                return Response({'error': 'Penerimaan sudah dicatat. Aktifkan "Lanjut tambah stok masuk" bila stok ingin ditambahkan.'}, status=status.HTTP_400_BAD_REQUEST)

        doc, dibuat = _catat_penerimaan(
            purchase, user, tanggal=tanggal, no_terima=no_terima,
            lanjut_tambah_stok=lanjut_tambah_stok, penerima_nama=penerima_nama,
        )
        selesaikan_otomatis_jika_siap(purchase, user)
        if doc is None:
            purchase.refresh_from_db()
            return Response({'purchase': PurchaseSerializer(purchase).data})
        return Response(
            {'stock_document': StockInDocumentSerializer(doc).data},
            status=status.HTTP_201_CREATED if dibuat else status.HTTP_200_OK,
        )

    @transaction.atomic
    def selesaikan(self, request, purchase):
        user = _get_user(request)
        purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)
        if purchase.status != 'draft' or purchase.receive_status != 'diterima':
            return Response({'error': 'Hanya pembelian berstatus Diterima yang dapat diselesaikan.'}, status=status.HTTP_400_BAD_REQUEST)
        purchase.status = 'selesai'
        purchase.save(update_fields=['status', 'updated_at'])
        catat_purchase(purchase, user, 'COMPLETE', 'Pembelian diselesaikan dan dipindahkan ke Telah Diproses.')
        return Response(PurchaseSerializer(purchase).data)

    @transaction.atomic
    def batalkan(self, request, purchase):
        user = _get_user(request)
        purchase = Purchase.objects.select_for_update().get(pk=purchase.pk)
        if purchase.status != 'draft' or purchase.receive_status == 'diterima':
            return Response({'error': 'Pembelian yang sudah diterima tidak dapat dibatalkan tanpa proses retur.'}, status=status.HTTP_400_BAD_REQUEST)
        purchase.status = 'batal'
        purchase.save(update_fields=['status', 'updated_at'])
        catat_purchase(purchase, user, 'CANCEL', 'Pembelian dibatalkan dan dipindahkan ke daftar Dibatalkan.')
        return Response(PurchaseSerializer(purchase).data)

    @transaction.atomic
    def toggle_payment(self, request, purchase):
        user = _get_user(request)
        purchase = Purchase.objects.select_for_update().prefetch_related('items').get(pk=purchase.pk)
        if purchase.status != 'draft':
            return Response(
                {'error': 'Penanda pembayaran hanya dapat diubah pada pembelian yang masih diproses.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not purchase.items.exists():
            return Response(
                {'error': 'Tambahkan minimal satu produk sebelum mengubah penanda pembayaran.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if purchase.payments.exists():
            return Response(
                {'error': 'Pembelian sudah memiliki pembayaran nyata. Ubah melalui Pengaturan Pembayaran.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        purchase.payment_marked_paid = not purchase.payment_marked_paid
        purchase.save(update_fields=['payment_marked_paid', 'updated_at'])
        penanda = 'diaktifkan' if purchase.payment_marked_paid else 'dinonaktifkan'
        catat_purchase(
            purchase,
            user,
            'PAYMENT_MARKED' if purchase.payment_marked_paid else 'PAYMENT_MARK_CLEARED',
            f'Penanda administratif pembayaran {penanda}; tidak ada pembayaran atau jurnal yang dibuat.',
        )
        if purchase.payment_marked_paid:
            selesaikan_otomatis_jika_siap(purchase, user)
            purchase.refresh_from_db()
        return Response(PurchaseSerializer(purchase).data)

    @transaction.atomic
    def update_status(self, request, purchase):
        user = _get_user(request)
        purchase = Purchase.objects.select_for_update().prefetch_related('stock_in_documents__items').get(pk=purchase.pk)
        new_status = request.data.get('status_pembelian')
        if not new_status:
            return Response({'error': 'status_pembelian wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)

        status_map = {
            'Tunda': ('draft', 'tunda', 'tunda'),
            'Terkirim': ('draft', 'tunda', 'terkirim'),
            'Dikirim': ('draft', 'tunda', 'dikirim'),
            'Diterima': ('draft', 'diterima', None),
            'Selesai': ('selesai', 'diterima', None),
            'Batal': ('batal', 'tunda' if purchase.receive_status != 'diterima' else 'diterima', None),
        }

        if new_status not in status_map:
            return Response({'error': f'Status {new_status} tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)

        # Sudah diterima = stok & jurnal sudah berjalan; pembatalan wajib lewat
        # proses retur (sama seperti batalkan()), bukan lewat dropdown status ini.
        if new_status == 'Batal' and purchase.receive_status == 'diterima':
            return Response({'error': 'Pembelian yang sudah diterima tidak dapat dibatalkan tanpa proses retur.'}, status=status.HTTP_400_BAD_REQUEST)

        # Mundur ke status pengiriman setelah Stok Masuk dibuat akan membuka
        # jalan penerimaan ganda (stok bertambah 2x) -- tolak.
        if (
            new_status in ('Tunda', 'Terkirim', 'Dikirim')
            and purchase.receive_status == 'diterima'
            and purchase.stock_in_documents.exclude(status='batal').exists()
        ):
            return Response(
                {'error': 'Pembelian yang sudah diterima dan memiliki Stok Masuk tidak dapat dikembalikan ke status pengiriman.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status == 'Diterima' and purchase.receive_status != 'diterima':
            if not purchase.items.exists():
                return Response({'error': 'Tambahkan minimal satu produk sebelum mengisi penerimaan.'}, status=status.HTTP_400_BAD_REQUEST)
            _catat_penerimaan(
                purchase, user,
                tanggal=timezone.localdate(),
                no_terima=purchase.no_terima or _no_terima_otomatis(purchase),
                lanjut_tambah_stok=purchase.lanjut_tambah_stok,
                penerima_nama=purchase.penerima_nama or ((user.get_full_name() or user.username) if user else 'Admin'),
            )

        if new_status == 'Selesai':
            if purchase.receive_status != 'diterima':
                return Response(
                    {'error': 'Lengkapi Info Penerimaan (status Diterima) sebelum menyelesaikan pembelian.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if purchase.status != 'selesai':
                # Dokumen stok masuk hanya ada bila "lanjut tambah stok" diaktifkan
                # saat Diterima (lihat _catat_penerimaan). Bila dimatikan, penerimaan
                # sengaja tidak melacak stok — Selesai tidak butuh dokumen tersebut.
                if purchase.lanjut_tambah_stok and not purchase.stock_in_documents.exclude(status='batal').exists():
                    return Response(
                        {'error': 'Stok masuk belum dibuat. Klik Terima di Info Penerimaan (aktifkan "Lanjut tambah stok masuk") dulu supaya stok bertambah.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                document = purchase.stock_in_documents.filter(status='draft').first()
                if document is not None:
                    if not document.items.exists():
                        return Response(
                            {'error': 'Dokumen stok masuk belum memiliki produk. Tambahkan produk sebelum menyelesaikan pembelian.'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    try:
                        post_stock_in_document(document, user)
                    except ValidationError as exc:
                        # M5: update_status() ini @transaction.atomic - menangkap
                        # exception di sini tanpa set_rollback() bikin Django kira
                        # transaksi sukses dan commit stok/status dokumen stok masuk
                        # yang sudah berubah, walau jurnal gagal diposting (ditemukan
                        # lewat audit produksi 2026-09-05). Purchase.status sendiri
                        # tidak sempat berubah (assignment ada di bawah), tapi
                        # StockInDocument-nya bisa terlanjur 'selesai' tanpa jurnal -
                        # retry berikutnya lolos diam-diam karena document.status
                        # sudah bukan 'draft' lagi (lihat post_stock_in_document()).
                        transaction.set_rollback(True)
                        return Response({'error': exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)

        doc_status, rec_status, delivery_status = status_map[new_status]
        purchase.status = doc_status
        purchase.receive_status = rec_status
        if delivery_status is not None:
            purchase.delivery_status = delivery_status
        purchase.save(update_fields=['status', 'receive_status', 'delivery_status', 'updated_at'])
        catat_purchase(purchase, user, 'STATUS_UPDATE', f'Status pembelian diperbarui menjadi: {new_status}.')

        if new_status == 'Diterima':
            selesaikan_otomatis_jika_siap(purchase, user)
            purchase.refresh_from_db()

        return Response(PurchaseSerializer(purchase).data)
