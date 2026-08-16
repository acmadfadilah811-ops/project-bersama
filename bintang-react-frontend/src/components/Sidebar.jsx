import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasMenuAccess } from '../utils/permissions';
import {
  LayoutDashboard,
  LineChart,
  ShoppingCart,
  Kanban,
  Package,
  Boxes,
  Users,
  Settings,
  LogOut,
  Star,
  ChevronLeft,
  ChevronRight,
  User,
  Briefcase,
  CalendarClock,
  BookOpen,
  Bell,
  DollarSign,
  ChevronDown,
  BarChart3,
  Layers,
  AlertTriangle,
  MessageSquare,
  Tag,
  Barcode,
  Wallet,
  ShoppingBag,
  ArrowLeftRight,
  CreditCard,
  History,
  Banknote,
  Store,
  Gift,
} from 'lucide-react';


const PENGATURAN_GROUP = {
  id: 'pengaturan',
  label: 'Pengaturan',
  icon: Settings,
  isGroup: true,
  submenus: [
    { path: '/settings/toko', label: 'Toko', icon: Store },
    { path: '/settings/point-of-sale', label: 'Point Of Sale', icon: CreditCard },
    { path: '/settings/notifikasi', label: 'Notifikasi', icon: Bell },
    { path: '/settings/sistem-stok', label: 'Sistem Stok', icon: Boxes },
  ],
};

const groupedMenuOwnerManager = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, isGroup: false },
  // Hanya di menu owner/manager — endpoint-nya juga dibatasi IsOwnerOrManager.
  { path: '/dashboard-eksekutif', label: 'Dashboard Eksekutif', icon: LineChart, isGroup: false },
  {
    id: 'produk_inventori',
    label: 'Produk & Inventori',
    icon: Boxes,
    isGroup: true,
    submenus: [
      { path: '/product-inventory/product', label: 'Produk', icon: Package },
      { path: '/product-inventory/inventory', label: 'Inventori', icon: Package },
      { path: '/product-inventory/special-type', label: 'Tipe Special', icon: Layers },
      { path: '/product-inventory/barcode', label: 'Cetak Barcode Produk', icon: Barcode },
      { path: '/product-inventory/price-label', label: 'Cetak Label Harga', icon: Tag },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Tag,
    isGroup: true,
    submenus: [
      { path: '/marketing/voucher-diskon', label: 'Voucher & Diskon', icon: Tag },
      { path: '/marketing/loyalty-point', label: 'Loyalty Point', icon: Gift },
    ],
  },
  { path: '/customer-supplier', label: 'Pelanggan & Supplier', icon: Users, isGroup: false },
  {
    id: 'transaksi_pembayaran',
    label: 'Transaksi & Pembayaran',
    icon: Wallet,
    accent: 'emerald',
    isGroup: true,
    submenus: [
      { path: '/transaksi/penjualan', label: 'Penjualan', icon: ShoppingCart },
      { path: '/transaksi/pembelian', label: 'Pembelian', icon: ShoppingBag },
      { path: '/transaksi/pendapatan-pengeluaran', label: 'Pendapatan/Pengeluaran', icon: ArrowLeftRight },
      { path: '/transaksi/digital-payment', label: 'Digital Payment', icon: CreditCard },
    ],
  },
  {
    id: 'laporan_pembukuan',
    label: 'Laporan dan Pembukuan',
    icon: History,
    isGroup: true,
    submenus: [
      { path: '/laporan/pencairan-dana', label: 'Pencairan Dana', icon: Banknote },
      { path: '/laporan/laporan', label: 'Laporan', icon: BarChart3 },
      { path: '/accounting-internal', label: 'Akuntansi Internal', icon: BookOpen },
    ],
  },
  {
    id: 'operasional',
    label: 'Operasional',
    icon: ShoppingCart,
    isGroup: true,
    submenus: [
      { path: '/orders', label: 'Pesanan', icon: ShoppingCart },
      { path: '/produksi', label: 'Papan Kerja (SPK)', icon: Kanban },
      { path: '/customers', label: 'Pelanggan', icon: User },
      { path: '/komplain', label: 'Komplain & Garansi', icon: AlertTriangle },
    ],
  },
  {
    id: 'hr_kepegawaian',
    label: 'HR & Kepegawaian',
    icon: Users,
    isGroup: true,
    submenus: [
      { path: '/attendance', label: 'Absensi', icon: CalendarClock },
      { path: '/employees', label: 'Karyawan', icon: Briefcase },
      { path: '/payroll', label: 'Penggajian & BoM', icon: DollarSign },
      { path: '/divisi', label: 'Divisi & Tahap', icon: Layers },
      { path: '/announcements', label: 'Pengumuman', icon: Bell },
      { path: '/reports', label: 'Laporan Kerja', icon: BarChart3 },
    ],
  },
  {
    id: 'keuangan_logistik',
    label: 'Keuangan & Logistik',
    icon: BookOpen,
    isGroup: true,
    submenus: [
      { path: '/inventory', label: 'Inventori Lama', icon: Package },
      { path: '/buku-besar', label: 'Buku Besar', icon: BookOpen },
      { path: '/pricelist', label: 'Daftar Harga', icon: DollarSign },
    ],
  },
  { path: '/profile', label: 'Profil', icon: User, isGroup: false },
  PENGATURAN_GROUP,
];

const menuStaff = [
  { path: '/staff-dashboard', label: 'Dashboard', icon: LayoutDashboard, isGroup: false },
  { path: '/produksi', label: 'Papan Kerja (SPK)', icon: Kanban, isGroup: false },
  { path: '/profile', label: 'Profil', icon: User, isGroup: false },
];

const menuKasir = [
  { path: '/kasir/dashboard', label: 'Dashboard', icon: LayoutDashboard, isGroup: false },
  { path: '/kasir/terminal', label: 'Kasir (POS)', icon: CreditCard, isGroup: false },
  { path: '/kasir/produk', label: 'Daftar Produk', icon: Package, isGroup: false },
  { path: '/kasir/antrean-wa', label: 'Antrean WA', icon: MessageSquare, isGroup: false },
  { path: '/kasir/riwayat', label: 'Riwayat Transaksi', icon: History, isGroup: false },
  { path: '/kasir/shift', label: 'Shift & Kas', icon: Wallet, isGroup: false },
  { path: '/attendance', label: 'Absensi Kehadiran', icon: CalendarClock, isGroup: false },
  { path: '/kasir/pengaturan-wa', label: 'Pengaturan WA', icon: Settings, isGroup: false },
  { path: '/profile', label: 'Profil', icon: User, isGroup: false },
];

const menuAdmin = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, isGroup: false },
  { path: '/kasir/terminal', label: 'Kasir (POS)', icon: CreditCard, isGroup: false },
  { path: '/produksi', label: 'Papan Kerja (SPK)', icon: Kanban, isGroup: false },
  { path: '/accounting-internal', label: 'Akuntansi Internal', icon: BookOpen, isGroup: false },
  { path: '/profile', label: 'Profil', icon: User, isGroup: false },
  PENGATURAN_GROUP,
];

const getLogoUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace(
    '/api',
    ''
  );
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${apiBase}${path}`;
};

// Aksen warna khusus per grup menu (selain biru default).
// Kelas ditulis literal agar terbaca oleh Tailwind.
const GROUP_ACCENTS = {
  emerald: {
    groupActive: 'bg-emerald-50 text-emerald-700 font-extrabold border-l-2 border-emerald-500',
    groupIdle: 'text-emerald-700 hover:bg-emerald-50/60 hover:text-emerald-800 font-semibold',
    icon: 'text-emerald-600',
    subActive: 'text-emerald-700 font-extrabold bg-emerald-50/70',
  },
};

export default function Sidebar() {
  const { user, logout, businessSettings } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setLogoError(false);
  }, [businessSettings?.logo_url]);

  // Status open/close untuk accordion group
  const [openGroups, setOpenGroups] = useState({
    operasional: true, // Default terbuka
    produk_inventori: true,
    marketing: true,
    transaksi_pembayaran: true,
    laporan_pembukuan: true,
    hr_kepegawaian: false,
    keuangan_logistik: false,
    pengaturan: false,
  });

  const userRole = user?.role?.toLowerCase() || 'staff';

  const getFeatureIdByPath = (path) => {
    if (path === '/dashboard' || path === '/') return 'dashboard';
    if (path === '/staff-dashboard') return 'staff-dashboard';
    if (path === '/orders') return 'orders';
    if (path.startsWith('/kasir')) return 'kasir-pos';
    if (path === '/jobs' || path === '/produksi') return 'jobs';
    if (path === '/customers') return 'customers';
    if (path === '/attendance') return 'attendance';
    if (path === '/employees') return 'employees';
    if (path === '/payroll') return 'payroll';
    if (path === '/announcements') return 'announcements';
    if (path === '/reports') return 'reports';
    if (path.startsWith('/product-inventory')) return 'product-inventory';
    if (path.startsWith('/customer-supplier')) return 'customer-supplier';
    if (path === '/inventory') return 'inventory';
    if (path === '/buku-besar') return 'buku-besar';
    if (path === '/pricelist') return 'pricelist';
    if (path === '/divisi') return 'divisi';
    if (path === '/settings' || path.startsWith('/settings/')) return 'settings';
    if (path.startsWith('/accounting-internal')) return 'accounting-internal';
    return null;
  };

  const baseMenu =
    userRole === 'staff'
      ? menuStaff
      : userRole === 'kasir'
      ? menuKasir
      : userRole === 'admin'
      ? menuAdmin
      : groupedMenuOwnerManager;

  // Filter menu berdasarkan perizinan hak akses dinamis
  const filteredMenu = baseMenu
    .map((item) => {
      if (item.isGroup) {
        const allowedSubmenus = item.submenus.filter((sub) => {
          const fid = getFeatureIdByPath(sub.path);
          return fid ? hasMenuAccess(userRole, fid) : true;
        });

        if (allowedSubmenus.length > 0) {
          return { ...item, submenus: allowedSubmenus };
        }
        return null;
      } else {
        const fid = getFeatureIdByPath(item.path);
        const isAllowed = fid ? hasMenuAccess(userRole, fid) : true;
        return isAllowed ? item : null;
      }
    })
    .filter(Boolean);

  const toggleGroup = (id) => {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <aside
      className={`bg-white min-h-screen flex flex-col border-r border-slate-200 transition-all duration-300 relative z-20 shadow-sm ${
        isCollapsed ? 'w-20' : 'w-56'
      }`}
    >
      {/* Tombol Toggle Expand/Collapse */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-6 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 p-1 rounded-full border border-slate-200 z-30 transition-colors shadow-sm cursor-pointer"
      >
        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logo / Nama Aplikasi */}
      <div className="h-16 flex items-center justify-center border-b border-slate-200 overflow-hidden bg-white shrink-0">
        <div
          className={`flex items-center gap-2 whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'scale-110' : 'scale-100'}`}
        >
          <div
            className={`rounded-lg flex items-center justify-center overflow-hidden w-12 h-12 shrink-0 ${
              businessSettings?.logo_url && !logoError
                ? 'p-0'
                : 'p-2.5 bg-blue-650 bg-blue-600 shadow-sm'
            }`}
          >
            {businessSettings?.logo_url && !logoError ? (
              <img
                src={getLogoUrl(businessSettings.logo_url)}
                alt="Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <Star className="text-white shrink-0" size={24} />
            )}
          </div>
          {!isCollapsed && (
            <h1
              className="text-slate-800 text-slate-800 font-extrabold text-sm tracking-tight animate-fade-in truncate max-w-[125px]"
              title={businessSettings?.nama_bisnis || 'Bintang Advertising'}
            >
              {businessSettings?.nama_bisnis || 'Bintang Advertising'}
            </h1>
          )}
        </div>
      </div>

      {/* Menu Navigasi */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar bg-white">
        {filteredMenu.map((item) => {
          if (!item.isGroup) {
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : ''}
                className={`w-full flex items-center rounded-lg text-sm transition-all duration-200 focus:outline-none cursor-pointer ${
                  isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'
                } ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-extrabold shadow-sm border border-blue-100'
                    : 'text-slate-650 hover:bg-slate-50 hover:text-slate-900 font-semibold'
                }`}
              >
                <Icon size={isCollapsed ? 20 : 18} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap text-left">{item.label}</span>}
              </button>
            );
          } else {
            // Group Menu (Accordion)
            const isOpen = openGroups[item.id];
            const isAnySubActive = item.submenus.some((sub) => location.pathname === sub.path || location.pathname.startsWith(`${sub.path}/`));
            const GroupIcon = item.icon;
            const accent = item.accent ? GROUP_ACCENTS[item.accent] : null;

            return (
              <div key={item.id} className="space-y-1">
                {/* Header Group */}
                <button
                  onClick={() => toggleGroup(item.id)}
                  title={isCollapsed ? item.label : ''}
                  className={`w-full flex items-center justify-between rounded-lg text-sm transition-all duration-200 focus:outline-none cursor-pointer ${
                    isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'
                  } ${
                    isAnySubActive
                      ? accent?.groupActive ||
                        'bg-slate-50 text-blue-600 font-extrabold border-l-2 border-blue-500'
                      : accent?.groupIdle ||
                        'text-slate-650 hover:bg-slate-50/50 hover:text-slate-800 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GroupIcon
                      size={isCollapsed ? 20 : 18}
                      className={`shrink-0 ${accent?.icon || ''}`}
                    />
                    {!isCollapsed && (
                      <span className="whitespace-nowrap text-left">{item.label}</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ChevronDown
                      size={14}
                      className={`text-slate-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </button>

                {/* Submenu List (Slide Down Effect) */}
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden space-y-0.5">
                    {item.submenus.map((sub) => {
                      const isSubActive = location.pathname === sub.path || location.pathname.startsWith(`${sub.path}/`);
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.path}
                          onClick={() => navigate(sub.path)}
                          title={isCollapsed ? sub.label : ''}
                          className={`w-full flex items-center rounded-lg transition-all duration-200 focus:outline-none cursor-pointer ${
                            isCollapsed
                              ? 'justify-center p-1.5 my-0.5'
                              : 'pl-9 pr-3 py-1.5 gap-2 text-sm'
                          } ${
                            isSubActive
                              ? accent?.subActive || 'text-blue-600 font-extrabold bg-blue-50/60'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/30'
                          }`}
                        >
                          <SubIcon size={isCollapsed ? 16 : 14} className="shrink-0" />
                          {!isCollapsed && (
                            <span className="whitespace-nowrap text-left">{sub.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }
        })}
      </nav>

      {/* Tombol Logout */}
      <div className="p-3 border-t border-slate-200 bg-white shrink-0">
        <button
          onClick={logout}
          title={isCollapsed ? 'Keluar' : ''}
          className={`flex items-center w-full rounded-lg text-sm text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold transition-all duration-200 cursor-pointer ${
            isCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'
          }`}
        >
          <LogOut size={isCollapsed ? 20 : 18} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
