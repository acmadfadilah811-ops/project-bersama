import { useState, useRef, useEffect } from 'react';
import { ChevronDown, FileText } from 'lucide-react';

export default function PenjualanTable({
  data,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  filterJumlah,
  setFilterJumlah,
  filterStatus,
  setFilterStatus,
  filterPostPayment,
  setFilterPostPayment,
  formatIDR,
  onOpenRowLog
}) {
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null); // 'jumlah' | 'status' | 'postPayment' | null
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveHeaderDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const toggleHeaderDropdown = (type) => {
    setActiveHeaderDropdown((prev) => (prev === type ? null : type));
  };

  const handleSelectFilter = (type, value) => {
    if (type === 'jumlah') setFilterJumlah(value);
    if (type === 'status') setFilterStatus(value);
    if (type === 'postPayment') setFilterPostPayment(value);
    setActiveHeaderDropdown(null);
  };

  const allChecked = data.length > 0 && data.every((row) => selectedIds.includes(row.id));
  const isIndeterminate = data.length > 0 && data.some((row) => selectedIds.includes(row.id)) && !allChecked;

  const formatDateLabel = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible text-xs font-semibold text-slate-700 min-h-[320px]">
      <div className="overflow-x-auto overflow-y-visible min-h-[320px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100 overflow-visible">
            <tr className="overflow-visible">
              <th className="px-5 py-3.5 w-10">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = isIndeterminate;
                  }}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 cursor-pointer"
                />
              </th>
              <th className="px-5 py-3.5">Tanggal Jual</th>
              <th className="px-5 py-3.5">Transaksi</th>
              <th className="px-5 py-3.5">Pelanggan</th>

              {/* Jumlah Dropdown Header */}
              <th className="px-5 py-3.5 text-right relative overflow-visible">
                <button
                  type="button"
                  onClick={() => toggleHeaderDropdown('jumlah')}
                  className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors ml-auto cursor-pointer"
                >
                  <span>Jumlah</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>
                {activeHeaderDropdown === 'jumlah' && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-4 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left font-bold animate-fade-in"
                  >
                    {['All', 'Dilunasi', 'Parsial', 'Belum Dilunasi'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectFilter('jumlah', opt)}
                        className={`w-full px-3 py-1.5 text-[10px] text-left transition-colors cursor-pointer ${
                          filterJumlah === opt ? 'bg-[#E6F4FF] text-[#0088E8]' : 'text-slate-655 hover:bg-slate-50'
                        }`}
                      >
                        {opt === 'All' ? 'Semua' : opt}
                      </button>
                    ))}
                  </div>
                )}
              </th>

              {/* Status Dropdown Header */}
              <th className="px-5 py-3.5 text-center relative overflow-visible">
                <button
                  type="button"
                  onClick={() => toggleHeaderDropdown('status')}
                  className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors mx-auto cursor-pointer"
                >
                  <span>Status</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>
                {activeHeaderDropdown === 'status' && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-1/2 -translate-x-1/2 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left font-bold animate-fade-in"
                  >
                    {['All', 'Terposting', 'Belum Terposting', 'Double Posted'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectFilter('status', opt)}
                        className={`w-full px-3 py-1.5 text-[10px] text-left transition-colors cursor-pointer ${
                          filterStatus === opt ? 'bg-[#E6F4FF] text-[#0088E8]' : 'text-slate-655 hover:bg-slate-50'
                        }`}
                      >
                        {opt === 'All' ? 'Semua' : opt}
                      </button>
                    ))}
                  </div>
                )}
              </th>

              {/* Post Pembayaran Dropdown Header */}
              <th className="px-5 py-3.5 text-center relative overflow-visible">
                <button
                  type="button"
                  onClick={() => toggleHeaderDropdown('postPayment')}
                  className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors mx-auto cursor-pointer"
                >
                  <span>Post Pembayaran</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>
                {activeHeaderDropdown === 'postPayment' && (
                  <div
                    ref={dropdownRef}
                    className="absolute right-4 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left font-bold animate-fade-in"
                  >
                    {['All', 'Terposting', 'Belum Terposting', 'Sebagian', 'Tunda'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleSelectFilter('postPayment', opt)}
                        className={`w-full px-3 py-1.5 text-[10px] text-left transition-colors cursor-pointer ${
                          filterPostPayment === opt ? 'bg-[#E6F4FF] text-[#0088E8]' : 'text-slate-655 hover:bg-slate-50'
                        }`}
                      >
                        {opt === 'All' ? 'Semua' : opt}
                      </button>
                    ))}
                  </div>
                )}
              </th>

              <th className="px-5 py-3.5 w-14 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-20 text-slate-400 font-bold text-xs bg-slate-55/10">
                  No Data
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const isChecked = selectedIds.includes(row.id);
                return (
                  <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                  <td className="px-5 py-3.5">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleSelect(row.id)}
                      className="rounded border-slate-300 cursor-pointer"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-slate-550">
                    {formatDateLabel(row.date)}
                  </td>
                  <td className="px-5 py-3.5 text-sky-600 font-bold select-all cursor-pointer hover:underline">
                    {row.txNo}
                  </td>
                  <td className="px-5 py-3.5 text-slate-800 font-bold">
                    {row.customer || '-'}
                  </td>
                  <td className="px-5 py-3.5 text-right font-extrabold text-slate-850">
                    <div>IDR {formatIDR(row.amount)}</div>
                    <div className={`text-[8.5px] font-bold ${
                      row.paymentStatus === 'Dilunasi'
                        ? 'text-emerald-500'
                        : row.paymentStatus === 'Parsial'
                        ? 'text-amber-500'
                        : 'text-rose-500'
                    }`}>
                      {row.paymentStatus}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.status === 'Terposting'
                        ? 'bg-emerald-50 text-emerald-700'
                        : row.status === 'Double Posted'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-[#FFF9E6] text-[#D9A300]'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      row.postPayment === 'Terposting'
                        ? 'bg-emerald-50 text-emerald-700'
                        : row.postPayment === 'Sebagian'
                        ? 'bg-amber-50 text-amber-700'
                        : row.postPayment === 'Tunda'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {row.postPayment}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      type="button"
                      onClick={() => onOpenRowLog(row)}
                      className="p-1 hover:bg-slate-50 text-sky-505 hover:text-sky-600 rounded transition-colors cursor-pointer inline-block"
                    >
                      <FileText size={14} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
