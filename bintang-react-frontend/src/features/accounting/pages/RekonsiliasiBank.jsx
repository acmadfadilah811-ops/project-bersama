import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function RekonsiliasiBank() {
  const [selectedAccount, setSelectedAccount] = useState('11101 Kas');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Date Range States
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowAccountDropdown(false);
      if (dateRef.current && !dateRef.current.contains(e.target)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const accountOptions = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
  ];

  // Helper to format date label
  const formatDateLabel = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getActiveLabel = () => {
    if (dateFrom === dateTo) {
      if (dateFrom === '2026-07-26') return 'Hari ini';
      return formatDateLabel(dateFrom);
    }
    return `${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`;
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header title */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Rekonsiliasi Bank</h2>
      </div>

      {/* Filters row (Screenshot 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
        
        {/* Left Account Selector Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            className="flex items-center justify-between w-56 px-3 py-1.5 border border-slate-205 bg-white text-slate-650 rounded-lg text-xs font-bold cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <span>{selectedAccount}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          {showAccountDropdown && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-56 text-left text-xs font-bold animate-fade-in">
              {accountOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSelectedAccount(opt);
                    setShowAccountDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Date range picker */}
        <div ref={dateRef} className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-205 text-slate-650 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold text-xs"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>{getActiveLabel()}</span>
            <ChevronDown size={12} className="text-slate-450" />
          </button>
          {showDatePicker && (
            <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg p-3 w-64 text-left font-bold animate-fade-in space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tanggal Mulai</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tanggal Akhir</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('2026-07-26');
                    setDateTo('2026-07-26');
                    setShowDatePicker(false);
                  }}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-250 text-slate-600 rounded cursor-pointer"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1 text-[10px] bg-[#0088E8] text-white rounded cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Reconciliation Screen: Removed Bear Animation (Screenshot 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center min-h-[380px]">
        {/* Professional clean empty state layout */}
        <div className="text-center max-w-sm space-y-3.5">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
            <Calendar size={20} className="stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Data Masih Kosong</h3>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed">
              Tidak ada data transaksi rekonsiliasi yang ditemukan untuk akun {selectedAccount} pada periode {getActiveLabel()}.
            </p>
          </div>
          
          {/* Action to match or import */}
          <button
            type="button"
            onClick={() => notify({ type: 'info', title: 'Rekonsiliasi', message: 'Fitur rekonsiliasi sedang dalam sinkronisasi.' })}
            className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs inline-block"
          >
            Mulai Sinkronisasi
          </button>
        </div>
      </div>

    </div>
  );
}
