import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { notify } from '../../../../utils/notify';

export default function TambahJurnalDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (formName) => {
    setIsOpen(false);
    const activeModule = searchParams.get('active') || 'receivable';
    if (formName === 'Form Jurnal Tunggal') {
      if (activeModule === 'payable') {
        setSearchParams({ active: 'payable', subMenu: 'hutang-jurnal-tunggal' });
      } else {
        setSearchParams({ active: 'receivable', subMenu: 'jurnal-tunggal' });
      }
      notify({
        type: 'success',
        title: 'Membuka Form Jurnal',
        message: 'Form Jurnal Tunggal berhasil dibuka.'
      });
    } else if (formName === 'Form Multi Jurnal') {
      if (activeModule === 'payable') {
        setSearchParams({ active: 'payable', subMenu: 'hutang-multi-jurnal' });
      } else {
        setSearchParams({ active: 'receivable', subMenu: 'multi-jurnal' });
      }
      notify({
        type: 'success',
        title: 'Membuka Form Jurnal',
        message: 'Form Multi Jurnal berhasil dibuka.'
      });
    } else {
      notify({
        type: 'info',
        title: 'Form Jurnal Dipilih',
        message: `Membuka ${formName}... (Fokus UI saat ini)`
      });
    }
  };

  return (
    <div className="relative inline-block text-left text-xs font-semibold" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg shadow-2xs transition-colors cursor-pointer text-[10px] font-extrabold uppercase tracking-wide"
      >
        <span>Tambah Jurnal</span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-40 w-44 font-semibold text-slate-700 animate-fade-in">
          <button
            type="button"
            onClick={() => handleSelect('Form Jurnal Tunggal')}
            className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Form Jurnal Tunggal
          </button>
          <button
            type="button"
            onClick={() => handleSelect('Form Multi Jurnal')}
            className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Form Multi Jurnal
          </button>
        </div>
      )}
    </div>
  );
}
