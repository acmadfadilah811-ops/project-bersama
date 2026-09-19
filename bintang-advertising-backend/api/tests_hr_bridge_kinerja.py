"""Uji endpoint GET /api/bridge/kinerja-staff/ (rekap kinerja staff bulanan utk
Payroll HR) + services/kinerja_staff_hr.py."""
import os
from datetime import datetime, timedelta
from unittest import mock

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from api.models import CustomUser, Divisi, JobBoard, Order, OrderItem, TahapProses
from hr.models import Absensi

URL = "/api/bridge/kinerja-staff/"
KEY = "kunci-benar"
HEADERS = {"HTTP_X_API_KEY": KEY, "HTTP_X_FORWARDED_PROTO": "https"}


def _aware(tahun, bulan, hari, jam=10):
    return timezone.make_aware(datetime(tahun, bulan, hari, jam, 0))


class _BersihkanThrottleMixin:
    """HRBridgeThrottle (30/min, cache bersama antar test) -- tanpa ini
    request test di file ini menghabiskan jatah & bikin test hr_bridge lain
    yang jalan di menit yang sama kena 429."""

    def setUp(self):
        super().setUp()
        cache.clear()
        self.addCleanup(cache.clear)


class KinerjaStaffAuthTests(_BersihkanThrottleMixin, APITestCase):
    def test_tanpa_api_key_dikonfigurasi_ditolak_500(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("HR_BRIDGE_API_KEY", None)
            r = self.client.get(URL, **{"HTTP_X_FORWARDED_PROTO": "https"})
        self.assertEqual(r.status_code, 500)

    def test_api_key_salah_ditolak_401(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r = self.client.get(URL, HTTP_X_API_KEY="salah", HTTP_X_FORWARDED_PROTO="https")
        self.assertEqual(r.status_code, 401)

    def test_parameter_tidak_valid_400(self):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            r1 = self.client.get(URL, {"tahun": "abc"}, **HEADERS)
            r2 = self.client.get(URL, {"tahun": 2026, "bulan": 13}, **HEADERS)
        self.assertEqual(r1.status_code, 400)
        self.assertEqual(r2.status_code, 400)


class KinerjaStaffHitungTests(_BersihkanThrottleMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.divisi = Divisi.objects.create(nama="Divisi Kinerja Test")
        self.tahap = TahapProses.objects.create(nama="Tahap Kinerja Test", divisi=self.divisi, urutan=1)
        self.staff = CustomUser.objects.create_user(
            username="staff_kinerja", password="pw12345", role="staff", divisi=self.divisi, hr_employee_id=77,
        )
        self.staff_tanpa_hr = CustomUser.objects.create_user(
            username="staff_belum_tertaut", password="pw12345", role="staff", divisi=self.divisi,
        )
        self.order = Order.objects.create(id="ORD-KINERJA-1", nomor_wa="08111", nama="Pelanggan Kinerja")

    def _job(self, staff, status, selesai, insentif=0, mulai=None):
        item = OrderItem.objects.create(order=self.order, jenis_produk="Item", qty=1, harga_jual=1000)
        return JobBoard.objects.create(
            order_item=item, tahap=self.tahap, pic_staff=staff, status_pekerjaan=status,
            insentif=insentif, waktu_mulai=mulai, waktu_selesai=selesai,
        )

    def _get(self, **params):
        with mock.patch.dict(os.environ, {"HR_BRIDGE_API_KEY": KEY}):
            return self.client.get(URL, params, **HEADERS)

    def test_insentif_hanya_job_selesai_di_bulan_itu(self):
        self._job(self.staff, "selesai", _aware(2026, 9, 5), insentif=50000, mulai=_aware(2026, 9, 5, 8))
        self._job(self.staff, "selesai", _aware(2026, 9, 30, 23), insentif=25000)
        self._job(self.staff, "gagal", _aware(2026, 9, 6), insentif=99999)     # gagal: tidak masuk insentif
        self._job(self.staff, "selesai", _aware(2026, 8, 31, 23), insentif=11111)  # bulan lain
        self._job(self.staff, "selesai", _aware(2026, 10, 1, 0), insentif=22222)   # bulan lain

        r = self._get(tahun=2026, bulan=9)

        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.data["periode"], "2026-09")
        [item] = r.data["staff"]
        self.assertEqual(item["hr_employee_id"], 77)
        self.assertEqual(item["job_selesai"], 2)
        self.assertEqual(item["job_gagal"], 1)
        self.assertEqual(item["total_insentif"], 75000)
        self.assertEqual(item["rata_rata_durasi_menit"], 120.0)  # cuma job yg punya waktu_mulai (2 jam)

    def test_staff_tanpa_hr_employee_id_dilaporkan_terpisah(self):
        self._job(self.staff_tanpa_hr, "selesai", _aware(2026, 9, 10), insentif=40000)

        r = self._get(tahun=2026, bulan=9)

        self.assertEqual(r.data["staff"], [])
        [item] = r.data["staff_tanpa_hr_employee_id"]
        self.assertEqual(item["username"], "staff_belum_tertaut")
        self.assertEqual(item["total_insentif"], 40000)

    def test_staff_tanpa_aktivitas_tidak_muncul(self):
        r = self._get(tahun=2026, bulan=9)
        self.assertEqual(r.data["staff"], [])
        self.assertEqual(r.data["staff_tanpa_hr_employee_id"], [])

    def test_jam_kerja_dan_hari_hadir_dari_absensi(self):
        Absensi.objects.create(
            staff=self.staff, tanggal=_aware(2026, 9, 3).date(), status="hadir",
            jam_masuk=_aware(2026, 9, 3, 8), jam_keluar=_aware(2026, 9, 3, 16),
        )

        r = self._get(tahun=2026, bulan=9)

        [item] = r.data["staff"]
        self.assertEqual(item["hari_hadir_sesi_bintang"], 1)
        self.assertEqual(item["total_jam_kerja_sesi_bintang"], 8.0)
