// Aturan bersama kolom "Diterima Oleh" untuk dokumen stok
// (Stok Masuk, Stok Keluar, Produksi Stok, Stok Opname).

const isDraft = (doc) => doc?.status === 'draft';

// Selama draft dokumen masih bisa diubah, jadi penerimanya belum ditetapkan —
// kolom dikosongkan (mengikuti Olsera). Nilai baru muncul setelah dokumen final
// (selesai atau batal).
//
// Nilai yang dipakai adalah dibuat_oleh_nama = pembuat dokumen, bukan penerima
// sungguhan. Ini disengaja agar sama dengan Olsera; penerima sungguhan butuh
// field baru di model.
export const receivedByDisplay = (doc) => (isDraft(doc) ? '' : doc?.dibuat_oleh_nama || '-');

// Versi untuk export XLSX: sel kosong, bukan '-', agar cocok file asli Olsera.
export const receivedByRaw = (doc) => (isDraft(doc) ? '' : doc?.dibuat_oleh_nama || '');
