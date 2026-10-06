"""Balik jurnal "Saldo awal stok" yang produknya sudah dihapus (audit akuntansi 2026-10-06).

    python manage.py koreksi_saldo_awal_stok_yatim             # hanya rencana
    python manage.py koreksi_saldo_awal_stok_yatim --terapkan  # buat jurnal pembalik

Jurnal saldo awal stok (Persediaan 11400 / Saldo Awal) merujuk ke pergerakan stok
'saldo_awal' (source_id). Sebelum aturan services/hapus_produk.py, menghapus produk
ikut menghapus pergerakan & lapisan stoknya tetapi jurnalnya tertinggal, sehingga
Persediaan di buku besar lebih besar dari nilai stok riil dan Tutup Buku ditolak.

Jurnal asli TIDAK dihapus: dibuat jurnal pembalik (debit<->kredit) yang ditautkan
lewat reversed_entry + JournalAuditLog, pola sama dengan pembalikan lain. Aman
diulang (jurnal yang sudah dibalik dilewati).
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounting.models.journal import JournalAuditLog, JournalEntry
from accounting.services.journal import create_journal_entry
from api.product_models import ProductStockMovement


def cari_jurnal_yatim():
    kandidat = JournalEntry.objects.filter(
        status=JournalEntry.Status.POSTED,
        source_type=JournalEntry.SourceType.OPENING_BALANCE,
        description__startswith="Saldo awal stok:",
        source_id__isnull=False,
    ).prefetch_related("lines__account")
    masih_ada = set(
        ProductStockMovement.objects.filter(id__in=[e.source_id for e in kandidat]).values_list("id", flat=True)
    )
    sudah_dibalik = set(
        JournalEntry.objects.filter(status=JournalEntry.Status.POSTED, reversed_entry__in=kandidat)
        .values_list("reversed_entry_id", flat=True)
    )
    return [e for e in kandidat if e.source_id not in masih_ada and e.id not in sudah_dibalik]


def balik(original, actor=None):
    description = f"Pembalikan {original.entry_number}: {original.description} (produk sudah dihapus)"
    lines = [
        {"account": line.account, "debit": line.kredit, "kredit": line.debit, "description": description}
        for line in original.lines.all()
    ]
    with transaction.atomic():
        reversal = create_journal_entry(
            date=timezone.localdate(),
            lines=lines,
            description=description[:255],
            source_type=JournalEntry.SourceType.OPENING_BALANCE,
            source_id=None,
            created_by=actor,
            status=JournalEntry.Status.POSTED,
        )
        reversal.reversed_entry = original
        reversal.save(update_fields=["reversed_entry"])
        JournalAuditLog.objects.create(
            journal_entry=reversal,
            action=JournalAuditLog.Action.REVERSED,
            actor=actor,
            note="Saldo awal stok produk yang sudah dihapus (koreksi_saldo_awal_stok_yatim)",
        )
    return reversal


class Command(BaseCommand):
    help = "Balik jurnal saldo awal stok yang produknya sudah dihapus (default: hanya rencana)."

    def add_arguments(self, parser):
        parser.add_argument("--terapkan", action="store_true", help="Buat jurnal pembalik sungguhan.")

    def handle(self, *args, **opt):
        yatim = cari_jurnal_yatim()
        total = sum(sum(l.debit for l in e.lines.all()) for e in yatim)
        for e in yatim:
            if opt["terapkan"]:
                r = balik(e)
                self.stdout.write(f"DIBALIK  {e.entry_number} -> {r.entry_number} | {e.description}")
            else:
                self.stdout.write(f"RENCANA  {e.entry_number} | {e.description}")
        mode = "dibalik" if opt["terapkan"] else "akan dibalik (jalankan dengan --terapkan)"
        self.stdout.write(self.style.SUCCESS(f"{len(yatim)} jurnal {mode}; total Rp {total:,.0f}".replace(",", ".")))
