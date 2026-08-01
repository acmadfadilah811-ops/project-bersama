import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import dayjs from 'dayjs';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function PerubahanModalToolbar({
  dateMode, setDateMode, currentDate, setCurrentDate,
  isCalendarOpen, setIsCalendarOpen, pickerDecade, setPickerDecade,
  calendarRef, onPrevDate, onNextDate, onExportPdf,
}) {
  const dateDisplay = dateMode === 'Bulan'
    ? currentDate.format('MMMM YYYY')
    : currentDate.format('YYYY');
  const yearGrid = Array.from({ length: 12 }, (_, index) => pickerDecade + index);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2 relative" ref={calendarRef}>
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
          <button type="button" onClick={onPrevDate} className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
            <ChevronLeft size={14} />
          </button>
          <button type="button" onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[130px] justify-center select-none cursor-pointer hover:text-[#0088E8] transition-colors" title="Buka Kalender">
            <CalendarIcon size={13} className="text-slate-400 shrink-0" />
            <span>{dateDisplay}</span>
          </button>
          <button type="button" onClick={onNextDate} className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
          {['Bulan', 'Tahun'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setDateMode(mode);
                setIsCalendarOpen(false);
              }}
              className={`px-5 py-1.5 transition-all cursor-pointer border-r border-slate-300 last:border-r-0 ${
                dateMode === mode ? 'bg-[#3B82F6] text-white' : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {isCalendarOpen && (
          <div className="absolute top-full left-0 mt-2 z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-fade-in">
            {dateMode === 'Bulan' ? (
              <div className="w-64 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button type="button" onClick={() => setCurrentDate((prev) => prev.subtract(1, 'year'))} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-bold text-slate-800">{currentDate.format('YYYY')}</span>
                  <button type="button" onClick={() => setCurrentDate((prev) => prev.add(1, 'year'))} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTH_NAMES.map((month, index) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => {
                        setCurrentDate((prev) => prev.month(index));
                        setIsCalendarOpen(false);
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        currentDate.month() === index ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {month.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-64 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <button type="button" onClick={() => setPickerDecade((value) => value - 10)} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"><ChevronLeft size={16} /></button>
                  <span className="text-xs font-bold text-slate-800">{pickerDecade} - {pickerDecade + 11}</span>
                  <button type="button" onClick={() => setPickerDecade((value) => value + 10)} className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {yearGrid.map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        setCurrentDate(dayjs(`${year}-01-01`));
                        setIsCalendarOpen(false);
                      }}
                      className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentDate.format('YYYY') === String(year) ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <button type="button" onClick={onExportPdf} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs">
        <FileText size={13} className="text-slate-600" />
        <span>PDF</span>
      </button>
    </div>
  );
}
