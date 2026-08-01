import { useState } from 'react';
import { X } from 'lucide-react';

export default function PembelianPengirimanModal({ currentVal, onClose, onSave }) {
  const [val, setVal] = useState(String(currentVal || 0));

  const handleSave = () => {
    onSave(Number(val) || 0);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Pengaturan Pengiriman</h3>
            <p className="mt-0.5 text-[11px] text-slate-400">Masukkan biaya pengiriman untuk pembelian ini.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 cursor-pointer transition-colors" title="Tutup">
            <X size={18} />
          </button>
        </div>

        <div className="p-7">
          <label className="block text-xs font-bold text-slate-700 mb-2">Biaya Pengiriman</label>
          <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400">
            <span className="px-4 py-3 bg-slate-50 text-slate-500 text-xs font-bold border-r border-slate-200">
              Rp
            </span>
            <input
              type="number"
              min="0"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="0"
              className="flex-1 px-4 py-3 text-sm font-semibold text-slate-800 outline-none font-mono"
            />
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Isi 0 bila tidak ada biaya pengiriman.</p>
        </div>

        <div className="flex items-center justify-end gap-3 px-7 py-4 border-t border-slate-100 bg-slate-50/50">
          <button type="button" onClick={onClose} className="text-xs font-bold text-slate-600 border border-slate-200 rounded-lg px-4 py-2.5 hover:bg-white cursor-pointer transition-colors">
            Batal
          </button>
          <button type="button" onClick={handleSave} className="text-xs font-bold rounded-lg px-6 py-2.5 bg-[#5CB85C] hover:bg-[#4cae4c] text-white shadow-xs cursor-pointer">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
