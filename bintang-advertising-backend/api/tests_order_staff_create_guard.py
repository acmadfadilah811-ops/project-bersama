"""Regresi: POST /api/orders/ TIDAK membatasi status_global/dp_dibayar/
dilayani_oleh sama sekali -- OrderViewSet.permission_classes cuma
IsAuthenticated, dan perform_create() sebelumnya hanya memvalidasi format
nomor WA & keberadaan dilayani_oleh, tidak pernah membatasi field uang/status
berdasarkan role. Kalau staff diberi akses membuat order (fitur "Buat Order"
untuk membantu kasir saat ramai, 2026-09-06), staff yang nakal/salah pakai
bisa langsung POST status_global='selesai' & dp_dibayar bebas, melewati
verifikasi kasir sepenuhnya -- sama persis dengan celah status_global yang
sudah ditutup untuk PATCH (lihat tests_order_patch_status_guard.py), sekarang
versi CREATE-nya.

Diperbaiki dengan memaksa sumber='staff', dilayani_oleh=diri sendiri,
status_global='review', dp_dibayar=0, diskon_persen=0, metode_diskon=
'tidak_ada' di perform_create() saat request.user.role == 'staff',
mengabaikan apa pun yang dikirim client. Role lain (owner/manager/admin/
kasir) tidak terdampak.
"""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from api.models import Order, OrderItem

User = get_user_model()


class OrderStaffCreateGuardTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_user(username='staff_create_guard', password='pw12345', role='staff')
        self.owner = User.objects.create_user(username='owner_create_guard', password='pw12345', role='owner')
        self.kasir = User.objects.create_user(username='kasir_create_guard', password='pw12345', role='kasir')

    def test_staff_tidak_bisa_langsung_set_status_selesai_dan_dp(self):
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234567890',
            'nama': 'Pelanggan Walk-in',
            'status_global': 'selesai',
            'dp_dibayar': 999999,
            'sumber': 'pos',
            'diskon_persen': 50,
            'metode_diskon': 'kupon',
        })
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.status_global, 'review')
        self.assertEqual(order.dp_dibayar, 0)
        self.assertEqual(order.diskon_persen, 0)
        self.assertEqual(order.metode_diskon, 'tidak_ada')
        self.assertEqual(order.sumber, 'staff')

    def test_staff_dilayani_oleh_selalu_diri_sendiri_walau_kirim_orang_lain(self):
        other_staff = User.objects.create_user(username='staff_lain_create_guard', password='pw12345', role='staff')
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234567891',
            'nama': 'Pelanggan Walk-in 2',
            'dilayani_oleh': other_staff.id,
        })
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.dilayani_oleh_id, self.staff.id)

    def test_staff_tidak_perlu_kirim_dilayani_oleh_sama_sekali(self):
        """Beda dari role lain: perform_create biasanya menolak order tanpa
        dilayani_oleh -- staff dikecualikan karena selalu dipaksa ke diri
        sendiri sebelum validasi itu berjalan."""
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234567892',
            'nama': 'Pelanggan Walk-in 3',
        })
        self.assertEqual(res.status_code, 201, res.content)

    def test_owner_tetap_bisa_set_status_dan_dp_bebas(self):
        """Perilaku existing untuk role selain staff tidak berubah."""
        self.client.force_authenticate(user=self.owner)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234567893',
            'nama': 'Pelanggan Owner',
            'status_global': 'quotation',
            'dp_dibayar': 50000,
            'dilayani_oleh': self.owner.id,
        })
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.status_global, 'quotation')
        self.assertEqual(order.dp_dibayar, 50000)
        self.assertEqual(order.sumber, 'manual')

    def test_kasir_tetap_bisa_set_status_dan_dp_bebas(self):
        self.client.force_authenticate(user=self.kasir)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234567894',
            'nama': 'Pelanggan Kasir',
            'status_global': 'review',
            'dp_dibayar': 25000,
            'dilayani_oleh': self.kasir.id,
        })
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.dp_dibayar, 25000)


class OrderItemStaffWriteGuardTests(APITestCase):
    """OrderItemViewSet._ensure_write_role() sebelumnya memblokir role
    'staff' TOTAL dari membuat item order -- kalau tidak dikecualikan
    secara sempit, fitur "Buat Order" staff akan gagal total di langkah
    kedua (order header berhasil dibuat, tapi POST /order-items/ ditolak
    403). Dikecualikan HANYA untuk item di order milik staff itu sendiri
    (sumber='staff', dilayani_oleh=diri sendiri, status_global='review')."""

    def setUp(self):
        self.staff = User.objects.create_user(username='staff_item_guard', password='pw12345', role='staff')
        self.staff_lain = User.objects.create_user(username='staff_item_guard_lain', password='pw12345', role='staff')
        self.kasir = User.objects.create_user(username='kasir_item_guard', password='pw12345', role='kasir')

    def _buat_order_staff(self, order_id, dilayani_oleh, status_global='review', sumber='staff'):
        return Order.objects.create(
            id=order_id, nomor_wa='08123456789', nama='Pelanggan Item Guard',
            dilayani_oleh=dilayani_oleh, status_global=status_global, sumber=sumber,
        )

    def test_staff_bisa_tambah_item_ke_order_review_miliknya_sendiri(self):
        order = self._buat_order_staff('ORD-ITEMGUARD-1', self.staff)
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Banner Custom', 'qty': 1, 'harga_jual': 50000,
        })
        self.assertEqual(res.status_code, 201, res.content)

    def test_staff_tidak_bisa_tambah_item_ke_order_staff_lain(self):
        order = self._buat_order_staff('ORD-ITEMGUARD-2', self.staff_lain)
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Banner Custom', 'qty': 1, 'harga_jual': 50000,
        })
        self.assertEqual(res.status_code, 403, res.content)

    def test_staff_tidak_bisa_tambah_item_setelah_order_diproses_kasir(self):
        """Begitu kasir mulai memproses (status bukan lagi 'review'), staff
        tidak boleh lagi ikut mengubah item -- mencegah race condition
        dengan verifikasi harga kasir."""
        order = self._buat_order_staff('ORD-ITEMGUARD-3', self.staff, status_global='desain')
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Banner Custom', 'qty': 1, 'harga_jual': 50000,
        })
        self.assertEqual(res.status_code, 403, res.content)

    def test_staff_tidak_bisa_tambah_item_ke_order_sumber_wa(self):
        order = self._buat_order_staff('ORD-ITEMGUARD-4', self.staff, sumber='wa')
        self.client.force_authenticate(user=self.staff)
        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Banner Custom', 'qty': 1, 'harga_jual': 50000,
        })
        self.assertEqual(res.status_code, 403, res.content)

    def test_kasir_tetap_bisa_tambah_item_ke_order_manapun(self):
        order = self._buat_order_staff('ORD-ITEMGUARD-5', self.staff)
        self.client.force_authenticate(user=self.kasir)
        res = self.client.post('/api/order-items/', {
            'order': order.id, 'jenis_produk': 'Banner Custom', 'qty': 1, 'harga_jual': 50000,
        })
        self.assertEqual(res.status_code, 201, res.content)

    def test_staff_tidak_bisa_hapus_item_order_orang_lain(self):
        """get_queryset() OrderItemViewSet untuk staff hanya menampilkan item
        pada order dengan job yang jadi tanggung jawabnya (pic_staff) --
        item order staff lain tidak pernah terlihat sama sekali, jadi
        responsnya 404 (bukan 403), tetap sama-sama tidak bisa diakses."""
        order = self._buat_order_staff('ORD-ITEMGUARD-6', self.staff_lain)
        item = OrderItem.objects.create(order=order, jenis_produk='Banner', qty=1, harga_jual=10000)
        self.client.force_authenticate(user=self.staff)
        res = self.client.delete(f'/api/order-items/{item.id}/')
        self.assertEqual(res.status_code, 404, res.content)
