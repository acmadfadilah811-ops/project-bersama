import React, { useState, useRef, useEffect } from 'react';
import { User, Plus, Printer, Percent, MessageSquare, Star, X, Send } from 'lucide-react';

export default function PosOrderPanel({
  cart = [],
  selectedCustomer,
  selectedStaffName,
  staffList = [],
  selectedPelayanId,
  onSelectStaff,
  totalAmount = 0,
  onOpenCustomerList,
  onOpenCustomerSelect,
  onSelectCustomerCandidate,
  onAddNewCustomerClick,
  onSelectItem,
  selectedCartItemKey,
  onPayClick,
  onVoidClick,
  onAddNoteClick,
  onDiscountClick,
  onRedeemPointClick,
  onShareWaClick,
}) {
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Total quantity calculation
  const totalQty = cart.reduce((sum, item) => sum + Number(item.qty || 0), 0);

  return (
    <div className="w-full lg:w-[420px] bg-white border-r border-slate-200 flex flex-col h-full shadow-sm shrink-0">
      {/* Customer Input Row SS 1 & SS 4 */}
      <div className="p-3 border-b border-slate-200 relative flex items-center justify-between gap-2 bg-white" ref={dropdownRef}>
        <button
          type="button"
          onClick={onOpenCustomerList}
          className="p-2 rounded-full bg-blue-50 text-[#0088FF] hover:bg-blue-100 transition-all cursor-pointer shrink-0"
          title="Tampil Daftar Pelanggan"
        >
          <User size={18} />
        </button>

        <div className="flex-1 text-center font-bold text-sm text-blue-600 relative">
          {selectedCustomer ? (
            <button
              type="button"
              onClick={onOpenCustomerList}
              className="hover:underline font-bold text-blue-600 cursor-pointer"
            >
              {selectedCustomer.nama || selectedCustomer.name}
            </button>
          ) : (
            <input
              type="text"
              placeholder="Pesanan Baru"
              value={customerQuery}
              onClick={onOpenCustomerList}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                onOpenCustomerList();
              }}
              onFocus={onOpenCustomerList}
              className="w-full text-center font-bold text-blue-600 placeholder:text-blue-600 focus:outline-none bg-transparent cursor-pointer"
            />
          )}
        </div>

        <button
          type="button"
          onClick={onAddNewCustomerClick || onOpenCustomerList}
          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer shrink-0"
          title="Tambah Customer Baru"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Item Table SS 1 & SS 4 */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {/* Table Header: Dark Grey SS 1 */}
        <div className="bg-[#555555] text-white text-xs font-bold px-4 py-2 flex justify-between items-center shrink-0">
          <span className="w-1/2">Item</span>
          <span className="w-1/4 text-center">Qty</span>
          <span className="w-1/4 text-right">Jumlah</span>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 text-xs font-bold">
              Belum ada item pesanan
            </div>
          ) : (
            cart.map((item) => {
              const isSelected = item.key === selectedCartItemKey;
              const hasMeteran = item.panjang > 0 && item.lebar > 0;
              const hasFinishing = item.finishingJenis && item.finishingJenis !== 'Polosan';
              const lineTotal = item.hargaTotal != null
                ? item.hargaTotal
                : (Number(item.harga) * Number(item.qty));

              return (
                <div
                  key={item.key}
                  onClick={() => onSelectItem(item)}
                  className={`p-2.5 rounded-lg flex items-center justify-between text-xs font-semibold cursor-pointer transition-all border ${
                    isSelected ? 'bg-blue-50 border-blue-300 shadow-sm' : 'hover:bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="w-1/2 min-w-0 pr-2">
                    <div className="font-bold text-slate-800 truncate">
                      {item.nama}
                    </div>
                    {hasMeteran && (
                      <span className="text-[10px] text-blue-600 font-bold block mt-0.5">
                        📐 {item.panjang}m × {item.lebar}m ({item.luas} m²)
                      </span>
                    )}
                    {hasFinishing && (
                      <span className="text-[10px] text-indigo-600 font-semibold block mt-0.5">
                        ✨ Finishing: {item.finishingJenis}
                      </span>
                    )}
                  </div>
                  <div className="w-1/4 text-center text-slate-500 font-semibold text-[11px]">
                    {item.qty} x {Number(item.harga).toLocaleString('id-ID')}
                  </div>
                  <div className="w-1/4 text-right font-bold text-slate-900 text-xs">
                    {lineTotal.toLocaleString('id-ID')}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary Footer Row SS 4 */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs flex justify-between items-center text-slate-600 font-medium shrink-0">
          <div>Jumlah Item: <span className="font-extrabold text-slate-800">{totalQty}</span> ({cart.length} jenis)</div>
          <div className="flex items-center gap-1">
            <span>Dilayani Oleh:</span>
            <select
              value={selectedPelayanId || ''}
              onChange={(e) => {
                const selectedId = e.target.value;
                const found = staffList.find((s) => String(s.id) === selectedId);
                if (onSelectStaff) onSelectStaff(found || { id: selectedId, nama: selectedId });
              }}
              className="font-bold text-blue-600 bg-transparent cursor-pointer border-b border-dashed border-blue-400 focus:outline-none text-xs"
            >
              {staffList.length === 0 ? (
                <option value="">{selectedStaffName || '-'}</option>
              ) : (
                staffList.map((staff) => (
                  <option key={staff.id || staff.nama} value={staff.id || staff.nama}>
                    {staff.nama}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons Toolbar SS 1 */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-1 text-[10px] text-slate-500 font-bold shrink-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onShareWaClick} className="flex flex-col items-center gap-1 cursor-pointer hover:text-[#25D366]">
            <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-sm">
              <Send size={15} />
            </div>
            <span>WhatsApp</span>
          </button>

          <button type="button" className="flex flex-col items-center gap-1 cursor-pointer hover:text-blue-600">
            <div className="w-8 h-8 rounded-full bg-[#0088FF] text-white flex items-center justify-center shadow-sm">
              <Printer size={16} />
            </div>
            <span>Cetak Cek</span>
          </button>

          <button type="button" onClick={onDiscountClick} className="flex flex-col items-center gap-1 cursor-pointer hover:text-blue-600">
            <div className="w-8 h-8 rounded-full bg-[#0088FF] text-white flex items-center justify-center shadow-sm">
              <Percent size={16} />
            </div>
            <span>Disc. Pesanan</span>
          </button>

          <button type="button" onClick={onAddNoteClick} className="flex flex-col items-center gap-1 cursor-pointer hover:text-blue-600">
            <div className="w-8 h-8 rounded-full bg-[#0088FF] text-white flex items-center justify-center shadow-sm">
              <MessageSquare size={16} />
            </div>
            <span>Catatan Pesanan</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onRedeemPointClick} className="flex flex-col items-center gap-1 cursor-pointer hover:text-blue-600">
            <div className="w-8 h-8 rounded-full bg-[#0088FF] text-white flex items-center justify-center shadow-sm">
              <Star size={16} />
            </div>
            <span>Tebus Point</span>
          </button>

          <button type="button" onClick={onVoidClick} className="flex flex-col items-center gap-1 cursor-pointer hover:text-red-600">
            <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm">
              <X size={16} />
            </div>
            <span>Void Pesanan</span>
          </button>
        </div>
      </div>

      {/* Big Green Payment Bar SS 1 & SS 4 */}
      <button
        type="button"
        onClick={onPayClick}
        disabled={cart.length === 0}
        className="w-full bg-[#388E3C] hover:bg-[#2E7D32] text-white py-3 px-4 font-black text-lg text-center shadow-inner cursor-pointer transition-all disabled:opacity-75 shrink-0"
      >
        Rp {Number(totalAmount).toLocaleString('id-ID')}
      </button>
    </div>
  );
}
