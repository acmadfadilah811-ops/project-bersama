import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search, Calendar, Check } from 'lucide-react';
import { notify } from '../../../utils/notify';

// Helper to format date to DD-MM-YYYY or DD MMM YY
const formatDateLabel = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[d.getMonth()];
  const year = d.getFullYear().toString().substring(2);
  return `${day} ${month} ${year}`;
};

export default function UangMukaPembelian() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dpStatus, setDpStatus] = useState('Digunakan Sebagian'); // 'Tidak Digunakan' | 'Digunakan Sebagian' | 'Digunakan'
  
  // Date Picker states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState('Custom Range'); // Predefined range label
  const [dateFrom, setDateFrom] = useState('2026-07-20');
  const [dateTo, setDateTo] = useState('2026-07-26');
  
  // Calendar month views
  const [leftMonth, setLeftMonth] = useState(6); // July (0-indexed)
  const [leftYear, setLeftYear] = useState(2026);
  const [rightMonth, setRightMonth] = useState(7); // August
  const [rightYear, setRightYear] = useState(2026);
  
  // Selection temp state for custom range calendar
  const [tempFrom, setTempFrom] = useState('2026-07-20');
  const [tempTo, setTempTo] = useState('2026-07-26');
  const [hoveredDate, setHoveredDate] = useState(null);

  // Limit page sizes
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  
  const datePickerRef = useRef(null);
  const pageSizeRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setIsDatePickerOpen(false);
      }
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Predefined ranges list
  const dateRanges = [
    { label: 'Today', getValue: () => ({ from: '2026-07-26', to: '2026-07-26' }) },
    { label: 'Yesterday', getValue: () => ({ from: '2026-07-25', to: '2026-07-25' }) },
    { label: 'Last 7 Days', getValue: () => ({ from: '2026-07-20', to: '2026-07-26' }) },
    { label: 'Last 30 Days', getValue: () => ({ from: '2026-06-27', to: '2026-07-26' }) },
    { label: 'This Month', getValue: () => ({ from: '2026-07-01', to: '2026-07-31' }) },
    { label: 'Last Month', getValue: () => ({ from: '2026-06-01', to: '2026-06-30' }) },
    { label: 'All Time', getValue: () => ({ from: '2020-01-01', to: '2026-07-26' }) },
    { label: 'Custom Range', getValue: () => null }
  ];

  const handleSelectPredefined = (range) => {
    setSelectedRange(range.label);
    const val = range.getValue();
    if (val) {
      setDateFrom(val.from);
      setDateTo(val.to);
      setTempFrom(val.from);
      setTempTo(val.to);
      setIsDatePickerOpen(false);
      notify({
        type: 'success',
        title: 'Rentang Disetel',
        message: `Rentang uang muka pembelian disaring: ${range.label}`
      });
    }
  };

  // Calendar render helpers
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handleDateClick = (dateStr) => {
    if (!tempFrom || (tempFrom && tempTo)) {
      setTempFrom(dateStr);
      setTempTo(null);
    } else {
      if (new Date(dateStr) < new Date(tempFrom)) {
        setTempFrom(dateStr);
      } else {
        setTempTo(dateStr);
      }
    }
  };

  const handleApplyCustom = () => {
    if (tempFrom && tempTo) {
      setDateFrom(tempFrom);
      setDateTo(tempTo);
      setIsDatePickerOpen(false);
      notify({
        type: 'success',
        title: 'Rentang Kustom Disetel',
        message: `Rentang disaring dari ${formatDateLabel(tempFrom)} s/d ${formatDateLabel(tempTo)}`
      });
    }
  };

  const renderCalendarGrid = (year, month) => {
    const totalDays = getDaysInMonth(year, month);
    const startDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    // Days grid
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelectedFrom = tempFrom === dateStr;
      const isSelectedTo = tempTo === dateStr;
      
      let inRange = false;
      if (tempFrom && tempTo) {
        const curr = new Date(dateStr);
        const from = new Date(tempFrom);
        const to = new Date(tempTo);
        inRange = curr >= from && curr <= to;
      } else if (tempFrom && hoveredDate) {
        const curr = new Date(dateStr);
        const from = new Date(tempFrom);
        const hover = new Date(hoveredDate);
        if (hover >= from) {
          inRange = curr >= from && curr <= hover;
        }
      }

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateClick(dateStr)}
          onMouseEnter={() => !tempTo && setHoveredDate(dateStr)}
          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all text-[11px] cursor-pointer ${
            isSelectedFrom || isSelectedTo
              ? 'bg-[#0088E8] text-white shadow-3xs scale-105'
              : inRange
                ? 'bg-[#E6F4FF] text-[#0088E8]'
                : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  const shiftMonths = (direction) => {
    if (direction === 'prev') {
      if (leftMonth === 0) {
        setLeftMonth(11);
        setLeftYear(leftYear - 1);
      } else {
        setLeftMonth(leftMonth - 1);
      }
      if (rightMonth === 0) {
        setRightMonth(11);
        setRightYear(rightYear - 1);
      } else {
        setRightMonth(rightMonth - 1);
      }
    } else {
      if (leftMonth === 11) {
        setLeftMonth(0);
        setLeftYear(leftYear + 1);
      } else {
        setLeftMonth(leftMonth + 1);
      }
      if (rightMonth === 11) {
        setRightMonth(0);
        setRightYear(rightYear + 1);
      } else {
        setRightMonth(rightMonth + 1);
      }
    }
  };

  const getMonthName = (monthIdx) => {
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return months[monthIdx];
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header card matching Olsera Backoffice layout */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-800">
          Uang Muka Pembelian
        </h3>
      </div>

      {/* Filter toolbar matching the screenshot */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[#F8FAFC]/50 p-2 border border-slate-100 rounded-xl select-none">
        
        {/* Left: Search box + 3 status options */}
        <div className="flex items-center gap-3 flex-wrap">
          
          {/* Search Input */}
          <div className="relative flex items-center bg-white rounded-lg shadow-3xs">
            <Search className="absolute left-3 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Transaksi/Pelanggan/Deskrip"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg outline-none hover:bg-slate-50 focus:bg-white text-xs font-semibold text-slate-750 w-52 transition-all"
            />
          </div>

          {/* Option filters (Tidak Digunakan, Digunakan Sebagian, Digunakan) */}
          <div className="flex items-center gap-1.5">
            {['Tidak Digunakan', 'Digunakan Sebagian', 'Digunakan'].map((status) => {
              const active = dpStatus === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setDpStatus(status)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 border rounded-lg transition-all cursor-pointer font-bold text-[11px] ${
                    active
                      ? 'border-[#0088E8] text-[#0088E8] bg-[#E6F4FF]/50 shadow-3xs'
                      : 'border-slate-205 text-slate-550 bg-white hover:bg-slate-50'
                  }`}
                >
                  {/* Circular bullet */}
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                    active ? 'border-[#0088E8] bg-[#E6F4FF]' : 'border-slate-350 bg-white'
                  }`}>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0088E8]" />}
                  </span>
                  <span>{status}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Date Picker Component */}
        <div className="flex items-center gap-1">
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={() => {
              const dFrom = new Date(dateFrom);
              const dTo = new Date(dateTo);
              const diffTime = Math.abs(dTo - dFrom) + (1000 * 60 * 60 * 24);
              const newFrom = new Date(dFrom.getTime() - diffTime).toISOString().split('T')[0];
              const newTo = new Date(dTo.getTime() - diffTime).toISOString().split('T')[0];
              setDateFrom(newFrom);
              setDateTo(newTo);
              setTempFrom(newFrom);
              setTempTo(newTo);
            }}
            className="p-2 border border-slate-205 bg-white hover:bg-slate-50 rounded-lg text-slate-450 hover:text-slate-700 transition-colors shadow-3xs cursor-pointer"
          >
            <ChevronLeft size={13} />
          </button>

          {/* Date Selector Button */}
          <div className="relative" ref={datePickerRef}>
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-205 bg-white hover:bg-slate-50 rounded-lg text-slate-700 transition-all shadow-3xs cursor-pointer font-bold"
            >
              <Calendar size={13} className="text-slate-400" />
              <span>{formatDateLabel(dateFrom)} - {formatDateLabel(dateTo)}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {/* Date Range Picker Popover Menu */}
            {isDatePickerOpen && (
              <div className="absolute right-0 mt-1.5 bg-white border border-slate-205 rounded-xl shadow-2xl z-[999] flex overflow-hidden animate-fade-in">
                
                {/* Left Predefined Options list */}
                <div className="w-40 border-r border-slate-150 bg-slate-50/50 py-2.5 flex flex-col font-bold">
                  {dateRanges.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => handleSelectPredefined(r)}
                      className={`px-4 py-2 text-left text-[11px] transition-colors cursor-pointer flex items-center justify-between ${
                        selectedRange === r.label
                          ? 'bg-[#E6F4FF] text-[#0088E8] font-black'
                          : 'text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      <span>{r.label}</span>
                      {selectedRange === r.label && <Check size={11} className="text-[#0088E8]" />}
                    </button>
                  ))}
                </div>

                {/* Right Dual Calendar View (Rendered when selectedRange is Custom Range) */}
                {selectedRange === 'Custom Range' && (
                  <div className="p-5 flex flex-col gap-4 bg-white animate-scale-up">
                    
                    {/* Navigation Bar */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => shiftMonths('prev')}
                        className="p-1 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ChevronLeft size={13} className="text-slate-500" />
                      </button>
                      <span className="font-extrabold text-slate-700 uppercase tracking-wide text-[10px]">
                        Pilih Rentang Tanggal
                      </span>
                      <button
                        type="button"
                        onClick={() => shiftMonths('next')}
                        className="p-1 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ChevronRight size={13} className="text-slate-500" />
                      </button>
                    </div>

                    {/* Side-by-Side Calendar grids */}
                    <div className="flex items-start gap-6">
                      
                      {/* Left Calendar (Starting Month) */}
                      <div className="space-y-3 w-56">
                        <div className="text-center font-black text-slate-800 text-xs">
                          {getMonthName(leftMonth)} {leftYear}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 select-none">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <div key={d} className="w-8">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {renderCalendarGrid(leftYear, leftMonth)}
                        </div>
                      </div>

                      {/* Divider line */}
                      <div className="w-[1px] self-stretch bg-slate-150" />

                      {/* Right Calendar (Ending Month) */}
                      <div className="space-y-3 w-56">
                        <div className="text-center font-black text-slate-800 text-xs">
                          {getMonthName(rightMonth)} {rightYear}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-slate-400 select-none">
                          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <div key={d} className="w-8">{d}</div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {renderCalendarGrid(rightYear, rightMonth)}
                        </div>
                      </div>

                    </div>

                    {/* Apply actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="text-[10px] text-slate-400 font-bold">
                        {tempFrom && formatDateLabel(tempFrom)} {tempTo && ` - ${formatDateLabel(tempTo)}`}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setTempFrom(dateFrom);
                            setTempTo(dateTo);
                            setIsDatePickerOpen(false);
                          }}
                          className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-[10px] cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={!tempFrom || !tempTo}
                          onClick={handleApplyCustom}
                          className="px-3.5 py-1.5 bg-[#0088E8] hover:bg-[#0077cc] text-white rounded-lg font-bold text-[10px] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Terapkan
                        </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Arrow Button */}
          <button
            type="button"
            onClick={() => {
              const dFrom = new Date(dateFrom);
              const dTo = new Date(dateTo);
              const diffTime = Math.abs(dTo - dFrom) + (1000 * 60 * 60 * 24);
              const newFrom = new Date(dFrom.getTime() + diffTime).toISOString().split('T')[0];
              const newTo = new Date(dTo.getTime() + diffTime).toISOString().split('T')[0];
              setDateFrom(newFrom);
              setDateTo(newTo);
              setTempFrom(newFrom);
              setTempTo(newTo);
            }}
            className="p-2 border border-slate-205 bg-white hover:bg-slate-50 rounded-lg text-slate-450 hover:text-slate-700 transition-colors shadow-3xs cursor-pointer"
          >
            <ChevronRight size={13} />
          </button>
        </div>

      </div>

      {/* Main Table Card showing "No Data" as in Screenshot */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4 min-h-[360px] relative select-none">
        
        <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                <th className="px-5 py-3.5 w-[20%]">Tanggal</th>
                <th className="px-5 py-3.5 w-[25%]">Transaksi</th>
                <th className="px-5 py-3.5 w-[30%]">Deskripsi | Pelanggan</th>
                <th className="px-5 py-3.5 w-[15%] text-right">Jumlah</th>
                <th className="px-5 py-3.5 w-[10%] text-center rounded-tr-lg">Dibuat oleh</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center text-slate-400 font-bold">
                  No Data
                </td>
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
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-3xs cursor-pointer"
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

    </div>
  );
}
