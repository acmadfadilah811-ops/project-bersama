import { useState } from 'react';
import { X } from 'lucide-react';

export default function PenjualanDateModal({ isOpen, onClose, onApply, initialFrom, initialTo }) {
  const [selectedRange, setSelectedRange] = useState('30 Hari yang lalu');
  const [dateFrom, setDateFrom] = useState(initialFrom || '2026-06-26');
  const [dateTo, setDateTo] = useState(initialTo || '2026-07-26');

  if (!isOpen) return null;

  const quickRanges = [
    { label: 'Hari ini', getDates: () => ({ from: '2026-07-26', to: '2026-07-26' }) },
    { label: 'Kemarin', getDates: () => ({ from: '2026-07-25', to: '2026-07-25' }) },
    { label: '7 Hari yang lalu', getDates: () => ({ from: '2026-07-19', to: '2026-07-26' }) },
    { label: '30 Hari yang lalu', getDates: () => ({ from: '2026-06-26', to: '2026-07-26' }) },
    { label: 'Bulan ini', getDates: () => ({ from: '2026-07-01', to: '2026-07-31' }) },
    { label: 'Bulan lalu', getDates: () => ({ from: '2026-06-01', to: '2026-06-30' }) },
    { label: 'Sesuaikan', getDates: () => ({ from: dateFrom, to: dateTo }) },
  ];

  const handleRangeClick = (range) => {
    setSelectedRange(range.label);
    const dates = range.getDates();
    setDateFrom(dates.from);
    setDateTo(dates.to);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-80 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-xs font-bold text-slate-800">Filter Tanggal</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-650 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Ranges List */}
        <div className="p-2.5 flex flex-col space-y-0.5 border-b border-slate-100">
          {quickRanges.map((range) => {
            const isSelected = selectedRange === range.label;
            return (
              <button
                key={range.label}
                type="button"
                onClick={() => handleRangeClick(range)}
                className={`w-full text-center py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'text-[#0088E8] bg-[#E6F4FF]'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>

        {/* Inputs */}
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setSelectedRange('Sesuaikan');
                  setDateFrom(e.target.value);
                }}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg outline-none text-[11px] font-bold text-slate-700 bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setSelectedRange('Sesuaikan');
                  setDateTo(e.target.value);
                }}
                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg outline-none text-[11px] font-bold text-slate-700 bg-white"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setDateFrom('2026-06-26');
                setDateTo('2026-07-26');
                setSelectedRange('30 Hari yang lalu');
              }}
              className="px-4 py-1.5 bg-rose-50 text-rose-650 hover:bg-rose-100 rounded-lg font-bold transition-all cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => onApply({ from: dateFrom, to: dateTo, label: selectedRange })}
              className="px-5 py-1.5 bg-[#0088E8] text-white hover:bg-[#0077CC] rounded-lg font-bold transition-all cursor-pointer shadow-2xs"
            >
              Terapkan
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
