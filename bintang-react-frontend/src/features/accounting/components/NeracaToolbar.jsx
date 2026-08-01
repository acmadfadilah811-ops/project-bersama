import {
  Settings, ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  FileText, FileSpreadsheet, X, Columns, Rows,
} from 'lucide-react';
import dayjs from 'dayjs';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function NeracaToolbar({
  layoutMode, setLayoutMode,
  isSettingsOpen, setIsSettingsOpen,
  hideZeroAccounts, setHideZeroAccounts,
  dateMode, setDateMode,
  calendarRef, isCalendarOpen, setIsCalendarOpen,
  handlePrevDate, handleNextDate, getDateDisplay,
  currentDate, setCurrentDate,
  pickerDecade, setPickerDecade, yearGrid,
  handleExportPdf, handleExportExcel,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
      {/* KIRI: GEAR SETTINGS & LAYOUT TOGGLE */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
            title="Pengaturan Laporan"
          >
            <Settings size={17} />
          </button>

          {isSettingsOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800">Pengaturan Laporan</h4>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                >
                  <X size={14} />
                </button>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideZeroAccounts}
                  onChange={(e) => setHideZeroAccounts(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8] cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700">
                  Sembunyikan Akun Bernilai Nol
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
          <button
            type="button"
            onClick={() => setLayoutMode('side')}
            className={`px-3 py-1.5 transition-all cursor-pointer border-r border-slate-300 flex items-center gap-1 text-xs font-bold ${
              layoutMode === 'side' ? 'bg-[#0088E8] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Versi di samping"
          >
            <Columns size={14} />
            <span>||</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('stacked')}
            className={`px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              layoutMode === 'stacked' ? 'bg-[#0088E8] text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
            title="Versi ke bawah"
          >
            <Rows size={14} />
            <span>=</span>
          </button>
        </div>
      </div>

      {/* TENGAH: KALENDER (HARIAN | BULAN | TAHUN) */}
      <div className="flex items-center gap-2 relative" ref={calendarRef}>
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={handlePrevDate}
            className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>

          <button
            type="button"
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[120px] justify-center select-none cursor-pointer hover:text-[#0088E8] transition-colors"
            title="Buka Kalender"
          >
            <CalendarIcon size={13} className="text-slate-400 shrink-0" />
            <span>{getDateDisplay()}</span>
          </button>

          <button
            type="button"
            onClick={handleNextDate}
            className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
          {['Harian', 'Bulan', 'Tahun'].map((m) => {
            const isActive = dateMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setDateMode(m);
                  setIsCalendarOpen(false);
                }}
                className={`px-3.5 py-1.5 transition-all cursor-pointer border-r border-slate-300 last:border-r-0 ${
                  isActive ? 'bg-[#3B82F6] text-white font-bold' : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
                }`}
              >
                {m}
              </button>
            );
          })}
        </div>

        {isCalendarOpen && (
          <div className="absolute top-full left-0 mt-2 z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-fade-in">
            {dateMode === 'Harian' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Pilih Tanggal Harian</span>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
                <input
                  type="date"
                  value={currentDate.format('YYYY-MM-DD')}
                  onChange={(e) => {
                    if (e.target.value) {
                      setCurrentDate(dayjs(e.target.value));
                      setIsCalendarOpen(false);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#0088E8]"
                />
              </div>
            )}

            {dateMode === 'Bulan' && (
              <div className="w-64 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentDate((prev) => prev.subtract(1, 'year'))}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-slate-800">{currentDate.format('YYYY')}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentDate((prev) => prev.add(1, 'year'))}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES.map((mName, idx) => {
                    const isCurrentMonth = currentDate.month() === idx;
                    return (
                      <button
                        key={mName}
                        type="button"
                        onClick={() => {
                          setCurrentDate((prev) => prev.month(idx));
                          setIsCalendarOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isCurrentMonth ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {mName.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {dateMode === 'Tahun' && (
              <div className="w-64 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setPickerDecade(pickerDecade - 10)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-slate-800">
                    {pickerDecade} - {pickerDecade + 11}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerDecade(pickerDecade + 10)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {yearGrid.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setCurrentDate(dayjs(`${yr}-01-01`));
                        setIsCalendarOpen(false);
                      }}
                      className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentDate.format('YYYY') === String(yr) ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* KANAN: EXPORT BUTTONS */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <FileText size={13} className="text-slate-600" />
          <span>PDF</span>
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <FileSpreadsheet size={13} className="text-slate-600" />
          <span>EXCEL</span>
        </button>
      </div>
    </div>
  );
}
