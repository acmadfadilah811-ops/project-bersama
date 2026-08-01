import { useEffect, useState } from 'react';
import { X, Search, Plus, Package } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Modal "+ Paket Produk" — sama alurnya dengan TambahProdukPesananModal,
 * tapi sumbernya GET /api/product-packages/ (ProductPackage, tidak ada
 * `?search=` server-side sehingga difilter di client).
 *
 * Catatan desain: OrderItem tidak punya FK ke ProductPackage (hanya ke
 * Product tunggal) — paket ditambahkan sebagai SATU baris pesanan
 * (jenis_produk = nama paket, product=null), dihargai memakai
 * `harga_jual_offline` milik paket itu sendiri, bukan mem-pecah ke tiap
 * produk konstituennya (tidak ada basis harga per-produk di dalam paket
 * untuk dipecah secara sah tanpa mengarang formula alokasi baru — di luar
 * scope tanpa keputusan desain terpisah).
 */
export default function TambahPaketModal({ orderId, onClose, onAdded }) {
  const [allPackages, setAllPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/product-packages/');
        setAllPackages(res.data?.results || res.data || []);
      } catch (err) {
        console.error('[TambahPaketModal] fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = query.trim()
    ? allPackages.filter((p) =>
        p.nama?.toLowerCase().includes(query.toLowerCase()) ||
        p.sku?.toLowerCase().includes(query.toLowerCase())
      )
    : allPackages;

  const activePrice = selected?.harga_jual_offline ?? 0;

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/order-items/', {
        order: orderId,
        product: null,
        jenis_produk: selected.nama,
        qty: Number(qty) || 1,
        harga_jual: Math.round(Number(activePrice) || 0),
        keterangan_detail: `Paket: ${(selected.items || []).map((it) => it.product_nama).join(', ')}`,
      });
      onAdded?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Gagal menambahkan paket ke pesanan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Tambah Paket Produk</h3>
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
              onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
              placeholder="Cari nama paket atau SKU"
              className="bg-transparent outline-none w-full placeholder:text-slate-400"
            />
          </label>

          {loading && <p className="text-xs text-slate-400">Memuat daftar paket...</p>}

          {!loading && !selected && (
            <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-50">
              {filtered.length === 0 && <p className="text-xs text-slate-400 px-3 py-3">Tidak ada paket ditemukan.</p>}
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-slate-300 shrink-0" />
                    <div>
                      <span className="text-sm font-semibold text-slate-700 block">{p.nama}</span>
                      <span className="text-[11px] text-slate-400">
                        {p.sku || '-'} · {(p.items || []).length} produk
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600">
                    Rp {Number(p.harga_jual_offline || 0).toLocaleString('id-ID')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{selected.nama}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-blue-600 hover:underline cursor-pointer">Ganti</button>
              </div>

              {(selected.items || []).length > 0 && (
                <ul className="text-[11px] text-slate-500 space-y-0.5">
                  {selected.items.map((it) => (
                    <li key={it.id}>• {it.product_nama}{it.product_varian_nama ? ` (${it.product_varian_nama})` : ''} × {it.qty}</li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">QTY PAKET</label>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-blue-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-semibold block mb-1">HARGA PAKET</label>
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
