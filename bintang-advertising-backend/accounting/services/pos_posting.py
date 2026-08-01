import logging
from decimal import Decimal
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from api.pos_models import POSSale
from ..models import AccountingSettings, JournalEntry
from .journal import create_journal_entry

logger = logging.getLogger(__name__)


def _sale_hpp_total(sale: POSSale) -> Decimal:
    """Total HPP (T-107) dari mutasi stok 'penjualan' milik sale ini (FIFO/fallback,
    lihat api.stock_fifo.consume_layers). 0 kalau tidak ada item berlacak inventori."""
    from api.product_models import ProductStockMovement

    agg = ProductStockMovement.objects.filter(
        pos_sale=sale, tipe="penjualan",
    ).aggregate(t=Sum("hpp_total"))
    return Decimal(str(agg["t"] or 0))


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

    # T-107: HPP/Persediaan wajib dikonfigurasi kalau ada item berlacak inventori terjual.
    if _sale_hpp_total(sale) > Decimal("0"):
        if not settings_row.pos_cogs_expense_account_id:
            return False, "Akun HPP (pos_cogs_expense_account) belum diatur di Pengaturan Akuntansi."
        if not settings_row.pos_inventory_account_id:
            return False, "Akun Persediaan (pos_inventory_account) belum diatur di Pengaturan Akuntansi."

    return True, "OK"


def post_pos_sale_journal(sale: POSSale, actor=None, manual=False) -> Optional[JournalEntry]:
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

    settings_row = AccountingSettings.objects.first()
    if settings_row and not settings_row.pos_auto_post_enabled and not manual:
        return None
    if not sale.accounting_payment_method_id and settings_row and settings_row.default_pos_payment_method_id:
        default_method = settings_row.default_pos_payment_method
        if default_method.is_active and default_method.account_id:
            sale.accounting_payment_method = default_method
            sale.settlement_status = "not_applicable" if default_method.is_cash else "unsettled"
            sale.save(update_fields=["accounting_payment_method", "settlement_status"])

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

    # Line 4-5 (Opsional, T-107): HPP produk berlacak inventori yang terjual.
    # D HPP / K Persediaan — gating pos_cogs_expense_account/pos_inventory_account
    # sudah dipastikan tersedia oleh should_post_sale() di atas.
    hpp_amount = _sale_hpp_total(sale)
    if hpp_amount > Decimal("0"):
        lines.append({
            "account": settings_row.pos_cogs_expense_account,
            "debit": hpp_amount,
            "kredit": Decimal("0"),
            "description": f"HPP Penjualan POS {sale.nomor}",
        })
        lines.append({
            "account": settings_row.pos_inventory_account,
            "debit": Decimal("0"),
            "kredit": hpp_amount,
            "description": f"Pengurangan Persediaan POS {sale.nomor}",
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


@transaction.atomic
def post_pos_void_journal(sale: POSSale, actor=None, reason="Void POS") -> Optional[JournalEntry]:
    """
    Posting jurnal pembalik untuk POSSale yang di-void.
    Idempotent: jika jurnal pembalik sudah pernah dibuat, kembalikan entry tersebut.
    Guard: jika sale awal belum/tidak memiliki JournalEntry (misal modul akuntansi
    belum aktif saat sale dibuat), skip tanpa error + warning log.
    """
    # 1. Cari JournalEntry original yang aktif (bukan entry pembalik) dengan row locking
    original_entry = JournalEntry.objects.select_for_update().filter(
        source_type=JournalEntry.SourceType.POS_SALE,
        source_id=sale.id,
        reversed_entry__isnull=True,
        status=JournalEntry.Status.POSTED,
    ).first()

    if not original_entry:
        logger.warning(f"Void POSSale #{sale.nomor}: Jurnal original tidak ditemukan / belum diposting. Jurnal pembalik di-skip.")
        return None

    # 2. Idempotency check: Cek apakah jurnal pembalik sudah ada
    existing_reversal = JournalEntry.objects.filter(
        reversed_entry=original_entry,
    ).first()

    if existing_reversal:
        return existing_reversal

    # 3. Gating check: Cek modul akuntansi
    settings_row = AccountingSettings.objects.first()
    if settings_row and not settings_row.is_active:
        raise ValidationError("Modul akuntansi sedang dinonaktifkan.")

    today = timezone.localdate()

    # 4. Susun baris jurnal pembalik (DEBIT <-> KREDIT dibalik 1:1)
    reversal_lines = []
    for orig_line in original_entry.lines.all():
        reversal_lines.append({
            "account": orig_line.account,
            "debit": orig_line.kredit,    # Balikkan kredit -> debit
            "kredit": orig_line.debit,    # Balikkan debit -> kredit
            "description": f"Pembalikan {orig_line.description}",
        })

    # 5. Posting jurnal pembalik via create_journal_entry (M2)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                reversal_entry = create_journal_entry(
                    date=today,
                    lines=reversal_lines,
                    description=f"Jurnal Pembalik — {reason} {sale.nomor}",
                    source_type=JournalEntry.SourceType.POS_SALE,
                    source_id=None,
                    created_by=actor or sale.kasir,
                    status=JournalEntry.Status.POSTED,
                )

                # Link reversal_entry ke original_entry
                reversal_entry.reversed_entry = original_entry
                reversal_entry.save(update_fields=["reversed_entry"])

                # Tandai log audit pada original_entry
                from ..models import JournalAuditLog
                JournalAuditLog.objects.create(
                    journal_entry=original_entry,
                    action=JournalAuditLog.Action.REVERSED,
                    actor=actor or sale.kasir,
                    note=f"{reason}; jurnal pembalik JE#{reversal_entry.entry_number}",
                )

                return reversal_entry
        except IntegrityError as exc:
            if attempt == max_retries - 1:
                existing = JournalEntry.objects.filter(reversed_entry=original_entry).first()
                if existing:
                    return existing
                raise exc

    return None
