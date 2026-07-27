import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../api/apiClient';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  Save,
  TrendingUp,
  Loader2,
  BarChart2,
  RefreshCw,
  History,
  ChevronUp,
  Download,
} from 'lucide-react';

const KATEGORI_LIST = ['Tinta', 'Bahan Cetak', 'Finishing', 'Alat', 'Packaging', 'Lainnya'];

const DEFAULT_FORM = {
  nama: '',
  stok: '',
  satuan: '',
  kategori: 'Tinta',
  min_stok: '',
  cost_per_unit: '',
  supplier: '',
};

export default function Inventory() {
  const { user } = useAuth();
  const isManager = ['owner', 'manager'].includes(user?.role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKat, setFilterKat] = useState('');
  const [showKritis, setShowKritis] = useState(false);

  // Modals
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [historyItem, setHistoryItem] = useState(null); // accordion history
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Fetch Data ────────────────────────────────────────────
  const fetchItems = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await apiClient.get('/inventory/');
      setItems(res.data);
    } catch (err) {
      console.error('Gagal memuat inventori:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

    // Polling background setiap 10 detik agar stok sinkron real-time
    const intervalId = setInterval(() => {
      fetchItems(true); // Silent refresh
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  // ── Filter & Search (client-side) ─────────────────────────
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        item.nama.toLowerCase().includes(search.toLowerCase()) ||
        (item.supplier || '').toLowerCase().includes(search.toLowerCase());
      const matchKat = filterKat ? item.kategori === filterKat : true;
      const matchKritis = showKritis ? item.stok < item.min_stok : true;
      return matchSearch && matchKat && matchKritis;
    });
  }, [items, search, filterKat, showKritis]);
  // ── Summary Stats ─────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: items.length,
      kritis: items.filter((i) => i.stok < i.min_stok).length,
      nilaiTotal: items.reduce((s, i) => s + i.stok * i.cost_per_unit, 0),
    }),
    [items]
  );

  // ── Handlers ──────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = e.target;
    const payload = {
      nama: form.nama.value,
      stok: parseFloat(form.stok.value) || 0,
      satuan: form.satuan.value,
      kategori: form.kategori.value,
      min_stok: parseFloat(form.min_stok.value) || 0,
      cost_per_unit: parseFloat(form.cost_per_unit.value) || 0,
      supplier: form.supplier.value,
    };
    try {
      if (editItem) {
        await apiClient.patch(`/inventory/${editItem.id}/`, payload);
        setEditItem(null);
      } else {
        await apiClient.post('/inventory/', payload);
        setAddModal(false);
      }
      fetchItems();
    } catch (err) {
      alert('Gagal menyimpan: ' + JSON.stringify(err.response?.data || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    if (!deleteItem.id) {
      alert('Tidak bisa hapus: ID item tidak valid. Hapus lewat Django Admin.');
      setDeleteItem(null);
      return;
    }
    setSaving(true);
    try {
      await apiClient.delete(`/inventory/${deleteItem.id}/`);
      setDeleteItem(null);
      await fetchItems();
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      alert(`Gagal hapus [${status}]: ${detail}`);
      console.error('Delete error:', err.response || err);
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    if (!adjustItem) return;
    setSaving(true);
    try {
      await apiClient.post(`/inventory/${adjustItem.id}/restock/`, {
        delta: parseDelta(adjustDelta),
        keterangan: adjustNote,
      });
      setAdjustItem(null);
      setAdjustDelta('');
      setAdjustNote('');
      await fetchItems();
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      alert(`Gagal restock [${status}]: ${detail}`);
      console.error('Restock error:', err.response || err);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await apiClient.get('/export/inventory/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed', error);
      alert('Gagal mengekspor data.');
    } finally {
      setExporting(false);
    }
  };

  // Parsing delta — toleran terhadap koma sebagai pemisah desimal
  const parseDelta = (val) => {
    if (!val) return NaN;
    return parseFloat(String(val).replace(',', '.'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package size={22} className="text-indigo-500" /> Inventori Bahan
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Kelola stok material & bahan produksi</p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg shadow transition-all disabled:opacity-50"
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export'}
            </button>
          )}
          {isManager && (
            <button
              onClick={() => setAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-4 py-2 rounded-lg shadow transition-all"
            >
              <Plus size={16} /> Tambah Barang
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          icon={<Package size={20} className="text-indigo-500" />}
          label="Total Item"
          value={stats.total}
          bg="bg-indigo-50"
        />
        <SummaryCard
          icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Stok Kritis"
          value={stats.kritis}
          bg={stats.kritis > 0 ? 'bg-red-50' : 'bg-slate-50'}
          valueColor={stats.kritis > 0 ? 'text-red-600' : 'text-slate-800'}
        />
        <SummaryCard
          icon={<BarChart2 size={20} className="text-emerald-500" />}
          label="Nilai Total Stok"
          value={'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(stats.nilaiTotal))}
          bg="bg-emerald-50"
        />
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau supplier..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={filterKat}
          onChange={(e) => setFilterKat(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Semua Kategori</option>
          {KATEGORI_LIST.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowKritis(!showKritis)}
          className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border transition-all ${
            showKritis
              ? 'bg-red-100 text-red-700 border-red-300'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle size={14} /> {showKritis ? 'Semua Item' : 'Stok Kritis'}
        </button>
        <button
          onClick={fetchItems}
          className="p-2 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabel Inventori */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-800 text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Nama Barang</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-center">Stok</th>
                <th className="px-4 py-3 text-center">Min. Stok</th>
                <th className="px-4 py-3">Satuan</th>
                <th className="px-4 py-3 text-right">Harga/Unit</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 italic">
                    {showKritis ? 'Tidak ada stok kritis.' : 'Belum ada data inventori.'}
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isKritis = item.stok < item.min_stok;
                  const isIdInvalid = !item.id; // ID kosong = data lama, butuh fix di DB
                  return (
                    <Fragment key={item.id || item.nama}>
                      <tr
                        className={`hover:bg-slate-50 transition-colors ${
                          isIdInvalid
                            ? 'bg-orange-50/60 border-l-4 border-l-orange-400'
                            : isKritis
                              ? 'bg-red-50/60'
                              : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isKritis && (
                              <AlertTriangle size={13} className="text-red-500 shrink-0" />
                            )}
                            {isIdInvalid && (
                              <span className="text-[10px] bg-orange-200 text-orange-800 font-bold px-1.5 py-0.5 rounded shrink-0">
                                ⚠ ID KOSONG
                              </span>
                            )}
                            <span
                              className={`font-semibold ${
                                isIdInvalid
                                  ? 'text-orange-700'
                                  : isKritis
                                    ? 'text-red-700'
                                    : 'text-slate-900'
                              }`}
                            >
                              {item.nama}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">
                            {item.kategori}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`font-bold text-base ${isKritis ? 'text-red-600' : 'text-slate-800'}`}
                            >
                              {item.stok}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500">{item.min_stok}</td>
                        <td className="px-4 py-3 text-slate-600">{item.satuan}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-700">
                          Rp {new Intl.NumberFormat('id-ID').format(item.cost_per_unit)}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{item.supplier}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isIdInvalid ? (
                              <span className="text-[10px] text-orange-600 font-semibold px-2">
                                Hapus lewat Admin
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setAdjustItem(item);
                                    setAdjustDelta('');
                                    setAdjustNote('');
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  title="Restock"
                                >
                                  <TrendingUp size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    setHistoryItem(historyItem?.id === item.id ? null : item)
                                  }
                                  className={`p-1.5 rounded transition-colors ${
                                    historyItem?.id === item.id
                                      ? 'text-indigo-700 bg-indigo-100'
                                      : 'text-slate-500 hover:bg-slate-100'
                                  }`}
                                  title="Riwayat"
                                >
                                  {historyItem?.id === item.id ? (
                                    <ChevronUp size={14} />
                                  ) : (
                                    <History size={14} />
                                  )}
                                </button>
                                {isManager && (
                                  <>
                                    <button
                                      onClick={() => setEditItem(item)}
                                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteItem(item)}
                                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                      title="Hapus"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {historyItem?.id === item.id && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 p-4">
                            <div className="text-xs space-y-2">
                              <p className="font-bold text-slate-700">Riwayat Perubahan Stok</p>
                              {!item.history || item.history.length === 0 ? (
                                <p className="text-slate-400 italic">Belum ada riwayat.</p>
                              ) : (
                                <div className="space-y-1">
                                  {item.history.map((h) => (
                                    <div
                                      key={h.id}
                                      className="flex gap-4 p-2 bg-white rounded border border-slate-200 text-xs items-start"
                                    >
                                      <span className="font-mono text-slate-400 w-24 shrink-0">
                                        {new Date(h.waktu).toLocaleDateString()}
                                      </span>
                                      <span
                                        className={`font-bold w-16 shrink-0 ${h.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                      >
                                        {h.delta > 0 ? '+' : ''}
                                        {h.delta}
                                      </span>
                                      <span className="text-slate-600 flex-1 min-w-0 break-words">
                                        {h.keterangan || '-'}
                                      </span>
                                      <span className="text-slate-400 text-[10px] italic shrink-0">
                                        Oleh: {h.user_nama || 'Sistem'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──── MODAL TAMBAH ──── */}
      {addModal && (
        <ItemFormModal
          title="Tambah Barang Baru"
          defaultValues={DEFAULT_FORM}
          onClose={() => setAddModal(false)}
          onSubmit={handleSave}
          saving={saving}
          showIdField={false}
        />
      )}

      {/* ──── MODAL EDIT ──── */}
      {editItem && (
        <ItemFormModal
          title={`Edit: ${editItem.nama}`}
          defaultValues={editItem}
          onClose={() => setEditItem(null)}
          onSubmit={handleSave}
          saving={saving}
          showIdField={false}
        />
      )}

      {/* ──── MODAL RESTOCK ──── */}
      {adjustItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-emerald-700 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-sm">Restock Barang</h2>
                <p className="text-emerald-200 text-xs mt-0.5">
                  {adjustItem.nama} — Stok:{' '}
                  <strong>
                    {adjustItem.stok} {adjustItem.satuan}
                  </strong>
                </p>
              </div>
              <button onClick={() => setAdjustItem(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Perubahan Stok{' '}
                  <span className="text-slate-400 font-normal">(+ tambah, − kurangi)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((v) => String((parseFloat(v) || 0) - 1))}
                    className="px-3 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    step="0.1"
                    value={adjustDelta}
                    onChange={(e) => setAdjustDelta(e.target.value)}
                    placeholder="contoh: 10 atau -2"
                    required
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustDelta((v) => String((parseFloat(v) || 0) + 1))}
                    className="px-3 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition-colors"
                  >
                    +
                  </button>
                </div>
                {adjustDelta && (
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    Stok baru:{' '}
                    <strong className="text-slate-800">
                      {Math.max(0, adjustItem.stok + (parseFloat(adjustDelta) || 0))}{' '}
                      {adjustItem.satuan}
                    </strong>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan / Alasan
                </label>
                <textarea
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="contoh: Beli dari Toko ABC, dipakai untuk Order #ORD-001..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || !adjustDelta}
                  className="flex-1 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}{' '}
                  Simpan Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──── MODAL KONFIRMASI HAPUS ──── */}
      {deleteItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <Trash2 size={26} className="text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">Hapus Item?</h2>
              <p className="text-sm text-slate-500 mt-1">
                <strong>{deleteItem.nama}</strong> akan dihapus permanen dari inventori.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteItem(null)}
                className="flex-1 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────
function SummaryCard({ icon, label, value, bg, valueColor = 'text-slate-800' }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-3 border border-white shadow-sm`}>
      <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
      <div>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-lg font-extrabold ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Form Modal (Tambah & Edit) ────────────────────────────────
function ItemFormModal({ title, defaultValues, onClose, onSubmit, saving, showIdField }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-indigo-700 text-white px-5 py-4 flex justify-between items-center">
          <h2 className="font-bold text-sm">{title}</h2>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {showIdField && (
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">ID Barang *</label>
                <input
                  name="id"
                  defaultValue={defaultValues.id}
                  required
                  placeholder="contoh: INV-TINTA-01"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Barang *</label>
              <input
                name="nama"
                defaultValue={defaultValues.nama}
                required
                placeholder="Tinta Sublim Hitam"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Stok Saat Ini</label>
              <input
                name="stok"
                type="number"
                step="0.1"
                defaultValue={defaultValues.stok}
                required
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Satuan *</label>
              <input
                name="satuan"
                defaultValue={defaultValues.satuan}
                required
                placeholder="liter, kg, pcs, rol..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Min. Stok (Alert)
              </label>
              <input
                name="min_stok"
                type="number"
                step="0.1"
                defaultValue={defaultValues.min_stok}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kategori</label>
              <select
                name="kategori"
                defaultValue={defaultValues.kategori}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {KATEGORI_LIST.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga per Unit (Rp)
              </label>
              <input
                name="cost_per_unit"
                type="number"
                defaultValue={defaultValues.cost_per_unit}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
              <input
                name="supplier"
                defaultValue={defaultValues.supplier}
                placeholder="Nama supplier/toko"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
