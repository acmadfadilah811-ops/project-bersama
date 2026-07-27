import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';

export default function HapusTransaksiModal({ isOpen, onClose, entryNumber, onDeleted }) {
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async () => {
    if (!reason.trim()) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/accounting/journal-entries/${entryNumber}/`, {
        data: { reason: reason.trim() }
      });
      notifySuccess('Berhasil', `Transaksi ${entryNumber} berhasil dihapus.`);
      onDeleted?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus transaksi');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 flex flex-col">
        {/* Title */}
        <h3 className="text-sm font-bold text-slate-800 mb-5 text-center">
          Hapus {entryNumber}
        </h3>

        {/* Text Area Catatan */}
        <div className="space-y-1 mb-6">
          <label className="block text-[11px] font-bold text-slate-500">
            Catatan Penghapusan <span className="text-rose-500">*</span>
          </label>
          <textarea
            placeholder="Masukkan alasan atau catatan penghapusan transaksi..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs min-w-24"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || !reason.trim()}
            className="px-6 py-2 bg-[#EF5350] hover:bg-[#E53935] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs min-w-24 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {deleting && <Loader2 size={12} className="animate-spin" />}
            <span>Hapus</span>
          </button>
        </div>
      </div>
    </div>
  );
}
