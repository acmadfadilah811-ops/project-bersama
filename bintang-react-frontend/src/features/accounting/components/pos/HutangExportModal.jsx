import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { notify } from '../../../../utils/notify';

export default function HutangExportModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const [fileType, setFileType] = useState('PDF'); // 'PDF' | 'EXCEL'
  const [searchQuery, setSearchQuery] = useState('');
  const [rowRange, setRowRange] = useState('');
  const [dateType, setDateType] = useState('Periode');
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [status, setStatus] = useState('Belum Bayar'); // 'Belum Bayar' | 'Sebagian' | 'Lunas'
  const [dueType, setDueType] = useState('Semua Hutang'); // 'Jatuh Tempo' | 'Semua Hutang'
  const [showDetail, setShowDetail] = useState(false);

  const handleExport = () => {
    notify({
      type: 'success',
      title: 'Export Berhasil',
      message: `Hutang berhasil diexport ke format ${fileType}.`
    });
    onClose();
  };

  const rowRanges = [
    '1 - 1000',
    '1001 - 2000',
    '2001 - 3000',
    '3001 - 4000',
    '4001 - 5000',
    '5001 - 6000'
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[680px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-150 bg-[#F8FAFC]">
          <h4 className="text-sm font-bold text-slate-800">
            ExportHutang
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          
          {/* File type (PDF / EXCEL) */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">File</span>
            <div className="flex border border-slate-205 rounded-lg overflow-hidden w-full select-none">
              {['PDF', 'EXCEL'].map((type) => {
                const active = fileType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFileType(type)}
                    className={`flex-1 py-2 font-black text-center text-[10px] transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#0088E8] text-white font-extrabold shadow-inner'
                        : 'bg-white hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cari */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cari</span>
            <input
              type="text"
              placeholder="Transaksi/Pelanggan/Deskripsi"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-205 rounded-lg outline-none focus:border-[#0088E8] bg-white font-semibold"
            />
          </div>

          {/* Baris */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Baris</span>
            <select
              value={rowRange}
              onChange={(e) => setRowRange(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] cursor-pointer font-bold text-slate-650"
            >
              <option value="">Select</option>
              {rowRanges.map((range) => (
                <option key={range} value={range}>{range}</option>
              ))}
            </select>
          </div>

          {/* Tanggal */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Tanggal</span>
            <div className="flex items-center gap-2 w-full">
              <select
                value={dateType}
                onChange={(e) => setDateType(e.target.value)}
                className="w-1/3 px-3 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] cursor-pointer"
              >
                <option value="Periode">Periode</option>
                <option value="Satu hari">Satu hari</option>
              </select>
              <div className="flex-1 flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8]"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status</span>
            <div className="flex items-center gap-1.5">
              {['Belum Bayar', 'Sebagian', 'Lunas'].map((st) => {
                const active = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-all cursor-pointer font-bold text-[10px] uppercase ${
                      active
                        ? 'border-[#0088E8] text-[#0088E8] bg-[#E6F4FF]/50 shadow-3xs'
                        : 'border-slate-205 text-slate-500 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                      active ? 'border-[#0088E8] bg-[#E6F4FF]' : 'border-slate-350 bg-white'
                    }`}>
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-[#0088E8]" />}
                    </span>
                    <span>{st}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hutang */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hutang</span>
            <div className="flex bg-slate-100 rounded-lg p-0.5 w-max border border-slate-200">
              {['Jatuh Tempo', 'Semua Hutang'].map((opt) => {
                const active = dueType === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDueType(opt)}
                    className={`px-4 py-1 rounded-md font-bold text-[10px] uppercase transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'text-slate-650 hover:text-slate-800'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Jatuh Tempo Pada */}
          {dueType === 'Jatuh Tempo' && (
            <div className="grid grid-cols-[100px_1fr] items-center gap-4 animate-fade-in">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Jatuh Tempo Pada</span>
              <div className="flex items-center bg-white border border-slate-205 rounded-lg px-2.5 py-1.5 shadow-3xs w-full">
                <Calendar size={12} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="date"
                  className="w-full text-xs font-semibold text-slate-700 outline-none bg-transparent"
                  placeholder="Pilih hari"
                />
              </div>
            </div>
          )}

          {/* Checkbox */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-4 pt-1">
            <div />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showDetail}
                onChange={(e) => setShowDetail(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8]"
              />
              <span className="text-slate-600 font-bold">Tampilkan Detail Export Hutang</span>
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-150 flex justify-center bg-[#F8FAFC]">
          <button
            type="button"
            onClick={handleExport}
            className="w-full py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg font-black text-center cursor-pointer transition-colors shadow-3xs"
          >
            Export {fileType}
          </button>
        </div>

      </div>
    </div>
  );
}
