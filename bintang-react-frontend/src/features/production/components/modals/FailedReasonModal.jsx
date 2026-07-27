import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function FailedReasonModal({ job, orderInfo, onSubmit, onClose }) {
  const [reason, setReason] = useState('');

  if (!job) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Alasan kegagalan wajib diisi.');
      return;
    }
    onSubmit(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-amber-500 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} />
            <h2 className="font-bold text-sm">Konfirmasi Pembatalan / Gagal</h2>
          </div>
          <button onClick={onClose} className="text-amber-100 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <p className="text-xs text-slate-600">
              Anda menandai pekerjaan{' '}
              <strong>
                #{orderInfo?.orderId || '-'} ({orderInfo?.customerName})
              </strong>{' '}
              sebagai <strong>Gagal Produksi / Batal</strong>. Silakan masukkan penjelasan mengapa
              pekerjaan ini dihentikan di tengah jalan.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan / Keterangan Pembatalan <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Misal: Bahan sobek saat dicetak, mesin overheat, file eror, atau customer membatalkan pesanan..."
                required
                rows={4}
                className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              Kembali
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition-all"
            >
              Simpan & Tandai Gagal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
