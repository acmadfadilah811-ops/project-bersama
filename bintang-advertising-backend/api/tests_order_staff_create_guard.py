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

import datetime

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


class OrderSpvKordivCreateGuardTests(APITestCase):
    """SPV & Kordiv juga punya menu "Buat Order" (Sidebar.jsx menuSpvKordiv,
    StaffCreateOrderPanel.jsx dipasang sama seperti staff) -- perform_create()
    mengecualikan role in ('staff', 'spv', 'kordiv') sekaligus (bukan cuma
    'staff'), tapi sebelumnya cuma role 'staff' yang diuji eksplisit di file
    ini. Order offline SPV/Kordiv harus masuk antrean gabungan
    "Antrean Online & Offline" (?sumber=wa,staff) persis seperti staff,
    dengan dilayani_oleh_nama tercatat sesuai pembuatnya masing-masing
    (verifikasi diminta user 2026-09-22)."""

    def test_spv_order_masuk_sumber_staff_dengan_nama_pembuat_benar(self):
        spv = User.objects.create_user(
            username='spv_create_guard', password='pw12345', role='spv',
            first_name='Budi', last_name='Spv',
        )
        self.client.force_authenticate(user=spv)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234500001', 'nama': 'Pelanggan SPV',
            'status_global': 'selesai', 'dp_dibayar': 999999,
        })
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.sumber, 'staff')
        self.assertEqual(order.dilayani_oleh_id, spv.id)
        self.assertEqual(order.status_global, 'review')
        self.assertEqual(order.dp_dibayar, 0)

        # Muncul di antrean gabungan Online & Offline, dengan nama pembuat.
        owner = User.objects.create_user(username='owner_spv_guard', password='pw12345', role='owner')
        self.client.force_authenticate(user=owner)
        res_list = self.client.get('/api/orders/', {'sumber': 'wa,staff'})
        row = next(r for r in res_list.data if r['id'] == order.id)
        self.assertEqual(row['dilayani_oleh_nama'], 'Budi Spv')

    def test_kordiv_order_masuk_sumber_staff_dengan_nama_pembuat_benar(self):
        kordiv = User.objects.create_user(
            username='kordiv_create_guard', password='pw12345', role='kordiv',
            first_name='Sari', last_name='Kordiv',
        )
        self.client.force_authenticate(user=kordiv)
        res = self.client.post('/api/orders/', {
            'nomor_wa': '081234500002', 'nama': 'Pelanggan Kordiv',
            'diskon_persen': 50, 'metode_diskon': 'kupon',
        })
        self.assertEqual(res.status_code, 201, res.content)
        order = Order.objects.get(id=res.data['id'])
        self.assertEqual(order.sumber, 'staff')
        self.assertEqual(order.dilayani_oleh_id, kordiv.id)
        self.assertEqual(order.diskon_persen, 0)
        self.assertEqual(order.metode_diskon, 'tidak_ada')

        owner = User.objects.create_user(username='owner_kordiv_guard', password='pw12345', role='owner')
        self.client.force_authenticate(user=owner)
        res_list = self.client.get('/api/orders/', {'sumber': 'wa,staff'})
        row = next(r for r in res_list.data if r['id'] == order.id)
        self.assertEqual(row['dilayani_oleh_nama'], 'Sari Kordiv')

    def test_spv_dan_kordiv_bisa_menambah_item_ke_order_offline_miliknya(self):
        """Reproduksi bug user 2026-09-22: order header berhasil dibuat utk
        SPV/Kordiv (perform_create sudah benar), tapi POST /order-items/
        berikutnya (langkah wajib ke-2 di StaffCreateOrderPanel.jsx) SELALU
        ditolak 403 utk kedua role itu -- OrderItemViewSet._ensure_write_role()
        sebelumnya cuma mengecualikan role == 'staff' persis, bukan
        role in ('staff', 'spv', 'kordiv'). Order jadi tidak pernah bisa
        selesai dibuat lewat UI sama sekali utk akun SPV/Kordiv."""
        for role, username in (('spv', 'spv_item_guard'), ('kordiv', 'kordiv_item_guard')):
            user = User.objects.create_user(username=username, password='pw12345', role=role)
            self.client.force_authenticate(user=user)

            res_order = self.client.post('/api/orders/', {
                'nomor_wa': '081234500099', 'nama': f'Pelanggan {role.upper()} Item',
            })
            self.assertEqual(res_order.status_code, 201, res_order.content)
            order_id = res_order.data['id']

            res_item = self.client.post('/api/order-items/', {
                'order': order_id, 'jenis_produk': 'Banner Custom', 'qty': 1, 'harga_jual': 75000,
            })
            self.assertEqual(res_item.status_code, 201, f"role={role}: {res_item.content}")


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


class OrderSumberMultiFilterTests(APITestCase):
    """GET /api/orders/?sumber=wa,staff -- antrean kasir "Antrean Online &
    Offline" menyatukan order WA & order dibantu staff dalam satu daftar
    (fitur 2026-09-06). Sebelumnya param `sumber` cuma menerima satu nilai
    persis (exact match)."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner_sumber_multi', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        Order.objects.create(id='ORD-SUMBERMULTI-WA', nomor_wa='08111111111', nama='Order WA', sumber='wa')
        Order.objects.create(id='ORD-SUMBERMULTI-STAFF', nomor_wa='08222222222', nama='Order Staff', sumber='staff')
        Order.objects.create(id='ORD-SUMBERMULTI-POS', nomor_wa='08333333333', nama='Order POS', sumber='pos')

    def test_sumber_gabungan_menyaring_dua_nilai_sekaligus(self):
        res = self.client.get('/api/orders/', {'sumber': 'wa,staff'})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn('ORD-SUMBERMULTI-WA', ids)
        self.assertIn('ORD-SUMBERMULTI-STAFF', ids)
        self.assertNotIn('ORD-SUMBERMULTI-POS', ids)

    def test_sumber_tunggal_tetap_bekerja_seperti_sebelumnya(self):
        res = self.client.get('/api/orders/', {'sumber': 'pos'})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn('ORD-SUMBERMULTI-POS', ids)
        self.assertNotIn('ORD-SUMBERMULTI-WA', ids)


class OrderDateFilterTests(APITestCase):
    """GET /api/orders/?date_from=&date_to= -- nama param sama dengan
    POSSaleViewSet (api/pos_views.py) supaya konsisten. Dipakai filter
    per-tanggal di Antrean Online & Offline & Riwayat Transaksi, volume
    order advertising bisa ~100/hari (fitur 2026-09-06)."""

    def setUp(self):
        from django.utils import timezone
        self.owner = User.objects.create_user(username='owner_date_filter', password='pw12345', role='owner')
        self.client.force_authenticate(user=self.owner)
        self.hari_ini = timezone.now()
        self.order_hari_ini = Order.objects.create(
            id='ORD-DATEFILTER-TODAY', nomor_wa='08144444444', nama='Order Hari Ini',
            waktu=self.hari_ini,
        )
        self.order_lama = Order.objects.create(
            id='ORD-DATEFILTER-OLD', nomor_wa='08155555555', nama='Order Lama',
            waktu=self.hari_ini - datetime.timedelta(days=10),
        )

    def test_date_from_menyaring_order_lama(self):
        tanggal = self.hari_ini.strftime('%Y-%m-%d')
        res = self.client.get('/api/orders/', {'date_from': tanggal})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn('ORD-DATEFILTER-TODAY', ids)
        self.assertNotIn('ORD-DATEFILTER-OLD', ids)

    def test_tanpa_date_filter_semua_tetap_tampil(self):
        res = self.client.get('/api/orders/')
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn('ORD-DATEFILTER-TODAY', ids)
        self.assertIn('ORD-DATEFILTER-OLD', ids)
