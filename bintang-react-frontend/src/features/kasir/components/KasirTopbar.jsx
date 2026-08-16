import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  LogOut,
  UserCheck,
  BellRing,
  CreditCard,
  History,
  Wallet,
  Settings,
  MessageCircle,
  MessageSquare,
  LayoutDashboard,
  Package,
  PackageCheck,
  Menu,
  ArrowLeft,
  Boxes,
  BarChart3,
  CalendarClock,
  ShoppingCart,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useDynamicIsland } from '../../../context/DynamicIslandContext';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';

const getAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace(
    '/api',
    ''
  );
  return `${apiBase}${path}`;
};

export default function KasirTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, businessSettings } = useAuth();
  const { shiftAktif } = useKasir();
  const { activeNotification, dismissNotification } = useDynamicIsland();

  const [liveTime, setLiveTime] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [waOrderCount, setWaOrderCount] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const profileRef = useRef(null);

  // Poll count of incoming WA orders (status_global=review, sumber=wa)
  const fetchWaOrdersCount = async () => {
    try {
      const response = await apiClient.get('/orders/', {
        params: { status_global: 'review', sumber: 'wa' },
      });
      const data = response.data || [];
      setWaOrderCount(data.length);
    } catch (error) {
      console.error('Error fetching WA orders count:', error);
    }
  };

  useEffect(() => {
    fetchWaOrdersCount();
    const interval = setInterval(fetchWaOrdersCount, 15000); // 15 seconds poll
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setLiveTime(`${h}:${m}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const avatarUrl = getAvatarUrl(user?.foto_profil);
  const userRole = user?.role?.toLowerCase();

  // Tab utama = fungsi kasir sesuai rute KasirApp (PRD)
  const navLinks = [
    { path: '/kasir/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/kasir/terminal', label: 'Terminal', icon: CreditCard },
    { path: '/kasir/produk', label: 'Produk', icon: Package },
    { path: '/kasir/pesanan', label: 'Pesanan', icon: PackageCheck },
    { path: '/kasir/antrean-wa', label: 'Antrean WA', icon: MessageCircle, badge: waOrderCount },
    { path: '/kasir/wa-live', label: 'WA Live', icon: MessageSquare },
    { path: '/kasir/riwayat', label: 'Riwayat', icon: History },
    { path: '/kasir/shift', label: 'Kas & Shift', icon: Wallet },
    { path: '/kasir/ringkasan-shift-v2', label: 'Ringkasan', icon: BellRing },
    { path: '/kasir/pengaturan-wa', label: 'Pengaturan WA', icon: Settings },
  ];

  return (
    <>
      <header className="sticky top-0 z-45 h-16 bg-blue-600 text-white shadow-md flex items-center justify-between gap-4 px-6 select-none">
        {/* Kiri: Hamburger Menu & Title */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="text-white hover:text-blue-100 focus:outline-none transition-colors p-1 rounded-lg hover:bg-blue-700/40 cursor-pointer"
            title="Buka Menu"
          >
            <Menu size={24} />
          </button>

          <Link to="/kasir/terminal" className="flex items-center gap-2">
            <span className="font-black text-white text-base tracking-tight truncate max-w-[150px] md:max-w-xs">
              {businessSettings?.nama_bisnis || 'Bintang Advertising'}
            </span>
          </Link>

          {/* Desktop Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-blue-700/40 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full ml-4">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              const Icon = link.icon;
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-blue-105 text-blue-100 hover:text-white hover:bg-blue-700/30'
                  }`}
                >
                  <Icon size={14} />
                  <span>{link.label}</span>
                  {link.badge > 0 && (
                    <span className="ml-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black leading-none">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Kanan: Shift status, Shortcuts, Jam, Profile */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Shift status badge */}
          {shiftAktif ? (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-750 bg-blue-700/50 border border-blue-500/30 text-emerald-300 text-xs font-bold rounded-xl">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span>Shift: {shiftAktif.kasir_name || 'Aktif'}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-750 bg-blue-700/50 border border-blue-500/30 text-rose-350 text-rose-300 text-xs font-bold rounded-xl">
              <span className="w-1.5 h-1.5 bg-rose-405 bg-rose-400 rounded-full" />
              <span>Shift Belum Dibuka</span>
            </div>
          )}

          {/* Jam */}
          <div className="hidden sm:flex items-center px-2.5 py-1.5 rounded-lg bg-blue-800/85 border border-blue-700 select-none">
            <span className="font-mono font-black text-xs tracking-widest leading-none text-blue-200">
              {liveTime}
            </span>
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-8 w-px bg-blue-500/30" />

          {/* User Account Menu */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="flex items-center gap-2.5 cursor-pointer group outline-none text-white"
            >
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-bold text-white group-hover:text-blue-100 transition-colors leading-tight">
                  {user?.username || 'User'}
                </span>
                <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">
                  {user?.role || 'staff'}
                </span>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-500/50 flex items-center justify-center overflow-hidden shrink-0 border-2 border-blue-400 shadow-sm group-hover:border-white transition-colors">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-base">
                    {(user?.username || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 animate-scale-up text-slate-800">
                <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-left">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Masuk sebagai</p>
                  <p className="text-sm font-black text-slate-700 truncate capitalize">
                    {user?.username}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    navigate('/profile');
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors text-left cursor-pointer"
                >
                  <UserCheck size={14} className="text-slate-400" />
                  <span>Pengaturan Profil</span>
                </button>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors text-left border-t border-slate-100 cursor-pointer"
                >
                  <LogOut size={14} className="text-rose-500" />
                  <span>Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Drawer Overlay (Backdrop) */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer Content (Slide-out Sidebar) */}
      <div
        className={`fixed inset-y-0 left-0 z-55 w-72 bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header with Cashier Info & Close Button */}
        <div className="p-6 border-b border-slate-100 flex flex-col items-center relative bg-slate-50">
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-200/50 rounded-lg cursor-pointer"
            title="Tutup Menu"
          >
            <ArrowLeft size={20} />
          </button>

          {/* Avatar Profile */}
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-md mb-3 mt-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-blue-600 font-black text-3xl">
                {(user?.username || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <h4 className="font-extrabold text-slate-800 text-sm mb-0.5 capitalize">
            {user?.username}
          </h4>
          <span className="text-[10px] bg-blue-50 text-blue-600 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {user?.role}
          </span>
        </div>

        {/* Drawer Menu List */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/kasir/terminal');
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              location.pathname === '/kasir/terminal'
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <CreditCard size={18} className="text-slate-400" />
            <span>Aplikasi Kasir</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/orders');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all text-left cursor-pointer"
          >
            <ShoppingCart size={18} className="text-slate-400" />
            <span>Transaksi</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/product-inventory/product');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all text-left cursor-pointer"
          >
            <Boxes size={18} className="text-slate-400" />
            <span>Inventori</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/kasir/shift');
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
              location.pathname === '/kasir/shift'
                ? 'bg-blue-50 text-blue-650 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Wallet size={18} className="text-slate-400" />
            <span>Kas Masuk-Keluar</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/laporan/laporan');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all text-left cursor-pointer"
          >
            <BarChart3 size={18} className="text-slate-400" />
            <span>Laporan</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/settings/toko');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all text-left cursor-pointer"
          >
            <Settings size={18} className="text-slate-400" />
            <span>Pengaturan</span>
          </button>

          <button
            onClick={() => {
              setIsDrawerOpen(false);
              navigate('/attendance');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all text-left cursor-pointer"
          >
            <CalendarClock size={18} className="text-slate-400" />
            <span>Absensi</span>
          </button>
        </nav>

        {/* Drawer Footer / Logout */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => {
              setIsDrawerOpen(false);
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-all text-left cursor-pointer"
          >
            <LogOut size={18} className="text-rose-500" />
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </>
  );
}
