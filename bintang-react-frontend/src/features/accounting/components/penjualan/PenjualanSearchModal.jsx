import { X } from 'lucide-react';

export default function PenjualanSearchModal({ isOpen, onClose, onApply, initialFilter }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[520px] overflow-hidden relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-slate-650 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Filter Pencarian</h3>

          {/* Search keyword input */}
          <div className="grid grid-cols-3 gap-2 items-center">
            <label className="text-slate-550 font-bold">Cari</label>
            <div className="col-span-2">
              <input
                type="text"
                id="searchKeywordInput"
                placeholder="No. Transaksi/Nama Pelanggan"
                defaultValue={initialFilter.keyword || ''}
                className="w-full px-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Total Pesanan IDR input */}
          <div className="grid grid-cols-3 gap-2 items-center">
            <label className="text-slate-550 font-bold">Total Pesanan</label>
            <div className="col-span-2 flex border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:border-[#0088E8]">
              <div className="px-3 bg-slate-50 border-r border-slate-200 flex items-center justify-center font-bold text-slate-450 text-[10px]">
                IDR
              </div>
              <input
                type="number"
                id="searchAmountInput"
                placeholder="0,00"
                defaultValue={initialFilter.amount || ''}
                className="flex-1 px-3 py-1.5 outline-none text-xs text-slate-800 font-semibold"
              />
            </div>
          </div>

          {/* Show Deleted checkbox */}
          <div className="grid grid-cols-3 gap-2 items-center">
            <label className="text-slate-550 font-bold">Tampilkan data yang dihapus</label>
            <div className="col-span-2">
              <input
                type="checkbox"
                id="showDeletedInput"
                defaultChecked={initialFilter.showDeleted || false}
                className="rounded border-slate-300 cursor-pointer"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                const keyword = document.getElementById('searchKeywordInput')?.value || '';
                const amount = document.getElementById('searchAmountInput')?.value || '';
                const showDeleted = document.getElementById('showDeletedInput')?.checked || false;
                onApply({ keyword, amount, showDeleted });
              }}
              className="px-8 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Filter
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
