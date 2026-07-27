import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  X,
  LogOut,
  UserCheck,
  BellRing,
  Sparkles,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useDynamicIsland } from '../../../context/DynamicIslandContext';
import { useTransaksiCrumb } from './TransaksiContext';

const LABELS = {
  '/transaksi/penjualan': 'Penjualan',
  '/transaksi/pembelian': 'Pembelian',
  '/transaksi/pendapatan-pengeluaran': 'Pendapatan/Pengeluaran',
  '/transaksi/digital-payment': 'Digital Payment',
  '/laporan/pencairan-dana': 'Pencairan Dana',
  '/laporan/laporan': 'Laporan',
  '/marketing/voucher-diskon': 'Marketing',
  '/marketing/loyalty-point': 'Marketing',
  '/settings/toko': 'Pengaturan',
  '/settings/point-of-sale': 'Pengaturan',
  '/settings/notifikasi': 'Pengaturan',
  '/settings/sistem-stok': 'Pengaturan',
};

const getAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace(
    '/api',
    ''
  );
  return `${apiBase}${path}`;
};

const notifIcon = (type) => {
  if (type === 'announcement') return <BellRing size={14} />;
  if (type === 'job') return <Sparkles size={14} />;
  if (type === 'attendance') return <UserCheck size={14} />;
  if (type === 'permission') return <AlertCircle size={14} />;
  if (type === 'message' || type === 'whatsapp') return <MessageSquare size={14} />;
  return <Bell size={14} />;
};

/**
 * Topbar putih ringkas khusus area Transaksi (tampilan full-screen).
 * Kiri: breadcrumb menu. Kanan: jam, notifikasi (dynamic island dikecilkan),
 * dan akun. Dynamic island hanya muncul ringkas saat ada notifikasi aktif
 * agar keterangan menu cukup ruang.
 */
export default function TransaksiTopbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeNotification, dismissNotification } = useDynamicIsland();
  const { subtitle } = useTransaksiCrumb();

  const [liveTime, setLiveTime] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

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

  let label = LABELS[location.pathname];
  if (!label) {
    if (location.pathname.startsWith('/product-inventory/product')) {
      label = 'Katalog Produk';
    } else if (location.pathname.startsWith('/product-inventory/inventory')) {
      label = 'Inventori';
    } else if (location.pathname.startsWith('/product-inventory/price-label')) {
      label = 'Cetak Label Harga';
    } else if (location.pathname.startsWith('/product-inventory/special-type')) {
      label = 'Special Type';
    } else if (location.pathname.startsWith('/product-inventory/barcode')) {
      label = 'Print Barcode Product';
    } else if (location.pathname.startsWith('/product-inventory/deposit')) {
      label = 'Deposit';
    } else if (location.pathname.startsWith('/product-inventory/pos-stock-mode')) {
      label = 'Mode Stok POS';
    } else if (location.pathname.startsWith('/product-inventory/merge-stocks')) {
      label = 'Gabung Stok';
    } else if (location.pathname.startsWith('/customer-supplier')) {
      label = 'Pelanggan & Supplier';
    } else if (location.pathname.startsWith('/accounting-internal')) {
      label = 'Akuntansi Internal';
    } else {
      label = 'Inventori';
    }
  }
  const avatarUrl = getAvatarUrl(user?.foto_profil);

  return (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between gap-4 px-6 relative">
      {/* Kiri: breadcrumb "Menu / Tab aktif" — mengisi penuh ke samping */}
      <div className="flex-1 min-w-0">
        <h1
          className="text-xl leading-tight truncate"
          title={subtitle ? `${label} / ${subtitle}` : label}
        >
          <span className="font-extrabold text-slate-800">{label}</span>
          {subtitle && (
            <>
              <span className="mx-2.5 text-slate-300 font-light">/</span>
              <span className="font-medium text-slate-500">{subtitle}</span>
            </>
          )}
        </h1>
      </div>

      {/* Dynamic Island ringkas — overlay mengambang di tengah, hanya saat ada notifikasi */}
      {activeNotification && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex items-center gap-2 bg-slate-950 text-white py-1.5 px-3 rounded-2xl shadow-lg border border-slate-800 max-w-[340px] animate-zoom-in">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
            {notifIcon(activeNotification.type)}
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-wide truncate leading-none">
              {activeNotification.title}
            </div>
            <div className="text-[8px] text-slate-400 truncate leading-snug mt-0.5">
              {activeNotification.message}
            </div>
          </div>
          <button
            onClick={dismissNotification}
            className="text-slate-500 hover:text-white shrink-0 p-0.5"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Kanan: jam, notifikasi, akun */}
      <div className="flex items-center gap-2.5 md:gap-3 shrink-0">
        {/* Jam */}
        <div className="hidden sm:flex items-center px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 select-none">
          <span
            className="font-mono font-black text-xs tracking-widest leading-none"
            style={{
              background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {liveTime}
          </span>
        </div>

        {/* Notifikasi */}
        <button
          className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50"
          title="Notifikasi"
        >
          <Bell size={18} />
          {activeNotification && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white animate-pulse" />
          )}
        </button>

        {/* Divider */}
        <div className="hidden sm:block h-8 w-px bg-slate-200" />

        {/* Akun */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-2.5 cursor-pointer group outline-none"
          >
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors leading-tight">
                {user?.username || 'User'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                {user?.role || 'staff'}
              </span>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden shrink-0 border-2 border-slate-200 shadow-sm group-hover:border-blue-400 transition-colors">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-blue-700 font-black text-base">
                  {(user?.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 animate-scale-up">
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 text-left">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Halo,</p>
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
  );
}
