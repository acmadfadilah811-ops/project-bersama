import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

export default function HutangDateModal({ isOpen, onClose, onApply }) {
  const [fromDate, setFromDate] = useState('2026-07-26');
  const [toDate, setToDate] = useState('2026-07-26');
  const [activeLabel, setActiveLabel] = useState('Semua Data');

  if (!isOpen) return null;

  const presets = [
    { label: 'Hari ini', from: '2026-07-26', to: '2026-07-26' },
    { label: 'Kemarin', from: '2026-07-25', to: '2026-07-25' },
    { label: '7 Hari yang lalu', from: '2026-07-20', to: '2026-07-26' },
    { label: '30 Hari yang lalu', from: '2026-06-26', to: '2026-07-26' },
    { label: 'Bulan ini', from: '2026-07-01', to: '2026-07-31' },
    { label: 'Bulan lalu', from: '2026-06-01', to: '2026-06-30' },
    { label: 'Sesuaikan', from: '2026-07-26', to: '2026-07-26' }
  ];

  const handleSelectPreset = (p) => {
    setActiveLabel(p.label);
    setFromDate(p.from);
    setToDate(p.to);
  };

  const handleApply = () => {
    onApply({
      from: fromDate,
      to: toDate,
      label: activeLabel
    });
    onClose();
  };

  const handleAllData = () => {
    onApply({
      from: '2026-01-01',
      to: '2026-12-31',
      label: 'Semua Data'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-[420px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <span className="text-xs font-bold text-slate-800">Filter</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-md text-slate-450 hover:text-slate-700 transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Presets List matching Screenshot */}
        <div className="p-4 flex flex-col items-center gap-3 border-b border-slate-100 bg-white">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`w-full text-center py-1 text-xs font-bold transition-all cursor-pointer ${
                activeLabel === p.label
                  ? 'text-[#0088E8] font-extrabold scale-102'
                  : 'text-slate-500 hover:text-[#0088E8]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom Inputs */}
        <div className="p-4 space-y-3.5 bg-slate-50/40">
          <div className="flex gap-4">
            {/* Dari */}
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Dari
              </label>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-3xs">
                <Calendar size={12} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setActiveLabel('Sesuaikan');
                  }}
                  className="w-full text-xs font-medium text-slate-700 outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Sampai */}
            <div className="flex-1 space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Sampai
              </label>
              <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-3xs">
                <Calendar size={12} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setActiveLabel('Sesuaikan');
                  }}
                  className="w-full text-xs font-medium text-slate-700 outline-none bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2 bg-[#F8FAFC]">
          <button
            type="button"
            onClick={handleAllData}
            className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors cursor-pointer text-center shadow-2xs"
          >
            Semua Data
          </button>
          
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg transition-colors cursor-pointer text-center shadow-2xs"
          >
            Terapkan
          </button>
        </div>

      </div>
    </div>
  );
}
