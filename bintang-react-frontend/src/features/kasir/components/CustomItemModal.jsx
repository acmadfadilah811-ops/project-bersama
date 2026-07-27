import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import NumericInput from '../../../components/NumericInput';

export default function CustomItemModal({ isOpen, onClose, onAdd }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama item wajib diisi.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Harga item harus berupa angka dan tidak boleh kurang dari 0.');
      return;
    }
    const parsedQty = parseFloat(qty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      alert('Kuantitas harus berupa angka dan minimal 1.');
      return;
    }

    onAdd(name.trim(), parsedPrice, parsedQty, note.trim());
    
    // Reset form
    setName('');
    setPrice(0);
    setQty(1);
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X size={16} />
        </button>
        
        <h5 className="font-extrabold text-slate-800 text-base mb-1 flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-600" />
          <span>Tambah Item Kustom</span>
        </h5>
        <p className="text-xs text-slate-400 font-semibold mb-4">
          Masukkan detail produk kustom yang tidak ada dalam katalog.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-extrabold text-slate-600 block mb-1">
              Nama Item/Pekerjaan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Cetak Banner Outdoor Uk. 3x2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-slate-600 block mb-1">
                Harga Satuan (Rp.) <span className="text-rose-500">*</span>
              </label>
              <NumericInput
                placeholder="0"
                value={price}
                onChange={(val) => setPrice(val)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right"
                min={0}
              />
            </div>
            <div>
              <label className="text-xs font-extrabold text-slate-600 block mb-1">
                Qty <span className="text-rose-500">*</span>
              </label>
              <NumericInput
                placeholder="1"
                value={qty}
                onChange={(val) => setQty(val)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-center"
                min={1}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-extrabold text-slate-600 block mb-1">
              Catatan Item
            </label>
            <input
              type="text"
              placeholder="Contoh: Bahan Flexi 280gr, Finishing mata ayam"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer text-center"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              Tambah ke Keranjang
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
