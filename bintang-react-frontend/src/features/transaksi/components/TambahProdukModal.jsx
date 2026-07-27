import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function TambahProdukModal({ isOpen, onClose, onAdd }) {
  const [searchProduct, setSearchProduct] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [qty, setQty] = useState('');
  const [hargaBeli, setHargaBeli] = useState('');
  const [totalHarga, setTotalHarga] = useState('');
  const [rak, setRak] = useState('');
  const [kadaluwarsa, setKadaluwarsa] = useState('');
  const [stockMode, setStockMode] = useState('average');
  const [uomAktif, setUomAktif] = useState(false);
  const [uomKode, setUomKode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Tanggal kedaluwarsa & satuan alternatif bergantung pengaturan sistem stok.
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await apiClient.get('/business-settings/');
        setStockMode(res.data?.stock_system || 'average');
        setUomAktif(!!res.data?.uom_multi_enabled);
      } catch {
        setStockMode('average');
        setUomAktif(false);
      }
    })();
  }, [isOpen]);

  // Satuan yang tersedia untuk produk terpilih (satuan dasar + alternatif).
  const unitOptions =
    uomAktif && selectedProduct?.uom_enabled && Array.isArray(selectedProduct.uom_units)
      ? selectedProduct.uom_units
      : [];
  const unitTerpilih = unitOptions.find((u) => u.kode_satuan === uomKode) || null;
  const konverter = Number(unitTerpilih?.konverter) || 1;

  // Search product autocomplete
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

  // Recalculations
  const handleQtyChange = (val) => {
    setQty(val);
    const q = Number(val) || 0;
    const p = Number(hargaBeli) || 0;
    if (q > 0) {
      setTotalHarga(String(q * p));
    }
  };

  const handleHargaChange = (val) => {
    setHargaBeli(val);
    const q = Number(qty) || 0;
    const p = Number(val) || 0;
    if (q > 0) {
      setTotalHarga(String(q * p));
    }
  };

  const handleTotalChange = (val) => {
    setTotalHarga(val);
    const q = Number(qty) || 0;
    const t = Number(val) || 0;
    if (q > 0) {
      setHargaBeli(String(Math.round(t / q)));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return alert('Silakan pilih produk terlebih dahulu.');
    const q = Number(qty) || 0;
    if (q <= 0) return alert('Jumlah qty harus lebih besar dari 0.');

    setSubmitting(true);
    try {
      await onAdd({
        product: selectedProduct.id,
        qty: q,
        harga_beli: Number(hargaBeli) || 0,
        rak: rak.trim(),
        tanggal_kadaluwarsa: kadaluwarsa || null,
        uom_kode: uomKode || null,
      });
      // Reset & close
      setSearchProduct('');
      setSelectedProduct(null);
      setQty('');
      setHargaBeli('');
      setTotalHarga('');
      setRak('');
      setKadaluwarsa('');
      setUomKode('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 overflow-hidden transform transition-all animate-scale-in text-slate-700">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <span className="text-sm font-bold text-slate-800">Tambah Produk</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Produk Autocomplete */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Produk</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Masukkan nama produk (autocomplete)"
                value={searchProduct}
                onChange={(e) => {
                  setSearchProduct(e.target.value);
                  setSelectedProduct(null);
                }}
                className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      if (p.harga_beli) {
                        setHargaBeli(String(Math.round(p.harga_beli)));
                        const q = Number(qty) || 0;
                        if (q > 0) setTotalHarga(String(q * Math.round(p.harga_beli)));
                      }
                      setProductOptions([]);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-700 cursor-pointer block"
                  >
                    <span className="font-semibold block">{p.nama}</span>
                    {p.sku && <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Satuan (UOM) — hanya bila multi satuan aktif & produk punya satuan alternatif */}
          {unitOptions.length > 0 && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Satuan</label>
              <select
                value={uomKode}
                onChange={(e) => setUomKode(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none cursor-pointer"
              >
                <option value="">{selectedProduct?.satuan || 'pcs'} (satuan dasar)</option>
                {unitOptions.map((u) => (
                  <option key={u.id || u.kode_satuan} value={u.kode_satuan}>
                    {u.nama_satuan} ({u.kode_satuan}) — 1 = {u.konverter} {selectedProduct?.satuan || 'pcs'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Qty */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">
              Qty {unitTerpilih ? `(dalam ${unitTerpilih.nama_satuan})` : ''}
            </label>
            <input
              type="text"
              placeholder="Masukkan angka contoh: 1234"
              value={qty}
              onChange={(e) => handleQtyChange(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
            />
            {unitTerpilih && Number(qty) > 0 && (
              <span className="text-[10px] text-blue-600 font-semibold block mt-1">
                = {Number(qty) * konverter} {selectedProduct?.satuan || 'pcs'} (satuan dasar)
              </span>
            )}
          </div>

          {/* Harga Beli */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">
              Harga Beli {unitTerpilih ? `(per ${unitTerpilih.nama_satuan})` : ''}
            </label>
            <input
              type="text"
              placeholder="Rp. 0,00"
              value={hargaBeli ? `Rp ${Number(hargaBeli).toLocaleString('id-ID')}` : ''}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                handleHargaChange(clean);
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none font-mono"
            />
          </div>

          {/* Atau Total Harga */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Atau Total Harga</label>
            <input
              type="text"
              placeholder="Rp. 0,00"
              value={totalHarga ? `Rp ${Number(totalHarga).toLocaleString('id-ID')}` : ''}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '');
                handleTotalChange(clean);
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none font-mono"
            />
          </div>

          {/* Tanggal Kedaluwarsa — hanya pada mode stok FIFO & Expired */}
          {stockMode === 'fifo_expired' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                Tanggal Kedaluwarsa <span className="font-normal text-slate-300">(opsional)</span>
              </label>
              <input
                type="date"
                value={kadaluwarsa}
                onChange={(e) => setKadaluwarsa(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Stok yang lebih cepat kedaluwarsa akan dikeluarkan lebih dulu (FEFO).
              </span>
            </div>
          )}

          {/* Rak */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Rak (Lokasi Penyimpanan)</label>
            <input
              type="text"
              placeholder="Masukkan rak/lokasi..."
              value={rak}
              onChange={(e) => setRak(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end items-center gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedProduct || !qty}
              className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-colors ${
                selectedProduct && qty && !submitting
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              + Tambah
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
