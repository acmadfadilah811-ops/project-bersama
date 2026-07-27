import { Calendar, Filter, Settings } from 'lucide-react';

export default function PenjualanHeader({
  dateLabel,
  dateFrom,
  dateTo,
  onOpenSearch,
  onOpenDate,
  checkedCount,
  hasBelumPosted,
  hasPosted,
  onPost,
  onPostPayment,
  onCancelPost,
  onOpenSettings
}) {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-between text-xs font-semibold text-slate-700 pb-2">
      
      {/* Left Filter Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onOpenSearch}
          className="px-4 py-1.5 border border-slate-205 text-slate-650 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
        >
          <Filter size={13} className="text-slate-400" />
          <span>Filter</span>
        </button>

        <button
          type="button"
          onClick={onOpenDate}
          className="px-4 py-1.5 border border-slate-205 text-slate-655 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
        >
          <Calendar size={13} className="text-slate-400" />
          <span>
            {dateLabel} ({new Date(dateFrom).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} - {new Date(dateTo).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })})
          </span>
        </button>
      </div>

      {/* Right Post Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!hasBelumPosted}
          onClick={onPostPayment}
          className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs ${
            hasBelumPosted
              ? 'bg-[#28A745] hover:bg-[#218838] text-white cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          Post Pembayaran
        </button>

        <button
          type="button"
          disabled={!hasPosted}
          onClick={onCancelPost}
          className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs ${
            hasPosted
              ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          Batal Post
        </button>

        <button
          type="button"
          disabled={!hasBelumPosted}
          onClick={onPost}
          className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs ${
            hasBelumPosted
              ? 'bg-[#0088E8] hover:bg-[#0077CC] text-white cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
        >
          Post
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs ml-1"
        >
          <Settings size={14} />
        </button>
      </div>

    </div>
  );
}
