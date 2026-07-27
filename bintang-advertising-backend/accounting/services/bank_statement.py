import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction

from ..models import BankStatementLine

MAX_ROWS = 500
REQUIRED_COLUMNS = {"date", "description", "mutation", "type", "saldo"}


def parse_csv_file(file_obj):
    """Baca file upload, return (rows: list[dict], errors: list[str])."""
    try:
        content = file_obj.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], ["File tidak bisa dibaca sebagai teks (encoding tidak didukung, pakai UTF-8)."]

    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        return [], [f"Kolom CSV tidak sesuai template. Wajib ada: {', '.join(sorted(REQUIRED_COLUMNS))}."]

    rows = [row for row in reader if any((v or "").strip() for v in row.values())]
    errors = []
    if len(rows) > MAX_ROWS:
        errors.append(f"Maksimal {MAX_ROWS} baris per import, file ini {len(rows)} baris — sisanya diabaikan.")
        rows = rows[:MAX_ROWS]
    return rows, errors


def _parse_date(value):
    for fmt in ("%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime((value or "").strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_amount(value):
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, AttributeError):
        return None
    return amount


def build_preview(rows):
    """
    Validasi & susun preview baris bank statement (BELUM disimpan).
    Kolom `type` di CSV: 'D' = Debit (uang keluar dari rekening), kosong/lainnya
    = Kredit (uang masuk) — konvensi REKENING KORAN BANK, kebalikan dari
    debit/kredit di buku besar perusahaan (JournalEntryLine).
    """
    preview = []
    for idx, row in enumerate(rows):
        line_no = idx + 2
        errors = []

        date_value = _parse_date(row.get("date"))
        if date_value is None:
            errors.append(f"Baris {line_no}: tanggal '{row.get('date')}' tidak valid (format: MM/DD/YYYY).")

        amount = _parse_amount(row.get("mutation"))
        if amount is None or amount <= 0:
            errors.append(f"Baris {line_no}: jumlah mutasi '{row.get('mutation')}' tidak valid.")

        saldo = _parse_amount(row.get("saldo"))
        if saldo is None:
            errors.append(f"Baris {line_no}: saldo '{row.get('saldo')}' tidak valid.")

        type_raw = (row.get("type") or "").strip().upper()
        mutation_type = (
            BankStatementLine.MutationType.DEBIT if type_raw == "D"
            else BankStatementLine.MutationType.KREDIT
        )

        preview.append({
            "date": date_value.isoformat() if date_value else row.get("date"),
            "description": row.get("description", ""),
            "mutation_amount": str(amount) if amount is not None else row.get("mutation"),
            "mutation_type": mutation_type,
            "bank_saldo": str(saldo) if saldo is not None else row.get("saldo"),
            "is_valid": len(errors) == 0,
            "errors": errors,
        })
    return preview


@transaction.atomic
def commit_lines(*, account, preview_lines, imported_by):
    """
    Simpan baris valid ke BankStatementLine (status Pending) — BUKAN
    JournalEntry, menunggu diproses di Rekonsiliasi Bank.
    """
    created = []
    for line in preview_lines:
        if not line.get("is_valid"):
            continue
        obj = BankStatementLine.objects.create(
            account=account,
            date=line["date"],
            description=line.get("description", ""),
            mutation_amount=Decimal(line["mutation_amount"]),
            mutation_type=line["mutation_type"],
            bank_saldo=Decimal(line["bank_saldo"]),
            imported_by=imported_by,
        )
        created.append(obj)
    return created
