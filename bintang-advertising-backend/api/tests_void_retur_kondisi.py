"""Void POS & retur Order dengan pilihan kondisi + keterangan stok (2026-09-26).

- Void POS "sudah dicetak/dibuat": bahan resep TIDAK dikembalikan (tetap HPP),
  jejaknya dicatat di riwayat bahan; barang jadi yang dilacak tetap kembali.
- Retur Order "rusak / tidak layak jual": barang jadi TIDAK kembali ke stok.
- Rincian stok (produk & bahan) tersedia untuk ditampilkan sebelum konfirmasi.
"""
from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from accounting.models import JournalEntry
from api.models import Order, OrderActivityLog, OrderItem, PengembalianOrder, RestockHistory
from api.pos_models import POSSale
from api.product_models import Product
from api import tests_pos_bom_deduction as _bom_pos  # modul, bukan class: agar tes lama tidak ikut terjalankan ulang

User = _bom_pos.User


class VoidPosBahanTerpakaiTest(APITestCase):
    setUp = _bom_pos.PosBomSinkronProdukSumberTest.setUp
    _jual = _bom_pos.PosBomSinkronProdukSumberTest._jual

    def test_rincian_lalu_void_sudah_dicetak_bahan_tidak_kembali(self):
        res = self._jual(3)  # Banner 3 pcs, bahan 6 lembar
        self.assertEqual(res.status_code, 201, res.content)
        sale = POSSale.objects.get(pk=res.data['id'])

        rincian = self.client.get(f'/api/pos/sales/{sale.id}/rincian-stok/').data
        self.assertEqual(rincian['produk'][0]['nama'], 'Banner Flexi 280gr')
        self.assertEqual(rincian['produk'][0]['qty'], 3.0)
        self.assertEqual(rincian['bahan'], [{'nama': 'Kertas Ivory 230gr', 'qty': 6.0, 'satuan': self.bahan.satuan}])

        void = self.client.post(f'/api/pos/sales/{sale.id}/void/', {'alasan': 'salah cetak', 'bahan_terpakai': True}, format='json')
        self.assertEqual(void.status_code, 200, void.content)

        self.bahan.refresh_from_db()
        self.produk_bahan.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual((self.bahan.stok, float(self.produk_bahan.qty_stok)), (94.0, 94.0))
        self.assertEqual(float(self.product.qty_stok), 50.0)  # barang jadi dilacak tetap kembali
        catatan = RestockHistory.objects.get(item=self.bahan, delta=0)
        self.assertIn('TIDAK dikembalikan', catatan.keterangan)
        self.assertIn(sale.nomor, catatan.keterangan)
        # Jurnal HPP bahan tidak dibalik: biaya bahan terpakai tetap tercatat.
        self.assertFalse(JournalEntry.objects.filter(source_type=JournalEntry.SourceType.PRODUCTION,
                                                     reversed_entry__isnull=False).exists())

    def test_void_belum_dicetak_tetap_mengembalikan_bahan(self):
        sale = POSSale.objects.get(pk=self._jual(3).data['id'])
        self.client.post(f'/api/pos/sales/{sale.id}/void/', {'alasan': 'batal', 'bahan_terpakai': False}, format='json')
        self.bahan.refresh_from_db()
        self.assertEqual(self.bahan.stok, 100.0)


class ReturOrderKondisiBarangTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_retur_kondisi', password='x', role='owner')
        self.client.force_authenticate(self.owner)
        self.order = Order.objects.create(id='ORD-RETUR-KONDISI', nomor_wa='08123450000', nama='Budi',
                                          status_global='selesai', total_harga=100000, dp_dibayar=100000)
        self.pigura = Product.objects.create(nama='Pigura 10R', qty_stok=Decimal('5'), lacak_inventori=True, satuan='pcs')
        OrderItem.objects.create(order=self.order, product=self.pigura, jenis_produk='Pigura 10R', qty=2, harga_jual=50000)

    def _konfirmasi(self, layak):
        retur = PengembalianOrder.objects.create(order=self.order, status='Tunda', nominal_refund=100000,
                                                 dibuat_oleh=self.owner, barang_layak_jual=layak)
        res = self.client.patch(f'/api/pengembalian/{retur.id}/', {'status': 'Dikonfirmasi'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.pigura.refresh_from_db()
        return OrderActivityLog.objects.filter(order=self.order, tindakan='RETUR_STOK').last()

    def test_barang_rusak_tidak_kembali_ke_stok_dan_ada_keterangan(self):
        log = self._konfirmasi(False)
        self.assertEqual(self.pigura.qty_stok, Decimal('5'))
        self.assertIn('TIDAK dikembalikan ke stok (rusak/tidak layak jual): Pigura 10R 2 pcs', log.keterangan)

    def test_barang_layak_kembali_ke_stok_dan_ada_keterangan(self):
        log = self._konfirmasi(True)
        self.assertEqual(self.pigura.qty_stok, Decimal('7'))
        self.assertIn('dikembalikan ke stok: Pigura 10R 2 pcs', log.keterangan)

    def test_rincian_order_dan_kondisi_dari_endpoint_retur(self):
        rincian = self.client.get(f'/api/orders/{self.order.id}/rincian-stok/').data
        self.assertEqual(rincian, {'produk': [{'nama': 'Pigura 10R', 'qty': 2.0, 'satuan': 'pcs'}], 'bahan': []})
        res = self.client.post(f'/api/orders/{self.order.id}/retur/', {'catatan': 'pecah', 'barang_layak_jual': False}, format='json')
        self.assertIn(res.status_code, (200, 201), res.content)
        self.assertFalse(PengembalianOrder.objects.get(order=self.order).barang_layak_jual)

    def test_kondisi_tidak_bisa_diubah_setelah_dikonfirmasi(self):
        self._konfirmasi(False)
        retur = PengembalianOrder.objects.get(order=self.order)
        res = self.client.patch(f'/api/pengembalian/{retur.id}/', {'barang_layak_jual': True}, format='json')
        self.assertEqual(res.status_code, 400)
        self.pigura.refresh_from_db()
        self.assertEqual(self.pigura.qty_stok, Decimal('5'))
