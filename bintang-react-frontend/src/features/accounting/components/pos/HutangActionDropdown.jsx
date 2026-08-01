import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CheckCircle2, Eye, MoreHorizontal, Trash2 } from 'lucide-react';

export default function HutangActionDropdown({ purchaseId, onDeleteClick, onDetailClick, onJournalClick, isLunas }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

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
      const menuHeight = 190;
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
      <button ref={buttonRef} type="button" onClick={toggleMenu} className="p-1 rounded-lg text-slate-450 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer" aria-label="Aksi hutang">
        <MoreHorizontal size={14} />
      </button>

      {isOpen && menuPosition && createPortal(
        <div ref={menuRef} style={menuPosition} className="fixed z-[10000] w-52 rounded-lg border border-slate-200 bg-white py-1 text-left text-xs font-semibold text-slate-700 shadow-xl animate-fade-in">
          <button type="button" onClick={closeAnd(onDetailClick)} className="w-full px-3.5 py-2 text-left text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2">
            <Eye size={13} className="text-slate-400 shrink-0" /> Detail
          </button>
          <button
            type="button"
            disabled={isLunas}
            onClick={closeAnd(() => navigate('/transaksi/pembelian?tab=butuh-diproses', { state: { tab: 'butuh-diproses', openPurchaseId: purchaseId } }))}
            className={`w-full px-3.5 py-2 text-left text-[11px] flex items-center gap-2 ${isLunas ? 'bg-slate-50/10 text-slate-300 cursor-not-allowed' : 'hover:bg-slate-50 transition-colors cursor-pointer'}`}
          >
            <CheckCircle2 size={13} className={isLunas ? 'text-slate-250 shrink-0' : 'text-slate-450 shrink-0'} /> Terima
          </button>
          <button type="button" onClick={closeAnd(onJournalClick)} className="w-full px-3.5 py-2 text-left text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2">
            <ArrowLeftRight size={13} className="text-slate-400 shrink-0" /> Pasangan Jurnal
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={closeAnd(onDeleteClick)} className="w-full px-3.5 py-2 text-left text-[11px] font-bold text-rose-600 hover:bg-slate-50 hover:text-rose-700 transition-colors cursor-pointer flex items-center gap-2">
            <Trash2 size={13} className="text-rose-500 shrink-0" /> Hapus
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}
