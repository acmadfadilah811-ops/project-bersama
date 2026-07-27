import { X, FileText, Truck } from 'lucide-react';

const col1Options = [
  { label: 'Penjualan' },
  { label: 'Penjualan + Foto' },
  { label: 'Penjualan + Foto + Bahan' },
  { label: 'Penjualan + Foto + Lampiran' },
  { label: 'Penawaran' },
];

const col2Options = [
  { label: 'Faktur' },
  { label: 'Faktur + Foto' },
  { label: 'Faktur + Foto + Bahan' },
  { label: 'Faktur + File Lampiran' },
  { label: 'Faktur A5' },
];

const col3Options = [
  { label: 'Delivery Order', isTruck: true },
  { label: 'Delivery Order - Tanpa Foto', isTruck: true },
  { label: 'Packing Label', isTruck: true },
  { label: 'Packing Label A4', isTruck: true },
  { label: 'Packing Label + Logo', isTruck: true },
  { label: 'Packing Label 1/2w', isTruck: true },
  { label: 'Packing Label 1/2w + Berat', isTruck: true },
  { label: 'Packing Label 1/2w + Logo', isTruck: true },
];

export default function PrintPdfModal({ onClose }) {
  const handlePrint = (label) => {
    console.log('Unduh/Cetak PDF:', label);
    window.print();
    onClose();
  };

  const renderOption = (opt) => {
    const Icon = opt.isTruck ? Truck : FileText;
    return (
      <button
        key={opt.label}
        type="button"
        onClick={() => handlePrint(opt.label)}
        className="w-full flex items-start gap-3 p-2 text-left hover:bg-slate-50 rounded-lg group transition-colors cursor-pointer text-slate-700"
      >
        <Icon
          size={16}
          className="text-slate-400 group-hover:text-blue-500 shrink-0 mt-0.5"
        />
        <span className="text-xs font-semibold group-hover:text-slate-900 leading-normal">
          {opt.label}
        </span>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-100 animate-zoom-in">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-800">Unduh PDF</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - 3 Columns */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
          {/* Column 1 */}
          <div className="space-y-1">
            {col1Options.map(renderOption)}
          </div>

          {/* Column 2 */}
          <div className="space-y-1">
            {col2Options.map(renderOption)}
          </div>

          {/* Column 3 */}
          <div className="space-y-1">
            {col3Options.map(renderOption)}
          </div>
        </div>
      </div>
    </div>
  );
}
