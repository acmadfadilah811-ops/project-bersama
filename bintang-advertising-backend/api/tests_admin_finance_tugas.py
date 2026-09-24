"""Tugas Admin Finance (2026-09-24): rekap penjualan hari sebelumnya, laporan
penjualan, ringkasan shift, produk & inventori, pelanggan & supplier.

Admin/SPV Finance boleh BACA data POS & shift dan mengekspor data penjualan/
stok/pelanggan; semua aksi tulis POS tetap milik owner/manager/admin/kasir."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

User = get_user_model()

EKSPOR_KEUANGAN = [
    '/api/export/orders/', '/api/export/inventory/', '/api/export/stock-movement/',
    '/api/export/products/', '/api/export/customers/', '/api/export/customer-notes/',
    '/api/export/sales-items-by-brand/', '/api/export/sales-details/',
]
EKSPOR_MANAJERIAL = [
    '/api/export/contacts/', '/api/export/jobs/', '/api/export/absensi/', '/api/export/staff-performance/',
]


class AdminFinanceTugasTests(APITestCase):
    def setUp(self):
        self.admin_finance = User.objects.create_user(username='af_tugas', password='x', role='admin_finance')
        self.spv_finance = User.objects.create_user(username='sf_tugas', password='x', role='spv_finance')
        self.kasir = User.objects.create_user(username='kasir_tugas', password='x', role='kasir')
        self.staff = User.objects.create_user(username='staff_tugas', password='x', role='staff')
        self.kemarin = str(timezone.localdate() - timedelta(days=1))

    def _get(self, user, url):
        self.client.force_authenticate(user)
        return self.client.get(url)

    def test_finance_boleh_baca_rekap_harian_riwayat_pos_dan_daftar_shift(self):
        for user in (self.admin_finance, self.spv_finance):
            for url in (
                f'/api/pos/sales/rekap-harian/?tanggal={self.kemarin}',
                '/api/pos/sales/',
                '/api/saldo-kas-harian/',
                '/api/ringkasan-shift/',
            ):
                res = self._get(user, url)
                self.assertEqual(res.status_code, 200, f'{user.role} {url} -> {res.status_code}')

    def test_finance_tidak_boleh_menulis_pos_atau_shift(self):
        self.client.force_authenticate(self.admin_finance)
        self.assertEqual(self.client.post('/api/pos/sales/', {'items': []}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/api/pos/sales/verify-passkey/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.post('/api/saldo-kas-harian/', {'kas_awal': 1000}, format='json').status_code, 403)

    def test_finance_boleh_ekspor_data_keuangan_tapi_bukan_data_sdm(self):
        for user in (self.admin_finance, self.spv_finance):
            for url in EKSPOR_KEUANGAN:
                self.assertNotEqual(self._get(user, url).status_code, 403, f'{user.role} {url}')
            for url in EKSPOR_MANAJERIAL:
                self.assertEqual(self._get(user, url).status_code, 403, f'{user.role} {url}')

    def test_kasir_dan_staff_tetap_tidak_boleh_ekspor(self):
        for user in (self.kasir, self.staff):
            for url in EKSPOR_KEUANGAN + EKSPOR_MANAJERIAL:
                self.assertEqual(self._get(user, url).status_code, 403, f'{user.role} {url}')

    def test_staff_tetap_tidak_boleh_baca_pos_dan_shift(self):
        for url in ('/api/pos/sales/', '/api/saldo-kas-harian/'):
            self.assertEqual(self._get(self.staff, url).status_code, 403, url)

    def test_finance_boleh_baca_area_produk_inventori_pelanggan_supplier_pembelian_laporan(self):
        for url in (
            '/api/products/', '/api/inventory/', '/api/product-stock-movements/', '/api/stock-in-documents/',
            '/api/stock-opname-documents/', '/api/customers/', '/api/suppliers/', '/api/purchases/',
            '/api/reports/penjualan-paket/',
        ):
            res = self._get(self.admin_finance, url)
            self.assertEqual(res.status_code, 200, f'{url} -> {res.status_code}')


class AdminFinancePembelianStokMasukTests(APITestCase):
    """Admin Finance memproses Pembelian sampai posting Stok Masuk (laporan user
    2026-09-24: posting Stok Masuk ditolak 403 untuk akun admin finance)."""

    def setUp(self):
        from datetime import date
        from decimal import Decimal
        from accounting.models import Account, AccountClassification, AccountingSettings
        from api.product_models import Product, Purchase, PurchaseItem

        self.af = User.objects.create_user(username='af_stokmasuk', password='x', role='admin_finance')
        asset, _ = AccountClassification.objects.get_or_create(name='Kas & Bank', defaults={'account_type': 'asset'})
        liab, _ = AccountClassification.objects.get_or_create(name='Hutang T', defaults={'account_type': 'liability'})
        inv = Account.objects.create(code='11400', name='Persediaan', account_type='asset', classification=asset)
        hut = Account.objects.create(code='21000', name='Hutang', account_type='liability', classification=liab)
        um = Account.objects.create(code='11710', name='Uang Muka', account_type='asset', classification=asset)
        st, _ = AccountingSettings.objects.get_or_create(defaults={'accounting_start_date': date(2026, 7, 1)})
        st.purchase_inventory_account, st.purchase_payable_account, st.purchase_advance_account = inv, hut, um
        st.save()
        self.produk = Product.objects.create(nama='Produk AF', lacak_inventori=True, qty_stok=0)
        self.purchase = Purchase.objects.create(nomor='PB-AF-1', tanggal=date(2026, 9, 24), dibuat_oleh=self.af)
        PurchaseItem.objects.create(purchase=self.purchase, product=self.produk, qty=Decimal('3'), harga_beli=Decimal('1000'))

    def test_admin_finance_bisa_ubah_dan_posting_stok_masuk_dari_pembelian(self):
        from api.product_models import StockInDocument
        self.client.force_authenticate(self.af)
        res = self.client.post(f'/api/purchases/{self.purchase.id}/workflow/siapkan-stok-masuk/',
                               {'tanggal_diterima': '2026-09-24', 'lanjut_tambah_stok': True}, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        doc = StockInDocument.objects.get(purchase=self.purchase)
        self.assertEqual(self.client.patch(f'/api/stock-in-documents/{doc.id}/', {'catatan': 'cek'}, format='json').status_code, 200)
        post = self.client.post(f'/api/stock-in-documents/{doc.id}/post-document/', {}, format='json')
        self.assertEqual(post.status_code, 200, post.content)
        self.produk.refresh_from_db()
        self.assertEqual(self.produk.qty_stok, 3)

    def test_kasir_tetap_tidak_bisa_posting_stok_masuk(self):
        kasir = User.objects.create_user(username='kasir_stokmasuk', password='x', role='kasir')
        self.client.force_authenticate(kasir)
        self.assertEqual(self.client.post('/api/stock-in-documents/', {'tanggal': '2026-09-24'}, format='json').status_code, 403)
