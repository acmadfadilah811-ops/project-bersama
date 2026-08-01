export default function PosAutoPostToggle({ enabled, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Memposting otomatis transaksi POS"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-12 items-center rounded-full p-0.5 transition-colors disabled:cursor-wait disabled:opacity-60 ${enabled ? 'bg-[#0088E8]' : 'bg-slate-300'}`}
    >
      <span className={`absolute text-[8px] font-extrabold text-white ${enabled ? 'left-1.5' : 'right-1.5'}`}>
        {enabled ? 'ON' : 'OFF'}
      </span>
      <span className={`relative h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}
