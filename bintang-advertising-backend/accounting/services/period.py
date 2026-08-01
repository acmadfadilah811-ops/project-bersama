from calendar import monthrange
from datetime import date
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..models import Account, AccountingPeriod, AccountingLifecycleLog, JournalEntry, JournalEntryLine
from .ledger import get_account_balances


def get_negative_account_balances(as_of_date):
    """
    Saldo abnormal negatif akun aktif pada tanggal akhir periode.
    Akun dengan ignore_minus_closing=True (ditandai manual per akun di Daftar
    Akun, mis. akun transit/kliring yang wajar sementara negatif) dikecualikan
    dari blokir tutup buku.
    """
    accounts = list(
        Account.objects.filter(is_active=True, ignore_minus_closing=False)
        .select_related("classification")
        .order_by("code")
    )
    balances = get_account_balances(accounts, as_of_date)
    return [
        {"code": account.code, "name": account.name, "balance": balances.get(account.id, 0)}
        for account in accounts
        if balances.get(account.id, 0) < 0
    ]


def get_period_journal_lines(period):
    """Baris jurnal posted untuk detail satu periode tutup buku."""
    return (
        JournalEntryLine.objects.filter(
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__date__range=(period.start_date, period.end_date),
        )
        .select_related("journal_entry", "account")
        .order_by("journal_entry__date", "journal_entry__entry_number", "id")
    )


@transaction.atomic
def close_accounting_period(*, period_id=None, start_date=None, end_date=None, actor=None):
    """
    Kunci/tutup periode akuntansi dengan row locking & audit log.
    Idempotent: Jika periode sudah CLOSED, kembalikan periode tersebut tanpa error.
    Safety: Tolak jika ada JournalEntry berstatus DRAFT di rentang periode.
    """
    if period_id:
        period = AccountingPeriod.objects.select_for_update().filter(pk=period_id).first()
        if not period:
            raise ValidationError(f"Periode akuntansi #{period_id} tidak ditemukan.")
        start_date = period.start_date
        end_date = period.end_date
    else:
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)

        if not start_date or not end_date:
            raise ValidationError("Parameter start_date dan end_date (atau period_id) wajib diisi.")

        if start_date > end_date:
            raise ValidationError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir.")

        is_full_month = (
            start_date.day == 1
            and end_date == end_date.replace(day=monthrange(end_date.year, end_date.month)[1])
            and (start_date.year, start_date.month) == (end_date.year, end_date.month)
        )
        if not is_full_month:
            raise ValidationError("Tutup buku saat ini hanya mendukung satu bulan kalender penuh.")

        period, _ = AccountingPeriod.objects.select_for_update().get_or_create(
            start_date=start_date,
            end_date=end_date,
            defaults={"fiscal_year": start_date.year, "status": AccountingPeriod.Status.OPEN},
        )

    # 1. Idempotency Check: Jika sudah CLOSED, kembalikan langsung
    if period.status == AccountingPeriod.Status.CLOSED:
        return period

    # 2. Hard block validation: Cek apakah ada draft entry di periode ini
    has_drafts = JournalEntry.objects.filter(
        date__range=(start_date, end_date),
        status=JournalEntry.Status.DRAFT,
    ).exists()
    if has_drafts:
        raise ValidationError("Masih ada jurnal bertipe DRAFT di periode ini. Harap finalisasi atau hapus draft sebelum tutup buku.")

    # 3. Hard block validation: saldo abnormal negatif (mis. Kas) harus
    # diperbaiki dulu agar periode yang dikunci tetap dapat direkonsiliasi.
    negative_balances = get_negative_account_balances(end_date)
    if negative_balances:
        preview = "; ".join(
            f"{item['code']} - {item['name']}: {item['balance']}"
            for item in negative_balances[:10]
        )
        raise ValidationError(
            "Tutup buku ditolak karena ada saldo akun negatif pada akhir periode: "
            f"{preview}. Perbaiki jurnal atau saldo akun terlebih dahulu."
        )

    # 4. Update Period Status & Audit Trail
    period.status = AccountingPeriod.Status.CLOSED
    period.closed_at = timezone.now()
    period.closed_by = actor
    period.save(update_fields=["status", "closed_at", "closed_by"])

    actor_user = actor if hasattr(actor, "is_authenticated") and actor.is_authenticated else None
    AccountingLifecycleLog.objects.create(
        action=AccountingLifecycleLog.Action.STOP,
        actor=actor_user,
    )

    return period


def close_all_open_periods(*, fiscal_year=None, actor=None):
    """
    Tutup semua periode Terbuka yang sudah berakhir (end_date < hari ini),
    satu per satu urut dari yang tertua. Bulan berjalan yang belum selesai
    tidak ikut. Tiap periode sudah atomic sendiri di close_accounting_period —
    kegagalan satu periode (mis. saldo negatif) tidak menghentikan proses
    periode lain, supaya hasil bulan yang valid tetap tersimpan.
    """
    today = timezone.localdate()
    qs = AccountingPeriod.objects.filter(status=AccountingPeriod.Status.OPEN, end_date__lt=today)
    if fiscal_year:
        qs = qs.filter(fiscal_year=fiscal_year)
    periods = list(qs.order_by("start_date"))

    closed = []
    failed = []
    for period in periods:
        try:
            closed.append(close_accounting_period(period_id=period.id, actor=actor))
        except ValidationError as err:
            failed.append({"period": period, "reason": err.message if hasattr(err, "message") else str(err)})
    return closed, failed


@transaction.atomic
def reopen_accounting_period(*, start_date=None, end_date=None, period_id=None, actor=None):
    """
    Buka kembali (reopen) periode akuntansi yang ditutup dengan row locking & audit log.
    """
    if period_id:
        period = AccountingPeriod.objects.select_for_update().filter(pk=period_id).first()
    else:
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = date.fromisoformat(end_date)
        period = AccountingPeriod.objects.select_for_update().filter(
            start_date=start_date, end_date=end_date
        ).first()

    if not period:
        raise ValidationError(f"Periode akuntansi tidak ditemukan.")

    if period.status == AccountingPeriod.Status.OPEN:
        return period

    period.status = AccountingPeriod.Status.OPEN
    period.closed_at = None
    period.closed_by = None
    period.save(update_fields=["status", "closed_at", "closed_by"])

    actor_user = actor if hasattr(actor, "is_authenticated") and actor.is_authenticated else None
    AccountingLifecycleLog.objects.create(
        action=AccountingLifecycleLog.Action.START,
        actor=actor_user,
    )

    return period
