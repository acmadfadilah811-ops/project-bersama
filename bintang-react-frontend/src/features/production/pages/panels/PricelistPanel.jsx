import { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';

export default function PricelistPanel({ items, refresh }) {
  const [search, setSearch] = useState('');

  const filteredItems = items.filter(
    (item) =>
      (item.nama_produk || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.kategori || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.material && item.material.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Daftar Harga Standar Layanan</h2>
          <p className="text-[11px] text-slate-400">
            Acuan harga bahan, cetak, dan finishing produksi iklan.
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
            placeholder="Cari nama layanan, material, atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-6 py-3">Nama Layanan / Produk</th>
              <th className="px-6 py-3">Kategori</th>
              <th className="px-6 py-3">Material Bahan</th>
              <th className="px-6 py-3">Tipe Tarif</th>
              <th className="px-6 py-3 text-right">Harga Satuan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                  Tidak ada data harga ditemukan
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5 font-bold text-slate-800">{item.nama_produk}</td>
                  <td className="px-6 py-3.5">
                    <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded uppercase">
                      {item.kategori}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-500">{item.material || '-'}</td>
                  <td className="px-6 py-3.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    {item.price_type || 'flat'}
                  </td>
                  <td className="px-6 py-3.5 text-right font-black text-slate-900">
                    Rp{(item.harga || 0).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
