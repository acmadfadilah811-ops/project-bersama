import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Upload, ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Plus } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function BankStatement() {
  const [selectedAccount, setSelectedAccount] = useState('Semua Data');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Period state
  const [periodMode, setPeriodMode] = useState('Bulan'); // 'Sesuaikan', 'Bulan', 'Tahun'
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // default July 2026
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Date range state for 'Sesuaikan'
  const [dateFrom, setDateFrom] = useState('2026-07-01');
  const [dateTo, setDateTo] = useState('2026-07-31');

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState('11102 Bank');
  const [importCurrency, setImportCurrency] = useState('IDR');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const accountOptions = [
    'Semua Data',
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
  ];

  const importAccounts = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
  ];

  // Dummy statement list
  const allStatements = [
    { id: 1, date: '2026-07-24', account: '11102 Bank', desc: 'Transfer POS Terminal BCA #77', amount: 1500000, type: 'Masuk', balance: 11500000, status: 'Sudah Rekonsiliasi' },
    { id: 2, date: '2026-07-24', account: '11101 Kas', desc: 'Penjualan Tunai Harian Kasir 1', amount: 850000, type: 'Masuk', balance: 5850000, status: 'Sudah Rekonsiliasi' },
    { id: 3, date: '2026-07-25', account: '11102 Bank', desc: 'Beban Biaya Listrik & Air Bulanan', amount: 350000, type: 'Keluar', balance: 11150000, status: 'Belum Rekonsiliasi' },
    { id: 4, date: '2026-07-26', account: '11103 Kas in register', desc: 'Penerimaan Uang Muka Pesanan #199', amount: 2000000, type: 'Masuk', balance: 2000000, status: 'Belum Rekonsiliasi' },
    { id: 5, date: '2026-07-27', account: '23500 PPN Keluaran', desc: 'PPN Penjualan Invoice #INV-12', amount: 120000, type: 'Masuk', balance: 4120000, status: 'Belum Rekonsiliasi' },
  ];

  const getMonthYearLabel = (dateObj) => {
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filter based on Account, Period Mode and Dates
  const filteredData = allStatements.filter((item) => {
    // 1. Account Filter
    if (selectedAccount !== 'Semua Data' && item.account !== selectedAccount) {
      return false;
    }

    // 2. Date/Period Filter
    const itemDate = new Date(item.date);
    if (periodMode === 'Bulan') {
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth()
      );
    } else if (periodMode === 'Tahun') {
      return itemDate.getFullYear() === currentDate.getFullYear();
    } else if (periodMode === 'Sesuaikan') {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return itemDate >= from && itemDate <= to;
    }

    return true;
  });

  // Drag drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0]);
      notify({
        type: 'success',
        title: 'File Diterima',
        message: `Berkas ${e.dataTransfer.files[0].name} siap diunggah.`
      });
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      notify({
        type: 'success',
        title: 'File Diterima',
        message: `Berkas ${e.target.files[0].name} siap diunggah.`
      });
    }
  };

  const triggerProcessImport = () => {
    if (!uploadedFile) {
      notify({
        type: 'warning',
        title: 'Unggah Gagal',
        message: 'Silakan pilih atau jatuhkan file template terlebih dahulu.'
      });
      return;
    }

    notify({
      type: 'success',
      title: 'Import Diproses',
      message: `Berhasil mengimpor data rekening koran (Bank Statement) untuk akun ${importAccount}.`
    });

    setIsImportOpen(false);
    setUploadedFile(null);
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Upper header */}
      <div className="flex flex-wrap gap-4 items-center justify-between pb-1">
        <h2 className="text-base font-bold text-slate-900">Bank Statement</h2>
      </div>

      {/* Filter Row exactly matches layout (Screenshot 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
        
        {/* Left - Account Selector Dropdown */}
        <div className="flex items-center gap-3.5 flex-wrap">
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
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-56 text-left text-xs font-bold animate-fade-in max-h-60 overflow-y-auto">
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
        </div>

        {/* Center / Right - Unified Stacking Period & Date selector (Screenshot 1) */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex flex-col items-center border border-slate-200 rounded-lg bg-white shadow-2xs overflow-visible">
            {/* Top navigator row */}
            {periodMode === 'Bulan' && (
              <div className="flex items-center border-b border-slate-100 w-full relative">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-50 text-slate-505 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={13} />
                </button>
                <div
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  className="flex-1 px-4 py-1 text-xs font-bold text-slate-700 text-center select-none flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 min-w-28"
                >
                  <Calendar size={12} className="text-slate-400 shrink-0" />
                  <span>{getMonthYearLabel(currentDate)}</span>
                  <ChevronDown size={11} className="text-slate-450 shrink-0" />
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-50 text-slate-550 transition-colors cursor-pointer"
                >
                  <ChevronRight size={13} />
                </button>

                {/* 1-month calendar dropdown */}
                {showMonthPicker && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-56 grid grid-cols-3 gap-1 animate-fade-in text-[10px]">
                    <div className="col-span-3 flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronLeft size={11} />
                      </button>
                      <span className="text-xs font-bold text-slate-700">{currentDate.getFullYear()}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-505 cursor-pointer"
                      >
                        <ChevronRight size={11} />
                      </button>
                    </div>

                    {Array.from({ length: 12 }, (_, i) => {
                      const mName = new Date(2026, i, 1).toLocaleDateString('id-ID', { month: 'short' });
                      const isSelected = currentDate.getMonth() === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentDate(new Date(currentDate.getFullYear(), i, 1));
                            setShowMonthPicker(false);
                          }}
                          className={`py-1.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-[#0088E8] text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {mName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {periodMode === 'Tahun' && (
              <div className="flex items-center border-b border-slate-100 w-full py-1 px-4 font-bold text-slate-700 justify-center gap-1 select-none min-h-[29px]">
                <Calendar size={12} className="text-slate-400" />
                <span>Tahun {currentDate.getFullYear()}</span>
              </div>
            )}

            {periodMode === 'Sesuaikan' && (
              <div className="flex items-center border-b border-slate-100 w-full py-1 px-2 gap-1 justify-center min-h-[29px]">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-1 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-slate-700 bg-white"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-1 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-slate-700 bg-white"
                />
              </div>
            )}

            {/* Bottom segmented controls row */}
            <div className="flex items-center bg-slate-50/50 p-0.5 w-full rounded-b-lg border-t border-slate-100">
              {['Sesuaikan', 'Bulan', 'Tahun'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPeriodMode(mode)}
                  className={`flex-1 text-center py-1 px-3.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    periodMode === mode
                      ? 'bg-[#0088E8] text-white shadow-2xs'
                      : 'text-slate-505 hover:text-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Import Button (Screenshot 1) */}
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="px-4 py-1.5 border border-slate-205 text-slate-650 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5 ml-2"
          >
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Bank Statement Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-bold text-xs bg-slate-50/10">
            No Data
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 w-10">#</th>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Nama Akun</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3 text-right">Jumlah Mutasi</th>
                  <th className="px-5 py-3 text-center">Tipe</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {filteredData.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                    <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-3 text-slate-550">
                      {new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 font-bold text-slate-800">{row.account}</td>
                    <td className="px-5 py-3">{row.desc}</td>
                    <td className={`px-5 py-3 text-right font-bold ${row.type === 'Masuk' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {row.type === 'Masuk' ? '+' : '-'}{formatIDR(row.amount)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.type === 'Masuk' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-800">{formatIDR(row.balance)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'Sudah Rekonsiliasi' ? 'bg-slate-100 text-slate-650' : 'bg-[#FFF9E6] text-[#D9A300]'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => notify({ type: 'info', title: 'Aksi', message: 'Tindakan bank statement' })}
                        className="text-[#0088E8] hover:underline"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal exactly matching Screenshot 2 */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 w-[650px] text-left space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                Import Bank Statement
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsImportOpen(false);
                  setUploadedFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Config controls row (Download Template, Account Dropdown, Currency Dropdown) */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => notify({ type: 'success', title: 'Selesai', message: 'Mengunduh template CSV Bank Statement.' })}
                className="px-4 py-1.5 border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Download Template
              </button>

              {/* Account Dropdown next to IDR (Screenshot 2) */}
              <div className="relative flex-1 min-w-[180px]">
                <select
                  value={importAccount}
                  onChange={(e) => setImportAccount(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                >
                  {importAccounts.map((acc) => (
                    <option key={acc} value={acc}>
                      {acc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Currency Dropdown selector */}
              <div className="relative w-28">
                <select
                  value={importCurrency}
                  onChange={(e) => setImportCurrency(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                >
                  <option value="IDR">IDR</option>
                  <option value="USD">USD</option>
                  <option value="SGD">SGD</option>
                </select>
              </div>
            </div>

            {/* Drop Zone Box */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
                dragActive ? 'border-[#0088E8] bg-sky-50/20' : 'border-slate-200 bg-slate-50/20'
              }`}
            >
              <label className="flex flex-col items-center justify-center cursor-pointer space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Upload size={18} />
                </div>
                <div className="text-xs font-bold text-slate-700">
                  {uploadedFile ? (
                    <span className="text-[#0088E8] underline">{uploadedFile.name}</span>
                  ) : (
                    <>
                      Drop file here or <span className="text-[#0088E8] underline">click to upload</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-semibold">
                  Import dari CSV (max. 500 baris)
                </div>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsImportOpen(false);
                  setUploadedFile(null);
                }}
                className="px-4 py-1.5 border border-slate-200 bg-white text-slate-655 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={triggerProcessImport}
                disabled={!uploadedFile}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-2xs transition-colors ${
                  uploadedFile
                    ? 'bg-[#0088E8] hover:bg-[#0077CC] text-white'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                Memproses
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
