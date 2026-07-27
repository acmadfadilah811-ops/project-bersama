import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { fmtDate } from '../format';
import PromoTipeDropdown from './PromoTipeDropdown';
import SalinDiskonButton from './SalinDiskonButton';

/** Daftar Promosi (POS) — toolbar filter + tabel. */
export default function PromosiPosList({ rows, loading, error, onAdd, onSelectRow, onRefresh }) {
  const [tipe, setTipe] = useState('Semua');
  const [judul, setJudul] = useState('Judul');
  const [cari, setCari] = useState('');

  const filtered = rows.filter((row) => {
    if (tipe !== 'Semua' && row.tipe_promosi !== tipe) return false;
    if (!cari.trim()) return true;
    const q = cari.trim().toLowerCase();
    if (judul === 'Judul') return row.judul.toLowerCase().includes(q);
    if (judul === 'Produk') return row.produk.toLowerCase().includes(q);
    if (judul === 'Grup Produk') return row.grup_produk.toLowerCase().includes(q);
    if (judul === 'Paket Produk') return row.paket_produk.toLowerCase().includes(q);
    if (judul === 'Brand') return row.brand.toLowerCase().includes(q);
    if (judul === 'Gratis Produk') return row.produk_gratis.toLowerCase().includes(q);
    return row.judul.toLowerCase().includes(q);
  });

  const tipeColors = {
    BX: 'bg-indigo-50 text-indigo-750 border border-indigo-200/40',
    DQ: 'bg-amber-50/60 text-amber-800 border border-amber-250/30',
    DA: 'bg-rose-50 text-rose-700 border border-rose-200/40',
    FI: 'bg-teal-50 text-teal-700 border border-teal-200/40',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-wrap items-center gap-3">
        <PromoTipeDropdown value={tipe} onChange={setTipe} />

        <div className="flex-1 min-w-[260px] flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
          <select value={judul} onChange={(e) => setJudul(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 px-3.5 py-2.5 outline-none cursor-pointer">
            <option>Judul</option>
            <option>Grup Produk</option>
            <option>Paket Produk</option>
            <option>Produk</option>
            <option>Brand</option>
            <option>Gratis Produk</option>
          </select>
          <div className="w-px h-6 bg-slate-200" />
          <div className="flex-1 flex items-center gap-2 px-3">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari"
              className="w-full text-xs font-semibold bg-transparent outline-none text-slate-750 placeholder-slate-400 py-2.5"
            />
          </div>
        </div>

        <SalinDiskonButton rows={rows} onCopied={onRefresh} />
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-705 shadow-md shadow-emerald-500/10 text-white rounded-xl px-4.5 py-2.5 text-xs font-bold cursor-pointer transition-all active:scale-[0.98]"
        >
          <Plus size={14} /> Tambah
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-rose-600 font-semibold">{error}</p>}

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-xl bg-slate-50/70 border border-slate-100/70 flex flex-col items-center justify-center py-16">
          <span className="text-xs font-bold text-slate-450">{loading ? 'Memuat...' : 'Belum ada promosi'}</span>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Judul', 'Tipe', 'Mulai', 'Kadaluarsa'].map((c) => (
                    <th key={c} className="px-4 py-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onSelectRow(row)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{row.judul}</td>
                    <td className="px-4 py-3.5 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${tipeColors[row.tipe_promosi] || 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                        {row.tipe_promosi}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{fmtDate(row.tanggal_aktif)}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{row.tanpa_kadaluarsa ? 'Tanpa Kadaluarsa' : fmtDate(row.tanggal_kadaluarsa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
