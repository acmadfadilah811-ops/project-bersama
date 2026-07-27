import { useState, useMemo } from 'react';
import { Inbox, UserCheck, Ruler, Clipboard, AlertCircle, Cpu } from 'lucide-react';

export default function ClaimPool({ claimPool, onClaim, loading }) {
  const [selectedTahap, setSelectedTahap] = useState('');

  // Ekstrak nama tahap unik (mesin/stasiun kerja) dari antrean yang tersedia
  const uniqueTahap = useMemo(() => {
    return [...new Set(claimPool.map((job) => job.tahap_nama))].filter(Boolean);
  }, [claimPool]);

  // Saring antrean berdasarkan stasiun kerja / mesin yang dipilih oleh operator
  const filteredPool = useMemo(() => {
    return selectedTahap
      ? claimPool.filter((job) => job.tahap_nama === selectedTahap)
      : claimPool;
  }, [claimPool, selectedTahap]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold">Memuat antrean global divisi...</p>
      </div>
    );
  }

  if (claimPool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <Inbox size={24} />
        </div>
        <h3 className="text-sm font-bold text-slate-700">Antrean Bersih!</h3>
        <p className="text-xs text-slate-400 mt-1">
          Saat ini tidak ada pekerjaan unassigned untuk divisi Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-500" />
            Claim Pool (Antrean Stasiun Kerja / Mesin)
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pilih mesin yang Anda operasikan untuk memfilter antrean, lalu klaim tugas untuk mulai bekerja.
          </p>
        </div>
        <span className="bg-indigo-55 text-indigo-700 text-[10.5px] font-extrabold px-3 py-1 rounded-full border border-indigo-150 self-start sm:self-auto shrink-0 shadow-3xs">
          {claimPool.length} Total Antrean
        </span>
      </div>

      {/* FILTER BAR STASIUN KERJA / MESIN */}
      {uniqueTahap.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
          <button
            onClick={() => setSelectedTahap('')}
            className={`px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition-all cursor-pointer ${
              selectedTahap === ''
                ? 'bg-[#714B67] text-white border-[#714B67] shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Mesin ({claimPool.length})
          </button>
          {uniqueTahap.map((tahap) => {
            const count = claimPool.filter((j) => j.tahap_nama === tahap).length;
            return (
              <button
                key={tahap}
                onClick={() => setSelectedTahap(tahap)}
                className={`px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition-all cursor-pointer whitespace-nowrap ${
                  selectedTahap === tahap
                    ? 'bg-[#714B67] text-white border-[#714B67] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tahap} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grid Hasil Filter */}
      {filteredPool.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <Inbox className="w-8 h-8 text-slate-350 mb-2" />
          <p className="text-xs font-bold text-slate-500">Antrean Kosong</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Tidak ada antrean pekerjaan pada stasiun kerja ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPool.map((job) => {
            const item = job.order_item_detail || {};
            const formatUkuran =
              parseFloat(item.panjang) > 0 && parseFloat(item.lebar) > 0
                ? `${parseFloat(item.panjang)} x ${parseFloat(item.lebar)} m`
                : null;

            return (
              <div
                key={job.id}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-xl shadow-3xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] bg-slate-200 text-slate-700 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {job.tahap_nama}
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-800 mt-1">
                        {item.jenis_produk || 'Produk'}
                      </h3>
                    </div>
                    <span className="text-[10px] text-slate-450 font-semibold font-mono">
                      ID: #{job.id}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-2.5 flex-1">
                  {/* Size and Material */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                    {formatUkuran && (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded font-medium">
                        <Ruler size={12} className="text-slate-400" />
                        <strong>Ukuran:</strong> {formatUkuran}
                      </span>
                    )}
                    {item.bahan && (
                      <span className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded font-medium">
                        <Clipboard size={12} className="text-slate-400" />
                        <strong>Bahan:</strong> {item.bahan}
                      </span>
                    )}
                  </div>

                  {/* Instructions */}
                  {item.keterangan_detail && (
                    <div className="p-2.5 bg-amber-50/80 border border-amber-150 rounded-lg text-[10px] text-amber-800 leading-relaxed font-semibold">
                      <div className="flex items-center gap-1 mb-0.5 text-amber-900 font-bold">
                        <AlertCircle size={11} /> Catatan CS (Finishing):
                      </div>
                      {item.keterangan_detail}
                    </div>
                  )}

                  {/* Design Fee Info (Admin configures) */}
                  {job.biaya_desain > 0 && (
                    <div className="text-[10px] text-slate-500">
                      Biaya Desain:{' '}
                      <span className="font-bold text-slate-700">
                        Rp{job.biaya_desain.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Footer Action */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-450 font-bold">
                    Qty: <strong className="text-slate-750 text-xs">{item.qty || 1}</strong> Pcs
                  </span>

                  <button
                    onClick={() => onClaim(job.id)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer border-none"
                  >
                    <UserCheck size={14} />
                    Klaim Pekerjaan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
