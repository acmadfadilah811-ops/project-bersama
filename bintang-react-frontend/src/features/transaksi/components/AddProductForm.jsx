import { useState, useEffect } from 'react';
import { Search, Plus } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function AddProductForm({ docId, onAdded }) {
  const [searchProduct, setSearchProduct] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [hargaBeli, setHargaBeli] = useState('');
  const [qty, setQty] = useState(1);
  const [rak, setRak] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!searchProduct.trim() || selectedProduct) {
      setProductOptions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/products/?search=${encodeURIComponent(searchProduct)}`);
        setProductOptions(res.data.results || res.data || []);
      } catch (err) {
        console.error(err);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchProduct, selectedProduct]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return alert('Silakan pilih produk terlebih dahulu.');
    if (qty <= 0) return alert('Jumlah qty harus lebih besar dari 0.');

    setSubmitting(true);
    try {
      await apiClient.post(`/stock-in-documents/${docId}/add-item/`, {
        product: selectedProduct.id,
        qty: Number(qty),
        harga_beli: Number(hargaBeli) || 0,
        rak: rak.trim(),
      });
      setSearchProduct('');
      setSelectedProduct(null);
      setHargaBeli('');
      setQty(1);
      setRak('');
      onAdded();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menambahkan produk.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
      <div className="relative">
        <label className="text-[10px] font-bold text-slate-400 block mb-1">Cari Produk</label>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Nama Produk / SKU"
            value={searchProduct}
            onChange={(e) => {
              setSearchProduct(e.target.value);
              setSelectedProduct(null);
            }}
            className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {productOptions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-50">
            {productOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedProduct(p);
                  setSearchProduct(p.nama);
                  if (p.harga_beli) setHargaBeli(String(Math.round(p.harga_beli)));
                  setProductOptions([]);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 cursor-pointer block"
              >
                <span className="font-semibold block">{p.nama}</span>
                {p.sku && <span className="text-[10px] text-slate-400">SKU: {p.sku}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-[10px] font-bold text-slate-400 block mb-1">Harga Beli</label>
        <input
          type="number"
          placeholder="Rp"
          value={hargaBeli}
          onChange={(e) => setHargaBeli(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1">Qty</label>
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 1)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none text-center"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 block mb-1">Rak</label>
          <input
            type="text"
            placeholder="Lokasi"
            value={rak}
            onChange={(e) => setRak(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={submitting || !selectedProduct}
          className={`w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-white rounded-lg py-2 transition-colors ${
            selectedProduct && !submitting
              ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              : 'bg-slate-300 cursor-not-allowed'
          }`}
        >
          <Plus size={14} /> Tambah
        </button>
      </div>
    </form>
  );
}
