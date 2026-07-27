import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export const defaultCustomerFilters = {
  customerGroup: '',
  status: 'semua',
  dobStart: '',
  dobEnd: '',
  expiryStart: '',
  expiryEnd: '',
  depositMin: '',
  depositMax: '',
  loyaltyMin: '',
  loyaltyMax: '',
};

const inputCls =
  'w-full h-9 rounded-md border border-slate-300 px-2.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400';
const labelCls = 'text-xs font-semibold text-slate-700 mb-1.5 block';

function RangeRow({ children }) {
  return (
    <div className="flex items-center gap-2">
      {children[0]}
      <span className="text-slate-400 text-xs">-</span>
      {children[1]}
    </div>
  );
}

export default function CustomerFilterDrawer({ open, onClose, groups = [], value, onApply, onReset }) {
  const [draft, setDraft] = useState(value || defaultCustomerFilters);

  useEffect(() => {
    if (open) setDraft(value || defaultCustomerFilters);
  }, [open, value]);

  if (!open) return null;

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  const statusOptions = [
    { id: 'semua', label: 'Semua' },
    { id: 'aktif', label: 'Aktif' },
    { id: 'dibekukan', label: 'Dibekukan' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]" role="presentation">
      <div className="bg-white w-full max-w-sm h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200" role="dialog" aria-modal="true" aria-label="Filter Pelanggan">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-base">Filter</h3>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</span>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label className={labelCls}>Tipe Pelanggan</label>
            <select value={draft.customerGroup} onChange={set('customerGroup')} className={`${inputCls} bg-white`}>
              <option value="">Cari</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.nama}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Status pelanggan</label>
            <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1">
              {statusOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, status: opt.id }))}
                  className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-colors cursor-pointer ${
                    draft.status === opt.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Tanggal Lahir</label>
            <RangeRow>
              <input type="date" value={draft.dobStart} onChange={set('dobStart')} className={inputCls} />
              <input type="date" value={draft.dobEnd} onChange={set('dobEnd')} className={inputCls} />
            </RangeRow>
          </div>

          <div>
            <label className={labelCls}>Tanggal Berakhir</label>
            <RangeRow>
              <input type="date" value={draft.expiryStart} onChange={set('expiryStart')} className={inputCls} />
              <input type="date" value={draft.expiryEnd} onChange={set('expiryEnd')} className={inputCls} />
            </RangeRow>
          </div>

          <div>
            <label className={labelCls}>Deposit (IDR)</label>
            <RangeRow>
              <input type="number" min="0" placeholder="Min" value={draft.depositMin} onChange={set('depositMin')} className={inputCls} />
              <input type="number" min="0" placeholder="Maks" value={draft.depositMax} onChange={set('depositMax')} className={inputCls} />
            </RangeRow>
          </div>

          <div>
            <label className={labelCls}>Loyalty points (pts)</label>
            <RangeRow>
              <input type="number" min="0" placeholder="Min" value={draft.loyaltyMin} onChange={set('loyaltyMin')} className={inputCls} />
              <input type="number" min="0" placeholder="Maks" value={draft.loyaltyMax} onChange={set('loyaltyMax')} className={inputCls} />
            </RangeRow>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setDraft(defaultCustomerFilters);
              onReset?.();
            }}
            className="flex-1 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg py-2 hover:bg-slate-50 cursor-pointer"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onApply?.(draft)}
            className="flex-1 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg py-2 cursor-pointer shadow-sm"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
