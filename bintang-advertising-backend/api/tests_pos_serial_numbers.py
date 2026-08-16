"""No. Seri (Product.serial_numbers) benar-benar tercatat terjual saat
checkout POS — sebelumnya data ini cuma tersimpan di kartu produk, tidak ada
satu pun alur yang membaca/menandainya (laporan "No. Seri" hardcode kosong
di report_views.py, bug ditemukan & diperbaiki 2026-08-13).

Desain: produk dengan `pesanan_no_seri=True` wajib kirim `serial_numbers`
(list nomor seri, panjang harus sama dengan qty) saat checkout. Server
validasi nomor itu ada di pool `Product.serial_numbers` & belum terjual
(`no_pesanan` kosong), lalu menandainya terjual (`no_pesanan` = nomor nota).
Void mengembalikan nomor seri ke pool (bisa dijual lagi)."""
from rest_framework.test import APITestCase

from api.models import CustomUser
from api.pos_models import POSSaleItem
from api.product_models import Product


def _produk_seri(**extra):
    defaults = dict(
        nama='Handphone X', price_type='flat', harga_jual_toko=2000000,
        qty_stok=10, lacak_inventori=False, pesanan_no_seri=True,
        serial_numbers=[
            {'id': '1', 'variant': 'All', 'no_seri': 'SN-001', 'no_pesanan': ''},
            {'id': '2', 'variant': 'All', 'no_seri': 'SN-002', 'no_pesanan': ''},
        ],
    )
    defaults.update(extra)
    return Product.objects.create(**defaults)


class PosSerialNumberCheckoutTests(APITestCase):
    def setUp(self):
        self.owner = CustomUser.objects.create_user(
            username='owner_seri', password='rahasia123', role='owner',
        )
        self.client.force_authenticate(self.owner)

    def test_checkout_wajib_kirim_serial_numbers(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertEqual(POSSaleItem.objects.count(), 0)

    def test_checkout_serial_valid_tercatat_dan_pool_ditandai_terjual(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1, 'serial_numbers': ['SN-001']}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        item = POSSaleItem.objects.get(sale_id=res.data['id'])
        self.assertEqual(item.serial_numbers, ['SN-001'])

        p.refresh_from_db()
        entry = next(s for s in p.serial_numbers if s['no_seri'] == 'SN-001')
        self.assertEqual(entry['no_pesanan'], res.data['nomor'])
        entry_lain = next(s for s in p.serial_numbers if s['no_seri'] == 'SN-002')
        self.assertEqual(entry_lain['no_pesanan'], '')

    def test_checkout_serial_sudah_terjual_ditolak(self):
        p = _produk_seri()
        p.serial_numbers[0]['no_pesanan'] = 'POS-LAMA-1'
        p.save(update_fields=['serial_numbers'])
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1, 'serial_numbers': ['SN-001']}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)
        self.assertEqual(POSSaleItem.objects.count(), 0)

    def test_checkout_serial_tidak_terdaftar_ditolak(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1, 'serial_numbers': ['SN-NGAWUR']}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_checkout_jumlah_serial_tidak_sama_dengan_qty_ditolak(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 2, 'serial_numbers': ['SN-001']}],
            'status': 'paid', 'dibayar': 4000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_checkout_serial_duplikat_dalam_satu_transaksi_ditolak(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 2, 'serial_numbers': ['SN-001', 'SN-001']}],
            'status': 'paid', 'dibayar': 4000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 400, res.content)

    def test_void_mengembalikan_serial_ke_pool(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1, 'serial_numbers': ['SN-001']}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        sale_id = res.data['id']

        void_res = self.client.post(f'/api/pos/sales/{sale_id}/void/')
        self.assertEqual(void_res.status_code, 200, void_res.content)

        p.refresh_from_db()
        entry = next(s for s in p.serial_numbers if s['no_seri'] == 'SN-001')
        self.assertEqual(entry['no_pesanan'], '')

        # Setelah void, nomor seri yang sama bisa dipakai lagi di transaksi baru.
        res2 = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1, 'serial_numbers': ['SN-001']}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res2.status_code, 201, res2.content)

    def test_laporan_item_penjualan_menampilkan_no_seri(self):
        p = _produk_seri()
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 1, 'serial_numbers': ['SN-001']}],
            'status': 'paid', 'dibayar': 2000000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)

        hasil = self.client.get('/api/reports/item-penjualan-tanggal/').data
        baris = next(r for r in hasil['rows'] if r['item'] == 'Handphone X')
        self.assertEqual(baris['no_seri'], 'SN-001')

    def test_produk_tanpa_pesanan_no_seri_tidak_wajib_kirim_serial(self):
        p = Product.objects.create(
            nama='Kartu Nama', price_type='flat', harga_jual_toko=35000,
            qty_stok=10, lacak_inventori=False,
        )
        res = self.client.post('/api/pos/sales/', {
            'items': [{'product_id': p.id, 'qty': 3}],
            'status': 'paid', 'dibayar': 105000, 'metode_bayar': 'tunai',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
