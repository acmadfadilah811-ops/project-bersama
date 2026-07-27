import { useState } from 'react';
import { Calendar } from 'lucide-react';

const inputClass =
  'w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300';

/**
 * Modal pencatatan pembayaran pembelian (mendukung cicilan/DP).
 * Isi tanggal + nominal; nominal boleh sebagian dari sisa tagihan.
 */
export default function PembelianPembayaranModal({ sisa = 0, onClose, onSave }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tanggal, setTanggal] = useState(today);
  const [nominal, setNominal] = useState('');
  const [saving, setSaving] = useState(false);

  const nominalNum = Number(nominal) || 0;
  const canSave = nominalNum > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave?.({ tanggal, nominal: nominalNum });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-12 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Pembayaran</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={`text-sm font-semibold rounded-lg px-5 py-2 transition-colors ${
                canSave
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Simpan
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <span className="font-semibold text-slate-500">Sisa Tagihan</span>
            <span className="font-bold text-slate-800 font-mono">Rp {Number(sisa).toLocaleString('id-ID')}</span>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Tanggal Pembayaran</label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1.5">Nominal Pembayaran</label>
            <input
              type="number"
              min="0"
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
            {sisa > 0 && (
              <button
                type="button"
                onClick={() => setNominal(String(sisa))}
                className="mt-1.5 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                Bayar penuh (Rp {Number(sisa).toLocaleString('id-ID')})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
