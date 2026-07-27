import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Eye, CheckCircle2, ArrowLeftRight, Trash2 } from 'lucide-react';
import { notify } from '../../../../utils/notify';

export default function PiutangActionDropdown({ txNo, onDetailClick, isLunas }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 190px space below, open upward
      setOpenUpward(spaceBelow < 190);
    }
    setIsOpen(!isOpen);
  };

  const handleAction = (actionName, type = 'info') => {
    setIsOpen(false);
    notify({
      type,
      title: `${actionName} Terpilih`,
      message: `Aksi ${actionName} untuk transaksi ${txNo} berhasil diproses.`
    });
  };

  const handleDetail = () => {
    setIsOpen(false);
    if (onDetailClick) {
      onDetailClick();
    }
  };

  return (
    <div className="relative inline-block text-left text-xs font-semibold" ref={dropdownRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="p-1 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-slate-700 transition-colors cursor-pointer"
      >
        <MoreHorizontal size={14} />
      </button>

      {isOpen && (
        <div className={`absolute right-0 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-40 w-52 font-semibold text-slate-700 animate-fade-in text-left ${
          openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          {/* Detail */}
          <button
            type="button"
            onClick={handleDetail}
            className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
          >
            <Eye size={13} className="text-slate-400 shrink-0" />
            <span>Detail</span>
          </button>

          {/* Terima */}
          {isLunas ? (
            <button
              type="button"
              disabled
              className="w-full text-left px-3.5 py-2 text-[11px] text-slate-300 bg-slate-50/10 cursor-not-allowed flex items-center gap-2 select-none"
            >
              <CheckCircle2 size={13} className="text-slate-250 shrink-0" />
              <span>Terima</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/transaksi/penjualan?tab=selesai');
              }}
              className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 size={13} className="text-slate-450 shrink-0" />
              <span>Terima</span>
            </button>
          )}

          {/* Pasangan Jurnal */}
          <button
            type="button"
            onClick={() => handleAction('Pasangan Jurnal')}
            className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
          >
            <ArrowLeftRight size={13} className="text-slate-400 shrink-0" />
            <span>Pasangan Jurnal</span>
          </button>

          {/* Hapus */}
          <div className="border-t border-slate-100 my-1" />
          <button
            type="button"
            onClick={() => handleAction('Hapus', 'error')}
            className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2 text-rose-600 hover:text-rose-700 font-bold"
          >
            <Trash2 size={13} className="text-rose-500 shrink-0" />
            <span>Hapus</span>
          </button>
        </div>
      )}
    </div>
  );
}
