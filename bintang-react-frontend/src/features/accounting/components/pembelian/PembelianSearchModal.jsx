import { useState } from 'react';
import { X, Search } from 'lucide-react';

export default function PembelianSearchModal({ isOpen, onClose, initialFilter, onApply }) {
  const [keyword, setKeyword] = useState(initialFilter?.keyword || '');
  const [amount, setAmount] = useState(initialFilter?.amount || '');
  const [showDeleted, setShowDeleted] = useState(initialFilter?.showDeleted || false);

  if (!isOpen) return null;

  const handleReset = () => {
    setKeyword('');
    setAmount('');
    setShowDeleted(false);
  };

  const handleApply = () => {
    onApply({ keyword, amount, showDeleted });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[440px] overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Search size={14} className="text-[#0088E8]" />
            <span>Pencarian Pintar</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-5 space-y-4">
          
          {/* Keyword */}
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">No Transaksi / Supplier</label>
            <input
              type="text"
              placeholder="Masukkan nomor transaksi atau supplier..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] transition-colors bg-white font-medium"
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <label className="text-slate-650 font-bold">Total Pembelian (IDR)</label>
            <input
              type="number"
              placeholder="Masukkan nominal..."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] transition-colors bg-white font-medium"
            />
          </div>

          {/* Show Deleted Checkbox */}
          <div className="flex items-center gap-2 pt-1.5">
            <input
              type="checkbox"
              id="showDeletedCheck"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8]/30 cursor-pointer"
            />
            <label htmlFor="showDeletedCheck" className="text-slate-600 cursor-pointer select-none">
              Tampilkan data terhapus
            </label>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors font-bold cursor-pointer"
          >
            Hapus Semua Filter
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg font-bold cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Cari
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
