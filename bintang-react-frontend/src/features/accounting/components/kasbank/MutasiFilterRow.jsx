import { ChevronLeft, ChevronRight, ChevronDown, Calendar, Search } from 'lucide-react';

export default function MutasiFilterRow({
  currentDate,
  showMonthPicker,
  setShowMonthPicker,
  getMonthYearLabel,
  handlePrevMonth,
  handleNextMonth,
  setCurrentDate,
  selectedFilter,
  setSelectedFilter,
  showFilterDropdown,
  setShowFilterDropdown,
  filterOptions,
  searchQuery,
  setSearchQuery,
  handleExport,
  pdfRef,
  excelRef,
  filterRef,
}) {
  return (
    <div className="no-print bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between text-xs font-semibold text-slate-700">

      {/* Left Filters */}
      <div className="flex items-center gap-3.5 flex-wrap">
        
        {/* Date Picker Navigator (Screenshot 1) */}
        <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs relative">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-50 text-slate-505 transition-colors cursor-pointer border-r border-slate-200"
          >
            <ChevronLeft size={14} />
          </button>
          
          <div
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            className="px-5 py-1.5 text-xs font-bold text-slate-700 min-w-32 text-center select-none flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50"
          >
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span>{getMonthYearLabel(currentDate)}</span>
            <ChevronDown size={12} className="text-slate-405 shrink-0" />
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-50 text-slate-505 transition-colors cursor-pointer border-l border-slate-200"
          >
            <ChevronRight size={14} />
          </button>

          {/* 1-month calendar dropdown */}
          {showMonthPicker && (
            <div className="absolute top-full left-0 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-60 grid grid-cols-3 gap-1 animate-fade-in text-[10px]">
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

        {/* Pilih Filter Dropdown Selector (Screenshot 1) */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center justify-between w-40 px-3 py-1.5 border border-slate-205 bg-white text-slate-650 rounded-lg text-xs font-bold cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <span>{selectedFilter === 'Semua' ? 'Pilih Filter' : selectedFilter}</span>
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
                    if (opt === 'Semua') setSearchQuery('');
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

        {/* Search box input next to filter if a specific filter is chosen */}
        {selectedFilter !== 'Semua' && (
          <div className="relative w-48 animate-fade-in">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-405">
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
        )}
      </div>

      {/* Right Exports */}
      <div className="flex items-center gap-2">
        {/* PDF button */}
        <div ref={pdfRef} className="relative">
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-205 text-slate-655 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold"
          >
            <span>PDF</span>
          </button>
        </div>

        {/* Excel button */}
        <div ref={excelRef} className="relative">
          <button
            type="button"
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-205 text-slate-655 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold"
          >
            <span>Excel</span>
          </button>
        </div>
      </div>

    </div>
  );
}
