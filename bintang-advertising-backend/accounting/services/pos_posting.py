import logging
from decimal import Decimal
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from api.pos_models import POSSale
from ..models import AccountingSettings, JournalEntry
from .journal import create_journal_entry

logger = logging.getLogger(__name__)


def should_post_sale(sale: POSSale) -> tuple[bool, str]:
    """
    Evaluasi apakah transaksi POSSale dapat dan harus diposting ke Jurnal.
    Mengembalikan (is_eligible, reason).
    """
    if sale.status != "paid":
        return False, "Status transaksi bukan 'paid'."

    settings_row = AccountingSettings.objects.first()
    if not settings_row:
        return False, "Pengaturan akuntansi belum diinisialisasi."
    if not settings_row.is_active:
        return False, "Modul akuntansi sedang dinonaktifkan."
    if not settings_row.initial_setup_completed_at:
        return False, "Setup awal akuntansi belum diselesaikan."
    if not settings_row.pos_sales_revenue_account_id:
        return False, "Akun pendapatan penjualan POS (pos_sales_revenue_account) belum diatur."

    sale_date = timezone.localdate(sale.created_at) if sale.created_at else timezone.localdate()
    if sale_date < settings_row.accounting_start_date:
        return False, f"Tanggal transaksi {sale_date} sebelum Mulai Akuntansi ({settings_row.accounting_start_date})."

    if not sale.accounting_payment_method_id:
        return False, f"Metode bayar '{sale.metode_bayar}' belum dipetakan ke Accounting PaymentMethod."

    if not sale.accounting_payment_method.account_id:
        return False, f"PaymentMethod '{sale.accounting_payment_method.name}' belum memiliki Akun Kas/Piutang Transit."

    pajak_amount = Decimal(str(sale.pajak or 0))
    if pajak_amount > Decimal("0") and not settings_row.pos_ppn_output_account_id:
        return False, "Akun PPN Keluaran POS (pos_ppn_output_account) belum diatur di Pengaturan Akuntansi."

    return True, "OK"


def post_pos_sale_journal(sale: POSSale, actor=None) -> Optional[JournalEntry]:
    """
    Posting transaksi POSSale (berstatus 'paid') ke JournalEntry.
    Idempotent: jika transaksi sudah memiliki JournalEntry aktif, kembalikan entry tersebut.
    Gating: jika syarat terpenuhi, jurnal diposting. Jika mapping metode bayar belum diisi,
    posting di-skip + warning log (sale tetap dapat disimpan, backfill command dapat memulihkan nanti).
    """
    # 1. Idempotency Check (M4)
    existing_entry = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.POS_SALE,
        source_id=sale.id,
    ).exclude(status=JournalEntry.Status.VOID).first()

    if existing_entry:
        return existing_entry

    # 2. Gating Check
    eligible, reason = should_post_sale(sale)
    if not eligible:
        logger.warning(f"Posting jurnal POSSale #{sale.nomor} di-skip: {reason}")
        return None

    settings_row = AccountingSettings.objects.first()
    pm = sale.accounting_payment_method
    sale_date = timezone.localdate(sale.created_at) if sale.created_at else timezone.localdate()

    total_amount = Decimal(str(sale.total or 0))
    pajak_amount = Decimal(str(sale.pajak or 0))
    revenue_amount = total_amount - pajak_amount

    # Build Journal Lines (T-102 §2)
    # Line 1: DEBIT Akun Kas/Piutang Transit (PaymentMethod.account)
    lines = [
        {
            "account": pm.account,
            "debit": total_amount,
            "kredit": Decimal("0"),
            "description": f"Pembayaran POS ({sale.metode_bayar})",
        },
        # Line 2: KREDIT Akun Pendapatan Penjualan POS (net revenue)
        {
            "account": settings_row.pos_sales_revenue_account,
            "debit": Decimal("0"),
            "kredit": revenue_amount,
            "description": f"Penjualan POS {sale.nomor}",
        },
    ]

    # Line 3 (Opsional): KREDIT Akun PPN Keluaran jika pajak > 0
    if pajak_amount > Decimal("0"):
        lines.append({
            "account": settings_row.pos_ppn_output_account,
            "debit": Decimal("0"),
            "kredit": pajak_amount,
            "description": f"PPN Keluaran POS {sale.nomor}",
        })

    # Execute posting via create_journal_entry (M2) with retry for entry_number collisions
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                entry = create_journal_entry(
                    date=sale_date,
                    lines=lines,
                    description=f"Penjualan POS {sale.nomor}",
                    source_type=JournalEntry.SourceType.POS_SALE,
                    source_id=sale.id,
                    created_by=actor or sale.kasir,
                    status=JournalEntry.Status.POSTED,
                )
                return entry
        except IntegrityError as exc:
            if attempt == max_retries - 1:
                # Re-check if another concurrent request created the entry
                existing = JournalEntry.objects.filter(
                    source_type=JournalEntry.SourceType.POS_SALE,
                    source_id=sale.id,
                ).exclude(status=JournalEntry.Status.VOID).first()
                if existing:
                    return existing
                raise exc
    return None
