import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { exportRowsToXlsx } from '../../../../utils/exportXlsx';
import ExportRowRangeSelect from './ExportRowRangeSelect';
import ExportStatusButtons from './ExportStatusButtons';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function ExportPiutangModal({ isOpen, onClose, rows = [] }) {
  // File type: 'PDF' | 'EXCEL'
  const [fileType, setFileType] = useState('PDF');

  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Rows range dropdown
  const [rowRange, setRowRange] = useState('1 - 1000');

  // Date range type: 'Periode' | 'Batas Tanggal'
  const [dateType, setDateType] = useState('Periode');
  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());

  // Status: 'Belum Bayar' | 'Sebagian' | 'Lunas'
  const [status, setStatus] = useState('Belum Bayar');

  // Piutang Type: 'Jatuh Tempo' | 'Semua Piutang'
  const [piutangType, setPiutangType] = useState('Semua Piutang');
  const [dueDateAt, setDueDateAt] = useState(getTodayStr());

  // Checkbox detail
  const [showDetail, setShowDetail] = useState(false);

  if (!isOpen) return null;

  const handleExport = () => {
    const filteredRows = rows.filter((row) => row.status === status);
    if (fileType === 'EXCEL') {
      exportRowsToXlsx(
        'piutang.xlsx',
        ['Tanggal', 'No. Transaksi', 'Pelanggan', 'Deskripsi', 'Total', 'Sisa Tagihan', 'Status'],
        filteredRows.map((row) => [row.date, row.txNo, row.client, row.desc, row.amount, row.remaining, row.status]),
      );
    } else {
      window.print();
    }
    onClose();
  };

  const isLunas = status === 'Lunas';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[640px] max-h-[90vh] overflow-y-auto relative animate-scale-up">
        
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Title */}
        <div className="px-8 pt-8 pb-4 text-center">
          <h3 className="text-sm font-bold text-slate-800">Export Piutang</h3>
        </div>

        {/* Modal Form */}
        <div className="px-8 pb-8 space-y-5">
          
          {/* File Row */}
          <div className="flex items-center gap-6">
            <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
              File
            </label>
            <div className="flex-1 flex border border-slate-205 rounded-md overflow-hidden bg-white shadow-3xs p-0.5">
              <button
                type="button"
                onClick={() => setFileType('PDF')}
                className={`flex-1 py-1.5 text-center rounded-md font-bold transition-all cursor-pointer ${
                  fileType === 'PDF' ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => setFileType('EXCEL')}
                className={`flex-1 py-1.5 text-center rounded-md font-bold transition-all cursor-pointer ${
                  fileType === 'EXCEL' ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                EXCEL
              </button>
            </div>
          </div>

          {/* Conditional layout for status !== 'Lunas' */}
          {!isLunas && (
            <>
              {/* Cari */}
              <div className="flex items-center gap-6">
                <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
                  Cari
                </label>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Transaksi/Pelanggan/Deskripsi"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs text-xs font-semibold"
                  />
                  <div className="absolute left-2.5 top-2.5 text-slate-400 select-none">
                    🔍
                  </div>
                </div>
              </div>

              {/* Baris */}
              <div className="flex items-center gap-6">
                <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
                  Baris
                </label>
                <ExportRowRangeSelect value={rowRange} onChange={setRowRange} />
              </div>

              {/* Tanggal (Periode / Batas Tanggal) */}
              <div className="flex items-center gap-6">
                <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
                  Tanggal
                </label>
                <div className="flex-1 flex gap-2">
                  <select
                    value={dateType}
                    onChange={(e) => setDateType(e.target.value)}
                    className="px-3 py-2 border border-slate-205 bg-white text-slate-700 font-bold rounded-lg shadow-3xs cursor-pointer outline-none focus:border-[#0088E8] w-36 text-xs"
                  >
                    <option value="Periode">Periode</option>
                    <option value="Batas Tanggal">Batas Tanggal</option>
                  </select>
                  
                  {dateType === 'Periode' ? (
                    <div className="flex-1 flex items-center gap-2 border border-slate-205 rounded-lg px-3 py-2 bg-white shadow-3xs">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="outline-none w-full text-xs font-semibold cursor-pointer"
                      />
                      <span className="text-slate-400 font-bold select-none">-</span>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="outline-none w-full text-xs font-semibold cursor-pointer"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2 border border-slate-205 rounded-lg px-3 py-2 bg-white shadow-3xs">
                      <Calendar size={14} className="text-slate-400 shrink-0" />
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="outline-none w-full text-xs font-semibold cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Status Row */}
          <div className="flex items-center gap-6">
            <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
              Status
            </label>
            <ExportStatusButtons value={status} onChange={setStatus} />
          </div>

          {/* If Lunas is active, render only File, Status, and Date Range */}
          {isLunas && (
            <div className="flex items-center gap-6 animate-fade-in">
              <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
                Periode
              </label>
              <div className="flex-1 flex items-center gap-2 border border-slate-205 rounded-lg px-3 py-2 bg-white shadow-3xs">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="outline-none w-full text-xs font-semibold cursor-pointer"
                />
                <span className="text-slate-400 font-bold select-none">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="outline-none w-full text-xs font-semibold cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Piutang Row (hidden if status === Lunas) */}
          {!isLunas && (
            <div className="space-y-4">
              <div className="flex items-center gap-6">
                <label className="w-20 text-slate-400 font-bold text-right text-[10px] uppercase tracking-wider select-none shrink-0">
                  Piutang
                </label>
                <div className="flex-1 flex border border-slate-205 rounded-md overflow-hidden bg-white shadow-3xs p-0.5">
                  <button
                    type="button"
                    onClick={() => setPiutangType('Jatuh Tempo')}
                    className={`flex-1 py-1.5 text-center rounded-md font-bold transition-all cursor-pointer ${
                      piutangType === 'Jatuh Tempo' ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Jatuh Tempo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPiutangType('Semua Piutang')}
                    className={`flex-1 py-1.5 text-center rounded-md font-bold transition-all cursor-pointer ${
                      piutangType === 'Semua Piutang' ? 'bg-[#0088E8] text-white shadow-2xs' : 'bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Semua Piutang
                  </button>
                </div>
              </div>

              {/* Extra column: jatuh tempo pada (visible if Jatuh Tempo is active) */}
              {piutangType === 'Jatuh Tempo' && (
                <div className="flex items-center gap-6 animate-fade-in">
                  <label className="w-20 text-slate-450 font-bold text-right text-[9px] uppercase tracking-wider select-none shrink-0">
                    Jatuh Tempo Pada
                  </label>
                  <div className="flex-1 flex items-center gap-2 border border-slate-205 rounded-lg px-3 py-2 bg-white shadow-3xs">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <input
                      type="date"
                      value={dueDateAt}
                      onChange={(e) => setDueDateAt(e.target.value)}
                      className="outline-none w-full text-xs font-semibold cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Checkbox Details */}
          <div className="flex items-center gap-6 pt-2">
            <div className="w-20 shrink-0" />
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDetail}
                onChange={(e) => setShowDetail(e.target.checked)}
                className="w-4 h-4 rounded border-slate-350 text-[#0088E8] focus:ring-[#0088E8] cursor-pointer"
              />
              <span className="text-[11px] font-bold text-slate-650">Tampilkan Detail Export Piutang</span>
            </label>
          </div>

          {/* Export Button */}
          <div className="pt-4 flex justify-center">
            <button
              type="button"
              onClick={handleExport}
              className="px-8 py-2.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg shadow-2xs font-extrabold tracking-wide text-xs transition-colors cursor-pointer"
            >
              Export {fileType}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
