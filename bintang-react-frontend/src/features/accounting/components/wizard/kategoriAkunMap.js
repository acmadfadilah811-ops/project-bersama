// Pemetaan "Kategori" (dropdown wizard Pengaturan Awal, Tambah Akun) ke
// account_type + daftar "Sub Kategori" (= nama AccountClassification yang
// sudah ada di backend, lihat accounting/management/commands/seed_coa.py).
// Kategori dengan subCategories: null hanya punya 1 klasifikasi -> form
// langsung lompat ke Nama Akun/Nomor Akun tanpa dropdown Sub Kategori.
export const KATEGORI_AKUN = [
  {
    label: 'Harta Lancar',
    accountType: 'asset',
    subCategories: [
      'Kas & Bank',
      'Investasi',
      'Piutang',
      'Persediaan',
      'Perlengkapan',
      'Akumulasi penyusutan perlengkapan',
      'Harta lancar lainnya',
    ],
  },
  {
    label: 'Harta Tetap',
    accountType: 'asset',
    subCategories: ['Aktiva Tetap', 'Akumulasi penyusutan aset tetap', 'Investasi jangka panjang'],
  },
  {
    label: 'Harta Tak Berwujud',
    accountType: 'asset',
    subCategories: ['Aset Tak Berwujud', 'Akumulasi penyusutan aset tak berwujud'],
  },
  {
    label: 'Kewajiban',
    accountType: 'liability',
    subCategories: ['Kewajiban Jangka Pendek', 'Kewajiban Jangka Panjang', 'Kewajiban lain'],
  },
  {
    label: 'Ekuitas',
    accountType: 'equity',
    subCategories: null,
    singleClassification: 'Ekuitas',
  },
  {
    label: 'Pendapatan',
    accountType: 'revenue',
    subCategories: ['Pendapatan', 'Pendapatan Lain'],
  },
  {
    label: 'HPP',
    accountType: 'expense',
    subCategories: null,
    singleClassification: 'Harga Pokok Penjualan',
  },
  {
    label: 'Biaya',
    accountType: 'expense',
    subCategories: ['Pengeluaran', 'Pengeluaran Lain'],
  },
];

// Sub Kategori yang berarti "akun kontra" (saldo normal kebalikan dari
// account_type-nya) -- dipakai auto-set is_contra saat Tambah Akun, mengikuti
// pola is_contra yang sudah ada di seed_coa.py (Akumulasi Penyusutan/dst).
export const CONTRA_SUB_CATEGORIES = new Set([
  'Akumulasi penyusutan perlengkapan',
  'Akumulasi penyusutan aset tetap',
  'Akumulasi penyusutan aset tak berwujud',
]);

// Sub Kategori yang memunculkan field tambahan "Akumulasi dari akun" (UI-only,
// belum disimpan ke field manapun sampai jelas dipakai di laporan/validasi mana).
export const AKUMULASI_DARI_AKUN_SUB_CATEGORY = 'Akumulasi penyusutan aset tak berwujud';

// Daftar akun terkurasi untuk dropdown "Akumulasi dari akun" -- semua akun
// ASSET yang sudah ter-seed KECUALI Kas & Bank / Piutang / Persediaan.
export const AKUMULASI_DARI_AKUN_CODES = [
  '11200',
  '11500',
  '11600',
  '11700',
  '11750',
  '12000',
  '13000',
  '14000',
  '15000',
];
