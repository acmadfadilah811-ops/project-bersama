import { Search, Calendar } from 'lucide-react';

export default function PosHeader({ title, searchKeyword, setSearchKeyword, dateFrom, setDateFrom, dateTo, setDateTo }) {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-between text-xs font-semibold text-slate-700 pb-2">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>

      <div className="flex items-center gap-3.5 flex-wrap">
        {/* Date Filters */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-2xs">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-1 py-0.5 outline-none text-[10px] text-slate-700 bg-white"
          />
          <span className="text-slate-400 font-bold">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-1 py-0.5 outline-none text-[10px] text-slate-700 bg-white"
          />
        </div>

        {/* Search Input */}
        <div className="relative w-48">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search size={12} />
          </span>
          <input
            type="text"
            placeholder="Cari transaksi..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 border border-slate-205 rounded-lg text-xs bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold shadow-2xs"
          />
        </div>
      </div>
    </div>
  );
}
