import { useState } from 'react';
import { X } from 'lucide-react';

export default function ReturPenjualanFilterModal({ isOpen, onClose, onApply }) {
  const [searchVal, setSearchVal] = useState('');
  const [totalOrder, setTotalOrder] = useState('');

  if (!isOpen) return null;

  const handleApply = () => {
    onApply({ searchVal, totalOrder });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[480px] p-5 space-y-5 relative animate-scale-up">
        
        {/* Close Button top-right */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>

        {/* Inputs */}
        <div className="space-y-4 pt-3">
          {/* Cari */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-right text-slate-500 font-bold">Cari</span>
            <input
              type="text"
              placeholder="No. Pengembalian/Nama Pelanggan"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-md outline-none focus:border-[#0088E8] text-xs font-medium bg-white"
            />
          </div>

          {/* Total Pesanan */}
          <div className="flex items-center gap-3">
            <span className="w-24 text-right text-slate-500 font-bold">Total Pesanan</span>
            <div className="flex-1 flex border border-slate-205 rounded-md overflow-hidden bg-white">
              <span className="px-3 py-1.5 bg-slate-50 text-slate-500 font-bold border-r border-slate-205 select-none">
                IDR
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={totalOrder}
                onChange={(e) => setTotalOrder(e.target.value)}
                className="flex-1 px-3 py-1.5 outline-none focus:border-[#0088E8] text-xs font-medium"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={handleApply}
            className="px-8 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg text-xs cursor-pointer transition-colors shadow-2xs"
          >
            Filter
          </button>
        </div>

      </div>
    </div>
  );
}
