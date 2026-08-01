"""Cakupan test untuk app hr: autentikasi, gating izin, dan scoping data slip gaji.

Sebelumnya app ini tidak memiliki test sama sekali. Fokus pada lapisan izin dan
perilaku scoping (staff hanya melihat data miliknya) tanpa menjalankan logika
kalkulasi payroll yang berat.
"""
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from api.models import Divisi
from hr.models import Akun, SlipGaji, TransaksiBukuBesar

User = get_user_model()


class HrPermissionTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama="Finishing")
        self.owner = User.objects.create_user(username="owner_h", password="password123", role="owner")
        self.manager = User.objects.create_user(username="manager_h", password="password123", role="manager")
        self.staff = User.objects.create_user(username="staff_h", password="password123", role="staff", divisi=self.divisi)
        self.other_staff = User.objects.create_user(username="staff_h2", password="password123", role="staff", divisi=self.divisi)

    def _rows(self, resp):
        data = resp.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def test_dashboard_staff_requires_auth(self):
        self.assertIn(
            self.client.get("/api/hr/dashboard/staff/").status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_absensi_list_requires_auth(self):
        self.assertIn(
            self.client.get("/api/hr/absensi/").status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_clock_in_requires_auth(self):
        self.assertIn(
            self.client.post("/api/hr/absensi/clock-in/", {}).status_code,
            [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
        )

    def test_absensi_detail_forbidden_for_staff(self):
        # AbsensiDetailView pakai IsOwnerOrManagerPerm -> staff ditolak sebelum objek dicek.
        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get("/api/hr/absensi/1/").status_code, status.HTTP_403_FORBIDDEN)

    def test_slip_gaji_generate_forbidden_for_staff(self):
        self.client.force_authenticate(user=self.staff)
        resp = self.client.post("/api/hr/slip-gaji/generate/", {"bulan": 6, "tahun": 2026})
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_slip_gaji_scoped_to_own_for_staff(self):
        SlipGaji.objects.create(staff=self.staff, bulan=6, tahun=2026, gaji_pokok=1000000, total_gaji_bersih=1000000)
        SlipGaji.objects.create(staff=self.other_staff, bulan=6, tahun=2026, gaji_pokok=2000000, total_gaji_bersih=2000000)
        self.client.force_authenticate(user=self.staff)
        resp = self.client.get("/api/hr/slip-gaji/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Staff hanya boleh melihat slip miliknya sendiri.
        self.assertEqual(len(self._rows(resp)), 1)

    def test_slip_gaji_owner_sees_all(self):
        SlipGaji.objects.create(staff=self.staff, bulan=7, tahun=2026, gaji_pokok=1000000, total_gaji_bersih=1000000)
        SlipGaji.objects.create(staff=self.other_staff, bulan=7, tahun=2026, gaji_pokok=2000000, total_gaji_bersih=2000000)
        self.client.force_authenticate(user=self.owner)
        resp = self.client.get("/api/hr/slip-gaji/?bulan=7&tahun=2026")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._rows(resp)), 2)


class LegacyLedgerFrozenTests(APITestCase):
    """
    T-206 (verifikasi manager 2026-08-01): ledger legacy `hr.TransaksiBukuBesar`
    DIBEKUKAN sesuai M3/L3 — dilarang penulis/pemakai baru. Sebelumnya
    `/api/finance/transaksi/` masih bisa POST/PATCH/DELETE lewat
    `BukuBesar.jsx`, berjalan paralel dengan `accounting.JournalEntry`.
    Test ini membuktikan jalur tulis benar-benar tertutup (405), sementara
    baca (arsip/riwayat data lama) tetap berfungsi.
    """

    def setUp(self):
        self.owner = User.objects.create_user(username="owner_ledger", password="password123", role="owner")
        self.akun = Akun.objects.create(kode_akun="1-100", nama_akun="Kas Besar", kategori="Aset")
        self.transaksi = TransaksiBukuBesar.objects.create(
            akun=self.akun, tanggal="2026-01-15", keterangan="Transaksi lama (arsip)",
            debit=100000, kredit=0,
        )
        self.client.force_authenticate(user=self.owner)

    def test_read_still_works(self):
        resp = self.client.get("/api/finance/transaksi/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        resp = self.client.get(f"/api/finance/transaksi/{self.transaksi.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_create_rejected(self):
        resp = self.client.post("/api/finance/transaksi/", {
            "akun": self.akun.id, "tanggal": "2026-08-01", "keterangan": "Coba tulis baru", "debit": 50000, "kredit": 0,
        })
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(TransaksiBukuBesar.objects.count(), 1, "Tidak boleh ada baris baru — ledger legacy dibekukan.")

    def test_update_rejected(self):
        resp = self.client.patch(f"/api/finance/transaksi/{self.transaksi.id}/", {"keterangan": "Diubah"})
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_delete_rejected(self):
        resp = self.client.delete(f"/api/finance/transaksi/{self.transaksi.id}/")
        self.assertEqual(resp.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertTrue(TransaksiBukuBesar.objects.filter(id=self.transaksi.id).exists(), "Jurnal lama tidak boleh terhapus (L7 diperluas ke ledger legacy).")
