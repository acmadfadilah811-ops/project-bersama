import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import NumericInput from '../../../components/NumericInput';

export default function FilterAkunModal({ isOpen, onClose, onFilter, initialFilters = {} }) {
  const [search, setSearch] = useState(initialFilters.search || '');
  const [saldo, setSaldo] = useState(initialFilters.saldo || '');
  const [excludeZero, setExcludeZero] = useState(initialFilters.excludeZero || false);

  useEffect(() => {
    if (isOpen) {
      setSearch(initialFilters.search || '');
      setSaldo(initialFilters.saldo || '');
      setExcludeZero(initialFilters.excludeZero || false);
    }
  }, [isOpen, initialFilters]);

  if (!isOpen) return null;

  const handleApply = () => {
    onFilter({ search, saldo, excludeZero });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 relative flex flex-col">
        {/* Header dengan tombol X */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h3 className="text-sm font-bold text-slate-800">Filter</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 mb-6">
          {/* Cari */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500">Cari</label>
            <input
              type="text"
              placeholder="Nomor Akun/Nama Akun"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:border-[#0088E8] focus:bg-white bg-slate-50 text-slate-800 outline-none"
            />
          </div>

          {/* Jumlah */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-500">Jumlah</label>
            <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 focus-within:bg-white focus-within:border-[#0088E8] overflow-hidden px-3 py-1.5">
              <span className="text-xs font-bold text-slate-400 mr-2">IDR</span>
              <NumericInput
                value={saldo}
                onChange={(val) => setSaldo(val)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none border-none p-0 focus:ring-0 text-left"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600">Nilai akun bukan 0</span>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={excludeZero}
                onChange={(e) => setExcludeZero(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-[#0088E8]"></div>
            </label>
          </div>
        </div>

        {/* Tombol Filter */}
        <button
          type="button"
          onClick={handleApply}
          className="w-full py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
        >
          Filter
        </button>
      </div>
    </div>
  );
}
