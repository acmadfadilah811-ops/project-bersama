import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Filter, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';
import RincianMutasiAkun from './RincianMutasiAkun';
import FilterAkunModal from '../components/FilterAkunModal';

export default function DaftarBiaya() {
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Detail drill-down (rincian mutasi akun) — akun yang sedang dilihat
  const [viewingAccountId, setViewingAccountId] = useState(null);

  // Month & Year Calendar State
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
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
  const periodString = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  const periodEndDate = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const periodFrom = `${periodString}-01`;
  const periodTo = `${periodString}-${String(periodEndDate).padStart(2, '0')}`;

  // Filter Modal State (Screenshot 2) — filter aktif yang dikirim ke API
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({ search: '', saldo: '', excludeZero: false });

  useEffect(() => {
    function handleClickOutside(event) {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target)) {
        setIsMonthPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadExpenseAccounts = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounting/accounts/', {
        params: {
          period: periodString,
          search: appliedFilters.search || undefined,
          saldo: appliedFilters.saldo || undefined,
          exclude_zero: appliedFilters.excludeZero ? 'true' : undefined,
        },
      });
      setExpenseAccounts((res.data || []).filter((acc) => acc.account_type === 'expense'));
    } catch (error) {
      setExpenseAccounts([]);
      notifyApiError(error, 'Data akun biaya tidak dapat dimuat dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!viewingAccountId) loadExpenseAccounts();
  }, [periodString, appliedFilters, viewingAccountId]);

  const handleApplyFilter = (filters) => {
    setAppliedFilters(filters);
    notify({
      type: 'info',
      title: 'Filter Diterapkan',
      message: 'Filter akun biaya berhasil diperbarui.'
    });
  };

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
  // RENDER 1: RINCIAN MUTASI AKUN (drill-down akun asli)
  // ==========================================
  if (viewingAccountId) {
    return (
      <RincianMutasiAkun
        accountId={viewingAccountId}
        onBack={() => setViewingAccountId(null)}
        accounts={expenseAccounts}
        setViewingAccountId={setViewingAccountId}
        initialDateFrom={periodFrom}
        initialDateTo={periodTo}
      />
    );
  }

  // ==========================================
  // RENDER 2: MAIN LIST VIEW (Screenshot 1)
  // ==========================================
  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">

      {/* Header Toolbar Card */}
      <div className="bg-white rounded-2xl shadow-xs p-5 flex flex-wrap items-center justify-between gap-4 select-none">

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
      <div className="bg-white rounded-2xl shadow-xs p-6">
        <div className="rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-6 py-4 w-[20%]">Nomor Akun</th>
                <th className="px-6 py-4 w-[40%]">Nama Akun</th>
                <th className="px-6 py-4 w-[25%]">Klasifikasi</th>
                <th className="px-6 py-4 w-[15%] text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                    <Loader2 className="mx-auto animate-spin" size={22} />
                  </td>
                </tr>
              ) : expenseAccounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-semibold select-none">
                    No Data
                  </td>
                </tr>
              ) : (
                expenseAccounts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-700 font-semibold">{item.code}</td>
                    <td className="px-6 py-4 text-slate-800 font-bold">{item.name}</td>
                    <td className="px-6 py-4 text-slate-600 font-medium">{item.klasifikasi || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setViewingAccountId(item.id)}
                        className="font-mono font-bold text-[#0088E8] hover:underline cursor-pointer"
                      >
                        {(Number(item.saldo) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Modal (Screenshot 2) — komponen yang sudah dipakai DaftarAkun.jsx */}
      <FilterAkunModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onFilter={handleApplyFilter}
        initialFilters={appliedFilters}
      />

    </div>
  );
}
