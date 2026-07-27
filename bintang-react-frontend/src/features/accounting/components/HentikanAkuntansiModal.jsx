import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function HentikanAkuntansiModal({ isOpen, onClose, onConfirm, loading }) {
  const [deleteData, setDeleteData] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onConfirm({ deleteData });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative flex flex-col">
        {/* Tombol Tutup X */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
          aria-label="Tutup"
        >
          <X size={18} />
        </button>

        {/* Title / Label */}
        <label className="text-xs font-bold text-slate-700 mb-3 block">
          Hapus data akuntansi
        </label>

        {/* Options Row */}
        <div className="flex gap-3 mb-6">
          {/* Option: Tidak */}
          <button
            type="button"
            onClick={() => setDeleteData(false)}
            disabled={loading}
            className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-md border text-xs font-bold transition-all cursor-pointer ${
              !deleteData
                ? 'border-[#0088E8] text-[#0088E8] bg-sky-50/30'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                !deleteData ? 'border-[#0088E8]' : 'border-slate-300'
              }`}
            >
              {!deleteData && <div className="w-2 h-2 rounded-full bg-[#0088E8]" />}
            </div>
            <span>Tidak</span>
          </button>

          {/* Option: Ya */}
          <button
            type="button"
            onClick={() => setDeleteData(true)}
            disabled={loading}
            className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-md border text-xs font-bold transition-all cursor-pointer ${
              deleteData
                ? 'border-[#0088E8] text-[#0088E8] bg-sky-50/30'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                deleteData ? 'border-[#0088E8]' : 'border-slate-300'
              }`}
            >
              {deleteData && <div className="w-2 h-2 rounded-full bg-[#0088E8]" />}
            </div>
            <span>Ya</span>
          </button>
        </div>

        {/* Tombol Hentikan Sekarang */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2.5 px-4 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          <span>Hentikan Sekarang</span>
        </button>
      </div>
    </div>
  );
}
