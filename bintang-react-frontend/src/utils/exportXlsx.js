import * as XLSX from 'xlsx';

// Export data yang sudah ada di state React (bukan lewat backend) — dipakai
// untuk laporan yang sumbernya murni komputasi client-side (mis. Piutang dari
// /orders/, Hutang dari /purchases/), supaya tidak menduplikasi logika
// perhitungan piutang/hutang di backend hanya demi export.
export function exportRowsToXlsx(filename, headers, rows) {
  const wb = XLSX.utils.book_new();
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}
