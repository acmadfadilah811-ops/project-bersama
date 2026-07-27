import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, ChevronDown } from 'lucide-react';

const fmtShort = (d) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });

function computePresetRange(preset) {
  const today = new Date();
  let start = new Date();
  let end = new Date();
  switch (preset) {
    case 'today':
      break;
    case 'yesterday':
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case 'last7':
      start.setDate(today.getDate() - 6);
      break;
    case 'last30':
      start.setDate(today.getDate() - 29);
      break;
    case 'thisMonth':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    default:
      return { start: null, end: null };
  }
  return { start, end };
}

const DATE_PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 Days' },
  { id: 'last30', label: 'Last 30 Days' },
  { id: 'thisMonth', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
  { id: 'custom', label: 'Custom Range' },
];

export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toISO = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');

  const selectPreset = (id) => {
    if (id === 'all') {
      onChange({ preset: 'all', start: null, end: null });
      setOpen(false);
      return;
    }
    if (id === 'custom') {
      onChange({ preset: 'custom', start: value.start || new Date(), end: value.end || new Date() });
      return;
    }
    const { start, end } = computePresetRange(id);
    onChange({ preset: id, start, end });
    setOpen(false);
  };

  const shift = (dir) => {
    if (!value.start || !value.end) return;
    const start = new Date(value.start);
    const end = new Date(value.end);
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    start.setDate(start.getDate() + dir * days);
    end.setDate(end.getDate() + dir * days);
    onChange({ preset: 'custom', start, end });
  };

  const isAll = value.preset === 'all' || !value.start || !value.end;
  const label = isAll ? 'All Time' : `${fmtShort(value.start)} - ${fmtShort(value.end)}`;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-slate-600 bg-white">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={isAll}
          className="p-1 hover:bg-slate-50 rounded text-slate-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2 whitespace-nowrap cursor-pointer hover:text-slate-800"
        >
          <Calendar size={15} /> {label}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={isAll}
          className="p-1 hover:bg-slate-50 rounded text-slate-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-52 bg-white rounded-lg border border-slate-200 shadow-lg z-30 py-1 animate-fade-in animate-duration-150">
          {DATE_PRESETS.map((p) => {
            const isActive = value.preset === p.id;
            return (
              <div key={p.id}>
                <button
                  type="button"
                  onClick={() => selectPreset(p.id)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'text-white bg-blue-500 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p.label}
                </button>

                {p.id === 'custom' && value.preset === 'custom' && (
                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex flex-col gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Mulai Dari
                      </label>
                      <input
                        type="date"
                        value={toISO(value.start)}
                        onChange={(e) =>
                          onChange({
                            preset: 'custom',
                            start: e.target.value ? new Date(e.target.value) : null,
                            end: value.end,
                          })
                        }
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">
                        Sampai Dengan
                      </label>
                      <input
                        type="date"
                        value={toISO(value.end)}
                        onChange={(e) =>
                          onChange({
                            preset: 'custom',
                            start: value.start,
                            end: e.target.value ? new Date(e.target.value) : null,
                          })
                        }
                        className="w-full border border-slate-200 rounded-md px-2 py-1 text-xs outline-none focus:border-blue-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-md py-1.5 mt-1 cursor-pointer transition-colors"
                    >
                      Terapkan
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
