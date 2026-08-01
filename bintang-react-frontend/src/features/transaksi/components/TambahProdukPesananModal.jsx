import { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Modal "+ Produk" pada Produk Pesanan (Order Detail) — cari produk master
 * (GET /api/products/?search=) lalu tambahkan sebagai baris OrderItem lewat
 * POST /api/order-items/ (endpoint yang sama dipakai alur tambah item saat
 * pesanan dibuat, jadi kontraknya sudah teruji). Harga diambil dari data
 * produk hasil fetch server, bukan input bebas user (M6).
 *
 * Bukan `TambahProdukModal.jsx` (nama mirip, tapi itu untuk stok/pembelian —
 * harga_beli/rak/kadaluwarsa, dipakai PembelianDetail.jsx — beda konteks).
 */
export default function TambahProdukPesananModal({ orderId, onClose, onAdded }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (val) => {
    setQuery(val);
    setSelected(null);
    if (!val.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await apiClient.get(`/products/?search=${encodeURIComponent(val)}`);
      setResults(res.data?.results || res.data || []);
    } catch (err) {
      console.error('[TambahProdukPesananModal] search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (p) => {
    setSelected(p);
    setVariantId(p.has_variant && p.variants?.length ? String(p.variants[0].id) : '');
  };

  const selectedVariant = selected?.variants?.find((v) => String(v.id) === variantId);
  const activePrice = selectedVariant?.harga_jual_toko ?? selected?.harga_jual_toko ?? 0;

  const handleAdd = async () => {
    if (!selected) return;
    if (selected.has_variant && !variantId) {
      setError('Pilih varian dulu.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/order-items/', {
        order: orderId,
        product: selected.id,
        variant: variantId ? Number(variantId) : null,
        jenis_produk: selectedVariant ? `${selected.nama} - ${selectedVariant.nama_varian}` : selected.nama,
        qty: Number(qty) || 1,
        harga_jual: Math.round(Number(activePrice) || 0),
      });
      onAdded?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Gagal menambahkan produk ke pesanan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Tambah Produk</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <label className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
            <Search size={16} className="text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cari nama produk atau SKU"
              className="bg-transparent outline-none w-full placeholder:text-slate-400"
            />
          </label>

          {searching && <p className="text-xs text-slate-400">Mencari...</p>}

          {!selected && results.length > 0 && (
            <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 cursor-pointer"
                >
                  <div>
                    <span className="text-sm font-semibold text-slate-700 block">{p.nama}</span>
                    <span className="text-[11px] text-slate-400">{p.sku || '-'}{p.has_variant ? ' · ada varian' : ''}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600">
                    Rp {Number(p.harga_jual_toko || 0).toLocaleString('id-ID')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {!searching && query.trim() && results.length === 0 && (
            <p className="text-xs text-slate-400">Tidak ada produk ditemukan.</p>
          )}

          {selected && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{selected.nama}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline cursor-pointer">Ganti</button>
              </div>

              {selected.has_variant && (
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">VARIAN</label>
                  <select
                    value={variantId}
                    onChange={(e) => setVariantId(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-blue-300 cursor-pointer"
                  >
                    {(selected.variants || []).map((v) => (
                      <option key={v.id} value={v.id}>{v.nama_varian}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">QTY</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-blue-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">HARGA SATUAN</label>
                  <p className="text-sm font-mono font-bold text-slate-700 px-3 py-2">Rp {Number(activePrice || 0).toLocaleString('id-ID')}</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-6 py-2 hover:bg-slate-50 cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            disabled={!selected || saving}
            onClick={handleAdd}
            className={`flex items-center gap-1.5 text-sm font-semibold rounded-lg px-6 py-2 transition-colors ${
              selected && !saving
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Plus size={15} /> {saving ? 'Menambahkan...' : 'Tambah ke Pesanan'}
          </button>
        </div>
      </div>
    </div>
  );
}
