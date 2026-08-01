import { createPortal } from 'react-dom';

// Dropdown filter header tabel, dirender lewat portal ke document.body supaya
// tidak terpotong overflow ancestor tabel (pola sama dengan RowActionMenu di
// ProductsPage.jsx). Posisi dihitung dari getBoundingClientRect() tombol pemicu.
export default function HeaderFilterDropdown({ anchorRect, options, value, onSelect, onClose, align = 'right', width = 160 }) {
  if (!anchorRect) return null;
  const top = anchorRect.bottom + 4;
  const left = align === 'center'
    ? Math.max(8, anchorRect.left + anchorRect.width / 2 - width / 2)
    : Math.max(8, anchorRect.right - width);

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={onClose} />
      <div
        style={{
          position: 'fixed', top, left, width, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 28px rgba(15,23,42,0.14)',
          zIndex: 200, overflow: 'hidden', padding: '6px 0',
        }}
        className="text-left animate-fade-in"
      >
        {options.map((item) => (
          <button
            type="button"
            key={item}
            onClick={() => { onSelect(item); onClose(); }}
            className={`block w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-slate-50 transition-colors cursor-pointer ${
              value === item ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}
