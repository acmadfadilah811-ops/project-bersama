import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  X,
  Save,
  ChevronDown,
  ChevronRight,
  ListOrdered,
  Tag,
} from 'lucide-react';

export default function Divisi() {
  const { user } = useAuth();
  const isManager = ['owner', 'manager'].includes(user?.role);

  const [divisiList, setDivisiList] = useState([]);
  const [tahapList, setTahapList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDivisi, setExpandedDivisi] = useState({});

  // Modal state
  const [modalDivisi, setModalDivisi] = useState(null); // null = tutup, {} = baru, {id,...} = edit
  const [modalTahap, setModalTahap] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [divisiForm, setDivisiForm] = useState({ nama: '', keterangan: '' });
  const [tahapForm, setTahapForm] = useState({ nama: '', divisi: '', urutan: 1 });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resDivisi, resTahap] = await Promise.all([
        apiClient.get('/divisi/'),
        apiClient.get('/tahap-proses/'),
      ]);
      setDivisiList(resDivisi.data);
      setTahapList(resTahap.data);
      // Expand semua divisi secara default
      const expanded = {};
      resDivisi.data.forEach((d) => (expanded[d.id] = true));
      setExpandedDivisi(expanded);
    } catch (err) {
      console.error('Gagal memuat data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── DIVISI CRUD ──────────────────────────────────────────
  const openDivisiModal = (divisi = null) => {
    if (divisi) {
      setDivisiForm({ nama: divisi.nama, keterangan: divisi.keterangan || '' });
    } else {
      setDivisiForm({ nama: '', keterangan: '' });
    }
    setModalDivisi(divisi || {});
  };

  const submitDivisi = async (e) => {
    e.preventDefault();
    if (formLoading) return;
    if (!divisiForm.nama.trim()) return alert('Nama divisi wajib diisi!');
    try {
      setFormLoading(true);
      if (modalDivisi?.id) {
        await apiClient.patch(`/divisi/${modalDivisi.id}/`, divisiForm);
      } else {
        await apiClient.post('/divisi/', divisiForm);
      }
      setModalDivisi(null);
      fetchData();
    } catch (err) {
      console.error('Gagal simpan divisi:', err);
      alert('Gagal menyimpan divisi.');
    } finally {
      setFormLoading(false);
    }
  };

  const hapusDivisi = async (id, nama) => {
    if (
      !window.confirm(
        `Hapus divisi "${nama}"?\n\nSemua tahap proses di divisi ini juga akan terhapus.`
      )
    )
      return;
    try {
      await apiClient.delete(`/divisi/${id}/`);
      fetchData();
    } catch (err) {
      console.error('Gagal hapus:', err);
      alert('Gagal menghapus divisi. Pastikan tidak ada data yang bergantung.');
    }
  };

  // ── TAHAP PROSES CRUD ────────────────────────────────────
  const openTahapModal = (tahap = null, divisiId = null) => {
    if (tahap) {
      setTahapForm({ nama: tahap.nama, divisi: tahap.divisi, urutan: tahap.urutan });
    } else {
      setTahapForm({ nama: '', divisi: divisiId || '', urutan: 1 });
    }
    setModalTahap(tahap || { _divisiId: divisiId });
  };

  const submitTahap = async (e) => {
    e.preventDefault();
    if (formLoading) return;
    if (!tahapForm.nama.trim()) return alert('Nama tahap wajib diisi!');
    if (!tahapForm.divisi) return alert('Pilih divisi terlebih dahulu!');
    try {
      setFormLoading(true);
      if (modalTahap?.id) {
        await apiClient.patch(`/tahap-proses/${modalTahap.id}/`, tahapForm);
      } else {
        await apiClient.post('/tahap-proses/', tahapForm);
      }
      setModalTahap(null);
      fetchData();
    } catch (err) {
      console.error('Gagal simpan tahap:', err);
      alert('Gagal menyimpan tahap proses.');
    } finally {
      setFormLoading(false);
    }
  };

  const hapusTahap = async (id, nama) => {
    if (!window.confirm(`Hapus tahap "${nama}"?`)) return;
    try {
      await apiClient.delete(`/tahap-proses/${id}/`);
      fetchData();
    } catch (err) {
      console.error('Gagal hapus tahap:', err);
      alert('Gagal menghapus tahap proses.');
    }
  };

  const getTahapByDivisi = (divisiId) =>
    tahapList.filter((t) => t.divisi === divisiId).sort((a, b) => a.urutan - b.urutan);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="text-indigo-600" size={24} />
            Divisi & Tahap Proses
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Atur struktur organisasi produksi dan alur kerja job board.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => openDivisiModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Plus size={14} /> Tambah Divisi
          </button>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Tag className="text-indigo-600" size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Divisi</p>
            <p className="text-2xl font-extrabold text-slate-900">{divisiList.length}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <ListOrdered className="text-emerald-600" size={18} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Tahap Proses</p>
            <p className="text-2xl font-extrabold text-slate-900">{tahapList.length}</p>
          </div>
        </div>
      </div>

      {/* Divisi List */}
      {divisiList.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Layers size={48} className="text-slate-200 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700">Belum ada divisi</h3>
          <p className="text-sm text-slate-400 mt-1">
            {isManager ? 'Klik "Tambah Divisi" untuk memulai.' : 'Belum ada divisi yang dibuat.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {divisiList.map((divisi) => {
            const tahapDivisi = getTahapByDivisi(divisi.id);
            const isExpanded = expandedDivisi[divisi.id];

            return (
              <div
                key={divisi.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
              >
                {/* Divisi Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() =>
                    setExpandedDivisi((prev) => ({ ...prev, [divisi.id]: !prev[divisi.id] }))
                  }
                >
                  <div className="flex items-center gap-3">
                    <button className="text-slate-400 hover:text-slate-600 transition-colors">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">{divisi.nama}</h3>
                      {divisi.keterangan && (
                        <p className="text-xs text-slate-400 mt-0.5">{divisi.keterangan}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                      {tahapDivisi.length} tahap
                    </span>
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openTahapModal(null, divisi.id)}
                        className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus size={11} /> Tahap
                      </button>
                      <button
                        onClick={() => openDivisiModal(divisi)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        title="Edit Divisi"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => hapusDivisi(divisi.id, divisi.nama)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="Hapus Divisi"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Tahap List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {tahapDivisi.length === 0 ? (
                      <div className="px-6 py-4 text-xs text-slate-400 italic">
                        Belum ada tahap proses di divisi ini.
                      </div>
                    ) : (
                      tahapDivisi.map((tahap) => (
                        <div
                          key={tahap.id}
                          className="flex items-center justify-between px-6 py-3 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] font-extrabold flex items-center justify-center">
                              {tahap.urutan}
                            </span>
                            <span className="text-sm font-semibold text-slate-700">
                              {tahap.nama}
                            </span>
                          </div>
                          {isManager && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openTahapModal(tahap)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                title="Edit Tahap"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => hapusTahap(tahap.id, tahap.nama)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                title="Hapus Tahap"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL DIVISI ─────────────────────────────────────────── */}
      {modalDivisi !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Layers className="text-indigo-600" size={16} />
                {modalDivisi.id ? 'Edit Divisi' : 'Tambah Divisi Baru'}
              </h3>
              <button
                onClick={() => setModalDivisi(null)}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitDivisi} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Nama Divisi
                </label>
                <input
                  required
                  type="text"
                  value={divisiForm.nama}
                  onChange={(e) => setDivisiForm((p) => ({ ...p, nama: e.target.value }))}
                  placeholder="Misal: Desain, Cetak, Finishing"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Keterangan (Opsional)
                </label>
                <textarea
                  value={divisiForm.keterangan}
                  onChange={(e) => setDivisiForm((p) => ({ ...p, keterangan: e.target.value }))}
                  rows={3}
                  placeholder="Deskripsi singkat divisi ini..."
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalDivisi(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <Save size={12} />
                  {formLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL TAHAP PROSES ───────────────────────────────────── */}
      {modalTahap !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ListOrdered className="text-emerald-600" size={16} />
                {modalTahap.id ? 'Edit Tahap Proses' : 'Tambah Tahap Proses'}
              </h3>
              <button
                onClick={() => setModalTahap(null)}
                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitTahap} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Nama Tahap
                </label>
                <input
                  required
                  type="text"
                  value={tahapForm.nama}
                  onChange={(e) => setTahapForm((p) => ({ ...p, nama: e.target.value }))}
                  placeholder="Misal: Setting Desain, Cetak Spanduk"
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-slate-50 focus:bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Divisi
                  </label>
                  <select
                    required
                    value={tahapForm.divisi}
                    onChange={(e) => setTahapForm((p) => ({ ...p, divisi: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-slate-50 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Pilih --</option>
                    {divisiList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Urutan
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={tahapForm.urutan}
                    onChange={(e) =>
                      setTahapForm((p) => ({ ...p, urutan: parseInt(e.target.value) || 1 }))
                    }
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all bg-slate-50 focus:bg-white font-mono"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                Angka urutan menentukan urutan tahap dalam alur produksi. Angka terkecil diproses
                lebih dahulu.
              </p>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalTahap(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  <Save size={12} />
                  {formLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
