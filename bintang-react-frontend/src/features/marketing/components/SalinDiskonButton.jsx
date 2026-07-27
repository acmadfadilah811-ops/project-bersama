import { useState, useEffect, useRef } from 'react';
import { Copy } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/** Dropdown "Salin Diskon" — pilih promo yang sudah ada untuk diduplikasi jadi draft baru. */
export default function SalinDiskonButton({ rows, onCopied }) {
  const [open, setOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleCopy = async (row) => {
    setCopying(true);
    try {
      await apiClient.post(`/pos-promotions/${row.id}/duplicate/`);
      onCopied();
    } catch (err) {
      console.error('[VoucherDiskon] duplicate promotion error:', err);
    } finally {
      setCopying(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={rows.length === 0 || copying}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl px-4.5 py-2.5 text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-blue-500/10"
      >
        <Copy size={14} /> {copying ? 'Menyalin...' : 'Salin Diskon'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 max-h-64 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {rows.length === 0 ? (
            <div className="px-4 py-2.5 text-xs font-semibold text-slate-400">Belum ada promosi</div>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => handleCopy(row)}
                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {row.judul}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
