"""Reorder human error: 50% ditanggung staff, nota tidak ke pelanggan (2026-09-28)."""
import uuid
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from accounting.models import Account, AccountClassification, AccountType, PaymentMethod
from .models import Divisi, Order, OrderItem, TahapProses
from .product_models import Product
from .reorder_models import TanggunganReorder

User = get_user_model()


class ReorderHumanErrorTest(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner_reorder', password='x', role='owner')
        self.kasir = User.objects.create_user(username='kasir_reorder', password='x', role='kasir')
        self.operator = User.objects.create_user(username='operator_salah', password='x', role='staff',
                                                 first_name='Budi')
        self.operator_lain = User.objects.create_user(username='operator_lain', password='x', role='staff')
        self.divisi = Divisi.objects.create(nama='Cetak Reorder')
        TahapProses.objects.create(nama='Cetak', divisi=self.divisi, urutan=1)
        self.produk = Product.objects.create(nama='Banner Reorder', harga_jual_toko=50000, lacak_inventori=False)
        self.asal = Order.objects.create(id='ORD-ASAL-1', nomor_wa='081234567890', nama='Ahmad',
                                         status_global='selesai')
        OrderItem.objects.create(order=self.asal, product=self.produk, jenis_produk='Banner Reorder',
                                 qty=2, harga_jual=100000)
        self.client.force_authenticate(self.kasir)

    def _reorder(self, **extra):
        data = {
            'idempotency_key': str(uuid.uuid4()),
            'nama': 'Ahmad', 'nomor_wa': '081234567890',
            # Harga dari klien sengaja salah: server wajib menghitung ulang 50%.
            'items': [{'product_id': self.produk.id, 'qty': 2, 'harga_satuan': 1, 'is_custom_priced': True}],
            'jumlah_bayar': 2,
            'metode_pembayaran': 'tunai',
            'dilayani_oleh_id': self.kasir.id,
            'jatuh_tempo': str(timezone.localdate()),
            'spk': {'divisi_id': self.divisi.id, 'deadline': str(timezone.localdate())},
            'reorder_dari': self.asal.id,
            'catatan': 'Salah ukuran cetak',
            'penanggung_staff_id': self.operator.id,
            'metode_tanggungan': 'tunai',
        }
        data.update(extra)
        return self.client.post('/api/orders/checkout-pos/', data, format='json')

    @mock.patch('api.services.order_invoice_whatsapp.jadwalkan_invoice_dp_otomatis')
    def test_tunai_50_persen_dihitung_server_dan_tanpa_invoice_pelanggan(self, jadwal):
        res = self._reorder()
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual((order.total_harga, order.dp_dibayar, order.sisa_tagihan), (50000, 50000, 0))
        self.assertEqual((order.nama, order.reorder_dari_id), ('Ahmad', 'ORD-ASAL-1'))
        t = order.tanggungan_reorder
        self.assertEqual((t.staff_id, t.nominal, t.metode, t.status),
                         (self.operator.id, Decimal('50000'), 'tunai', TanggunganReorder.Status.LUNAS))
        jadwal.assert_not_called()

    def test_tanpa_staff_penanggung_ditolak(self):
        res = self._reorder(penanggung_staff_id=None)
        self.assertEqual(res.status_code, 400)
        self.assertIn('staff', res.json()['error'].lower())

    def test_potong_gaji_butuh_metode_akuntansi(self):
        res = self._reorder(metode_tanggungan='potong_gaji')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Potong Gaji', res.json()['error'])
        self.assertFalse(TanggunganReorder.objects.exists())

    def test_potong_gaji_menunggu_dan_tidak_ikut_settlement(self):
        aset = AccountClassification.objects.create(name='Aset Reorder', account_type=AccountType.ASSET,
                                                    code_range_start=10000, code_range_end=19999)
        piutang = Account.objects.create(code='11350', name='Piutang karyawan', classification=aset,
                                         account_type=AccountType.ASSET)
        PaymentMethod.objects.create(name='Potong Gaji Karyawan', payment_type='Potong Gaji', account=piutang)
        res = self._reorder(metode_tanggungan='potong_gaji')
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(pk=res.json()['id'])
        self.assertEqual((order.metode_pembayaran, order.settlement_status), ('Potong Gaji Karyawan', 'not_applicable'))
        self.assertEqual(order.tanggungan_reorder.status, TanggunganReorder.Status.MENUNGGU_POTONG)

    def test_invoice_manual_reorder_tidak_dikirim_ke_pelanggan(self):
        from .services.order_invoice_whatsapp import kirim_invoice_pesanan_whatsapp

        order_id = self._reorder().json()['id']
        hasil = kirim_invoice_pesanan_whatsapp(order_id=order_id)
        self.assertEqual((hasil['ok'], hasil['reason']), (False, 'reorder_human_error'))

    def test_halaman_nota_staff_hanya_miliknya_peninjau_semua(self):
        self._reorder()
        self._reorder(penanggung_staff_id=self.operator_lain.id, idempotency_key=str(uuid.uuid4()))

        self.client.force_authenticate(self.operator)
        data = self.client.get('/api/nota-human-error/', {'bulan': timezone.localdate().strftime('%Y-%m')}).json()
        self.assertFalse(data['peninjau'])
        self.assertEqual([r['staff_nama'] for r in data['hasil']], ['Budi'])
        self.assertEqual(Decimal(str(data['ringkasan']['total'])), Decimal('50000'))

        self.client.force_authenticate(self.owner)
        data = self.client.get('/api/nota-human-error/').json()
        self.assertEqual((data['peninjau'], data['ringkasan']['jumlah']), (True, 2))
        data = self.client.get('/api/nota-human-error/', {'staff_id': self.operator_lain.id}).json()
        self.assertEqual(data['ringkasan']['jumlah'], 1)

    def test_tandai_dipotong_hanya_peninjau_dan_status_menunggu(self):
        t = TanggunganReorder.objects.create(
            order=self.asal, staff=self.operator, nominal=Decimal('50000'), metode='potong_gaji',
            status=TanggunganReorder.Status.MENUNGGU_POTONG, alasan='x',
        )
        self.client.force_authenticate(self.operator)
        self.assertEqual(self.client.post(f'/api/nota-human-error/{t.id}/tandai-dipotong/').status_code, 403)
        self.client.force_authenticate(self.owner)
        res = self.client.post(f'/api/nota-human-error/{t.id}/tandai-dipotong/')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['status'], 'sudah_dipotong')
        self.assertEqual(self.client.post(f'/api/nota-human-error/{t.id}/tandai-dipotong/').status_code, 400)


class TanggunganReorderBridgeTest(APITestCase):
    """Jembatan ke Payroll HR: rekap potong gaji & penandaan otomatis."""
    KEY = 'kunci-reorder'
    HEADERS = {'HTTP_X_API_KEY': 'kunci-reorder', 'HTTP_X_FORWARDED_PROTO': 'https'}

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.budi = User.objects.create_user(username='budi_hr', password='x', role='staff', first_name='Budi',
                                             hr_employee_id=501)
        self.tanpa_hr = User.objects.create_user(username='tanpa_hr', password='x', role='staff')
        n = 0
        for staff, metode, status, nominal in (
            (self.budi, 'potong_gaji', 'menunggu_potong', '50000'),
            (self.budi, 'potong_gaji', 'menunggu_potong', '25000'),
            (self.budi, 'tunai', 'lunas', '99000'),
            (self.tanpa_hr, 'potong_gaji', 'menunggu_potong', '10000'),
        ):
            n += 1
            order = Order.objects.create(id=f'ORD-BRIDGE-{n}', nomor_wa='081234567890', nama='Ahmad')
            TanggunganReorder.objects.create(order=order, staff=staff, nominal=Decimal(nominal), metode=metode,
                                             status=status, alasan='x')
        self.periode = {'tahun': timezone.localdate().year, 'bulan': timezone.localdate().month}

    def _env(self):
        import os
        return mock.patch.dict(os.environ, {'HR_BRIDGE_API_KEY': self.KEY})

    def test_tanpa_kunci_ditolak(self):
        with self._env():
            r = self.client.get('/api/bridge/tanggungan-reorder/', self.periode, HTTP_X_FORWARDED_PROTO='https')
        self.assertIn(r.status_code, (401, 403))

    def test_rekap_hanya_potong_gaji_per_staff(self):
        with self._env():
            r = self.client.get('/api/bridge/tanggungan-reorder/', self.periode, **self.HEADERS)
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertEqual([(s['hr_employee_id'], s['total'], len(s['nota'])) for s in data['staff']], [(501, 75000, 2)])
        self.assertEqual([s['total'] for s in data['staff_tanpa_hr_employee_id']], [10000])

    def test_tandai_dari_hr(self):
        with self._env():
            r = self.client.post('/api/bridge/tanggungan-reorder/tandai/', {**self.periode, 'hr_employee_id': 501},
                                 format='json', **self.HEADERS)
        self.assertEqual((r.status_code, r.json()['ditandai']), (200, 2))
        self.assertEqual(TanggunganReorder.objects.filter(staff=self.budi, status='sudah_dipotong').count(), 2)
        self.assertEqual(TanggunganReorder.objects.get(staff=self.tanpa_hr).status, 'menunggu_potong')
