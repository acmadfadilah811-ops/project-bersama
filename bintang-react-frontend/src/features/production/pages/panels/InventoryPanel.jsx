import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

export default function InventoryPanel({ items, refresh }) {
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(
    (item) =>
      (item.nama || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.kategori || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Master Inventori & Stok Bahan</h2>
          <p className="text-[11px] text-slate-400">
            Pantau dan kelola stok bahan baku produksi iklan.
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <RefreshCw size={12} />
          Segarkan Data
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Cari nama bahan atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isKritis = item.stok < item.min_stok;
          return (
            <div
              key={item.id}
              className={`bg-white border rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all ${
                isKritis ? 'border-red-200 bg-red-50/10' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold px-1.5 py-0.5 rounded uppercase">
                    {item.kategori}
                  </span>

                  {isKritis ? (
                    <span className="flex items-center gap-0.5 text-[9px] font-black text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded-full border border-red-200">
                      <AlertTriangle size={10} />
                      Stok Rendah
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-600 uppercase bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle size={10} />
                      Aman
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-extrabold text-slate-800 mt-2">{item.nama}</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Supplier: {item.supplier || '-'}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Stok Aktif
                  </span>
                  <span className="text-base font-black text-slate-800">
                    {item.stok}{' '}
                    <span className="text-xs font-semibold text-slate-500">{item.satuan}</span>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block">
                    Batas Minimum
                  </span>
                  <span className="text-xs font-bold text-slate-600">
                    {item.min_stok} {item.satuan}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
