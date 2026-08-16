"""Cakupan test untuk app hr: autentikasi, gating izin, dan scoping data slip gaji.

Sebelumnya app ini tidak memiliki test sama sekali. Fokus pada lapisan izin dan
perilaku scoping (staff hanya melihat data miliknya) tanpa menjalankan logika
kalkulasi payroll yang berat.
"""
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from datetime import timedelta
from django.utils import timezone

from api.models import Divisi, SystemConfig
from hr.models import Akun, Absensi, DailyAttendanceSession, SlipGaji, TransaksiBukuBesar, UnlockRequest
from hr.views import get_or_create_daily_session

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


class UnlockRequestAttendanceTests(APITestCase):
    def setUp(self):
        self.divisi = Divisi.objects.create(nama="Operator Izin")
        self.owner = User.objects.create_user(username="owner_izin", password="password123", role="owner")
        self.staff = User.objects.create_user(username="staff_izin", password="password123", role="staff", divisi=self.divisi)
        now = timezone.now()
        self.sesi = DailyAttendanceSession.objects.create(
            tanggal=timezone.localdate(),
            waktu_mulai=now - timedelta(hours=2),
            batas_maksimal=now - timedelta(hours=1),
            is_active=True,
        )

    def test_approval_membuka_papan_dan_mencatat_terlambat(self):
        request_izin = UnlockRequest.objects.create(
            staff=self.staff, sesi=self.sesi, alasan="Terlambat karena keperluan keluarga"
        )

        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/hr/unlock-requests/{request_izin.id}/approve/")
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)

        absensi = Absensi.objects.get(staff=self.staff, tanggal=self.sesi.tanggal)
        self.assertEqual(absensi.status, "terlambat")
        self.assertIsNone(absensi.jam_masuk)
        self.assertTrue(absensi.workspace_unlocked)
        self.assertIn("Terlambat karena keperluan keluarga", absensi.catatan)
        self.assertIn("owner_izin", absensi.catatan)

        self.client.force_authenticate(self.staff)
        papan_kerja = self.client.get("/api/jobs/")
        self.assertEqual(papan_kerja.status_code, status.HTTP_200_OK, papan_kerja.content)

    def test_clock_in_setelah_keterlambatan_approved_melengkapi_jam_masuk(self):
        request_izin = UnlockRequest.objects.create(
            staff=self.staff, sesi=self.sesi, alasan="Terlambat"
        )
        self.client.force_authenticate(self.owner)
        self.client.post(f"/api/hr/unlock-requests/{request_izin.id}/approve/")

        self.client.force_authenticate(self.staff)
        response = self.client.post("/api/hr/absensi/clock-in/", {"catatan": "Sudah tiba"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        absensi = Absensi.objects.get(staff=self.staff, tanggal=self.sesi.tanggal)
        self.assertIsNotNone(absensi.jam_masuk)
        self.assertEqual(absensi.status, "terlambat")
        self.assertIn("Sudah tiba", absensi.catatan)


class AttendanceSessionScheduleTests(APITestCase):
    """Jadwal absensi 'Terapkan Jadwal Ini Setiap Hari' harus tersimpan di
    database (SystemConfig), bukan file lokal container — file lokal ikut
    hilang setiap kali backend di-deploy ulang (image baru), sehingga jadwal
    berulang gagal diam-diam dan owner harus buka sesi manual tiap hari."""

    def setUp(self):
        self.owner = User.objects.create_user(username="owner_sesi", password="password123", role="owner")
        self.client.force_authenticate(self.owner)

    def test_repeat_daily_tersimpan_di_systemconfig(self):
        response = self.client.post(
            "/api/hr/attendance-session/",
            {"waktu_mulai": "08:00", "batas_maksimal": "08:30", "repeat_daily": True},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(SystemConfig.objects.get(key="payroll_jam_masuk").value, "08:00")
        self.assertEqual(SystemConfig.objects.get(key="payroll_toleransi_menit").value, "30")

    def test_sesi_besok_otomatis_terbentuk_dari_systemconfig_walau_sesi_hari_ini_dihapus(self):
        """Simulasikan 'hari berikutnya' setelah jadwal berulang diaktifkan:
        tidak ada DailyAttendanceSession untuk tanggal tsb sama sekali (persis
        seperti setelah backend di-deploy ulang), tapi sesi tetap harus
        terbentuk otomatis dari SystemConfig — bukan menunggu dibuka manual."""
        self.client.post(
            "/api/hr/attendance-session/",
            {"waktu_mulai": "09:00", "batas_maksimal": "09:15", "repeat_daily": True},
            format="json",
        )
        DailyAttendanceSession.objects.all().delete()

        sesi = get_or_create_daily_session()
        self.assertIsNotNone(sesi)
        self.assertEqual(sesi.batas_maksimal - sesi.waktu_mulai, timedelta(minutes=15))

    def test_matikan_repeat_daily_menghapus_systemconfig(self):
        self.client.post(
            "/api/hr/attendance-session/",
            {"waktu_mulai": "08:00", "batas_maksimal": "08:30", "repeat_daily": True},
            format="json",
        )
        response = self.client.post(
            "/api/hr/attendance-session/",
            {"waktu_mulai": "08:00", "batas_maksimal": "08:30", "repeat_daily": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertFalse(SystemConfig.objects.filter(key="payroll_jam_masuk").exists())
        self.assertFalse(SystemConfig.objects.filter(key="payroll_toleransi_menit").exists())

    def test_get_melaporkan_repeat_daily_benar(self):
        self.client.post(
            "/api/hr/attendance-session/",
            {"waktu_mulai": "08:00", "batas_maksimal": "08:30", "repeat_daily": True},
            format="json",
        )
        response = self.client.get("/api/hr/attendance-session/")
        self.assertTrue(response.data["repeat_daily"])

    def test_batas_maksimal_harus_setelah_waktu_mulai(self):
        response = self.client.post(
            "/api/hr/attendance-session/",
            {"waktu_mulai": "09:00", "batas_maksimal": "08:00", "repeat_daily": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


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
