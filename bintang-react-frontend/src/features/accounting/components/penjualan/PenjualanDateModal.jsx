import { useState } from 'react';
import { X } from 'lucide-react';

export default function PenjualanDateModal({ isOpen, onClose, onApply, initialFrom, initialTo }) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDaysAgoStr = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };
  const getStartOfMonthStr = () => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  };
  const getEndOfMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  };
  const getStartOfLastMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1, 1);
    return d.toISOString().split('T')[0];
  };
  const getEndOfLastMonthStr = () => {
    const d = new Date();
    d.setDate(0);
    return d.toISOString().split('T')[0];
  };

  const defaultFrom = initialFrom || getDaysAgoStr(30);
  const defaultTo = initialTo || getTodayStr();

  const [selectedRange, setSelectedRange] = useState('30 Hari yang lalu');
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  if (!isOpen) return null;

  const quickRanges = [
    { label: 'Hari ini', getDates: () => ({ from: getTodayStr(), to: getTodayStr() }) },
    { label: 'Kemarin', getDates: () => ({ from: getDaysAgoStr(1), to: getDaysAgoStr(1) }) },
    { label: '7 Hari yang lalu', getDates: () => ({ from: getDaysAgoStr(7), to: getTodayStr() }) },
    { label: '30 Hari yang lalu', getDates: () => ({ from: getDaysAgoStr(30), to: getTodayStr() }) },
    { label: 'Bulan ini', getDates: () => ({ from: getStartOfMonthStr(), to: getEndOfMonthStr() }) },
    { label: 'Bulan lalu', getDates: () => ({ from: getStartOfLastMonthStr(), to: getEndOfLastMonthStr() }) },
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
                const f = getDaysAgoStr(30);
                const t = getTodayStr();
                setDateFrom(f);
                setDateTo(t);
                setSelectedRange('30 Hari yang lalu');
              }}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                if (onApply) {
                  onApply({ from: dateFrom, to: dateTo, label: selectedRange });
                }
              }}
              className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
