import { useState, useEffect } from 'react';
import { notify } from '../../../../utils/notify';

export default function UbahJatuhTempoModal({ isOpen, onClose, customer, onUpdate }) {
  const [days, setDays] = useState('30');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) setDays('30');
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await onUpdate?.(customer.id, days);
      onClose();
    } catch (error) {
      notify({ type: 'error', title: 'Gagal Memperbarui', message: error.response?.data?.detail || error.message || 'Jatuh tempo tidak dapat disimpan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[520px] overflow-hidden animate-scale-up">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
          <h4 className="text-sm font-bold text-slate-800">
            {customer.name} Tanggal Bayar
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-bold text-[10px] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              disabled={saving}
              className="px-3.5 py-1.5 bg-[#51a351] hover:bg-[#419241] text-white rounded-lg font-bold text-[10px] cursor-pointer"
            >
              {saving ? 'Menyimpan...' : 'Perbarui'}
            </button>
          </div>
        </div>

        {/* Modal Form */}
        <div className="p-6">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jatuh Tempo
            </label>
            <div className="flex border border-slate-205 rounded-lg overflow-hidden bg-white shadow-3xs">
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="Masukkan jumlah hari jatuh tempo"
                className="flex-1 px-3 py-2 outline-none text-xs font-semibold"
              />
              <span className="px-3 py-2 bg-slate-50 text-slate-400 font-bold border-l border-slate-205 select-none">
                Hari
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
