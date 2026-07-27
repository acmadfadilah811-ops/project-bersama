import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Dropdown Tipe Promosi. Nilai default 'Semua' tampil sebagai "Tipe Promosi"
 * di kolomnya; memilih tipe lain (DQ/BX/DA/FI) menampilkan tipe tsb.
 */
export default function PromoTipeDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  const options = ['Semua', 'DQ', 'BX', 'DA', 'FI'];
  const isAll = value === 'Semua';
  return (
    <div className="relative min-w-[150px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold bg-white hover:border-slate-350 hover:bg-slate-50/30 transition-all cursor-pointer shadow-sm"
      >
        <span className={isAll ? 'text-slate-400 font-semibold' : 'text-slate-700 font-bold'}>{isAll ? 'Tipe Promosi' : value}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform duration-250 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl border border-slate-100 shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                opt === value ? 'text-blue-600 bg-blue-50/50 font-extrabold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
