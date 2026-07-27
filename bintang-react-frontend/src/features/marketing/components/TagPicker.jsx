import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Input tag multi-pilih yang mengambil opsi dari data asli (produk/brand/grup/paket/pelanggan)
 * lewat apiClient, dipakai untuk field kriteria yang sebelumnya cuma teks bebas.
 * Value tersimpan sebagai string dipisah koma agar tetap kompatibel dengan CharField backend.
 */
export default function TagPicker({ value, onChange, fetchUrl, placeholder }) {
  const [options, setOptions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tags = value ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];

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
      console.error('[TagPicker] fetch error:', err);
    }
  };

  const addTag = (name) => {
    if (!tags.includes(name)) onChange([...tags, name].join(', '));
    setQuery('');
  };
  const removeTag = (name) => onChange(tags.filter((t) => t !== name).join(', '));

  const filteredOptions = options.filter((o) => !tags.includes(o) && o.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap items-center gap-1.5 border border-slate-200 rounded-xl px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-100 text-blue-750 text-xs font-bold px-2.5 py-1 rounded-lg transition-all">
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              className="hover:text-blue-900 cursor-pointer p-0.5 rounded-full hover:bg-blue-100/85 transition-colors flex items-center justify-center"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setOpen(true);
            loadOptions();
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] text-sm outline-none py-0.5 text-slate-700 placeholder-slate-400 font-medium"
        />
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-full max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2.5 text-xs font-semibold text-slate-400">{loaded ? 'Tidak ada hasil' : 'Memuat...'}</div>
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
    </div>
  );
}
