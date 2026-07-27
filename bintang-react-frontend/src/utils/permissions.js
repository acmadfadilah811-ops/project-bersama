// 5 Kategori Akun Utama & Rincian Fitur Akses
export const MENU_FEATURES = [
  { id: 'dashboard', label: 'Dashboard Utama', path: '/' },
  { id: 'staff-dashboard', label: 'Dashboard Staff', path: '/staff-dashboard' },
  { id: 'kasir-pos', label: 'Point of Sale (Kasir)', path: '/kasir' },
  { id: 'orders', label: 'Pesanan (Orders)', path: '/orders' },
  { id: 'jobs', label: 'Papan Produksi (Jobs)', path: '/jobs' },
  { id: 'customers', label: 'Pelanggan (Customers)', path: '/customers' },
  { id: 'whatsapp-chat', label: 'WhatsApp Chat', path: '/whatsapp-chat' },
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
];

export const DEFAULT_PERMISSIONS = {
  owner: [
    'dashboard',
    'kasir-pos',
    'orders',
    'jobs',
    'customers',
    'whatsapp-chat',
    'attendance',
    'employees',
    'payroll',
    'announcements',
    'reports',
    'product-inventory',
    'customer-supplier',
    'inventory',
    'buku-besar',
    'pricelist',
    'divisi',
    'settings',
  ],
  manager: [
    'dashboard',
    'kasir-pos',
    'orders',
    'jobs',
    'customers',
    'whatsapp-chat',
    'attendance',
    'employees',
    'payroll',
    'announcements',
    'reports',
    'product-inventory',
    'customer-supplier',
    'inventory',
    'buku-besar',
    'pricelist',
    'divisi',
    'settings',
  ],
  admin: [
    'dashboard',
    'kasir-pos',
    'orders',
    'jobs',
    'customers',
    'whatsapp-chat',
    'product-inventory',
    'customer-supplier',
    'inventory',
    'buku-besar',
    'pricelist',
    'settings',
  ],
  staff: ['staff-dashboard', 'jobs'],
  kasir: ['kasir-pos'],
};


// Perizinan yang WAJIB dimiliki dan tidak bisa dihapus per-role
const LOCKED_PERMISSIONS = {
  admin: ['dashboard', 'settings', 'jobs'],
  manager: ['dashboard'],
  staff: ['staff-dashboard'],
  kasir: ['kasir-pos'],
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

  // Owner memiliki akses penuh tanpa kecuali
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
  if (path.startsWith('/papan-kerja') || path.startsWith('/produksi') || path.startsWith('/jobs')) return 'jobs';
  if (path.startsWith('/product-inventory')) return 'product-inventory';
  if (path.startsWith('/transaksi')) return 'buku-besar';
  if (path.startsWith('/laporan')) return 'reports';
  if (path.startsWith('/marketing')) return 'customers';
  if (path.startsWith('/users')) return 'employees';
  if (path.startsWith('/dashboard-eksekutif')) return 'dashboard';
  if (path.startsWith('/komplain')) return 'customers';
  const match = MENU_FEATURES.find((f) => f.path !== '/' && path.startsWith(f.path));
  return match ? match.id : null;
}
