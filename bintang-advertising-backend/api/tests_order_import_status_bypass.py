"""Regresi: import-status-csv (tombol "Perbarui Status (CSV)" di Penjualan)
sebelumnya mengubah `status_global` Order LANGSUNG lewat save mentah, TIDAK
lewat batalkan_order()/selesaikan_order() (api/services/order_actions.py).
Akibatnya kode status Z (selesai) / X (batal) di CSV melewatkan pemulihan
stok FIFO, jurnal pembalik/HPP, dan validasi transisi status tidak valid
— semuanya diam-diam, tanpa error apa pun (bug ditemukan & diverifikasi
lewat test yang sengaja gagal dulu, baru diperbaiki 2026-09-05, audit
modul Transaksi & Pembayaran > Penjualan).

Sekarang CSV import memanggil service resmi yang sama dengan tombol
Batalkan/Selesaikan manual, jadi seluruh efek samping itu ikut terjadi.
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import Order
from api.product_models import Product, ProductStockMovement

User = get_user_model()


class ImportStatusCsvUsesOfficialActionsTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_csv_fix', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.product = Product.objects.create(
            nama='Banner CSV Fix', harga_beli=10000, harga_jual_toko=50000,
            qty_stok=Decimal('5'), lacak_inventori=True,
        )

    def _order_dengan_stok_terpotong(self, order_id, status_global):
        order = Order.objects.create(
            id=order_id, nomor_wa='08123456789', nama='Pelanggan CSV Fix',
            status_global=status_global,
        )
        ProductStockMovement.objects.create(
            product=self.product, order=order, tipe='penjualan', qty=Decimal('2'),
            stok_awal=Decimal('5'), stok_akhir=Decimal('3'), tanggal=timezone.localdate(),
        )
        self.product.qty_stok = Decimal('3')
        self.product.save(update_fields=['qty_stok'])
        return order

    def _import_csv(self, order_id, kode_status):
        csv_content = f"order_no,update_status\n{order_id},{kode_status}"
        berkas = SimpleUploadedFile('status.csv', csv_content.encode('utf-8'), content_type='text/csv')
        return self.client.post('/api/orders/import-status-csv/', {'file': berkas}, format='multipart')

    def test_batal_via_csv_memulihkan_stok_dan_membuat_jurnal_pembalik(self):
        order = self._order_dengan_stok_terpotong('ORD-CSV-BATAL-OK', 'proses')

        response = self._import_csv(order.id, 'X')
        self.assertEqual(response.status_code, 200, response.content)

        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status_global, 'batal')
        # Stok dipulihkan ke 5 (sama seperti tombol Batalkan manual).
        self.assertEqual(self.product.qty_stok, Decimal('5'))
        self.assertTrue(
            ProductStockMovement.objects.filter(order=order, tipe='pengembalian').exists()
        )

    def test_batal_via_csv_menolak_order_yang_sudah_selesai(self):
        order = self._order_dengan_stok_terpotong('ORD-CSV-DARI-SELESAI-OK', 'selesai')

        response = self._import_csv(order.id, 'X')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('Retur', response.data['errors'][0]['message'])

        order.refresh_from_db()
        self.product.refresh_from_db()
        # Tidak ada apa pun yang berubah — ditolak sebelum baris manapun ditulis.
        self.assertEqual(order.status_global, 'selesai')
        self.assertEqual(self.product.qty_stok, Decimal('3'))

    def test_selesai_via_csv_menolak_order_yang_sudah_batal(self):
        order = Order.objects.create(id='ORD-CSV-SELESAI-DARI-BATAL', nomor_wa='08123456789',
                                      nama='Pelanggan CSV Fix', status_global='batal')

        response = self._import_csv(order.id, 'Z')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('dibatalkan', response.data['errors'][0]['message'])

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'batal')

    def test_selesai_via_csv_tetap_berhasil_untuk_transisi_valid(self):
        order = Order.objects.create(id='ORD-CSV-SELESAI-OK', nomor_wa='08123456789',
                                      nama='Pelanggan CSV Fix', status_global='proses')

        response = self._import_csv(order.id, 'Z')
        self.assertEqual(response.status_code, 200, response.content)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'selesai')

    def test_status_workflow_biasa_tetap_jalan_seperti_semula(self):
        """Kode P/A/S/T (bukan Z/X) tidak melibatkan service khusus — pastikan
        tidak ikut rusak oleh perubahan ini."""
        order = Order.objects.create(id='ORD-CSV-PROSES-OK', nomor_wa='08123456789',
                                      nama='Pelanggan CSV Fix', status_global='review')

        response = self._import_csv(order.id, 'S')
        self.assertEqual(response.status_code, 200, response.content)

        order.refresh_from_db()
        self.assertEqual(order.status_global, 'proses')
