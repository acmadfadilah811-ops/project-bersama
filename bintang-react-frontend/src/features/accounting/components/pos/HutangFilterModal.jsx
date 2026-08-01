import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function HutangFilterModal({ isOpen, onClose, onApply }) {
  const [dateType, setDateType] = useState('Satu hari'); // 'Satu hari' | 'Batas tanggal'
  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [amount, setAmount] = useState('0,00');
  const [dueFilter, setDueFilter] = useState('Semua Hutang'); // 'Jatuh Tempo' | 'Semua Hutang'
  const [dueDate, setDueDate] = useState(getTodayStr());
  const [sortColumn, setSortColumn] = useState('Tgl Transaksi');
  const [sortDirection, setSortDirection] = useState('Ascending');

  if (!isOpen) return null;

  const handleApply = () => {
    if (onApply) {
      onApply({
        dateType,
        filterDate,
        amount,
        dueFilter,
        dueDate: dueFilter === 'Jatuh Tempo' ? dueDate : null,
        sortColumn,
        sortDirection
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[480px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-150">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filter</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          
          {/* Tanggal */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Tanggal
            </label>
            <div className="flex items-center gap-2">
              <select
                value={dateType}
                onChange={(e) => setDateType(e.target.value)}
                className="w-1/3 px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
              >
                <option value="Satu hari">Satu hari</option>
                <option value="Batas tanggal">Batas tanggal</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
              />
            </div>
          </div>

          {/* Jumlah */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jumlah
            </label>
            <div className="flex border border-slate-205 rounded-lg overflow-hidden bg-white shadow-3xs">
              <span className="px-3 py-1.5 bg-slate-50 text-slate-400 font-bold border-r border-slate-205 select-none">
                IDR
              </span>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-3 py-1.5 outline-none text-xs font-semibold"
              />
            </div>
          </div>

          {/* Hutang */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Hutang
            </label>
            <div className="flex bg-slate-100 rounded-lg p-0.5 w-max border border-slate-200">
              {['Jatuh Tempo', 'Semua Hutang'].map((opt) => {
                const active = dueFilter === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDueFilter(opt)}
                    className={`px-4 py-1.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pengurutan */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Pengurutan
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={sortColumn}
                onChange={(e) => setSortColumn(e.target.value)}
                className="px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
              >
                {['Tgl Transaksi', 'No. Transaksi', 'Nama Supplier', 'Jumlah Hutang', 'Tanggal Bayar', 'Tenggat Waktu'].map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
                className="px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
              >
                <option value="Ascending">Ascending</option>
                <option value="Descending">Descending</option>
              </select>
            </div>
          </div>

          {/* Conditional Jatuh Tempo Pada */}
          {dueFilter === 'Jatuh Tempo' && (
            <div className="space-y-1 animate-fade-in">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Jatuh Tempo Pada
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
              />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-150 flex justify-center">
          <button
            type="button"
            onClick={handleApply}
            className="w-full py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg font-bold text-center cursor-pointer transition-colors shadow-3xs"
          >
            Filter
          </button>
        </div>

      </div>
    </div>
  );
}
