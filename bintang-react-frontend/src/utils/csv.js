import * as XLSX from 'xlsx';

/**
 * Baca file CSV jadi array objek: kunci huruf kecil, nilai sudah di-trim.
 *
 * Dipakai untuk memeriksa isi file di browser SEBELUM apa pun dikirim ke server,
 * supaya user melihat datanya dulu dan tidak ada data sampah terlanjur dibuat.
 *
 * Kunci di-huruf-kecil-kan karena backend mencocokkan header secara
 * case-insensitive; nilai di-trim karena spasi di CSV sering menyelinap dan
 * membuat pencocokan meleset.
 *
 * CATATAN: `ImportCsvModal.jsx` (dokumen stok) masih punya salinan logika ini di
 * dalamnya. Menyatukannya ke sini = tugas tersendiri; ini rumah yang benar untuk
 * pemakaian baru.
 */
export const parseCsvRows = async (file) => {
  const text = await file.text();
  const wb = XLSX.read(text, { type: 'string', raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((row) => {
    const lower = {};
    Object.keys(row).forEach((k) => {
      lower[String(k).trim().toLowerCase()] = String(row[k] ?? '').trim();
    });
    return lower;
  });
};
