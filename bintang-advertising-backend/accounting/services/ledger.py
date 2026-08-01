from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum

from ..models import Account, AccountingSettings, JournalEntry, JournalEntryLine


def _sum_debit_kredit(accounts, date_from=None, date_to=None):
    """Agregat debit & kredit mentah per akun (belum diarahkan ke normal_balance), rentang tanggal opsional."""
    qs = JournalEntryLine.objects.filter(account__in=accounts, journal_entry__status=JournalEntry.Status.POSTED)
    if date_from:
        qs = qs.filter(journal_entry__date__gte=date_from)
    if date_to:
        qs = qs.filter(journal_entry__date__lte=date_to)
    totals = qs.values("account_id").annotate(total_debit=Sum("debit"), total_kredit=Sum("kredit"))
    return {row["account_id"]: row for row in totals}


def get_account_balances(accounts, as_of_date):
    """
    Saldo kumulatif tiap akun sampai as_of_date (inklusif), dari JournalEntryLine
    yang statusnya sudah Posted. Return dict {account_id: Decimal}.
    """
    totals_map = _sum_debit_kredit(accounts, date_to=as_of_date)
    balances = {}
    for account in accounts:
        row = totals_map.get(account.id)
        total_debit = row["total_debit"] if row else 0
        total_kredit = row["total_kredit"] if row else 0
        if account.normal_balance == "debit":
            balances[account.id] = (total_debit or 0) - (total_kredit or 0)
        else:
            balances[account.id] = (total_kredit or 0) - (total_debit or 0)
    return balances


def get_account_movements(accounts, date_from, date_to):
    """
    Buku Besar (ringkasan): per akun, saldo_awal (kumulatif sebelum date_from),
    debit & kredit pergerakan dalam rentang date_from..date_to, dan saldo_akhir.
    Return dict {account_id: {"saldo_awal", "debit", "kredit", "saldo_akhir"}}.
    """
    opening_balances = get_account_balances(accounts, date_from - timedelta(days=1))
    period_totals = _sum_debit_kredit(accounts, date_from=date_from, date_to=date_to)

    movements = {}
    for account in accounts:
        row = period_totals.get(account.id)
        debit = row["total_debit"] if row else 0
        kredit = row["total_kredit"] if row else 0
        saldo_awal = opening_balances.get(account.id, 0)
        delta = (debit or 0) - (kredit or 0) if account.normal_balance == "debit" else (kredit or 0) - (debit or 0)
        movements[account.id] = {
            "saldo_awal": saldo_awal,
            "debit": debit or 0,
            "kredit": kredit or 0,
            "saldo_akhir": saldo_awal + delta,
        }
    return movements


def _resolve_pelanggan_supplier(journal_entry, line):
    """
    Nama (+ email bila ada) pelanggan/supplier untuk 1 baris jurnal.

    Prioritas: FK JournalEntryLine.customer/.supplier eksplisit dulu (mis.
    dipilih manual di Form Jurnal Piutang/Hutang) — hanya jalur ini yang
    kompatibel dengan model Customer/Supplier sehingga email tersedia.
    Kalau tidak ada, JANGAN menebak lewat pencocokan nomor HP dsb (risiko
    salah pasang) — ambil nama APA ADANYA langsung dari transaksi asal via
    source_type/source_id. PENTING: source_id BUKAN selalu id dokumen utama
    (mis. `ORDER_PAYMENT` source_id = `OrderActivityLog.id`, bukan `Order.id`
    yang PK-nya string; `PURCHASE_PAYMENT` source_id = `PurchasePayment.id`,
    bukan `Purchase.id`) — lihat services/order_posting.py & purchase_posting.py
    untuk apa yang sebenarnya dikirim sebagai source_id tiap source_type.
    Email untuk jalur ini hanya terisi kalau kontaknya kebetulan tertaut ke
    akun member Customer (Contact.customer, lihat api.models.Contact).
    """
    if line.customer_id:
        return f"Pembeli: {line.customer.nama}", line.customer.email or ""
    if line.supplier_id:
        return f"Supplier: {line.supplier.nama}", line.supplier.email or ""

    source_type, source_id = journal_entry.source_type, journal_entry.source_id
    if not source_id:
        return "", ""

    if source_type == JournalEntry.SourceType.POS_SALE:
        from api.pos_models import POSSale
        sale = POSSale.objects.filter(id=source_id).select_related("pelanggan__customer").first()
        if sale and sale.pelanggan:
            email = sale.pelanggan.customer.email if sale.pelanggan.customer else ""
            return f"Pembeli: {sale.pelanggan.nama}", email or ""
    elif source_type == JournalEntry.SourceType.ORDER_PAYMENT:
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.filter(id=source_id).select_related("order").first()
        if log:
            order = log.order
            from api.models import Contact
            contact = Contact.objects.filter(nomor_wa=order.nomor_wa).select_related("customer").first()
            email = contact.customer.email if contact and contact.customer else ""
            return f"Pembeli: {order.nama}", email or ""
    elif source_type == JournalEntry.SourceType.PURCHASE_PAYMENT:
        from api.product_models import PurchasePayment
        payment = PurchasePayment.objects.filter(id=source_id).select_related("purchase__supplier_ref").first()
        if payment:
            purchase = payment.purchase
            if purchase.supplier_ref:
                return f"Supplier: {purchase.supplier_ref.nama}", purchase.supplier_ref.email or ""
            if purchase.supplier:
                return f"Supplier: {purchase.supplier}", ""

    return "", ""


def _resolve_dilayani_oleh(journal_entry, line):
    """
    Nama karyawan yang melayani pelanggan (bukan kasir/pemroses jurnal —
    lihat `processed_by_name`, itu siapa yang POSTING jurnal, beda konsep).

    Sama seperti `_resolve_pelanggan_supplier`: ambil dari transaksi asal via
    source_type/source_id, bukan tebakan. Field ini opsional di kedua model
    sumber (POSSale.dilayani_oleh, Order.dilayani_oleh) — kosong kalau kasir
    tidak mengisinya saat transaksi.
    """
    source_type, source_id = journal_entry.source_type, journal_entry.source_id
    if not source_id:
        return ""

    if source_type == JournalEntry.SourceType.POS_SALE:
        from api.pos_models import POSSale
        sale = POSSale.objects.filter(id=source_id).select_related("dilayani_oleh").first()
        if sale and sale.dilayani_oleh:
            return sale.dilayani_oleh.get_full_name() or sale.dilayani_oleh.username
    elif source_type == JournalEntry.SourceType.ORDER_PAYMENT:
        from api.models import OrderActivityLog
        log = OrderActivityLog.objects.filter(id=source_id).select_related("order__dilayani_oleh").first()
        if log and log.order.dilayani_oleh:
            staff = log.order.dilayani_oleh
            return staff.get_full_name() or staff.username

    return ""


def get_account_line_history(account, date_from, date_to, search=None):
    """
    Rincian Mutasi Akun: riwayat baris jurnal 1 akun dalam rentang tanggal,
    urut kronologis, dengan saldo berjalan (running balance) per baris.
    """
    saldo_awal = get_account_balances([account], date_from - timedelta(days=1)).get(account.id, 0)

    lines = (
        JournalEntryLine.objects
        .filter(
            account=account,
            journal_entry__status=JournalEntry.Status.POSTED,
            journal_entry__date__gte=date_from,
            journal_entry__date__lte=date_to,
        )
        .select_related("journal_entry", "journal_entry__posted_by", "journal_entry__created_by", "supplier", "customer")
        .order_by("journal_entry__date", "journal_entry__created_at", "id")
    )
    if search:
        lines = lines.filter(journal_entry__entry_number__icontains=search)

    running = saldo_awal
    rows = []
    for line in lines:
        delta = (
            (line.debit - line.kredit)
            if account.normal_balance == "debit"
            else (line.kredit - line.debit)
        )
        running += delta
        actor = line.journal_entry.posted_by or line.journal_entry.created_by
        pelanggan_supplier, email = _resolve_pelanggan_supplier(line.journal_entry, line)
        dilayani_oleh = _resolve_dilayani_oleh(line.journal_entry, line)
        rows.append({
            "date": line.journal_entry.date,
            "entry_number": line.journal_entry.entry_number,
            "pelanggan_supplier": pelanggan_supplier,
            "email": email,
            "dilayani_oleh": dilayani_oleh,
            "description": line.description or line.journal_entry.description,
            "external_document_no": line.external_document_no,
            "processed_by_name": (actor.get_full_name() or actor.username) if actor else "Sistem",
            "debit": line.debit,
            "kredit": line.kredit,
            "running_balance": running,
        })
    return {"saldo_awal": saldo_awal, "rows": rows}


# ---------------------------------------------------------------------------
# Laba Rugi (Income Statement) — Akuntansi > Laba Rugi Satu/Multi Periode.
# ---------------------------------------------------------------------------

INCOME_STATEMENT_CLASSIFICATIONS = [
    ("pendapatan", "Pendapatan"),
    ("hpp", "Harga Pokok Penjualan"),
    ("biaya_operasional", "Pengeluaran"),
    ("pendapatan_non_operasional", "Pendapatan Lain"),
    ("biaya_non_operasional", "Pengeluaran Lain"),
]


def _income_statement_section(classification_name, date_from, date_to):
    """
    Baris akun 1 klasifikasi P&L untuk rentang tanggal. `amount` dihitung dari
    ARAH DASAR account_type (revenue: kredit-debit, expense: debit-kredit),
    SENGAJA TANPA ikut membalik is_contra seperti `normal_balance` — supaya
    akun kontra (mis. "Return Penjualan", "Potongan Pembelian") otomatis
    keluar NEGATIF dan subtotal per section bisa dijumlah rata (flat sum)
    tanpa perlakuan khusus, sesuai desain UI Laba Rugi Satu/Multi Periode.
    """
    accounts = list(
        Account.objects.filter(classification__name=classification_name, is_active=True).order_by("code")
    )
    totals = _sum_debit_kredit(accounts, date_from=date_from, date_to=date_to)
    rows = []
    for account in accounts:
        row = totals.get(account.id)
        debit = row["total_debit"] if row else Decimal(0)
        kredit = row["total_kredit"] if row else Decimal(0)
        amount = (kredit or 0) - (debit or 0) if account.account_type == "revenue" else (debit or 0) - (kredit or 0)
        rows.append({"id": account.id, "code": account.code, "name": account.name, "amount": amount})
    return rows


def get_income_statement(date_from, date_to):
    """
    Laba Rugi 1 periode: 5 seksi berdasar klasifikasi COA (bukan kode akun
    hardcode, supaya akun baru di klasifikasi yang sama otomatis ikut
    terhitung) — Pendapatan, HPP, Pengeluaran (Biaya Operasional), Pendapatan
    Lain (Non-Operasional), Pengeluaran Lain (Biaya Non-Operasional).
    """
    sections = {
        key: _income_statement_section(name, date_from, date_to)
        for key, name in INCOME_STATEMENT_CLASSIFICATIONS
    }

    subtotal_pendapatan = sum((r["amount"] for r in sections["pendapatan"]), Decimal(0))
    subtotal_hpp = sum((r["amount"] for r in sections["hpp"]), Decimal(0))
    total_laba_kotor = subtotal_pendapatan - subtotal_hpp

    total_biaya_operasional = sum((r["amount"] for r in sections["biaya_operasional"]), Decimal(0))

    subtotal_pendapatan_non_operasional = sum(
        (r["amount"] for r in sections["pendapatan_non_operasional"]), Decimal(0)
    )
    subtotal_biaya_non_operasional = sum(
        (r["amount"] for r in sections["biaya_non_operasional"]), Decimal(0)
    )
    total_pendapatan_non_operasional = subtotal_pendapatan_non_operasional - subtotal_biaya_non_operasional

    laba_bersih = total_laba_kotor - total_biaya_operasional + total_pendapatan_non_operasional

    return {
        "date_from": date_from,
        "date_to": date_to,
        "pendapatan": sections["pendapatan"],
        "hpp": sections["hpp"],
        "biaya_operasional": sections["biaya_operasional"],
        "pendapatan_non_operasional": sections["pendapatan_non_operasional"],
        "biaya_non_operasional": sections["biaya_non_operasional"],
        "subtotal_pendapatan": subtotal_pendapatan,
        "subtotal_hpp": subtotal_hpp,
        "total_laba_kotor": total_laba_kotor,
        "total_biaya_operasional": total_biaya_operasional,
        "subtotal_pendapatan_non_operasional": subtotal_pendapatan_non_operasional,
        "subtotal_biaya_non_operasional": subtotal_biaya_non_operasional,
        "total_pendapatan_non_operasional": total_pendapatan_non_operasional,
        "laba_bersih": laba_bersih,
    }


# ---------------------------------------------------------------------------
# Neraca (Balance Sheet) — Akuntansi > Neraca.
# ---------------------------------------------------------------------------

EQUITY_CLASSIFICATIONS = ["Ekuitas"]


def get_changes_in_equity(date_from, date_to):
    """Hitung perubahan modal dari jurnal posted dan COA Ekuitas."""
    equity_accounts = list(
        Account.objects.filter(
            classification__name__in=EQUITY_CLASSIFICATIONS,
            is_active=True,
        ).order_by("code")
    )
    opening_totals = _sum_debit_kredit(equity_accounts, date_to=date_from - timedelta(days=1))
    period_totals = _sum_debit_kredit(equity_accounts, date_from=date_from, date_to=date_to)

    modal_awal = Decimal(0)
    investasi = Decimal(0)
    penarikan = Decimal(0)
    for account in equity_accounts:
        opening = opening_totals.get(account.id, {})
        period = period_totals.get(account.id, {})
        modal_awal += (opening.get("total_kredit") or 0) - (opening.get("total_debit") or 0)
        investasi += period.get("total_kredit") or 0
        penarikan += period.get("total_debit") or 0

    laba_bersih = get_income_statement(date_from, date_to)["laba_bersih"]
    total_penambahan_modal = laba_bersih + investasi - penarikan
    modal_akhir = modal_awal + total_penambahan_modal
    return {
        "date_from": date_from,
        "date_to": date_to,
        "modal_awal": modal_awal,
        "total_laba": laba_bersih,
        "investasi_kurun_waktu": investasi,
        "penarikan": penarikan,
        "total_penambahan_modal": total_penambahan_modal,
        "modal_akhir_periode": modal_akhir,
    }


CASH_CLASSIFICATION = "Kas & Bank"
INVESTMENT_CLASSIFICATIONS = {"Aktiva Tetap", "Aset Tak Berwujud", "Investasi", "Investasi jangka panjang"}
LIABILITY_CASH_FLOW_CLASSIFICATIONS = {"Kewajiban Jangka Pendek", "Kewajiban Jangka Panjang", "Kewajiban lain"}


def _cash_flow_bucket(entry, counterpart_classifications, cash_delta):
    """Pilih satu kategori Arus Kas untuk satu jurnal yang mengubah kas."""
    source_type = entry.source_type
    if source_type == JournalEntry.SourceType.CAPITAL_TRANSFER or "Ekuitas" in counterpart_classifications:
        return "penambahan_pengambilan_modal"
    if counterpart_classifications & LIABILITY_CASH_FLOW_CLASSIFICATIONS:
        return "pembayaran_penerimaan_pinjaman"
    if source_type == JournalEntry.SourceType.ASSET_ACQUISITION or counterpart_classifications & INVESTMENT_CLASSIFICATIONS:
        if "Aset Tak Berwujud" in counterpart_classifications:
            return "aset_tidak_berwujud"
        if "Aktiva Tetap" in counterpart_classifications:
            return "aset_tetap"
        return "investasi_lain"
    if source_type in {JournalEntry.SourceType.POS_SALE, JournalEntry.SourceType.ORDER_PAYMENT}:
        return "penerimaan_pelanggan"
    if source_type in {JournalEntry.SourceType.PURCHASE, JournalEntry.SourceType.PURCHASE_PAYMENT, JournalEntry.SourceType.STOCK_IN}:
        return "pembayaran_pemasok"
    if source_type == JournalEntry.SourceType.PAYROLL or "Pengeluaran" in counterpart_classifications:
        return "biaya_operasional"
    if "Pendapatan Lain" in counterpart_classifications:
        return "pendapatan_lain"
    if "Pengeluaran Lain" in counterpart_classifications:
        return "pengeluaran_lain"
    if "Pendapatan" in counterpart_classifications or "Piutang" in counterpart_classifications:
        return "penerimaan_pelanggan"
    if {"Persediaan", "Harga Pokok Penjualan"} & counterpart_classifications:
        return "pembayaran_pemasok"
    return "penerimaan_penjualan_aset_lancar" if cash_delta > 0 else "pengeluaran_lain"


def get_cash_flow(date_from, date_to):
    """Arus Kas metode langsung dari perubahan akun Kas & Bank pada jurnal posted."""
    cash_accounts = list(
        Account.objects.filter(classification__name=CASH_CLASSIFICATION, is_active=True).order_by("code")
    )
    cash_account_ids = {account.id for account in cash_accounts}
    saldo_kas_awal = sum(get_account_balances(cash_accounts, date_from - timedelta(days=1)).values(), Decimal(0))

    amounts = {
        "penerimaan_pelanggan": Decimal(0),
        "penerimaan_penjualan_aset_lancar": Decimal(0),
        "pembayaran_pemasok": Decimal(0),
        "biaya_operasional": Decimal(0),
        "pendapatan_lain": Decimal(0),
        "pengeluaran_lain": Decimal(0),
        "aset_tetap": Decimal(0),
        "aset_tidak_berwujud": Decimal(0),
        "investasi_lain": Decimal(0),
        "pembayaran_penerimaan_pinjaman": Decimal(0),
        "penambahan_pengambilan_modal": Decimal(0),
    }
    entries = (
        JournalEntry.objects.filter(status=JournalEntry.Status.POSTED, date__gte=date_from, date__lte=date_to)
        .prefetch_related("lines__account__classification")
    )
    for entry in entries:
        lines = list(entry.lines.all())
        cash_delta = sum(
            (line.debit - line.kredit for line in lines if line.account_id in cash_account_ids),
            Decimal(0),
        )
        if cash_delta == 0:
            continue
        counterpart_classifications = {
            line.account.classification.name
            for line in lines
            if line.account_id not in cash_account_ids and line.account.classification_id
        }
        amounts[_cash_flow_bucket(entry, counterpart_classifications, cash_delta)] += cash_delta

    operasional_keys = [
        "penerimaan_pelanggan", "penerimaan_penjualan_aset_lancar", "pembayaran_pemasok",
        "biaya_operasional", "pendapatan_lain", "pengeluaran_lain",
    ]
    investasi_keys = ["aset_tetap", "aset_tidak_berwujud", "investasi_lain"]
    pendanaan_keys = ["pembayaran_penerimaan_pinjaman", "penambahan_pengambilan_modal"]
    subtotal_operasional = sum((amounts[key] for key in operasional_keys), Decimal(0))
    subtotal_investasi = sum((amounts[key] for key in investasi_keys), Decimal(0))
    subtotal_pendanaan = sum((amounts[key] for key in pendanaan_keys), Decimal(0))
    total_kenaikan_kas = subtotal_operasional + subtotal_investasi + subtotal_pendanaan

    return {
        "date_from": date_from,
        "date_to": date_to,
        "saldo_kas_awal": saldo_kas_awal,
        "operasional": [{"key": key, "amount": amounts[key]} for key in operasional_keys],
        "investasi": [{"key": key, "amount": amounts[key]} for key in investasi_keys],
        "pendanaan": [{"key": key, "amount": amounts[key]} for key in pendanaan_keys],
        "subtotal_operasional": subtotal_operasional,
        "subtotal_investasi": subtotal_investasi,
        "subtotal_pendanaan": subtotal_pendanaan,
        "total_kenaikan_kas": total_kenaikan_kas,
        "saldo_kas_akhir": saldo_kas_awal + total_kenaikan_kas,
    }


def get_cash_flow_detail(date_from, date_to, category, page=1, page_size=25):
    """Rincian jurnal Kas & Bank untuk satu kategori Arus Kas."""
    cash_accounts = list(
        Account.objects.filter(classification__name=CASH_CLASSIFICATION, is_active=True).order_by("code")
    )
    cash_account_ids = {account.id for account in cash_accounts}
    running_balances = get_account_balances(cash_accounts, date_from - timedelta(days=1))
    saldo_awal = sum(running_balances.values(), Decimal(0))
    rows = []
    entries = (
        JournalEntry.objects.filter(status=JournalEntry.Status.POSTED, date__gte=date_from, date__lte=date_to)
        .select_related("created_by", "posted_by")
        .prefetch_related("lines__account__classification")
        .order_by("date", "created_at", "id")
    )
    for entry in entries:
        lines = list(entry.lines.all())
        cash_lines = [line for line in lines if line.account_id in cash_account_ids]
        if not cash_lines:
            continue
        cash_delta = sum((line.debit - line.kredit for line in cash_lines), Decimal(0))
        counterpart_classifications = {
            line.account.classification.name
            for line in lines
            if line.account_id not in cash_account_ids and line.account.classification_id
        }
        bucket = _cash_flow_bucket(entry, counterpart_classifications, cash_delta) if cash_delta else None
        actor = entry.posted_by or entry.created_by
        for line in cash_lines:
            delta = (line.debit - line.kredit) if line.account.normal_balance == "debit" else (line.kredit - line.debit)
            running_balances[line.account_id] = running_balances.get(line.account_id, Decimal(0)) + delta
            if bucket != category:
                continue
            rows.append({
                "account_id": line.account_id,
                "account_code": line.account.code,
                "account_name": line.account.name,
                "date": entry.date,
                "entry_number": entry.entry_number,
                "description": line.description or entry.description,
                "external_document_no": line.external_document_no,
                "debit": line.debit,
                "kredit": line.kredit,
                "amount": running_balances[line.account_id],
                "processed_by_name": (actor.get_full_name() or actor.username) if actor else "Sistem",
            })

    total_rows = len(rows)
    total_pages = max(1, (total_rows + page_size - 1) // page_size)
    page = min(max(page, 1), total_pages)
    offset = (page - 1) * page_size
    return {
        "date_from": date_from,
        "date_to": date_to,
        "category": category,
        "saldo_awal": saldo_awal,
        "count": total_rows,
        "page": page,
        "total_pages": total_pages,
        "results": rows[offset:offset + page_size],
    }


CURRENT_ASSET_CLASSIFICATIONS = [
    "Kas & Bank", "Investasi", "Piutang", "Persediaan", "Perlengkapan",
    "Akumulasi penyusutan perlengkapan", "Harta lancar lainnya",
]
NONCURRENT_ASSET_CLASSIFICATIONS = [
    "Aktiva Tetap", "Aset Tak Berwujud", "Akumulasi penyusutan aset tetap",
    "Akumulasi penyusutan aset tak berwujud", "Investasi jangka panjang",
]
LIABILITY_CLASSIFICATIONS = ["Kewajiban Jangka Pendek", "Kewajiban Jangka Panjang", "Kewajiban lain"]


def _balance_sheet_section(classification_names, account_type, as_of_date):
    """
    Baris akun 1 seksi Neraca, saldo KUMULATIF sejak awal sampai `as_of_date`.
    `amount` dihitung dari arah dasar account_type (asset: debit-kredit,
    liability/equity: kredit-debit) — SENGAJA TANPA ikut membalik is_contra
    (sama seperti Laba Rugi), supaya akun kontra (mis. "Akumulasi Penyusutan",
    "Prive") otomatis keluar negatif dan subtotal bisa flat-sum.
    """
    accounts = list(
        Account.objects.filter(classification__name__in=classification_names, is_active=True).order_by("code")
    )
    totals = _sum_debit_kredit(accounts, date_to=as_of_date)
    rows = []
    for account in accounts:
        row = totals.get(account.id)
        debit = row["total_debit"] if row else Decimal(0)
        kredit = row["total_kredit"] if row else Decimal(0)
        amount = (debit or 0) - (kredit or 0) if account_type == "asset" else (kredit or 0) - (debit or 0)
        rows.append({"id": account.id, "code": account.code, "name": account.name, "amount": amount})
    return rows


def get_balance_sheet(date_from, date_to):
    """
    Neraca per `date_to` (saldo kumulatif sejak awal, bukan pergerakan
    periode) — Aset (Lancar/Tidak Lancar), Kewajiban, Modal. Baris "Pendapatan
    periode ini" ditambahkan ke Modal dari laba bersih `date_from`..`date_to`
    (`get_income_statement`) karena aplikasi ini belum menjalankan jurnal
    tutup buku otomatis yang memindahkan laba ke Laba Ditahan.
    """
    aset_lancar = _balance_sheet_section(CURRENT_ASSET_CLASSIFICATIONS, "asset", date_to)
    aset_tidak_lancar = _balance_sheet_section(NONCURRENT_ASSET_CLASSIFICATIONS, "asset", date_to)
    kewajiban = _balance_sheet_section(LIABILITY_CLASSIFICATIONS, "liability", date_to)
    modal = _balance_sheet_section(EQUITY_CLASSIFICATIONS, "equity", date_to)

    laba_periode_ini = get_income_statement(date_from, date_to)["laba_bersih"]
    settings = AccountingSettings.objects.select_related("closing_account").first()
    closing_account = settings.closing_account if settings else None
    laba_periode_ini_name = (
        f"Pendapatan periode ini ({closing_account.name})" if closing_account else "Pendapatan periode ini"
    )
    laba_periode_ini_code = closing_account.code if closing_account else ""
    # id sengaja None (bukan id closing_account): baris ini nilai terhitung
    # (belum ada jurnal penutup nyata), jadi tidak boleh bisa di-drilldown ke
    # mutasi akun closing seolah-olah itu saldo tercatat sungguhan.
    modal = modal + [{"id": None, "code": laba_periode_ini_code, "name": laba_periode_ini_name, "amount": laba_periode_ini}]

    subtotal_aset_lancar = sum((r["amount"] for r in aset_lancar), Decimal(0))
    subtotal_aset_tidak_lancar = sum((r["amount"] for r in aset_tidak_lancar), Decimal(0))
    total_aset = subtotal_aset_lancar + subtotal_aset_tidak_lancar

    subtotal_kewajiban = sum((r["amount"] for r in kewajiban), Decimal(0))
    subtotal_modal = sum((r["amount"] for r in modal), Decimal(0))
    total_kewajiban_modal = subtotal_kewajiban + subtotal_modal

    return {
        "date_from": date_from,
        "date_to": date_to,
        "aset_lancar": aset_lancar,
        "aset_tidak_lancar": aset_tidak_lancar,
        "kewajiban": kewajiban,
        "modal": modal,
        "subtotal_aset_lancar": subtotal_aset_lancar,
        "subtotal_aset_tidak_lancar": subtotal_aset_tidak_lancar,
        "total_aset": total_aset,
        "subtotal_kewajiban": subtotal_kewajiban,
        "subtotal_modal": subtotal_modal,
        "total_kewajiban_modal": total_kewajiban_modal,
    }
