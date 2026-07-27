export const productTabs = [
  { id: 'products', label: 'Produk' },
  { id: 'categories', label: 'Kategori' },
  { id: 'packages', label: 'Paket' },
  { id: 'addons', label: 'Addon' },
  { id: 'brands', label: 'Brand' },
  { id: 'specifications', label: 'Spesifikasi' },
  { id: 'product-others', label: 'Produk Lain-lain' },
];

export const inventoryTabs = [
  { id: 'stock-in', label: 'Stok Masuk' },
  { id: 'stock-out', label: 'Stok Keluar' },
  { id: 'stock-production', label: 'Produksi Stock' },
  { id: 'stock-opname', label: 'Stok Opname' },
  { id: 'stock-movement', label: 'Pergerakan Stok' },
  { id: 'stock-alert', label: 'Email Peringatan Stok' },
];

export const specialTypeTabs = [
  { id: 'special-type-list', label: 'Tipe Special' },
  { id: 'special-collection', label: 'Koleksi' },
  { id: 'special-lookbook', label: 'Look Book' },
];

export const priceLabelTabs = [
  { id: 'price-label-products', label: 'Produk' },
  { id: 'price-label-settings', label: 'Pengaturan' },
];

export const productRows = [
  {
    id: 'PRD-0001',
    name: 'Banner Outdoor 340 gsm',
    variant: '-',
    sku: 'BNR-340',
    barcode: '899100000001',
    stock: '-',
    unit: 'm2',
    cost: 18000,
    storePrice: 35000,
    onlinePrice: 35000,
    online: true,
  },
  {
    id: 'PRD-0002',
    name: 'Sticker Vinyl Laminasi',
    variant: '-',
    sku: 'STK-VNL',
    barcode: '899100000002',
    stock: '-',
    unit: 'm2',
    cost: 22000,
    storePrice: 45000,
    onlinePrice: 45000,
    online: false,
  },
  {
    id: 'PRD-0003',
    name: 'Kartu Nama Art Carton',
    variant: '2 sisi',
    sku: 'KN-AC260',
    barcode: '899100000003',
    stock: '-',
    unit: 'box',
    cost: 35000,
    storePrice: 75000,
    onlinePrice: 75000,
    online: true,
  },
];

export const categories = [
  { name: 'Print Outdoor', classification: 'Umum', pos: true, web: true, active: true },
  { name: 'Print Indoor', classification: 'Umum', pos: true, web: true, active: true },
  { name: 'Merchandise', classification: 'Retail', pos: true, web: false, active: true },
];

export const packages = [
  { name: 'Paket Grand Opening', qty: 4, offlinePrice: 450000, onlinePrice: 450000, published: true },
  { name: 'Paket Branding Booth', qty: 6, offlinePrice: 1250000, onlinePrice: 1250000, published: false },
];

export const addons = [
  { name: 'Laminasi Doff', price: 12000 },
  { name: 'Mata Ayam', price: 2500 },
  { name: 'Potong Pola', price: 15000 },
];

export const brands = [
  { name: 'Flexi China', commission: 0, products: 12 },
  { name: 'Albatros', commission: 0, products: 7 },
];

export const specifications = [
  { name: 'Ukuran', type: 'Teks' },
  { name: 'Bahan', type: 'Pilihan' },
  { name: 'Finishing', type: 'Pilihan' },
];

export const stockIncoming = [
  { no: 'IN26062300000002', from: '-', supplier: '-', date: '23-Jun-2026', note: '-', status: 'Batal', receivedBy: 'bayumaruf1410@gmail.com' },
];

export const stockOutgoing = [
  { no: 'OG26062300000002', transferTo: '-', date: '23-Jun-2026', note: '-', reason: '-', status: 'Batal', receivedBy: 'bayumaruf1410@gmail.com' },
];

export const stockMovement = [
  { group: 'Bahan Cetak', product: 'Flexi 340 gsm', initial: 120, in: 40, returns: 0, sales: 35, out: 15, remaining: 110 },
  { group: 'Finishing', product: 'Mata Ayam', initial: 500, in: 0, returns: 0, sales: 120, out: 0, remaining: 380 },
];

export const specialTypeMenus = ['Unggulan', 'Rilis Terbaru', 'Sale', 'Populer', 'Habis Stok', 'Pre-order', 'Bahan Baku'];

export const formatCurrency = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
