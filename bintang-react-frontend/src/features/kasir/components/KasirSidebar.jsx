import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CreditCard,
  Package,
  PackageCheck,
  MessageCircle,
  History,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Store,
  ArrowLeftRight,
  ShieldAlert,
  User,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';

const getAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace('/api', '');
  return `${apiBase}${path}`;
};

export default function KasirSidebar({ isCollapsed, setIsCollapsed }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, businessSettings } = useAuth();
  const { shiftAktif } = useKasir();

  const [waOrderCount, setWaOrderCount] = useState(0);

  // Poll count of incoming WA orders (status_global=review, sumber=wa)
  const fetchWaOrdersCount = async () => {
    try {
      const response = await apiClient.get('/orders/', {
        params: { status_global: 'review', sumber: 'wa' },
      });
      const data = response.data || [];
      setWaOrderCount(data.length);
    } catch (error) {
      console.error('Error fetching WA orders count in sidebar:', error);
    }
  };

  useEffect(() => {
    fetchWaOrdersCount();
    const interval = setInterval(fetchWaOrdersCount, 15000);
    return () => clearInterval(interval);
  }, []);

  const avatarUrl = getAvatarUrl(user?.foto_profil);
  const userRole = user?.role?.toLowerCase();
  const isOwnerOrAdmin = ['owner', 'admin', 'manager'].includes(userRole);

  const navItems = [
    { path: '/kasir/dashboard', label: 'Dashboard Kasir', icon: LayoutDashboard },
    { path: '/kasir/terminal', label: 'Terminal POS', icon: CreditCard, highlight: true },
    { path: '/kasir/produk', label: 'Katalog Produk', icon: Package },
    { path: '/kasir/pesanan', label: 'Daftar Pesanan', icon: PackageCheck },
    { path: '/kasir/antrean-wa', label: 'Antrean WA', icon: MessageCircle, badge: waOrderCount },
    { path: '/kasir/riwayat', label: 'Riwayat Transaksi', icon: History },
    { path: '/kasir/shift', label: 'Shift', icon: Clock },
    { path: '/kasir/pengaturan-cetak', label: 'Printer & Cetak', icon: Printer },
  ];

  return (
    <aside
      className={`h-full bg-[#0f172a] text-slate-300 flex flex-col justify-between transition-all duration-300 z-30 select-none border-r border-slate-800 relative shadow-xl ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* ── Top Header & Branding ── */}
      <div>
        <div className="p-4 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0 font-black text-lg">
              <Store size={22} />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm text-white truncate tracking-tight">
                  {businessSettings?.nama_bisnis || 'Bintang POS'}
                </span>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} /> Terminal Kasir
                </span>
              </div>
            )}
          </div>

          {/* Toggle Expand/Collapse Sidebar */}
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer shrink-0 border border-slate-700/50"
            title={isCollapsed ? 'Perluas Sidebar' : 'Ciutkan Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* ── Shift Status Badge ── */}
        {!isCollapsed ? (
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div
              onClick={() => navigate('/kasir/shift')}
              className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                shiftAktif
                  ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300 hover:bg-emerald-900/50'
                  : 'bg-rose-950/40 border-rose-800/50 text-rose-300 hover:bg-rose-900/50'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    shiftAktif ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide">
                    {shiftAktif ? 'Shift Aktif' : 'Shift Belum Dibuka'}
                  </span>
                  <span className="text-[10px] opacity-80 truncate">
                    {shiftAktif ? `Kasir: ${shiftAktif.kasir_name || user?.username}` : 'Klik untuk buka shift'}
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="opacity-60" />
            </div>
          </div>
        ) : (
          <div className="p-3 border-b border-slate-800/60 flex justify-center">
            <button
              onClick={() => navigate('/kasir/shift')}
              title={shiftAktif ? 'Shift Aktif' : 'Shift Belum Dibuka'}
              className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
                shiftAktif
                  ? 'bg-emerald-950/50 border-emerald-700 text-emerald-400'
                  : 'bg-rose-950/50 border-rose-700 text-rose-400'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${shiftAktif ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            </button>
          </div>
        )}

        {/* ── Navigation Menu Items ── */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-280px)] no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative group cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : item.highlight ? 'text-blue-400' : 'text-slate-400'
                  }`}
                />

                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}

                {/* Badge Count */}
                {item.badge > 0 && (
                  <span
                    className={`shrink-0 rounded-full font-black text-[10px] px-2 py-0.5 ${
                      isActive
                        ? 'bg-white text-blue-700'
                        : 'bg-rose-500 text-white animate-pulse'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom Section: Ganti Operator, Switch App & User Profile ── */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 space-y-2">
        {/* Ganti Operator: kasir di sini bergantian pakai satu mesin kasir,
            bukan paralel. Tutup shift dulu (server juga menegakkan ini —
            SaldoKasHarianViewSet.create() menolak shift kedua yang masih
            terbuka), baru operator berikutnya login dengan akunnya sendiri. */}
        <button
          onClick={() => {
            if (shiftAktif) {
              alert('Tutup shift Anda terlebih dahulu sebelum ganti operator.');
              navigate('/kasir/shift');
              return;
            }
            logout();
            navigate('/login');
          }}
          title={isCollapsed ? 'Ganti Operator' : undefined}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer border border-slate-800"
        >
          <RefreshCw size={16} className="text-amber-400 shrink-0" />
          {!isCollapsed && <span className="truncate">Ganti Operator</span>}
        </button>

        {/* Switch to Main App (For Admin / Owner) */}
        {isOwnerOrAdmin && (
          <button
            onClick={() => navigate('/dashboard')}
            title={isCollapsed ? 'Kembali ke Aplikasi Utama' : undefined}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer border border-slate-800"
          >
            <ArrowLeftRight size={16} className="text-indigo-400 shrink-0" />
            {!isCollapsed && <span className="truncate">Kembali ke App Utama</span>}
          </button>
        )}

        {/* User Card */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-600/40 flex items-center justify-center overflow-hidden border border-blue-400/30 shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="User" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-xs">
                  {(user?.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate capitalize">
                  {user?.username}
                </span>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">
                  {user?.role}
                </span>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Keluar / Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
