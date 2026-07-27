import { X } from 'lucide-react';

export default function FilterKasBankModal({
  isOpen,
  onClose,
  filterSearch,
  setFilterSearch,
  filterAmount,
  setFilterAmount,
  filterNonZeroOnly,
  setFilterNonZeroOnly,
  onApply,
  onReset,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 relative flex flex-col">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <X size={16} />
        </button>

        <h3 className="text-sm font-bold text-slate-800 mb-4 text-center">Filter</h3>

        <div className="space-y-4 mb-6">
          {/* Cari */}
          <div className="space-y-1 text-left">
            <label className="block text-[10px] font-extrabold text-slate-500">Cari</label>
            <input
              type="text"
              placeholder="Nomor Akun/Nama Akun"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 focus:bg-white outline-none focus:border-[#0088E8] shadow-3xs"
            />
          </div>

          {/* Jumlah */}
          <div className="space-y-1 text-left">
            <label className="block text-[10px] font-extrabold text-slate-500">Jumlah</label>
            <div className="flex border border-slate-205 rounded-lg overflow-hidden shadow-3xs">
              <span className="bg-slate-100 text-slate-650 px-2.5 py-1 text-[10px] font-bold border-r border-slate-205 flex items-center">
                IDR
              </span>
              <input
                type="number"
                placeholder="0,00"
                value={filterAmount}
                onChange={(e) => setFilterAmount(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 focus:bg-white outline-none text-xs font-semibold text-right"
              />
            </div>
          </div>

          {/* Nilai akun bukan 0 (Toggle Switch) */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[10px] font-extrabold text-slate-500">Nilai akun bukan 0</span>
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterNonZeroOnly}
                  onChange={(e) => setFilterNonZeroOnly(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0088E8]"></div>
              </label>
              <span className="text-[10px] font-bold text-slate-605">Semua Akun</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            Filter
          </button>
        </div>
      </div>
    </div>
  );
}
