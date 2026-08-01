import React, { useState, useRef, useEffect } from 'react';
import { Menu, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export default function PosHeaderBar({
  storeName,
  accountName,
  selectedCustomer,
  onViewCustomer,
  onEditCustomer,
  onDeleteCustomer,
  onToggleSidebar,
}) {
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const displayName = accountName || user?.nama_lengkap || user?.first_name || user?.username || storeName || '-';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="bg-white text-slate-800 h-12 px-4 flex items-center justify-between border-b border-slate-200 shadow-xs relative z-40 shrink-0 select-none">
      {/* Left: Hamburger Icon (Setrip 3) */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
        title="Toggle Menu"
      >
        <Menu size={20} />
      </button>

      {/* Center: Account Name */}
      <h1 className="font-extrabold text-base tracking-wide text-slate-800 text-center">
        {displayName}
      </h1>

      {/* Right: 3 Vertical Dots Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer"
          title="Opsi Pelanggan / Akun"
        >
          <MoreVertical size={20} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-700 animate-fade-in">
            <button
              onClick={() => {
                setShowDropdown(false);
                onViewCustomer();
              }}
              className="w-full px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
            >
              <Eye size={14} className="text-blue-500" /> Lihat
            </button>
            <button
              onClick={() => {
                setShowDropdown(false);
                onEditCustomer();
              }}
              className="w-full px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
            >
              <Edit size={14} className="text-amber-500" /> Ubah
            </button>
            <button
              onClick={() => {
                setShowDropdown(false);
                onDeleteCustomer();
              }}
              className="w-full px-4 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-rose-600 cursor-pointer border-t border-slate-100"
            >
              <Trash2 size={14} /> Hapus
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
