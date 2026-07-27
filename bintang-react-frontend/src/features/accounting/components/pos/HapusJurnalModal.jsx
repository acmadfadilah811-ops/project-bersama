import { useState } from 'react';
import { notify } from '../../../../utils/notify';

export default function HapusJurnalModal({ isOpen, onClose, txNo, onDeleteConfirm }) {
  if (!isOpen) return null;

  const [notes, setNotes] = useState('');

  const handleDeleteClick = () => {
    if (!notes.trim()) {
      notify({
        type: 'warning',
        title: 'Isian Kosong',
        message: 'Catatan penghapusan wajib diisi.'
      });
      return;
    }

    if (onDeleteConfirm) {
      onDeleteConfirm(notes);
    }
    notify({
      type: 'success',
      title: 'Data Dihapus',
      message: `Transaksi ${txNo} berhasil dihapus dari sistem.`
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[520px] overflow-hidden animate-scale-up">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-150 bg-[#F8FAFC] text-center select-none">
          <h4 className="text-sm font-bold text-slate-800">
            Hapus {txNo}
          </h4>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-4">
          
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-bold">
              Catatan Penghapusan <span className="text-[#E11D48]">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Masukkan alasan/catatan penghapusan transaksi ini..."
              className="w-full px-3 py-2 border border-slate-205 rounded-lg bg-white outline-none focus:border-[#0088E8] shadow-3xs resize-y text-xs font-semibold"
            />
          </div>

        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-1 text-slate-400 font-bold">
            <span className="text-[#E11D48]">*</span>
            <span>Harus diisi</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-bold text-[11px] cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-4 py-1.5 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg shadow-2xs font-bold text-[11px] cursor-pointer transition-colors"
            >
              Hapus
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
