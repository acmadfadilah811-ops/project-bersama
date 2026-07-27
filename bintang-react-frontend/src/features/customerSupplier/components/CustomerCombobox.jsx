import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

/** Input "Nama Pelanggan" yang bisa diketik untuk mencari, bukan sekadar dropdown pilih. */
export default function CustomerCombobox({ value, onChange, customers = [], placeholder = 'Cari pelanggan...' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = customers.find((c) => String(c.id) === String(value));

  useEffect(() => {
    setQuery(selected ? selected.nama : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(selected ? selected.nama : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const filtered = query.trim()
    ? customers.filter((c) => c.nama.toLowerCase().includes(query.trim().toLowerCase()))
    : customers;

  const pick = (customer) => {
    onChange(customer ? String(customer.id) : '');
    setQuery(customer ? customer.nama : '');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setQuery(selected ? selected.nama : ''); e.currentTarget.blur(); }
        }}
        placeholder={placeholder}
        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', height: '36px', padding: '0 28px 0 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box', background: '#fff' }}
      />
      {query ? (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); pick(null); }}
          style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex' }}
        >
          <X size={14} />
        </button>
      ) : (
        <ChevronDown size={14} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
      )}

      {open && (
        <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: '220px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '12px', color: '#94a3b8' }}>Tidak ditemukan.</div>
          ) : (
            filtered.map((c) => (
              <div
                key={c.id}
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
                style={{ padding: '8px 12px', fontSize: '13px', color: String(c.id) === String(value) ? '#0ea5e9' : '#334155', fontWeight: String(c.id) === String(value) ? 'bold' : 'normal', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {c.nama}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
