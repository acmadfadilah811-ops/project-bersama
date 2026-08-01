import React from 'react';
import { UserPlus, X } from 'lucide-react';

export default function AddCustomerConfirmModal({ isOpen, customerName, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 relative flex flex-col items-center text-center transform scale-100 transition-all duration-300">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 transition-all cursor-pointer"
        >
          <X size={16} />
        </button>

        <div className="p-4 rounded-full bg-indigo-50 text-indigo-600 mb-4">
          <UserPlus size={28} />
        </div>

        <h3 className="text-base font-extrabold text-slate-900 mb-1">
          Lanjut Tambahkan Customer?
        </h3>

        <p className="text-xs text-slate-600 font-semibold mb-6">
          Gunakan <span className="font-bold text-indigo-600">{customerName || 'Customer'}</span> untuk transaksi pesanan baru ini?
        </p>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
          >
            Tidak
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            Ya
          </button>
        </div>
      </div>
    </div>
  );
}
