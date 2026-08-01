import React, { useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';

export default function OrderNoteModal({
  isOpen,
  onClose,
  initialNote = '',
  onSaveNote,
}) {
  const [catatan, setCatatan] = useState(initialNote);

  useEffect(() => {
    if (isOpen) {
      setCatatan(initialNote || '');
    }
  }, [isOpen, initialNote]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveNote(catatan.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header Blue Bar SS */}
        <div className="bg-[#0088FF] px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <MessageSquare size={20} />
            </div>
            <h3 className="font-extrabold text-base tracking-wide">Catatan Pesanan</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Body SS */}
        <form onSubmit={handleSubmit} className="p-7 space-y-7 bg-white text-sm">
          {/* Input Catatan */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-2">
              Catatan
            </label>
            <input
              type="text"
              placeholder="Masukkan catatan pesanan..."
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full border-b-2 border-blue-500 pb-2 text-sm font-bold text-slate-900 focus:outline-none bg-transparent"
              autoFocus
            />
          </div>

          {/* Action Button SS */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer text-center"
            >
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
