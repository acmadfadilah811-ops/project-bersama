import { useState } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import OrderInputForm from '../../../orders/components/OrderInputForm';

export default function CreateOrderPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-2xl shadow-sm text-center max-w-xl mx-auto px-6">
        <div className="w-16 h-16 rounded-full bg-[#107c41]/10 flex items-center justify-center text-[#107c41] mb-4 border border-[#107c41]/20">
          <ShoppingCart size={32} />
        </div>

        <h2 className="text-sm font-extrabold text-slate-800">Form Pembuatan Order Baru</h2>
        <p className="text-[11px] text-slate-505 text-slate-500 max-w-sm mt-2 leading-relaxed">
          Gunakan form kasir terintegrasi untuk memasukkan pesanan pelanggan baru secara langsung.
        </p>

        <button
          onClick={() => setIsOpen(true)}
          className="mt-6 flex items-center gap-2 px-5 py-2 bg-[#107c41] hover:bg-[#0c5c30] text-white text-xs font-black rounded shadow-md transition-all cursor-pointer border-none"
        >
          <Plus size={14} />
          <span>Buka Form Order Baru</span>
        </button>
      </div>

      <OrderInputForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => {
          setIsOpen(false);
          alert('Order berhasil dibuat!');
        }}
      />
    </div>
  );
}
