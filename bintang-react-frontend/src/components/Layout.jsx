import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import LockedScreen from './LockedScreen';
import MulaiKerjaGate from './MulaiKerjaGate';
import apiClient from '../api/apiClient';
import { LayoutDashboard, CalendarClock, ShoppingCart, Kanban, User, Camera, Wand2, Users } from 'lucide-react';
import { useMenuStarfoto } from '../features/starfoto/hooks/useMenuSesiFoto';
import NotifAntreanSesi from '../features/starfoto/components/NotifAntreanSesi';
import AktifkanNotifikasi from './AktifkanNotifikasi';

export default function Layout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [statusTerkunci, setStatusTerkunci] = useState(null);
  // SPV, Kordiv & Manager: menu terkunci sampai Mulai Kerja ditekan (2026-10-18/19).
  const [gerbangMulai, setGerbangMulai] = useState({ perlu: false, statusHr: null });
  const [loading, setLoading] = useState(true);
  const [isMobileScreen, setIsMobileScreen] = useState(() => window.innerWidth < 768);
  const menuStarfoto = useMenuStarfoto();
  const tampilSesiFoto = menuStarfoto.sesi;

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const checkStatus = async () => {
    const peran = user?.role?.toLowerCase();
    if (!user || !['staff', 'spv', 'kordiv', 'manager'].includes(peran)) {
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get('/hr/dashboard/staff/');
      setStatusTerkunci(response.data.status_terkunci);
      // Semua peran yang absen (staff, spv, kordiv, manager) wajib Mulai Kerja dulu.
      setGerbangMulai({
        // Papan kerja yang dibuka manual oleh manager ("Buka Papan") melewati gerbang.
        perlu: !response.data.absensi_hari_ini?.jam_masuk && !response.data.status_terkunci?.workspace_unlocked,
        statusHr: response.data.status_absen_hr || null,
        permintaanAkses: response.data.permintaan_akses_hr || null,
      });
    } catch (error) {
      console.error('Error checking lock status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [user]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Staff yang terkunci karena lewat batas waktu diarahkan ke layar Ajukan Izin lebih dulu.
  if (statusTerkunci && statusTerkunci.is_locked) {
    return <LockedScreen statusTerkunci={statusTerkunci} onRefresh={checkStatus} />;
  }

  if (gerbangMulai.perlu) {
    return <MulaiKerjaGate statusAbsenHr={gerbangMulai.statusHr} permintaanAkses={gerbangMulai.permintaanAkses} onSelesai={checkStatus} onMuatUlang={checkStatus} />;
  }

  if (location.pathname.startsWith('/produksi')) {
    return <Outlet />;
  }

  const mobileMenuStaff = [
    { path: '/staff-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/jobs', label: 'Produksi', icon: Kanban },
    // Fotografer/asisten & editor StarFoto (2026-10-11).
    ...(tampilSesiFoto ? [{ path: '/sesi-foto', label: 'Sesi Foto', icon: Camera }] : []),
    ...(menuStarfoto.edit ? [{ path: '/edit-foto', label: 'Edit Foto', icon: Wand2 }] : []),
    { path: '/profile', label: 'Profil', icon: User },
  ];

  const mobileMenuOwner = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/attendance', label: 'Absensi', icon: CalendarClock },
    { path: '/orders', label: 'Pesanan', icon: ShoppingCart },
    { path: '/jobs', label: 'Produksi', icon: Kanban },
    // SPV/Kordiv fotografi (2026-10-11).
    ...(tampilSesiFoto ? [{ path: '/sesi-foto', label: 'Sesi Foto', icon: Camera }] : []),
    { path: '/profile', label: 'Profil', icon: User },
  ];

  const mobileMenuSpvKordiv = [
    { path: '/staff-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/jobs', label: 'Produksi', icon: Kanban },
    ...(tampilSesiFoto ? [{ path: '/sesi-foto', label: 'Sesi Foto', icon: Camera }] : []),
    { path: '/ringkasan-tim', label: 'Tim', icon: Users },
    { path: '/profile', label: 'Profil', icon: User },
  ];

  const peranLower = user?.role?.toLowerCase();
  const mobileMenu = peranLower === 'staff'
    ? mobileMenuStaff
    : ['spv', 'kordiv'].includes(peranLower) ? mobileMenuSpvKordiv : mobileMenuOwner;

  // Fitur dengan tampilan full-screen + topbar sendiri (tanpa Topbar global).
  const fullScreenFeature =
    location.pathname.startsWith('/product-inventory') ||
    location.pathname.startsWith('/customer-supplier') ||
    location.pathname.startsWith('/transaksi') ||
    location.pathname.startsWith('/laporan') ||
    location.pathname.startsWith('/marketing') ||
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/accounting-internal') ||
    location.pathname.startsWith('/kasir');

  if (isMobileScreen) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#F4F7FE] relative">
        {/* Header / Topbar */}
        {!fullScreenFeature && (
          <div className="shrink-0 h-[72px] relative z-40 bg-white border-b border-slate-200">
            <Topbar />
          </div>
        )}

        {/* Konten Utama Layar HP */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 scroll-smooth bg-[#F4F7FE]">
          {tampilSesiFoto && <><NotifAntreanSesi /><AktifkanNotifikasi /></>}
          <Outlet />
        </div>

        {/* Bottom Navigation Bar */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-white/90 backdrop-blur-md border-t border-slate-200 flex items-center justify-around px-4 z-40">
          {mobileMenu.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 ${
                  isActive
                    ? 'text-blue-600 font-bold scale-105'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={20} className={isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'} />
                <span className="text-[10px] mt-1 tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Kasir/POS butuh tinggi tetap penuh (frame tidak ikut scroll) agar background tidak "bocor".
  const isKasir = location.pathname.startsWith('/kasir');
  const subMenuParam = new URLSearchParams(location.search).get('subMenu');
  const hideMainSidebar =
    new URLSearchParams(location.search).get('hide_sidebar') === 'true' ||
    subMenuParam === 'jurnal-tunggal' ||
    subMenuParam === 'multi-jurnal' ||
    subMenuParam === 'hutang-jurnal-tunggal' ||
    subMenuParam === 'hutang-multi-jurnal' ||
    subMenuParam === 'aset-tambah';

  return (
    <div className="bg-[#F4F7FE] flex h-screen overflow-hidden font-sans">
      {!isKasir && !hideMainSidebar && <Sidebar />}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {!fullScreenFeature && <Topbar />}
        <main className={`flex-1 scroll-smooth transition-all duration-300 ${fullScreenFeature ? 'p-0' : 'p-6 md:p-8'} ${isKasir ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={fullScreenFeature ? (isKasir ? 'w-full h-full' : 'w-full') : 'max-w-[1600px] mx-auto'}>
          {tampilSesiFoto && <><NotifAntreanSesi /><AktifkanNotifikasi /></>}
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
