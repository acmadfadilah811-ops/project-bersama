from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font


def build_asset_xlsx(assets):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Daftar Aset"
    headers = ["Kode Aset", "Nama Aset", "Tanggal Perolehan", "Nilai Perolehan", "Nilai Residu", "No. Dokumen", "Status"]
    sheet.append(headers)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    for asset in assets:
        sheet.append([
            asset.asset_code, asset.name, asset.acquisition_date.isoformat(), asset.acquisition_cost,
            asset.residual_value, asset.external_document_no, asset.get_status_display(),
        ])
    for column in sheet.columns:
        sheet.column_dimensions[column[0].column_letter].width = min(max(len(str(cell.value or "")) for cell in column) + 2, 35)
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def build_asset_pdf(assets):
    """PDF tabel sederhana tanpa dependency tambahan."""
    lines = ["DAFTAR ASET", ""]
    lines.extend(
        f"{asset.asset_code} | {asset.name} | {asset.acquisition_date:%Y-%m-%d} | Rp {asset.acquisition_cost}"
        for asset in assets
    )
    text = "\n".join(lines).encode("ascii", "replace")
    stream = b"BT /F1 10 Tf 50 780 Td 12 TL " + b" ".join(
        b"(" + line.replace(b"(", b"[").replace(b")", b"]") + b") Tj T*" for line in text.splitlines()
    ) + b" ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    output = b"%PDF-1.4\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output += f"{index} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(output)
    output += b"xref\n0 6\n0000000000 65535 f \n" + b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    output += b"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n" + str(xref).encode() + b"\n%%EOF"
    return output
