"""Pesanan sesi foto StarFoto (2026-10-11): kasir -> fotografer (usulan
tambahan) -> kasir (konfirmasi + pilih file) -> editor -> operator cetak."""
import datetime
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from hr.models import Absensi

from . import stock_fifo
from .models import Divisi, JobBoard, Order, SystemConfig, TahapProses, UnitBisnis
from .product_models import Addon, Product, ProductVariant
from .starfoto_models import PaketFoto, PesananFoto, SesiFoto, UsulanTambahan


class _Dasar(APITestCase):
    def setUp(self):
        User = get_user_model()
        self.unit, _ = UnitBisnis.objects.get_or_create(nama='StarFoto')
        div_foto = Divisi.objects.create(nama='Fotografer SF', unit_bisnis=self.unit)
        div_edit = Divisi.objects.create(nama='Editor SF', unit_bisnis=self.unit)
        div_cetak = Divisi.objects.create(nama='Operator SF', unit_bisnis=self.unit)
        self.t_sesi = TahapProses.objects.create(nama='Sesi Foto', divisi=div_foto, urutan=2)
        self.t_asisten = TahapProses.objects.create(nama='Asisten Foto', divisi=div_foto, urutan=2)
        self.t_edit = TahapProses.objects.create(nama='Edit SF', divisi=div_edit, urutan=3)
        self.t_cetak = TahapProses.objects.create(nama='Cetak SF', divisi=div_cetak, urutan=4)
        for kunci, tahap in (('sesi', self.t_sesi), ('asisten', self.t_asisten), ('edit', self.t_edit),
                             ('cetak', self.t_cetak)):
            SystemConfig.objects.create(key=f'starfoto_tahap_{kunci}_id', value=str(tahap.id))

        self.kasir = User.objects.create_user(username='kasir.sf', password='x', role='kasir', unit_bisnis=self.unit)
        self.foto = User.objects.create_user(username='foto.sf', password='x', role='staff', divisi=div_foto)
        self.asisten = User.objects.create_user(username='asisten.sf', password='x', role='staff', divisi=div_foto)
        self.editor = User.objects.create_user(username='editor.sf', password='x', role='staff', divisi=div_edit)
        self.operator = User.objects.create_user(username='operator.sf', password='x', role='staff', divisi=div_cetak)
        self.lain = User.objects.create_user(username='staff.lain', password='x', role='staff')
        for staff in (self.foto, self.asisten, self.editor, self.operator, self.lain):
            Absensi.objects.create(staff=staff, tanggal=timezone.localdate(), jam_masuk=timezone.now(), status='hadir')

        self.produk = Product.objects.create(nama='Family Classic', harga_jual_toko=280000, lacak_inventori=False)
        self.tambah_orang = Addon.objects.create(nama='Tambah Orang Studio', harga=Decimal('10000'))
        self.tambah_orang.applies_to.add(self.produk)
        self.kostum = Addon.objects.create(nama='Tambah Kostum', harga=Decimal('100000'))
        self.kostum.applies_to.add(self.produk)
        self.paket = PaketFoto.objects.create(
            product=self.produk, kuota_orang=6, addon_tambah_orang=self.tambah_orang, jumlah_edit=1,
        )
        self.pigura = Product.objects.create(nama='Pigura 1022', harga_jual_toko=0, lacak_inventori=True)
        self.pigura_8rp = ProductVariant.objects.create(
            product=self.pigura, nama_varian='8RP HS', harga_jual_toko=Decimal('50000'), qty_stok=5,
        )
        stock_fifo.create_layer(self.pigura, self.pigura_8rp, 5, 30000, timezone.localdate())
        self.client.force_authenticate(self.kasir)

    def _checkout(self, orang=7, tambah=1, bayar=150000, **ekstra):
        mulai = (timezone.now() + datetime.timedelta(hours=1)).replace(microsecond=0)
        starfoto = {
            'jenis': 'booking_wa', 'jumlah_orang': orang,
            'fotografer_id': self.foto.id, 'asisten_id': self.asisten.id,
            'sesi': [{'mulai': mulai.isoformat(), 'lokasi': 'studio'}],
        }
        starfoto.update(ekstra)
        item = {'product_id': self.produk.id, 'qty': 1, 'harga_satuan': 1}
        if tambah:
            item['addons'] = [{'id': self.tambah_orang.id, 'qty': tambah}]
        return self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()), 'nama': 'Dinda', 'nomor_wa': '081234567890',
            'items': [item], 'jumlah_bayar': bayar, 'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.kasir.id, 'jatuh_tempo': str(timezone.localdate()), 'starfoto': starfoto,
        }, format='json')

    def _pesanan_siap_konfirmasi(self):
        res = self._checkout()
        self.assertEqual(res.status_code, 201, res.content)
        pesanan = PesananFoto.objects.get(order_id=res.json()['id'])
        sesi = pesanan.sesi.get()
        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/').status_code, 200)
        return pesanan, sesi


class PesananStarfotoTests(_Dasar):
    def test_checkout_membuat_sesi_dan_spk_fotografer_asisten(self):
        res = self._checkout()
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order.total_harga, 290000)  # 280000 + 1 orang x 10000
        pesanan = order.pesanan_foto
        self.assertEqual((pesanan.status, pesanan.jumlah_orang, pesanan.nomor_kantong), ('sesi', 7, '000001'))
        jobs = JobBoard.objects.filter(order_item__order=order)
        self.assertEqual({(j.tahap_id, j.pic_staff_id) for j in jobs},
                         {(self.t_sesi.id, self.foto.id), (self.t_asisten.id, self.asisten.id)})

    def test_dp_minimal_dan_tambah_orang_ditegakkan_server(self):
        res = self._checkout(bayar=100000)  # 50% x 290000 = 145000
        self.assertEqual(res.status_code, 400)
        self.assertIn('DP minimal Rp145.000', str(res.content))
        res = self._checkout(tambah=0, bayar=280000)
        self.assertEqual(res.status_code, 400)
        self.assertIn('Tambah Orang Studio sebanyak 1', res.json()['error'])
        self.assertFalse(Order.objects.exists())  # seluruh checkout dibatalkan

    def test_jadwal_studio_bentrok_ditolak(self):
        mulai = timezone.now() + datetime.timedelta(hours=1)
        self.assertEqual(self._checkout(sesi=[{'mulai': mulai.isoformat()}]).status_code, 201)
        res = self._checkout(sesi=[{'mulai': (mulai + datetime.timedelta(minutes=10)).isoformat()}])
        self.assertEqual(res.status_code, 400)
        self.assertIn('bentrok', res.json()['error'])

    def test_alur_lengkap_sampai_siap_diambil(self):
        pesanan, sesi = self._pesanan_siap_konfirmasi()
        order = pesanan.order
        # Usulan fotografer belum mengubah tagihan.
        r1 = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/usulan/',
                              {'addon_id': self.kostum.id, 'qty': 1}, format='json')
        r2 = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/usulan/',
                              {'product_id': self.pigura.id, 'variant_id': self.pigura_8rp.id, 'qty': 1}, format='json')
        r3 = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/usulan/',
                              {'addon_id': self.tambah_orang.id, 'qty': 2}, format='json')
        self.assertEqual([r.status_code for r in (r1, r2, r3)], [201, 201, 201], r2.content)
        order.refresh_from_db()
        self.assertEqual(order.total_harga, 290000)

        # Papan kerja tidak boleh menyelesaikan SPK sesi.
        job_sesi = JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_sesi)
        self.assertEqual(self.client.post(f'/api/jobs/{job_sesi.id}/complete/').status_code, 400)
        # ...termasuk lewat tombol Teruskan/Selesai (forward) -- celah yang dipakai 2026-10-14.
        for data in ({'aksi': 'selesai'}, {'aksi': 'forward', 'tahap_id': self.t_edit.id}):
            self.assertEqual(self.client.post(f'/api/jobs/{job_sesi.id}/forward/', data, format='json').status_code, 400)
        job_sesi.refresh_from_db()
        self.assertNotEqual(job_sesi.status_pekerjaan, 'selesai')
        self.assertFalse(JobBoard.objects.filter(order_item=pesanan.paket_item, tahap=self.t_edit).exists())

        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/').status_code, 200)
        pesanan.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(pesanan.status, 'menunggu_kasir')
        self.assertNotEqual(order.status_global, 'ready')
        self.assertFalse(JobBoard.objects.filter(order_item__order=order, status_pekerjaan__in=['antrean', 'dikerjakan']).exists())

        # Kasir mengonfirmasi: kostum & pigura disetujui, tambah orang ditolak.
        self.client.force_authenticate(self.kasir)
        res = self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/konfirmasi/', {
            'usulan': [
                {'id': r1.json()['id'], 'setuju': True},
                {'id': r2.json()['id'], 'setuju': True},
                {'id': r3.json()['id'], 'setuju': False, 'alasan': 'Batal'},
            ],
            'pilihan_file': [{'nomor_file': '0007', 'peruntukan': 'Edit + cetak 8RP', 'catatan': 'cerahkan'}],
            'spk': {'deadline': str(timezone.localdate() + datetime.timedelta(days=3)), 'deadline_jam': '17:00'},
        }, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        order.refresh_from_db()
        self.assertEqual(order.total_harga, 290000 + 100000 + 50000)
        self.assertEqual(order.sisa_tagihan, 440000 - 150000)
        self.pigura_8rp.refresh_from_db()
        self.assertEqual(self.pigura_8rp.qty_stok, Decimal('4'))
        self.assertEqual(UsulanTambahan.objects.get(pk=r3.json()['id']).status, 'ditolak')
        self.assertEqual(pesanan.pilihan_file.get().catatan, 'cerahkan')

        # SPK hanya Edit (item paket); pigura tanpa produksi; tidak kembali ke fotografer.
        aktif = JobBoard.objects.filter(order_item__order=order, status_pekerjaan='antrean')
        self.assertEqual([(j.tahap_id, j.order_item_id) for j in aktif], [(self.t_edit.id, pesanan.paket_item_id)])

        # Usulan setelah konfirmasi ditolak.
        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/usulan/',
                                          {'addon_id': self.kostum.id}, format='json').status_code, 400)

        # SPK Edit pesanan foto tidak ditutup dari papan kerja: wajib lewat
        # Edit Foto (pratinjau + approval pelanggan, lihat tests_starfoto_approval).
        job_edit = aktif.get()
        job_edit.pic_staff = self.editor
        job_edit.status_pekerjaan = 'dikerjakan'
        job_edit.save()
        self.client.force_authenticate(self.editor)
        res = self.client.post(f'/api/jobs/{job_edit.id}/complete/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Edit Foto', str(res.content))

    def test_order_tidak_bisa_diselesaikan_sebelum_sesi_dikonfirmasi(self):
        pesanan, sesi = self._pesanan_siap_konfirmasi()
        url = f'/api/orders/{pesanan.order_id}/selesaikan/'
        self.client.force_authenticate(self.kasir)
        res = self.client.post(url, {}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('belum selesai', res.json()['error'])
        self.client.force_authenticate(self.foto)
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/')
        self.client.force_authenticate(self.kasir)
        res = self.client.post(url, {}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('belum dikonfirmasi', res.json()['error'])
        self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/konfirmasi/', {
            'pilihan_file': [{'nomor_file': '0001'}],
            'spk': {'deadline': str(timezone.localdate()), 'deadline_jam': '17:00'},
        }, format='json')
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 200)

    def test_sesi_saya_mendatang_tampil_dengan_jadwalnya(self):
        lusa = (timezone.now() + datetime.timedelta(days=2)).replace(microsecond=0)
        res = self._checkout(sesi=[{'mulai': lusa.isoformat(), 'lokasi': 'studio'}])
        self.assertEqual(res.status_code, 201, res.content)
        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.get('/api/starfoto/sesi-saya/').json(), [])
        data = self.client.get('/api/starfoto/sesi-saya/', {'mendatang': 1}).json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['mulai'][:10], str(timezone.localtime(lusa).date()))

    def test_hak_akses(self):
        pesanan, sesi = self._pesanan_siap_konfirmasi()
        self.client.force_authenticate(self.lain)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/').status_code, 403)
        self.assertEqual(self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/usulan/',
                                          {'addon_id': self.kostum.id}, format='json').status_code, 404)
        daftar = self.client.get('/api/starfoto/pesanan/').json()
        self.assertEqual(daftar['results'] if isinstance(daftar, dict) else daftar, [])
        self.client.force_authenticate(self.foto)
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/')
        self.assertEqual(self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/konfirmasi/', {}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/starfoto/sesi-saya/').status_code, 200)
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.patch('/api/starfoto/pengaturan/', {'dp_minimal_persen': 30}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/starfoto/jadwal/').status_code, 200)

    def test_konfirmasi_wajib_putuskan_usulan_dan_pilih_file(self):
        pesanan, sesi = self._pesanan_siap_konfirmasi()
        self.client.post(f'/api/starfoto/pesanan/{pesanan.id}/usulan/', {'addon_id': self.kostum.id}, format='json')
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/')
        self.client.force_authenticate(self.kasir)
        url = f'/api/starfoto/pesanan/{pesanan.id}/konfirmasi/'
        spk = {'deadline': str(timezone.localdate())}
        res = self.client.post(url, {'pilihan_file': [{'nomor_file': '1'}], 'spk': spk}, format='json')
        self.assertIn('Putuskan dulu', res.json()['error'])
        usulan_id = pesanan.usulan.get().id
        res = self.client.post(url, {'usulan': [{'id': usulan_id, 'setuju': False}], 'spk': spk}, format='json')
        self.assertIn('minimal satu file', res.json()['error'])
        self.assertEqual(PesananFoto.objects.get(pk=pesanan.pk).status, 'menunggu_kasir')


class KantongTests(_Dasar):
    def test_kantong_otomatis_berurutan_dan_manual_tidak_boleh_dobel(self):
        SystemConfig.objects.create(key='starfoto_kantong_terakhir', value='018594')
        self.assertEqual(self.client.get('/api/starfoto/pengaturan/').json()['kantong_berikutnya'], '018595')
        self.assertEqual(self._checkout().status_code, 201)
        jam = timezone.now() + datetime.timedelta(hours=3)
        self.assertEqual(self._checkout(sesi=[{'mulai': jam.isoformat()}]).status_code, 201)
        self.assertEqual(sorted(PesananFoto.objects.values_list('nomor_kantong', flat=True)), ['018595', '018596'])
        res = self._checkout(nomor_kantong='018596', sesi=[{'mulai': (jam + datetime.timedelta(hours=2)).isoformat()}])
        self.assertIn('sudah dipakai', res.json()['error'])


class PengaturanStarfotoTests(_Dasar):
    def test_owner_mengatur_dp_dan_validasi(self):
        owner = get_user_model().objects.create_user(username='owner.sf', password='x', role='owner')
        self.client.force_authenticate(owner)
        res = self.client.patch('/api/starfoto/pengaturan/', {'dp_minimal_persen': '30', 'uang_transport': True}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual((float(res.json()['dp_minimal_persen']), res.json()['uang_transport']), (30.0, True))
        self.assertEqual(self.client.patch('/api/starfoto/pengaturan/', {'dp_minimal_persen': 120}, format='json').status_code, 400)
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self._checkout(bayar=87000).status_code, 201)  # 30% x 290000

    def test_paket_hanya_produk_jasa(self):
        owner = get_user_model().objects.create_user(username='owner.sf2', password='x', role='owner')
        self.client.force_authenticate(owner)
        res = self.client.post('/api/starfoto/paket/', {'product': self.pigura.id, 'kuota_orang': 2}, format='json')
        self.assertEqual(res.status_code, 400)
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.get('/api/starfoto/paket/').status_code, 200)
        self.assertEqual(self.client.post('/api/starfoto/paket/', {}, format='json').status_code, 403)
        self.assertEqual(SesiFoto.objects.count(), 0)


class KlaimGlobalSesiTests(_Dasar):
    def _pesanan_tanpa_petugas(self):
        res = self._checkout(fotografer_id=None, asisten_id=None, butuh_asisten=True)
        self.assertEqual(res.status_code, 201, res.content)
        return PesananFoto.objects.get(order_id=res.json()['id'])

    def test_fotografer_klaim_dari_antrean_jadi_pic(self):
        pesanan = self._pesanan_tanpa_petugas()
        sesi = pesanan.sesi.get()
        self.assertTrue(all(j.pic_staff_id is None for j in JobBoard.objects.filter(order_item=pesanan.paket_item)))

        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/').status_code, 400)  # belum diklaim
        antrean = self.client.get('/api/starfoto/antrean-sesi/').json()
        self.assertEqual(sorted(r['peran'] for r in antrean), ['asisten', 'fotografer'])
        url = f'/api/starfoto/antrean-sesi/{pesanan.id}/klaim/'
        self.assertEqual(self.client.post(url, {'peran': 'fotografer'}, format='json').status_code, 200)
        sesi.refresh_from_db()
        self.assertEqual(sesi.fotografer, self.foto)
        self.assertEqual(JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_sesi).pic_staff, self.foto)
        self.assertEqual(self.client.post(url, {'peran': 'asisten'}, format='json').status_code, 400)

        # Fotografer lain tidak bisa merebut; asisten mengambil peran asisten.
        self.client.force_authenticate(self.asisten)
        res = self.client.post(url, {'peran': 'fotografer'}, format='json')
        self.assertIn('sudah diambil oleh foto.sf', res.json()['error'])
        self.assertEqual([r['peran'] for r in self.client.get('/api/starfoto/antrean-sesi/').json()], ['asisten'])
        self.assertEqual(self.client.post(url, {'peran': 'asisten'}, format='json').status_code, 200)
        self.assertEqual(self.client.get('/api/starfoto/antrean-sesi/').json(), [])

        # Divisi lain ditolak; fotografer bisa memulai sesi.
        self.client.force_authenticate(self.editor)
        self.assertEqual(self.client.post(url, {'peran': 'fotografer'}, format='json').status_code, 403)
        self.client.force_authenticate(self.foto)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/').status_code, 200)

    def test_klaim_lewat_papan_kerja_ikut_mengisi_sesi(self):
        pesanan = self._pesanan_tanpa_petugas()
        job = JobBoard.objects.get(order_item=pesanan.paket_item, tahap=self.t_asisten)
        self.client.force_authenticate(self.asisten)
        self.assertEqual(self.client.post(f'/api/jobs/{job.id}/claim/').status_code, 200)
        self.assertEqual(pesanan.sesi.get().asisten, self.asisten)


class StatusPesananFotoUntukPelangganTests(_Dasar):
    """Resi online & tracking WA tidak menampilkan "Dalam Proses Produksi" sebelum
    sesi foto selesai dan dikonfirmasi kasir (2026-10-14)."""

    def test_status_mengikuti_tahap_sesi(self):
        from .services.resi_digital import _status_pesanan
        from .wa_logic import format_tracking

        res = self._checkout()
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order.status_global, 'proses')
        self.assertTrue(_status_pesanan(order).startswith('Menunggu Sesi Foto'))
        teks = format_tracking(order)
        self.assertIn('Menunggu Sesi Foto', teks)
        self.assertNotIn('Dalam Proses Produksi', teks)
        self.assertIn('Menunggu sesi foto', teks)

        sesi = order.pesanan_foto.sesi.get()
        self.client.force_authenticate(self.foto)
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/')
        self.assertEqual(_status_pesanan(order), 'Sesi Foto Berlangsung')
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/selesai/')
        self.assertEqual(_status_pesanan(order), 'Sesi Foto Selesai')

        # Setelah kasir mengonfirmasi, pesanan masuk produksi (edit/cetak).
        from .starfoto_models import PesananFoto
        PesananFoto.objects.filter(pk=order.pesanan_foto.pk).update(status='dikonfirmasi')
        self.assertEqual(_status_pesanan(order), 'Dalam Proses Produksi')


class SesiTerlewatTests(_Dasar):
    """Sesi terjadwal yang lewat waktunya: notifikasi, dijalankan, atau dijadwal ulang (2026-10-19)."""

    def _sesi_terlewat(self):
        res = self._checkout()
        self.assertEqual(res.status_code, 201, res.content)
        sesi = PesananFoto.objects.get(order_id=res.json()['id']).sesi.get()
        lewat = timezone.now() - datetime.timedelta(days=1)
        SesiFoto.objects.filter(pk=sesi.pk).update(mulai=lewat)
        sesi.refresh_from_db()
        return sesi

    def _daftar(self, user):
        self.client.force_authenticate(user)
        res = self.client.get('/api/starfoto/sesi-terlewat/')
        self.assertEqual(res.status_code, 200, res.content)
        return res.json()

    def test_notifikasi_untuk_petugas_dan_kasir_bukan_orang_lain(self):
        sesi = self._sesi_terlewat()
        self.assertEqual([s['id'] for s in self._daftar(self.foto)], [sesi.id])
        self.assertGreaterEqual(self._daftar(self.foto)[0]['terlewat_menit'], 60)
        self.assertEqual([s['id'] for s in self._daftar(self.kasir)], [sesi.id])
        self.assertEqual(self._daftar(self.lain), [])

    def test_sesi_di_masa_depan_tidak_dianggap_terlewat(self):
        self.assertEqual(self._checkout().status_code, 201)
        self.assertEqual(self._daftar(self.foto), [])

    def test_sesi_terlewat_tampil_di_sesi_saya_dan_bisa_dijalankan(self):
        sesi = self._sesi_terlewat()
        self.client.force_authenticate(self.foto)
        ids = [s['id'] for s in self.client.get('/api/starfoto/sesi-saya/?mendatang=1').json()]
        self.assertIn(sesi.id, ids)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/').status_code, 200)
        self.assertEqual(self._daftar(self.foto), [])

    def test_ubah_jadwal_menggeser_deadline_spk(self):
        sesi = self._sesi_terlewat()
        baru = (timezone.now() + datetime.timedelta(days=2)).replace(microsecond=0)
        self.client.force_authenticate(self.foto)
        res = self.client.post(f'/api/starfoto/sesi/{sesi.id}/jadwal/', {'mulai': baru.isoformat()}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        sesi.refresh_from_db()
        self.assertEqual(sesi.mulai, baru)
        job = JobBoard.objects.get(order_item=sesi.pesanan.paket_item, tahap=self.t_sesi)
        self.assertEqual(job.deadline, timezone.localtime(baru).date())
        self.assertEqual(self._daftar(self.foto), [])

    def test_ubah_jadwal_ke_waktu_lampau_ditolak(self):
        sesi = self._sesi_terlewat()
        self.client.force_authenticate(self.kasir)
        lampau = (timezone.now() - datetime.timedelta(hours=3)).isoformat()
        res = self.client.post(f'/api/starfoto/sesi/{sesi.id}/jadwal/', {'mulai': lampau}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_ubah_jadwal_hanya_petugas_atau_kasir_dan_sesi_belum_mulai(self):
        sesi = self._sesi_terlewat()
        baru = (timezone.now() + datetime.timedelta(days=1)).isoformat()
        self.client.force_authenticate(self.lain)
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/jadwal/', {'mulai': baru}, format='json').status_code, 403)
        self.client.force_authenticate(self.foto)
        self.client.post(f'/api/starfoto/sesi/{sesi.id}/mulai/')
        self.assertEqual(self.client.post(f'/api/starfoto/sesi/{sesi.id}/jadwal/', {'mulai': baru}, format='json').status_code, 400)


class UnitPesananKasirTests(_Dasar):
    """Pesanan kasir milik unit kasir walau pelayannya staff unit lain (2026-10-21)."""

    def test_pelayan_unit_lain_tidak_memindahkan_pesanan_dari_kasir(self):
        adv, _ = UnitBisnis.objects.get_or_create(nama='Star Advertising Uji')
        pelayan = get_user_model().objects.create_user(username='editor.adv', password='x', role='staff', unit_bisnis=adv)
        res = self._checkout()
        self.assertEqual(res.status_code, 201, res.content)
        Order.objects.filter(pk=res.json()['id']).update(unit_bisnis=None)  # pastikan diuji dari awal
        mulai = (timezone.now() + datetime.timedelta(hours=5)).replace(microsecond=0)
        item = {'product_id': self.produk.id, 'qty': 1, 'harga_satuan': 1, 'addons': [{'id': self.tambah_orang.id, 'qty': 1}]}
        res = self.client.post('/api/orders/checkout-pos/', {
            'idempotency_key': str(uuid.uuid4()), 'nama': 'Rani', 'nomor_wa': '081200000001',
            'items': [item], 'jumlah_bayar': 150000, 'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': pelayan.id, 'jatuh_tempo': str(timezone.localdate()),
            'starfoto': {'jenis': 'booking_wa', 'jumlah_orang': 7, 'fotografer_id': self.foto.id,
                         'sesi': [{'mulai': mulai.isoformat(), 'lokasi': 'studio'}]},
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual(order.unit_bisnis_id, self.unit.id)
        data = self.client.get('/api/starfoto/pesanan/').json()
        ids = [p['order'] for p in (data['results'] if isinstance(data, dict) else data)]
        self.assertIn(order.id, ids)
