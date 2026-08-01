import { X } from 'lucide-react';

const PRESET_OPTIONS = [
  'Hari ini',
  'Kemarin',
  '7 Hari yang lalu',
  '30 Hari yang lalu',
  'Bulan ini',
  'Bulan lalu',
  'Sesuaikan',
];

export default function LabaRugiFilterModal({
  isOpen, onClose,
  tempPreset, onSelectPreset,
  tempStartDate, setTempStartDate, setTempPresetToSesuaikan,
  tempEndDate, setTempEndDate,
  onReset, onApply,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[440px] w-full p-6 flex flex-col gap-5 relative">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Filter</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 py-1 border-y border-slate-100">
          {PRESET_OPTIONS.map((option) => {
            const isActive = tempPreset === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelectPreset(option)}
                className={`text-xs transition-colors cursor-pointer font-bold ${
                  isActive ? 'text-[#0088E8]' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500">Dari</label>
            <input
              type="date"
              value={tempStartDate}
              onChange={(e) => {
                setTempStartDate(e.target.value);
                setTempPresetToSesuaikan();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#0088E8] transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-500">Sampai</label>
            <input
              type="date"
              value={tempEndDate}
              onChange={(e) => {
                setTempEndDate(e.target.value);
                setTempPresetToSesuaikan();
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#0088E8] transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onReset}
            className="w-full py-2.5 rounded-lg bg-[#FF6B6B] hover:bg-rose-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className="w-full py-2.5 rounded-lg bg-[#0088E8] hover:bg-sky-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
