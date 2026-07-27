import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../api/apiClient';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import {
  MENU_FEATURES,
  DEFAULT_PERMISSIONS,
  getPermissions,
  savePermissions,
} from '../../../utils/permissions';
import {
  Plus,
  X,
  Users,
  AlertTriangle,
  Shield,
  Monitor,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Settings2,
  Lock,
  Building2,
  User,
  Phone,
  MapPin,
  FileText,
  Save,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Upload,
  Image,
  MessageSquare,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';

// ─── Helper ───────────────────────────────────────────────
function formatWaktu(dateStr) {
  if (!dateStr) return '–';
  try {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

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

const ROLE_STYLE = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  admin: 'bg-emerald-100 text-emerald-700',
  staff: 'bg-slate-100 text-slate-600',
};

// ─── TABS ─────────────────────────────────────────────────
const TABS = [
  {
    id: 'akun-saya',
    label: 'Akun Saya',
    icon: User,
    roles: ['owner', 'manager', 'admin', 'staff'],
  },
  { id: 'karyawan', label: 'Karyawan', icon: Users, roles: ['owner', 'manager'] },
  { id: 'bisnis', label: 'Pengaturan Bisnis', icon: Building2, roles: ['owner', 'manager'] },
  { id: 'hak-akses', label: 'Hak Akses', icon: Shield, roles: ['owner', 'manager'] },
  { id: 'keamanan', label: 'Keamanan', icon: Lock, roles: ['owner'] },
  { id: 'whatsapp-gateway', label: 'WhatsApp Gateway', icon: MessageSquare, roles: ['owner', 'manager'] },
];

// ── Msg toast helper (Didefinisikan di luar render untuk menghindari component-during-render bug) ──
const MsgBox = ({ msg }) =>
  msg ? (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in
    ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
    >
      {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
    </div>
  ) : null;

export default function Settings() {
  const { user, updateBusinessSettings } = useAuth();
  const role = user?.role?.toLowerCase();
  const isOwner = role === 'owner';
  const canManageUsers = ['owner', 'manager'].includes(role);
  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setSubtitle('Toko');
  }, [setSubtitle]);

  // Tentukan tab default berdasarkan role
  const defaultTab = canManageUsers ? 'karyawan' : 'akun-saya';
  const [activeTab, setActiveTab] = useState(defaultTab);

  // ── Tab Karyawan ──
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'staff',
    no_hp: '',
    email: '',
  });

  // ── Tab Keamanan ──
  const [sessions, setSessions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [secLoading, setSecLoading] = useState(false);
  const [secToast, setSecToast] = useState(null);

  // ── Tab Hak Akses ──
  const [permissions, setPermissions] = useState(getPermissions());

  // ── Tab Pengaturan Bisnis ──
  const [bisnis, setBisnis] = useState({
    nama_bisnis: '',
    alamat: '',
    no_telepon: '',
    mata_uang: 'IDR',
    logo_url: '',
    deskripsi: '',
    ppn_default: 11,
    invoice_terms: '',
    order_prefix: 'ORD',
    payroll_jam_masuk: '08:00',
    payroll_jam_keluar: '17:00',
    payroll_toleransi_menit: 15,
    biaya_potongan_terlambat: 1000,
    r2_bucket_name: '',
    r2_custom_domain: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
  });
  const [bisnisDivisi, setBisnisDivisi] = useState([]);
  const [subTab, setSubTab] = useState('umum');
  const [bisnisLoading, setBisnisLoading] = useState(false);
  const [bisnisSaving, setBisnisSaving] = useState(false);
  const [bisnisMsg, setBisnisMsg] = useState(null); // { type, text }
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // ── Tab Akun Saya ──
  const [profil, setProfil] = useState({ no_hp: '', kota: '', bio: '', email: '' });
  const [profilLoading, setProfilLoading] = useState(false);
  const [profilSaving, setProfilSaving] = useState(false);
  const [profilMsg, setProfilMsg] = useState(null);
  const [pwForm, setPwForm] = useState({ lama: '', baru: '', ulang: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [showPw, setShowPw] = useState({ lama: false, baru: false, ulang: false });

  // ── Tab WhatsApp Gateway ──
  const [waStatus, setWaStatus] = useState(null);
  const [waLoading, setWaLoading] = useState(false);

  const fetchWaStatus = async () => {
    setWaLoading(true);
    try {
      const res = await apiClient.get('/whatsapp/status/');
      setWaStatus(res.data);
    } catch {
      setWaStatus(null);
    } finally {
      setWaLoading(false);
    }
  };

  // ── Reset Password Bawahan (Owner / Manager only) ──
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetPwForm, setResetPwForm] = useState({ password: '', confirm: '' });
  const [resetPwLoading, setResetPwLoading] = useState(false);
  const [resetPwError, setResetPwError] = useState('');
  const [resetPwSuccess, setResetPwSuccess] = useState('');

  // ── Fetch helpers ──────────────────────────────────────
  const fetchEmployees = async () => {
    setEmpLoading(true);
    try {
      const res = await apiClient.get('/users/');
      setEmployees(res.data);
    } catch {
      /* silent */
    } finally {
      setEmpLoading(false);
    }
  };

  const fetchSecurity = async () => {
    setSecLoading(true);
    try {
      const [sessRes, auditRes] = await Promise.allSettled([
        apiClient.get('/security/sessions/'),
        apiClient.get('/security/audit-log/'),
      ]);
      if (sessRes.status === 'fulfilled') setSessions(sessRes.value.data || []);
      if (auditRes.status === 'fulfilled') setAuditLogs((auditRes.value.data || []).slice(0, 20));
    } catch {
      /* silent */
    } finally {
      setSecLoading(false);
    }
  };

  const fetchBisnis = async () => {
    setBisnisLoading(true);
    try {
      const res = await apiClient.get('/business-settings/');
      const { divisi_list: _divBisnis, ...fields } = res.data;
      setBisnis(fields);
      setBisnisDivisi(_divBisnis || []);
      setLogoFile(null);
      setLogoPreview('');
    } catch {
      /* silent */
    } finally {
      setBisnisLoading(false);
    }
  };

  const fetchProfil = async () => {
    setProfilLoading(true);
    try {
      const res = await apiClient.get('/users/me/');
      const { no_hp, kota, bio, email } = res.data;
      setProfil({ no_hp: no_hp || '', kota: kota || '', bio: bio || '', email: email || '' });
    } catch {
      /* silent */
    } finally {
      setProfilLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'karyawan') fetchEmployees();
    if (activeTab === 'keamanan' && isOwner) fetchSecurity();
    if (activeTab === 'bisnis') fetchBisnis();
    if (activeTab === 'akun-saya') fetchProfil();
    if (activeTab === 'whatsapp-gateway') fetchWaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Auto-refresh QR every 20 seconds while on WA tab and disconnected
  useEffect(() => {
    if (activeTab !== 'whatsapp-gateway') return;
    if (waStatus?.connected) return;
    const timer = setInterval(() => fetchWaStatus(), 20000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, waStatus?.connected]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // ── Handler Bisnis ─────────────────────────────────────
  const handleSaveBisnis = async (e) => {
    e.preventDefault();
    setBisnisSaving(true);
    setBisnisMsg(null);
    try {
      const formData = new FormData();
      formData.append('nama_bisnis', bisnis.nama_bisnis || '');
      formData.append('alamat', bisnis.alamat || '');
      formData.append('no_telepon', bisnis.no_telepon || '');
      formData.append('mata_uang', bisnis.mata_uang || 'IDR');
      formData.append('deskripsi', bisnis.deskripsi || '');
      
      // Keuangan & Invoice
      formData.append('ppn_default', bisnis.ppn_default !== undefined ? bisnis.ppn_default : 11);
      formData.append('invoice_terms', bisnis.invoice_terms || '');
      formData.append('order_prefix', bisnis.order_prefix || 'ORD');
      
      // Kebijakan Karyawan & Payroll
      formData.append('payroll_jam_masuk', bisnis.payroll_jam_masuk || '08:00');
      formData.append('payroll_jam_keluar', bisnis.payroll_jam_keluar || '17:00');
      formData.append('payroll_toleransi_menit', bisnis.payroll_toleransi_menit !== undefined ? bisnis.payroll_toleransi_menit : 15);
      formData.append('biaya_potongan_terlambat', bisnis.biaya_potongan_terlambat !== undefined ? bisnis.biaya_potongan_terlambat : 1000);
      
      // API & Integrasi Cloud
      formData.append('r2_bucket_name', bisnis.r2_bucket_name || '');
      formData.append('r2_custom_domain', bisnis.r2_custom_domain || '');
      formData.append('smtp_host', bisnis.smtp_host || '');
      formData.append('smtp_port', bisnis.smtp_port !== undefined ? bisnis.smtp_port : 587);
      formData.append('smtp_user', bisnis.smtp_user || '');
      formData.append('smtp_password', bisnis.smtp_password || '');

      if (logoFile) {
        formData.append('logo_file', logoFile);
      } else {
        formData.append('logo_url', bisnis.logo_url || '');
      }

      const res = await apiClient.patch('/business-settings/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update context global agar Topbar / Sidebar langsung terupdate
      updateBusinessSettings(res.data);

      // Update local state bisnis dengan respon data terbaru
      const fields = { ...res.data };
      delete fields.divisi_list;
      setBisnis(fields);
      setLogoFile(null);
      setLogoPreview('');

      setBisnisMsg({ type: 'success', text: 'Pengaturan bisnis berhasil disimpan.' });
    } catch (err) {
      // Deteksi error spesifik
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.logo_file?.[0] || '';

      let errMsg = 'Gagal menyimpan. Coba lagi.';
      if (
        detail.toLowerCase().includes('storage') ||
        detail.toLowerCase().includes('s3') ||
        detail.toLowerCase().includes('connection')
      ) {
        errMsg =
          'Gagal upload logo: storage cloud tidak terhubung. Hubungi administrator untuk konfigurasi R2/S3.';
      } else if (status === 413) {
        errMsg = 'Ukuran file terlalu besar. Maksimal 2MB.';
      } else if (status === 415 || detail.toLowerCase().includes('image')) {
        errMsg = 'Format file tidak didukung. Gunakan PNG, JPG, atau WEBP.';
      } else if (status === 500) {
        errMsg = logoFile
          ? 'Gagal upload logo ke server. Pastikan konfigurasi storage sudah benar di VPS.'
          : 'Terjadi kesalahan server. Coba lagi.';
      } else if (detail) {
        errMsg = detail;
      }

      setBisnisMsg({ type: 'error', text: errMsg });
    } finally {
      setBisnisSaving(false);
      setTimeout(() => setBisnisMsg(null), 5000);
    }
  };

  // ── Handler Akun Saya ──────────────────────────────────
  const handleSaveProfil = async (e) => {
    e.preventDefault();
    setProfilSaving(true);
    setProfilMsg(null);
    try {
      const res = await apiClient.get('/users/me/');
      await apiClient.patch(`/users/${res.data.id}/`, profil);
      setProfilMsg({ type: 'success', text: 'Profil berhasil diperbarui.' });
    } catch {
      setProfilMsg({ type: 'error', text: 'Gagal memperbarui profil.' });
    } finally {
      setProfilSaving(false);
      setTimeout(() => setProfilMsg(null), 3500);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwForm.baru !== pwForm.ulang) {
      setPwMsg({ type: 'error', text: 'Password baru dan konfirmasi tidak cocok.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await apiClient.post('/auth/change-password/', {
        old_password: pwForm.lama,
        new_password: pwForm.baru,
      });
      setPwMsg({ type: 'success', text: 'Password berhasil diubah.' });
      setPwForm({ lama: '', baru: '', ulang: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.detail || 'Gagal mengubah password.' });
    } finally {
      setPwSaving(false);
      setTimeout(() => setPwMsg(null), 4000);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPwForm.password !== resetPwForm.confirm) {
      setResetPwError('Konfirmasi password tidak cocok.');
      return;
    }
    if (resetPwForm.password.length < 8) {
      setResetPwError('Password minimal harus 8 karakter.');
      return;
    }
    setResetPwLoading(true);
    setResetPwError('');
    setResetPwSuccess('');
    try {
      await apiClient.post(`/users/${resetTarget.id}/reset-password/`, {
        new_password: resetPwForm.password,
      });
      setResetPwSuccess(`Password untuk ${resetTarget.username} berhasil diubah!`);
      setTimeout(() => {
        setResetPasswordOpen(false);
        setResetTarget(null);
      }, 1500);
    } catch (err) {
      setResetPwError(err.response?.data?.error || 'Gagal mereset password.');
    } finally {
      setResetPwLoading(false);
    }
  };

  // ── Create user ─────────────────────────────────────────
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');
    try {
      await apiClient.post('/auth/create-user/', formData);
      setFormSuccess('Karyawan berhasil ditambahkan!');
      setIsModalOpen(false);
      setFormData({ username: '', password: '', role: 'staff', no_hp: '', email: '' });
      fetchEmployees();
    } catch (err) {
      setFormError(
        err.response?.status === 403
          ? 'Anda tidak memiliki izin untuk membuat akun.'
          : 'Gagal membuat akun. Pastikan username belum digunakan.'
      );
    } finally {
      setFormLoading(false);
    }
  };

  // ── Revoke session ──────────────────────────────────────
  const revokeSession = async (sessionId) => {
    try {
      await apiClient.delete(`/security/sessions/${sessionId}/`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      showSecToast('success', 'Sesi berhasil dicabut.');
    } catch {
      showSecToast('error', 'Gagal mencabut sesi.');
    }
  };

  const showSecToast = (type, msg) => {
    setSecToast({ type, msg });
    setTimeout(() => setSecToast(null), 3500);
  };

  const inputCls =
    'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all';

  return (
    <div className="max-w-6xl mx-auto px-4 pt-2 pb-12 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings2 size={22} className="text-indigo-600" /> Pengaturan
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola akun, karyawan, pengaturan bisnis, dan keamanan sistem.
          </p>
        </div>
        {activeTab === 'karyawan' && canManageUsers && (
          <button
            onClick={() => {
              setIsModalOpen(true);
              setFormError('');
              setFormSuccess('');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md hover:-translate-y-px cursor-pointer"
          >
            <Plus size={16} /> Tambah Karyawan
          </button>
        )}
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.filter((t) => t.roles.includes(role)).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer
                ${active ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Global Toast ── */}
      {secToast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in
          ${
            secToast.type === 'success'
              ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
              : 'bg-rose-50 border-rose-250 text-rose-700'
          }`}
        >
          {secToast.type === 'success' ? (
            <CheckCircle2 size={15} className="text-emerald-600" />
          ) : (
            <AlertCircle size={15} className="text-rose-600" />
          )}
          {secToast.msg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: AKUN SAYA (semua role)
      ══════════════════════════════════════════════════ */}
      {activeTab === 'akun-saya' && (
        <div className="space-y-6" style={{ animation: 'revealUp 0.4s ease both' }}>
          {/* Edit Profil */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <User size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Informasi Profil</h3>
            </div>
            {profilLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSaveProfil} className="p-6 space-y-4">
                <MsgBox msg={profilMsg} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Username — read-only */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <User size={13} className="text-slate-400" /> Username
                    </label>
                    <input
                      type="text"
                      value={user?.username || ''}
                      readOnly
                      className={`${inputCls} bg-slate-100 cursor-not-allowed text-slate-500`}
                    />
                  </div>
                  {/* Role — read-only */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Shield size={13} className="text-slate-400" /> Role
                    </label>
                    <input
                      type="text"
                      value={role || ''}
                      readOnly
                      className={`${inputCls} bg-slate-100 cursor-not-allowed text-slate-500 capitalize`}
                    />
                  </div>
                  {/* No HP */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Phone size={13} className="text-slate-400" /> No HP
                    </label>
                    <input
                      type="text"
                      value={profil.no_hp}
                      onChange={(e) => setProfil({ ...profil, no_hp: e.target.value })}
                      placeholder="0812..."
                      className={inputCls}
                    />
                  </div>
                  {/* Kota */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <MapPin size={13} className="text-slate-400" /> Kota
                    </label>
                    <input
                      type="text"
                      value={profil.kota}
                      onChange={(e) => setProfil({ ...profil, kota: e.target.value })}
                      placeholder="Jakarta..."
                      className={inputCls}
                    />
                  </div>
                  {/* Email */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <Mail size={13} className="text-slate-400" /> Email (Untuk Keamanan Login)
                    </label>
                    <input
                      type="email"
                      value={profil.email || ''}
                      onChange={(e) => setProfil({ ...profil, email: e.target.value })}
                      placeholder="karyawan@elhayyu.co.id"
                      className={inputCls}
                    />
                  </div>
                </div>
                {/* Bio */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <FileText size={13} className="text-slate-400" /> Bio
                  </label>
                  <textarea
                    rows={3}
                    value={profil.bio}
                    onChange={(e) => setProfil({ ...profil, bio: e.target.value })}
                    placeholder="Ceritakan sedikit tentang diri Anda..."
                    className={`${inputCls} resize-none`}
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={profilSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60 cursor-pointer"
                  >
                    {profilSaving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    Simpan Profil
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Ganti Password */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <KeyRound size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Ganti Password</h3>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <MsgBox msg={pwMsg} />
              {[
                { key: 'lama', label: 'Password Lama' },
                { key: 'baru', label: 'Password Baru' },
                { key: 'ulang', label: 'Konfirmasi Password Baru' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <div className="relative">
                    <input
                      type={showPw[key] ? 'text' : 'password'}
                      required
                      value={pwForm[key]}
                      onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                      placeholder="••••••••"
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw({ ...showPw, [key]: !showPw[key] })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {pwSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <KeyRound size={15} />
                  )}
                  Ubah Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: PENGATURAN BISNIS (Owner & Manager)
      ══════════════════════════════════════════════════ */}
      {activeTab === 'bisnis' && (
        <div style={{ animation: 'revealUp 0.4s ease both' }}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Pengaturan Bisnis & Sistem</h3>
            </div>
            
            {bisnisLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <form onSubmit={handleSaveBisnis} className="flex flex-col md:flex-row min-h-[500px]">
                {/* Sidebar Sub-Tabs */}
                <div className="w-full md:w-64 border-r border-slate-100 bg-slate-50/50 p-4 space-y-1 shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">Sub Setelan</p>
                  {[
                    { id: 'umum', label: 'Umum & Lokalisasi', icon: Building2 },
                    { id: 'keuangan', label: 'Keuangan & Invoice', icon: FileText },
                    { id: 'karyawan', label: 'Kebijakan Karyawan', icon: Users },
                  ].map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = subTab === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSubTab(sub.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left cursor-pointer
                          ${isSubActive ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`}
                      >
                        <SubIcon size={16} className={isSubActive ? 'text-indigo-600' : 'text-slate-400'} />
                        {sub.label}
                      </button>
                    );
                  })}
                </div>

                {/* Right Form Panel */}
                <div className="flex-1 p-6 space-y-6">
                  <MsgBox msg={bisnisMsg} />

                  {/* SUB-TAB: UMUM */}
                  {subTab === 'umum' && (
                    <div className="space-y-5 animate-fade-in">
                      <div>
                        <h4 className="font-bold text-slate-800 text-base">Umum & Profil Bisnis</h4>
                        <p className="text-xs text-slate-400">Atur profil dasar perusahaan dan logo utama.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            Nama Perusahaan
                          </label>
                          <input
                            type="text"
                            value={bisnis.nama_bisnis || ''}
                            onChange={(e) => setBisnis({ ...bisnis, nama_bisnis: e.target.value })}
                            placeholder="PT. Maju Utama..."
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            No Telepon Kantor
                          </label>
                          <input
                            type="text"
                            value={bisnis.no_telepon || ''}
                            onChange={(e) => setBisnis({ ...bisnis, no_telepon: e.target.value })}
                            placeholder="0812..."
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            Alamat Kantor
                          </label>
                          <textarea
                            rows={2}
                            value={bisnis.alamat || ''}
                            onChange={(e) => setBisnis({ ...bisnis, alamat: e.target.value })}
                            placeholder="Jl. ..."
                            className={`${inputCls} resize-none`}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            Mata Uang Default
                          </label>
                          <select
                            value={bisnis.mata_uang || 'IDR'}
                            onChange={(e) => setBisnis({ ...bisnis, mata_uang: e.target.value })}
                            className={`${inputCls} appearance-none cursor-pointer`}
                          >
                            <option value="IDR">IDR — Rupiah</option>
                            <option value="USD">USD — Dollar</option>
                            <option value="SGD">SGD — Singapore Dollar</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            Logo Bisnis
                          </label>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                            <div className="relative w-20 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden group shrink-0">
                              {logoPreview || bisnis.logo_url ? (
                                <img
                                  src={logoPreview || getLogoUrl(bisnis.logo_url)}
                                  alt="Logo Bisnis"
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Building2 size={28} className="text-slate-300" />
                              )}
                              <label
                                htmlFor="logo-file-input"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              >
                                <Upload size={16} className="text-white" />
                              </label>
                            </div>
                            <div className="space-y-1.5">
                              <input
                                type="file"
                                id="logo-file-input"
                                accept="image/*"
                                className="hidden"
                                onChange={handleLogoChange}
                              />
                              <button
                                type="button"
                                onClick={() => document.getElementById('logo-file-input').click()}
                                className="px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <Upload size={13} className="text-slate-500" /> Pilih File Gambar
                              </button>
                              <p className="text-[10px] text-slate-400">
                                Format PNG, JPG, atau WEBP. Maksimal 2MB.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                            Deskripsi Bisnis
                          </label>
                          <textarea
                            rows={3}
                            value={bisnis.deskripsi || ''}
                            onChange={(e) => setBisnis({ ...bisnis, deskripsi: e.target.value })}
                            placeholder="Ceritakan tentang bisnis Anda..."
                            className={`${inputCls} resize-none`}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB: KEUANGAN & INVOICE */}
                  {subTab === 'keuangan' && (
                    <div className="space-y-5 animate-fade-in">
                      <div>
                        <h4 className="font-bold text-slate-800 text-base">Keuangan & Cetak Invoice</h4>
                        <p className="text-xs text-slate-400">Konfigurasi persentase pajak default dan terms struk pembayaran.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            PPN Default (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={bisnis.ppn_default || 0}
                            onChange={(e) => setBisnis({ ...bisnis, ppn_default: parseInt(e.target.value) || 0 })}
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Prefix Nomor Order / Invoice
                          </label>
                          <input
                            type="text"
                            value={bisnis.order_prefix || ''}
                            onChange={(e) => setBisnis({ ...bisnis, order_prefix: e.target.value })}
                            placeholder="ORD"
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-sm font-medium text-slate-700">
                            Syarat & Ketentuan Struk (Terms & Conditions)
                          </label>
                          <textarea
                            rows={4}
                            value={bisnis.invoice_terms || ''}
                            onChange={(e) => setBisnis({ ...bisnis, invoice_terms: e.target.value })}
                            placeholder="Barang yang sudah dibeli tidak dapat ditukar..."
                            className={inputCls}
                          />
                          <p className="text-[10px] text-slate-400">
                            Teks ini akan dicetak di bagian paling bawah pada invoice/struk pesanan.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-TAB: KEBIJAKAN KARYAWAN */}
                  {subTab === 'karyawan' && (
                    <div className="space-y-5 animate-fade-in">
                      <div>
                        <h4 className="font-bold text-slate-800 text-base">Kebijakan Staff & Absensi</h4>
                        <p className="text-xs text-slate-400">Atur regulasi jam masuk kerja, batas toleransi, dan denda terlambat.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Jam Masuk Kerja (Default)
                          </label>
                          <input
                            type="text"
                            placeholder="08:00"
                            value={bisnis.payroll_jam_masuk || ''}
                            onChange={(e) => setBisnis({ ...bisnis, payroll_jam_masuk: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Jam Pulang Kerja (Default)
                          </label>
                          <input
                            type="text"
                            placeholder="17:00"
                            value={bisnis.payroll_jam_keluar || ''}
                            onChange={(e) => setBisnis({ ...bisnis, payroll_jam_keluar: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Batas Toleransi Keterlambatan (Menit)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={bisnis.payroll_toleransi_menit || 0}
                            onChange={(e) => setBisnis({ ...bisnis, payroll_toleransi_menit: parseInt(e.target.value) || 0 })}
                            className={inputCls}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-slate-700">
                            Nominal Denda Terlambat (Rupiah per Menit)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={bisnis.biaya_potongan_terlambat || 0}
                            onChange={(e) => setBisnis({ ...bisnis, biaya_potongan_terlambat: parseInt(e.target.value) || 0 })}
                            className={inputCls}
                          />
                        </div>
                      </div>

                      {/* Divisi */}
                      {bisnisDivisi.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Daftar Divisi Aktif
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {bisnisDivisi.map((d) => (
                              <span
                                key={d.id}
                                className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100"
                              >
                                {d.nama}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sticky Save Button Bar */}
                  <div className="flex justify-end pt-4 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={bisnisSaving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60 cursor-pointer shadow-sm animate-fade-in"
                    >
                      {bisnisSaving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={15} />
                      )}
                      Simpan Pengaturan Bisnis
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 1: KARYAWAN
      ══════════════════════════════════════════════════ */}
      {activeTab === 'karyawan' && (
        <div style={{ animation: 'revealUp 0.4s ease both' }}>
          {formSuccess && (
            <div
              className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200
              text-emerald-700 text-sm font-medium px-4 py-3 rounded-xl"
            >
              <CheckCircle2 size={15} /> {formSuccess}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header info */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users size={16} className="text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Daftar Karyawan</h3>
              <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium ml-1">
                {employees.length} orang
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="px-6 py-3">ID</th>
                    <th className="px-6 py-3">Username</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">No HP</th>
                    <th className="px-6 py-3">Divisi</th>
                    <th className="px-6 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {empLoading ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-sm">Memuat data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : employees.length > 0 ? (
                    employees.map((emp) => (
                      <tr
                        key={emp.id}
                        className="border-t border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm text-slate-400 font-mono">#{emp.id}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                          {emp.username}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{emp.email || '–'}</td>
                        <td className="px-6 py-4 text-sm">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize
                            ${ROLE_STYLE[emp.role] || ROLE_STYLE.staff}`}
                          >
                            {emp.role || 'staff'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">{emp.no_hp || '–'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          {emp.divisi_nama || '–'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {/* Sembunyikan tombol jika target memiliki role owner/manager dan role kita manager */}
                          {(role?.toLowerCase() === 'owner' ||
                            (role?.toLowerCase() === 'manager' &&
                              emp.role !== 'owner' &&
                              emp.role !== 'manager')) && (
                            <button
                              onClick={() => {
                                setResetTarget(emp);
                                setResetPasswordOpen(true);
                                setResetPwError('');
                                setResetPwSuccess('');
                                setResetPwForm({ password: '', confirm: '' });
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer border border-rose-100"
                            >
                              <KeyRound size={12} /> Reset Password
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-sm text-slate-400">
                        Belum ada data karyawan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 2: HAK AKSES (Owner & Manager)
      ══════════════════════════════════════════════════ */}
      {activeTab === 'hak-akses' && canManageUsers && (
        <div style={{ animation: 'revealUp 0.4s ease both' }} className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-indigo-600" />
                <h3 className="font-semibold text-slate-800">Manajemen Hak Akses Fitur & Menu</h3>
              </div>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Apakah Anda yakin ingin menyetel ulang semua hak akses ke default?'
                    )
                  ) {
                    setPermissions(DEFAULT_PERMISSIONS);
                    savePermissions(DEFAULT_PERMISSIONS);
                    showSecToast('success', 'Hak akses disetel ulang ke default. Memuat ulang...');
                    setTimeout(() => window.location.reload(), 1500);
                  }
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
              >
                Reset ke Default
              </button>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Tentukan halaman dan fitur mana saja yang dapat diakses oleh masing-masing tingkat
                peran karyawan. Peran <span className="font-bold text-slate-700">Owner</span> selalu
                memiliki akses penuh ke seluruh sistem untuk menjamin kontrol administratif tetap
                terjaga.
              </p>

              <div className="overflow-x-auto border border-slate-150 rounded-xl">
                <table className="w-full text-left min-w-[600px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-150">
                      <th className="px-6 py-3.5 w-1/3">Nama Halaman / Fitur</th>
                      <th className="px-6 py-3.5 text-center">Owner</th>
                      <th className="px-6 py-3.5 text-center">Manager</th>
                      <th className="px-6 py-3.5 text-center">Admin</th>
                      <th className="px-6 py-3.5 text-center">Staff Produksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MENU_FEATURES.map((feature) => {
                      return (
                        <tr key={feature.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-semibold text-slate-800">{feature.label}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {feature.path}
                            </p>
                          </td>
                          {/* Owner (Selalu true, disabled) */}
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={true}
                              disabled={true}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-350 opacity-60"
                            />
                          </td>
                          {/* Manager */}
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={permissions.manager?.includes(feature.id) || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPermissions((prev) => {
                                  const updated = checked
                                    ? [...(prev.manager || []), feature.id]
                                    : (prev.manager || []).filter((id) => id !== feature.id);
                                  return { ...prev, manager: updated };
                                });
                              }}
                              className="w-4.5 h-4.5 rounded text-indigo-650 focus:ring-indigo-500 border-slate-350 cursor-pointer"
                            />
                          </td>
                          {/* Admin */}
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={permissions.admin?.includes(feature.id) || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPermissions((prev) => {
                                  const updated = checked
                                    ? [...(prev.admin || []), feature.id]
                                    : (prev.admin || []).filter((id) => id !== feature.id);
                                  return { ...prev, admin: updated };
                                });
                              }}
                              className="w-4.5 h-4.5 rounded text-indigo-650 focus:ring-indigo-500 border-slate-350 cursor-pointer"
                            />
                          </td>
                          {/* Staff */}
                          <td className="px-6 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={permissions.staff?.includes(feature.id) || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPermissions((prev) => {
                                  const updated = checked
                                    ? [...(prev.staff || []), feature.id]
                                    : (prev.staff || []).filter((id) => id !== feature.id);
                                  return { ...prev, staff: updated };
                                });
                              }}
                              className="w-4.5 h-4.5 rounded text-indigo-650 focus:ring-indigo-500 border-slate-350 cursor-pointer"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Button */}
              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-100">
                <button
                  onClick={() => {
                    savePermissions(permissions);
                    showSecToast('success', 'Hak akses berhasil disimpan! Memuat ulang sistem...');
                    setTimeout(() => {
                      window.location.reload();
                    }, 1500);
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Simpan Hak Akses
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB 3: KEAMANAN (Owner only)
      ══════════════════════════════════════════════════ */}
      {activeTab === 'keamanan' && (
        <div className="space-y-6" style={{ animation: 'revealUp 0.4s ease both' }}>
          {!isOwner ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Lock size={40} className="mb-3 opacity-40" />
              <p className="font-medium">Akses dibatasi untuk Owner.</p>
            </div>
          ) : (
            <>
              {/* ── Sesi Aktif ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Monitor size={16} className="text-indigo-600" />
                  <h3 className="font-semibold text-slate-800">Sesi Login Aktif</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium ml-1">
                    {sessions.filter((s) => s.is_active && !s.is_expired).length} aktif
                  </span>
                </div>

                {secLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-center py-10 text-sm text-slate-400">Tidak ada sesi aktif.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {sessions
                      .filter((s) => s.is_active)
                      .map((sess) => (
                        <div
                          key={sess.id}
                          className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                              <Monitor size={16} className="text-indigo-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {sess.username}
                                {sess.device_name && (
                                  <span className="font-normal text-slate-500">
                                    {' '}
                                    — {sess.device_name}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400">
                                IP: {sess.ip_address || '–'} · Login: {formatWaktu(sess.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {!sess.is_expired ? (
                              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
                                Aktif
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                Kedaluwarsa
                              </span>
                            )}
                            <button
                              onClick={() => revokeSession(sess.id)}
                              title="Cabut Sesi"
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50
                                rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* ── Audit Log ── */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                  <Shield size={16} className="text-indigo-600" />
                  <h3 className="font-semibold text-slate-800">Log Keamanan</h3>
                  <span className="text-xs text-slate-400 ml-1">20 terbaru</span>
                </div>

                {secLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-center py-10 text-sm text-slate-400">
                    Belum ada log keamanan.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="px-6 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                      >
                        {log.berhasil ? (
                          <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle size={14} className="text-red-400 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-slate-700">
                            {log.username}
                          </span>
                          <span className="mx-2 text-slate-300">·</span>
                          <span className="text-xs text-slate-500">
                            {log.event?.replace(/_/g, ' ')}
                          </span>
                          {log.keterangan && (
                            <span className="ml-2 text-xs text-slate-400 truncate hidden md:inline">
                              — {log.keterangan}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-slate-400">{formatWaktu(log.waktu)}</p>
                          {log.ip_address && (
                            <p className="text-xs text-slate-300">{log.ip_address}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Tambah Karyawan
      ══════════════════════════════════════════════════ */}
      {isModalOpen && canManageUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden
            animate-[revealUp_0.25s_ease]"
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Users size={15} className="text-indigo-600" />
                </div>
                <h2 className="font-bold text-slate-800">Buat Akun Karyawan Baru</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {formError && (
                <div
                  className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center
                  gap-2 border border-red-100"
                >
                  <AlertTriangle size={15} /> {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Username</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="contoh: budi_desain"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm
                    bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400
                    focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min. 8 karakter"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm
                    bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400
                    focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Email (Untuk Keamanan Login)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="karyawan@elhayyu.co.id"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm
                    bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400
                    focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">No HP (Opsional)</label>
                <input
                  type="text"
                  value={formData.no_hp}
                  onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                  placeholder="0812..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm
                    bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400
                    focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm
                    bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400
                    focus:border-indigo-400 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  {user?.role?.toLowerCase() === 'owner' && <option value="owner">Owner</option>}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300
                    hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold
                    bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all
                    disabled:opacity-60 min-w-[120px] justify-center cursor-pointer"
                >
                  {formLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{' '}
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Akun'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ══════════════════════════════════════════════════
          MODAL: Reset Password Karyawan (Owner/Manager)
      ══════════════════════════════════════════════════ */}
      {resetPasswordOpen && resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[revealUp_0.25s_ease]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                  <KeyRound size={15} className="text-rose-600" />
                </div>
                <h2 className="font-bold text-slate-800">Reset Password {resetTarget.username}</h2>
              </div>
              <button
                onClick={() => {
                  setResetPasswordOpen(false);
                  setResetTarget(null);
                }}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {resetPwError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-red-100">
                  <AlertTriangle size={15} /> {resetPwError}
                </div>
              )}
              {resetPwSuccess && (
                <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2 border border-emerald-100">
                  <CheckCircle2 size={15} /> {resetPwSuccess}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Password Baru</label>
                <input
                  type="password"
                  required
                  value={resetPwForm.password}
                  onChange={(e) => setResetPwForm({ ...resetPwForm, password: e.target.value })}
                  placeholder="Min. 8 karakter"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  required
                  value={resetPwForm.confirm}
                  onChange={(e) => setResetPwForm({ ...resetPwForm, confirm: e.target.value })}
                  placeholder="Ulangi password baru"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetPasswordOpen(false);
                    setResetTarget(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetPwLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all disabled:opacity-60 min-w-[120px] justify-center cursor-pointer"
                >
                  {resetPwLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{' '}
                      Menyimpan...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: WHATSAPP GATEWAY
      ══════════════════════════════════════════════════ */}
      {activeTab === 'whatsapp-gateway' && (
        <div className="space-y-6" style={{ animation: 'revealUp 0.4s ease both' }}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-600" />
                <h3 className="font-semibold text-slate-800">WhatsApp Gateway — Status Koneksi</h3>
              </div>
              <button
                onClick={fetchWaStatus}
                disabled={waLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={waLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <div className="p-6">
              {waLoading && !waStatus ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : waStatus ? (
                <div className="space-y-6">
                  {/* Status Badge */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                    waStatus.connected
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-amber-50 border-amber-200'
                  }`}>
                    {waStatus.connected ? (
                      <Wifi size={22} className="text-emerald-600 shrink-0" />
                    ) : (
                      <WifiOff size={22} className="text-amber-500 shrink-0" />
                    )}
                    <div>
                      <p className={`font-bold text-sm ${
                        waStatus.connected ? 'text-emerald-800' : 'text-amber-800'
                      }`}>
                        {waStatus.connected ? '✅ WhatsApp Terhubung' : '⚠️ Belum Terhubung — Scan QR Code'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Instance: <span className="font-mono font-semibold">{waStatus.instance_name}</span>
                        {waStatus.connected && waStatus.owner_jid && (
                          <> &nbsp;|&nbsp; Nomor: <span className="font-semibold">{waStatus.owner_jid.split('@')[0]}</span></>
                        )}
                        {waStatus.connected && waStatus.profileName && (
                          <> &nbsp;|&nbsp; Nama: <span className="font-semibold">{waStatus.profileName}</span></>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Connected Stats */}
                  {waStatus.connected && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <p className="text-2xl font-extrabold text-slate-800">{waStatus.chatCount ?? 0}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Total Chat Tersimpan</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <p className="text-2xl font-extrabold text-slate-800">{waStatus.messageCount ?? 0}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Total Pesan Tersimpan</p>
                      </div>
                    </div>
                  )}

                  {/* QR Code Section */}
                  {!waStatus.connected && waStatus.qr_base64 && (
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-sm inline-block">
                        <img
                          src={waStatus.qr_base64}
                          alt="QR Code WhatsApp"
                          className="w-64 h-64 object-contain"
                        />
                      </div>
                      <div className="text-center space-y-1 max-w-sm">
                        <p className="text-sm font-bold text-slate-700">Cara Menghubungkan WhatsApp:</p>
                        <ol className="text-xs text-slate-500 text-left space-y-1 list-decimal list-inside">
                          <li>Buka WhatsApp di HP Anda</li>
                          <li>Ketuk ikon titik tiga (⋮) → <strong>Tautkan Perangkat</strong></li>
                          <li>Scan QR code di atas</li>
                          <li>Tunggu beberapa detik hingga status berubah hijau</li>
                        </ol>
                        <p className="text-[10px] text-slate-400 pt-1">QR Code diperbarui otomatis setiap 20 detik</p>
                      </div>
                    </div>
                  )}

                  {/* No QR code yet */}
                  {!waStatus.connected && !waStatus.qr_base64 && (
                    <div className="text-center py-6 text-slate-400">
                      <WifiOff size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">QR Code belum tersedia. Coba klik <strong>Refresh</strong>.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Gagal memuat status WhatsApp. Pastikan Evolution API aktif.</p>
                  <button onClick={fetchWaStatus} className="mt-3 text-xs text-indigo-600 hover:underline cursor-pointer">
                    Coba lagi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes revealUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
