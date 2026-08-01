import { Settings, ChevronLeft, ChevronRight, Filter, X, FileText, FileSpreadsheet } from 'lucide-react';

export default function LabaRugiToolbar({
  isSettingsOpen, setIsSettingsOpen,
  hideZeroAccounts, setHideZeroAccounts,
  dateMode, handleModeChange, handlePrevDate, handleNextDate,
  handleOpenFilterModal, getFilterButtonText,
  handleExportPdf, handleExportExcel,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
      {/* KIRI: GEAR SETTINGS BUTTON */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
          title="Pengaturan Laporan"
        >
          <Settings size={18} />
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

      {/* TENGAH: CONTROL KALENDER */}
      <div className="flex flex-col items-center gap-0 w-full sm:w-auto">
        <div className="flex items-center w-full justify-center">
          {dateMode !== 'Sesuaikan' && (
            <button
              type="button"
              onClick={handlePrevDate}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Sebelumnya"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenFilterModal}
            className="flex items-center justify-center gap-2 px-6 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs rounded-t-lg transition-all cursor-pointer select-none"
          >
            <Filter size={13} className="text-slate-700 fill-slate-700" />
            <span>{getFilterButtonText()}</span>
          </button>

          {dateMode !== 'Sesuaikan' && (
            <button
              type="button"
              onClick={handleNextDate}
              className="px-2 py-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Berikutnya"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center border border-slate-300 rounded-b-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
          <button
            type="button"
            onClick={() => handleModeChange('Sesuaikan')}
            className={`px-5 py-2 transition-all cursor-pointer border-r border-slate-300 ${
              dateMode === 'Sesuaikan' ? 'bg-[#3B82F6] text-white' : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
            }`}
          >
            Sesuaikan
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('Bulan')}
            className={`px-5 py-2 transition-all cursor-pointer border-r border-slate-300 ${
              dateMode === 'Bulan' ? 'bg-[#3B82F6] text-white' : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
            }`}
          >
            Bulan
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('Tahun')}
            className={`px-5 py-2 transition-all cursor-pointer ${
              dateMode === 'Tahun' ? 'bg-[#3B82F6] text-white' : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
            }`}
          >
            Tahun
          </button>
        </div>
      </div>

      {/* KANAN: TOMBOL EXPORT PDF & EXCEL */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExportPdf}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <FileText size={14} className="text-slate-600" />
          <span>PDF</span>
        </button>
        <button
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <FileSpreadsheet size={14} className="text-slate-600" />
          <span>EXCEL</span>
        </button>
      </div>
    </div>
  );
}
