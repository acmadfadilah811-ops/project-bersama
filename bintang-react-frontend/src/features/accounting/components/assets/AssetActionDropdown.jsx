import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

export default function AssetActionDropdown({ isDisposed, onEditClick, onDisposeClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const closeWhenOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeWhenOutside);
    return () => document.removeEventListener('mousedown', closeWhenOutside);
  }, []);

  const toggleMenu = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = 96;
      const opensUp = window.innerHeight - rect.bottom < menuHeight;
      setMenuPosition({
        top: opensUp ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setIsOpen((value) => !value);
  };

  const closeAnd = (callback) => () => {
    setIsOpen(false);
    callback?.();
  };

  return (
    <div ref={dropdownRef} className="relative inline-block text-left text-xs font-semibold">
      <button ref={buttonRef} type="button" onClick={toggleMenu} className="p-1 rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer" aria-label="Aksi aset">
        <MoreHorizontal size={14} />
      </button>

      {isOpen && menuPosition && createPortal(
        <div ref={menuRef} style={menuPosition} className="fixed z-[10000] w-44 rounded-lg border border-slate-200 bg-white py-1 text-left text-xs font-semibold text-slate-700 shadow-xl animate-fade-in">
          <button type="button" onClick={closeAnd(onEditClick)} className="w-full px-3.5 py-2 text-left text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2">
            <Pencil size={13} className="text-slate-400 shrink-0" /> Ubah
          </button>
          {!isDisposed && (
            <button type="button" onClick={closeAnd(onDisposeClick)} className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-rose-600 hover:bg-slate-50 hover:text-rose-700 transition-colors cursor-pointer flex items-center gap-2">
              <Trash2 size={13} className="text-rose-500 shrink-0" /> Lepas Aset
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
