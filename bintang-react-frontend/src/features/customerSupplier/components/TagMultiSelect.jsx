import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/** Input tag multi-pilih: bisa klik saran yang sudah ada, atau ketik + Enter untuk membuat tag baru. */
export default function TagMultiSelect({ value = [], onChange, options = [] }) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (name) => {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput('');
  };

  const removeTag = (name) => onChange(value.filter((v) => v !== name));

  const suggestions = options
    .map((o) => o.nama)
    .filter((n) => !value.includes(n) && n.toLowerCase().includes(input.trim().toLowerCase()));

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '5px 8px', minHeight: '36px', boxSizing: 'border-box', background: '#fff' }}>
        {value.map((tag) => (
          <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1d4ed8', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', fontWeight: 'bold' }}>
            {tag}
            <X size={11} style={{ cursor: 'pointer' }} onClick={() => removeTag(tag)} />
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              e.preventDefault();
              addTag(input);
            } else if (e.key === 'Backspace' && !input && value.length) {
              removeTag(value[value.length - 1]);
            }
          }}
          placeholder={value.length ? '' : 'Select'}
          style={{ border: 0, outline: 'none', fontSize: '13px', flex: 1, minWidth: '90px' }}
        />
      </div>
      {open && input.trim() && (
        <div style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: '160px', overflowY: 'auto' }}>
          {suggestions.map((name) => (
            <div
              key={name}
              onMouseDown={(e) => { e.preventDefault(); addTag(name); }}
              style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {name}
            </div>
          ))}
          <div
            onMouseDown={(e) => { e.preventDefault(); addTag(input); }}
            style={{ padding: '8px 12px', fontSize: '12px', color: '#0ea5e9', fontWeight: 'bold', cursor: 'pointer', borderTop: suggestions.length ? '1px solid #f1f5f9' : 'none' }}
          >
            + Buat tag baru "{input.trim()}"
          </div>
        </div>
      )}
    </div>
  );
}
