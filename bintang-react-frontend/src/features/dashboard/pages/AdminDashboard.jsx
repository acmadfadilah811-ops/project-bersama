import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import AttendanceSessionManager from '../components/AttendanceSessionManager';
import {
  ShoppingCart,
  Package,
  Users,
  CalendarClock,
  MoreHorizontal,
  Circle,
  ClipboardList,
  Hourglass,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  LayoutGrid,
  Activity,
  Settings,
} from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();

  // ── Absensi personal ──────────────────────────────────────
  const [personalAttendance, setPersonalAttendance] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // ── Stats admin ───────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [orderMap, setOrderMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [activeTab, setActiveTab] = useState('spk');
  const [complaints, setComplaints] = useState([]);

  // Jam real-time
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchPersonalAttendance = async () => {
    try {
      const res = await apiClient.get('/hr/dashboard/staff/');
      setPersonalAttendance(res.data);
    } catch (err) {
      console.error('Gagal mengambil status absensi:', err);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [jobsRes, ordersRes, complaintsRes] = await Promise.allSettled([
          apiClient.get('/jobs/'),
          apiClient.get('/orders/?limit=10'),
          apiClient.get('/komplain/'),
        ]);

        if (complaintsRes.status === 'fulfilled') {
          setComplaints(complaintsRes.value.data);
        }

        let allJobs = [];
        if (jobsRes.status === 'fulfilled') {
          allJobs = jobsRes.value.data;
        }

        const map = {};
        if (ordersRes.status === 'fulfilled') {
          const raw = ordersRes.value.data;
          const list = Array.isArray(raw) ? raw : raw?.results || [];
          setRecentOrders(list);
          list.forEach((order) => {
            order.items?.forEach((item) => {
              map[item.id] = {
                orderId: order.id,
                customerName: order.nama,
                jenisProduk: item.jenis_produk,
              };
            });
          });
        }
        setOrderMap(map);

        // Calculate jobs-based stats
        const total = allJobs.length;
        const antrean = allJobs.filter((j) => j.status_pekerjaan === 'antrean').length;
        const proses = allJobs.filter((j) => j.status_pekerjaan === 'dikerjakan').length;
        const selesai = allJobs.filter((j) => j.status_pekerjaan === 'selesai').length;

        setStats({
          total_jobs: total,
          jobs_antrean: antrean,
          jobs_proses: proses,
          jobs_selesai: selesai,
        });

        // Store recent jobs (newest first)
        const sortedJobs = [...allJobs].sort((a, b) => b.id - a.id);
        setRecentJobs(sortedJobs.slice(0, 6));

      } catch (err) {
        console.error('Error fetching admin dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    fetchPersonalAttendance();
  }, []);

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/absensi/clock-in/', { catatan: '' });
      await fetchPersonalAttendance();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal Clock-In');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/absensi/clock-out/', { catatan: '' });
      await fetchPersonalAttendance();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal Clock-Out');
    } finally {
      setActionLoading(false);
      setShowClockOutModal(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'baru saja';
    if (diff < 60) return `${diff} mnt lalu`;
    if (diff < 1440) return `${Math.floor(diff / 65)} jam lalu`; // Keep original math or standard Math.floor(diff / 60)
    return `${Math.floor(diff / 1440)} hari lalu`;
  };

  const absensiHariIni = personalAttendance?.absensi_hari_ini;
  const sudahClockIn = absensiHariIni && absensiHariIni.status !== 'belum_absen';
  const sudahClockOut = !!absensiHariIni?.jam_keluar;

  // Stat cards
  const statCards = [
    {
      label: 'Total Job SPK',
      value: loading ? '...' : (stats?.total_jobs ?? 0),
      icon: ClipboardList,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      badge: 'Semua Tahap',
      badgeColor: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Antrean SPK',
      value: loading ? '...' : (stats?.jobs_antrean ?? 0),
      icon: Hourglass,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      badge: 'Belum Mulai',
      badgeColor: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'SPK Dikerjakan',
      value: loading ? '...' : (stats?.jobs_proses ?? 0),
      icon: Activity,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      badge: 'Sedang Proses',
      badgeColor: 'bg-emerald-50 text-emerald-600',
    },
    {
      label: 'SPK Selesai',
      value: loading ? '...' : (stats?.jobs_selesai ?? 0),
      icon: CheckCircle2,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      badge: 'Total Selesai',
      badgeColor: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6 w-full select-none">
      {/* ── HEADER SELAMAT DATANG ──────────────────────── ── */}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
        {[
          { name: 'Papan Kerja', path: '/produksi', icon: ClipboardList, desc: 'Production SPK', color: 'bg-gradient-to-r from-blue-600 to-cyan-400' },
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
          { id: 'spk', label: 'Papan Kerja (SPK)', icon: ClipboardList },
          { id: 'presensi', label: 'Kehadiran Saya & Sesi', icon: CalendarClock },
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
        
        {/* TAB 1: PAPAN KERJA (SPK) */}
        {activeTab === 'spk' && (
          <div className="space-y-5">
            {/* STAT CARDS */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <div
                    key={i}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                        <Icon size={18} className={card.iconColor} />
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                        {card.label}
                      </p>
                      <p className="text-2xl font-extrabold text-slate-800 leading-none">{card.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RECENT JOBS & JOB SUMMARY */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
              {/* Pekerjaan Produksi Terkini (Recent Jobs) */}
              <div className="xl:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList size={14} className="text-indigo-500" /> Pekerjaan Produksi Terkini
                  </h2>
                  <button className="text-slate-350 hover:text-slate-500">
                    <MoreHorizontal size={16} />
                  </button>
                </div>

                <div className="divide-y divide-slate-50">
                  {recentJobs.length > 0 ? (
                    recentJobs.map((job, i) => {
                      const orderInfo = orderMap[job.order_item] || {};
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/70 transition-colors cursor-pointer group"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-sm">
                            {(orderInfo.customerName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                {orderInfo.customerName || 'Umum'}
                              </p>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                                Tahap: {job.tahap_nama || 'SPK'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              SPK #{job.id} · {orderInfo.jenisProduk || 'Produk SPK'}
                            </p>
                            <span className={`inline-flex items-center mt-1.5 gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wide ${
                              job.status_pekerjaan === 'selesai' ? 'bg-emerald-50 text-emerald-600 border-emerald-250' :
                              job.status_pekerjaan === 'dikerjakan' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                              'bg-slate-50 text-slate-550 border-slate-200'
                            }`}>
                              <Circle size={5} className="fill-current" />
                              {job.status_pekerjaan}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-350">
                      <ClipboardList size={28} strokeWidth={1.5} />
                      <p className="text-sm mt-2 font-medium">Belum ada pekerjaan</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Ringkasan Pekerjaan (4 cols) */}
              <div className="xl:col-span-4 flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <ClipboardList size={12} className="text-indigo-500" /> Ringkasan Pekerjaan
                  </h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Total SPK', value: loading ? '...' : (stats?.total_jobs ?? 0), color: 'text-blue-600 bg-blue-50' },
                      { label: 'SPK Antrean', value: loading ? '...' : (stats?.jobs_antrean ?? 0), color: 'text-amber-600 bg-amber-50' },
                      { label: 'SPK Dikerjakan', value: loading ? '...' : (stats?.jobs_proses ?? 0), color: 'text-emerald-600 bg-emerald-50' },
                      { label: 'SPK Selesai', value: loading ? '...' : (stats?.jobs_selesai ?? 0), color: 'text-purple-600 bg-purple-50' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-xs text-slate-600 font-medium">{item.label}</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KEHADIRAN & SESI */}
        {activeTab === 'presensi' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Widget Absensi Personal */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col justify-between min-h-[200px]">
              <div>
                <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <CalendarClock size={12} className="text-indigo-500" /> Kehadiran Saya
                    </p>
                    <h3 className={`text-lg font-black mt-1 uppercase ${
                      !sudahClockIn
                        ? 'text-amber-600'
                        : sudahClockOut
                          ? 'text-slate-500'
                          : 'text-emerald-600'
                    }`}>
                      {!sudahClockIn ? 'Belum Masuk' : absensiHariIni?.status}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {absensiHariIni?.jam_masuk
                    ? `Masuk pukul ${new Date(absensiHariIni.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.${sudahClockOut ? ` Keluar pukul ${new Date(absensiHariIni.jam_keluar).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.` : ''}`
                    : 'Lakukan Clock In sebelum mulai bekerja hari ini.'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClockIn}
                  disabled={sudahClockIn || actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    sudahClockIn
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  }`}
                >
                  Clock In
                </button>
                <button
                  onClick={() => setShowClockOutModal(true)}
                  disabled={!sudahClockIn || sudahClockOut || actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                    !sudahClockIn || sudahClockOut
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : 'bg-rose-500 hover:bg-rose-600 text-white'
                  }`}
                >
                  Clock Out
                </button>
              </div>
            </div>

            {/* Sesi Absensi */}
            <AttendanceSessionManager />
          </div>
        )}

        {/* TAB 3: KOMPLAIN & GARANSI */}
        {activeTab === 'komplain' && (
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
            <div className="border-b border-slate-50 pb-3 mb-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-755 flex items-center gap-1.5">
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
                  {complaints.length > 0 ? (
                    (Array.isArray(complaints) ? complaints : complaints?.results || []).slice(0, 10).map((c) => (
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
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL KONFIRMASI CLOCK OUT CUSTOM (PREMIUM STYLE) */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col animate-scale-up text-left">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 flex flex-col items-center text-center text-white relative">
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setShowClockOutModal(false)}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
                >
                  <ArrowLeft size={18} className="rotate-95" />
                </button>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center border border-white/20 mb-3 shadow-inner">
                <CalendarClock size={32} className="text-white" />
              </div>
              <h3 className="font-extrabold text-lg tracking-wide uppercase">
                Konfirmasi Keluar Jam Kerja
              </h3>
              <p className="text-xs text-rose-100 mt-1">
                Sistem Absensi &amp; Kepegawaian Bintang Advertising
              </p>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div className="text-xs text-amber-800 leading-relaxed font-medium">
                  <span className="font-extrabold block text-amber-900 mb-1">
                    PERINGATAN PENTING:
                  </span>
                  Setelah menekan tombol Clock-Out, akses Anda ke{' '}
                  <strong>Papan Produksi (Kanban Kerja) akan otomatis TERKUNCI</strong> untuk hari
                  ini.
                </div>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed text-center">
                Apakah Anda yakin telah menyelesaikan semua tugas admin hari ini dan ingin melakukan
                Clock-Out?
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full bg-[#f0442c] hover:bg-[#d32f2f] text-white font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer text-sm disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Ya, Clock-Out Sekarang</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowClockOutModal(false)}
                disabled={actionLoading}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl transition-all cursor-pointer text-sm text-center disabled:opacity-50"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
