import { ChevronLeft, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function RincianMutasiAkunFilterBar({
  dateMode, setDateMode,
  periodRef, showPeriodDropdown, setShowPeriodDropdown,
  currentDate, setCurrentDate, currentYear,
  customDateFrom, customDateTo,
  handlePrevPeriod, handleNextPeriod, getMonthYearLabel, formatDateLabel,
  showMonthPicker, setShowMonthPicker,
  filterRef, selectedFilter, setSelectedFilter, showFilterDropdown, setShowFilterDropdown, filterOptions,
  searchQuery, setSearchQuery,
  exportRef, showExportDropdown, setShowExportDropdown, handleExport,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between">

      {/* Left filter options */}
      <div className="flex items-center gap-3.5 flex-wrap">
        {/* Clickable Blue Period Badge dropdown (notif only applies here!) */}
        <div ref={periodRef} className="relative inline-block text-left">
          <button
            type="button"
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="px-3 py-1.5 rounded-lg bg-[#0088E8] text-white text-[10px] font-extrabold cursor-pointer hover:bg-[#0077CC] flex items-center gap-1 select-none shadow-2xs"
          >
            <span>{dateMode === 'Bulan' ? 'Periode Bulan' : dateMode === 'Tahun' ? 'Periode Tahun' : 'Periode Sesuaikan'}</span>
            <ChevronDown size={10} className="text-white opacity-80" />
          </button>
          {showPeriodDropdown && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-32 text-left text-xs font-bold animate-fade-in">
              {['Sesuaikan', 'Bulan', 'Tahun'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setDateMode(mode);
                    setShowPeriodDropdown(false);
                    // Trigger notice ONLY here in detailed view!
                    notify({
                      type: 'warning',
                      title: 'Peringatan',
                      message: 'Filter periode dan range tidak boleh terisi sekaligus, silakan gunakan salah satu saja.'
                    });
                  }}
                  className="w-full px-4 py-1.5 text-slate-700 hover:bg-slate-50 text-left cursor-pointer transition-colors"
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Caret separator (>>) */}
        <span className="text-slate-400 font-bold text-xs select-none">»</span>

        {/* Date range selection navigator */}
        <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs relative">
          <button
            type="button"
            onClick={handlePrevPeriod}
            disabled={dateMode === 'Sesuaikan'}
            className="p-1.5 hover:bg-slate-50 text-slate-500 disabled:text-slate-300 transition-colors cursor-pointer border-r border-slate-200"
          >
            <ChevronLeft size={14} />
          </button>

          {/* Click monthly label to trigger monthly picker overlay */}
          <div
            onClick={() => {
              if (dateMode === 'Bulan') setShowMonthPicker(!showMonthPicker);
            }}
            className="px-4 py-1.5 text-xs font-bold text-slate-700 min-w-32 text-center select-none cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-1"
          >
            {dateMode === 'Bulan' ? (
              <>
                <span>{getMonthYearLabel(currentDate)}</span>
                <ChevronDown size={12} className="text-slate-400 shrink-0" />
              </>
            ) : dateMode === 'Tahun' ? (
              <span>{currentYear}</span>
            ) : (
              <span>{formatDateLabel(customDateFrom)} - {formatDateLabel(customDateTo)}</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleNextPeriod}
            disabled={dateMode === 'Sesuaikan'}
            className="p-1.5 hover:bg-slate-50 text-slate-500 disabled:text-slate-300 transition-colors cursor-pointer border-l border-slate-200"
          >
            <ChevronRight size={14} />
          </button>

          {/* Month Picker Overlay */}
          {showMonthPicker && dateMode === 'Bulan' && (
            <div className="absolute top-full left-0 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 grid grid-cols-3 gap-1 animate-fade-in">
              <div className="col-span-3 flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
                  }}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                >
                  <ChevronLeft size={12} />
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
                  <ChevronRight size={12} />
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
                        : 'text-slate-650 hover:bg-slate-100'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pilih Filter Dropdown Selector (Screenshot 2) */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center justify-between w-40 px-3 py-1.5 border border-slate-205 bg-white text-slate-650 rounded-lg text-xs font-bold cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <span>{selectedFilter}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          {showFilterDropdown && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-40 text-left text-xs font-bold animate-fade-in max-h-[220px] overflow-y-auto">
              {filterOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    setSelectedFilter(opt);
                    setShowFilterDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search box input with glass icon */}
        <div className="relative w-48">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={12} />
          </span>
          <input
            type="text"
            placeholder="Cari..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold shadow-2xs"
          />
        </div>
      </div>

      {/* Right export options */}
      <div ref={exportRef} className="relative">
        <button
          type="button"
          onClick={() => setShowExportDropdown(!showExportDropdown)}
          className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-205 hover:bg-slate-50 text-slate-700 bg-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
        >
          <span>Export</span>
          <ChevronDown size={13} />
        </button>
        {showExportDropdown && (
          <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left text-xs font-bold animate-fade-in">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
            >
              Export Excel
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
