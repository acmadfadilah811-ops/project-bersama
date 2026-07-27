import { useState } from 'react';
import { Search, MessageCircle, RefreshCw } from 'lucide-react';

export default function CustomerPanel({ customers, refresh }) {
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      (c.nama || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.nomor_wa || '').includes(search)
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Database Konsumen / Pelanggan</h2>
          <p className="text-[11px] text-slate-400">
            Nama & kontak WhatsApp pelanggan. Data finansial (piutang/total belanja)
            hanya tersedia bagi manajemen.
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
            placeholder="Cari nama konsumen atau nomor WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Table List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-6 py-3">Nama Pelanggan</th>
              <th className="px-6 py-3">Nomor WhatsApp</th>
              <th className="px-6 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">
                  Tidak ada konsumen ditemukan
                </td>
              </tr>
            ) : (
              filteredCustomers.map((cust) => (
                <tr key={cust.nomor_wa} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5 font-bold text-slate-800">{cust.nama}</td>
                  <td className="px-6 py-3.5 font-mono text-slate-500">{cust.nomor_wa}</td>
                  <td className="px-6 py-3.5 text-right">
                    <a
                      href={`https://wa.me/${cust.nomor_wa.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-all cursor-pointer"
                    >
                      <MessageCircle size={12} />
                      WhatsApp
                    </a>
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
