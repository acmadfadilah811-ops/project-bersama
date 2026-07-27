import { receivedByDisplay, receivedByRaw } from '../../../../utils/stockDocument';

// Nama bulan pendek dalam Bahasa Indonesia — salinan kelima di repo ini.
// Jangan satukan ke src/utils/date.js sebelum semua pemakai diaudit tersendiri.
export const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const STATUS_LABEL = { draft: 'Draft', selesai: 'Selesai', batal: 'Batal' };

// Batas baris import CSV — harus sama dengan batas di backend
// (StockInDocumentViewSet.import_csv) supaya user tidak ditolak server
// setelah preview terlanjur bilang aman.
export const CSV_MAX_ROWS = 200;

// Kolom template resmi: product,variant,sku,supplier,qty,new_buy_price,rack
export const CSV_PREVIEW_COLUMNS = [
  { key: 'product', label: 'Produk' },
  { key: 'variant', label: 'Varian' },
  { key: 'sku', label: 'SKU' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'qty', label: 'Qty' },
  { key: 'new_buy_price', label: 'Harga Beli' },
  { key: 'rack', label: 'Rak' },
];

export const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(`${isoStr}T00:00:00`);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTHS_ID[d.getMonth()]}-${d.getFullYear()}`;
};

export const getFileSizeStr = (size) => {
  if (!size) return '0.0 KB';
  const kb = size / 1024;
  return `${kb.toFixed(1)} KB`;
};

export const mapDocToRow = (doc) => ({
  id: doc.id,
  no: doc.nomor,
  from: doc.nama_penerima || '-',
  supplier: doc.supplier || '-',
  date: formatDisplayDate(doc.tanggal),
  note: doc.catatan || '-',
  status: STATUS_LABEL[doc.status] || doc.status,
  receivedBy: receivedByDisplay(doc),
  // Nilai mentah (bukan untuk tampilan) — dipakai saat export XLSX agar cocok kolom asli Olsera
  supplierRaw: doc.supplier || '',
  tanggalRaw: doc.tanggal || '',
  noteRaw: doc.catatan || '',
  receiverNameRaw: doc.nama_penerima || '',
  receivedByRaw: receivedByRaw(doc),
});

export const formatCurrencyRp = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
