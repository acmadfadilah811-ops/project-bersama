const STATUS_OPTIONS = [
  { id: 'Belum Bayar', label: 'Belum Bayar' },
  { id: 'Sebagian', label: 'Sebagian' },
  { id: 'Lunas', label: 'Lunas' },
];

// Toggle status dipakai di modal export Piutang & Hutang.
export default function ExportStatusButtons({ value, onChange }) {
  return (
    <div className="flex-1 flex gap-3">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex-1 py-2 px-3 border rounded-lg font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs ${
              isActive
                ? 'border-[#0088E8] bg-[#E6F4FF]/20 text-[#0088E8]'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-650'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full border flex items-center justify-center shrink-0 ${
              isActive ? 'border-[#0088E8]' : 'border-slate-300'
            }`}>
              {isActive && <span className="w-1.5 h-1.5 bg-[#0088E8] rounded-full" />}
            </span>
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
