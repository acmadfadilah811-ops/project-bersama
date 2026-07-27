import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * TagPickerQty: Komponen multi-pilih khusus dengan input kuantitas (qty) untuk setiap tag.
 * Menerima value berupa array of objects: [ { nama: string, qty: number }, ... ]
 */
export default function TagPickerQty({ value = [], onChange, fetchUrl, placeholder }) {
  const [options, setOptions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selectedNames = value.map((v) => v.nama);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const loadOptions = async () => {
    if (loaded) return;
    try {
      const res = await apiClient.get(fetchUrl);
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setOptions(list.map((o) => o.nama).filter(Boolean));
      setLoaded(true);
    } catch (err) {
      console.error('[TagPickerQty] fetch error:', err);
    }
  };

  const addTag = (name) => {
    if (!selectedNames.includes(name)) {
      onChange([...value, { nama: name, qty: 1 }]);
    }
    setQuery('');
  };

  const removeTag = (name) => {
    onChange(value.filter((item) => item.nama !== name));
  };

  const updateQty = (name, qtyVal) => {
    const parsed = parseInt(qtyVal, 10);
    const qty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
    onChange(
      value.map((item) => (item.nama === name ? { ...item, qty } : item))
    );
  };

  const filteredOptions = options.filter(
    (o) => !selectedNames.includes(o) && o.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      {/* Search Input */}
      <div className="flex items-center border border-slate-200 rounded-xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all bg-white">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setOpen(true);
            loadOptions();
          }}
          placeholder={placeholder}
          className="w-full text-xs outline-none py-0.5 text-slate-700 placeholder-slate-400 font-semibold"
        />
      </div>

      {/* Suggestions Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2.5 text-xs font-semibold text-slate-400">
              {loaded ? 'Tidak ada hasil' : 'Memuat...'}
            </div>
          ) : (
            filteredOptions.slice(0, 20).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => addTag(o)}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {o}
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected Items List underneath with quantity input */}
      {value.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
          {value.map((item) => (
            <div
              key={item.nama}
              className="flex items-center justify-between gap-2 bg-blue-50/40 border border-blue-100/60 rounded-xl px-3 py-2 animate-in fade-in duration-200"
            >
              <span className="text-xs font-bold text-blue-750 truncate max-w-[150px]" title={item.nama}>
                {item.nama}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400">Qty:</span>
                <input
                  type="number"
                  min="1"
                  value={item.qty}
                  onChange={(e) => updateQty(item.nama, e.target.value)}
                  className="w-12 border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs font-bold text-center text-slate-700 outline-none bg-white focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => removeTag(item.nama)}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer p-1 rounded-lg hover:bg-rose-50 transition-colors flex items-center justify-center"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
