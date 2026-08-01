import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, X, MoreVertical, Eye, Edit, Trash2 } from 'lucide-react';

export default function PosCustomerListPanel({
  contacts = [],
  onSelectCustomer,
  onViewCustomerProfile,
  onEditCustomerProfile,
  onDeleteCustomerProfile,
  onAddNewCustomer,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter contacts by search query
  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase();
    const nama = (c.nama || c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.telepon || c.nomor_wa || '').toLowerCase();
    return nama.includes(q) || email.includes(q) || phone.includes(q);
  });

  const displayList = filteredContacts;

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden border-l border-slate-200">
      {/* Blue Header Bar (Matching New Screenshot) */}
      <div className="bg-[#0088FF] px-4 py-3 text-white flex items-center justify-between shadow-sm shrink-0 gap-3">
        {/* Left: Light Blue '+' Button */}
        <button
          type="button"
          onClick={onAddNewCustomer}
          className="w-8 h-8 rounded bg-[#00A0FF] hover:bg-blue-400 text-white flex items-center justify-center font-bold transition-all cursor-pointer shrink-0 shadow-sm"
          title="Tambah Pelanggan Baru"
        >
          <Plus size={18} />
        </button>

        {/* Center: Search Bar 'Cari Pelanggan...' */}
        <div className="flex-1 max-w-md bg-white rounded-md px-3 py-1.5 flex items-center gap-2 shadow-inner">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Cari Pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
        </div>

        {/* Right: Close 'X' Button */}
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer shrink-0"
          title="Tutup Daftar Pelanggan"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Body: Customer List Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white" ref={dropdownRef}>
        {displayList.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold">
            {searchQuery ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
          </div>
        )}
        {displayList.map((customer) => {
          const id = customer.id || customer.nomor_wa || customer.nama;
          const isDropdownOpen = openDropdownId === id;
          const isHighlight = customer.isHighlight || customer.tipe_pelanggan?.includes('gold');

          // Initials calculation
          const nameStr = customer.nama || customer.name || 'Customer';
          const words = nameStr.trim().split(' ');
          const initials = words.length > 1
            ? `${words[0][0]}${words[1][0]}`.toUpperCase()
            : nameStr.slice(0, 2).toUpperCase();

          return (
            <div
              key={id}
              className="flex items-center justify-between p-3 rounded-lg border-b border-slate-100 hover:bg-slate-50/80 transition-all relative group cursor-pointer"
            >
              {/* Row Left & Details (Clicking selects customer) */}
              <div
                onClick={() => onSelectCustomer(customer)}
                className="flex items-center gap-3.5 flex-1 min-w-0"
              >
                {/* Avatar Circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm ${
                    customer.avatarBg || (isHighlight ? 'bg-teal-500' : 'bg-emerald-500')
                  }`}
                >
                  {customer.avatarText || initials}
                </div>

                {/* Info Text */}
                <div className="min-w-0">
                  <h5
                    className={`text-xs truncate ${
                      isHighlight ? 'font-black text-rose-600' : 'font-extrabold text-slate-900'
                    }`}
                  >
                    {nameStr}
                  </h5>
                  <div className="text-[11px] text-slate-600 font-semibold mt-0.5 truncate">
                    E. {customer.email || '-'} P.{customer.telepon || customer.nomor_wa || '-'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {customer.tipe_pelanggan || 'Guest'}
                  </div>
                </div>
              </div>

              {/* Row Right: 3 Vertical Dots Menu Icon */}
              <div className="relative shrink-0 ml-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenDropdownId(isDropdownOpen ? null : id);
                  }}
                  className="p-1.5 hover:bg-slate-200/60 rounded-full text-slate-600 transition-all cursor-pointer"
                  title="Opsi Customer"
                >
                  <MoreVertical size={16} />
                </button>

                {/* Row 3-Dots Dropdown Menu: Lihat, Ubah, Hapus */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-slate-700 animate-fade-in">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(null);
                        onViewCustomerProfile(customer);
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <Eye size={14} className="text-blue-500" /> Lihat
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(null);
                        onEditCustomerProfile(customer);
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer"
                    >
                      <Edit size={14} className="text-amber-500" /> Ubah
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(null);
                        onDeleteCustomerProfile(customer);
                      }}
                      className="w-full px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 flex items-center gap-2 text-rose-600 cursor-pointer border-t border-slate-100"
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
