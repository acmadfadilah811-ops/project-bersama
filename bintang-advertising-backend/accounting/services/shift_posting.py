import logging
from decimal import Decimal
from typing import Optional

from django.utils import timezone

from ..models import AccountingSettings, JournalEntry, PaymentMethod
from .journal import create_journal_entry

logger = logging.getLogger(__name__)


def post_shift_cash_variance_journal(ringkasan, actor=None) -> Optional[JournalEntry]:
    """
    Posting selisih kas kasir (kas fisik vs sistem, RingkasanShift.selisih) ke
    Jurnal Umum saat shift ditutup -- pola standar "Cash Over/Short":
    - selisih > 0 (kas fisik LEBIH dari sistem): Debit Kas, Kredit akun Selisih Kas (pendapatan lain).
    - selisih < 0 (kas fisik KURANG dari sistem): Debit akun Selisih Kas (beban lain), Kredit Kas.

    Opsional & non-blocking: kalau sakelar mati, akun belum diatur, tidak ada akun Kas
    tunai aktif, atau selisih nol, posting dilewati (return None) -- shift tetap berhasil
    ditutup baik jurnal terposting atau tidak (bukan validasi tutup buku).
    Idempotent secara alami: dipanggil sekali per RingkasanShift baru (1 shift = 1 ringkasan).
    """
    selisih = Decimal(str(ringkasan.selisih or 0))
    if selisih == 0:
        return None

    settings_row = AccountingSettings.objects.select_related("shift_cash_variance_account").first()
    if not settings_row or not settings_row.shift_cash_variance_auto_post_enabled:
        return None
    if not settings_row.shift_cash_variance_account_id:
        logger.warning(
            "Posting selisih kas shift #%s di-skip: shift_cash_variance_account belum diatur.",
            ringkasan.id,
        )
        return None

    cash_pm = (
        PaymentMethod.objects.filter(is_cash=True, is_active=True)
        .exclude(account__isnull=True)
        .first()
    )
    if not cash_pm:
        logger.warning(
            "Posting selisih kas shift #%s di-skip: tidak ada Cara Pembayaran tunai (is_cash) "
            "aktif dengan akun Kas terpasang.",
            ringkasan.id,
        )
        return None

    variance_account = settings_row.shift_cash_variance_account
    tanggal = timezone.localdate(ringkasan.berakhir) if ringkasan.berakhir else timezone.localdate()
    jumlah = abs(selisih)
    kasir_label = ringkasan.kasir.get_full_name() or ringkasan.kasir.username if ringkasan.kasir else "-"

    if selisih > 0:
        lines = [
            {"account": cash_pm.account, "debit": jumlah, "kredit": Decimal("0"),
             "description": f"Kas lebih shift {kasir_label} ({tanggal})"},
            {"account": variance_account, "debit": Decimal("0"), "kredit": jumlah,
             "description": f"Selisih kas lebih shift {kasir_label}"},
        ]
        deskripsi = f"Selisih kas LEBIH shift {kasir_label} {tanggal}: Rp {jumlah:,.2f}"
    else:
        lines = [
            {"account": variance_account, "debit": jumlah, "kredit": Decimal("0"),
             "description": f"Selisih kas kurang shift {kasir_label}"},
            {"account": cash_pm.account, "debit": Decimal("0"), "kredit": jumlah,
             "description": f"Kas kurang shift {kasir_label} ({tanggal})"},
        ]
        deskripsi = f"Selisih kas KURANG shift {kasir_label} {tanggal}: Rp {jumlah:,.2f}"

    try:
        return create_journal_entry(
            date=tanggal,
            lines=lines,
            description=deskripsi,
            source_type=JournalEntry.SourceType.SHIFT_CASH_VARIANCE,
            source_id=ringkasan.id,
            created_by=actor,
            status=JournalEntry.Status.POSTED,
        )
    except Exception:
        logger.exception("Gagal posting selisih kas shift #%s ke jurnal.", ringkasan.id)
        return None
