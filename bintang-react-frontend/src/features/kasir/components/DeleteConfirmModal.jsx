import React from 'react';
import { HelpCircle, X } from 'lucide-react';

export default function DeleteConfirmModal({
  isOpen,
  title = 'Hapus Item',
  message = 'Apakah anda yakin ingin menghapus item ini?',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header Blue Bar */}
        <div className="bg-[#0088FF] px-5 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle size={18} />
            <h3 className="font-extrabold text-sm tracking-wide">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-center space-y-6">
          <p className="text-xs font-bold text-slate-700">
            {message}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onConfirm}
              className="px-8 py-2 rounded bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              Ya
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-8 py-2 rounded bg-[#555555] hover:bg-slate-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
