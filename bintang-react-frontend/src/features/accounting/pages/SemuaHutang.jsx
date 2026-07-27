import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Calendar, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import HutangFilterModal from '../components/pos/HutangFilterModal';
import HutangExportModal from '../components/pos/HutangExportModal';
import HutangDateModal from '../components/pos/HutangDateModal';
import TambahJurnalDropdown from '../components/pos/TambahJurnalDropdown';
import { notify } from '../../../utils/notify';

export default function SemuaHutang() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Belum Bayar'); // 'Belum Bayar' | 'Sebagian' | 'Lunas'
  
  // Modal states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // Date range states
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [dateLabel, setDateLabel] = useState('Semua');

  // Limit page size states
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyFilter = (filters) => {
    console.log('Applied filters:', filters);
    notify({
      type: 'success',
      title: 'Filter Diterapkan',
      message: 'Pencarian hutang disaring berdasarkan kriteria kustom.'
    });
  };

  const handleApplyDateModal = (res) => {
    setDateFrom(res.from);
    setDateTo(res.to);
    setDateLabel(res.label);
    notify({
      type: 'success',
      title: 'Rentang Tanggal Disetel',
      message: `Rentang hutang disaring berdasarkan rentang tanggal: ${res.label}`
    });
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700 select-none">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Semua Hutang</h2>
        
        <div className="flex items-center gap-2">
          {/* Tambah Jurnal Dropdown */}
          <TambahJurnalDropdown />

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[10px] uppercase cursor-pointer transition-colors"
          >
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar matching Screenshot 1 */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[#F8FAFC]/50 p-1.5 border border-slate-100 rounded-xl">
        
        {/* Left Side: Filter button + Search input + Status Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Advanced Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Filter size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          {/* Search box input */}
          <div className="relative flex items-center bg-white rounded-lg shadow-2xs">
            <Search className="absolute left-3 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Transaksi/Supplier/Deskripsi"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg outline-none hover:bg-slate-50/50 focus:bg-white text-xs font-semibold text-slate-700 w-52 transition-all"
            />
          </div>

          {/* Status Checkbox Pills with Large Blue Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {['Belum Bayar', 'Sebagian', 'Lunas'].map((pill) => {
              const active = statusFilter === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setStatusFilter(pill)}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg font-extrabold transition-all cursor-pointer text-[10px] uppercase tracking-wide ${
                    active
                      ? 'border-[#0088E8] text-[#0088E8] bg-[#E6F4FF]/45 shadow-3xs'
                      : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex items-center justify-center w-3.5 h-3.5 rounded-full border shrink-0 transition-all ${
                    active ? 'border-[#0088E8] bg-[#E6F4FF]' : 'border-slate-300 bg-white'
                  }`}>
                    {active && (
                      <span className="bg-[#0088E8] w-2 h-2 rounded-full" />
                    )}
                  </span>
                  <span>{pill}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Date Range button triggers HutangDateModal */}
        <div>
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold transition-all cursor-pointer"
          >
            <Filter size={11} className="text-slate-400" />
            <span>
              {dateLabel} {dateLabel !== 'Semua Data' && dateLabel !== 'Semua' && `${dateFrom.split('-').reverse().join('-')} - ${dateTo.split('-').reverse().join('-')}`}
            </span>
          </button>
        </div>

      </div>

      {/* Main Table Card showing "No Data" as in Screenshot */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4 min-h-[360px] relative">
        
        <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                <th className="px-5 py-3.5 w-[15%]">Tanggal</th>
                <th className="px-5 py-3.5 w-[25%]">Transaksi</th>
                <th className="px-5 py-3.5 w-[30%]">Supplier</th>
                <th className="px-5 py-3.5 w-[15%] text-right">Jumlah</th>
                <th className="px-5 py-3.5 w-[10%] text-center">Jatuh Tempo</th>
                <th className="px-5 py-3.5 w-[5%] text-center rounded-tr-lg">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {/* Row indicating no data */}
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-slate-400 font-bold">
                  No Data
                </td>
              </tr>
              {/* Total Summary Row below the table row */}
              <tr className="bg-slate-50/50 font-bold text-slate-800 text-[11px] border-t border-slate-150 select-none">
                <td className="px-5 py-3">Total</td>
                <td colSpan={2} />
                <td className="px-5 py-3 text-right">
                  <div className="text-[10px] text-rose-600 font-extrabold leading-normal">
                    Belum dibayar : 0
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="text-[10px] text-slate-500 font-extrabold leading-normal">
                    Dibayar : 0
                  </div>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Limit & Pagination Bar */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          
          {/* Page Limit Selector (Bottom Left) */}
          <div className="relative" ref={pageSizeRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-3xs cursor-pointer text-[11px]"
            >
              <span>{pageSize} item</span>
              <ChevronDown size={11} className="text-slate-350" />
            </button>
            {isPageSizeOpen && (
              <div className="absolute left-0 bottom-full mb-1.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-28 text-left animate-fade-in">
                {[15, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setIsPageSizeOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {size} item
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-4">
            <span>Total 0</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                &gt;
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none select-none"
              />
            </div>
          </div>

        </div>

      </div>

      {/* Modals Mounting */}
      <HutangFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilter}
      />

      <HutangExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      <HutangDateModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={handleApplyDateModal}
      />

    </div>
  );
}
