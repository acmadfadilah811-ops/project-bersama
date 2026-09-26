"""Persetujuan pencairan gaji 5 tahap (2026-09-26): alur, matriks peran,
pemisahan tugas, jurnal (seimbang, idempoten, dibalik saat ditolak), dan
pemberitahuan ke HR."""
from datetime import date
from decimal import Decimal
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from .models import JournalEntry, NotifikasiKeuangan, PayrollPosting, PengajuanGaji
from .services import payroll_persetujuan as svc
from .tests_payroll_posting import BPJS, MOCK_HR, PayrollBase, _data

URL = "/api/accounting/payroll/pengajuan/"
MOCK_KIRIM_HR = "accounting.services.payroll_persetujuan._kirim_hr_latar"


def _bukti():
    return SimpleUploadedFile("bukti.pdf", b"%PDF-1.4 bukti", content_type="application/pdf")


def _seimbang(entry):
    return sum(l.debit for l in entry.lines.all()) == sum(l.kredit for l in entry.lines.all())


class PersetujuanBase(PayrollBase):
    def setUp(self):
        super().setUp()
        U = get_user_model()
        self.owner = self.user
        self.manager = U.objects.create_user(username="pg_mgr", password="pw12345", role="manager")
        self.spv_fin = U.objects.create_user(username="pg_spvfin", password="pw12345", role="spv_finance")
        self.admin_fin = U.objects.create_user(username="pg_adminfin", password="pw12345", role="admin_finance")
        self.kasir = U.objects.create_user(username="pg_kasir", password="pw12345", role="kasir")
        self.peta_bpjs()
        patcher = mock.patch(MOCK_HR, return_value=_data(potongan=BPJS))
        self.mock_hr = patcher.start()
        self.addCleanup(patcher.stop)
        kirim = mock.patch(MOCK_KIRIM_HR)
        self.kirim_hr = kirim.start()
        self.addCleanup(kirim.stop)

    def ajukan(self):
        with self.captureOnCommitCallbacks(execute=True):
            return svc.ajukan(2026, 9)

    def sampai_siap_bayar(self):
        p = self.ajukan()
        svc.verifikasi(p.pk, self.spv_fin)
        svc.otorisasi(p.pk, self.owner)
        return p


class AlurPersetujuanTests(PersetujuanBase):
    def test_alur_lengkap_lima_tahap(self):
        p = self.ajukan()
        self.assertEqual(p.status, "menunggu_verifikasi")
        self.assertEqual(p.ringkasan["jumlah_slip"], 1)

        svc.verifikasi(p.pk, self.spv_fin)
        p.refresh_from_db()
        self.assertEqual(p.status, "menunggu_otorisasi")
        self.assertTrue(_seimbang(p.payroll_posting.journal_entry))

        svc.otorisasi(p.pk, self.manager)
        p.refresh_from_db()
        self.assertEqual(p.status, "siap_dibayar")

        with self.captureOnCommitCallbacks(execute=True):
            svc.bayar(p.pk, self.admin_fin, self.kas.id, date(2026, 10, 1), _bukti())
        p.refresh_from_db()
        self.assertEqual(p.status, "dibayar")
        self.assertTrue(p.bukti_transfer)
        self.assertTrue(_seimbang(p.payroll_posting.payment_journal_entry))
        # HR diminta menandai slip Dibayar, membawa id slip yang disetujui
        args = self.kirim_hr.call_args.args
        self.assertEqual(args[1], "payroll/tandai-dibayar/")
        self.assertEqual([s["id"] for s in args[2]["slip"]], [1])
        self.assertEqual([l.aksi for l in p.log.all()],
                         ["diajukan", "diverifikasi", "diotorisasi", "dibayar"])

    def test_kabar_ulang_setelah_slip_ditandai_dibayar_tidak_membuat_pengajuan_baru(self):
        p = self.sampai_siap_bayar()
        with self.captureOnCommitCallbacks(execute=True):
            svc.bayar(p.pk, self.spv_fin, self.kas.id, None, _bukti())
        data = _data(potongan=BPJS, hash="h-setelah-dibayar")
        data["slip"][0]["status"] = "paid"
        self.mock_hr.return_value = data
        self.assertIsNone(self.ajukan())
        self.assertEqual(PengajuanGaji.objects.count(), 1)

    def test_ajukan_idempoten_per_data_hr(self):
        a = self.ajukan()
        b = self.ajukan()
        self.assertEqual(a.pk, b.pk)
        self.assertEqual(PengajuanGaji.objects.count(), 1)

    def test_data_hr_berubah_pengajuan_lama_digantikan_dan_jurnal_dibalik(self):
        p = self.ajukan()
        svc.verifikasi(p.pk, self.spv_fin)
        self.mock_hr.return_value = _data(potongan=BPJS, hash="h2")
        baru = self.ajukan()
        p.refresh_from_db()
        self.assertEqual(p.status, "digantikan")
        self.assertEqual(p.payroll_posting.status, "dibalik")
        self.assertEqual(baru.status, "menunggu_verifikasi")
        self.assertTrue(JournalEntry.objects.filter(reversed_entry=p.payroll_posting.journal_entry).exists())

    def test_verifikasi_ditolak_bila_data_hr_berubah(self):
        p = self.ajukan()
        self.mock_hr.return_value = _data(potongan=BPJS, hash="h9")
        with self.assertRaises(svc.PersetujuanError):
            svc.verifikasi(p.pk, self.spv_fin)
        self.assertFalse(PayrollPosting.objects.exists())

    def test_verifikasi_dua_kali_tetap_satu_jurnal(self):
        p = self.ajukan()
        svc.verifikasi(p.pk, self.spv_fin)
        with self.assertRaises(svc.PersetujuanError):
            svc.verifikasi(p.pk, self.spv_fin)
        self.assertEqual(PayrollPosting.objects.count(), 1)

    def test_tolak_tahap_otorisasi_membalik_jurnal_dan_memberi_tahu_hr(self):
        p = self.ajukan()
        svc.verifikasi(p.pk, self.spv_fin)
        with self.captureOnCommitCallbacks(execute=True):
            svc.tolak(p.pk, self.owner, "Nominal lembur tidak wajar")
        p.refresh_from_db()
        self.assertEqual(p.status, "ditolak")
        self.assertEqual(p.payroll_posting.status, "dibalik")
        rev = JournalEntry.objects.get(reversed_entry=p.payroll_posting.journal_entry)
        self.assertTrue(_seimbang(rev))
        self.assertEqual(self.kirim_hr.call_args.args[1], "payroll/ditolak/")
        self.assertEqual(self.kirim_hr.call_args.args[2]["alasan"], "Nominal lembur tidak wajar")
        # HR memperbaiki -> pengajuan baru bisa dibuat untuk periode yang sama
        self.mock_hr.return_value = _data(potongan=BPJS, hash="h3")
        self.assertEqual(self.ajukan().status, "menunggu_verifikasi")

    def test_tolak_wajib_alasan(self):
        p = self.ajukan()
        with self.assertRaises(svc.PersetujuanError):
            svc.tolak(p.pk, self.spv_fin, " ")

    def test_bayar_wajib_bukti(self):
        p = self.sampai_siap_bayar()
        with self.assertRaises(svc.PersetujuanError):
            svc.bayar(p.pk, self.spv_fin, self.kas.id, None, None)
        self.assertFalse(PayrollPosting.objects.get().payment_journal_entry_id)

    def test_bayar_gagal_rollback_status(self):
        p = self.sampai_siap_bayar()
        with self.assertRaises(svc.pp.PayrollError):
            svc.bayar(p.pk, self.spv_fin, self.biaya.id, None, _bukti())  # bukan akun Kas & Bank
        p.refresh_from_db()
        self.assertEqual(p.status, "siap_dibayar")
        self.assertFalse(p.bukti_transfer)

    def test_notifikasi_tiap_tahap(self):
        p = self.sampai_siap_bayar()
        kunci = set(NotifikasiKeuangan.objects.filter(jenis="persetujuan_gaji").values_list("kunci", flat=True))
        self.assertEqual(kunci, {f"persetujuan-{p.pk}-{k}" for k in ("menunggu-verifikasi", "menunggu-otorisasi", "siap-dibayar")})


class PemisahanTugasTests(PersetujuanBase):
    def test_peran_tiap_tahap(self):
        p = self.ajukan()
        for u in (self.owner, self.manager, self.admin_fin):
            with self.assertRaises(PermissionError):
                svc.verifikasi(p.pk, u)
        svc.verifikasi(p.pk, self.spv_fin)
        for u in (self.spv_fin, self.admin_fin):
            with self.assertRaises(PermissionError):
                svc.otorisasi(p.pk, u)
        svc.otorisasi(p.pk, self.owner)
        for u in (self.owner, self.manager):
            with self.assertRaises(PermissionError):
                svc.bayar(p.pk, u, self.kas.id, None, _bukti())

    def test_tolak_sesuai_tahap(self):
        p = self.ajukan()
        with self.assertRaises(PermissionError):
            svc.tolak(p.pk, self.owner, "bukan tahapnya")
        svc.verifikasi(p.pk, self.spv_fin)
        with self.assertRaises(PermissionError):
            svc.tolak(p.pk, self.spv_fin, "bukan tahapnya")

    def test_batas_otorisasi_owner(self):
        self.settings.payroll_batas_otorisasi_owner = Decimal("1000000")
        self.settings.save()
        p = self.ajukan()
        svc.verifikasi(p.pk, self.spv_fin)
        with self.assertRaises(PermissionError):
            svc.otorisasi(p.pk, self.manager)  # total 3.130.000 > 1.000.000
        svc.otorisasi(p.pk, self.owner)

    def test_peringatan_selisih_dan_karyawan_baru(self):
        p = self.sampai_siap_bayar()
        with self.captureOnCommitCallbacks(execute=True):
            svc.bayar(p.pk, self.spv_fin, self.kas.id, None, _bukti())
        slip_baru = _data(potongan=BPJS)["slip"] + [
            {"id": 2, "karyawan_id": 999, "status": "confirmed", "gross_pay": 3250000, "deduction": 120000,
             "net_pay": 3130000, "potongan_net": 0, "selisih": 0}]
        data = _data(potongan=BPJS, slip=slip_baru, hash="okt")
        data.update({"periode": "2026-10", "bulan": 10})
        self.mock_hr.return_value = data
        with self.captureOnCommitCallbacks(execute=True):
            okt = svc.ajukan(2026, 10)
        pesan = " ".join(c["pesan"] for c in okt.cek)
        self.assertIn("naik", pesan)
        self.assertIn("1 karyawan baru", pesan)


class PersetujuanApiTests(PersetujuanBase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()

    def _post(self, user, pk, aksi, data=None, multipart=False):
        self.client.force_authenticate(user)
        return self.client.post(f"{URL}{pk}/{aksi}/", data or {}, format="multipart" if multipart else "json")

    def test_matriks_peran_daftar(self):
        self.ajukan()
        for u in (self.owner, self.manager, self.spv_fin, self.admin_fin):
            self.client.force_authenticate(u)
            self.assertEqual(self.client.get(URL).status_code, 200, u.role)
        self.client.force_authenticate(self.kasir)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.client.force_authenticate(None)
        self.assertIn(self.client.get(URL).status_code, (401, 403))

    def test_tombol_sesuai_peran_dan_alur_lewat_api(self):
        p = self.ajukan()
        self.client.force_authenticate(self.spv_fin)
        baris = self.client.get(URL).data["results"][0]
        self.assertTrue(baris["aksi"]["verifikasi"])
        self.assertFalse(baris["aksi"]["otorisasi"])
        self.assertEqual(self._post(self.owner, p.pk, "verifikasi").status_code, 403)
        self.assertEqual(self._post(self.spv_fin, p.pk, "verifikasi").status_code, 200)
        self.assertEqual(self._post(self.manager, p.pk, "otorisasi").status_code, 200)
        res = self._post(self.admin_fin, p.pk, "bayar",
                         {"akun_kas": self.kas.id, "tanggal": "2026-10-01", "bukti": _bukti()}, multipart=True)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], "dibayar")
        self.assertTrue(res.data["jurnal_pembayaran"])

    def test_bukti_berkas_berbahaya_ditolak(self):
        p = self.sampai_siap_bayar()
        buruk = SimpleUploadedFile("bukti.html", b"<script>", content_type="text/html")
        res = self._post(self.spv_fin, p.pk, "bayar", {"akun_kas": self.kas.id, "bukti": buruk}, multipart=True)
        self.assertEqual(res.status_code, 400)

    def test_tolak_lewat_api(self):
        p = self.ajukan()
        res = self._post(self.spv_fin, p.pk, "tolak", {"alasan": "Slip lembur ganda"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["status"], "ditolak")
        self.assertEqual(res.data["alasan_tolak"], "Slip lembur ganda")


class AkunKasApiTests(PersetujuanBase):
    def test_akun_kas_untuk_pembayar_dan_bukan_kasir(self):
        c = APIClient()
        c.force_authenticate(self.admin_fin)
        res = c.get(URL + "akun-kas/")
        self.assertEqual(res.status_code, 200)
        # sama dengan filter pp.bayar(): semua akun aset aktif berklasifikasi "Kas & Bank"
        self.assertIn("11101", [a["code"] for a in res.data])
        self.assertNotIn("60100", [a["code"] for a in res.data])
        c.force_authenticate(self.kasir)
        self.assertEqual(c.get(URL + "akun-kas/").status_code, 403)
