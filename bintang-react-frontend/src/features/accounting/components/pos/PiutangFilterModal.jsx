import { useState } from 'react';
import { X, Calendar } from 'lucide-react';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function PiutangFilterModal({ isOpen, onClose, onApply }) {
  const [dateMode, setDateMode] = useState('Satu hari'); // 'Satu hari' | 'Batas tanggal'
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [amountVal, setAmountVal] = useState('0');
  const [piutangMode, setPiutangMode] = useState('Semua Piutang'); // 'Jatuh Tempo' | 'Semua Piutang'
  const [dueDateVal, setDueDateVal] = useState(getTodayStr());
  const [sortColumn, setSortColumn] = useState('Tgl Transaksi');
  const [sortDirection, setSortDirection] = useState('Descending');

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({
      dateMode,
      selectedDate,
      amountVal,
      piutangMode,
      dueDateVal,
      sortColumn,
      sortDirection
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[520px] p-6 space-y-5 relative animate-scale-up">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>

        <div className="space-y-4 pt-4">
          
          {/* Row 1: Tanggal */}
          <div className="flex items-center gap-4">
            <span className="w-24 text-right text-slate-550 font-bold">Tanggal</span>
            <div className="flex-1 flex gap-2">
              <select
                value={dateMode}
                onChange={(e) => setDateMode(e.target.value)}
                className="w-1/3 px-2 py-1.5 border border-slate-205 rounded-md bg-white outline-none focus:border-[#0088E8] cursor-pointer"
              >
                <option value="Satu hari">Satu hari</option>
                <option value="Batas tanggal">Batas tanggal</option>
              </select>
              <div className="flex-1 relative flex items-center bg-white border border-slate-205 rounded-md overflow-hidden">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-1.5 outline-none text-xs font-medium text-slate-600 bg-transparent"
                />
              </div>
            </div>
          </div>

          {/* Row 2: Jumlah */}
          <div className="flex items-center gap-4">
            <span className="w-24 text-right text-slate-550 font-bold">Jumlah</span>
            <div className="flex-1 flex border border-slate-205 rounded-md overflow-hidden bg-white">
              <span className="px-3 py-1.5 bg-slate-50 text-slate-500 font-bold border-r border-slate-250 select-none">
                IDR
              </span>
              <input
                type="text"
                value={amountVal}
                onChange={(e) => setAmountVal(e.target.value)}
                className="flex-1 px-3 py-1.5 outline-none text-xs font-medium"
              />
            </div>
          </div>

          {/* Row 3: Piutang (Jatuh Tempo / Semua Piutang toggles) */}
          <div className="flex items-center gap-4">
            <span className="w-24 text-right text-slate-550 font-bold">Piutang</span>
            <div className="flex-1 flex gap-2">
              <button
                type="button"
                onClick={() => setPiutangMode('Jatuh Tempo')}
                className={`flex-1 py-1.5 font-bold border rounded-md transition-all text-center cursor-pointer ${
                  piutangMode === 'Jatuh Tempo'
                    ? 'bg-[#0088E8] text-white border-[#0088E8]'
                    : 'bg-white text-slate-600 border-slate-205 hover:bg-slate-50'
                }`}
              >
                Jatuh Tempo
              </button>
              <button
                type="button"
                onClick={() => setPiutangMode('Semua Piutang')}
                className={`flex-1 py-1.5 font-bold border rounded-md transition-all text-center cursor-pointer ${
                  piutangMode === 'Semua Piutang'
                    ? 'bg-[#0088E8] text-white border-[#0088E8]'
                    : 'bg-white text-slate-600 border-slate-205 hover:bg-slate-50'
                }`}
              >
                Semua Piutang
              </button>
            </div>
          </div>

          {/* Row 4: Pengurutan */}
          <div className="flex items-center gap-4">
            <span className="w-24 text-right text-slate-550 font-bold">Pengurutan</span>
            <div className="flex-1 flex gap-2">
              <select
                value={sortColumn}
                onChange={(e) => setSortColumn(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-slate-205 rounded-md bg-white outline-none focus:border-[#0088E8] cursor-pointer"
              >
                <option value="Tgl Transaksi">Tgl Transaksi</option>
                <option value="No. Transaksi">No. Transaksi</option>
                <option value="Nama Pelanggan">Nama Pelanggan</option>
                <option value="Jumlah Piutang">Jumlah Piutang</option>
                <option value="Tanggal Bayar">Tanggal Bayar</option>
                <option value="Tenggat Waktu">Tenggat Waktu</option>
              </select>
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
                className="flex-1 px-2.5 py-1.5 border border-slate-205 rounded-md bg-white outline-none focus:border-[#0088E8] cursor-pointer"
              >
                <option value="Ascending">Ascending</option>
                <option value="Descending">Descending</option>
              </select>
            </div>
          </div>

          {/* Conditional extra row: Jatuh tempo pada (Calendar) */}
          {piutangMode === 'Jatuh Tempo' && (
            <div className="flex items-center gap-4 animate-fade-in">
              <span className="w-24 text-right text-slate-550 font-bold text-[#E11D48]">
                Jatuh tempo pada
              </span>
              <div className="flex-1 relative flex items-center bg-white border border-slate-205 rounded-md overflow-hidden">
                <input
                  type="date"
                  value={dueDateVal}
                  onChange={(e) => setDueDateVal(e.target.value)}
                  className="w-full px-3 py-1.5 outline-none text-xs font-medium text-slate-600 bg-transparent"
                />
              </div>
            </div>
          )}

        </div>

        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleApply}
            className="px-10 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
          >
            Filter
          </button>
        </div>

      </div>
    </div>
  );
}
