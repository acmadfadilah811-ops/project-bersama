"""Struk online + survei kepuasan (2026-10-06)."""
from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from .models import CustomUser, Order, OrderItem
from .pos_models import POSSale, POSSaleItem
from .services import resi_digital as svc
from .survei_models import AspekSurvei, SurveiKepuasan


class _Dasar(APITestCase):
    def setUp(self):
        cache.clear()
        self.publik = APIClient()
        self.aspek = list(AspekSurvei.objects.filter(aktif=True))
        if not self.aspek:  # migrasi data mengisi 5 aspek bawaan
            self.aspek = [AspekSurvei.objects.create(nama=f'Aspek {i}', urutan=i) for i in range(2)]
        self.sale = POSSale.objects.create(nomor='POS-RESI-1', subtotal=Decimal('34000'), total=Decimal('34000'),
                                           dibayar=Decimal('50000'), kembalian=Decimal('16000'), status='paid')
        POSSaleItem.objects.create(sale=self.sale, nama_snapshot='Cetak Banner', harga_snapshot=Decimal('17000'),
                                   qty=Decimal('2'), subtotal=Decimal('34000'))
        self.token = svc.buat_token('pos', self.sale.id)

    def nilai_lengkap(self, n=5):
        return {str(a.id): n for a in self.aspek}


class ResiPublikTests(_Dasar):
    def test_aspek_bawaan_seperti_olsera(self):
        nama = set(AspekSurvei.objects.values_list('nama', flat=True))
        self.assertTrue({'Kualitas Produk', 'Pelayanan & Keramahan', 'Fast Response'} <= nama)

    def test_struk_pos_tampil_tanpa_login(self):
        res = self.publik.get(f'/api/resi/{self.token}/')
        self.assertEqual(res.status_code, 200, res.content)
        d = res.json()
        self.assertEqual((d['nomor'], d['total'], d['kembalian'], d['status']), ('POS-RESI-1', 34000, 16000, 'lunas'))
        self.assertEqual(d['items'][0]['nama'], 'Cetak Banner')
        self.assertTrue(d['survei']['bisa_diisi'])
        self.assertIn('nama', d['toko'])

    def test_token_palsu_atau_diubah_404(self):
        self.assertEqual(self.publik.get('/api/resi/asal-asalan/').status_code, 404)
        self.assertEqual(self.publik.get(f'/api/resi/{self.token[:-2]}xx/').status_code, 404)

    def test_struk_pesanan_menampilkan_sisa_tagihan_dan_riwayat_bayar(self):
        order = Order.objects.create(id='ORD-RESI-1', nomor_wa='081234567890', nama='Budi')
        OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=100000)
        order.update_totals()
        order.dp_dibayar = 40000
        order.save()
        d = self.publik.get(f"/api/resi/{svc.buat_token('order', order.id)}/").json()
        self.assertEqual((d['total'], d['sisa_tagihan'], d['status']), (100000, 60000, 'belum_lunas'))
        self.assertNotIn('081234567890', str(d))  # nomor WA disamarkan

    def test_url_resi_memakai_alamat_publik(self):
        self.assertTrue(svc.url_resi('pos', self.sale.id).startswith('https://app.starphotoadvertising.com/resi/'))


class SurveiTests(_Dasar):
    def kirim(self, nilai, catatan='Mantap'):
        return self.publik.post(f'/api/resi/{self.token}/survei/', {'nilai': nilai, 'catatan': catatan}, format='json')

    def test_isi_survei_sekali_saja(self):
        self.assertEqual(self.kirim(self.nilai_lengkap(4)).status_code, 201)
        s = SurveiKepuasan.objects.get(pos_sale=self.sale)
        self.assertEqual(s.rata_rata, Decimal('4.00'))
        self.assertEqual(s.nilai.count(), len(self.aspek))
        self.assertEqual(self.kirim(self.nilai_lengkap(1)).status_code, 409)
        d = self.publik.get(f'/api/resi/{self.token}/').json()
        self.assertTrue(d['survei']['sudah_diisi'])
        self.assertFalse(d['survei']['bisa_diisi'])

    def test_nilai_tidak_lengkap_atau_di_luar_1_5_ditolak(self):
        kurang = self.nilai_lengkap()
        kurang.pop(next(iter(kurang)))
        self.assertEqual(self.kirim(kurang).status_code, 400)
        self.assertEqual(self.kirim(self.nilai_lengkap(6)).status_code, 400)
        self.assertFalse(SurveiKepuasan.objects.exists())

    def test_transaksi_void_tidak_bisa_disurvei(self):
        POSSale.objects.filter(pk=self.sale.pk).update(status='void')
        self.assertEqual(self.kirim(self.nilai_lengkap()).status_code, 400)


class LaporanSurveiTests(_Dasar):
    def test_hanya_owner_manager_dan_ringkasan_benar(self):
        self.publik.post(f'/api/resi/{self.token}/survei/', {'nilai': self.nilai_lengkap(5)}, format='json')
        kasir = CustomUser.objects.create_user(username='kasir.survei', password='x12345678', role='kasir')
        owner = CustomUser.objects.create_user(username='owner.survei', password='x12345678', role='owner')
        c = APIClient()
        c.force_authenticate(kasir)
        self.assertEqual(c.get('/api/survei-kepuasan/').status_code, 403)
        c.force_authenticate(owner)
        d = c.get('/api/survei-kepuasan/').json()
        self.assertEqual((d['jumlah'], d['rata_rata']), (1, 5.0))
        self.assertEqual(d['tanggapan'][0]['transaksi'], 'POS-RESI-1')
        self.assertEqual(len(d['per_aspek']), len(self.aspek))
        self.assertEqual(d['csat'], 100.0)
        self.assertEqual(len(d['tren']), 1)
        self.assertEqual(d['tren'][0]['jumlah'], 1)
        self.assertEqual(d['sebaran'][0], {'bintang': 5, 'jumlah': len(self.aspek)})
        self.assertEqual(d['jumlah_catatan'], 0)

    def test_aspek_yang_sudah_dijawab_tidak_bisa_dihapus(self):
        self.publik.post(f'/api/resi/{self.token}/survei/', {'nilai': self.nilai_lengkap(5)}, format='json')
        owner = CustomUser.objects.create_user(username='owner.aspek', password='x12345678', role='owner')
        c = APIClient()
        c.force_authenticate(owner)
        self.assertEqual(c.delete(f'/api/aspek-survei/{self.aspek[0].id}/').status_code, 400)


class UlasanDariSurveiTests(_Dasar):
    def kirim(self, catatan):
        return self.publik.post(f'/api/resi/{self.token}/survei/', {'nilai': self.nilai_lengkap(4), 'catatan': catatan}, format='json')

    def test_saran_survei_otomatis_jadi_ulasan(self):
        from .customer_models import CustomerReview
        self.assertEqual(self.kirim('Hasil cetak tajam').status_code, 201)
        u = CustomerReview.objects.get()
        self.assertEqual((u.sumber, u.rating, u.comment, u.nomor_transaksi), ('survei', 4, 'Hasil cetak tajam', 'POS-RESI-1'))

    def test_survei_tanpa_saran_tidak_jadi_ulasan(self):
        from .customer_models import CustomerReview
        self.kirim('   ')
        self.assertFalse(CustomerReview.objects.exists())

    def test_ulasan_survei_terkunci_dan_hanya_owner_manager_bisa_hapus(self):
        from .customer_models import CustomerReview
        self.kirim('Mantap')
        u = CustomerReview.objects.get()
        kasir = CustomUser.objects.create_user(username='kasir.ulasan', password='x12345678', role='kasir')
        owner = CustomUser.objects.create_user(username='owner.ulasan', password='x12345678', role='owner')
        c = APIClient()
        c.force_authenticate(kasir)
        self.assertEqual(c.patch(f'/api/customer-reviews/{u.id}/', {'comment': 'diubah'}, format='json').status_code, 400)
        self.assertEqual(c.delete(f'/api/customer-reviews/{u.id}/').status_code, 403)
        self.assertEqual(c.post('/api/customer-reviews/', {'rating': 5, 'comment': 'palsu', 'sumber': 'survei'}, format='json').status_code, 400)
        r = c.post('/api/customer-reviews/', {'rating': 5, 'comment': 'Dari Google', 'sumber': 'google'}, format='json')
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()['sumber_display'], 'Google Maps')
        c.force_authenticate(owner)
        self.assertEqual(c.delete(f'/api/customer-reviews/{u.id}/').status_code, 204)
