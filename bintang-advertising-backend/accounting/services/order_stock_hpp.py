"""Jurnal HPP untuk mutasi stok produk milik Order (2026-09-28).

Penjualan lewat Order (Antrean, Buat Order, checkout DP kasir, addon) sudah
memotong stok lewat lapisan FIFO dan menyimpan `hpp_total` di mutasinya, tetapi
tidak pernah dijurnal: hanya POSSale yang memposting HPP (pos_posting.py).
Akibatnya saldo Persediaan di buku besar lebih besar dari nilai stok riil dan
Tutup Buku ditolak oleh rekonsiliasi persediaan.

Satu jurnal per mutasi (source_id = ProductStockMovement.id, M4):
- 'penjualan'    : Debit HPP / Kredit Persediaan senilai hpp_total.
- 'pengembalian' : kebalikannya (pembatalan order mengembalikan lapisan FIFO),
  dibatasi sebesar HPP order ini yang memang pernah dijurnal -- order lama
  sebelum perbaikan ini tidak punya jurnal HPP, jadi pembatalannya juga tidak
  boleh membuat jurnal pembalik yang tidak ada pasangannya.

Akun sama dengan HPP POS (pos_cogs_expense_account / pos_inventory_account),
karena keduanya memakai lapisan FIFO produk yang sama.
"""
import logging
from decimal import Decimal

from django.db.models import Sum

from ..models import AccountingSettings, JournalEntry, JournalEntryLine
from .journal import create_journal_entry

logger = logging.getLogger(__name__)

TIPE_DIJURNAL = ("penjualan", "pengembalian")


def perlu_dijurnal(movement):
    return bool(
        movement.order_id
        and not movement.pos_sale_id
        and movement.tipe in TIPE_DIJURNAL
        and Decimal(str(movement.hpp_total or 0)) > 0
    )


def _hpp_terjurnal_order(order_id, akun_hpp_id):
    """Saldo HPP (debit - kredit) jurnal mutasi order ini yang sudah terposting."""
    from api.product_models import ProductStockMovement

    mutasi_ids = ProductStockMovement.objects.filter(order_id=order_id).values_list("id", flat=True)
    agg = JournalEntryLine.objects.filter(
        journal_entry__source_type=JournalEntry.SourceType.ORDER_STOCK_HPP,
        journal_entry__source_id__in=list(mutasi_ids),
        journal_entry__status=JournalEntry.Status.POSTED,
        account_id=akun_hpp_id,
    ).aggregate(d=Sum("debit"), k=Sum("kredit"))
    return Decimal(str(agg["d"] or 0)) - Decimal(str(agg["k"] or 0))


def posting_hpp_mutasi_order(movement, actor=None):
    """Posting jurnal HPP satu mutasi Order. Idempoten; mengembalikan
    JournalEntry atau None bila tidak perlu/tidak bisa dijurnal (akuntansi
    belum aktif, akun belum diatur, tanggal sebelum Mulai Akuntansi)."""
    if not perlu_dijurnal(movement):
        return None

    existing = JournalEntry.objects.filter(
        source_type=JournalEntry.SourceType.ORDER_STOCK_HPP, source_id=movement.id,
    ).exclude(status=JournalEntry.Status.VOID).first()
    if existing:
        return existing

    settings_row = AccountingSettings.objects.first()
    if not settings_row or not settings_row.is_active or not settings_row.initial_setup_completed_at:
        return None
    if not settings_row.pos_cogs_expense_account_id or not settings_row.pos_inventory_account_id:
        logger.warning(
            "Jurnal HPP mutasi order #%s di-skip: akun HPP/Persediaan POS belum diatur.", movement.id,
        )
        return None

    tanggal = movement.tanggal or movement.created_at.date()
    if tanggal < settings_row.accounting_start_date:
        return None

    jumlah = Decimal(str(movement.hpp_total)).quantize(Decimal("0.01"))
    if movement.tipe == "pengembalian":
        jumlah = min(jumlah, _hpp_terjurnal_order(movement.order_id, settings_row.pos_cogs_expense_account_id))
        if jumlah <= 0:
            return None

    hpp = settings_row.pos_cogs_expense_account
    persediaan = settings_row.pos_inventory_account
    nama = movement.product.nama
    if movement.tipe == "penjualan":
        lines = [
            {"account": hpp, "debit": jumlah, "kredit": Decimal("0"), "description": f"HPP {nama} - Order {movement.order_id}"},
            {"account": persediaan, "debit": Decimal("0"), "kredit": jumlah,
             "description": f"Pengurangan persediaan {nama} - Order {movement.order_id}"},
        ]
        judul = f"HPP penjualan Order {movement.order_id} ({nama})"
    else:
        lines = [
            {"account": persediaan, "debit": jumlah, "kredit": Decimal("0"),
             "description": f"Persediaan kembali {nama} - Order {movement.order_id}"},
            {"account": hpp, "debit": Decimal("0"), "kredit": jumlah, "description": f"Batal HPP {nama} - Order {movement.order_id}"},
        ]
        judul = f"Pembalikan HPP Order {movement.order_id} ({nama})"

    return create_journal_entry(
        date=tanggal,
        lines=lines,
        description=judul,
        source_type=JournalEntry.SourceType.ORDER_STOCK_HPP,
        source_id=movement.id,
        created_by=actor if getattr(actor, "is_authenticated", False) else None,
    )
