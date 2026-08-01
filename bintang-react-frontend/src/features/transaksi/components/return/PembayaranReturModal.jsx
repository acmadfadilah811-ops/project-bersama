import { useState } from 'react';

/**
 * Modal Pop-Up "pembayaran Retur" — Presisi SS No. 4
 */
export default function PembayaranReturModal({ isOpen, onClose, onSave, totalAmount = 0 }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [akunId, setAkunId] = useState('11101');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const fmtRpFormatted = (num) => {
    const val = Math.round(Number(num) || 0);
    return `Rp. ${val.toLocaleString('id-ID')},00`;
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave?.({
        tanggal,
        payment_account_id: akunId,
        nominal: totalAmount,
      });
      onClose?.();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-700">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">pembayaran Retur</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 py-1.5 cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-4 py-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Bayar'}
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs font-semibold">
          {/* Tanggal Pembayaran */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Tanggal pembayaran</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Akun Pembayaran */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Akun Pembayaran</label>
            <select
              value={akunId}
              onChange={(e) => setAkunId(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
            >
              <option value="11101">11101 Kas</option>
              <option value="11102">11102 Bank BCA</option>
              <option value="11103">11103 Bank Mandiri</option>
            </select>
          </div>

          {/* Total Pembayaran */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Total Pembayaran</label>
            <input
              type="text"
              readOnly
              value={fmtRpFormatted(totalAmount)}
              className="w-full text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none cursor-default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
