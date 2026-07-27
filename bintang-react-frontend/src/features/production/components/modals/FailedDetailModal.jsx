import { X, AlertOctagon } from 'lucide-react';

export default function FailedDetailModal({ job, orderInfo, onClose }) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-rose-600 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertOctagon size={18} />
            <h2 className="font-bold text-sm font-sans">Detail Kegagalan Produksi</h2>
          </div>
          <button onClick={onClose} className="text-rose-100 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-slate-800">
                {orderInfo?.customerName || 'Memuat...'}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                #{orderInfo?.orderId || '-'}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-600">
              Produk: {orderInfo?.jenisProduk || '-'}
            </p>
          </div>

          <div>
            <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-1">
              Alasan Kegagalan / Pembatalan:
            </span>
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-4 text-xs font-semibold leading-relaxed whitespace-pre-line">
              {job.alasan_gagal || 'Tidak ada alasan kegagalan yang diinput.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg shadow-sm transition-all"
          >
            Tutup Detail
          </button>
        </div>
      </div>
    </div>
  );
}
