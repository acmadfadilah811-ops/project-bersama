import React, { useState, useRef, useEffect } from 'react';
import { Plus, Search, X, MoreVertical, Eye, Edit, Trash2, MessageCircle } from 'lucide-react';

/** Daftar pelanggan untuk dipilih Kasir.
 *
 * Sebelumnya cuma baca Contact (kontak WA/riwayat order, di produksi cuma
 * 6 baris) -- 356+ pelanggan master data (Agen/MOU) tidak pernah muncul di
 * sini (bug ditemukan user 2026-09-07). Sekarang `customers` adalah hasil
 * /customers/ berpaginasi+pencarian server (bisa ratusan/ribuan baris, aman
 * untuk query -- bukan fetch-all). `pinnedContacts` adalah Contact WA-only
 * yang belum tertaut Customer manapun -- jumlahnya kecil (riwayat order WA
 * lama), ditampilkan terpisah di atas tanpa ikut hitungan halaman.
 * Pilih kartu Customer -> parent (PosTerminal.jsx) resolve/buat Contact
 * lewat /customers/{id}/resolve-contact/ sebelum dipakai transaksi. */
export default function PosCustomerListPanel({
  customers = [],
  pinnedContacts = [],
  onSelectCustomer,
  onViewCustomerProfile,
  onEditCustomerProfile,
  onDeleteCustomerProfile,
  onAddNewCustomer,
  onClose,
  searchQuery = '',
  onSearchChange,
  page = 1,
  pageSize = 40,
  totalCount = 0,
  onPageChange,
}) {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const dropdownRef = useRef(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const q = searchQuery.toLowerCase();
  const filteredPinned = pinnedContacts.filter((c) => {
    const nama = (c.nama || '').toLowerCase();
    const phone = (c.nomor_wa || '').toLowerCase();
    return !q || nama.includes(q) || phone.includes(q);
  });

  const renderRow = (customer, kind) => {
    const id = kind === 'contact' ? customer.nomor_wa : `customer-${customer.id}`;
    const isDropdownOpen = openDropdownId === id;
    const isHighlight = customer.customer_group_nama?.toLowerCase().includes('gold');
    const punyaHp = kind === 'contact' ? Boolean(customer.nomor_wa) : Boolean(customer.handphone);

    const nameStr = customer.nama || 'Customer';
    const words = nameStr.trim().split(' ');
    const initials = words.length > 1
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : nameStr.slice(0, 2).toUpperCase();

    return (
      <div
        key={id}
        className="flex items-center justify-between p-3 rounded-lg border-b border-slate-100 hover:bg-slate-50/80 transition-all relative group cursor-pointer"
      >
        <div
          onClick={() => onSelectCustomer(customer, kind)}
          className="flex items-center gap-3.5 flex-1 min-w-0"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-sm ${
              isHighlight ? 'bg-teal-500' : 'bg-emerald-500'
            }`}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <h5
              className={`text-xs truncate flex items-center gap-1.5 ${
                isHighlight ? 'font-black text-rose-600' : 'font-extrabold text-slate-900'
              }`}
            >
              {nameStr}
              {kind === 'contact' && (
                <span className="text-[8px] bg-sky-50 text-sky-600 border border-sky-200 px-1 py-0.5 rounded font-black uppercase tracking-wider shrink-0 flex items-center gap-0.5">
                  <MessageCircle size={9} /> WA
                </span>
              )}
              {!punyaHp && (
                <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                  Tanpa No. HP
                </span>
              )}
            </h5>
            <div className="text-[11px] text-slate-600 font-semibold mt-0.5 truncate">
              E. {customer.email || '-'} P.{customer.nomor_wa || customer.handphone || '-'}
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
              {customer.customer_group_nama || 'Guest'}
            </div>
          </div>
        </div>

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

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 text-slate-700 animate-fade-in">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdownId(null);
                  onViewCustomerProfile(customer, kind);
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
                  onEditCustomerProfile(customer, kind);
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
                  onDeleteCustomerProfile(customer, kind);
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
  };

  const isEmpty = filteredPinned.length === 0 && customers.length === 0;

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
            onChange={(e) => onSearchChange(e.target.value)}
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
        {isEmpty && (
          <div className="h-full flex items-center justify-center text-slate-300 text-xs font-bold">
            {searchQuery ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}
          </div>
        )}

        {filteredPinned.length > 0 && (
          <div>
            <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 px-1">
              Kontak WA (belum di data Pelanggan)
            </div>
            {filteredPinned.map((c) => renderRow(c, 'contact'))}
          </div>
        )}

        {customers.length > 0 && (
          <div>
            {filteredPinned.length > 0 && (
              <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 px-1 pt-2">
                Data Pelanggan
              </div>
            )}
            {customers.map((c) => renderRow(c, 'customer'))}
          </div>
        )}
      </div>

      {/* Paginasi -- cuma untuk daftar Customer (master data), Kontak WA di
          atas jumlahnya kecil & tidak ikut dipaginasi. */}
      {totalCount > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
          <span>{totalCount} pelanggan</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2 py-1 cursor-pointer"
            >
              &lt;
            </button>
            <span>{page}/{totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2 py-1 cursor-pointer"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
