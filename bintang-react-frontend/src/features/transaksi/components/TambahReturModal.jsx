import { useState, useEffect } from 'react';
import { Calendar, Search } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

/**
 * Modal "Tambah Retur" (retur pembelian).
 * Retur hanya untuk PO yang sudah Diterima dan Lunas — daftar PO eligible diambil
 * dari server lalu dipilih. Simpan memanggil create-retur pada PO terpilih.
 */
export default function TambahReturModal({ onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [catatan, setCatatan] = useState('');
  const [query, setQuery] = useState('');
  const [eligible, setEligible] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/purchases/');
        const rows = res.data.results || res.data || [];
        setEligible(rows.filter((r) => !r.is_retur && r.receive_status === 'diterima' && r.payment_status === 'lunas'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = eligible.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${r.nomor} ${r.supplier || ''}`.toLowerCase().includes(q);
  });

  const canSave = !!selected;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Tambah Retur</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => onSave?.({ purchaseId: selected.id, tanggal, catatan })}
              className={`text-sm font-semibold rounded-lg px-5 py-2 transition-colors ${
                canSave
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Tanggal Retur</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Pilih Nota Pembelian (Diterima &amp; Lunas)</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nomor / supplier"
                className={`${inputClass} pl-8`}
              />
            </div>
            <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-50">
              {loading ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400">Memuat...</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400">Tidak ada pembelian yang bisa diretur.</div>
              ) : (
                filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-3 py-2.5 text-xs cursor-pointer flex items-center justify-between ${
                      selected?.id === r.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      <span className="font-mono font-bold text-slate-800 block">{r.nomor}</span>
                      <span className="text-slate-400">{r.supplier || 'Tanpa supplier'}</span>
                    </span>
                    <span className="font-mono font-bold text-slate-700">Rp {Number(r.total || 0).toLocaleString('id-ID')}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              rows={3}
              placeholder="Catatan"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
