"""Posting akuntansi yang terkait dengan dokumen stok Pembelian."""

from decimal import Decimal, ROUND_HALF_UP

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError

from accounting.models import Account, JournalEntry
from accounting.services.journal import create_journal_entry
from accounting.services.purchase_accounts import get_purchase_account_mappings


def post_stock_journal(document, actor, *, direction="in"):
    """Post stok Pembelian dan aplikasi DP secara idempoten per dokumen stok.

    PENTING: hitung `amount` dari `document.movements` (ProductStockMovement,
    related_name='movements'), BUKAN `document.items` -- StockInDocument/
    StockOutDocument punya DUA relasi item yang berbeda: `items`
    (StockInDocumentItem/StockOutDocumentItem, diisi alur "Stok Masuk/Keluar"
    manual lewat add-item) dan `movements` (ProductStockMovement, diisi SEMUA
    jalur termasuk alur Pembelian -> Terima Barang/Retur di
    PurchaseViewSet._apply_purchase_stock). Dokumen yang dibuat dari
    Pembelian TIDAK PERNAH mengisi `items`, cuma `movements` -- pakai `items`
    di sini bikin `amount` selalu 0 dan jurnal SILAM tidak pernah terposting
    untuk setiap Pembelian yang diterima/diretur (bug ditemukan audit
    2026-09-08, terverifikasi lewat tes langsung di production: stok
    bertambah benar tapi nol jurnal pernah tercipta). `movements` diisi oleh
    KEDUA alur (manual maupun Pembelian) jadi aman dipakai di sini.
    """
    # `harga_beli` di ProductStockMovement cuma diisi untuk mutasi MASUK
    # ('harga beli per unit saat stok masuk', lihat ProductStockMovement).
    # Mutasi KELUAR (retur) nilainya ada di `hpp_total`, hasil konsumsi
    # lapisan FIFO (api/stock_fifo.py::consume_layers) -- pakai qty*harga_beli
    # untuk retur akan selalu 0 karena harga_beli-nya null.
    if direction == "in":
        amount = sum(
            (Decimal(str(mv.qty or 0)) * Decimal(str(mv.harga_beli or 0))
             for mv in document.movements.all()),
            Decimal("0"),
        ).quantize(Decimal("1"))
    else:
        amount = sum(
            (Decimal(str(mv.hpp_total or 0)) for mv in document.movements.all()),
            Decimal("0"),
        ).quantize(Decimal("1"))
    if amount <= 0:
        return None

    source_type = JournalEntry.SourceType.STOCK_IN if direction == "in" else JournalEntry.SourceType.STOCK_OUT
    existing = JournalEntry.objects.filter(source_type=source_type, source_id=document.id).exclude(
        status=JournalEntry.Status.VOID,
    ).first()
    if existing:
        return existing

    supplier = getattr(getattr(document, "purchase", None), "supplier_ref", None)
    try:
        accounts = get_purchase_account_mappings(supplier=supplier)
    except DjangoValidationError as exc:
        raise ValidationError(getattr(exc, "messages", [str(exc)])) from exc
    inventory, payable, advance = accounts["inventory"], accounts["payable"], accounts["advance"]
    label = "Stok masuk" if direction == "in" else "Retur stok"

    # Diskon & PPN dokumen pembelian (2026-09-24): Persediaan dicatat NETTO
    # (subtotal - diskon), PPN masuk ke PPN Masukan, dan Hutang = netto + PPN --
    # sama dengan Purchase.total sehingga pembayaran melunasi hutang persis.
    # Harga beli di Stok Masuk sudah dialokasikan netto (dibulatkan 2 desimal);
    # selisih pembulatan itu diserap ke Persediaan supaya jurnal tepat rupiah.
    # Kalau qty Stok Masuk diubah gudang (di luar toleransi pembulatan), jurnal
    # mengikuti nilai aktual dan PPN diskalakan proporsional.
    pajak_doc = Decimal("0")
    purchase_doc = getattr(document, "purchase", None) if direction == "in" else None
    if purchase_doc is not None:
        ring = purchase_doc.hitung_ringkasan()
        net_target = ring["subtotal"] - ring["diskon"]
        if ring["diskon"] > 0 and net_target > 0:
            toleransi = sum(
                (Decimal(str(mv.qty or 0)) for mv in document.movements.all()), Decimal("0"),
            ) * Decimal("0.005") + 1
            if abs(amount - net_target) <= toleransi:
                amount = net_target.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        if ring["pajak"] > 0 and net_target > 0:
            pajak_doc = (ring["pajak"] * amount / net_target).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    ppn_masukan = None
    if pajak_doc > 0:
        ppn_masukan = Account.objects.filter(
            code="11750", is_active=True, account_type=Account.AccountType.ASSET,
        ).first()
        if not ppn_masukan:
            raise ValidationError("Akun PPN Masukan (11750, tipe Aset) wajib tersedia dan aktif untuk pembelian ber-PPN.")

    lines = [
        {
            "account": inventory if direction == "in" else payable,
            "debit": amount,
            "kredit": 0,
            "description": f"{label} {document.nomor}",
            "external_document_no": document.nomor,
        },
        {
            "account": payable if direction == "in" else inventory,
            "debit": 0,
            "kredit": amount,
            "description": f"{label} {document.nomor}",
            "external_document_no": document.nomor,
        },
    ]

    if pajak_doc > 0:
        lines[1]["kredit"] = amount + pajak_doc
        lines.insert(1, {
            "account": ppn_masukan,
            "debit": pajak_doc,
            "kredit": 0,
            "description": f"PPN Masukan {document.nomor}",
            "external_document_no": document.nomor,
        })

    purchase = getattr(document, "purchase", None)
    if direction == "in" and purchase:
        from api.product_models import PurchasePayment

        advance_amount = sum(
            (payment.nominal for payment in PurchasePayment.objects.filter(
                purchase=purchase,
                jenis=PurchasePayment.Jenis.ADVANCE,
            )),
            Decimal("0"),
        ).quantize(Decimal("1"))
        if advance_amount > 0:
            lines.extend([
                {
                    "account": payable,
                    "debit": advance_amount,
                    "kredit": 0,
                    "description": f"Aplikasi DP Pembelian {purchase.nomor}",
                    "external_document_no": purchase.nomor,
                },
                {
                    "account": advance,
                    "debit": 0,
                    "kredit": advance_amount,
                    "description": f"Aplikasi DP Pembelian {purchase.nomor}",
                    "external_document_no": purchase.nomor,
                },
            ])

    try:
        return create_journal_entry(
            date=document.tanggal,
            lines=lines,
            description=f"{label} {document.nomor}",
            source_type=source_type,
            source_id=document.id,
            created_by=actor,
        )
    except DjangoValidationError as exc:
        raise ValidationError(getattr(exc, "messages", [str(exc)])) from exc
