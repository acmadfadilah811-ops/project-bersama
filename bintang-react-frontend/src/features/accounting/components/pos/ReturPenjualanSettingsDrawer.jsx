import { X } from 'lucide-react';
import { useState } from 'react';
import { notify } from '../../../../utils/notify';

export default function ReturPenjualanSettingsDrawer({ isOpen, onClose }) {
  const [valPostingFromReturn, setValPostingFromReturn] = useState(true);

  if (!isOpen) return null;

  const handleSave = () => {
    notify({
      type: 'success',
      title: 'Pengaturan Disimpan',
      message: 'Pengaturan POS Return Penjualan berhasil disimpan.'
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-[999] animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Drawer layout sliding in from right side */}
      <div className="bg-white border-l border-slate-200 w-[480px] h-full flex flex-col justify-between shadow-2xl overflow-hidden animate-slide-in">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-sm font-bold text-slate-800">Pengaturan POS Return Penjualan</h3>
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
          
          {/* Switch Toggle */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <span className="font-bold text-slate-800 max-w-[320px] leading-relaxed">
              Nilai posting diambil dari nilai pengembalian penjualan
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-bold">
                {valPostingFromReturn ? 'On' : 'Off'}
              </span>
              <button
                type="button"
                onClick={() => setValPostingFromReturn(!valPostingFromReturn)}
                className={`w-9 h-5 rounded-full p-0.5 transition-all cursor-pointer ${
                  valPostingFromReturn ? 'bg-[#0088E8]' : 'bg-slate-200'
                }`}
              >
                <div className={`w-4 h-4 bg-white rounded-full shadow-xs transition-all transform ${
                  valPostingFromReturn ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
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
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
          >
            Simpan
          </button>
        </div>

      </div>
    </div>
  );
}
