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
  LayoutDashboard,
  Package,
  PackageCheck,
  User,
  Clock,
  Sparkles,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useDynamicIsland } from '../../../context/DynamicIslandContext';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';

const getAvatarUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace('/api', '');
  return `${apiBase}${path}`;
};

const pageTitles = {
  '/kasir/dashboard': 'Dashboard Kasir',
  '/kasir/terminal': 'Terminal Kasir (POS)',
  '/kasir/produk': 'Katalog & Stok Produk',
  '/kasir/pesanan': 'Pesanan & Pelunasan',
  '/kasir/antrean-wa': 'Antrean Online & Offline',
  '/kasir/pelanggan-supplier': 'Pelanggan',
  '/kasir/riwayat': 'Riwayat Transaksi POS',
  '/kasir/shift': 'Kelola Kas & Shift Harian',
  '/kasir/ringkasan-shift-v2': 'Ringkasan Shift & Laporan',
  '/kasir/pengaturan-wa': 'Pengaturan Notifikasi WA',
};

export default function KasirHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, businessSettings } = useAuth();
  const { shiftAktif } = useKasir();

  const [liveTime, setLiveTime] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setLiveTime(`${h}:${m}:${s}`);
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
  const currentTitle = pageTitles[location.pathname] || 'Terminal Kasir';

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 shadow-xs flex items-center justify-between gap-4 px-6 z-20 select-none shrink-0">
      {/* ── Kiri: Title Page / Breadcrumb ── */}
      <div className="flex items-center gap-3">
        <h1 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <span>{currentTitle}</span>
        </h1>
      </div>

      {/* ── Kanan: Shift Badge, Jam Live, & Profile ── */}
      <div className="flex items-center gap-3">
        {/* Shift Badge Indicator */}
        <button
          onClick={() => navigate('/kasir/shift')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
            shiftAktif
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
          }`}
          title="Klik untuk melihat detail Shift"
        >
          <span className={`w-2 h-2 rounded-full ${shiftAktif ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
          <span>{shiftAktif ? `Shift: ${shiftAktif.kasir_name || user?.username}` : 'Shift Belum Dibuka'}</span>
        </button>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700">
          <Clock size={14} className="text-slate-400" />
          <span className="font-mono font-bold text-xs tracking-wider">{liveTime}</span>
        </div>

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfile((v) => !v)}
            className="flex items-center gap-2 cursor-pointer group outline-none"
          >
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border-2 border-slate-200 group-hover:border-blue-500 transition-colors shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-blue-700 font-extrabold text-sm">
                  {(user?.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden py-1 text-slate-800 animate-fade-in">
              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/60">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Masuk sebagai</p>
                <p className="text-xs font-extrabold text-slate-800 truncate capitalize">
                  {user?.username}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowProfile(false);
                  navigate('/profile');
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left cursor-pointer"
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
