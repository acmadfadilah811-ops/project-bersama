import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { getApiErrorMessage } from '../../../utils/apiError';
import { uiConfirm } from '../../../utils/dialog';
import {
  User,
  Briefcase,
  Phone,
  MapPin,
  Clock,
  CalendarDays,
  X,
  ShieldCheck,
  FileText,
  Save,
  Search,
  Building2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/id';
import UnitBisnisFilter from '../../../components/UnitBisnisFilter';
import {
  cocokUnit,
  hitungPerUnit,
  namaUnitKaryawan,
  unitKaryawanBelumDiatur,
} from '../../../utils/unitBisnis';

dayjs.extend(relativeTime);
dayjs.locale('id');

const ROLE_LABEL = {
  owner: 'Owner',
  manager: 'Manager',
  admin: 'Admin',
  staff: 'Staff',
  kasir: 'Kasir',
  spv: 'SPV',
  kordiv: 'Kordiv',
  sales: 'Sales',
  admin_finance: 'Admin Finance',
  spv_finance: 'SPV Finance',
};

// Jabatan = jabatan dari HR (posisi); bila kosong pakai nama role.
const namaJabatan = (emp) => emp.posisi || ROLE_LABEL[emp.role] || emp.role || '-';

// Unit bisnis tempat karyawan bertugas. Role lintas-unit tampil "Semua unit".
const namaUnit = (emp) => namaUnitKaryawan(emp.role, emp.unit_bisnis_nama);
const unitBelumDiatur = (emp) => unitKaryawanBelumDiatur(emp.role, emp.unit_bisnis_nama);

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [unitList, setUnitList] = useState([]);
  const [loading, setLoading] = useState(true);
  // Cari karyawan + kelompok per unit bisnis (admin tahu siapa jabatan apa di unit mana).
  const [cari, setCari] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  // Akun nonaktif (mis. dinonaktifkan dari HR) bisa diarsipkan agar tidak memenuhi daftar (2026-10-14).
  const [lihatArsip, setLihatArsip] = useState(false);

  // State untuk Modal
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pkwtFile, setPkwtFile] = useState(null);
  const [formData, setFormData] = useState({
    divisi: '',
    unit_bisnis: '',
    status_karyawan: 'aktif',
    jenis_kontrak: 'tetap',
    kontrak_mulai: '',
    kontrak_selesai: '',
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const [res, resDivisi, resUnit] = await Promise.all([
        apiClient.get('/users/'),
        apiClient.get('/divisi/'),
        apiClient.get('/unit-bisnis/'),
      ]);
      setEmployees(res.data);
      setDivisiList(resDivisi.data.results || resDivisi.data);
      setUnitList(resUnit.data.results || resUnit.data);
    } catch (err) {
      console.error('Gagal memuat data karyawan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openModal = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      divisi: emp.divisi ?? '',
      unit_bisnis: emp.unit_bisnis ?? '',
      status_karyawan: emp.status_karyawan || 'aktif',
      jenis_kontrak: emp.jenis_kontrak || 'tetap',
      kontrak_mulai: emp.kontrak_mulai || '',
      kontrak_selesai: emp.kontrak_selesai || '',
    });
    setPkwtFile(null);
  };

  const aturArsip = async (emp, arsip) => {
    const ok = await uiConfirm(
      arsip
        ? `Arsipkan akun ${emp.username}? Akun tetap nonaktif dan disembunyikan dari daftar.`
        : `Keluarkan akun ${emp.username} dari arsip?`
    );
    if (!ok) return;
    try {
      const res = await apiClient.post(`/users/${emp.id}/arsip/`, { arsip });
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? res.data : e)));
    } catch (err) {
      alert(getApiErrorMessage(err, 'Gagal mengubah arsip akun.'));
    }
  };

  const closeModal = () => {
    setSelectedEmployee(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      // Divisi milik satu unit bisnis -> unit akun ikut menyesuaikan (server menolak yang bentrok).
      if (name === 'divisi' && value !== '') {
        const dipilih = divisiList.find((d) => String(d.id) === String(value));
        if (dipilih?.unit_bisnis) next.unit_bisnis = dipilih.unit_bisnis;
      }
      return next;
    });
  };

  const handleUpdateEmployment = async () => {
    try {
      setIsUpdating(true);

      const data = new FormData();
      // Penempatan kerja: kosong dikirim '' (dibaca server sebagai tidak ada).
      data.append('divisi', formData.divisi);
      data.append('unit_bisnis', formData.unit_bisnis);
      data.append('status_karyawan', formData.status_karyawan);
      data.append('jenis_kontrak', formData.jenis_kontrak);
      data.append('kontrak_mulai', formData.kontrak_mulai);
      data.append('kontrak_selesai', formData.kontrak_selesai);
      if (pkwtFile) {
        data.append('file_pkwt', pkwtFile);
      }

      // Mengirim data update ke backend dengan FormData
      const res = await apiClient.patch(`/users/${selectedEmployee.id}/`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Update state lokal agar UI langsung berubah tanpa reload
      const updatedEmp = res.data;
      setEmployees(employees.map((e) => (e.id === selectedEmployee.id ? updatedEmp : e)));
      setSelectedEmployee(updatedEmp);

      alert('Penempatan kerja, status, dan kontrak berhasil diperbarui!');
    } catch (err) {
      console.error('Gagal update data:', err);
      alert(getApiErrorMessage(err, 'Gagal menyimpan perubahan.'));
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 text-sm font-medium">Memuat data karyawan...</p>
        </div>
      </div>
    );
  }

  const getAvatarUrl = (url) => {
    if (!url) return null;
    const apiBase = (import.meta.env.VITE_API_URL || 'https://bintang-adv.duckdns.org/api').replace(
      '/api',
      ''
    );
    return url.startsWith('http') ? url : `${apiBase}${url}`;
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

  const kata = cari.trim().toLowerCase();
  const jumlahArsip = employees.filter((e) => e.diarsipkan).length;
  const karyawanDaftar = employees.filter((e) => Boolean(e.diarsipkan) === lihatArsip);
  const karyawanTampil = karyawanDaftar.filter(
    (e) =>
      cocokUnit(e.unit_bisnis, unitFilter) &&
      (!kata ||
        [e.username, e.posisi, e.role, e.divisi_nama, e.unit_bisnis_nama, e.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(kata)))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Manajemen Karyawan</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pantau seluruh staf, profil, dan histori login mereka.
        </p>
      </div>

      {/* Cari & kelompok per unit bisnis */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <UnitBisnisFilter
          value={unitFilter}
          onChange={setUnitFilter}
          jumlah={hitungPerUnit(karyawanDaftar, (e) => e.unit_bisnis)}
          labelTanpaUnit="Tanpa unit"
        />
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
        <button
          type="button"
          onClick={() => setLihatArsip((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border shrink-0 ${
            lihatArsip ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Archive size={13} />
          {lihatArsip ? 'Tutup Arsip' : `Arsip (${jumlahArsip})`}
        </button>
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama, jabatan, atau divisi..."
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-slate-900 outline-none bg-white"
          />
        </div>
        </div>
      </div>
      {lihatArsip && (
        <p className="text-xs text-slate-500">
          Akun nonaktif yang diarsipkan. Akun yang diaktifkan lagi (dari HR atau status Aktif) otomatis keluar dari arsip.
        </p>
      )}

      {/* Grid Karyawan */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {karyawanTampil.length === 0 && (
          <p className="col-span-full text-center text-xs text-slate-400 italic py-10">
            Tidak ada karyawan yang cocok dengan filter.
          </p>
        )}
        {karyawanTampil.map((emp) => (
          <div
            key={emp.id}
            onClick={() => openModal(emp)}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col relative"
          >
            {/* Status Badge */}
            <div
              className={`absolute top-2 right-2 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${getStatusColor(emp.status_karyawan || 'aktif')}`}
            >
              {emp.status_karyawan || 'Aktif'}
            </div>

            {/* Header / Cover Area */}
            <div className="h-16 bg-slate-100 relative border-b border-slate-200"></div>

            {/* Avatar & Basic Info */}
            <div className="px-4 pb-4 flex-1 flex flex-col items-center -mt-8 relative z-10">
              <div className="w-16 h-16 bg-white rounded-full p-1 shadow-sm mb-2">
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100">
                  {emp.foto_profil ? (
                    <img
                      src={getAvatarUrl(emp.foto_profil)}
                      alt={emp.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={24} className="text-slate-400" />
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 capitalize">{emp.username}</h3>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 border border-indigo-100 max-w-full">
                <Briefcase size={10} className="shrink-0" />
                <span className="truncate" title="Jabatan">{namaJabatan(emp)}</span>
              </div>
              <div
                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 border max-w-full ${
                  unitBelumDiatur(emp)
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-slate-600 bg-slate-50 border-slate-200'
                }`}
              >
                <Building2 size={10} className="shrink-0" />
                <span className="truncate" title="Unit bisnis">{namaUnit(emp)}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-400 font-medium text-center">
                {ROLE_LABEL[emp.role] || emp.role}
                {emp.divisi_nama ? ` • Divisi ${emp.divisi_nama}` : ''}
              </p>
              {emp.role === 'staff' && !emp.divisi && (
                <div className="mt-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Belum berdivisi
                </div>
              )}
              {emp.is_active === false && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    aturArsip(emp, !emp.diarsipkan);
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100"
                >
                  {emp.diarsipkan ? <ArchiveRestore size={11} /> : <Archive size={11} />}
                  {emp.diarsipkan ? 'Keluarkan dari Arsip' : 'Arsipkan'}
                </button>
              )}
            </div>

            {/* Footer / Login History */}
            <div className="border-t border-slate-100 p-3 bg-slate-50 flex items-center justify-between text-[10px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-slate-400 flex items-center gap-1 font-medium">
                  <CalendarDays size={10} /> Bergabung
                </span>
                <span className="text-slate-700 font-semibold">
                  {emp.date_joined ? dayjs(emp.date_joined).format('DD MMM YYYY') : '-'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 text-right">
                <span className="text-slate-400 font-medium">Terakhir Aktif</span>
                <span className="text-slate-700 font-semibold">
                  {emp.last_login ? (
                    dayjs(emp.last_login).fromNow()
                  ) : (
                    <span className="text-amber-500">Belum pernah</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Detail Karyawan */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border border-slate-300">
                  {selectedEmployee.foto_profil ? (
                    <img
                      src={getAvatarUrl(selectedEmployee.foto_profil)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={20} className="text-slate-500" />
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 capitalize">
                    {selectedEmployee.username}
                  </h2>
                  <p className="text-sm text-slate-600 font-semibold">
                    {namaJabatan(selectedEmployee)} • {namaUnit(selectedEmployee)}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    {ROLE_LABEL[selectedEmployee.role] || selectedEmployee.role}
                    {selectedEmployee.divisi_nama ? ` • Divisi ${selectedEmployee.divisi_nama}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Seksi Detail Personal */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-2">
                    Informasi Kontak
                  </h4>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <Phone size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Nomor HP</p>
                      <p className="font-semibold text-slate-800">
                        {selectedEmployee.no_hp || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                      <MapPin size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Alamat</p>
                      <p className="font-semibold text-slate-800 leading-snug">
                        {selectedEmployee.alamat || '-'}
                      </p>
                      <p className="font-semibold text-slate-800">{selectedEmployee.kota || ''}</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 mb-2 border-b border-slate-200 pb-2">
                    Aktivitas Sistem
                  </h4>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <CalendarDays size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Bergabung Sejak</p>
                      <p className="font-semibold text-slate-800">
                        {selectedEmployee.date_joined
                          ? dayjs(selectedEmployee.date_joined).format('DD MMMM YYYY')
                          : '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Login Terakhir</p>
                      <p className="font-semibold text-slate-800">
                        {selectedEmployee.last_login
                          ? dayjs(selectedEmployee.last_login).format('DD MMM YYYY, HH:mm')
                          : 'Belum pernah'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seksi Manajemen Kontrak & Status */}
              <div className="border border-slate-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck size={20} className="text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-lg">Manajemen Kepegawaian</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Penempatan Kerja: divisi menentukan SPK antrean yang terlihat oleh staff */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Divisi</label>
                    <select
                      name="divisi"
                      value={formData.divisi}
                      onChange={handleInputChange}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Belum berdivisi</option>
                      {divisiList.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nama}{d.unit_bisnis_nama ? ` (${d.unit_bisnis_nama})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      Staff hanya melihat SPK antrean dari divisinya. Tanpa divisi, staff hanya melihat SPK yang ditugaskan langsung kepadanya.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Unit Bisnis</label>
                    <select
                      name="unit_bisnis"
                      value={formData.unit_bisnis}
                      onChange={handleInputChange}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="">Tanpa unit bisnis</option>
                      {unitList.map((u) => (
                        <option key={u.id} value={u.id}>{u.nama}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400">
                      Otomatis mengikuti unit milik divisi yang dipilih. Divisi dan unit harus cocok.
                    </p>
                  </div>

                  {/* Status Karyawan */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Status Karyawan</label>
                    <select
                      name="status_karyawan"
                      value={formData.status_karyawan}
                      onChange={handleInputChange}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                      <option value="aktif">Aktif</option>
                      <option value="cuti">Cuti</option>
                      <option value="nonaktif">Non-Aktif (Resign/Diberhentikan)</option>
                    </select>
                  </div>

                  {/* Jenis Kontrak */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Jenis Kontrak</label>
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-slate-400" />
                      <select
                        name="jenis_kontrak"
                        value={formData.jenis_kontrak}
                        onChange={handleInputChange}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      >
                        <option value="tetap">Karyawan Tetap</option>
                        <option value="kontrak">Kontrak (PKWT)</option>
                        <option value="magang">Magang (Internship)</option>
                        <option value="freelance">Freelance / Harian</option>
                      </select>
                    </div>
                  </div>

                  {/* Periode Kontrak */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Mulai Kontrak</label>
                    <input
                      type="date"
                      name="kontrak_mulai"
                      value={formData.kontrak_mulai}
                      onChange={handleInputChange}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Selesai Kontrak</label>
                    <input
                      type="date"
                      name="kontrak_selesai"
                      value={formData.kontrak_selesai}
                      onChange={handleInputChange}
                      className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  {/* Unggah Berkas PKWT */}
                  <div className="col-span-1 md:col-span-2 space-y-1.5 pt-4 border-t border-slate-100">
                    <label className="text-sm font-semibold text-slate-700 block">
                      Unggah File Kontrak PKWT (PDF / Gambar)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={(e) => setPkwtFile(e.target.files[0])}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                    {selectedEmployee.file_pkwt && (
                      <div className="flex items-center gap-2 p-2 bg-indigo-50/50 rounded-lg text-xs mt-2 border border-indigo-100/50">
                        <FileText size={14} className="text-indigo-500 shrink-0" />
                        <span className="text-slate-600 truncate flex-1 font-medium">
                          Dokumen PKWT Aktif
                        </span>
                        <a
                          href={getAvatarUrl(selectedEmployee.file_pkwt)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline font-bold"
                        >
                          Lihat / Unduh
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleUpdateEmployment}
                    disabled={isUpdating}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:bg-indigo-400"
                  >
                    <Save size={16} />
                    {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
