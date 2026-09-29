"""Aturan rentang periode akuntansi dengan tanggal potong (2026-09-29).

Sebelumnya periode selalu bulan kalender penuh, sehingga menutup buku
sebelum akhir bulan (mis. tanggal 25) ikut mengunci transaksi tanggal 26-30
dan kasir tidak bisa bertransaksi. Dengan `AccountingSettings.period_cutoff_day`
(1-28) periode BERAKHIR di tanggal itu: potong 25 -> "Sep 2026" = 26 Agu s/d
25 Sep, dan jurnal tanggal 26 Sep otomatis masuk periode berikutnya.
0 (bawaan) = bulan kalender seperti sebelumnya.

Satu-satunya tempat yang menentukan batas periode -- dipakai posting jurnal
(journal._get_or_create_period), tutup buku (period.close_accounting_period),
dan serializer (nama periode).
"""
from calendar import monthrange
from datetime import date, timedelta

from ..models import AccountingPeriod, AccountingSettings

NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def hari_potong():
    """Tanggal potong aktif (1-28), atau 0 = bulan kalender."""
    pengaturan = AccountingSettings.objects.only("period_cutoff_day").first()
    hari = pengaturan.period_cutoff_day if pengaturan else 0
    return hari if 1 <= hari <= 28 else 0


def _bulan_sebelum(tahun, bulan):
    return (tahun - 1, 12) if bulan == 1 else (tahun, bulan - 1)


def rentang_menurut_aturan(tanggal, hari=None):
    """(mulai, akhir) periode yang memuat `tanggal` menurut tanggal potong,
    tanpa melihat periode yang sudah tersimpan."""
    hari = hari_potong() if hari is None else hari
    if not hari:
        return (
            tanggal.replace(day=1),
            tanggal.replace(day=monthrange(tanggal.year, tanggal.month)[1]),
        )
    if tanggal.day <= hari:
        akhir = tanggal.replace(day=hari)
        tahun, bulan = _bulan_sebelum(akhir.year, akhir.month)
        mulai = date(tahun, bulan, hari) + timedelta(days=1)
    else:
        mulai = tanggal.replace(day=hari + 1)
        tahun, bulan = (mulai.year + 1, 1) if mulai.month == 12 else (mulai.year, mulai.month + 1)
        akhir = date(tahun, bulan, hari)
    return mulai, akhir


def rentang_periode(tanggal, hari=None):
    """(mulai, akhir) periode untuk `tanggal`.

    - Periode yang sudah tersimpan dan memuat tanggal itu dipakai apa adanya
      (data lama tidak dipaksa mengikuti aturan baru).
    - Kalau belum ada: rentang menurut aturan, dipotong supaya tidak
      tumpang tindih dengan periode tetangga yang sudah ada.
    """
    ada = AccountingPeriod.objects.filter(start_date__lte=tanggal, end_date__gte=tanggal).order_by("start_date").first()
    if ada:
        return ada.start_date, ada.end_date
    mulai, akhir = rentang_menurut_aturan(tanggal, hari)
    sebelum = (
        AccountingPeriod.objects.filter(end_date__gte=mulai, end_date__lt=tanggal).order_by("-end_date").first()
    )
    if sebelum:
        mulai = max(mulai, sebelum.end_date + timedelta(days=1))
    sesudah = (
        AccountingPeriod.objects.filter(start_date__gt=tanggal, start_date__lte=akhir).order_by("start_date").first()
    )
    if sesudah:
        akhir = min(akhir, sesudah.start_date - timedelta(days=1))
    return mulai, akhir


def nama_periode(mulai, akhir):
    """'Sep 2026' (bulan AKHIR periode); periode yang bukan bulan kalender
    ditambah rentangnya: 'Sep 2026 (26 Agu-25 Sep)'."""
    dasar = f"{NAMA_BULAN[akhir.month - 1]} {akhir.year}"
    kalender = (
        mulai.day == 1
        and akhir.day == monthrange(akhir.year, akhir.month)[1]
        and (mulai.year, mulai.month) == (akhir.year, akhir.month)
    )
    if kalender:
        return dasar
    return f"{dasar} ({mulai.day} {NAMA_BULAN[mulai.month - 1]}-{akhir.day} {NAMA_BULAN[akhir.month - 1]})"
