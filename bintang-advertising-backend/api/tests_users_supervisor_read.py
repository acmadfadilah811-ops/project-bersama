"""Regresi: GET /api/users/ selalu 403 total untuk SPV/Kordiv (permission
class CustomUserViewSet cuma mengizinkan owner/manager/admin), sehingga
dropdown pemilihan staff di SpkPublishModal/ForwardJobModal selalu kosong
untuk kedua role itu -- Kordiv tidak pernah bisa memilih staff bawahan
sendiri saat menugaskan SPK (dilaporkan user 2026-09-23).

Diperbaiki: CustomUserViewSet sekarang pakai
IsOwnerManagerAdminOrSupervisorReadOnly (izinkan GET untuk spv/kordiv) +
get_queryset() membatasi hasil SPV/Kordiv ke bawahannya sendiri saja
(get_subordinate_user_ids, rekursif via CustomUser.atasan) -- bukan seluruh
direktori karyawan. Write (POST/PATCH/DELETE) tetap hanya owner/manager/
admin, tidak berubah (lihat CustomUserViewSet.check_permissions()).
"""
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class SupervisorReadOnlyUserListTests(APITestCase):
    def setUp(self):
        self.kordiv = User.objects.create_user(username='kordiv_sup_read', password='pw12345', role='kordiv')
        self.staff_bawahan = User.objects.create_user(
            username='staff_bawahan_sup_read', password='pw12345', role='staff', atasan=self.kordiv,
        )
        self.staff_lain_kordiv = User.objects.create_user(username='kordiv_lain_sup_read', password='pw12345', role='kordiv')
        self.staff_bukan_bawahan = User.objects.create_user(
            username='staff_bukan_bawahan_sup_read', password='pw12345', role='staff', atasan=self.staff_lain_kordiv,
        )
        self.spv = User.objects.create_user(username='spv_sup_read', password='pw12345', role='spv')
        self.staff_polos = User.objects.create_user(username='staff_polos_sup_read', password='pw12345', role='staff')

    def test_kordiv_bisa_get_users_hanya_lihat_bawahan_sendiri(self):
        self.client.force_authenticate(user=self.kordiv)
        res = self.client.get('/api/users/', {'role': 'staff'})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn(self.staff_bawahan.id, ids)
        self.assertNotIn(self.staff_bukan_bawahan.id, ids)

    def test_staff_biasa_tetap_403_seperti_sebelumnya(self):
        self.client.force_authenticate(user=self.staff_polos)
        res = self.client.get('/api/users/', {'role': 'staff'})
        self.assertEqual(res.status_code, 403)

    def test_kordiv_tetap_tidak_bisa_menulis(self):
        self.client.force_authenticate(user=self.kordiv)
        res = self.client.patch(f'/api/users/{self.staff_bawahan.id}/', {'first_name': 'Coba Ubah'})
        self.assertEqual(res.status_code, 403)

    def test_owner_tetap_lihat_semua_staff_tanpa_dibatasi(self):
        owner = User.objects.create_user(username='owner_sup_read', password='pw12345', role='owner')
        self.client.force_authenticate(user=owner)
        res = self.client.get('/api/users/', {'role': 'staff'})
        self.assertEqual(res.status_code, 200, res.content)
        ids = {row['id'] for row in res.data}
        self.assertIn(self.staff_bawahan.id, ids)
        self.assertIn(self.staff_bukan_bawahan.id, ids)
        self.assertIn(self.staff_polos.id, ids)
