import { FileText, X } from 'lucide-react';
import dayjs from 'dayjs';

export default function LogJurnalDescriptionModal({ log, onClose }) {
  if (!log) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-4 relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[#0088E8]">
            <FileText size={18} />
            <h3 className="text-sm font-bold text-slate-900">Deskripsi Log Jurnal</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">No. Transaksi</span>
            <span className="font-bold text-[#0088E8]">{log.no_transaksi}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Tanggal</span>
            <span className="font-semibold text-slate-800">{dayjs(log.tanggal).format('DD MMMM YYYY HH:mm')}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Log Aksi</span>
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">{log.log_aksi}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Diproses Oleh</span>
            <span className="font-semibold text-slate-800">{log.diproses_oleh}</span>
          </div>
          <div className="pt-2">
            <label className="text-slate-500 font-medium block mb-1">Deskripsi Lengkap:</label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed text-xs font-mono whitespace-pre-wrap">
              {log.deskripsi}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
