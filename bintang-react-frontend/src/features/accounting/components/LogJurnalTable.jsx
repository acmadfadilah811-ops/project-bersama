import { ChevronLeft, ChevronRight, MoreHorizontal, ArrowUpDown, Loader2, FileText, X } from 'lucide-react';
import dayjs from 'dayjs';

export default function LogJurnalTable({
  logs, loading, pageSize, setPageSize, currentPage, setCurrentPage,
  totalItems, totalPages, gotoPageInput, setGotoPageInput,
  onPageChange, onGotoSubmit,
  activeActionRowId, setActiveActionRowId, actionDropdownRef,
  onViewEntry, onViewDescription,
}) {
  return (
    <div className="overflow-x-auto min-h-[360px] flex flex-col justify-between">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-white text-slate-700 font-bold text-xs select-none">
            <th className="py-3.5 px-6"><span className="flex items-center gap-1"><span>Tanggal</span><ArrowUpDown size={12} className="text-slate-400" /></span></th>
            <th className="py-3.5 px-6">No. Transaksi</th>
            <th className="py-3.5 px-6">Log Aksi</th>
            <th className="py-3.5 px-6">Diproses Oleh</th>
            <th className="py-3.5 px-6 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
          {loading ? (
            <tr>
              <td colSpan={5} className="py-16 text-center text-slate-400">
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-[#0088E8]" />
                  <span className="text-xs">Memuat log jurnal...</span>
                </div>
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-20 text-center text-slate-400">
                <span className="text-sm font-semibold text-slate-400">No Data</span>
              </td>
            </tr>
          ) : (
            logs.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-6">{dayjs(row.tanggal).format('DD-MMM-YYYY')}</td>
                <td className="py-3.5 px-6 font-semibold">
                  <button
                    type="button"
                    onClick={() => onViewEntry(row.no_transaksi)}
                    className="text-[#0088E8] hover:underline font-bold transition-all cursor-pointer text-left"
                  >
                    {row.no_transaksi}
                  </button>
                </td>
                <td className="py-3.5 px-6 font-medium text-slate-800">{row.log_aksi}</td>
                <td className="py-3.5 px-6 text-slate-600">{row.diproses_oleh}</td>
                <td className="py-3.5 px-6 text-right relative">
                  <button
                    type="button"
                    onClick={() => setActiveActionRowId(activeActionRowId === row.id ? null : row.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    {activeActionRowId === row.id ? <X size={16} /> : <MoreHorizontal size={16} />}
                  </button>
                  {activeActionRowId === row.id && (
                    <div
                      ref={actionDropdownRef}
                      className="absolute right-6 top-full mt-1 z-20 w-40 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 text-left text-xs font-bold animate-fade-in"
                    >
                      <button
                        type="button"
                        onClick={() => { onViewDescription(row); setActiveActionRowId(null); }}
                        className="w-full px-4 py-2 text-slate-750 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2"
                      >
                        <FileText size={13} className="text-slate-400" />
                        <span>Deskripsi</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-semibold bg-white mt-auto">
        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 font-medium text-xs outline-none cursor-pointer"
          >
            <option value={10}>10 item</option>
            <option value={15}>15 item</option>
            <option value={25}>25 item</option>
            <option value={50}>50 item</option>
            <option value={100}>100 item</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span>Total {totalItems}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <span className="w-7 h-7 rounded-full bg-[#0088E8] text-white font-bold flex items-center justify-center text-xs shadow-2xs">
              {currentPage}
            </span>
            <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span>Go to</span>
            <input
              type="text"
              value={gotoPageInput}
              onChange={(e) => setGotoPageInput(e.target.value)}
              onKeyDown={onGotoSubmit}
              className="w-10 h-7 border border-slate-200 rounded-md text-center text-xs font-bold text-slate-800 outline-none focus:border-[#0088E8]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
