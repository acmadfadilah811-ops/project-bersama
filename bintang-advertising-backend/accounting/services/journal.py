from calendar import monthrange
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import (
    AccountingPeriod,
    AccountingSettings,
    JournalAuditLog,
    JournalEntry,
    JournalEntryLine,
)


def _get_or_create_period(entry_date):
    start = entry_date.replace(day=1)
    end = entry_date.replace(day=monthrange(entry_date.year, entry_date.month)[1])
    period, _ = AccountingPeriod.objects.get_or_create(
        start_date=start, end_date=end, defaults={"fiscal_year": entry_date.year},
    )
    # Lock the period while creating a journal so close-period cannot race a
    # posting request and allow a journal into a just-closed period.
    return AccountingPeriod.objects.select_for_update().get(pk=period.pk)


def _generate_entry_number(entry_date):
    prefix = f"JU-{entry_date:%Y%m}-"
    last = (
        JournalEntry.objects
        .filter(entry_number__startswith=prefix)
        .order_by("-entry_number")
        .first()
    )
    next_seq = int(last.entry_number.rsplit("-", 1)[-1]) + 1 if last else 1
    return f"{prefix}{next_seq:04d}"


def build_pair_lines(*, debit_account, kredit_account, amount, description="", external_document_no=""):
    """
    Bentuk 2 baris (debit+kredit) dari satu Jumlah — dipakai Advance/Basic Form
    "Jurnal Tunggal" yang selalu berupa 1 pasang akun debit-kredit senilai sama.
    No. Dokumen (kalau diisi) disalin ke kedua baris, karena Jurnal Tunggal cuma
    punya 1 kolom No. Dokumen untuk pasangannya.
    """
    return [
        {
            "account": debit_account, "debit": amount, "kredit": 0,
            "description": description, "external_document_no": external_document_no,
        },
        {
            "account": kredit_account, "debit": 0, "kredit": amount,
            "description": description, "external_document_no": external_document_no,
        },
    ]


@transaction.atomic
def create_journal_entry(
    *, date, lines, description="", source_type=JournalEntry.SourceType.MANUAL,
    source_id=None, created_by=None, status=JournalEntry.Status.POSTED,
    journal_template=None, department=None,
):
    """
    Buat Journal Entry + lines-nya dalam satu transaksi atomik, dengan validasi
    inti akuntansi (debit=kredit, minimal 2 baris, tidak ada baris kosong/dobel isi).
    Dipakai baik untuk Form Jurnal Tunggal (selalu 2 baris, lihat `build_pair_lines()`)
    maupun Form Multi Jurnal (bebas berapa baris, asal tetap balance) — tidak ada
    pembatasan jumlah baris di sini.

    `lines`: list of {"account", "debit", "kredit", "description"?,
    "external_document_no"?, "supplier"?, "customer"?}
    """
    settings_row = AccountingSettings.objects.first()
    if settings_row and not settings_row.is_active:
        raise ValidationError("Modul akuntansi sedang dihentikan (lihat Log Start/Stop Akuntansi).")
    if settings_row and date < settings_row.accounting_start_date:
        raise ValidationError(
            f"Tanggal {date} sebelum Mulai Akuntansi ({settings_row.accounting_start_date})."
        )

    if len(lines) < 2:
        raise ValidationError("Jurnal minimal punya 2 baris (1 debit, 1 kredit).")

    total_debit = Decimal(0)
    total_kredit = Decimal(0)
    for line in lines:
        debit = Decimal(line.get("debit") or 0)
        kredit = Decimal(line.get("kredit") or 0)
        if debit < 0 or kredit < 0:
            raise ValidationError("Debit/kredit tidak boleh negatif.")
        if debit > 0 and kredit > 0:
            raise ValidationError("Satu baris jurnal tidak boleh isi debit dan kredit sekaligus.")
        if debit == 0 and kredit == 0:
            raise ValidationError("Baris jurnal tidak boleh kosong (debit dan kredit sama-sama 0).")
        total_debit += debit
        total_kredit += kredit

    if total_debit != total_kredit:
        raise ValidationError(
            f"Jurnal tidak balance: total debit {total_debit} != total kredit {total_kredit}."
        )

    period = _get_or_create_period(date)
    if period.status == AccountingPeriod.Status.CLOSED:
        raise ValidationError(f"Periode {period} sudah ditutup (Tutup Buku), tidak bisa posting.")

    entry = JournalEntry.objects.create(
        entry_number=_generate_entry_number(date),
        date=date,
        period=period,
        source_type=source_type,
        source_id=source_id,
        description=description,
        journal_template=journal_template,
        department=department,
        status=status,
        created_by=created_by,
        posted_by=created_by if status == JournalEntry.Status.POSTED else None,
        posted_at=timezone.now() if status == JournalEntry.Status.POSTED else None,
    )
    JournalEntryLine.objects.bulk_create([
        JournalEntryLine(
            journal_entry=entry,
            account=line["account"],
            debit=line.get("debit") or 0,
            kredit=line.get("kredit") or 0,
            description=line.get("description", ""),
            external_document_no=line.get("external_document_no", ""),
            supplier=line.get("supplier"),
            customer=line.get("customer"),
            settlement_status=line.get("settlement_status") or "not_applicable",
        )
        for line in lines
    ])
    JournalAuditLog.objects.create(
        journal_entry=entry,
        action=JournalAuditLog.Action.CREATED,
        actor=created_by,
    )
    if status == JournalEntry.Status.POSTED:
        JournalAuditLog.objects.create(
            journal_entry=entry,
            action=JournalAuditLog.Action.POSTED,
            actor=created_by,
        )
    return entry
