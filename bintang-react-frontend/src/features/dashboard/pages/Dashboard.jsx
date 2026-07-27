import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import {
  ShoppingCart,
  TrendingUp,
  Package,
  Users,
  Crown,
  Trophy,
  Medal,
  MoreHorizontal,
  Clock,
  Activity,
  CalendarClock,
  AlertCircle,
  Play,
  LayoutGrid,
  BookOpen,
  Briefcase,
  DollarSign,
  BarChart3,
  Sparkles,
  Bell,
  Settings,
  ClipboardList,
  ChevronDown,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const isPrivileged = ['owner', 'manager'].includes(user?.role?.toLowerCase());

  const [data, setData] = useState(null);
  const [onlineStaff, setOnlineStaff] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sesi Absensi States (untuk Owner/Manager)
  const [waktuMulai, setWaktuMulai] = useState('08:00');
  const [batasMaksimal, setBatasMaksimal] = useState('09:00');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [unlockRequests, setUnlockRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('finansial');
  const [complaints, setComplaints] = useState([]);

  // Staff States (untuk staff biasa)
  const [personalAttendance, setPersonalAttendance] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [expandedSection, setExpandedSection] = useState(null);

  // Update jam real-time setiap detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPersonalAttendance = async () => {
    if (isPrivileged) return;
    try {
      const res = await apiClient.get('/hr/dashboard/staff/');
      setPersonalAttendance(res.data);
    } catch (err) {
      console.error('Gagal mengambil status absensi personal:', err);
    }
  };

  const playNotificationSound = (filename) => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const audio = new Audio(`${cleanBase}audio/${filename}`);
      audio.play().catch((e) => console.log('Autoplay blocked:', e));
    } catch (error) {
      console.log('Gagal memutar audio', error);
    }
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/absensi/clock-in/', { catatan: '' });
      playNotificationSound('checkin.mp3');
      await fetchPersonalAttendance();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal melakukan Clock-In');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!window.confirm('Apakah Anda yakin ingin mengakhiri jam kerja hari ini?')) return;
    try {
      setActionLoading(true);
      await apiClient.post('/hr/absensi/clock-out/', { catatan: '' });
      playNotificationSound('selesai.mp3');
      await fetchPersonalAttendance();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal melakukan Clock-Out');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchSessionData = useCallback(async () => {
    if (!isPrivileged) return;
    try {
      const [sessionRes, requestsRes] = await Promise.all([
        apiClient.get('/hr/attendance-session/'),
        apiClient.get('/hr/unlock-requests/'),
      ]);
      setSessionData(sessionRes.data);
      setRepeatDaily(sessionRes.data?.repeat_daily || false);
      if (sessionRes.data?.batas_maksimal) {
        const dateBatas = new Date(sessionRes.data.batas_maksimal);
        setBatasMaksimal(
          `${String(dateBatas.getHours()).padStart(2, '0')}:${String(dateBatas.getMinutes()).padStart(2, '0')}`
        );
      }
      if (sessionRes.data?.waktu_mulai) {
        const dateMulai = new Date(sessionRes.data.waktu_mulai);
        setWaktuMulai(
          `${String(dateMulai.getHours()).padStart(2, '0')}:${String(dateMulai.getMinutes()).padStart(2, '0')}`
        );
      }
      setUnlockRequests(requestsRes.data);
    } catch (err) {
      console.error('Gagal mengambil data sesi absensi:', err);
    }
  }, [isPrivileged]);

  const handleStartSession = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/attendance-session/', {
        waktu_mulai: waktuMulai,
        batas_maksimal: batasMaksimal,
        repeat_daily: repeatDaily,
      });
      await fetchSessionData();
      alert('Sesi absensi berhasil diperbarui!');
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal memulai sesi');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([apiClient.get('/dashboard/'), apiClient.get('/users/online/')])
      .then(([dashRes, staffRes]) => {
        setData(dashRes.data);
        setOnlineStaff(staffRes.data);
      })
      .catch((err) => console.error('Error fetching dashboard:', err))
      .finally(() => setLoading(false));

    if (!isPrivileged) {
      fetchPersonalAttendance();
    } else {
      fetchSessionData();
      apiClient.get('/komplain/')
        .then((res) => setComplaints(res.data))
        .catch((err) => console.error('Gagal mengambil komplain:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrivileged, fetchSessionData]);

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  if (loading)
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">
            Memuat Dashboard...
          </p>
        </div>
      </div>
    );

  // ── DRAFT STAFF VIEW ───────────────────────────────────────────
  if (!isPrivileged) {
    const absensi = personalAttendance?.absensi_hari_ini;
    const sudahAbsen = absensi && absensi.status !== 'belum_absen';
    return (
      <div className="space-y-6 w-full max-w-7xl mx-auto px-4">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black">Halo, {user?.username || 'Staff'}!</h2>
            <p className="text-xs text-indigo-100 mt-1">
              Selamat bekerja! Harap lakukan Clock In sebelum memulai tugas harian Anda.
            </p>
          </div>
          <div className="bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm text-right shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200">
              Waktu Sekarang
            </span>
            <div className="text-lg font-black tracking-tight tabular-nums mt-0.5">
              {currentTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
          </div>
        </div>

        {/* Kehadiran & Summary */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Card Kehadiran */}
          <div className="md:col-span-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between min-h-[220px]">
            <div>
              <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CalendarClock size={12} className="text-indigo-500" /> Status Absensi
                  </p>
                  <h3
                    className={`text-lg font-black mt-1 uppercase ${
                      !absensi || absensi.status === 'belum_absen'
                        ? 'text-amber-600'
                        : absensi.jam_keluar
                          ? 'text-slate-500'
                          : 'text-emerald-600'
                    }`}
                  >
                    {!absensi || absensi.status === 'belum_absen' ? 'Belum Masuk' : absensi.status}
                  </h3>
                </div>
                {absensi?.jam_masuk && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200 uppercase tracking-wider">
                    {new Date(absensi.jam_masuk).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-550 leading-relaxed mb-4">
                {absensi?.jam_masuk
                  ? `Sesi kerja Anda hari ini dimulai pukul ${new Date(absensi.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`
                  : 'Silakan klik tombol di bawah untuk Clock In dan mulai mencatat jam kerja Anda hari ini.'}
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleClockIn}
                disabled={sudahAbsen || actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer
                  ${sudahAbsen ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
              >
                Clock In
              </button>
              <button
                onClick={handleClockOut}
                disabled={
                  !absensi ||
                  absensi.status === 'belum_absen' ||
                  absensi.jam_keluar ||
                  actionLoading
                }
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer
                  ${!absensi || absensi.status === 'belum_absen' || absensi.jam_keluar ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
              >
                Clock Out
              </button>
            </div>
          </div>

          {/* Card Info Sesi Kerja */}
          <div className="md:col-span-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between min-h-[220px]">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Info Sesi Absensi Hari Ini
              </h3>
              <div className="space-y-2 text-xs text-slate-600 mt-2">
                <div className="flex justify-between border-b border-slate-50 py-1.5">
                  <span>Waktu Mulai Kerja:</span>
                  <span className="font-bold text-slate-800">
                    {sessionData?.waktu_mulai
                      ? new Date(sessionData.waktu_mulai).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '08:00'}{' '}
                    WIB
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-50 py-1.5">
                  <span>Batas Akhir Absensi:</span>
                  <span className="font-bold text-slate-800">
                    {sessionData?.batas_maksimal
                      ? new Date(sessionData.batas_maksimal).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '09:00'}{' '}
                    WIB
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Status Sesi:</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      sessionData?.is_active
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {sessionData?.is_active ? 'AKTIF' : 'NON-AKTIF'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-slate-450 italic text-center border-t border-slate-50 pt-3">
              *Toleransi keterlambatan ditentukan oleh kebijakan manajemen.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DRAFT OWNER/MANAGER VIEW ───────────────────────────────────
  const omsetBulan = data?.omset_6_bulan || [];
  // hitung koordinat kurva SVG line chart omset bulanan
  const maxOmset = Math.max(...omsetBulan.map((item) => item.total), 1) * 1.1;
  const svgWidth = 500;
  const svgHeight = 150;

  const points = omsetBulan.map((item, idx) => {
    const x = (idx / Math.max(omsetBulan.length - 1, 1)) * (svgWidth - 40) + 20;
    const y = svgHeight - (item.total / maxOmset) * (svgHeight - 40) - 20;
    return { x, y };
  });

  const pathD =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ')
      : '';

  const areaD =
    points.length > 0
      ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - 15} L ${points[0].x} ${svgHeight - 15} Z`
      : '';

  // Data donut chart absensi
  const staffList = onlineStaff?.staff?.filter((s) => s.role === 'staff') || [];
  const totalStaff = staffList.length || 1;
  const countHadir = staffList.filter(
    (s) => s.absensi_hari_ini && s.absensi_hari_ini.status === 'hadir'
  ).length;
  const countTerlambat = staffList.filter(
    (s) => s.absensi_hari_ini && s.absensi_hari_ini.status === 'terlambat'
  ).length;
  const countBelumAbsen = staffList.filter(
    (s) => !s.absensi_hari_ini || s.absensi_hari_ini.status === 'belum_absen'
  ).length;

  const pctHadir = Math.round((countHadir / totalStaff) * 100);
  const pctTerlambat = Math.round((countTerlambat / totalStaff) * 100);
  const pctBelumAbsen = 100 - pctHadir - pctTerlambat;

  const segHadirEnd = pctHadir;
  const segLateEnd = segHadirEnd + pctTerlambat;
  const attendanceDonutGradient = `conic-gradient(
    #10b981 0% ${segHadirEnd}%,
    #f59e0b ${segHadirEnd}% ${segLateEnd}%,
    #ef4444 ${segLateEnd}% 100%
  )`;

  const statCards = [
    {
      label: 'Total Omset',
      value: formatRupiah(data?.omset_bulan_ini),
      badge: '+12%',
      badgeUp: true,
      icon: TrendingUp,
      iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Pelanggan Baru',
      value: data?.total_pelanggan || 0,
      badge: '+20%',
      badgeUp: true,
      icon: Users,
      iconBg: 'bg-orange-50 text-orange-600 border border-orange-100',
      iconColor: 'text-orange-500',
    },
    {
      label: 'Total Order',
      value: data?.total_order_bulan_ini || 0,
      badge: '-5%',
      badgeUp: false,
      icon: ShoppingCart,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      iconColor: 'text-rose-500',
    },
    {
      label: 'Order Hari Ini',
      value: data?.total_order_hari_ini || 0,
      badge: '+35%',
      badgeUp: true,
      icon: Package,
      iconBg: 'bg-teal-50 text-teal-600 border border-teal-100',
      iconColor: 'text-teal-500',
    },
  ];

  // 4 colorful cards (Review Status, Proses Produksi, Siap Diambil, Selesai)
  const statusCards = [
    {
      title: 'Review Status',
      count: data?.order_per_status?.review || 0,
      colorClass: 'text-blue-600 bg-blue-50/60 border border-blue-100/50',
      chartColor: '#3b82f6',
      type: 'bars',
    },
    {
      title: 'Proses Produksi',
      count: data?.order_per_status?.proses || 0,
      colorClass: 'text-amber-500 bg-amber-50/60 border border-amber-100/50',
      chartColor: '#f59e0b',
      type: 'line',
    },
    {
      title: 'Siap Diambil',
      count: data?.order_per_status?.ready || 0,
      colorClass: 'text-rose-500 bg-rose-50/60 border border-rose-100/50',
      chartColor: '#f43f5e',
      type: 'line',
    },
    {
      title: 'Selesai (Bulan Ini)',
      count: data?.order_per_status?.selesai || 0,
      colorClass: 'text-purple-650 text-purple-600 bg-purple-50/60 border border-purple-100/50',
      chartColor: '#a855f7',
      type: 'bars',
    },
  ];

  const toggleSection = (key) => setExpandedSection((prev) => (prev === key ? null : key));

  return (
    <div className="space-y-6 w-full select-none">

      {/* ── HEADER SELAMAT DATANG ──────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs">
        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          Selamat Datang, <span className="text-indigo-650 capitalize">{user?.username}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium">
          {currentTime.toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* ── APP SWITCHER (Premium Horizontal Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { name: 'Penjualan', path: '/orders', icon: ShoppingCart, desc: 'Quotations & Sales', color: 'bg-gradient-to-r from-rose-500 to-orange-400' },
          { name: 'Papan Kerja', path: '/produksi', icon: ClipboardList, desc: 'Production SPK', color: 'bg-gradient-to-r from-blue-600 to-cyan-400' },
          { name: 'Inventori', path: '/inventory', icon: Package, desc: 'Inventory & BoM', color: 'bg-gradient-to-r from-purple-600 to-indigo-600' },
          { name: 'Kepegawaian', path: '/attendance', icon: CalendarClock, desc: 'HR & Timesheets', color: 'bg-gradient-to-r from-teal-600 to-emerald-400' },
          { name: 'Pengaturan', path: '/settings', icon: Settings, desc: 'System Settings', color: 'bg-gradient-to-r from-slate-700 to-slate-500' }
        ].map((app, idx) => {
          const AppIcon = app.icon;
          return (
            <a
              key={idx}
              href={app.path}
              className={`flex items-center p-4 rounded-2xl text-white shadow-sm hover:shadow-md transition-all transform hover:-translate-y-1 cursor-pointer overflow-hidden relative ${app.color}`}
            >
              {/* Decorative background circles */}
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10" />
              <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-white/5" />

              {/* Icon Container */}
              <div className="bg-white/15 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                <AppIcon size={22} className="text-white" />
              </div>

              {/* Text info */}
              <div className="flex flex-col ml-3 text-left z-10">
                <span className="text-xs font-black uppercase tracking-wider leading-none">
                  {app.name}
                </span>
                <span className="text-[9px] text-white/80 font-medium mt-1 leading-none">
                  {app.desc}
                </span>
              </div>
            </a>
          );
        })}
      </div>

      {/* ── SUB-TAB NAVIGATION BAR ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-px">
        {[
          { id: 'finansial', label: 'Ringkasan Finansial', icon: TrendingUp },
          { id: 'spk', label: 'Papan Kerja (SPK)', icon: ClipboardList },
          { id: 'presensi', label: 'Presensi Karyawan', icon: CalendarClock },
          { id: 'komplain', label: 'Komplain & Garansi', icon: AlertCircle },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer
                ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-lg font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENT AREA ────────────────────────────────── */}
      <div className="mt-4 transition-all duration-300">
        
        {/* TAB 1: RINGKASAN FINANSIAL */}
        {activeTab === 'finansial' && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={i}
                    className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all"
                  >
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5 truncate">
                        {card.label}
                      </p>
                      <h3 className="text-sm font-black text-slate-800 leading-none truncate">
                        {card.value}
                      </h3>
                    </div>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ml-1 ${card.iconBg}`}>
                      <Icon size={14} className={card.iconColor} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Line Chart & Status Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Line Chart */}
              <div className="lg:col-span-8 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm relative overflow-hidden">
                {/* Company Building watermark background */}
                <div className="absolute right-4 bottom-10 opacity-[0.06] pointer-events-none select-none text-slate-800">
                  <svg width="220" height="180" viewBox="0 0 220 180" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 170h200" />
                    <path d="M30 170V70l40-20h60l40 20v100" />
                    <path d="M50 170v-80h30v80" />
                    <path d="M100 170V90h40v80" />
                    <path d="M150 170v-60h20v60" />
                    <path d="M30 100h40" />
                    <path d="M100 110h45" />
                    <path d="M30 130h140" />
                    <circle cx="100" cy="40" r="10" />
                    <path d="M100 30v20M90 40h20" />
                    <rect x="38" y="76" width="6" height="10" />
                    <rect x="52" y="76" width="6" height="10" />
                    <rect x="114" y="96" width="6" height="10" />
                    <rect x="128" y="96" width="6" height="10" />
                  </svg>
                </div>

                <div className="flex justify-between items-start border-b border-slate-50 pb-3 mb-4">
                  <div>
                    <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">Perkembangan Omset</h2>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Pendapatan dan performa penjualan 6 bulan terakhir.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-450">Bulan Ini</span>
                    <div className="text-base font-black text-slate-800 leading-none mt-0.5">
                      {formatRupiah(data?.omset_bulan_ini)}
                    </div>
                  </div>
                </div>

                {/* SVG Graph */}
                <div className="w-full h-44 mt-2">
                  {omsetBulan.length > 0 ? (
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-full"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="omsetGradientSleek" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4318FF" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#4318FF" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <line x1="20" y1={svgHeight - 15} x2={svgWidth - 20} y2={svgHeight - 15} stroke="#F1F5F9" strokeWidth="1" />
                      <line x1="20" y1={svgHeight / 2} x2={svgWidth - 20} y2={svgHeight / 2} stroke="#F1F5F9" strokeWidth="0.5" strokeDasharray="3" />
                      <line x1="20" y1="20" x2={svgWidth - 20} y2="20" stroke="#F1F5F9" strokeWidth="0.5" strokeDasharray="3" />

                      {areaD && <path d={areaD} fill="url(#omsetGradientSleek)" />}
                      {pathD && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#4318FF"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {points.map((p, idx) => (
                        <g key={idx}>
                          <circle cx={p.x} cy={p.y} r="3" fill="#4318FF" stroke="#FFFFFF" strokeWidth="1.5" />
                        </g>
                      ))}
                    </svg>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                      Data grafik belum tersedia
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between px-5 text-[8.5px] font-bold text-slate-400 uppercase mt-2">
                  {omsetBulan.map((item, idx) => (
                    <span key={idx}>{item.bulan.slice(0, 3)}</span>
                  ))}
                </div>
              </div>

              {/* Right: Presensi Hari Ini (Replacing Status Operasional) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-3">
                      <div>
                        <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">Presensi Hari Ini</h2>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Status kehadiran staf produksi</p>
                      </div>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
                        sessionData?.is_active
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sessionData?.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        {sessionData?.is_active ? 'Sesi Aktif' : 'Sesi Tutup'}
                      </span>
                    </div>

                    {/* Donut Chart & Stats Row */}
                    <div className="flex items-center gap-4 py-3 justify-center lg:justify-start">
                      <div
                        className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-inner shrink-0"
                        style={{ background: attendanceDonutGradient }}
                      >
                        <div className="absolute w-15 h-15 bg-white rounded-full flex flex-col items-center justify-center shadow-xs">
                          <span className="text-[7px] text-slate-400 font-extrabold uppercase tracking-wider">Hadir</span>
                          <span className="text-xs font-black text-slate-800">
                            {countHadir + countTerlambat} / {totalStaff}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-[10px] font-bold text-slate-550 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Tepat Waktu</span>
                          <span className="text-slate-800 font-black">{countHadir} Orang</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Terlambat</span>
                          <span className="text-slate-800 font-black">{countTerlambat} Orang</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Belum Absen</span>
                          <span className="text-slate-800 font-black">{countBelumAbsen} Orang</span>
                        </div>
                      </div>
                    </div>

                    {/* Sesi Info */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mt-3 space-y-1.5 text-[10px] text-slate-600">
                      <div className="flex justify-between">
                        <span>Jam Mulai Kerja:</span>
                        <span className="font-bold text-slate-800">{sessionData?.waktu_mulai ? new Date(sessionData.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '08:00'} WIB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Batas Akhir Absen:</span>
                        <span className="font-bold text-slate-800">{sessionData?.batas_maksimal ? new Date(sessionData.batas_maksimal).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '09:00'} WIB</span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Button */}
                  <button
                    onClick={() => setActiveTab('presensi')}
                    className="w-full mt-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black rounded-xl border border-indigo-100 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Atur Presensi Karyawan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PAPAN KERJA (SPK) */}
        {activeTab === 'spk' && (
          <div className="grid grid-cols-1 gap-5">
            {/* Leaderboard Staff podium + list */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col w-full">
              <div className="flex items-center justify-between pb-3 border-b border-slate-50 shrink-0">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Crown size={14} className="text-amber-500" /> Leaderboard Staff
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Pemeringkat performa staff berdasarkan penyelesaian tugas.
                  </p>
                </div>
              </div>

              {/* Podium (Top 3) */}
              {data?.top_staff?.length > 0 && (
                <div className="py-4 bg-gradient-to-b from-indigo-50/10 to-white border-b border-slate-50 flex justify-center items-end gap-5 shrink-0 select-none">
                  {/* Peringkat 2 */}
                  {data.top_staff[1] && (
                    <div className="flex flex-col items-center w-24">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-slate-300 bg-slate-50 flex items-center justify-center font-bold text-slate-600 text-xs uppercase shadow shadow-inner">
                          {data.top_staff[1].nama.charAt(0)}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-slate-300 text-slate-800 rounded-full flex items-center justify-center font-black text-[8.5px] border border-white">
                          2
                        </span>
                      </div>
                      <span className="text-[9.5px] font-bold text-slate-700 capitalize mt-1.5 truncate w-full text-center">
                        {data.top_staff[1].nama}
                      </span>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase mt-0.5">
                        {data.top_staff[1].jumlah_job_selesai} Jobs
                      </span>
                      <span className="text-[9px] text-indigo-650 font-black mt-0.5">
                        {formatRupiah(data.top_staff[1].total_insentif)}
                      </span>
                    </div>
                  )}

                  {/* Peringkat 1 */}
                  {data.top_staff[0] && (
                    <div className="flex flex-col items-center w-28 -translate-y-1">
                      <div className="relative">
                        <Crown size={14} className="text-amber-500 absolute -top-3 left-1/2 -translate-x-1/2 drop-shadow animate-bounce" />
                        <div className="w-12 h-12 rounded-full border-3 border-amber-400 bg-amber-50 flex items-center justify-center font-black text-slate-800 text-sm uppercase shadow-md">
                          {data.top_staff[0].nama.charAt(0)}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 text-white rounded-full flex items-center justify-center font-black text-[9px] border-2 border-white">
                          1
                        </span>
                      </div>
                      <span className="text-xs font-black text-slate-900 capitalize mt-1.5 truncate w-full text-center">
                        {data.top_staff[0].nama}
                      </span>
                      <span className="text-[9px] text-amber-600 font-extrabold uppercase mt-0.5">
                        {data.top_staff[0].jumlah_job_selesai} Jobs
                      </span>
                      <span className="text-[9px] text-emerald-600 font-black mt-0.5">
                        {formatRupiah(data.top_staff[0].total_insentif)}
                      </span>
                    </div>
                  )}

                  {/* Peringkat 3 */}
                  {data.top_staff[2] && (
                    <div className="flex flex-col items-center w-24">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full border-2 border-orange-200 bg-orange-50/20 flex items-center justify-center font-bold text-orange-850 text-orange-800 text-xs uppercase shadow shadow-inner">
                          {data.top_staff[2].nama.charAt(0)}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-orange-300 text-orange-950 rounded-full flex items-center justify-center font-black text-[8.5px] border border-white">
                          3
                        </span>
                      </div>
                      <span className="text-[9.5px] font-bold text-slate-700 capitalize mt-1.5 truncate w-full text-center">
                        {data.top_staff[2].nama}
                      </span>
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase mt-0.5">
                        {data.top_staff[2].jumlah_job_selesai} Jobs
                      </span>
                      <span className="text-[9px] text-orange-600 font-black mt-0.5">
                        {formatRupiah(data.top_staff[2].total_insentif)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Table Header */}
              <div className="grid grid-cols-12 px-5 py-2 bg-slate-50 border-b border-slate-100 text-[8.5px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                <div className="col-span-1">#</div>
                <div className="col-span-4">Nama Staff</div>
                <div className="col-span-3">Role</div>
                <div className="col-span-2 text-center">Job Selesai</div>
                <div className="col-span-2 text-right">Total Insentif</div>
              </div>

              {/* Table List */}
              <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto custom-scrollbar">
                {data?.top_staff?.length > 0 ? (
                  data.top_staff.map((staff, i) => {
                    const rankIcons = [
                      <Trophy key={0} size={12} className="text-amber-500" />,
                      <Medal key={1} size={12} className="text-slate-450" />,
                      <Medal key={2} size={12} className="text-orange-400" />,
                    ];
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-12 px-5 py-2.5 items-center hover:bg-slate-50/50 transition-colors text-[10.5px]"
                      >
                        <div className="col-span-1 flex items-center">
                          {rankIcons[i] || (
                            <span className="text-[9px] font-black text-slate-400">{i + 1}</span>
                          )}
                        </div>
                        <div className="col-span-4 font-bold text-slate-800 capitalize truncate">
                          {staff.nama}
                        </div>
                        <div className="col-span-3">
                          <span className="text-[8px] bg-slate-100 text-slate-500 border border-slate-200/80 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                            Staff
                          </span>
                        </div>
                        <div className="col-span-2 text-center font-black text-slate-700">
                          {staff.jumlah_job_selesai}
                        </div>
                        <div className="col-span-2 text-right font-black text-emerald-600">
                          {formatRupiah(staff.total_insentif)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-slate-300 text-xs">Data belum tersedia</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PRESENSI KARYAWAN */}
        {activeTab === 'presensi' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Online staff list (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col">
                <div className="border-b border-slate-50 pb-3 mb-4">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Activity size={14} className="text-indigo-500" /> Kehadiran Staff Hari Ini
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Timeline check-in dan online status staff saat ini.
                  </p>
                </div>

                <div className="relative flex-1 overflow-y-auto pl-4 border-l border-slate-100 space-y-4 max-h-[300px] custom-scrollbar">
                  {staffList.length > 0 ? (
                    staffList.map((staff, i) => {
                      const absensi = staff.absensi_hari_ini;
                      const isOnline = staff.is_online;
                      const sudahAbsen = absensi && absensi.status !== 'belum_absen';

                      let nodeBg = 'bg-slate-200';
                      if (sudahAbsen) {
                        nodeBg = absensi.status === 'hadir' ? 'bg-emerald-500' : 'bg-amber-500';
                      }

                      return (
                        <div key={i} className="relative flex items-start gap-4 pb-1 group">
                          <div className={`absolute -left-[22px] top-1 w-3 h-3 rounded-full ${nodeBg} border-2 border-white shadow-sm`} />
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                            {staff.username.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-800 capitalize truncate">
                                {staff.username}
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                                {staff.divisi_nama || 'Staff'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-1 gap-2">
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock size={10} className="text-slate-400" />
                                {sudahAbsen && absensi.jam_masuk
                                  ? `Masuk: ${new Date(absensi.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                                  : 'Belum Clock In'}
                              </span>
                              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
                                isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                {isOnline ? 'ON' : 'OFF'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-300 text-xs">
                      Tidak ada staff terdaftar.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Persentase Kehadiran Donut + Accordions (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Donut Chart */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-3">
                  <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">Tingkat Kehadiran</h2>
                  {sessionData?.is_active && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      Sesi Aktif
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <div
                    className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-inner"
                    style={{ background: attendanceDonutGradient }}
                  >
                    <div className="absolute w-18 h-18 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                      <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">Hadir</span>
                      <span className="text-xs font-black text-slate-800">
                        {countHadir + countTerlambat} / {totalStaff}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 w-full mt-4 text-center text-[10px] font-bold text-slate-500 border-t border-slate-50 pt-3">
                    <div>
                      <span className="text-emerald-600 font-black">{countHadir}</span> Tepat
                    </div>
                    <div>
                      <span className="text-amber-500 font-black">{countTerlambat}</span> Telat
                    </div>
                    <div>
                      <span className="text-rose-500 font-black">{countBelumAbsen}</span> Absen
                    </div>
                  </div>
                </div>
              </div>

              {/* ACCORDION: Atur Sesi Absensi */}
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                <button
                  onClick={() => toggleSection('sesi')}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                    Atur Sesi Absensi
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${expandedSection === 'sesi' ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSection === 'sesi' && (
                  <div className="px-4 py-3 space-y-3 bg-white border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide mb-1">Jam Masuk</span>
                        <input
                          type="time"
                          value={waktuMulai}
                          onChange={(e) => setWaktuMulai(e.target.value)}
                          className="text-xs font-bold px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wide mb-1">Batas Absen</span>
                        <input
                          type="time"
                          value={batasMaksimal}
                          onChange={(e) => setBatasMaksimal(e.target.value)}
                          className="text-xs font-bold px-2 py-1 bg-white border border-slate-200 rounded focus:outline-none focus:border-blue-500 cursor-pointer"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="repeatDailyCheck"
                        checked={repeatDaily}
                        onChange={(e) => setRepeatDaily(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-200 cursor-pointer"
                      />
                      <label htmlFor="repeatDailyCheck" className="text-[9px] font-bold text-slate-600 cursor-pointer select-none">
                        Otomatis harian
                      </label>
                    </div>
                    <button
                      onClick={handleStartSession}
                      disabled={actionLoading}
                      className="w-full justify-center py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play size={10} /> Update Sesi
                    </button>
                  </div>
                )}
              </div>

              {/* ACCORDION: Permohonan Buka Absen */}
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                <button
                  onClick={() => toggleSection('unlock')}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    Permohonan Buka Absen
                    {unlockRequests.length > 0 && (
                      <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                        {unlockRequests.length}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 transition-transform duration-200 ${expandedSection === 'unlock' ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSection === 'unlock' && (
                  <div className="px-4 py-3 space-y-2 bg-white border-t border-slate-100 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {unlockRequests.length > 0 ? (
                      unlockRequests.map((req, idx) => (
                        <div key={idx} className="flex items-start justify-between gap-2 bg-slate-50 border border-slate-100 rounded-lg p-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-800 truncate">{req.staff_nama || 'Staff'}</p>
                            <p className="text-[9px] text-slate-550 italic truncate">"{req.alasan}"</p>
                          </div>
                          <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-black uppercase shrink-0">{req.status}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-400 italic text-center py-2">
                        Tidak ada permohonan pending.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: KOMPLAIN & GARANSI */}
        {activeTab === 'komplain' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="border-b border-slate-50 pb-3 mb-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-750 flex items-center gap-1.5">
                <AlertCircle size={14} className="text-rose-500" /> Log Keluhan Pelanggan Terbaru
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Daftar komplain dan garansi pesanan dari pelanggan.
              </p>
            </div>

            {/* List Keluhan */}
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-650">
                <thead>
                  <tr className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    <th className="py-2.5 px-4">Order ID</th>
                    <th className="py-2.5 px-4">Pelanggan</th>
                    <th className="py-2.5 px-4">Jenis Keluhan</th>
                    <th className="py-2.5 px-4">Deskripsi</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Resolusi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    const list = Array.isArray(complaints) ? complaints : (complaints?.results || []);
                    return list.length > 0 ? (
                      list.slice(0, 10).map((c) => (
                        <tr key={c.id} className="hover:bg-slate-550/10 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-600">#{c.order_id || c.order}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 capitalize">{c.staff_nama || c.pelanggan_nama || 'Pelanggan'}</td>
                          <td className="py-3 px-4 font-semibold text-rose-600">{c.jenis_display || c.jenis}</td>
                          <td className="py-3 px-4 max-w-xs truncate" title={c.deskripsi}>{c.deskripsi}</td>
                          <td className="py-3 px-4">
                            <span className={`text-[8.5px] font-black px-2 py-0.5 rounded border uppercase
                              ${
                                c.status === 'selesai'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                  : 'bg-amber-50 text-amber-600 border-amber-100'
                              }`}
                            >
                              {c.status_display || c.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-500 italic max-w-xs truncate" title={c.catatan_resolusi || '-'}>
                            {c.catatan_resolusi || '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                          Tidak ada komplain pelanggan tercatat.
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
