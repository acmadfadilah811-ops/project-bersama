"""Persetujuan pencairan gaji 5 tahap (2026-09-26).

Tahap & pelaku (pemisahan tugas / maker-checker):
  1. HR menyusun & mengonfirmasi slip        -> ajukan()          (otomatis dari notifikasi HR)
  2. SPV Finance memverifikasi                -> verifikasi()       jurnal pengakuan (Posting Gaji)
  3. Owner/Manager mengotorisasi pencairan    -> otorisasi()        siap dibayar
  4. SPV/Admin Finance membayar + bukti       -> bayar()            jurnal pembayaran, slip HR -> Dibayar
  5. Setor BPJS dll                           -> pelunasan hutang biasa (di luar modul ini)
  Tolak (tahap 2 oleh SPV Finance, tahap 3 oleh Owner/Manager) -> jurnal pengakuan dibalik (M7),
  HR diberi tahu beserta alasannya.

Jurnal dibuat HANYA lewat services/payroll_posting.py (create_journal_entry, M2),
di dalam transaksi yang sama dengan perubahan status (M5).
"""

import logging
import os
import threading
from decimal import Decimal

import requests
from django.db import transaction
from django.utils import timezone

from ..models import AccountingSettings, NotifikasiKeuangan, PayrollPosting, PengajuanGaji, PengajuanGajiLog
from . import payroll_posting as pp

logger = logging.getLogger(__name__)

S = PengajuanGaji.Status
A = PengajuanGajiLog.Aksi

PERAN_VERIFIKASI = {"spv_finance"}
PERAN_OTORISASI = {"owner", "manager"}
PERAN_BAYAR = {"spv_finance", "admin_finance"}
PERAN_LIHAT = PERAN_VERIFIKASI | PERAN_OTORISASI | PERAN_BAYAR
TAUTAN = "/accounting-internal?active=posting-gaji"


class PersetujuanError(pp.PayrollError):
    """Aksi ditolak karena aturan alur (status/peran/data)."""


def _peran(user):
    return (getattr(user, "role", "") or "").lower()


def _wajib_peran(user, daftar, pesan):
    if _peran(user) not in daftar:
        raise PermissionError(pesan)


def _d(x):
    return pp._d(x)


def _rp(x):
    return "Rp " + f"{int(_d(x).quantize(Decimal('1'))):,}".replace(",", ".")


def _log(pengajuan, aksi, user=None, catatan=""):
    PengajuanGajiLog.objects.create(pengajuan=pengajuan, aksi=aksi, oleh=user, catatan=catatan)


def _notifikasi(pengajuan, kunci, judul, pesan):
    NotifikasiKeuangan.objects.get_or_create(
        kunci=f"persetujuan-{pengajuan.pk}-{kunci}"[:120],
        defaults={"jenis": NotifikasiKeuangan.Jenis.PERSETUJUAN_GAJI, "judul": judul[:200],
                  "pesan": pesan, "tautan": TAUTAN,
                  "data": {"pengajuan_id": pengajuan.pk, "status": pengajuan.status}},
    )


def _label(p):
    return f"{p.tahun:04d}-{p.bulan:02d}"


# --------------------------------------------------------------- pemeriksaan

def periksa(data, tahun, bulan):
    """Pemeriksaan otomatis untuk verifikator: [{level: masalah|peringatan, pesan}]."""
    hasil = pp.susun_jurnal(data, pp._akun_inti(), pp._pemetaan())
    cek = [{"level": "masalah", "pesan": m} for m in hasil["masalah"]]
    cek += [{"level": "peringatan", "pesan": m} for m in hasil["peringatan"]]

    setelan = AccountingSettings.objects.first()
    batas = _d(getattr(setelan, "payroll_batas_selisih_persen", 10) or 10)
    th_lalu, bl_lalu = (tahun - 1, 12) if bulan == 1 else (tahun, bulan - 1)
    lalu = PayrollPosting.objects.filter(tahun=th_lalu, bulan=bl_lalu, status="aktif").first()
    total_net = hasil["ringkasan"]["total_net"]
    if lalu and lalu.total_net > 0:
        selisih = (total_net - lalu.total_net) / lalu.total_net * 100
        if abs(selisih) > batas:
            arah = "naik" if selisih > 0 else "turun"
            cek.append({"level": "peringatan", "pesan": (
                f"Total gaji bersih {arah} {abs(selisih).quantize(Decimal('0.1'))}% dibanding "
                f"{th_lalu:04d}-{bl_lalu:02d} ({_rp(lalu.total_net)} -> {_rp(total_net)}), "
                f"melewati batas {batas}%.")})
        id_lalu = {s.get("karyawan_id") for s in (lalu.payload or {}).get("slip", [])}
        id_kini = {s.get("karyawan_id") for s in data.get("slip", [])}
        if id_kini - id_lalu:
            cek.append({"level": "peringatan", "pesan": f"{len(id_kini - id_lalu)} karyawan baru dibanding bulan lalu."})
        if id_lalu - id_kini:
            cek.append({"level": "peringatan", "pesan": f"{len(id_lalu - id_kini)} karyawan bulan lalu tidak ada di periode ini."})
    elif not lalu:
        cek.append({"level": "peringatan", "pesan": "Belum ada posting bulan lalu untuk pembanding."})
    return cek, hasil["ringkasan"]


def _sidik_uang(data):
    """Angka uang per slip (tanpa status) untuk membandingkan dua data HR."""
    return sorted(
        (s.get("id"), str(_d(s.get("gross_pay"))), str(_d(s.get("deduction"))), str(_d(s.get("net_pay"))))
        for s in (data or {}).get("slip", [])
    )


def _ringkasan_json(r):
    return {k: str(v) if isinstance(v, Decimal) else v for k, v in r.items()}


# --------------------------------------------------------------- tahap 1

@transaction.atomic
def ajukan(tahun, bulan):
    """Dipanggil saat HR mengabarkan gaji sebulan final. Idempoten per hash data HR.
    Data HR berubah sebelum dibayar -> pengajuan lama digantikan (jurnalnya dibalik)."""
    data = pp.ambil_payroll_hr(tahun, bulan)
    hash_hr = data.get("hash", "")
    lama = PengajuanGaji.objects.select_for_update().filter(
        tahun=tahun, bulan=bulan, status__in=PengajuanGaji.TERBUKA).first()
    if lama and lama.hash_hr == hash_hr:
        return lama
    # Sudah dibayar dengan angka yang sama -> abaikan. Hash HR ikut berubah saat slip
    # ditandai Dibayar (status masuk sidik jari), jadi pembandingnya angka per slip.
    for dibayar in PengajuanGaji.objects.filter(tahun=tahun, bulan=bulan, status=S.DIBAYAR).select_related("payroll_posting"):
        if dibayar.hash_hr == hash_hr or (
                dibayar.payroll_posting and _sidik_uang(dibayar.payroll_posting.payload) == _sidik_uang(data)):
            return None
    if lama:
        _batalkan_posting(lama, None, "Digantikan data HR yang lebih baru")
        lama.status = S.DIGANTIKAN
        lama.save(update_fields=["status"])
        _log(lama, A.DIGANTIKAN, None, "Data slip HR berubah; pengajuan baru dibuat.")
    cek, ringkasan = periksa(data, tahun, bulan)
    baru = PengajuanGaji.objects.create(
        tahun=tahun, bulan=bulan, hash_hr=hash_hr, cek=cek, ringkasan=_ringkasan_json(ringkasan))
    _log(baru, A.DIAJUKAN, None, f"{ringkasan['jumlah_slip']} slip, total bersih {_rp(ringkasan['total_net'])}.")
    _notifikasi(baru, "menunggu-verifikasi", f"Gaji {_label(baru)} menunggu verifikasi SPV Finance",
                f"{ringkasan['jumlah_slip']} slip, total dibayarkan {_rp(ringkasan['total_net'])}. "
                f"{sum(1 for c in cek if c['level'] == 'masalah')} masalah, "
                f"{sum(1 for c in cek if c['level'] == 'peringatan')} peringatan.")
    return baru


# --------------------------------------------------------------- tahap 2

@transaction.atomic
def verifikasi(pengajuan_id, user):
    _wajib_peran(user, PERAN_VERIFIKASI, "Verifikasi gaji hanya oleh SPV Finance.")
    p = PengajuanGaji.objects.select_for_update().get(pk=pengajuan_id)
    if p.status != S.MENUNGGU_VERIFIKASI:
        raise PersetujuanError("Pengajuan ini tidak sedang menunggu verifikasi.")
    data = pp.ambil_payroll_hr(p.tahun, p.bulan)
    if data.get("hash") != p.hash_hr:
        raise PersetujuanError("Data slip di HR berubah sejak diajukan. Tunggu pengajuan baru dari HR.")
    aktif = PayrollPosting.objects.filter(tahun=p.tahun, bulan=p.bulan, status="aktif").first()
    if aktif:
        if aktif.payload_hash != p.hash_hr:
            raise PersetujuanError("Periode ini sudah diposting dengan data berbeda. Gunakan Koreksi di Posting Gaji.")
        posting = aktif
    else:
        posting = pp.posting(p.tahun, p.bulan, user)
    p.payroll_posting = posting
    p.status = S.MENUNGGU_OTORISASI
    p.diverifikasi_oleh, p.diverifikasi_pada = user, timezone.now()
    p.save(update_fields=["payroll_posting", "status", "diverifikasi_oleh", "diverifikasi_pada"])
    _log(p, A.DIVERIFIKASI, user, f"Jurnal pengakuan {posting.journal_entry.entry_number}.")
    _notifikasi(p, "menunggu-otorisasi", f"Gaji {_label(p)} menunggu otorisasi pencairan",
                f"Diverifikasi {user.get_username()}. Total dibayarkan {_rp(posting.total_net)}.")
    return p


# --------------------------------------------------------------- tahap 3

@transaction.atomic
def otorisasi(pengajuan_id, user):
    _wajib_peran(user, PERAN_OTORISASI, "Otorisasi pencairan hanya oleh Owner atau Manager.")
    p = PengajuanGaji.objects.select_for_update().get(pk=pengajuan_id)
    if p.status != S.MENUNGGU_OTORISASI:
        raise PersetujuanError("Pengajuan ini tidak sedang menunggu otorisasi.")
    if p.diverifikasi_oleh_id == user.pk:
        raise PermissionError("Verifikator tidak boleh mengotorisasi pengajuannya sendiri.")
    batas = getattr(AccountingSettings.objects.first(), "payroll_batas_otorisasi_owner", None)
    total = p.payroll_posting.total_net
    if batas is not None and total > batas and _peran(user) != "owner":
        raise PermissionError(f"Total {_rp(total)} melebihi batas {_rp(batas)}: wajib diotorisasi Owner.")
    p.status = S.SIAP_DIBAYAR
    p.diotorisasi_oleh, p.diotorisasi_pada = user, timezone.now()
    p.save(update_fields=["status", "diotorisasi_oleh", "diotorisasi_pada"])
    _log(p, A.DIOTORISASI, user)
    _notifikasi(p, "siap-dibayar", f"Gaji {_label(p)} siap dibayar",
                f"Diotorisasi {user.get_username()}. Lakukan transfer {_rp(total)} lalu catat pembayaran beserta bukti.")
    return p


# --------------------------------------------------------------- tahap 4

@transaction.atomic
def bayar(pengajuan_id, user, akun_kas_id, tanggal, bukti):
    _wajib_peran(user, PERAN_BAYAR, "Pembayaran gaji hanya oleh SPV Finance atau Admin Finance.")
    p = PengajuanGaji.objects.select_for_update().get(pk=pengajuan_id)
    if p.status != S.SIAP_DIBAYAR:
        raise PersetujuanError("Pengajuan ini belum diotorisasi untuk dibayar.")
    if p.diotorisasi_oleh_id == user.pk:
        raise PermissionError("Pemberi otorisasi tidak boleh membayar sendiri.")
    if not bukti:
        raise PersetujuanError("Bukti transfer wajib diunggah.")
    posting = pp.bayar(p.tahun, p.bulan, akun_kas_id, tanggal, user)
    p.bukti_transfer.save(bukti.name, bukti, save=False)
    p.status = S.DIBAYAR
    p.dibayar_oleh, p.dibayar_pada = user, timezone.now()
    p.save(update_fields=["bukti_transfer", "status", "dibayar_oleh", "dibayar_pada"])
    _log(p, A.DIBAYAR, user, f"Jurnal pembayaran {posting.payment_journal_entry.entry_number}.")
    slip = [{"id": s.get("id"), "net_pay": s.get("net_pay")} for s in (posting.payload or {}).get("slip", [])]
    transaction.on_commit(lambda: _kirim_hr_latar(p.pk, "payroll/tandai-dibayar/", {
        "tahun": p.tahun, "bulan": p.bulan, "slip": slip}))
    return p


# --------------------------------------------------------------- tolak

def _batalkan_posting(p, user, catatan):
    """Balik jurnal pengakuan (M7) bila sudah dibuat dan belum dibayar."""
    posting = p.payroll_posting
    if not posting or posting.status != "aktif":
        return
    if posting.payment_journal_entry_id:
        raise PersetujuanError("Gaji periode ini sudah dibayar; tidak bisa dibatalkan.")
    pp._balik(posting.journal_entry, user, catatan)
    posting.status = PayrollPosting.Status.DIBALIK
    posting.dibalik_oleh, posting.dibalik_pada = user, timezone.now()
    posting.save(update_fields=["status", "dibalik_oleh", "dibalik_pada"])


@transaction.atomic
def tolak(pengajuan_id, user, alasan):
    alasan = (alasan or "").strip()
    if len(alasan) < 5:
        raise PersetujuanError("Alasan penolakan wajib diisi (minimal 5 karakter).")
    p = PengajuanGaji.objects.select_for_update().get(pk=pengajuan_id)
    if p.status == S.MENUNGGU_VERIFIKASI:
        _wajib_peran(user, PERAN_VERIFIKASI, "Pada tahap verifikasi, hanya SPV Finance yang bisa menolak.")
    elif p.status == S.MENUNGGU_OTORISASI:
        _wajib_peran(user, PERAN_OTORISASI, "Pada tahap otorisasi, hanya Owner atau Manager yang bisa menolak.")
    else:
        raise PersetujuanError("Pengajuan pada tahap ini tidak bisa ditolak.")
    _batalkan_posting(p, user, f"Pengajuan gaji {_label(p)} ditolak: {alasan}")
    p.status = S.DITOLAK
    p.ditolak_oleh, p.ditolak_pada, p.alasan_tolak = user, timezone.now(), alasan
    p.save(update_fields=["status", "ditolak_oleh", "ditolak_pada", "alasan_tolak"])
    _log(p, A.DITOLAK, user, alasan)
    _notifikasi(p, "ditolak", f"Gaji {_label(p)} ditolak", f"Ditolak {user.get_username()}: {alasan}")
    transaction.on_commit(lambda: _kirim_hr_latar(p.pk, "payroll/ditolak/", {
        "tahun": p.tahun, "bulan": p.bulan, "alasan": alasan, "oleh": user.get_username()}))
    return p


# --------------------------------------------------------------- ke HR

def _kirim_hr(jalur, payload):
    kunci = os.getenv("INSIGHTS_BRIDGE_API_KEY")
    if not kunci:
        return "gagal: INSIGHTS_BRIDGE_API_KEY kosong"
    from api.services.insights_bridge import DEFAULT_HR_INSIGHTS_URL

    base = os.getenv("HR_INSIGHTS_URL", DEFAULT_HR_INSIGHTS_URL).rstrip("/")
    try:
        r = requests.post(f"{base}/{jalur}", json=payload, timeout=15,
                          headers={"X-Api-Key": kunci, "X-Forwarded-Proto": "https"})
        if r.status_code >= 400:
            return f"gagal: HR menjawab {r.status_code}"
        return ("ok: " + str(r.json().get("pesan", "")))[:200]
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Gagal memberi tahu HR (%s): %s", jalur, exc)
        return "gagal: HR tidak bisa dihubungi"


def _kirim_hr_latar(pengajuan_id, jalur, payload):
    def jalan():
        hasil = _kirim_hr(jalur, payload)
        PengajuanGaji.objects.filter(pk=pengajuan_id).update(sinkron_hr=hasil)

    threading.Thread(target=jalan, daemon=True).start()
