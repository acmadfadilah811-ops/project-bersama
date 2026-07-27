import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Dropdown({ 
  options = [], 
  value, 
  onChange, 
  placeholder = 'Pilih', 
  minW = 'min-w-[180px]', 
  placement = 'down' 
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const dropdownListClass = placement === 'up'
    ? 'absolute left-0 bottom-full mb-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg z-30 py-1 max-h-64 overflow-y-auto animate-fade-in'
    : 'absolute left-0 top-full mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg z-30 py-1 max-h-64 overflow-y-auto animate-fade-in';

  return (
    <div className={`relative ${minW}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white hover:border-slate-300 transition-colors cursor-pointer"
      >
        <span className={value ? 'text-slate-700 font-medium' : 'text-slate-400'}>
          {value || placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className={dropdownListClass}>
          {options.map((opt) => {
            const isActive = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange?.(opt);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                  isActive
                    ? 'text-blue-600 font-semibold bg-blue-50/70'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
