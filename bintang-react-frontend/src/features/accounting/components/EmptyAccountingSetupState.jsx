import { CalendarOff } from 'lucide-react';

export default function EmptyAccountingSetupState({ onStart }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-20 px-8 flex flex-col items-center justify-center text-center">
      <div className="w-24 h-24 rounded-full bg-sky-50 flex items-center justify-center mb-5">
        <CalendarOff size={36} className="text-[#0088E8]" />
      </div>
      <p className="text-sm font-semibold text-slate-600 mb-4">
        Lakukan pengaturan awal sebelum memulai
      </p>
      <button
        type="button"
        onClick={onStart}
        className="px-5 py-2.5 rounded-xl bg-[#0088E8] hover:bg-sky-600 font-bold text-xs text-white shadow-md transition-all transform active:scale-95 cursor-pointer"
      >
        Atur Sekarang
      </button>
    </div>
  );
}
