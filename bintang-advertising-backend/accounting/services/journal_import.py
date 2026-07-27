import csv
import io
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from api.customer_models import Customer, Supplier

from ..models import Account, Department, JournalTemplate
from .journal import create_journal_entry

MAX_ROWS = 500
REQUIRED_COLUMNS = {"date", "account_no", "type", "amount"}


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
    return amount if amount > 0 else None


def _group_rows(rows):
    """
    Kelompokkan baris jadi calon Journal Entry lewat kunci
    (date, jurnal_name, description, external_no) — external_no opsional di
    form, jadi dipakai kombinasi supaya baris ber-external_no kosong dari
    transaksi berbeda tidak nyasar tergabung jadi satu entry.
    """
    groups = defaultdict(list)
    order = []
    for idx, row in enumerate(rows):
        key = (
            (row.get("date") or "").strip(),
            (row.get("jurnal_name") or "").strip(),
            (row.get("description") or "").strip(),
            (row.get("external_no") or "").strip(),
        )
        if key not in groups:
            order.append(key)
        groups[key].append((idx, row))
    return [groups[key] for key in order]


def build_preview(rows):
    """Kelompokkan + validasi baris CSV, return list of preview-entry dict (belum disimpan)."""
    accounts = {a.code: a for a in Account.objects.all()}
    templates = {t.name: t for t in JournalTemplate.objects.all()}
    departments = {d.name: d for d in Department.objects.all()}
    suppliers_by_id = {str(s.id): s for s in Supplier.objects.all()}
    suppliers_by_name = {s.nama.strip().lower(): s for s in Supplier.objects.all() if getattr(s, "nama", None)}
    customers_by_id = {str(c.id): c for c in Customer.objects.all()}
    customers_by_name = {c.nama.strip().lower(): c for c in Customer.objects.all() if getattr(c, "nama", None)}

    preview = []
    for group in _group_rows(rows):
        errors, warnings, lines = [], [], []
        total_debit = total_kredit = Decimal(0)
        first_row = group[0][1]

        for row_idx, row in group:
            line_no = row_idx + 2  # +1 header, +1 karena manusia mulai hitung dari 1
            account = accounts.get((row.get("account_no") or "").strip())
            if not account:
                errors.append(f"Baris {line_no}: akun '{row.get('account_no')}' tidak ditemukan.")
                continue

            amount = _parse_amount(row.get("amount"))
            if amount is None:
                errors.append(f"Baris {line_no}: jumlah '{row.get('amount')}' tidak valid.")
                continue

            row_type = (row.get("type") or "").strip().lower()
            if row_type not in ("db", "cr"):
                errors.append(f"Baris {line_no}: type '{row.get('type')}' harus 'db' atau 'cr'.")
                continue

            debit = amount if row_type == "db" else Decimal(0)
            kredit = amount if row_type == "cr" else Decimal(0)
            total_debit += debit
            total_kredit += kredit

            supplier = suppliers_by_id.get((row.get("supplier_id") or "").strip()) or suppliers_by_name.get(
                (row.get("supplier_name") or "").strip().lower()
            )
            customer = customers_by_id.get((row.get("customer_id") or "").strip()) or customers_by_name.get(
                (row.get("customer_name") or "").strip().lower()
            )

            lines.append({
                "account_code": account.code,
                "account_name": account.name,
                "debit": str(debit),
                "kredit": str(kredit),
                "description": row.get("description", ""),
                "external_document_no": row.get("external_no", ""),
                "supplier_id": supplier.id if supplier else None,
                "customer_id": customer.id if customer else None,
            })

        entry_date = _parse_date(first_row.get("date"))
        if entry_date is None:
            errors.append(f"Tanggal '{first_row.get('date')}' tidak valid (format: MM/DD/YYYY).")

        jurnal_name = (first_row.get("jurnal_name") or "").strip()
        template = templates.get(jurnal_name)
        if jurnal_name and not template:
            warnings.append(f"Nama Jurnal '{jurnal_name}' belum terdaftar — akan disimpan tanpa kategori.")

        department_name = (first_row.get("department_name") or "").strip()
        department = departments.get(department_name)
        if department_name and not department:
            warnings.append(f"Departemen '{department_name}' belum terdaftar — akan disimpan tanpa departemen.")

        if len(lines) < 2:
            errors.append("Minimal 2 baris (1 debit, 1 kredit) per transaksi.")
        elif total_debit != total_kredit:
            errors.append(f"Tidak balance: total debit {total_debit} != total kredit {total_kredit}.")

        preview.append({
            "date": entry_date.isoformat() if entry_date else first_row.get("date"),
            "jurnal_name": jurnal_name,
            "journal_template_id": template.id if template else None,
            "department_name": department_name,
            "department_id": department.id if department else None,
            "description": first_row.get("description", ""),
            "lines": lines,
            "total_debit": str(total_debit),
            "total_kredit": str(total_kredit),
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        })
    return preview


def commit_entries(preview_entries, created_by):
    """
    Terima entry hasil review user (bentuknya sama seperti output build_preview)
    dan benar-benar posting lewat create_journal_entry() satu per satu — 1 entry
    gagal tidak menggagalkan entry lain yang sudah tervalidasi (create_journal_entry
    sendiri atomik per-entry).
    """
    results = []
    for entry_data in preview_entries:
        try:
            entry_date = date.fromisoformat(entry_data["date"])
            lines = []
            for line in entry_data["lines"]:
                account = Account.objects.get(code=line["account_code"])
                lines.append({
                    "account": account,
                    "debit": Decimal(line.get("debit") or 0),
                    "kredit": Decimal(line.get("kredit") or 0),
                    "description": line.get("description", ""),
                    "external_document_no": line.get("external_document_no", ""),
                    "supplier": Supplier.objects.filter(id=line.get("supplier_id")).first(),
                    "customer": Customer.objects.filter(id=line.get("customer_id")).first(),
                })
            template = JournalTemplate.objects.filter(id=entry_data.get("journal_template_id")).first()
            department = Department.objects.filter(id=entry_data.get("department_id")).first()

            entry = create_journal_entry(
                date=entry_date,
                lines=lines,
                description=entry_data.get("description", ""),
                journal_template=template,
                department=department,
                created_by=created_by,
            )
            results.append({"success": True, "entry_number": entry.entry_number, "error": None})
        except Exception as exc:
            results.append({"success": False, "entry_number": None, "error": str(exc)})
    return results
