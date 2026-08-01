import { useEffect, useRef, useState } from 'react';

// Dropdown "Baris" pada modal export Piutang/Hutang — dipisah dari modal
// induk (ExportPiutangModal) supaya file tidak melebihi limit JSX 300 baris.
export default function ExportRowRangeSelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function clickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const rangeList = [];
  for (let i = 0; i < 200; i++) {
    const start = i * 1000 + 1;
    const end = (i + 1) * 1000;
    rangeList.push(`${start} - ${end}`);
  }

  return (
    <div className="flex-1 relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-lg shadow-3xs cursor-pointer text-left"
      >
        <span>{value}</span>
        <span className="text-[9px] text-slate-400">▼</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-full max-h-48 overflow-y-auto font-semibold">
          {rangeList.map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => {
                onChange(range);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3.5 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                value === range ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
