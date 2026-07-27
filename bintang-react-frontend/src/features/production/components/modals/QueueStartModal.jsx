import { X, Play, MessageCircle } from 'lucide-react';

export default function QueueStartModal({ job, orderInfo, onSubmit, onClose }) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-blue-600 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Play size={18} className="fill-current animate-pulse" />
            <h2 className="font-bold text-sm">Mulai Pekerjaan Baru</h2>
          </div>
          <button onClick={onClose} className="text-blue-100 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-base font-extrabold text-slate-800">
                {orderInfo?.customerName || 'Memuat...'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 font-bold">
                #{orderInfo?.orderId || '-'}
              </span>
            </div>

            <p className="text-xs font-bold text-indigo-700">
              Produk: {orderInfo?.jenisProduk || '-'}
            </p>

            {orderInfo?.nomorWa && (
              <div className="pt-1">
                <a
                  href={`https://wa.me/${orderInfo.nomorWa.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
                >
                  <MessageCircle size={10} className="shrink-0" />
                  WA: {orderInfo.nomorWa}
                </a>
              </div>
            )}
          </div>

          {/* Keterangan CS */}
          {orderInfo?.keteranganDetail && (
            <div>
              <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-1">
                Keterangan Khusus CS (Finishing)
              </span>
              <div className="bg-amber-50/50 border border-amber-200 text-slate-700 rounded-lg p-3 text-xs leading-relaxed">
                {orderInfo.keteranganDetail}
              </div>
            </div>
          )}

          {/* Catatan Pelanggan */}
          {orderInfo?.catatanPelanggan && (
            <div>
              <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-1">
                Catatan Pelanggan
              </span>
              <div className="bg-slate-50 border border-slate-200 text-slate-600 italic rounded-lg p-3 text-xs leading-relaxed">
                {orderInfo.catatanPelanggan}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500 text-center pt-2">
            Klik tombol di bawah untuk mengubah status pekerjaan ini menjadi{' '}
            <strong>Dikerjakan</strong>.
          </p>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-all flex items-center gap-1.5"
          >
            <Play size={12} className="fill-current" /> Mulai Kerjakan
          </button>
        </div>
      </div>
    </div>
  );
}
