from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..permissions import IsOwnerManagerAdminOrReadOnly
from ..product_models import Purchase, StockInDocument, StockInDocumentItem
from ..product_serializers import PurchaseSerializer, StockInDocumentSerializer
from ..purchase_workflow_models import PurchaseActivityLog, catat_purchase
from ..product_views import _next_document_number, _parse_bool_flag, post_stock_in_document


def _get_user(request):
    return request.user if (request.user and request.user.is_authenticated) else None


class PurchaseWorkflowView(APIView):
    permission_classes = [IsOwnerManagerAdminOrReadOnly]

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
        if purchase.status != 'draft' or purchase.receive_status == 'diterima':
            return Response({'error': 'Pembelian tidak dapat disiapkan ulang.'}, status=status.HTTP_400_BAD_REQUEST)
        if not purchase.items.exists():
            return Response({'error': 'Tambahkan minimal satu produk sebelum mengisi penerimaan.'}, status=status.HTTP_400_BAD_REQUEST)
        tanggal = request.data.get('tanggal_diterima') or timezone.localdate()
        no_terima = (request.data.get('no_terima') or '').strip()
        lanjut_tambah_stok = _parse_bool_flag(request.data.get('lanjut_tambah_stok', True))
        if not no_terima:
            today_str = timezone.localdate().strftime('%y%m%d')
            no_terima = f"TRM{today_str}-{purchase.pk}"
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

        # OFF berarti penerimaan dicatat, tetapi tidak membuat dokumen stok masuk
        # dan tidak berpindah halaman. Toggle pembayaran dapat dipakai setelahnya.
        if not lanjut_tambah_stok:
            purchase.tanggal_diterima = tanggal
            purchase.no_terima = no_terima
            purchase.receive_status = 'diterima'
            purchase.penerima_nama = penerima_nama
            purchase.lanjut_tambah_stok = False
            purchase.save(update_fields=['tanggal_diterima', 'no_terima', 'receive_status', 'penerima_nama', 'lanjut_tambah_stok', 'updated_at'])
            catat_purchase(purchase, user, 'RECEIVED', f'Penerimaan {no_terima} dicatat tanpa membuat stok masuk.')
            return Response({'purchase': PurchaseSerializer(purchase).data})

        existing = purchase.stock_in_documents.filter(status='draft').first()
        if existing:
            purchase.tanggal_diterima = tanggal
            purchase.no_terima = no_terima
            purchase.receive_status = 'diterima'
            purchase.penerima_nama = penerima_nama
            purchase.lanjut_tambah_stok = True
            purchase.save(update_fields=['tanggal_diterima', 'no_terima', 'receive_status', 'penerima_nama', 'lanjut_tambah_stok', 'updated_at'])
            existing.nama_penerima = penerima_nama
            existing.save(update_fields=['nama_penerima', 'updated_at'])
            return Response({'stock_document': StockInDocumentSerializer(existing).data})
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
                harga_beli=item.harga_beli, tanggal_kadaluwarsa=item.tanggal_kadaluwarsa,
                uom_kode=item.uom_kode, uom_konverter=item.uom_konverter, uom_qty=item.uom_qty,
            )
        purchase.tanggal_diterima = tanggal
        purchase.no_terima = no_terima
        purchase.receive_status = 'diterima'
        purchase.penerima_nama = penerima_nama
        purchase.lanjut_tambah_stok = True
        purchase.save(update_fields=['tanggal_diterima', 'no_terima', 'receive_status', 'penerima_nama', 'lanjut_tambah_stok', 'updated_at'])
        catat_purchase(purchase, user, 'STOCK_DRAFT', f'Stok masuk {doc.nomor} dibuat sebagai draft dengan nomor penerimaan {no_terima}. Status penerimaan menjadi Diterima.')
        return Response({'stock_document': StockInDocumentSerializer(doc).data}, status=status.HTTP_201_CREATED)

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
        purchase = Purchase.objects.select_for_update().prefetch_related('items', 'payments').get(pk=purchase.pk)
        if not purchase.items.exists():
            return Response({'error': 'Tambahkan minimal satu produk sebelum mengubah status pembayaran.'}, status=status.HTTP_400_BAD_REQUEST)
        if not (purchase.no_terima and purchase.tanggal_diterima) and purchase.receive_status != 'diterima':
            return Response({'error': 'Informasi penerimaan (No. Terima & Tanggal Terima) harus terisi terlebih dahulu.'}, status=status.HTTP_400_BAD_REQUEST)

        target = request.data.get('target_status')
        if target == 'lunas' or (not target and purchase.payment_status != 'lunas'):
            sisa = purchase.total - purchase.total_dibayar
            if sisa > 0:
                from accounting.models import Account
                from accounting.services.purchase_posting import post_purchase_payment_journal
                from django.core.exceptions import ValidationError as DjangoValidationError
                from ..product_models import PurchasePayment

                cash_account = Account.objects.filter(code='11101', is_active=True).first()
                if not cash_account:
                    return Response({'error': 'COA 11101 (Kas) wajib tersedia untuk toggle pembayaran.'}, status=status.HTTP_400_BAD_REQUEST)
                payment = PurchasePayment.objects.create(
                    purchase=purchase,
                    tanggal=timezone.localdate(),
                    nominal=sisa,
                    metode='Toggle Direct',
                    catatan='Pelunasan via toggle pembayaran',
                    dibuat_oleh=user
                )
                try:
                    post_purchase_payment_journal(payment, cash_account, actor=user)
                except DjangoValidationError as exc:
                    raise ValidationError(getattr(exc, 'messages', [str(exc)])) from exc
            purchase.recompute_payment_status()
            catat_purchase(purchase, user, 'PAYMENT_TOGGLE', 'Status pembayaran diubah menjadi Sudah Dibayar (Lunas).')
        else:
            from accounting.services.purchase_posting import reverse_purchase_payment_journal
            from django.core.exceptions import ValidationError as DjangoValidationError
            from ..product_models import PurchasePayment

            payments = list(PurchasePayment.objects.filter(purchase=purchase))
            toggle_payments = [payment for payment in payments if payment.metode == 'Toggle Direct']
            if not toggle_payments or len(toggle_payments) != len(payments):
                return Response({'error': 'Status Belum Dibayar tidak dapat menghapus pembayaran manual. Hapus pembayaran tersebut satu per satu.'}, status=status.HTTP_400_BAD_REQUEST)
            for payment in toggle_payments:
                try:
                    reverse_purchase_payment_journal(payment, actor=user)
                except DjangoValidationError as exc:
                    raise ValidationError(getattr(exc, 'messages', [str(exc)])) from exc
                payment.delete()
            purchase.recompute_payment_status()
            catat_purchase(purchase, user, 'PAYMENT_TOGGLE', 'Status pembayaran diubah menjadi Belum Dibayar.')

        return Response(PurchaseSerializer(purchase).data)

    @transaction.atomic
    def update_status(self, request, purchase):
        user = _get_user(request)
        purchase = Purchase.objects.select_for_update().prefetch_related('stock_in_documents__items').get(pk=purchase.pk)
        new_status = request.data.get('status_pembelian')
        if not new_status:
            return Response({'error': 'status_pembelian wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)

        status_map = {
            'Tunda': ('draft', 'tunda'),
            'Terkirim': ('draft', 'tunda'),
            'Dikirim': ('draft', 'tunda'),
            'Diterima': ('draft', 'diterima'),
            'Selesai': ('selesai', 'diterima'),
            'Batal': ('batal', 'tunda' if purchase.receive_status != 'diterima' else 'diterima'),
        }

        if new_status not in status_map:
            return Response({'error': f'Status {new_status} tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)

        # Sudah diterima = stok & jurnal sudah berjalan; pembatalan wajib lewat
        # proses retur (sama seperti batalkan()), bukan lewat dropdown status ini.
        if new_status == 'Batal' and purchase.receive_status == 'diterima':
            return Response({'error': 'Pembelian yang sudah diterima tidak dapat dibatalkan tanpa proses retur.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_status == 'Selesai':
            if purchase.receive_status != 'diterima':
                return Response(
                    {'error': 'Lengkapi Info Penerimaan (status Diterima) sebelum menyelesaikan pembelian.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if purchase.status != 'selesai':
                # Dokumen stok masuk hanya ada bila "lanjut tambah stok" diaktifkan
                # saat Diterima (lihat siapkan_stok_masuk). Bila dimatikan, penerimaan
                # sengaja tidak melacak stok — Selesai tidak butuh dokumen tersebut.
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
                        return Response({'error': exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)}, status=status.HTTP_400_BAD_REQUEST)

        doc_status, rec_status = status_map[new_status]
        purchase.status = doc_status
        purchase.receive_status = rec_status
        purchase.save(update_fields=['status', 'receive_status', 'updated_at'])
        catat_purchase(purchase, user, 'STATUS_UPDATE', f'Status pembelian diperbarui menjadi: {new_status}.')

        return Response(PurchaseSerializer(purchase).data)
