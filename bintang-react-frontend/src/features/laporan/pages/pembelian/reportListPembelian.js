/**
 * Konfigurasi daftar laporan untuk tab "Laporan Pembelian".
 * Bentuk sama dengan reportList.js (Produk): id, label, toolbar, columns, dst.
 * Sebagian masih kolom placeholder — akan disesuaikan per screenshot Olsera.
 */

export const PEMBELIAN_REPORTS = [
  {
    id: 'rincian-pembelian',
    label: 'Rincian Pembelian',
    toolbar: { paket: false, cari: false },
    columns: [
      { key: 'no_pembelian', label: 'No. Pembelian' },
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'pembelian_oleh', label: 'Pembelian Oleh' },
      { key: 'tanggal_diterima', label: 'Tanggal Diterima' },
      { key: 'no_terima', label: 'No. Terima' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'subtotal', label: 'Subtotal', align: 'right' },
      { key: 'diskon', label: 'Diskon', align: 'right' },
      { key: 'pengiriman', label: 'Pengiriman', align: 'right' },
      { key: 'pajak', label: 'Pajak', align: 'right' },
      { key: 'total', label: 'Total', align: 'right' },
    ],
  },
  {
    id: 'pembelian-tanggal',
    label: 'Pembelian berdasarkan Tanggal',
    toolbar: { paket: false, cari: false },
    columns: [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'total', label: 'Total', align: 'right' },
    ],
  },
  {
    id: 'item-pembelian-tanggal',
    label: 'Item Pembelian berdasarkan Tanggal',
    toolbar: { paket: false, cari: false },
    columns: [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'produk', label: 'Produk' },
      { key: 'sku', label: 'SKU' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'harga_beli', label: 'Harga Beli', align: 'right' },
      { key: 'subtotal', label: 'Subtotal', align: 'right' },
    ],
  },
  {
    id: 'pembelian-supplier',
    label: 'Pembelian berdasarkan Supplier',
    toolbar: { paket: false, cari: false },
    columns: [
      { key: 'supplier', label: 'Supplier' },
      { key: 'email', label: 'email' },
      { key: 'total', label: 'Total', align: 'right' },
    ],
  },
  {
    id: 'pembelian-pembeli',
    label: 'Pembelian berdasarkan Pembeli',
    toolbar: { paket: false, cari: false },
    columns: [
      { key: 'tgl_beli', label: 'Tgl. Beli' },
      { key: 'staff', label: 'Staff' },
      { key: 'total', label: 'Total', align: 'right' },
    ],
  },
  {
    id: 'retur-pembelian-tanggal',
    label: 'Retur Pembelian berdasarkan Tanggal',
    toolbar: { paket: false, cari: false },
    summary: { title: 'Ringkasan', type: 'list', items: [{ label: 'Total' }] },
    columns: [
      { key: 'no_pengembalian', label: 'No. Pengembalian' },
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'harga_satuan', label: 'Harga satuan', align: 'right' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'total', label: 'Total', align: 'right' },
    ],
  },
  {
    id: 'retur-pembelian-supplier',
    label: 'Retur Pembelian berdasarkan Supplier',
    toolbar: { paket: false, cari: false },
    summary: { title: 'Ringkasan', type: 'list', items: [{ label: 'Total' }] },
    columns: [
      { key: 'no_pengembalian', label: 'No. Pengembalian' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'email', label: 'Email' },
      { key: 'total', label: 'Total', align: 'right' },
    ],
  },
  {
    id: 'pembayaran-belum-lunas',
    label: 'Pembayaran yang belum lunas',
    toolbar: { paket: false, cari: false },
    hideTable: true,
  },
  {
    id: 'pembayaran-pembelian',
    label: 'Pembayaran Pembelian',
    toolbar: { paket: false, cari: false },
    hideTable: true,
  },
  {
    id: 'rekomendasi-pembelian',
    label: 'Rekomendasi Pembelian',
    dateMode: 'none',
    toolbar: { paket: false, cari: false },
    columns: [
      { key: 'nama_produk', label: 'Nama produk' },
      { key: 'kategori_produk', label: 'Kategori Produk' },
      { key: 'harga_beli', label: 'Harga beli', align: 'right' },
      { key: 'sedang_dikirim', label: 'Sedang Dikirim', align: 'right' },
      { key: 'qty_stok', label: 'Qty Stok', align: 'right' },
      { key: 'kekurangan_stok', label: 'Kekurangan Stok', align: 'right' },
    ],
  },
];

export default PEMBELIAN_REPORTS;
