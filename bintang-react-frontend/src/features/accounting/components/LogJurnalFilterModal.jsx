import { Calendar, Search, X } from 'lucide-react';

export default function LogJurnalFilterModal({
  isOpen, onClose, onSubmit,
  tempSearchQuery, setTempSearchQuery,
  tempFilterDate, setTempFilterDate,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[440px] w-full p-6 flex flex-col gap-5 relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Filter</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Cari</label>
            <div className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                value={tempSearchQuery}
                onChange={(e) => setTempSearchQuery(e.target.value)}
                placeholder="No. Transaksi/Diproses Oleh"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#0088E8] transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">Tanggal</label>
            <div className="relative flex items-center">
              <Calendar size={14} className="absolute left-3 text-slate-400" />
              <input
                type="date"
                value={tempFilterDate}
                onChange={(e) => setTempFilterDate(e.target.value)}
                placeholder="Pilih hari"
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#0088E8] transition-all"
              />
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="submit"
              className="px-8 py-2 rounded-lg bg-[#0088E8] hover:bg-sky-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
            >
              Filter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
