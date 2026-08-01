import { X } from 'lucide-react';
import { useState } from 'react';

export default function ProduksiStokSettingsDrawer({ isOpen, onClose }) {
  const [noCogs, setNoCogs] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Drawer layout sliding in from right side */}
      <div className="bg-white border-l border-slate-200 w-[440px] h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan POS Transaksi Stok</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-6">
          <p className="rounded-lg bg-amber-50 p-3 text-[11px] font-medium text-amber-700">Pengaturan belum terhubung ke backend dan tidak dapat disimpan.</p>
          
          <div className="space-y-4">
            {/* Collapsible header area */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-[#0088E8] text-xs">Produksi Stock</span>
              <span className="text-slate-400 text-[10px]">▼</span>
            </div>

            {/* Switch Toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-slate-700">
                Produksi tanpa COGS
              </span>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold select-none">
                  {noCogs ? 'Ya' : 'Tidak'}
                </span>
                <button
                  type="button"
                  onClick={() => setNoCogs(!noCogs)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer ${
                    noCogs ? 'bg-[#0088E8]' : 'bg-slate-200'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-all transform ${
                    noCogs ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Batal
          </button>
          <button type="button" disabled className="cursor-not-allowed rounded-lg bg-slate-200 px-6 py-2 text-xs font-bold text-slate-400 shadow-2xs">
            Simpan
          </button>
        </div>

      </div>
    </div>
  );
}
