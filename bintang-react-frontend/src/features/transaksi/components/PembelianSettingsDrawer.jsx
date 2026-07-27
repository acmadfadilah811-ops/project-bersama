import { useState } from 'react';
import { X } from 'lucide-react';

/** Switch on/off bergaya "Non-aktifkan / Aktifkan". */
function ToggleSwitch({ checked, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${!checked ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
        Non-aktifkan
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
      <span className={`text-xs ${checked ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
        Aktifkan
      </span>
    </div>
  );
}

/**
 * Drawer "Pengaturan pembelian" (geser dari kanan).
 * Mengikuti referensi: opsi "Diskon tidak mengurangi harga beli" + tombol Terapkan.
 */
export default function PembelianSettingsDrawer({ onClose, onApply, initial = {} }) {
  const [diskonTidakMengurangi, setDiskonTidakMengurangi] = useState(
    initial.diskonTidakMengurangi ?? false,
  );

  const handleApply = () => {
    onApply?.({ diskonTidakMengurangi });
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/30 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Pengaturan pembelian</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-700">Diskon tidak mengurangi harga beli</span>
            <ToggleSwitch checked={diskonTidakMengurangi} onChange={setDiskonTidakMengurangi} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleApply}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2.5 cursor-pointer transition-colors"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
}
