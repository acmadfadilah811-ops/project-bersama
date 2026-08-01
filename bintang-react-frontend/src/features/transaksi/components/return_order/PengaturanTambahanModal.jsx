import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * Modal Pop-Up "Tambahan" — Presisi SS No. 3
 */
export default function PengaturanTambahanModal({ isOpen, onClose, onSave, currentTambahan = 0, currentDeskripsi = '' }) {
  const [deskripsi, setDeskripsi] = useState(currentDeskripsi);
  const [jumlah, setJumlah] = useState(currentTambahan);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave?.({
      deskripsi,
      jumlah: Number(jumlah) || 0,
    });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-700">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Tambahan</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs font-semibold">
          {/* Deskripsi */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Deskripsi</label>
            <textarea
              rows={3}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl p-3 text-slate-800 focus:outline-none resize-none"
            />
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Jumlah</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-500">
                Rp.
              </span>
              <input
                type="number"
                min={0}
                value={jumlah}
                onChange={(e) => setJumlah(Number(e.target.value) || 0)}
                className="w-full text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 px-5 py-2 cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-6 py-2 cursor-pointer transition-colors shadow-2xs"
            >
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
