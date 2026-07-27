import { useState, useEffect, useRef } from 'react';
import apiClient from '../../../api/apiClient';
import {
  User,
  Save,
  Upload,
  MapPin,
  Phone,
  CheckCircle2,
  Edit,
  X,
  Calendar,
  Clock,
  AlertCircle,
  Building2,
  Mail,
  Hash,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

// ─── Constants ─────────────────────────────────────────────
const ROLE_STYLE = {
  owner: 'bg-purple-100 text-purple-700 border-purple-200',
  manager: 'bg-blue-100 text-blue-700 border-blue-200',
  admin: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  staff: 'bg-slate-100 text-slate-600 border-slate-200',
};

const ROLE_LABEL = {
  owner: 'Owner',
  manager: 'Manager',
  admin: 'Admin',
  staff: 'Staff',
};

// ─── Helpers ───────────────────────────────────────────────
const formatDate = (dateStr, includeTime = false) => {
  if (!dateStr) return '–';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const options = includeTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' };

  return date.toLocaleString('id-ID', options);
};

const getAvatarUrl = (path) => {
  if (!path) return null;
  const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace(
    '/api',
    ''
  );
  return path.startsWith('http') ? path : `${apiBase}${path}`;
};

// ─── Sub-Components ────────────────────────────────────────

// Komponen untuk Form Input agar tidak mengulang kode
const FormInput = ({ label, icon: Icon, disabled, note, ...props }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <div className="relative">
      {Icon && <Icon size={14} className="absolute left-3 top-3 text-slate-400" />}
      <input
        disabled={disabled}
        className={`w-full py-2.5 text-sm rounded-lg border outline-none transition-all
          ${Icon ? 'pl-9 pr-3' : 'px-3'}
          ${
            disabled
              ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-white border-slate-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400'
          }`}
        {...props}
      />
    </div>
    {note && <p className="text-xs text-slate-400">{note}</p>}
  </div>
);

// Komponen untuk menampilkan Data Profil (View Mode)
const InfoItem = ({ icon: Icon, label, value, fullWidth }) => (
  <div className={`space-y-1 ${fullWidth ? 'sm:col-span-2' : ''}`}>
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
      <Icon size={12} /> {label}
    </div>
    <p className="text-slate-800 font-medium whitespace-pre-line">{value}</p>
  </div>
);

// ─── Main Component ────────────────────────────────────────
export default function Profile() {
  const { updateUser } = useAuth();

  // States
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const fileInputRef = useRef(null);
  const [editForm, setEditForm] = useState({
    no_hp: '',
    kota: '',
    negara: '',
    alamat: '',
    bio: '',
  });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users/me/');
      setProfile(res.data);
      updateEditForm(res.data);
    } catch (err) {
      console.error('Gagal memuat profil:', err);
      showToast('error', 'Gagal memuat data profil.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Data
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateEditForm = (data) => {
    setEditForm({
      no_hp: data.no_hp || '',
      kota: data.kota || '',
      negara: data.negara || '',
      alamat: data.alamat || '',
      bio: data.bio || '',
    });
  };

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const toggleEditMode = (mode) => {
    if (mode) {
      updateEditForm(profile);
    }
    setIsEditing(mode);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(editForm).forEach(([k, v]) => fd.append(k, v || ''));
      if (selectedFile) fd.append('foto_profil', selectedFile);

      const res = await apiClient.patch('/users/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setProfile(res.data);
      updateUser(res.data);
      toggleEditMode(false);
      showToast('success', 'Profil berhasil diperbarui!');
    } catch {
      showToast('error', 'Gagal menyimpan profil. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  // Render Loading
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"
            style={{ borderWidth: '3px' }}
          />
          <p className="text-slate-500 text-sm font-medium">Memuat profil...</p>
        </div>
      </div>
    );

  if (!profile) return null;

  // Render Variables
  const displayAvatar = previewUrl || getAvatarUrl(profile.foto_profil);
  const initials = (profile.first_name || profile.username || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const fullName = profile.first_name
    ? `${profile.first_name} ${profile.last_name || ''}`.trim()
    : profile.username;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 px-4 pt-2">
      {/* ── Styles (Animasi) ── */}
      <style>{`
        @keyframes revealUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        .animate-reveal { animation: revealUp 0.5s ease both; }
        .animate-reveal-delay { animation: revealUp 0.5s ease 0.1s both; }
      `}</style>

      {/* ── Toast Notifikasi ── */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all animate-[slideDown_0.3s_ease] ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Profil Saya</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola informasi pribadi dan akun Anda.</p>
        </div>

        {!isEditing ? (
          <button
            onClick={() => toggleEditMode(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
          >
            <Edit size={15} /> Edit Profil
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => toggleEditMode(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all"
            >
              <X size={15} /> Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-60"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        )}
      </div>

      {/* ── SECTION 1: Avatar Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-reveal">
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 relative">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
              backgroundSize: '30px 30px',
            }}
          />
        </div>

        <div className="px-6 pb-6">
          {/* Perbaikan Z-Index dan Posisi Relatif di Sini */}
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-end gap-4 -mt-12">
            {/* Avatar */}
            <div className="relative group">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 opacity-0 group-hover:opacity-60 transition-opacity duration-300 blur-sm" />
              <div
                onClick={() => isEditing && fileInputRef.current?.click()}
                className={`relative w-24 h-24 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center transition-all duration-300 ${isEditing ? 'cursor-pointer' : ''}`}
              >
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">{initials}</span>
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={18} className="text-white" />
                    <span className="text-white text-xs mt-1">Ubah</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            {/* Nama & Badge */}
            <div className="flex-1 pb-1">
              <h2 className="text-xl font-bold text-slate-900">{fullName}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${ROLE_STYLE[profile.role] || ROLE_STYLE.staff}`}
                >
                  {ROLE_LABEL[profile.role] || profile.role}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Building2 size={12} /> {profile.divisi_nama || 'Tanpa Divisi'}
                </span>
                <span className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${profile.is_online ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'bg-slate-300'}`}
                  />
                  <span className={profile.is_online ? 'text-emerald-600' : 'text-slate-400'}>
                    {profile.is_online ? 'Online' : 'Offline'}
                  </span>
                </span>
              </div>
            </div>

            {/* Tombol Ubah Foto Mobile/Desktop */}
            {isEditing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors"
              >
                <Upload size={12} className="inline mr-1" /> Ubah Foto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Informasi Akun ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-reveal-delay">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <User size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Informasi Pribadi</h3>
        </div>

        {!isEditing ? (
          /* ── VIEW MODE ── */
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            <InfoItem icon={Hash} label="Username" value={profile.username} />
            <InfoItem icon={Mail} label="Email" value={profile.email || '–'} />
            <InfoItem icon={Phone} label="No. HP / WA" value={profile.no_hp || '–'} />
            <InfoItem icon={MapPin} label="Kota" value={profile.kota || '–'} />
            <InfoItem icon={Building2} label="Negara" value={profile.negara || '–'} />
            <InfoItem icon={Calendar} label="Bergabung" value={formatDate(profile.date_joined)} />
            <InfoItem
              icon={Clock}
              label="Login Terakhir"
              value={formatDate(profile.last_login, true)}
            />

            {profile.alamat && (
              <InfoItem icon={MapPin} label="Alamat" value={profile.alamat} fullWidth />
            )}
            {profile.bio && <InfoItem icon={User} label="Bio" value={profile.bio} fullWidth />}
          </div>
        ) : (
          /* ── EDIT MODE ── */
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FormInput
                label="Username"
                value={profile.username}
                disabled
                note="Tidak dapat diubah."
              />
              <FormInput label="Email" value={profile.email || ''} disabled type="email" />

              <FormInput
                label="No. HP / WhatsApp"
                icon={Phone}
                placeholder="0812..."
                value={editForm.no_hp}
                onChange={(e) => setEditForm({ ...editForm, no_hp: e.target.value })}
              />
              <FormInput
                label="Kota"
                icon={MapPin}
                placeholder="Jakarta"
                value={editForm.kota}
                onChange={(e) => setEditForm({ ...editForm, kota: e.target.value })}
              />
              <FormInput
                label="Negara"
                placeholder="Indonesia"
                value={editForm.negara}
                onChange={(e) => setEditForm({ ...editForm, negara: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Alamat Lengkap</label>
              <textarea
                rows="2"
                placeholder="Jl. Contoh No. 123..."
                value={editForm.alamat}
                onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg resize-none border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Bio Singkat</label>
              <textarea
                rows="2"
                placeholder="Saya bekerja di divisi..."
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded-lg resize-none border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
