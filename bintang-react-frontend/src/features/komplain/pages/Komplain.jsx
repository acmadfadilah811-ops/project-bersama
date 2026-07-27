import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../api/apiClient';
import { 
  AlertTriangle, Search, Filter, MessageCircle, FileText, CheckCircle2, 
  XCircle, Clock, Save, X, ExternalLink
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/id';

dayjs.locale('id');

export default function Komplain() {
  const { user } = useAuth();
  const [komplainList, setKomplainList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [selectedKomplain, setSelectedKomplain] = useState(null);
  const [resolusiForm, setResolusiForm] = useState({
    resolusi: '',
    catatan_resolusi: '',
    status: 'selesai'
  });
  const [isResolving, setIsResolving] = useState(false);

  const isManager = ['owner', 'manager'].includes(user?.role);

  const fetchKomplain = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/komplain/');
      setKomplainList(res.data);
    } catch (err) {
      console.error('Failed to fetch komplain:', err);
      alert('Gagal mengambil data komplain.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKomplain();
  }, []);

  const filteredKomplain = useMemo(() => {
    return komplainList.filter(k => {
      const matchStatus = filterStatus === 'all' || k.status === filterStatus;
      const matchSearch = k.order_nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          k.order_nomor_wa?.includes(searchQuery) ||
                          k.jenis_display?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [komplainList, filterStatus, searchQuery]);

  const handleResolve = async (e) => {
    e.preventDefault();
    if (!resolusiForm.resolusi) {
      alert('Pilih resolusi terlebih dahulu!');
      return;
    }
    
    setIsResolving(true);
    try {
      await apiClient.post(`/komplain/${selectedKomplain.id}/resolve/`, resolusiForm);
      alert('Komplain berhasil diselesaikan!');
      setSelectedKomplain(null);
      fetchKomplain();
    } catch (err) {
      console.error(err);
      alert('Gagal menyelesaikan komplain.');
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'masuk': return <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200">Masuk</span>;
      case 'diproses': return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg border border-amber-200">Diproses</span>;
      case 'cetak_ulang': return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">Cetak Ulang</span>;
      case 'selesai': return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">Selesai</span>;
      case 'ditolak': return <span className="px-2.5 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg border border-slate-300">Ditolak</span>;
      default: return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shadow-inner">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Manajemen Komplain</h1>
            <p className="text-sm font-semibold text-slate-500 mt-0.5">Pantau dan selesaikan keluhan pelanggan</p>
          </div>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama pelanggan, WA, atau jenis komplain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium transition-all shadow-sm"
          />
        </div>
        <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm overflow-x-auto">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'masuk', label: 'Masuk' },
            { id: 'diproses', label: 'Diproses' },
            { id: 'selesai', label: 'Selesai' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                filterStatus === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table/List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Memuat data...</div>
        ) : filteredKomplain.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-300 opacity-50" />
            <p className="font-bold text-lg">Tidak ada komplain</p>
            <p className="text-sm">Semua keluhan pelanggan telah tertangani atau kosong.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Waktu</th>
                  <th className="px-6 py-4">Pelanggan</th>
                  <th className="px-6 py-4">Jenis Komplain</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Resolusi</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {filteredKomplain.map((k) => (
                  <tr key={k.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-xs">
                      {dayjs(k.waktu_masuk).format('DD MMM YYYY HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-black text-slate-800 font-mono">
                          #{k.order}
                        </span>
                        <span className="font-bold text-slate-800">{k.order_nama}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-1 pl-0.5">{k.order_nomor_wa}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-rose-700">{k.jenis_display}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(k.status)}
                    </td>
                    <td className="px-6 py-4">
                      {k.resolusi_display ? (
                        <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                          {k.resolusi_display}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedKomplain(k);
                          setResolusiForm({
                            resolusi: k.resolusi || '',
                            catatan_resolusi: k.catatan_resolusi || '',
                            status: k.status === 'masuk' ? 'diproses' : k.status === 'selesai' ? 'selesai' : 'selesai'
                          });
                        }}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail & Resolusi */}
      {selectedKomplain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <MessageCircle size={20} className="text-rose-500" />
                Detail Komplain
              </h2>
              <button onClick={() => setSelectedKomplain(null)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm border border-slate-200">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Pelanggan & Masalah */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between min-h-[110px]">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Pelanggan</p>
                    <p className="font-black text-slate-800 leading-snug">{selectedKomplain.order_nama}</p>
                    <p className="text-xs font-mono text-slate-500 mt-1">{selectedKomplain.order_nomor_wa}</p>
                  </div>
                  <div className="mt-2.5">
                    <span className="px-2 py-0.5 bg-white rounded border border-slate-200 text-[11px] font-black text-slate-700 font-mono">
                      Order #{selectedKomplain.order}
                    </span>
                  </div>
                </div>
                <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                  <p className="text-[10px] uppercase font-bold text-rose-400 mb-1">Jenis Komplain</p>
                  <p className="font-black text-rose-700">{selectedKomplain.jenis_display}</p>
                  <p className="text-xs font-bold mt-1">{getStatusBadge(selectedKomplain.status)}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">Deskripsi Pelanggan</p>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  {selectedKomplain.deskripsi}
                </p>
                {selectedKomplain.foto_bukti && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <a href={selectedKomplain.foto_bukti} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors">
                      <ExternalLink size={14} /> Lihat Foto/Bukti Lampiran
                    </a>
                  </div>
                )}
              </div>

              {/* Form Resolusi (Hanya Manager/Owner yang bisa aksi) */}
              {isManager && selectedKomplain.status !== 'selesai' && selectedKomplain.status !== 'ditolak' && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
                  <h3 className="text-sm font-black text-indigo-900 mb-4 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-indigo-600" />
                    Penanganan & Resolusi (Manager Only)
                  </h3>
                  <form id="resolve-form" onSubmit={handleResolve} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Keputusan Resolusi *</label>
                      <select 
                        value={resolusiForm.resolusi}
                        onChange={e => setResolusiForm({...resolusiForm, resolusi: e.target.value})}
                        required
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      >
                        <option value="">-- Pilih Resolusi --</option>
                        <option value="cetak_ulang_gratis">Cetak Ulang Gratis (Garansi Toko)</option>
                        <option value="cetak_ulang_bayar">Cetak Ulang (Customer Bayar)</option>
                        <option value="diskon_kompensasi">Berikan Diskon / Kompensasi</option>
                        <option value="ditolak">Tolak Komplain (Tidak Valid)</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Catatan Penanganan</label>
                      <textarea
                        value={resolusiForm.catatan_resolusi}
                        onChange={e => setResolusiForm({...resolusiForm, catatan_resolusi: e.target.value})}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                        placeholder="Catatan internal manager terkait keputusan di atas..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">Ubah Status Menjadi</label>
                      <select 
                        value={resolusiForm.status}
                        onChange={e => setResolusiForm({...resolusiForm, status: e.target.value})}
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      >
                        <option value="diproses">Sedang Diproses</option>
                        <option value="cetak_ulang">Dijadwalkan Cetak Ulang</option>
                        <option value="selesai">Selesai (Resolved)</option>
                        <option value="ditolak">Ditolak</option>
                      </select>
                    </div>
                  </form>
                </div>
              )}

              {/* View Resolusi jika sudah selesai */}
              {(selectedKomplain.status === 'selesai' || selectedKomplain.status === 'ditolak') && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                  <h3 className="text-sm font-black text-emerald-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    Komplain Telah Diselesaikan
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600/70 uppercase">Resolusi</p>
                      <p className="text-sm font-bold text-emerald-800 mt-0.5">{selectedKomplain.resolusi_display}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600/70 uppercase">Ditangani Oleh</p>
                      <p className="text-sm font-bold text-emerald-800 mt-0.5">{selectedKomplain.ditangani_oleh_nama}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-emerald-200/50">
                    <p className="text-[10px] font-bold text-emerald-600/70 uppercase">Catatan</p>
                    <p className="text-sm font-medium text-emerald-800 mt-0.5">{selectedKomplain.catatan_resolusi || '-'}</p>
                  </div>
                </div>
              )}

            </div>
            
            {/* Footer */}
            {isManager && selectedKomplain.status !== 'selesai' && selectedKomplain.status !== 'ditolak' && (
              <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedKomplain(null)}
                  className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  form="resolve-form"
                  disabled={isResolving}
                  className="px-6 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors text-sm shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={16} />
                  {isResolving ? 'Menyimpan...' : 'Simpan Resolusi'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
