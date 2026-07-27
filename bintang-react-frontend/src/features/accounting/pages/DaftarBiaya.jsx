import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Filter, Search, X, FileText, FileSpreadsheet, ArrowLeft, ChevronDown } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function DaftarBiaya() {
  // Main Dataset matching Screenshot 1
  const initialExpenseAccounts = [
    { accountNo: '50000', accountName: 'Pembelian', classification: 'Harga Pokok Penjualan', balance: 0 },
    { accountNo: '50100', accountName: 'Pembelian antar cabang', classification: 'Harga Pokok Penjualan', balance: 0 },
    { accountNo: '50300', accountName: 'Biaya pengiriman', classification: 'Harga Pokok Penjualan', balance: 0 },
    { accountNo: '50400', accountName: 'Return pembelian', classification: 'Harga Pokok Penjualan', balance: 0 },
    { accountNo: '50500', accountName: 'Potongan pembelian', classification: 'Harga Pokok Penjualan', balance: 0 },
    { accountNo: '51000', accountName: 'Harga pokok penjualan', classification: 'Harga Pokok Penjualan', balance: 0 },
    { accountNo: '60100', accountName: 'Biaya gaji', classification: 'Pengeluaran', balance: 0 },
    { accountNo: '60200', accountName: 'Biaya air listrik telephone', classification: 'Pengeluaran', balance: 0 },
    { accountNo: '60300', accountName: 'Biaya perlengkapan', classification: 'Pengeluaran', balance: 0 },
    { accountNo: '60400', accountName: 'Biaya penyusutan', classification: 'Pengeluaran', balance: 0 },
    { accountNo: '60500', accountName: 'Biaya transfer', classification: 'Pengeluaran', balance: 0 },
    { accountNo: '80000', accountName: 'Pengeluaran lain lain', classification: 'Pengeluaran Lain', balance: 0 },
    { accountNo: '81000', accountName: 'Penyesuaian Barang', classification: 'Pengeluaran Lain', balance: 0 }
  ];

  // Selected Detail View State (Screenshot 3)
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState(null);

  // Month & Year Calendar State
  const [selectedMonth, setSelectedMonth] = useState(6); // 0-indexed (6 = July)
  const [selectedYear, setSelectedYear] = useState(2026);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const monthPickerRef = useRef(null);

  const monthsList = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const currentMonthYearDisplay = `${monthsList[selectedMonth]} ${selectedYear}`;

  // Filter Modal State (Screenshot 2)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [filterAmount, setFilterAmount] = useState('0,00');
  const [showOnlyNonZero, setShowOnlyNonZero] = useState(false);

  // Active filtered search state applied to table
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');

  // Detail view filters
  const [detailFilterOption, setDetailFilterOption] = useState('Pilih Filter');
  const [isDetailFilterOpen, setIsDetailFilterOpen] = useState(false);
  const detailFilterRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (detailFilterRef.current && !detailFilterRef.current.contains(event.target)) {
        setIsDetailFilterOpen(false);
      }
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setIsMonthPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyFilter = () => {
    setAppliedSearchQuery(filterSearchQuery);
    setIsFilterModalOpen(false);
    notify({
      type: 'info',
      title: 'Filter Diterapkan',
      message: 'Filter akun biaya berhasil diperbarui.'
    });
  };

  const handleExportPDF = () => {
    notify({
      type: 'success',
      title: 'Export PDF',
      message: 'Rincian akun biaya berhasil diexport ke PDF.'
    });
  };

  const handleExportExcel = () => {
    notify({
      type: 'success',
      title: 'Export Excel',
      message: 'Rincian akun biaya berhasil diexport ke Excel.'
    });
  };

  // Filtered accounts list
  const filteredAccounts = initialExpenseAccounts.filter((item) => {
    const matchesSearch =
      item.accountNo.toLowerCase().includes(appliedSearchQuery.toLowerCase()) ||
      item.accountName.toLowerCase().includes(appliedSearchQuery.toLowerCase()) ||
      item.classification.toLowerCase().includes(appliedSearchQuery.toLowerCase());
    
    const matchesNonZero = showOnlyNonZero ? item.balance !== 0 : true;

    return matchesSearch && matchesNonZero;
  });

  // Render Month/Year Calendar Popover Navigator
  const renderMonthPickerNavigator = () => (
    <div className="relative" ref={monthPickerRef}>
      <div className="flex items-center border border-slate-205 rounded-xl bg-white shadow-3xs overflow-hidden">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-2 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer border-r border-slate-150"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          type="button"
          onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer select-none"
        >
          <Calendar size={13} className="text-slate-400" />
          <span>{currentMonthYearDisplay}</span>
        </button>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-2 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer border-l border-slate-150"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Month/Year Popover Picker */}
      {isMonthPickerOpen && (
        <div className="absolute right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 z-[9999] w-72 text-center animate-fade-in font-bold">
          {/* Year selector header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 select-none">
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-slate-800">{selectedYear}</span>
            <button
              type="button"
              onClick={() => setSelectedYear((y) => y + 1)}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2 pt-3">
            {monthsList.map((mName, idx) => {
              const isSelected = selectedMonth === idx;
              return (
                <button
                  key={mName}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(idx);
                    setIsMonthPickerOpen(false);
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0088E8] text-white shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {mName.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ==========================================
  // RENDER 1: ACCOUNT DETAIL VIEW (Screenshot 3)
  // ==========================================
  if (selectedAccountForDetail) {
    return (
      <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
        
        {/* Detail Top Header Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
          
          {/* Account Title + Kembali Button */}
          <div className="flex items-center justify-between select-none border-b border-slate-100 pb-4">
            <h3 className="text-base font-bold text-slate-800 tracking-wide">
              {selectedAccountForDetail.accountNo} - {selectedAccountForDetail.accountName}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedAccountForDetail(null)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#E6F4FF] hover:bg-[#D4EDFF] text-[#0088E8] border border-[#BBE2FF] rounded-lg font-bold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Kembali</span>
            </button>
          </div>

          {/* Sub-toolbar: Date Month Navigator & Filter on Left, Export PDF & Excel on Right */}
          <div className="flex flex-wrap items-center justify-between gap-4 select-none">
            
            <div className="flex items-center gap-3">
              
              {/* Date Month Navigator */}
              {renderMonthPickerNavigator()}

              {/* Detail Filter Dropdown */}
              <div className="relative" ref={detailFilterRef}>
                <button
                  type="button"
                  onClick={() => setIsDetailFilterOpen(!isDetailFilterOpen)}
                  className="flex items-center justify-between gap-3 px-4 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer min-w-36 text-left"
                >
                  <span>{detailFilterOption}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                
                {isDetailFilterOpen && (
                  <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 w-52 font-bold animate-fade-in max-h-60 overflow-y-auto">
                    {[
                      'Semua',
                      'No. Transaksi',
                      'Tgl Transaksi',
                      'Nama Tipe Transaksi',
                      'Departemen',
                      'Pelanggan',
                      'Supplier',
                      'No. Dokumen',
                      'Deskripsi',
                      'Mata Uang'
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setDetailFilterOption(opt);
                          setIsDetailFilterOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-[11px] hover:bg-slate-50 cursor-pointer transition-colors ${
                          detailFilterOption === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50' : 'text-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Export Buttons on Right */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-3xs font-bold text-xs cursor-pointer transition-colors"
              >
                <FileText size={13} className="text-slate-500" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-3xs font-bold text-xs cursor-pointer transition-colors"
              >
                <FileSpreadsheet size={13} className="text-slate-500" />
                <span>Excel</span>
              </button>
            </div>

          </div>

          {/* Account Mutasi Detail Table Grid */}
          <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs min-h-[220px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                  <th className="px-5 py-3.5 w-[15%]">Tanggal</th>
                  <th className="px-5 py-3.5 w-[20%]">No. Dokumen</th>
                  <th className="px-5 py-3.5 w-[35%]">Deskripsi</th>
                  <th className="px-5 py-3.5 w-[15%] text-right">Debit (IDR)</th>
                  <th className="px-5 py-3.5 w-[15%] text-right">Kredit (IDR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-semibold select-none">
                    Tidak ada transaksi pada periode ini
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

      </div>
    );
  }

  // ==========================================
  // RENDER 2: MAIN LIST VIEW (Screenshot 1)
  // ==========================================
  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header Toolbar Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-5 flex flex-wrap items-center justify-between gap-4 select-none">
        
        {/* Left: Filter Button */}
        <button
          type="button"
          onClick={() => setIsFilterModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-3xs cursor-pointer transition-colors"
        >
          <Filter size={13} className="text-slate-500" />
          <span>Filter</span>
        </button>

        {/* Right: Date Month Selector Navigator */}
        {renderMonthPickerNavigator()}

      </div>

      {/* Expense Accounts Table Grid (Screenshot 1) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6">
        <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-6 py-4 w-[20%]">Nomor Akun ↕</th>
                <th className="px-6 py-4 w-[40%]">Nama Akun ↕</th>
                <th className="px-6 py-4 w-[25%]">Klasifikasi ↕</th>
                <th className="px-6 py-4 w-[15%] text-right">Saldo ↕</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-semibold select-none">
                    No Data
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((item) => (
                  <tr
                    key={item.accountNo}
                    onClick={() => setSelectedAccountForDetail(item)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 text-slate-700 font-semibold">{item.accountNo}</td>
                    <td className="px-6 py-4 text-slate-800 font-bold group-hover:text-[#0088E8] transition-colors">
                      {item.accountName}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{item.classification}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-[#0088E8] group-hover:underline">
                      {item.balance.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Modal (Screenshot 2) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[460px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-end px-6 py-3 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              
              {/* Field 1: Cari */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Cari
                </label>
                <div className="relative flex items-center bg-white border border-slate-205 rounded-xl px-3.5 py-2 shadow-3xs focus-within:border-[#0088E8] transition-all">
                  <Search size={13} className="text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Nomor Akun/Nama Akun"
                    value={filterSearchQuery}
                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-800 outline-none bg-transparent"
                  />
                </div>
              </div>

              {/* Field 2: Jumlah */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Jumlah
                </label>
                <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs focus-within:border-[#0088E8] transition-all">
                  <span className="px-4 py-2 bg-slate-50 text-slate-500 font-bold border-r border-slate-205 select-none text-xs flex items-center justify-center">
                    IDR
                  </span>
                  <input
                    type="text"
                    value={filterAmount}
                    onChange={(e) => setFilterAmount(e.target.value)}
                    className="flex-1 px-3.5 py-2 outline-none text-xs font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Field 3: Nilai akun bukan 0 / Semua Akun toggle */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-slate-600">Nilai akun bukan 0</span>
                <button
                  type="button"
                  onClick={() => setShowOnlyNonZero(!showOnlyNonZero)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    showOnlyNonZero ? 'bg-[#0088E8]' : 'bg-slate-250'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      showOnlyNonZero ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-slate-600">Semua Akun</span>
              </div>

              {/* Modal Footer Filter Button */}
              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleApplyFilter}
                  className="px-8 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-xl shadow-2xs text-xs cursor-pointer transition-colors"
                >
                  Filter
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
