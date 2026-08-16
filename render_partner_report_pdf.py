from pathlib import Path
import pypdfium2 as pdfium


pdf_path = Path(r"C:\bintang-project\deliverables\report_render\Laporan_Kondisi_Aplikasi_Mitra_Advertising_Tim_IT_Brandy.pdf")
out_dir = pdf_path.parent / "pages"
out_dir.mkdir(parents=True, exist_ok=True)

document = pdfium.PdfDocument(pdf_path)
for index in range(len(document)):
    page = document[index]
    bitmap = page.render(scale=2.0)
    image = bitmap.to_pil()
    image.save(out_dir / f"page-{index + 1}.png")

print(f"Rendered {len(document)} pages to {out_dir}")
