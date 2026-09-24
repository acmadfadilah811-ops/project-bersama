// 5 Kategori Akun Utama & Rincian Fitur Akses
export const MENU_FEATURES = [
  { id: 'dashboard', label: 'Dashboard Utama', path: '/' },
  { id: 'staff-dashboard', label: 'Dashboard Staff', path: '/staff-dashboard' },
  { id: 'kasir-pos', label: 'Point of Sale (Kasir)', path: '/kasir' },
  { id: 'orders', label: 'Pesanan (Orders)', path: '/orders' },
  { id: 'jobs', label: 'Papan Produksi (Jobs)', path: '/jobs' },
  { id: 'customers', label: 'Pelanggan (Customers)', path: '/customers' },
  { id: 'attendance', label: 'Absensi (Attendance)', path: '/attendance' },
  { id: 'employees', label: 'Karyawan (Employees)', path: '/employees' },
  { id: 'payroll', label: 'Penggajian & BoM (Payroll)', path: '/payroll' },
  { id: 'announcements', label: 'Pengumuman (Announcements)', path: '/announcements' },
  { id: 'reports', label: 'Laporan Kerja (Reports)', path: '/reports' },
  { id: 'product-inventory', label: 'Produk & Inventori', path: '/product-inventory' },
  { id: 'customer-supplier', label: 'Pelanggan & Supplier', path: '/customer-supplier' },
  { id: 'inventory', label: 'Inventori Lama (Inventory)', path: '/inventory' },
  { id: 'buku-besar', label: 'Buku Besar (Ledger)', path: '/buku-besar' },
  { id: 'pricelist', label: 'Daftar Harga (Pricelist)', path: '/pricelist' },
  { id: 'settings', label: 'Pengaturan (Settings)', path: '/settings' },
  { id: 'divisi', label: 'Divisi & Tahap Proses', path: '/divisi' },
  { id: 'accounting-internal', label: 'Akuntansi Internal', path: '/accounting-internal' },
  { id: 'finance-dashboard', label: 'Dashboard Finance', path: '/finance-dashboard' },
  { id: 'laporan-kerja-keuangan', label: 'Laporan Kerja Harian (Finance)', path: '/laporan-kerja-keuangan' },
  { id: 'laporan', label: 'Laporan & Pembukuan', path: '/laporan' },
  { id: 'rekap-harian', label: 'Rekap Harian Penjualan', path: '/rekap-harian' },
  { id: 'ringkasan-shift', label: 'Ringkasan Shift', path: '/ringkasan-shift' },
  { id: 'wa-bot-config', label: 'Pengaturan WA Bot', path: '/pengaturan-wa-bot' },
  { id: 'permintaan-bahan', label: 'Permintaan Bahan', path: '/permintaan-bahan' },
  { id: 'marketing', label: 'Marketing', path: '/marketing' },
];

export const DEFAULT_PERMISSIONS = {
  owner: [
    'dashboard',
    'orders',
    'jobs',
    'customers',
    'attendance',
    'employees',
    'payroll',
    'announcements',
    'reports',
    'laporan',
    'marketing',
    'product-inventory',
    'customer-supplier',
    'inventory',
    'buku-besar',
    'pricelist',
    'divisi',
    'settings',
    'accounting-internal',
  ],
  manager: [
    'dashboard',
    'orders',
    'jobs',
    'customers',
    'attendance',
    'employees',
    'payroll',
    'announcements',
    'reports',
    'laporan',
    'marketing',
    'product-inventory',
    'customer-supplier',
    'inventory',
    'buku-besar',
    'pricelist',
    'divisi',
    'settings',
    'accounting-internal',
    'wa-bot-config',
  ],
  admin: [
    'dashboard',
    'kasir-pos',
    'orders',
    'jobs',
    'customers',
    'product-inventory',
    'customer-supplier',
    'inventory',
    'buku-besar',
    'pricelist',
    'settings',
    'accounting-internal',
  ],
  staff: ['staff-dashboard', 'jobs'],
  kasir: ['kasir-pos'],
  spv: ['staff-dashboard', 'jobs', 'permintaan-bahan'],
  kordiv: ['staff-dashboard', 'jobs', 'permintaan-bahan'],
  // 2026-09-24: dibuka ke fitur akuntansi yang sudah ada (sebelumnya cuma
  // finance-dashboard) -- Admin Finance jadi pelaksana penuh alur
  // Pengadaan/Pendapatan-Pengeluaran (buku-besar -> /transaksi/*) DAN lihat
  // laporan keuangan (accounting-internal, tapi tab Tutup Buku/COA/
  // Pengaturan/Hak Akses disaring lewat AccountingSecondarySidebar.jsx,
  // BUKAN di sini -- backend-nya juga tetap menolak role ini, lihat
  // api/permissions.py IsStrictOwnerOrManager). SPV Finance cuma dapat
  // accounting-internal (baca laporan) -- perannya supervisi/agregat,
  // bukan pelaksana transaksi harian, jadi TIDAK dapat buku-besar.
  // 2026-09-24: tugas Admin Finance -- rekap penjualan hari sebelumnya, laporan
  // penjualan, ringkasan shift, produk & inventori, pelanggan & supplier
  // (pembelian sudah lewat buku-besar). Backend-nya baca-saja untuk data POS/shift.
  admin_finance: [
    'finance-dashboard', 'buku-besar', 'laporan-kerja-keuangan',
    'laporan', 'rekap-harian', 'ringkasan-shift', 'product-inventory', 'customer-supplier',
  ],
  // 2026-09-24 (keputusan user): SPV Finance memegang seluruh akuntansi dan
  // fitur owner -- produk & inventori, marketing, pelanggan & supplier,
  // transaksi & pembayaran, laporan & pembukuan, Pengaturan > Point of Sale,
  // dan Permintaan Bahan (dicabut dari owner/manager).
  spv_finance: [
    'finance-dashboard', 'accounting-internal', 'laporan-kerja-keuangan',
    'product-inventory', 'marketing', 'customer-supplier', 'buku-besar',
    'laporan', 'rekap-harian', 'ringkasan-shift', 'settings', 'permintaan-bahan',
  ],
};


const REVOKED_PERMISSIONS = {
  owner: ['permintaan-bahan'],
  manager: ['permintaan-bahan'],
  admin_finance: ['accounting-internal'],
};

// Perizinan yang WAJIB dimiliki dan tidak bisa dihapus per-role
const LOCKED_PERMISSIONS = {
  admin: ['dashboard', 'settings', 'jobs', 'permintaan-bahan'],
  manager: ['dashboard'],
  staff: ['staff-dashboard'],
  kasir: ['kasir-pos'],
  spv: ['staff-dashboard', 'permintaan-bahan'],
  kordiv: ['staff-dashboard', 'permintaan-bahan'],
  admin_finance: ['finance-dashboard'],
  spv_finance: ['finance-dashboard'],
};

// Mendapatkan hak akses saat ini, dengan jaminan LOCKED_PERMISSIONS selalu ada
export function getPermissions() {
  const saved = localStorage.getItem('brandy_menu_permissions');
  let base = { ...DEFAULT_PERMISSIONS };

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Override base dengan data kustom yang tersimpan per-role
      Object.keys(parsed).forEach((role) => {
        if (Array.isArray(parsed[role])) {
          // Gabungkan dengan default permissions baru yang mungkin ditambahkan di update kode terbaru
          const defaults = DEFAULT_PERMISSIONS[role] || [];
          const savedPerms = parsed[role];
          const newDefaults = defaults.filter(p => !savedPerms.includes(p));
          base[role] = [...savedPerms, ...newDefaults];
        }
      });
    } catch (e) {
      console.error('Gagal mem-parse perizinan menu:', e);
    }
  }

  // Jamin perizinan yang terkunci (LOCKED) selalu ada, tidak peduli isi localStorage
  Object.entries(LOCKED_PERMISSIONS).forEach(([role, lockedIds]) => {
    if (base[role]) {
      const existing = base[role];
      lockedIds.forEach((id) => {
        if (!existing.includes(id)) {
          base[role] = [id, ...existing];
        }
      });
    }
  });

  // Fitur yang DICABUT per role -- dipaksa hilang walau masih tersimpan di
  // localStorage/pengaturan lama (keputusan user 2026-09-24).
  Object.entries(REVOKED_PERMISSIONS).forEach(([role, ids]) => {
    if (base[role]) base[role] = base[role].filter((id) => !ids.includes(id));
  });

  return base;
}

// Menyimpan perizinan ke localStorage, dengan jaminan locked permissions tidak hilang
export function savePermissions(permissions) {
  // Mulai dari DEFAULT sebagai fondasi agar tidak ada role yang hilang sama sekali
  const toSave = { ...DEFAULT_PERMISSIONS, ...permissions };

  // Paksa locked permissions tetap ada
  Object.entries(LOCKED_PERMISSIONS).forEach(([role, lockedIds]) => {
    if (toSave[role]) {
      lockedIds.forEach((id) => {
        if (!toSave[role].includes(id)) {
          toSave[role] = [id, ...toSave[role]];
        }
      });
    }
  });

  localStorage.setItem('brandy_menu_permissions', JSON.stringify(toSave));
  return toSave;
}

// Memeriksa apakah role tertentu memiliki akses ke menu terpilih
export function hasMenuAccess(role, featureId) {
  if (!role) return false;
  const currentRole = role.toLowerCase();

  // Owner memiliki akses penuh ke seluruh menu, KECUALI Kasir (POS) — modul
  // itu sengaja dikunci khusus akun kasir asli, tidak boleh dipakai owner
  // ataupun manager (instruksi user 2026-08-14).
  if (featureId === 'kasir-pos' && (currentRole === 'owner' || currentRole === 'manager')) return false;

  // Owner memiliki akses penuh tanpa kecuali (di luar pengecualian di atas)
  if (currentRole === 'owner') return true;

  // Cek locked permissions terlebih dahulu
  if (LOCKED_PERMISSIONS[currentRole]?.includes(featureId)) return true;

  const permissions = getPermissions();
  const rolePermissions = permissions[currentRole] || DEFAULT_PERMISSIONS[currentRole] || [];
  return rolePermissions.includes(featureId);
}

// Memetakan URL path ke ID fitur untuk proteksi rute
export function getFeatureIdByPath(path) {
  if (path === '/' || path.startsWith('/dashboard')) return 'dashboard';
  if (path.startsWith('/staff-dashboard')) return 'staff-dashboard';
  if (path.startsWith('/finance-dashboard')) return 'finance-dashboard';
  if (path.startsWith('/papan-kerja') || path.startsWith('/produksi') || path.startsWith('/jobs')) return 'jobs';
  if (path.startsWith('/product-inventory')) return 'product-inventory';
  if (path.startsWith('/transaksi')) return 'buku-besar';
  // HARUS sebelum '/laporan' generik di bawah -- kalau tidak, prefix
  // '/laporan' bikin ini salah dipetakan ke 'reports'.
  if (path.startsWith('/laporan-kerja-keuangan')) return 'laporan-kerja-keuangan';
  if (path.startsWith('/laporan')) return 'laporan';
  if (path.startsWith('/rekap-harian')) return 'rekap-harian';
  if (path.startsWith('/ringkasan-shift')) return 'ringkasan-shift';
  if (path.startsWith('/marketing')) return 'marketing';
  if (path.startsWith('/users')) return 'employees';
  if (path.startsWith('/dashboard-eksekutif')) return 'dashboard';
  if (path.startsWith('/komplain')) return 'customers';
  const match = MENU_FEATURES.find((f) => f.path !== '/' && path.startsWith(f.path));
  return match ? match.id : null;
}
