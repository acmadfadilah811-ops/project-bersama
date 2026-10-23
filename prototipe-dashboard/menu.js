// Struktur topbar + sidebar, disalin dari dashboard referensi (16 Okt 2026).
// Item tanpa `children` = tautan langsung. `children` boleh bertingkat 3.
// Nama merek pihak referensi sudah diganti nama netral.

const L = (label, extra = {}) => ({ label, ...extra });
const G = (label, icon, children) => ({ label, icon, children: children.map(c => typeof c === 'string' ? L(c) : c) });

const FAVORIT = G('Menu Favorit', 'star', ['Dashboard']);

const MENUS = {
  penjualan: {
    label: 'Penjualan',
    home: 'dashboard',
    items: [
      FAVORIT,
      L('Dashboard', { icon: 'layout-panel-left' }),
      G('Laporan', 'clipboard-list', [
        G('Laporan Penjualan', null, ['Ringkasan Penjualan', 'Detail Penjualan', 'Penjualan Per Periode', 'Penjualan Outlet', 'Laporan Uang Muka', 'Laporan Jenis Bayar', 'Laporan Jenis Order', 'Laporan Void', 'Laporan Refund']),
        G('Laporan Dapur', null, ['Laporan Proses Order', 'Laporan Proses Produk', 'Laporan Kembalikan Status']),
        G('Laporan Meja', null, ['Laporan Reservasi Meja']),
        G('Laporan Produk', null, ['Penjualan Produk', 'Penjualan Departemen', 'Penjualan Kategori', 'Penjualan Ekstra', 'Penjualan Sub Ekstra']),
        G('Laporan Jasa', null, [L('Laporan Jasa', { slug: 'laporan-jasa-detail' }), 'Laporan Reservasi', 'Laporan Reservasi & Utilisasi']),
        G('Laporan Fasilitas', null, ['Laporan Reservasi Fasilitas', 'Laporan Utilisasi Ruangan']),
        G('Laporan Promo & Loyalti', null, ['Laporan Promo', 'Laporan Poin', 'Laporan Kupon', 'Laporan Komplimen']),
        G('Laporan Pajak', null, [L('Laporan Pajak', { slug: 'laporan-pajak-detail' }), 'Laporan Service Charge']),
        G('Laporan Kasir', null, ['Laporan Kas Kasir', 'Penjualan Per Kasir', 'Penjualan Per Terminal', 'Laporan Tutup Kasir', 'Laporan Tutup Toko']),
        G('Laporan Deposit', null, ['Penjualan Deposit', 'Deposit Kadaluarsa', 'Sisa Deposit']),
        G('Laporan Pelanggan', null, [L('Laporan Pelanggan', { slug: 'laporan-pelanggan-detail' })]),
        G('Laporan Karyawan', null, ['Komisi Bertingkat', 'Absensi', 'Komisi Tetap']),
        G('Laporan Persediaan', null, ['Lap. Ringkasan Persediaan', 'Lap. Detail Persediaan', 'Laporan Stok Kedaluwarsa', 'Laporan Serial Number', 'Laporan Batch Number']),
        G('Laporan Settlement', null, [L('QRIS', { slug: 'settlement-qris' }), L('Order Online', { slug: 'settlement-order-online' })])
      ]),
      G('Analisa Laporan', 'bar-chart-3', ['Waktu Teramai Produk', 'Waktu Teramai Penjualan', 'Perputaran Stok', 'Kepuasan Pelanggan']),
      G('Produk', 'package', ['Daftar Departemen', 'Daftar Kategori', 'Produk Barang', 'Produk Layanan', 'Produk Fasilitas', 'Produk Ekstra', 'Produk Paket', 'Deposit', 'Penjadwalan Perubahan Resep', 'Daftar Harga Ojek Online', 'Penjadwalan Harga', 'Harga Berdasarkan Waktu', 'Cetak Barcode', 'Daftar Kategori Catatan', 'Master Resep']),
      G('Inventori', 'box', [
        'Daftar Bahan Baku',
        G('Pembelian Stok', null, ['Permintaan Barang', 'Pemesanan Stok', 'Pengiriman Pembelian', 'Faktur Pembelian', 'Pembayaran Faktur', 'Retur']),
        G('Kelola Stok', null, ['Daftar Stok', 'Stok Opname', 'Stok Terbuang']),
        G('Produksi Stok', null, ['Daftar Produksi Stok', 'Acuan Produksi Stok']),
        G('Mutasi Antar Outlet', null, ['Permintaan Stok', 'Stok Harus Dikirim', 'Kirim Stok', 'Terima Mutasi Stok', 'Stok Transit']),
        'Daftar Pemasok'
      ]),
      G('Pelanggan', 'users', ['Daftar Pelanggan', 'Grup Pelanggan', 'Grup Harga Spesial', 'Kustom Data Pelanggan', 'Pengaturan Data Pelanggan']),
      G('Promosi', 'tag', [
        G('Promo', null, ['Basic Promo', L('Per Total Pembelian', { slug: 'promo-per-total-pembelian' }), L('Per Produk', { slug: 'promo-per-produk' })]),
        G('Kupon', null, ['Tambah Kupon', 'Daftar Kupon']),
        G('Loyalty', null, ['Loyalty Program', 'Loyalty Ulang Tahun', 'Daftar Loyalty', 'Group Loyalty Pelanggan']),
        G('Poin Reward', null, [L('Per Total Pembelian', { slug: 'poin-per-total-pembelian' }), L('Per Produk', { slug: 'poin-per-produk' }), 'Pengaturan Penukaran'])
      ]),
      G('Komisi', 'hand-coins', ['Daftar Grup Komisi']),
      G('Invoice', 'file-text', ['Daftar Penawaran Penjualan', 'Daftar Pesanan Penjualan', 'Daftar Pengiriman Penjualan', 'Daftar Invoice', 'Daftar Penerimaan Penjualan']),
      G('Marketing', 'megaphone', ['Kirim Kampanye Marketing', 'Beli Kampanye Marketing'])
    ]
  },
  order: {
    label: 'Order Online',
    home: 'pesanan',
    extra: 'saldo',
    items: [
      G('Menu Favorit', 'star', ['Pesanan']),
      L('Pesanan', { icon: 'receipt' }),
      G('Toko Online', 'store', ['Pengaturan Penjualan', 'Pengaturan Tampilan', 'Pengaturan Lainnya']),
      G('Marketplace', 'shopping-bag', ['GrabMart', 'Shopee']),
      G('Food Order', 'utensils', ['GrabFood', 'GoFood']),
      L('KiosK', { icon: 'tablet' }),
      L('Consumer Apps', { icon: 'smartphone' })
    ]
  },
  appointment: { label: 'Appointment', locked: 'Sayang sekali, fitur ini hanya bisa diakses oleh pengguna <b>PRIME+.</b>', lockBtn: 'Upgrade Langganan Anda' },
  karyawan: {
    label: 'Karyawan',
    home: 'daftar-karyawan',
    items: [
      G('Menu Favorit', 'star', ['Daftar Karyawan']),
      G('Pengaturan Karyawan', 'contact', ['Daftar Karyawan']),
      G('Payroll', 'banknote', ['Pengaturan Payroll', 'Struktur Gaji', 'Daftar Pemetaan Akun Gaji', 'Pembayaran Payroll', 'Laporan Pembayaran', 'Rekonsiliasi Pembayaran']),
      G('Hak Akses', 'monitor', ['Daftar Hak Akses', 'Pengaturan Hak Akses']),
      G('Absensi', 'user', ['Akses Absensi', 'Radius Absensi']),
      G('Teams', 'users', ['Akses Teams', 'Kirim Notifikasi']),
      G('Jadwal Kerja', 'calendar', ['Daftar Shift', 'Daftar Jadwal Kerja', 'Jadwal Kerja Karyawan']),
      G('Pengaturan Master', 'settings-2', ['Tingkat Jabatan', 'Organisasi', 'Tipe Karyawan', 'Quick PIN']),
      G('Alur Kerja Persetujuan', 'git-pull-request', ['Persetujuan Pembelian', 'Persetujuan Keuangan'])
    ]
  },
  keuangan: { label: 'Keuangan', locked: 'Sayang sekali, fitur ini hanya bisa diakses dengan pembelian Add On Keuangan', lockBtn: 'Beli Add On' },

  // --- isi dropdown "Lainnya" ---
  whatsapp: { label: 'Whatsapp', more: true, locked: 'Sayang sekali, fitur ini hanya bisa diakses dengan pembelian Add On WAB Customer Center', lockBtn: 'Beli Add On' },
  pengaturan: {
    label: 'Pengaturan',
    more: true,
    home: 'daftar-pesan',
    items: [
      G('Menu Favorit', 'star', ['Daftar Pesan']),
      { ...G('Pesan Masuk', 'mail', ['Daftar Pesan']), badge: 1 },
      G('Notifikasi', 'bell', ['Pengaturan WhatsApp', 'Daftar Notifikasi', 'Pengaturan Notifikasi', 'Transaksi Dihapus']),
      G('Akun Profile', 'user', ['Informasi Akun', 'Informasi Bisnis', 'Informasi Rekening']),
      G('Langganan', 'monitor', ['Langganan & Support', 'Tiket Support', 'Klaim Voucher']),
      G('Kitchen Display', 'chef-hat', ['Pengaturan Kitchen Display']),
      G('Outlet', 'store', ['Daftar Outlet', 'Pengaturan Denah dan Meja']),
      L('Produk dan Inventori', { icon: 'package' }),
      G('Reservasi', 'calendar-check', ['Jasa', 'Fasilitas', 'Meja']),
      G('Pengaturan Ruangan', 'door-open', ['Daftar Ruangan', 'Jenis Ruangan']),
      G('Pembayaran', 'credit-card', ['Biaya', 'Pajak', 'Pembayaran Non-Tunai', 'Satuan Barang']),
      G('Cetak', 'printer', ['PDF', 'Struk', 'Printer']),
      G('Kasir', 'calculator', ['Daftar Kasir', 'Kategori Kas Kasir']),
      G('Terminal', 'tablet-smartphone', ['Daftar Perangkat', 'Perangkat Pay Go']),
      G('Akses Support', 'headphones', ['Daftar Akses Support']),
      L('Daftar Ekspor', { icon: 'download' })
    ]
  },
  bantuan: {
    label: 'Bantuan',
    more: true,
    home: 'panduan-penggunaan',
    items: [
      G('Menu Favorit', 'star', ['Panduan Penggunaan']),
      G('Panduan Penggunaan', 'book-open', ['Panduan Penggunaan', 'Masukan Perbaikan'])
    ]
  },
  layanan: {
    label: 'Layanan',
    more: true,
    home: 'qris',
    items: [
      G('Menu Favorit', 'star', ['QRIS']),
      G('Pay', 'scan-line', ['QRIS', 'Pengajuan EDC']),
      G('Capital', 'landmark', ['Pengajuan Capital']),
      G('Integrasi Satu Sehat', 'heart-pulse', ['Pengaturan Satu Sehat']),
      L('AI Asisten Manajer', { icon: 'sparkles' })
    ]
  },
  inspirasi: {
    label: 'Inspirasi',
    more: true,
    home: 'home-blog',
    items: [
      G('Menu Favorit', 'star', ['Home Blog']),
      L('Informasi Update', { icon: 'newspaper' }),
      G('Inspirasi Wirausaha', 'lightbulb', [
        G('Blog', null, ['Home Blog', 'Berbagi', 'Tren Bisnis', 'Trivia', 'Kisah Sukses', 'Tips', 'Inspirasi', 'Edukasi', 'Event', 'Preneur'])
      ])
    ]
  },
  pendanaan: { label: 'Kamu Punya Pendanaan Siap pakai', more: true, redirect: '#/layanan/pengajuan-capital' },
  supplies: {
    label: 'Supplies',
    more: true,
    home: 'supplies',
    items: [
      G('Menu Favorit', 'star', ['Supplies']),
      G('Supplies', 'shopping-bag', ['Supplies', 'Daftar Belanja'])
    ]
  }
};

const slugify = s => s.toLowerCase().replace(/&/g, 'dan').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const slugOf = item => item.slug || slugify(item.label);
