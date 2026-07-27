import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';

export default function HapusAkunModal({ isOpen, onClose, account, onDeleted }) {
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !account) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/accounting/accounts/${account.id}/`);
      notifySuccess('Berhasil', `Akun ${account.code} - ${account.name} berhasil dihapus.`);
      onDeleted?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus akun. Pastikan akun tidak terikat transaksi/jurnal aktif.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-lg w-full p-8 flex flex-col items-center text-center">
        {/* Title */}
        <h3 className="text-sm font-bold text-slate-800 tracking-wider mb-6">PERINGATAN</h3>

        {/* Warning Text */}
        <div className="space-y-2 mb-8">
          <p className="text-xs text-slate-600 font-semibold">
            Apakah anda yakin akan menghapus Akun
          </p>
          <p className="text-xs font-bold text-slate-800">
            {account.code} {account.name}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs min-w-24"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
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
