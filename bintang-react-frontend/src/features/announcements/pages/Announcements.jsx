import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { Bell, Plus, Trash2, X, Users, MessageSquare } from 'lucide-react';
import dayjs from 'dayjs';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Data Master untuk form
  const [divisiList, setDivisiList] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // State Modal Form
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    judul: '',
    isi: '',
    target: 'semua',
    divisi: '',
    staff_personal: [], // Multi-select array
  });

  const fetchAnnouncements = async () => {
    try {
      const res = await apiClient.get('/hr/info/');
      setAnnouncements(res.data);
    } catch (err) {
      console.error('Gagal memuat pengumuman:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasterData = async () => {
    try {
      const [resDivisi, resStaff] = await Promise.all([
        apiClient.get('/divisi/'),
        apiClient.get('/users/'),
      ]);
      setDivisiList(resDivisi.data);
      // Filter staff only
      setStaffList(resStaff.data.filter((user) => user.role === 'staff'));
    } catch (err) {
      console.error('Gagal memuat data master:', err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchMasterData();
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStaffToggle = (staffId) => {
    setFormData((prev) => {
      const isSelected = prev.staff_personal.includes(staffId);
      if (isSelected) {
        return { ...prev, staff_personal: prev.staff_personal.filter((id) => id !== staffId) };
      } else {
        return { ...prev, staff_personal: [...prev.staff_personal, staffId] };
      }
    });
  };

  const submitAnnouncement = async (e) => {
    e.preventDefault();
    if (formLoading) return; // Mencegah double submit pengumuman
    if (!formData.judul || !formData.isi) return alert('Judul dan isi wajib diisi!');

    if (formData.target === 'divisi' && !formData.divisi) {
      return alert('Pilih divisi terlebih dahulu!');
    }
    if (formData.target === 'personal' && formData.staff_personal.length === 0) {
      return alert('Pilih minimal satu staff!');
    }

    try {
      setFormLoading(true);

      // Logika khusus untuk target 'personal' yang bisa multi-select
      if (formData.target === 'personal') {
        const promises = formData.staff_personal.map((staffId) => {
          return apiClient.post('/hr/info/', {
            judul: formData.judul,
            isi: formData.isi,
            target: 'personal',
            staff_personal: staffId,
          });
        });
        await Promise.all(promises);
      } else {
        // Logika normal untuk 'semua' atau 'divisi'
        const payload = {
          judul: formData.judul,
          isi: formData.isi,
          target: formData.target,
        };
        if (formData.target === 'divisi') payload.divisi = formData.divisi;
        await apiClient.post('/hr/info/', payload);
      }

      setShowModal(false);
      setFormData({ judul: '', isi: '', target: 'semua', divisi: '', staff_personal: [] });
      fetchAnnouncements();
    } catch (err) {
      console.error('Gagal membuat pengumuman:', err);
      alert('Terjadi kesalahan saat menyimpan pengumuman.');
    } finally {
      setFormLoading(false);
    }
  };

  const hapusAnnouncement = async (id) => {
    if (!window.confirm('Yakin ingin menghapus pengumuman ini?')) return;
    try {
      await apiClient.delete(`/hr/info/${id}/`);
      fetchAnnouncements();
    } catch (err) {
      console.error('Gagal menghapus:', err);
      alert('Gagal menghapus pengumuman.');
    }
  };

  if (loading) return <div className="text-center p-10 text-slate-500">Memuat pengumuman...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="text-blue-200" /> Pusat Pengumuman
          </h1>
          <p className="text-blue-100 text-sm mt-1 opacity-90">
            Kirim informasi dan broadcast ke seluruh tim dengan mudah.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} /> Buat Baru
        </button>
      </div>

      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow transition-shadow relative group"
            >
              <button
                onClick={() => hapusAnnouncement(item.id)}
                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Hapus"
              >
                <Trash2 size={18} />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                    item.target === 'semua'
                      ? 'bg-blue-100 text-blue-700'
                      : item.target === 'divisi'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-purple-100 text-purple-700'
                  }`}
                >
                  {item.target} {item.target === 'divisi' ? `- ${item.divisi_nama}` : ''}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {dayjs(item.dibuat_pada).format('DD MMM YYYY, HH:mm')}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-800 leading-tight">{item.judul}</h3>
              <p className="text-slate-600 text-sm mt-2 whitespace-pre-wrap leading-relaxed">
                {item.isi}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Users size={14} className="text-slate-400" />
                Oleh: {item.dibuat_oleh_nama}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center flex flex-col items-center">
            <MessageSquare size={48} className="text-slate-200 mb-3" />
            <h3 className="text-slate-700 font-bold">Belum ada pengumuman</h3>
            <p className="text-slate-400 text-sm mt-1">Buat pengumuman pertama Anda untuk tim.</p>
          </div>
        )}
      </div>

      {/* MODAL FORM */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bell className="text-blue-600" size={18} /> Buat Pengumuman Baru
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitAnnouncement} className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                  Judul Pengumuman
                </label>
                <input
                  required
                  type="text"
                  name="judul"
                  value={formData.judul}
                  onChange={handleFormChange}
                  placeholder="Misal: Libur Lebaran"
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                  Isi Pesan
                </label>
                <textarea
                  required
                  name="isi"
                  value={formData.isi}
                  onChange={handleFormChange}
                  rows={4}
                  placeholder="Tulis rincian pengumuman..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-4">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2 block">
                  Target Penerima
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="target"
                      value="semua"
                      checked={formData.target === 'semua'}
                      onChange={handleFormChange}
                      className="accent-blue-600"
                    />
                    Semua Staff
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="target"
                      value="divisi"
                      checked={formData.target === 'divisi'}
                      onChange={handleFormChange}
                      className="accent-blue-600"
                    />
                    Per Divisi
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="target"
                      value="personal"
                      checked={formData.target === 'personal'}
                      onChange={handleFormChange}
                      className="accent-blue-600"
                    />
                    Beberapa Staff
                  </label>
                </div>
              </div>

              {formData.target === 'divisi' && (
                <div className="space-y-1.5 animate-fade-in bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                    Pilih Divisi
                  </label>
                  <select
                    name="divisi"
                    value={formData.divisi}
                    onChange={handleFormChange}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                  >
                    <option value="">-- Pilih Divisi --</option>
                    {divisiList.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.nama}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.target === 'personal' && (
                <div className="space-y-2 animate-fade-in bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-1 block">
                    Pilih Beberapa Staff (Centang)
                  </label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 bg-white border border-slate-200 p-2 rounded-lg custom-scrollbar">
                    {staffList.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-1.5 hover:bg-slate-50 rounded cursor-pointer transition-colors border border-transparent hover:border-slate-100"
                      >
                        <input
                          type="checkbox"
                          checked={formData.staff_personal.includes(user.id)}
                          onChange={() => handleStaffToggle(user.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{user.username}</span>
                          <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                            {user.divisi_nama || '-'}
                          </span>
                        </div>
                      </label>
                    ))}
                    {staffList.length === 0 && (
                      <div className="text-xs text-slate-400 p-2 text-center">
                        Tidak ada data staff.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-slate-600 text-sm font-bold bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2.5 text-white text-sm font-bold bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
                >
                  {formLoading ? 'Memproses...' : 'Kirim Pengumuman'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
