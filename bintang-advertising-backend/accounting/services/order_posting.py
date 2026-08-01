"""
accounting/services/order_posting.py

T-202: Posting pembayaran Order (DP / pelunasan) ke accounting.JournalEntry.

Pola identik dengan pos_posting.py — fail-open untuk bisnis (gating), idempotent
(source_id = OrderActivityLog.id), atomic bersama transaksi bayar() di view.

Dilarang memanggil JournalEntry.objects.create() langsung (M2) — semua posting
wajib lewat create_journal_entry() dari accounting/services/journal.py.
"""
import logging
from decimal import Decimal
from typing import Optional

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from ..models import AccountingSettings, JournalEntry
from .journal import create_journal_entry

logger = logging.getLogger(__name__)


def should_post_order_payment(order, jumlah_bayar: Decimal, payment_date=None) -> tuple[bool, str]:
    """
    Evaluasi apakah pembayaran Order dapat dan harus diposting ke JournalEntry.
    Mengembalikan (is_eligible, reason).

    Gating fail-open: kembalikan False (skip tanpa error) untuk kondisi modul
    belum aktif / konfigurasi belum lengkap. Kembalikan True hanya jika semua
    syarat terpenuhi → posting wajib dan atomic.
    """
    if jumlah_bayar <= Decimal("0"):
        return False, "Jumlah bayar nol atau negatif — tidak ada yang diposting."

    settings_row = AccountingSettings.objects.first()
    if not settings_row:
        return False, "Pengaturan akuntansi belum diinisialisasi."
    if not settings_row.is_active:
        return False, "Modul akuntansi sedang dinonaktifkan."
    if not settings_row.initial_setup_completed_at:
        return False, "Setup awal akuntansi belum diselesaikan."
    if not settings_row.order_sales_revenue_account_id:
        return False, "Akun pendapatan Order (order_sales_revenue_account) belum diatur di Pengaturan Akuntansi."

    tanggal = payment_date or timezone.localdate()
    if tanggal < settings_row.accounting_start_date:
        return False, (
            f"Tanggal pembayaran {tanggal} sebelum Mulai Akuntansi "
            f"({settings_row.accounting_start_date})."
        )

    if not order.accounting_payment_method_id:
        return False, (
            f"Metode pembayaran '{order.metode_pembayaran}' belum dipetakan ke "
            f"accounting.PaymentMethod. Pembayaran tetap diterima; posting dapat dipulihkan "
            f"lewat 'python manage.py backfill_order_journals' setelah mapping dikonfigurasi."
        )

    if not order.accounting_payment_method.account_id:
        return False, (
            f"PaymentMethod '{order.accounting_payment_method.name}' belum memiliki "
            f"Akun Kas/Bank. Pembayaran tetap diterima."
        )

    return True, "OK"


def resolve_and_assign_order_payment_method(order, metode_str: Optional[str] = None):
    """
    Resolve accounting_payment_method dan settlement_status untuk Order
    dari string metode_pembayaran (mis. 'tunai', 'transfer', 'qris', dsb).

    Mencoba lookup:
    1. POSPaymentMethod (nama / tipe case-insensitive) -> accounting_payment_method
    2. PaymentMethod (name / payment_type case-insensitive)
    3. Fallback jika 'tunai' / 'cash' -> PaymentMethod.is_cash=True
    """
    from api.models import POSPaymentMethod
    from ..models import PaymentMethod

    if metode_str is None:
        metode_str = getattr(order, "metode_pembayaran", "") or ""
    metode_clean = (metode_str or "").strip()

    pm_accounting = None
    pos_pm = None
    if metode_clean:
        pos_pm = POSPaymentMethod.objects.filter(nama__iexact=metode_clean).first()
        if not pos_pm:
            pos_pm = POSPaymentMethod.objects.filter(tipe__iexact=metode_clean).first()
        if pos_pm and pos_pm.accounting_payment_method_id:
            pm_accounting = pos_pm.accounting_payment_method

        if not pm_accounting:
            pm_accounting = PaymentMethod.objects.filter(name__iexact=metode_clean).first()
        if not pm_accounting:
            pm_accounting = PaymentMethod.objects.filter(payment_type__iexact=metode_clean).first()
        if not pm_accounting and metode_clean.lower() in ("cash", "tunai"):
            pm_accounting = PaymentMethod.objects.filter(is_cash=True).first()

    order.accounting_payment_method = pm_accounting

    # T-211: order non-tunai masuk batch settlement ledger-based; pembayaran
    # tunai langsung masuk kas dan tidak menunggu settlement.

    # T-211 (desain review): Order belum ikut settlement — selalu not_applicable.
    order.settlement_status = (
        "unsettled" if pm_accounting and not pm_accounting.is_cash else "not_applicable"
    )

    return order


def post_order_payment_journal(
    order,
    activity_log=None,
    actor=None,
    jumlah_bayar: Optional[Decimal] = None,
    is_dp: bool = False,
) -> Optional[JournalEntry]:
    """
    Posting satu pembayaran Order ke JournalEntry.
    """
    if jumlah_bayar is None:
        jumlah_bayar = Decimal(str(order.dp_dibayar or 0))
    else:
        jumlah_bayar = Decimal(str(jumlah_bayar))

    payment_date = timezone.localdate()
    if activity_log:
        source_id = activity_log.id
    else:
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.filter(order=order, tindakan='PAYMENT').last()
        if not log:
            log = OrderActivityLog.objects.create(
                order=order,
                user=actor if hasattr(actor, 'is_authenticated') else None,
                tindakan='PAYMENT',
                keterangan=f'Pembayaran Order {order.id}',
            )
        source_id = log.id

    # 2. Idempotency: cek apakah entry sudah ada untuk activity_log ini (M4)
    existing_entry = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.ORDER_PAYMENT,
        source_id=source_id,
    ).exclude(status=JournalEntry.Status.VOID).first()
    if existing_entry:
        return existing_entry

    # 2b. Auto-resolve accounting_payment_method jika belum terisi di order instance
    if not order.accounting_payment_method_id:
        resolve_and_assign_order_payment_method(order)
        if order.accounting_payment_method_id:
            order.save(update_fields=["accounting_payment_method", "settlement_status"])

    # 3. Gating check — skip tanpa error jika kondisi belum terpenuhi
    eligible, reason = should_post_order_payment(order, jumlah_bayar, payment_date)

    if not eligible:
        logger.warning(
            "Posting jurnal Order #%s di-skip: %s", order.id, reason
        )
        return None

    # 4. Ambil konfigurasi yang sudah divalidasi gating
    settings_row = AccountingSettings.objects.first()
    pm = order.accounting_payment_method
    tipe_bayar = "DP" if is_dp else "Pelunasan/Cicilan"
    metode_label = order.metode_pembayaran or "tunai"
    description = (
        f"Pembayaran Order {order.id} — {tipe_bayar} via {metode_label.upper()}"
    )

    # 5. Bangun baris jurnal (T-202 §3)
    # Baris 1: DEBIT Kas/Bank/Transit (PaymentMethod.account)
    # Baris 2: KREDIT Pendapatan Order (AccountingSettings.order_sales_revenue_account)
    transit_status = "unsettled" if (pm and not pm.is_cash) else "not_applicable"
    lines = [
        {
            "account": pm.account,
            "debit": jumlah_bayar,
            "kredit": Decimal("0"),
            "description": f"Pembayaran Order ({metode_label.upper()})",
            "settlement_status": transit_status,
        },
        {
            "account": settings_row.order_sales_revenue_account,
            "debit": Decimal("0"),
            "kredit": jumlah_bayar,
            "description": description,
            "settlement_status": "not_applicable",
        },
    ]

    # 6. Posting via create_journal_entry() (M2), retry ≤3x untuk collision entry_number
    max_retries = 3
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                entry = create_journal_entry(
                    date=payment_date,
                    lines=lines,
                    description=description,
                    source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                    source_id=source_id,
                    created_by=actor,
                    status=JournalEntry.Status.POSTED,
                )
                return entry
        except IntegrityError as exc:
            if attempt == max_retries - 1:
                # Race condition: cek sekali lagi sebelum re-raise
                existing = JournalEntry.objects.filter(
                    source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                    source_id=source_id,
                ).exclude(status=JournalEntry.Status.VOID).first()
                if existing:
                    return existing
                raise exc
            # Retry — entry_number collision biasanya selesai di attempt ke-2
    return None


def compute_order_material_hpp(order) -> Decimal:
    """
    T-204: Total HPP bahan baku Order, dari job (JobBoard) milik item Order ini
    yang mengonsumsi InventoryItem (sistem inventori lama — RestockHistory,
    bukan Product/StockLayer FIFO yang dipakai POS/T-107).

    Sumber: baris RestockHistory bertanda "Job #<id>" di kolom `keterangan`
    (satu-satunya tautan yang ada saat ini — tidak ada FK langsung job->history).
    `cost_per_unit`/`delta` disimpan sebagai float di model lama; dikonversi ke
    Decimal via str() di titik ini (M1) supaya tidak ada aritmetika uang dalam
    float lolos ke jurnal.
    """
    import re

    from api.models import RestockHistory

    job_ids = {job.id for item in order.items.all() for job in item.jobs.all()}
    if not job_ids:
        return Decimal("0")

    pola = re.compile(r"Job #(\d+)")
    total = Decimal("0")
    qs = RestockHistory.objects.filter(
        delta__lt=0, keterangan__icontains="Job #"
    ).select_related("item")
    for h in qs:
        m = pola.search(h.keterangan or "")
        if not m or int(m.group(1)) not in job_ids:
            continue
        total += Decimal(str(abs(h.delta))) * Decimal(str(h.item.cost_per_unit or 0))
    return total


def post_order_material_hpp_journal(order, actor=None, activity_log=None) -> Optional[JournalEntry]:
    """
    T-204: Posting HPP bahan baku Order (D HPP / K Persediaan Bahan Baku) saat
    Order diselesaikan. Idempotent lewat source_id = OrderActivityLog (aksi
    'COMPLETE') — Order.id adalah string, tidak bisa jadi source_id langsung
    (PositiveIntegerField).
    """
    if activity_log is None:
        from api.models import OrderActivityLog

        log = OrderActivityLog.objects.filter(order=order, tindakan="COMPLETE").last()
        if not log:
            return None
        activity_log = log

    existing_entry = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.ORDER_MATERIAL_HPP,
        source_id=activity_log.id,
    ).exclude(status=JournalEntry.Status.VOID).first()
    if existing_entry:
        return existing_entry

    hpp_amount = compute_order_material_hpp(order)
    if hpp_amount <= Decimal("0"):
        return None

    settings_row = AccountingSettings.objects.first()
    if not settings_row or not settings_row.is_active or not settings_row.initial_setup_completed_at:
        logger.warning("Posting HPP Order #%s di-skip: akuntansi belum aktif/setup.", order.id)
        return None
    if not settings_row.order_hpp_expense_account_id or not settings_row.order_material_inventory_account_id:
        logger.warning(
            "Posting HPP Order #%s di-skip: order_hpp_expense_account/"
            "order_material_inventory_account belum diatur di Pengaturan Akuntansi.",
            order.id,
        )
        return None

    lines = [
        {
            "account": settings_row.order_hpp_expense_account,
            "debit": hpp_amount,
            "kredit": Decimal("0"),
            "description": f"HPP Bahan Baku Order {order.id}",
        },
        {
            "account": settings_row.order_material_inventory_account,
            "debit": Decimal("0"),
            "kredit": hpp_amount,
            "description": f"Pengurangan Persediaan Bahan Baku Order {order.id}",
        },
    ]

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                return create_journal_entry(
                    date=timezone.localdate(),
                    lines=lines,
                    description=f"HPP Bahan Baku Order {order.id}",
                    source_type=JournalEntry.SourceType.ORDER_MATERIAL_HPP,
                    source_id=activity_log.id,
                    created_by=actor,
                    status=JournalEntry.Status.POSTED,
                )
        except IntegrityError as exc:
            if attempt == max_retries - 1:
                existing = JournalEntry.objects.filter(
                    source_type=JournalEntry.SourceType.ORDER_MATERIAL_HPP,
                    source_id=activity_log.id,
                ).exclude(status=JournalEntry.Status.VOID).first()
                if existing:
                    return existing
                raise exc
    return None


def post_order_reversal_journal(
    order,
    actor=None,
    description_prefix: str = "Pembalikan Order",
):
    """
    Membuat jurnal pembalik untuk semua JournalEntry Order yang sudah diposting.
    Dipanggil saat Order dibatalkan atau diretur.
    """
    from api.models import OrderActivityLog

    payment_log_ids = list(
        OrderActivityLog.objects.filter(order=order, tindakan="PAYMENT").values_list("id", flat=True)
    )

    valid_source_ids = [int(pid) for pid in payment_log_ids if pid]
    if isinstance(order.id, int):
        valid_source_ids.append(order.id)

    entries_to_reverse = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.ORDER_PAYMENT,
        status=JournalEntry.Status.POSTED,
        source_id__in=valid_source_ids,
    )

    reversal_entries = []
    today = timezone.localdate()

    for orig_entry in entries_to_reverse:
        # Check idempotency
        existing_reversal = JournalEntry.objects.filter(
            reversed_entry=orig_entry,
            status=JournalEntry.Status.POSTED,
        ).first()
        if existing_reversal:
            reversal_entries.append(existing_reversal)
            continue

        reversed_lines = []
        for line in orig_entry.lines.all():
            new_settlement_status = "void" if line.settlement_status == "unsettled" else "not_applicable"
            reversed_lines.append({
                "account": line.account,
                "debit": line.kredit,
                "kredit": line.debit,
                "description": f"Pembalikan JE#{orig_entry.entry_number or orig_entry.id} — {line.description}",
                "settlement_status": new_settlement_status,
            })
            if line.settlement_status == "unsettled":
                line.settlement_status = "void"
                line.save(update_fields=["settlement_status"])

        reversal = create_journal_entry(
            date=today,
            lines=reversed_lines,
            description=f"{description_prefix} #{order.id} (Pembalikan JE#{orig_entry.entry_number or orig_entry.id})",
            source_type=orig_entry.source_type,
            source_id=None,
            created_by=actor,
            status=JournalEntry.Status.POSTED,
        )
        reversal.reversed_entry = orig_entry
        reversal.save(update_fields=["reversed_entry"])

        reversal_entries.append(reversal)

    return reversal_entries
