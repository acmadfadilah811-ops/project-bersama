import { useState } from 'react';
import { X } from 'lucide-react';

export default function PembelianPajakModal({ currentVal, currentType, onClose, onSave }) {
  const [type, setType] = useState(currentType || 'persen');
  const [val, setVal] = useState(String(currentVal || 0));

  const handleSave = () => {
    onSave({ val: Number(val) || 0, type });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Pajak</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">Masukkan Pajak</span>
          </div>

          <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400">
            <input
              type="number"
              min="0"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none"
            />
            <span className="px-3 py-2.5 bg-slate-50 text-slate-500 text-xs font-bold border-l border-slate-200">
              {type === 'persen' ? '%' : 'IDR'}
            </span>
            <div className="flex border-l border-slate-200 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setType('nominal')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  type === 'nominal' ? 'bg-blue-500 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                IDR
              </button>
              <button
                type="button"
                onClick={() => setType('persen')}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                  type === 'persen' ? 'bg-blue-500 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                %
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button type="button" onClick={onClose} className="text-xs font-bold text-rose-600 hover:text-rose-700 px-4 py-2 cursor-pointer">
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
