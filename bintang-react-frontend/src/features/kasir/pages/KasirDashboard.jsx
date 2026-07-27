import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  MessageCircle,
  Package,
  Wallet,
  Clock,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';
import SiapDiambilPanel from '../components/SiapDiambilPanel';

export default function KasirDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { shiftAktif } = useKasir();

  const [waCount, setWaCount] = useState(0);
  const [todayStats, setTodayStats] = useState({ count: 0, total: 0 });

  // ── Absensi Personal States ───────────────────────────────
  const [personalAttendance, setPersonalAttendance] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);

  const fetchPersonalAttendance = async () => {
    try {
      const res = await apiClient.get('/hr/dashboard/staff/');
      setPersonalAttendance(res.data);
    } catch (err) {
      console.error('Gagal mengambil status absensi:', err);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const resWa = await apiClient.get('/orders/', {
          params: { status_global: 'review', sumber: 'wa' },
        });
        setWaCount((resWa.data || []).length);
      } catch (err) {
        console.error('Gagal memuat antrean WA:', err);
      }
      try {
        const today = new Date().toISOString().slice(0, 10);
        const resSales = await apiClient.get('/pos/sales/', { params: { tanggal: today } });
        const list = resSales.data || [];
        const total = list.reduce((s, t) => s + Number(t.total || 0), 0);
        setTodayStats({ count: list.length, total });
      } catch {
        setTodayStats({ count: 0, total: 0 });
      }
    };
    load();
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

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const absensiHariIni = personalAttendance?.absensi_hari_ini;
  const sudahClockIn = absensiHariIni && absensiHariIni.status !== 'belum_absen';
  const sudahClockOut = !!absensiHariIni?.jam_keluar;

  const metrics = [
    {
      label: 'Status Shift',
      value: shiftAktif ? 'Aktif' : 'Belum Dibuka',
      sub: shiftAktif
        ? `Kas awal ${formatCurrency(shiftAktif.kas_awal)}`
        : 'Buka shift untuk mulai mencatat transaksi',
      icon: Wallet,
      tone: shiftAktif ? 'emerald' : 'rose',
    },
    {
      label: 'Pesanan WA Menunggu',
      value: String(waCount),
      sub: 'Menunggu verifikasi kasir',
      icon: MessageCircle,
      tone: 'indigo',
    },
    {
      label: 'Transaksi Hari Ini',
      value: String(todayStats.count),
      sub: todayLabel,
      icon: TrendingUp,
      tone: 'blue',
    },
    {
      label: 'Penjualan Hari Ini',
      value: formatCurrency(todayStats.total),
      sub: 'Akumulasi omzet pada shift berjalan',
      icon: CreditCard,
      tone: 'emerald',
    },
  ];

  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  const actions = [
    { label: 'Terminal Kasir', desc: 'Proses transaksi penjualan dan penerbitan SPK', icon: CreditCard, path: '/kasir/terminal', color: 'indigo' },
    { label: 'Antrean WA', desc: 'Verifikasi pesanan masuk dari kanal WhatsApp', icon: MessageCircle, path: '/kasir/antrean-wa', color: 'rose', badge: waCount },
    { label: 'Daftar Produk', desc: 'Katalog produk beserta harga dan ketersediaan stok', icon: Package, path: '/kasir/produk', color: 'blue' },
  ];

  const actionColor = {
    indigo: 'hover:border-indigo-300 group-hover:bg-indigo-600',
    emerald: 'hover:border-emerald-300 group-hover:bg-emerald-600',
    rose: 'hover:border-rose-300 group-hover:bg-rose-600',
    blue: 'hover:border-blue-300 group-hover:bg-blue-600',
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F4F7FE]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black text-slate-800">
          Dashboard Kasir — {user?.username || 'Kasir'}
        </h1>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">
          Ringkasan operasional kasir · {todayLabel}
        </p>
      </div>

      {/* Grid Status: Absensi Staff & Warning Shift Kasir */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Widget Absensi Personal Kasir */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-2">
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CalendarClock size={14} className="text-indigo-600" /> Presensi Staff Kasir
                </p>
                <h3
                  className={`text-base font-black mt-0.5 uppercase ${
                    !sudahClockIn
                      ? 'text-amber-600'
                      : sudahClockOut
                      ? 'text-slate-500'
                      : 'text-emerald-600'
                  }`}
                >
                  {!sudahClockIn ? 'Belum Clock-In' : absensiHariIni?.status}
                </h3>
              </div>
              <button
                onClick={() => navigate('/attendance')}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Lihat Detail →
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              {absensiHariIni?.jam_masuk
                ? `Clock-In: ${new Date(absensiHariIni.jam_masuk).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}.${
                    sudahClockOut
                      ? ` Clock-Out: ${new Date(absensiHariIni.jam_keluar).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}.`
                      : ''
                  }`
                : 'Silakan lakukan Clock-In sebelum memulai jam kerja kasir.'}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleClockIn}
              disabled={sudahClockIn || actionLoading}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer ${
                sudahClockIn
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              Clock In
            </button>
            <button
              onClick={() => setShowClockOutModal(true)}
              disabled={!sudahClockIn || sudahClockOut || actionLoading}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm cursor-pointer ${
                !sudahClockIn || sudahClockOut
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              Clock Out
            </button>
          </div>
        </div>

        {/* Info Shift Kasir */}
        <div
          className={`rounded-2xl border p-4 shadow-sm flex flex-col justify-between ${
            shiftAktif
              ? 'bg-emerald-50/60 border-emerald-200'
              : 'bg-amber-50/60 border-amber-200'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`p-2 rounded-xl ${
                  shiftAktif ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                {shiftAktif ? <Wallet size={18} /> : <AlertCircle size={18} />}
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">
                  {shiftAktif ? 'Shift Kasir Aktif' : 'Shift Kasir Belum Dibuka'}
                </h4>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {shiftAktif
                    ? `Kas Awal: ${formatCurrency(shiftAktif.kas_awal)}`
                    : 'Buka shift kasir untuk mulai mencatat dan memproses transaksi.'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => navigate('/kasir/shift')}
              className={`font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm ${
                shiftAktif
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {shiftAktif ? 'Kelola Shift & Kas' : 'Buka Shift Sekarang'}
            </button>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {m.label}
                </span>
                <span className={`p-2 rounded-xl ${toneMap[m.tone]}`}>
                  <Icon size={16} />
                </span>
              </div>
              <div className="text-2xl font-black text-slate-800 leading-none">{m.value}</div>
              <p className="text-[11px] font-semibold text-slate-400 mt-1.5">{m.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-extrabold text-slate-700 mb-3 flex items-center gap-2">
        <Clock size={16} className="text-slate-400" /> Aksi Cepat Kasir
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.path}
              onClick={() => navigate(a.path)}
              className={`group bg-white rounded-2xl border border-slate-200 p-4 text-left shadow-sm transition-all hover:shadow-lg cursor-pointer relative ${actionColor[a.color]}`}
            >
              {a.badge > 0 && (
                <span className="absolute top-3 right-3 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-black">
                  {a.badge}
                </span>
              )}
              <span className="inline-flex p-2.5 rounded-xl bg-slate-100 text-slate-600 mb-3 transition-all group-hover:text-white">
                <Icon size={20} />
              </span>
              <h3 className="font-extrabold text-slate-800 text-sm">{a.label}</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{a.desc}</p>
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 mt-3 group-hover:text-slate-600">
                Buka <ArrowRight size={12} />
              </span>
            </button>
          );
        })}

        <SiapDiambilPanel ringkas />
      </div>

      {/* MODAL KONFIRMASI CLOCK OUT */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col text-left">
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-6 flex flex-col items-center text-center text-white relative">
              <button
                onClick={() => setShowClockOutModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <ArrowLeft size={18} className="rotate-90" />
              </button>
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border border-white/20 mb-2">
                <CalendarClock size={28} className="text-white" />
              </div>
              <h3 className="font-extrabold text-base tracking-wide uppercase">
                Konfirmasi Clock-Out
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                Sistem Absensi Kasir Bintang Advertising
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-amber-800 leading-relaxed font-medium">
                  <span className="font-extrabold block text-amber-900 mb-0.5">
                    PERINGATAN:
                  </span>
                  Pastikan shift kasir Anda telah ditutup sebelum melakukan Clock-Out jam kerja.
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center leading-relaxed">
                Apakah Anda yakin ingin menyelesaikan absensi jam kerja dan Clock-Out sekarang?
              </p>
            </div>

            <div className="px-6 pb-6 pt-1 flex flex-col gap-2">
              <button
                onClick={handleClockOut}
                disabled={actionLoading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer text-xs disabled:opacity-50"
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
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer text-xs text-center disabled:opacity-50"
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
