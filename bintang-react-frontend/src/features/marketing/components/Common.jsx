/** Sakelar on/off. */
export function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 cursor-pointer ${
        on ? 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm shadow-blue-500/20' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
          on ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

/** Sakelar Aktif/Nonaktif dipakai di kolom Aksi tiap daftar. */
export function StatusToggle({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Nonaktifkan' : 'Aktifkan'}
      className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 ${
        active
          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50'
          : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200/60'
      }`}
    >
      {active ? 'Aktif' : 'Nonaktif'}
    </button>
  );
}

/** Baris form: label (kanan) + helper, kontrol di kanan. */
export function FormRow({ label, required, help, children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-2 md:gap-6 px-6 py-5">
      <div className="md:text-right md:pt-2">
        <label className="text-sm font-semibold text-slate-600">
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {help && <p className="text-[11px] text-slate-400 mt-1 leading-snug font-medium">{help}</p>}
      </div>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}

/** Pilihan tipe diskon: % Persen / $ Nominal. */
export function PercentNominalField({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 p-1">
      <button
        type="button"
        onClick={() => onChange('percent')}
        className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
          value === 'percent'
            ? 'bg-white text-blue-600 shadow-sm font-extrabold'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
        }`}
      >
        % Persen
      </button>
      <button
        type="button"
        onClick={() => onChange('nominal')}
        className={`px-4 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all ${
          value === 'nominal'
            ? 'bg-white text-blue-600 shadow-sm font-extrabold'
            : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
        }`}
      >
        $ Nominal
      </button>
    </div>
  );
}

export const ErrorBanner = ({ message }) =>
  message ? (
    <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed">
      {message}
    </div>
  ) : null;
