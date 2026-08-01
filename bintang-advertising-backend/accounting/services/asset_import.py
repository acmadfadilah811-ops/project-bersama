import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from ..models import FixedAsset

MAX_ROWS = 500
REQUIRED_COLUMNS = {
    "asset_code", "name", "acquisition_date", "acquisition_cost", "residual_value",
}


def parse_csv_file(file_obj):
    """Baca template aset UTF-8 dan batasi maksimum 500 baris."""
    try:
        content = file_obj.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], ["File CSV harus memakai encoding UTF-8."]
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        return [], [f"Kolom wajib: {', '.join(sorted(REQUIRED_COLUMNS))}."]
    rows = [row for row in reader if any((value or "").strip() for value in row.values())]
    if len(rows) > MAX_ROWS:
        return [], [f"Maksimal {MAX_ROWS} baris per import."]
    return rows, []


def build_preview(rows):
    """Validasi data CSV tanpa membuat aset atau jurnal."""
    existing_codes = set(FixedAsset.objects.filter(asset_code__in=[r.get("asset_code", "").strip() for r in rows]).values_list(
        "asset_code", flat=True,
    ))
    seen_codes = set()
    preview = []
    for index, row in enumerate(rows, start=2):
        errors = []
        code = (row.get("asset_code") or "").strip()
        name = (row.get("name") or "").strip()
        if not code:
            errors.append("Kode aset wajib diisi.")
        elif code in existing_codes:
            errors.append(f"Kode aset '{code}' sudah terdaftar.")
        elif code in seen_codes:
            errors.append(f"Kode aset '{code}' berulang di file.")
        seen_codes.add(code)
        if not name:
            errors.append("Nama aset wajib diisi.")
        try:
            acquisition_date = datetime.strptime((row.get("acquisition_date") or "").strip(), "%Y-%m-%d").date()
        except ValueError:
            acquisition_date = None
            errors.append("Tanggal perolehan harus YYYY-MM-DD.")
        try:
            cost = Decimal((row.get("acquisition_cost") or "").strip())
            residual = Decimal((row.get("residual_value") or "0").strip())
            if cost <= 0 or residual < 0 or residual > cost:
                errors.append("Nilai perolehan harus positif dan residu berada di antara 0 sampai nilai perolehan.")
        except InvalidOperation:
            cost = residual = None
            errors.append("Nilai perolehan atau residu tidak valid.")
        preview.append({
            "row_number": index,
            "asset_code": code,
            "name": name,
            "acquisition_date": acquisition_date.isoformat() if acquisition_date else row.get("acquisition_date"),
            "acquisition_cost": str(cost) if cost is not None else row.get("acquisition_cost"),
            "residual_value": str(residual) if residual is not None else row.get("residual_value"),
            "external_document_no": (row.get("external_document_no") or "").strip(),
            "description": (row.get("description") or "").strip(),
            "is_valid": not errors,
            "errors": errors,
        })
    return preview
