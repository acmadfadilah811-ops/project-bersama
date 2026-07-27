import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

export default function PembelianDateModal({ isOpen, onClose, initialFrom, initialTo, onApply }) {
  const [from, setFrom] = useState(initialFrom || '2026-06-26');
  const [to, setTo] = useState(initialTo || '2026-07-26');
  const [activePreset, setActivePreset] = useState('30_days');

  if (!isOpen) return null;

  const handleApplyPreset = (presetType) => {
    setActivePreset(presetType);
    const today = new Date('2026-07-26');
    let fromDate = new Date('2026-07-26');

    if (presetType === 'today') {
      // today
    } else if (presetType === 'yesterday') {
      fromDate.setDate(today.getDate() - 1);
    } else if (presetType === '7_days') {
      fromDate.setDate(today.getDate() - 7);
    } else if (presetType === '30_days') {
      fromDate.setDate(today.getDate() - 30);
    }

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];
    setFrom(fromStr);
    setTo(toStr);
  };

  const handleApply = () => {
    let label = 'Custom';
    if (activePreset === 'today') label = 'Hari ini';
    else if (activePreset === 'yesterday') label = 'Kemarin';
    else if (activePreset === '7_days') label = '7 Hari yang lalu';
    else if (activePreset === '30_days') label = '30 Hari yang lalu';

    onApply({ from, to, label });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-205 shadow-2xl w-[480px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Calendar size={14} className="text-[#0088E8]" />
            <span>Filter Tanggal Beli</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Preset Selector */}
        <div className="p-4 grid grid-cols-4 gap-2 border-b border-slate-50 bg-slate-50/20">
          {[
            { id: 'today', label: 'Hari ini' },
            { id: 'yesterday', label: 'Kemarin' },
            { id: '7_days', label: '7 Hari lalu' },
            { id: '30_days', label: '30 Hari lalu' }
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset.id)}
              className={`py-1.5 border rounded-lg transition-all font-bold cursor-pointer text-center ${
                activePreset === preset.id
                  ? 'border-[#0088E8] bg-[#E6F4FF] text-[#0088E8]'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Date Inputs */}
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-slate-600 font-bold">Mulai Dari</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset('custom');
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] transition-colors bg-white font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-600 font-bold">Sampai Dengan</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset('custom');
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] transition-colors bg-white font-medium"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Terapkan
          </button>
        </div>

      </div>
    </div>
  );
}
