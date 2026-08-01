import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

const toDateStr = (d) => d.toISOString().split('T')[0];
const getTodayStr = () => toDateStr(new Date());
const getDaysAgoStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toDateStr(d);
};
const getMonthStartStr = (monthsAgo = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo, 1);
  return toDateStr(d);
};
const getMonthEndStr = (monthsAgo = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo + 1, 0);
  return toDateStr(d);
};

export default function PiutangDateModal({ isOpen, onClose, onApply }) {
  const today = getTodayStr();
  const [fromDate, setFromDate] = useState(getDaysAgoStr(7));
  const [toDate, setToDate] = useState(today);
  const [activeLabel, setActiveLabel] = useState('7 Hari yang lalu');

  if (!isOpen) return null;

  const presets = [
    { label: 'Hari ini', from: today, to: today },
    { label: 'Kemarin', from: getDaysAgoStr(1), to: getDaysAgoStr(1) },
    { label: '7 Hari yang lalu', from: getDaysAgoStr(7), to: today },
    { label: '30 Hari yang lalu', from: getDaysAgoStr(30), to: today },
    { label: 'Bulan ini', from: getMonthStartStr(0), to: getMonthEndStr(0) },
    { label: 'Bulan lalu', from: getMonthStartStr(1), to: getMonthEndStr(1) },
    { label: 'Sesuaikan', from: getDaysAgoStr(7), to: today }
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
    const year = new Date().getFullYear();
    onApply({
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: 'Semua Data'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-755">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-[420px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <span className="text-xs font-bold text-slate-800">Filter</span>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-md text-slate-450 hover:text-slate-700 transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Presets List */}
        <div className="p-4 flex flex-col items-center gap-3 border-b border-slate-100">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className={`w-full text-center py-1 text-xs font-bold transition-all cursor-pointer ${
                activeLabel === p.label
                  ? 'text-[#0088E8] font-extrabold scale-102'
                  : 'text-slate-600 hover:text-[#0088E8]'
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

        {/* Footer actions */}
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
