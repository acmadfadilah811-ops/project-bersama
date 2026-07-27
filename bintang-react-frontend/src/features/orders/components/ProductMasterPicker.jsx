import { useEffect, useRef, useState } from 'react';
import { Search, X, Tag } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Pemilih master Produk (opsional) untuk sebuah item pesanan.
 */
export default function ProductMasterPicker({ value, valueLabel = '', onChange }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/products/?search=${encodeURIComponent(query)}`);
        setOptions((res.data.results || res.data || []).slice(0, 8));
      } catch {
        setOptions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (value) {
    return (
      <div className="mt-1 flex items-center justify-between gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-[10px]">
        <span className="truncate font-bold text-emerald-700" title={valueLabel}>{valueLabel}</span>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery(''); setOpen(false); }}
          title="Lepas tautan produk"
          className="shrink-0 text-emerald-600 hover:text-emerald-800 cursor-pointer"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative mt-1" ref={containerRef}>
      <div className="flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent">
        <Search size={11} className="text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Cari / tautkan produk..."
          className="w-full text-[10px] bg-transparent outline-none text-slate-700 placeholder:text-slate-400 font-semibold"
        />
      </div>
      {open && options.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[99] bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-100 min-w-[280px]">
          {options.map((p) => {
            const harga = p.harga_jual_toko ?? p.harga_jual ?? 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-[11px] hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between gap-2 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-slate-800 block truncate">{p.nama}</span>
                  {p.sku && <span className="text-[9.5px] text-slate-400 font-mono block">SKU: {p.sku}</span>}
                </div>
                {harga > 0 && (
                  <span className="shrink-0 font-extrabold text-indigo-600 text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5">
                    <Tag size={9} />
                    {formatCurrency(harga)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
