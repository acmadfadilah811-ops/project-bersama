import React, { useState, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';

export default function VoidOrderModal({
  isOpen,
  onClose,
  onConfirmVoid,
}) {
  const [alasan, setAlasan] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAlasan('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!alasan.trim()) {
      alert('Alasan pembatalan pesanan wajib diisi.');
      return;
    }
    onConfirmVoid(alasan.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header Red Bar SS 2 */}
        <div className="bg-red-600 px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <Trash2 size={20} />
            </div>
            <h3 className="font-extrabold text-base tracking-wide">Void / Refund Pesanan</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Body SS 2 */}
        <form onSubmit={handleSubmit} className="p-7 space-y-7 bg-white text-sm">
          {/* Input Alasan */}
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-2">
              Alasan Pembatalan / Refund
            </label>
            <input
              type="text"
              placeholder="Masukkan alasan pembatalan atau refund..."
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="w-full border-b-2 border-blue-500 pb-2 text-sm font-bold text-slate-900 focus:outline-none bg-transparent"
              required
              autoFocus
            />
            <span className="text-xs text-slate-400 font-semibold block mt-1.5">
              Apakah alasan pembatalan atau refund pesanan ini?
            </span>
          </div>

          {/* Action Button SS 2 */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm shadow-lg shadow-red-500/20 transition-all cursor-pointer text-center"
            >
              Lakukan Void / Refund
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
