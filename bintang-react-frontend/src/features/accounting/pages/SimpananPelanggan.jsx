import { useState } from 'react';
import { Search, FileText, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { notify } from '../../../utils/notify';

export default function SimpananPelanggan() {
  const [searchQuery, setSearchQuery] = useState('');
  const [deposits, setDeposits] = useState([]); // Empty dataset matching screenshot ("No Data")

  const handleExportPDF = () => {
    notify({
      type: 'success',
      title: 'Export PDF',
      message: 'Simpanan Pelanggan berhasil diexport ke PDF.'
    });
  };

  const handleExportExcel = () => {
    notify({
      type: 'success',
      title: 'Export Excel',
      message: 'Simpanan Pelanggan berhasil diexport ke Excel.'
    });
  };

  const filtered = deposits.filter(
    (d) =>
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.customer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSum = filtered.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Main Single Card Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-6 space-y-6">
        
        {/* Card Header Title */}
        <div className="border-b border-slate-100 pb-4 select-none">
          <h3 className="text-base font-bold text-slate-800 tracking-wide">
            Simpanan Pelanggan
          </h3>
        </div>

        {/* Toolbar: Search input on Left, Export PDF & Excel buttons on Right */}
        <div className="flex items-center justify-between gap-4 select-none">
          {/* Search box */}
          <div className="relative flex items-center bg-white border border-slate-205 rounded-lg px-3 py-1.5 shadow-3xs w-64 focus-within:border-[#0088E8] transition-all">
            <Search className="text-slate-400 mr-2 shrink-0" size={13} />
            <input
              type="text"
              placeholder="Kode/Pelanggan"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-semibold text-slate-750 outline-none bg-transparent"
            />
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F87171] hover:bg-[#EF4444] text-white rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
            >
              <FileText size={13} />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg shadow-2xs font-extrabold text-[11px] cursor-pointer transition-colors"
            >
              <FileSpreadsheet size={13} />
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Table grid */}
        <div className="border border-slate-150 rounded-xl overflow-hidden bg-white shadow-3xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                <th className="px-6 py-4 w-[25%]">Kode</th>
                <th className="px-6 py-4 w-[50%]">Pelanggan</th>
                <th className="px-6 py-4 w-[25%] text-right">Jumlah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center text-slate-400 font-semibold select-none">
                    No Data
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-slate-700 font-semibold">{item.code}</td>
                    <td className="px-6 py-4 text-slate-800 font-bold">{item.customer}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                      IDR {item.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}

              {/* Total Summary Row */}
              <tr className="bg-slate-50/60 font-bold text-slate-800 border-t border-slate-200">
                <td colSpan={2} className="px-6 py-4 text-left text-xs text-slate-700">
                  Total
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-900 font-extrabold text-xs">
                  IDR {totalSum}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="pt-2 flex items-center justify-end gap-5 text-xs font-semibold text-slate-500 select-none">
          <span>Total {filtered.length}</span>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-350 cursor-not-allowed"
            >
              <ChevronLeft size={12} />
            </button>
            <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white font-bold">
              1
            </span>
            <button
              type="button"
              disabled
              className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-350 cursor-not-allowed"
            >
              <ChevronRight size={12} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span>Go to</span>
            <input
              type="text"
              defaultValue="1"
              disabled
              className="w-9 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none select-none font-bold"
            />
          </div>
        </div>

      </div>

    </div>
  );
}
