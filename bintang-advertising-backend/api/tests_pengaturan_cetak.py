"""Pengaturan resi/invoice benar-benar dipakai semua dokumen (2026-10-13)."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APITestCase

from .models import Order, OrderItem, SystemConfig
from .pos_models import POSSale, POSSaleItem
from .services import pengaturan_cetak, resi_digital
from .services.order_invoice_whatsapp import susun_invoice_dp_pdf
from .services.pos_receipt_whatsapp import susun_resi, susun_resi_pdf

User = get_user_model()
PALSU = ('Jl. Produksi No. 123', '0812-3456-7890', 'Transfer BCA: 1234567890')


def _set(**kv):
    for k, v in kv.items():
        SystemConfig.objects.update_or_create(key=k, defaults={'value': v})


def _teks_pdf(fungsi, objek):
    """Kumpulkan teks semua Paragraph yang dibangun fungsi PDF (isi PDF terkompresi)."""
    from reportlab.platypus import Paragraph as Asli

    teks = []

    class Rekam(Asli):
        def __init__(self, text, *a, **k):
            teks.append(text)
            super().__init__(text, *a, **k)

    with mock.patch('reportlab.platypus.Paragraph', Rekam):
        pdf = fungsi(objek)
    assert pdf.startswith(b'%PDF')
    return '\n'.join(teks)


class DasarCetak(APITestCase):
    def setUp(self):
        self.kasir = User.objects.create_user(username='kasir_cetak', password='x', role='kasir')
        self.sale = POSSale.objects.create(
            nomor='POS-CETAK-1', kasir=self.kasir, subtotal=50000, diskon=0, pajak=0, total=50000,
            metode_bayar='Cash', dibayar=50000, kembalian=0, status='paid',
        )
        POSSaleItem.objects.create(sale=self.sale, nama_snapshot='Banner', harga_snapshot=50000, qty=1, subtotal=50000)
        self.order = Order.objects.create(id='ORD-CETAK-1', nama='Budi', nomor_wa='081234567890', status_global='proses')
        OrderItem.objects.create(order=self.order, jenis_produk='Spanduk', qty=1, harga_jual=100000)
        self.order.refresh_from_db()


class PembacaPengaturanTests(DasarCetak):
    def test_kosong_tidak_memakai_data_karangan(self):
        cfg = pengaturan_cetak.ambil()
        self.assertEqual((cfg['alamat'], cfg['telepon'], cfg['info_pembayaran'], cfg['syarat']), ('', '', '', ''))
        self.assertEqual(cfg['judul'], 'Resi Pembelian')
        self.assertEqual(cfg['catatan'], 'Terima Kasih Atas Kunjungan Anda')
        self.assertEqual(cfg['tagline'], 'Solusi Cetak & Promosi Terpercaya')
        self.assertFalse(cfg['sembunyikan_nomor'])

    def test_isian_kosong_yang_disimpan_dihormati_bukan_diganti_bawaan(self):
        _set(bisnis_tagline='', pos_resi_catatan='', pos_resi_judul='')
        cfg = pengaturan_cetak.ambil()
        self.assertEqual((cfg['tagline'], cfg['catatan']), ('', ''))
        self.assertEqual(cfg['judul'], 'Resi Pembelian')  # judul kosong -> bawaan, sesuai teks di layar Pengaturan

    def test_info_pembayaran_jatuh_ke_deskripsi_lama(self):
        _set(bisnis_deskripsi='BCA 123 a/n Star')
        self.assertEqual(pengaturan_cetak.ambil()['info_pembayaran'], 'BCA 123 a/n Star')
        _set(bisnis_info_pembayaran='Mandiri 999')
        self.assertEqual(pengaturan_cetak.ambil()['info_pembayaran'], 'Mandiri 999')

    def test_judul_dengan_nomor(self):
        j = pengaturan_cetak.judul_dengan_nomor
        self.assertEqual(j('Resi Pembelian', 'POS-1', False), 'Resi Pembelian - POS-1')
        self.assertEqual(j('Resi Pembelian', 'POS-1', True), 'Resi Pembelian')
        self.assertEqual(j('', 'POS-1', False), 'POS-1')

    def test_pengaturan_baru_tersimpan_lewat_api(self):
        self.client.force_authenticate(User.objects.create_user(username='owner_cetak', password='x', role='owner'))
        res = self.client.patch('/api/business-settings/', {'tagline': 'Cetak Cepat', 'info_pembayaran': 'BCA 123'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual((res.json()['tagline'], res.json()['info_pembayaran']), ('Cetak Cepat', 'BCA 123'))
        self.assertEqual(SystemConfig.objects.get(key='bisnis_tagline').value, 'Cetak Cepat')
        res = self.client.get('/api/business-settings/')
        self.assertEqual(res.json()['info_pembayaran'], 'BCA 123')


class ResiPosTests(DasarCetak):
    def test_resi_wa_teks_memakai_judul_dan_catatan_pengaturan(self):
        _set(pos_resi_judul='Nota Penjualan', pos_resi_catatan='Barang tidak dapat ditukar')
        teks = susun_resi(self.sale)
        self.assertTrue(teks.startswith('*Nota Penjualan - POS-CETAK-1*'))
        self.assertTrue(teks.endswith('Barang tidak dapat ditukar'))
        self.assertNotIn('Terima kasih telah berbelanja', teks)

    def test_resi_wa_sembunyikan_nomor_dan_tanpa_catatan(self):
        _set(pos_resi_sembunyikan_no_pesanan='true', pos_resi_catatan='')
        teks = susun_resi(self.sale)
        self.assertTrue(teks.startswith('*Resi Pembelian*'))
        self.assertNotIn('POS-CETAK-1', teks)
        self.assertTrue(teks.endswith('Kembalian: Rp 0'))

    def test_resi_pdf_tanpa_alamat_karangan_dan_dengan_alamat_asli_bila_diisi(self):
        teks = _teks_pdf(susun_resi_pdf, self.sale)
        for palsu in PALSU:
            self.assertNotIn(palsu, teks)
        self.assertIn('RESI PEMBELIAN - POS-CETAK-1', teks)
        _set(bisnis_alamat='Jl. Mawar 5, Kudus', bisnis_no_telepon='0291-555', pos_resi_catatan='Sampai jumpa')
        teks = _teks_pdf(susun_resi_pdf, self.sale)
        self.assertIn('Jl. Mawar 5, Kudus', teks)
        self.assertIn('Telp: 0291-555', teks)
        self.assertIn('Sampai jumpa', teks)

    def test_resi_pdf_sembunyikan_nomor(self):
        _set(pos_resi_sembunyikan_no_pesanan='true')
        teks = _teks_pdf(susun_resi_pdf, self.sale)
        self.assertIn('RESI PEMBELIAN', teks)
        self.assertNotIn('POS-CETAK-1', teks)


class EmailResiTests(DasarCetak):
    def _kirim(self):
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/pos/sales/{self.sale.id}/email-resi/', {'email': 'a@b.com'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        return mail.outbox[-1]

    def test_judul_email_dan_catatan_dari_pengaturan(self):
        _set(pos_resi_judul_email='Struk Belanja Anda', pos_resi_catatan='Terima kasih ya', bisnis_alamat='Jl. Mawar 5')
        pesan = self._kirim()
        self.assertEqual(pesan.subject, 'Struk Belanja Anda - POS-CETAK-1')
        self.assertIn('Jl. Mawar 5', pesan.body)
        self.assertTrue(pesan.body.rstrip().endswith('Terima kasih ya'))

    def test_sembunyikan_nomor_di_email(self):
        _set(pos_resi_sembunyikan_no_pesanan='true')
        pesan = self._kirim()
        self.assertEqual(pesan.subject, 'Resi Pembelian')
        self.assertNotIn('POS-CETAK-1', pesan.body)


class InvoicePdfTests(DasarCetak):
    def test_tanpa_rekening_dan_alamat_karangan(self):
        teks = _teks_pdf(susun_invoice_dp_pdf, self.order)
        for palsu in PALSU:
            self.assertNotIn(palsu, teks)
        self.assertNotIn('Metode Pembayaran', teks)
        self.assertNotIn('Syarat', teks)

    def test_info_pembayaran_syarat_dan_identitas_dari_pengaturan(self):
        _set(bisnis_info_pembayaran='Transfer BCA 8880011 a/n Star Photo', bisnis_invoice_terms='DP tidak dapat dikembalikan.',
             bisnis_alamat='Jl. Mawar 5', bisnis_no_telepon='0291-555')
        teks = _teks_pdf(susun_invoice_dp_pdf, self.order)
        self.assertIn('Metode Pembayaran', teks)
        self.assertIn('BCA 8880011', teks)
        self.assertIn('DP tidak dapat dikembalikan.', teks)
        self.assertIn('Jl. Mawar 5', teks)
        self.assertIn('WA: 0291-555', teks)
        self.assertNotIn('Transfer BCA: 1234567890', teks)

    def test_logo_unggahan_dipakai_bila_ada(self):
        from io import BytesIO

        from PIL import Image as PilImage

        buf = BytesIO()
        PilImage.new('RGB', (40, 20), (200, 30, 30)).save(buf, 'PNG')
        with mock.patch('django.core.files.storage.default_storage.open', return_value=BytesIO(buf.getvalue())) as buka:
            _set(bisnis_logo_url='business_logo/uji.png')
            pdf = susun_invoice_dp_pdf(self.order)
        buka.assert_called()
        self.assertIn(b'/Subtype /Image', pdf)


class ResiDigitalTests(DasarCetak):
    def test_toko_membawa_judul_dan_aturan_nomor_tanpa_data_karangan(self):
        _set(pos_resi_judul='Nota', pos_resi_sembunyikan_no_pesanan='true')
        toko = resi_digital._info_toko()
        self.assertEqual((toko['judul'], toko['sembunyikan_nomor']), ('Nota', True))
        self.assertEqual((toko['alamat'], toko['telepon']), ('', ''))
        self.assertEqual(toko['catatan_kaki'], 'Terima Kasih Atas Kunjungan Anda')


class CetakUlangTests(DasarCetak):
    def test_cetak_ulang_diblokir_bila_dinonaktifkan(self):
        _set(pos_ext_settings='{"disable_reprint": true}')
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/pos/sales/{self.sale.id}/tandai-cetak-ulang/')
        self.assertEqual(res.status_code, 403)
        self.sale.refresh_from_db()
        self.assertEqual(self.sale.jumlah_cetak_ulang, 0)

    def test_cetak_ulang_normal_bila_tidak_dinonaktifkan(self):
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.post(f'/api/pos/sales/{self.sale.id}/tandai-cetak-ulang/').status_code, 200)
