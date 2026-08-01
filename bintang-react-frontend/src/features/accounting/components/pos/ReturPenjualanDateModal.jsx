import { useState } from 'react';
import { X } from 'lucide-react';

export default function ReturPenjualanDateModal({ isOpen, onClose, onApply, initialFrom, initialTo }) {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];
  const [from, setFrom] = useState(initialFrom || todayString);
  const [to, setTo] = useState(initialTo || todayString);
  const [activePreset, setActivePreset] = useState('today');

  if (!isOpen) return null;

  const handleApplyPreset = (presetType) => {
    setActivePreset(presetType);
    const currentDate = new Date();
    let fromDate = new Date(currentDate);

    if (presetType === 'today') {
      // stay same
    } else if (presetType === 'yesterday') {
      fromDate.setDate(currentDate.getDate() - 1);
    } else if (presetType === '7_days') {
      fromDate.setDate(currentDate.getDate() - 7);
    } else if (presetType === '30_days') {
      fromDate.setDate(currentDate.getDate() - 30);
    } else if (presetType === 'this_month') {
      fromDate.setDate(1);
    } else if (presetType === 'last_month') {
      fromDate.setMonth(currentDate.getMonth() - 1);
      fromDate.setDate(1);
      // to date set to end of last month
      const lastDayLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
      setTo(lastDayLastMonth.toISOString().split('T')[0]);
      setFrom(fromDate.toISOString().split('T')[0]);
      return;
    }

    setFrom(fromDate.toISOString().split('T')[0]);
    setTo(currentDate.toISOString().split('T')[0]);
  };

  const handleReset = () => {
    setFrom(todayString);
    setTo(todayString);
    setActivePreset('today');
  };

  const handleApply = () => {
    let label = 'Custom';
    if (activePreset === 'today') label = 'Hari ini';
    else if (activePreset === 'yesterday') label = 'Kemarin';
    else if (activePreset === '7_days') label = '7 Hari yang lalu';
    else if (activePreset === '30_days') label = '30 Hari yang lalu';
    else if (activePreset === 'this_month') label = 'Bulan ini';
    else if (activePreset === 'last_month') label = 'Bulan lalu';

    onApply({ from, to, label });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-205 shadow-2xl w-[400px] overflow-hidden relative animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/20">
          <h3 className="text-sm font-bold text-slate-800">Filter</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Text Links presets with dividers */}
        <div className="flex flex-col text-center divide-y divide-slate-100">
          {[
            { id: 'today', label: 'Hari ini' },
            { id: 'yesterday', label: 'Kemarin' },
            { id: '7_days', label: '7 Hari yang lalu' },
            { id: '30_days', label: '30 Hari yang lalu' },
            { id: 'this_month', label: 'Bulan ini' },
            { id: 'last_month', label: 'Bulan lalu' },
            { id: 'custom', label: 'Sesuaikan' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleApplyPreset(item.id)}
              className={`w-full py-2.5 transition-colors font-bold text-xs cursor-pointer ${
                activePreset === item.id ? 'text-[#0088E8] bg-[#E6F4FF]/30' : 'text-[#0088E8] hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Date fields (Dari & Sampai) */}
        <div className="p-4 grid grid-cols-2 gap-3 border-t border-slate-100 bg-[#F8FAFC]/50">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold">Dari</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset('custom');
              }}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none bg-white font-medium text-xs text-slate-700"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold">Sampai</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset('custom');
              }}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md outline-none bg-white font-medium text-xs text-slate-700"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Terapkan
          </button>
        </div>

      </div>
    </div>
  );
}
