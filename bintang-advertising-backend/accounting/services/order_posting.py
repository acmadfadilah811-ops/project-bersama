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


def post_order_payment_journal(
    order,
    activity_log,
    actor=None,
    jumlah_bayar: Optional[Decimal] = None,
    is_dp: bool = False,
) -> Optional[JournalEntry]:
    """
    Posting satu pembayaran Order ke JournalEntry.

    Idempotent: jika JournalEntry dengan source_type=ORDER_PAYMENT dan
    source_id=activity_log.id sudah ada (non-VOID), kembalikan entry tersebut.

    Gating: jika syarat should_post_order_payment() tidak terpenuhi, di-skip
    dengan log. Jika syarat terpenuhi tapi create_journal_entry() gagal, exception
    di-propagate (bayar() akan rollback seluruh transaksi — M5).

    Args:
        order: instance Order yang sudah di-save.
        activity_log: instance OrderActivityLog(tindakan='PAYMENT') yang baru dibuat.
        actor: user yang memicu pembayaran (untuk created_by di JournalEntry).
        jumlah_bayar: Decimal, jumlah yang dibayarkan. Jika None, diambil dari
                      order.dp_dibayar (untuk DP via perform_create).
        is_dp: True untuk DP awal, dipakai di deskripsi jurnal saja.
    """
    # 1. Tentukan nominal dari parameter eksplisit (lebih aman daripada re-read model)
    if jumlah_bayar is None:
        jumlah_bayar = Decimal(str(order.dp_dibayar or 0))
    else:
        jumlah_bayar = Decimal(str(jumlah_bayar))

    payment_date = timezone.localdate()

    # 2. Idempotency: cek apakah entry sudah ada untuk activity_log ini (M4)
    existing_entry = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.ORDER_PAYMENT,
        source_id=activity_log.id,
    ).exclude(status=JournalEntry.Status.VOID).first()
    if existing_entry:
        return existing_entry

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
    lines = [
        {
            "account": pm.account,
            "debit": jumlah_bayar,
            "kredit": Decimal("0"),
            "description": f"Pembayaran Order ({metode_label.upper()})",
        },
        {
            "account": settings_row.order_sales_revenue_account,
            "debit": Decimal("0"),
            "kredit": jumlah_bayar,
            "description": description,
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
                    source_id=activity_log.id,
                    created_by=actor,
                    status=JournalEntry.Status.POSTED,
                )
                return entry
        except IntegrityError as exc:
            if attempt == max_retries - 1:
                # Race condition: cek sekali lagi sebelum re-raise
                existing = JournalEntry.objects.filter(
                    source_type=JournalEntry.SourceType.ORDER_PAYMENT,
                    source_id=activity_log.id,
                ).exclude(status=JournalEntry.Status.VOID).first()
                if existing:
                    return existing
                raise exc
            # Retry — entry_number collision biasanya selesai di attempt ke-2
    return None
