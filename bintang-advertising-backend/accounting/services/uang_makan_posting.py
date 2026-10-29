"""Jurnal uang makan mingguan dari HR (2026-10-30, keputusan user).

HR (Horilla) menandai uang makan satu karyawan untuk satu minggu sudah dibayar -> HR mengirim lewat jembatan
-> jurnal otomatis: Dr Biaya uang makan / Cr Kas (tunai) atau Bank (transfer), akun dari AccountingSettings
(fail-closed bila kosong). Pembatalan di HR -> jurnal pembalik (M7). Idempotent per id pembayaran HR
(source_type=uang_makan, source_id=id HR; M4). Jurnal hanya lewat create_journal_entry (M2).
"""

from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError
from django.db import transaction

from ..models import AccountingSettings, JournalEntry
from . import payroll_posting as pp
from .journal import create_journal_entry

SUMBER = JournalEntry.SourceType.UANG_MAKAN
NOL = Decimal("0")


class UangMakanError(Exception):
    pass


def _jurnal_aktif(hr_pembayaran_id):
    """Jurnal pengakuan yang belum dibalik untuk satu pembayaran HR."""
    return (
        JournalEntry.objects.filter(
            source_type=SUMBER, source_id=hr_pembayaran_id, status=JournalEntry.Status.POSTED,
            reversed_entry__isnull=True,
        )
        .exclude(reversal_of__status=JournalEntry.Status.POSTED)
        .first()
    )


def _akun(metode):
    row = AccountingSettings.objects.first()
    if row is None:
        raise UangMakanError("Pengaturan Akuntansi belum diinisialisasi.")
    biaya = row.uang_makan_expense_account
    kas = row.uang_makan_tunai_account if metode == "tunai" else row.uang_makan_transfer_account
    if biaya is None or kas is None:
        sisi = "Kas (tunai)" if metode == "tunai" else "Bank (transfer)"
        raise UangMakanError(
            f"Akun uang makan belum diatur: pilih akun Biaya uang makan dan akun {sisi} di "
            "Pengaturan Akuntansi > Atur Akun Uang Makan."
        )
    return biaya, kas


def _parse(data):
    try:
        hr_id = int(data.get("hr_pembayaran_id"))
        total = Decimal(str(data.get("total")))
        tanggal = date.fromisoformat(str(data.get("tanggal")))
    except (TypeError, ValueError, InvalidOperation):
        raise UangMakanError("Data pembayaran uang makan dari HR tidak lengkap atau tidak valid.")
    metode = data.get("metode")
    if metode not in ("tunai", "transfer"):
        raise UangMakanError("Metode pembayaran uang makan harus tunai atau transfer.")
    if hr_id <= 0 or total <= NOL:
        raise UangMakanError("Nominal uang makan harus lebih dari nol.")
    return hr_id, total.quantize(Decimal("0.01")), tanggal, metode


@transaction.atomic
def posting(data):
    """Buat (atau kembalikan yang sudah ada) jurnal untuk satu pembayaran uang makan HR."""
    hr_id, total, tanggal, metode = _parse(data)
    ada = _jurnal_aktif(hr_id)
    if ada is not None:
        return ada, False
    biaya, kas = _akun(metode)
    nama = str(data.get("nama") or f"karyawan HR #{data.get('hr_employee_id')}")[:80]
    periode = f"{data.get('minggu_mulai')} s.d. {data.get('minggu_selesai')}"
    deskripsi = f"Uang makan {nama} {periode} ({metode}, HR #{hr_id})"
    try:
        entry = create_journal_entry(
            date=tanggal,
            lines=[
                {"account": biaya, "debit": total, "kredit": NOL, "description": deskripsi},
                {"account": kas, "debit": NOL, "kredit": total, "description": deskripsi},
            ],
            description=deskripsi, source_type=SUMBER, source_id=hr_id, created_by=None,
        )
    except ValidationError as exc:
        raise UangMakanError(pp._pesan(exc))
    return entry, True


@transaction.atomic
def batal(data):
    """Balik jurnal pembayaran yang dibatalkan di HR. Tanpa jurnal aktif = tidak ada yang dibalik."""
    try:
        hr_id = int(data.get("hr_pembayaran_id"))
    except (TypeError, ValueError):
        raise UangMakanError("Id pembayaran uang makan dari HR tidak valid.")
    entry = _jurnal_aktif(hr_id)
    if entry is None:
        return None
    try:
        return pp._balik(entry, None, f"Pembayaran uang makan HR #{hr_id} dibatalkan di HR.")
    except pp.PayrollError as exc:
        raise UangMakanError(str(exc))
