import { Camera, Save, Edit, X, Phone, Mail, MapPin, User, Calendar, Hash, FileText, Download } from 'lucide-react';

/**
 * Modal full-screen "Info Karyawan" (lihat/edit profil self-service +
 * status kepegawaian read-only) -- diekstrak dari StaffDashboard.jsx
 * (2026-09-18) supaya file itu tidak melewati batas 1000 baris (Aturan
 * Engineering L5) saat ditambah section Papan Kerja Kordiv/SPV/Admin
 * Finance/SPV Finance. Murni pemindahan JSX, tanpa perubahan logika --
 * semua state/handler tetap dikelola StaffDashboard.jsx, dioper lewat props.
 */
export default function EmployeeInfoModal({
  show,
  onClose,
  user,
  getAvatarUrl,
  avatarPreviewUrl,
  isEditingProfile,
  setIsEditingProfile,
  avatarInputRef,
  handleAvatarChange,
  profileModalTab,
  setProfileModalTab,
  profileForm,
  setProfileForm,
  setSelectedAvatarFile,
  setAvatarPreviewUrl,
  handleSaveProfile,
  profileSaving,
}) {
  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-slate-900/40 backdrop-blur-sm transition-all duration-300 ${
        show ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`w-full max-w-lg bg-white h-full relative flex flex-col shadow-2xl transition-transform duration-300 ${
          show ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header & Cover Area */}
        <div className="relative bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-950 px-6 pt-8 pb-5 text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors text-white cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            {/* Profile Avatar uploader */}
            <div className="relative group">
              <div className="w-16 h-16 rounded-full border-2 border-white/50 shadow-md overflow-hidden bg-indigo-50 flex items-center justify-center">
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : user?.foto_profil ? (
                  <img src={getAvatarUrl(user.foto_profil)} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-indigo-800 font-black text-2xl capitalize">
                    {user?.username?.charAt(0)}
                  </span>
                )}
              </div>
              {isEditingProfile && (
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 rounded-full flex flex-col items-center justify-center text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-bold"
                >
                  <Camera size={12} className="mb-0.5" />
                  <span>UBAH</span>
                </button>
              )}
              <input
                type="file"
                accept="image/*"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div>
              <h2 className="text-lg font-black tracking-tight leading-tight capitalize">
                {user?.username}
              </h2>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="bg-white/20 border border-white/15 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider">
                  {user?.nip || 'NIP STAFF'}
                </span>
                <span className="text-[10px] text-indigo-200 font-semibold capitalize">
                  {user?.divisi_nama || 'Produksi'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setProfileModalTab('personal')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer
              ${profileModalTab === 'personal' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Data Pribadi (Self-Service)
          </button>
          <button
            type="button"
            onClick={() => setProfileModalTab('kepegawaian')}
            className={`flex-1 py-3 text-xs font-bold text-center border-b-2 transition-all cursor-pointer
              ${profileModalTab === 'kepegawaian' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Status & Kontrak (HR)
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {profileModalTab === 'personal' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b border-slate-105 pb-2">
                <h3 className="font-bold text-slate-800 text-sm">Informasi Personal</h3>
                {!isEditingProfile ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    <Edit size={12} />
                    <span>Edit Profil</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setSelectedAvatarFile(null);
                      setAvatarPreviewUrl(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                    <span>Batal</span>
                  </button>
                )}
              </div>

              {!isEditingProfile ? (
                /* Personal - View Mode */
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Phone size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No. WhatsApp / HP</p>
                      <p className="text-sm font-semibold text-slate-700">{user?.no_hp || '–'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Mail size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                      <p className="text-sm font-semibold text-slate-700">{user?.email || '–'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kota tinggal</p>
                      <p className="text-sm font-semibold text-slate-700">{user?.kota || '–'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <MapPin size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Alamat Lengkap</p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed">{user?.alamat || '–'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <User size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bio Singkat</p>
                      <p className="text-sm font-semibold text-slate-700 leading-relaxed whitespace-pre-line">{user?.bio || '–'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Personal - Edit Mode */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">No. WhatsApp / HP</label>
                    <div className="relative">
                      <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={profileForm.no_hp}
                        onChange={(e) => setProfileForm({ ...profileForm, no_hp: e.target.value })}
                        placeholder="Contoh: 08123456789"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-450 focus:border-indigo-450 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 opacity-60">
                    <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="email"
                        value={profileForm.email}
                        disabled
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Email diatur oleh atasan sebagai data login.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Kota</label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={profileForm.kota}
                        onChange={(e) => setProfileForm({ ...profileForm, kota: e.target.value })}
                        placeholder="Contoh: Yogyakarta"
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Alamat Lengkap</label>
                    <textarea
                      rows="2"
                      value={profileForm.alamat}
                      onChange={(e) => setProfileForm({ ...profileForm, alamat: e.target.value })}
                      placeholder="Masukkan alamat lengkap..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Bio Singkat</label>
                    <textarea
                      rows="2"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder="Tulis bio singkat atau divisi detail..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setSelectedAvatarFile(null);
                        setAvatarPreviewUrl(null);
                      }}
                      className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={profileSaving}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {profileSaving ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      <span>{profileSaving ? 'Menyimpan...' : 'Simpan'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {profileModalTab === 'kepegawaian' && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800 text-sm">Status & Detail Kontrak</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Status Kepegawaian</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {user?.status_karyawan || 'Aktif'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Jenis Kontrak</span>
                  <span className="text-xs font-bold text-slate-700 capitalize">
                    Karyawan {user?.jenis_kontrak || 'Tetap'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Mulai Kontrak</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {user?.kontrak_mulai ? new Date(user.kontrak_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Selesai Kontrak</span>
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Calendar size={12} className="text-slate-400" />
                    {user?.kontrak_selesai ? new Date(user.kontrak_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'}
                  </span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider pb-1.5 border-b border-slate-200/60">
                  <Hash size={12} />
                  <span>Nomor Jaminan Sosial</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium">BPJS Kesehatan:</p>
                    <p className="font-bold text-slate-700 mt-0.5">{user?.bpjs_kes || '–'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">BPJS Ketenagakerjaan (KPJ):</p>
                    <p className="font-bold text-slate-700 mt-0.5">{user?.no_kpj || '–'}</p>
                  </div>
                </div>
              </div>

              {user?.file_pkwt && (
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <FileText className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-900 leading-tight">Dokumen Kontrak Kerja (PKWT)</h4>
                      <p className="text-[10px] text-indigo-750 mt-1 leading-relaxed">
                        *Silakan unduh dokumen PKWT resmi Anda. Tautan dokumen ini hanya valid selama berkas disimpan oleh administrasi HR.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fileUrl = user.file_pkwt.startsWith('http')
                        ? user.file_pkwt
                        : `${(import.meta.env.VITE_API_URL || '').replace('/api', '')}${user.file_pkwt}`;
                      window.open(fileUrl, '_blank');
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    <Download size={13} />
                    <span>Unduh Dokumen PKWT</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
