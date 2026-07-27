export default function ToggleSwitchRow({ label, value, onChange, bordered = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 pt-2 ${bordered ? 'border-t border-slate-100' : ''}`}>
      <span className="font-medium text-slate-700 text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400">{value ? 'Ya' : 'Tidak'}</span>
        <button
          type="button"
          onClick={onChange}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            value ? 'bg-[#0088E8]' : 'bg-slate-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              value ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  );
}
