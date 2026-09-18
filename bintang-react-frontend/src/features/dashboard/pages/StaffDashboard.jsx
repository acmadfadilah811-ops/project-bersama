import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Activity,
  Info,
  ShieldCheck,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import EmployeeInfoModal from '../components/EmployeeInfoModal';

export default function StaffDashboard() {
  const { user, updateUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // State untuk mengontrol tampilan Full Screen Info Karyawan
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // State Kustom untuk Edit Profile (Self-Service) & UI Professional
  const [profileModalTab, setProfileModalTab] = useState('personal'); // 'personal' or 'kepegawaian'
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    no_hp: '',
    email: '',
    alamat: '',
    kota: '',
    bio: '',
  });
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const avatarInputRef = useRef(null);

  const getAvatarUrl = (path) => {
    if (!path) return null;
    const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace(
      '/api',
      ''
    );
    return path.startsWith('http') ? path : `${apiBase}${path}`;
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const fd = new FormData();
      Object.entries(profileForm).forEach(([k, v]) => fd.append(k, v || ''));
      if (selectedAvatarFile) {
        fd.append('foto_profil', selectedAvatarFile);
      }

      const res = await apiClient.patch('/users/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      updateUser(res.data);
      setIsEditingProfile(false);
      showToast('success', 'Profil Anda berhasil diperbarui!');
    } catch (err) {
      console.error('Gagal memperbarui profil:', err);
      showToast('error', 'Gagal menyimpan perubahan profil.');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    if (showInfoModal && user) {
      setProfileForm({
        no_hp: user.no_hp || '',
        email: user.email || '',
        alamat: user.alamat || '',
        kota: user.kota || '',
        bio: user.bio || '',
      });
      setIsEditingProfile(false);
      setSelectedAvatarFile(null);
      setAvatarPreviewUrl(null);
      setProfileModalTab('personal');
    }
  }, [showInfoModal, user]);

  // Update jam real-time setiap detik
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/hr/dashboard/staff/');
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching staff dashboard:', err);
      setError('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const playNotificationSound = (filename) => {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const audio = new Audio(`${cleanBase}audio/${filename}`);
      audio.play().catch((e) => console.log('Autoplay dicegah oleh browser, abaikan.', e));
    } catch (error) {
      console.log('Gagal memutar audio', error);
    }
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/absensi/clock-in/', { catatan: '' });
      playNotificationSound('checkin.mp3');
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal melakukan Clock-In');
      // Status terkunci di Layout.jsx cuma dicek sekali saat halaman dimuat.
      // Kalau batas waktu baru lewat setelah halaman ini terbuka, reload
      // supaya Layout.jsx cek ulang dan tampilkan layar "Ajukan Izin".
      if (err.response?.status === 403) {
        window.location.reload();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // State untuk mengontrol modal konfirmasi Clock Out kustom
  const [showClockOutModal, setShowClockOutModal] = useState(false);

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      await apiClient.post('/hr/absensi/clock-out/', { catatan: '' });
      playNotificationSound('selesai.mp3');
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Gagal melakukan Clock-Out');
    } finally {
      setActionLoading(false);
      setShowClockOutModal(false);
    }
  };

  const formatDateStr = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'aktif':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'nonaktif':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'cuti':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-xs font-medium">Memuat dashboard staff...</p>
        </div>
      </div>
    );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded-lg border border-red-100 p-6 text-center">
        <AlertTriangle className="text-red-500 mb-2" size={32} />
        <h3 className="text-red-800 font-bold">Terjadi Kesalahan</h3>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  const { absensi_hari_ini, timecard_bulan_ini, job_aktif, total_job_aktif, pengumuman } =
    dashboardData || {};
  // Setelah izin keterlambatan disetujui, backend membuat/mengubah record
  // Absensi (status='terlambat', workspace_unlocked=true) TANPA mengisi
  // jam_masuk — staff tetap harus Clock In sungguhan untuk mencatat jam
  // masuk asli (lihat ClockInView di hr/views.py). Cek `status` saja bikin
  // tombol Clock In salah tampil "Sudah Masuk" padahal jam_masuk kosong,
  // sehingga Clock Out gagal terus dengan pesan "Belum ada clock-in".
  const isClockedIn = Boolean(absensi_hari_ini?.jam_masuk);
  const isClockedOut = Boolean(absensi_hari_ini?.jam_keluar);

  return (
    <div className="space-y-3 max-w-7xl mx-auto pb-4 animate-fade-in relative">
      {/* Header Compact */}
      <div className="bg-white p-2.5 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-blue-100 flex items-center justify-center overflow-hidden shrink-0 border border-blue-200">
            {user?.foto_profil ? (
              <img src={getAvatarUrl(user.foto_profil)} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-blue-700 font-black text-lg">{user?.username?.charAt(0)}</span>
            )}
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">
              Selamat datang, {user?.username}
            </h1>
            <p className="text-[10px] text-slate-500 font-medium capitalize">
              {user?.divisi?.nama || user?.divisi_nama || user?.role}
            </p>
          </div>
        </div>
        <div className="hidden sm:block text-right">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {currentTime.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Grid Ringkasan Atas */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5 bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-2">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <CalendarClock size={12} /> Status Sesi Kerja
              </p>
              <h3
                className={`text-lg font-extrabold mt-0.5 uppercase ${!isClockedIn ? 'text-amber-600' : isClockedOut ? 'text-slate-600' : 'text-emerald-600'} flex items-center gap-1.5`}
              >
                <span>{!isClockedIn ? 'Belum Mulai Kerja' : absensi_hari_ini?.status}</span>
                {absensi_hari_ini?.workspace_unlocked && (
                  <span className="text-[9px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                    Papan Kerja Dibuka
                  </span>
                )}
              </h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-800 tracking-tighter tabular-nums leading-none">
                {currentTime.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-auto">
            <button
              onClick={handleClockIn}
              disabled={isClockedIn || actionLoading}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                ${isClockedIn ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
            >
              {isClockedIn ? 'Sedang Bekerja' : 'Mulai Kerja'}
            </button>
            <button
              onClick={() => setShowClockOutModal(true)}
              disabled={!isClockedIn || isClockedOut || actionLoading}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5
                ${!isClockedIn || isClockedOut ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white cursor-pointer'}`}
            >
              {isClockedOut ? 'Sudah Selesai' : 'Selesai Kerja'}
            </button>
          </div>
        </div>

        <div className="md:col-span-4 bg-white rounded-lg p-3 border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 border-b border-slate-100 pb-2 mb-2">
            <Activity size={12} /> Statistik Bulan Ini
          </p>
          <div className="grid grid-cols-2 gap-2 flex-1">
            <div className="bg-blue-50/50 p-2 rounded flex flex-col justify-center text-center">
              <h3 className="text-xl font-extrabold text-blue-700">
                {timecard_bulan_ini?.total_hadir || 0}
              </h3>
              <p className="text-[9px] text-blue-600 font-bold uppercase">Kehadiran</p>
            </div>
            <div className="bg-purple-50/50 p-2 rounded flex flex-col justify-center text-center">
              <h3 className="text-xl font-extrabold text-purple-700">
                {timecard_bulan_ini?.total_jam_kerja || 0}
              </h3>
              <p className="text-[9px] text-purple-600 font-bold uppercase">Jam Kerja</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 bg-gradient-to-br from-indigo-700 to-indigo-950 rounded-lg p-3 text-white shadow-sm flex flex-col justify-between relative overflow-hidden">
          <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-wider mb-2 border-b border-indigo-600/40 pb-1">
            Status Pekerjaan Anda
          </p>
          <div className="grid grid-cols-3 gap-2 text-center my-auto">
            <div>
              <h4 className="text-xl font-black text-amber-300">{total_job_aktif || 0}</h4>
              <p className="text-[8px] text-indigo-100 font-bold uppercase">Proses</p>
            </div>
            <div>
              <h4 className="text-xl font-black text-emerald-300">
                {dashboardData?.total_job_selesai || 0}
              </h4>
              <p className="text-[8px] text-indigo-100 font-bold uppercase">Selesai</p>
            </div>
            <div>
              <h4 className="text-xl font-black text-rose-300">
                {dashboardData?.total_job_gagal || 0}
              </h4>
              <p className="text-[8px] text-indigo-100 font-bold uppercase">Gagal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Bawah */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* List Pekerjaan Aktif */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5">
            <Briefcase className="text-blue-600" size={14} />
            <h2 className="text-slate-800 font-bold text-xs">Pekerjaan Dalam Proses</h2>
          </div>
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-left text-[11px] whitespace-nowrap">
              <thead className="bg-slate-100/80 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-3 font-semibold">Produk / Job</th>
                  <th className="py-1.5 px-3 font-semibold text-center">Order ID</th>
                  <th className="py-1.5 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {job_aktif && job_aktif.length > 0 ? (
                  job_aktif.map((job) => (
                    <tr key={job.job_id} className="hover:bg-blue-50/50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800">{job.produk}</div>
                        <div className="text-[9px] text-slate-500">Tahap: {job.tahap}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500">
                        #{job.order_id}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded uppercase">
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="py-6 text-center text-slate-400 text-[10px]">
                      <CheckCircle2 className="mx-auto mb-1 text-slate-300" size={20} />
                      Tidak ada pekerjaan aktif saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolom Kanan: Status Karyawan & Pengumuman */}
        <div className="flex flex-col gap-3">
          {/* Card Info Kepegawaian & Kontrak - BISA DIKLIK */}
          <div
            onClick={() => setShowInfoModal(true)}
            className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group"
          >
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="text-blue-600" size={14} />
                <h2 className="text-slate-800 font-bold text-xs">Info Karyawan</h2>
              </div>
              <ChevronRight
                size={14}
                className="text-slate-400 group-hover:text-blue-600 transition-colors"
              />
            </div>
            <div className="p-3 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-medium">Status Karyawan</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getStatusColor(user?.status_karyawan || 'aktif')}`}
                >
                  {user?.status_karyawan || 'Aktif'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-medium">Jenis Kontrak</span>
                <span className="text-[11px] font-bold text-slate-800 capitalize">
                  {user?.jenis_kontrak || 'Tetap'}
                </span>
              </div>
            </div>
          </div>

          {/* Card Pengumuman Perusahaan */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[180px]">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5">
              <Info className="text-blue-600" size={14} />
              <h2 className="text-slate-800 font-bold text-xs">Pengumuman</h2>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto custom-scrollbar flex-1">
              {pengumuman && pengumuman.length > 0 ? (
                pengumuman.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedAnnouncement(item)}
                    className="p-2.5 bg-slate-50 hover:bg-blue-50/30 hover:border-blue-300 transition-colors rounded border border-slate-100 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-slate-800 text-[11px] leading-tight">
                        {item.judul}
                      </h4>
                      <span className="text-[8px] text-slate-400 bg-white px-1 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                        {new Date(item.dibuat_pada).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed mb-1.5 line-clamp-2">
                      {item.isi}
                    </p>
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-medium">
                      <div className="w-3 h-3 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold font-mono">
                        {item.dibuat_oleh_nama?.charAt(0)}
                      </div>
                      {item.dibuat_oleh_nama}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-6">
                  <AlertTriangle size={24} className="mb-2 text-slate-300" />
                  <p className="text-[10px]">Belum ada pengumuman.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast Notifikasi Kustom ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-350 bg-white border-slate-200 text-slate-800 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-250 text-emerald-800 shadow-emerald-100'
              : 'bg-rose-50 border-rose-250 text-rose-800 shadow-rose-100'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertTriangle size={16} className="text-rose-600" />}
          <span>{toast.msg}</span>
        </div>
      )}

      <EmployeeInfoModal
        show={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        user={user}
        getAvatarUrl={getAvatarUrl}
        avatarPreviewUrl={avatarPreviewUrl}
        isEditingProfile={isEditingProfile}
        setIsEditingProfile={setIsEditingProfile}
        avatarInputRef={avatarInputRef}
        handleAvatarChange={handleAvatarChange}
        profileModalTab={profileModalTab}
        setProfileModalTab={setProfileModalTab}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        setSelectedAvatarFile={setSelectedAvatarFile}
        setAvatarPreviewUrl={setAvatarPreviewUrl}
        handleSaveProfile={handleSaveProfile}
        profileSaving={profileSaving}
      />

      {/* FULL SCREEN MODAL TRANSISI - DETAIL PENGUMUMAN */}
      <div
        className={`fixed inset-0 z-50 flex justify-center bg-slate-900/40 backdrop-blur-sm transition-all duration-300 ${
          selectedAnnouncement ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className={`w-full max-w-lg bg-white h-full relative flex flex-col shadow-2xl transition-transform duration-300 ${
            selectedAnnouncement ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          {/* Header Mobile Style */}
          <div className="bg-[#1565c0] text-white px-4 py-4 flex items-center gap-4 shadow-md z-10 shrink-0">
            <button
              onClick={() => setSelectedAnnouncement(null)}
              className="hover:bg-white/10 p-1 rounded-full transition-colors cursor-pointer"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-lg font-medium tracking-wide">Detail Pengumuman</h1>
          </div>

          {/* Konten (Bisa Di-scroll) */}
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-xl font-bold text-slate-950 leading-tight">
                {selectedAnnouncement?.judul}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span className="font-semibold text-[#1565c0]">
                  Oleh: {selectedAnnouncement?.dibuat_oleh_nama}
                </span>
                <span>&bull;</span>
                <span>
                  {selectedAnnouncement &&
                    new Date(selectedAnnouncement.dibuat_pada).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                </span>
              </div>
            </div>

            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {selectedAnnouncement?.isi}
            </div>
          </div>
        </div>
      </div>
      {/* MODAL KONFIRMASI CLOCK OUT CUSTOM (PREMIUM STYLE) */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col animate-scale-up">
            {/* Header / Ikon Peringatan */}
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
                Konfirmasi Selesai Kerja
              </h3>
              <p className="text-xs text-rose-100 mt-1">
                Sistem Sesi Kerja &amp; Kepegawaian StarPhoto & Advertising
              </p>
            </div>

            {/* Konten Detail Peringatan */}
            <div className="px-6 py-6 space-y-4">
              <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div className="text-xs text-amber-800 leading-relaxed font-medium">
                  <span className="font-extrabold block text-amber-900 mb-1">
                    ⚠️ PERINGATAN PENTING:
                  </span>
                  Setelah menekan tombol Selesai Kerja, akses Anda ke{' '}
                  <strong>Papan Produksi (Kanban Kerja) akan otomatis TERKUNCI</strong> untuk hari
                  ini.
                </div>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed text-center">
                Apakah Anda yakin telah menyelesaikan semua pekerjaan hari ini dan ingin
                Selesai Kerja?
              </div>
            </div>

            {/* Tombol Aksi */}
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
                    <span>Ya, Selesai Kerja Sekarang</span>
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
