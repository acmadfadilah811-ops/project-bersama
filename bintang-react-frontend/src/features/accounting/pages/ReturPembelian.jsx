import { useState, useRef, useEffect } from 'react';
import { Filter, AlertTriangle, ChevronDown } from 'lucide-react';
import ReturPenjualanFilterModal from '../components/pos/ReturPenjualanFilterModal';
import ReturPenjualanDateModal from '../components/pos/ReturPenjualanDateModal';

export default function ReturPembelian() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  
  const [dateFrom, setDateFrom] = useState('2026-07-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [dateLabel, setDateLabel] = useState('Hari ini');

  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null); // 'status' | null
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Terposting' | 'Belum Terposting'
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Belum Terhubung ke POS Return Pembelian
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Koneksi data return pembelian kasir POS belum terintegrasi. 
            Tampilan di bawah ini memprioritaskan kesesuaian tata letak UI (fokus antarmuka).
          </p>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-base font-bold text-slate-900">Retur Pembelian</h2>

      {/* Action Row */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        
        {/* Left Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Filter size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDateOpen(true)}
            className="px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {dateLabel} {dateFrom.split('-').reverse().join('-')} - {dateTo.split('-').reverse().join('-')}
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="px-4 py-1.5 font-bold rounded-lg text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed transition-all shadow-2xs"
          >
            Batal Post
          </button>

          <button
            type="button"
            disabled
            className="px-4 py-1.5 font-bold rounded-lg text-[10px] bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed transition-all shadow-2xs"
          >
            Post
          </button>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5 w-10 text-center">
                  <div className="w-3.5 h-3.5 rounded border border-slate-200 bg-white" />
                </th>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">No. Pengembalian</th>
                <th className="px-5 py-3.5">No. Pesanan</th>
                <th className="px-5 py-3.5">Supplier</th>
                <th className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1 select-none">
                    <span>Jumlah</span>
                    <span className="text-slate-355 text-[10px]">↕</span>
                  </div>
                </th>
                <th className="px-5 py-3.5 text-center relative min-w-[140px]">
                  <div
                    onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'status' ? null : 'status')}
                    className="flex items-center justify-center gap-1 cursor-pointer select-none hover:text-slate-700 transition-colors"
                  >
                    <span>Status</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </div>
                  {activeHeaderDropdown === 'status' && (
                    <div ref={dropdownRef} className="absolute left-1/2 -translate-x-1/2 top-11 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-40 w-36 font-semibold animate-fade-in text-left">
                      {['All', 'Terposting', 'Belum Terposting'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setFilterStatus(opt);
                            setActiveHeaderDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                            filterStatus === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">
                  No Data
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md transition-colors shadow-2xs">
              <span>15 item</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span>Total 0</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &gt;
              </button>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none"
              />
            </div>
          </div>

        </div>

      </div>

      {/* Filter Modal */}
      <ReturPenjualanFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(filter) => console.log('Filter applied', filter)}
      />

      {/* Date Modal */}
      <ReturPenjualanDateModal
        isOpen={isDateOpen}
        onClose={() => setIsDateOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={(res) => {
          setDateFrom(res.from);
          setDateTo(res.to);
          setDateLabel(res.label);
        }}
      />

    </div>
  );
}
