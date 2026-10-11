import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { ambilAddonPaket, formatRupiah } from '../hooks/useStarfoto';

// Fotografer mengusulkan tambahan saat sesi (tambah orang/kostum/edit/pigura).
// Harga hanya pratinjau dari master; tagihan baru berubah setelah kasir
// menyetujui (services/starfoto.py konfirmasi).
export default function UsulanTambahanModal({ pesananId, paketProductId, onClose, onSaved }) {
  const [jenis, setJenis] = useState('addon');
  const [addons, setAddons] = useState([]);
  const [addonId, setAddonId] = useState('');
  const [cari, setCari] = useState('');
  const [produk, setProduk] = useState([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState(1);
  const [catatan, setCatatan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const res = await apiClient.get(`/products/${paketProductId}/`);
        const daftar = await ambilAddonPaket(paketProductId, res.data?.kategori ?? null);
        if (aktif) setAddons(daftar);
      } catch {
        if (aktif) setAddons([]);
      }
    })();
    return () => { aktif = false; };
  }, [paketProductId]);

  useEffect(() => {
    if (jenis !== 'produk' || cari.trim().length < 2) { setProduk([]); return undefined; }
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products/', { params: { search: cari.trim(), is_active: 'true', page_size: 20 } });
        setProduk(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch {
        setProduk([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [cari, jenis]);

  const produkTerpilih = produk.find((p) => String(p.id) === String(productId));
  const varian = produkTerpilih?.variants || [];
  const addonTerpilih = addons.find((a) => String(a.id) === String(addonId));
  const hargaSatuan = jenis === 'addon'
    ? Number(addonTerpilih?.harga || 0)
    : Number((varian.find((v) => String(v.id) === String(variantId)) || produkTerpilih)?.harga_jual_toko || 0);
  const siap = jenis === 'addon' ? Boolean(addonId) : Boolean(productId) && (!varian.length || Boolean(variantId));

  const simpan = async () => {
    if (!siap || menyimpan) return;
    setMenyimpan(true);
    try {
      const payload = jenis === 'addon'
        ? { addon_id: Number(addonId), qty, catatan }
        : { product_id: Number(productId), variant_id: variantId ? Number(variantId) : null, qty, catatan };
      await apiClient.post(`/starfoto/pesanan/${pesananId}/usulan/`, payload);
      notifySuccess('Usulan terkirim', 'Kasir akan mengonfirmasi tambahan ini.');
      onSaved?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal mengirim usulan tambahan.');
    } finally {
      setMenyimpan(false);
    }
  };

  const tab = (id, label) => (
    <button
      type="button" onClick={() => setJenis(id)}
      className={`flex-1 rounded-lg py-2 text-sm font-bold ${jenis === id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">Usulkan Tambahan</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400"><X size={20} /></button>
        </div>
        <div className="mb-3 flex gap-2">{tab('addon', 'Tambahan Paket')}{tab('produk', 'Pigura / Produk')}</div>

        {jenis === 'addon' ? (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {addons.map((a) => (
              <label key={a.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 text-sm ${String(addonId) === String(a.id) ? 'border-slate-800 bg-slate-50' : 'border-slate-200'}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" checked={String(addonId) === String(a.id)} onChange={() => setAddonId(a.id)} />
                  <span className="font-semibold text-slate-700">{a.nama}</span>
                </span>
                <span className="text-slate-500">{formatRupiah(a.harga)}</span>
              </label>
            ))}
            {!addons.length && <p className="py-6 text-center text-sm text-slate-400">Belum ada tambahan untuk paket ini.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari pigura, mis. 1022 12R"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(''); }} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm">
              <option value="">Pilih produk</option>
              {produk.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
            {varian.length > 0 && (
              <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full rounded-xl border border-slate-300 p-2.5 text-sm">
                <option value="">Pilih ukuran / warna</option>
                {varian.map((v) => <option key={v.id} value={v.id}>{v.nama_varian} — {formatRupiah(v.harga_jual_toko)}</option>)}
              </select>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-600">Jumlah</span>
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-10 rounded-lg bg-slate-100 text-lg font-bold">−</button>
          <span className="w-8 text-center text-base font-bold">{qty}</span>
          <button type="button" onClick={() => setQty((q) => q + 1)} className="h-10 w-10 rounded-lg bg-slate-100 text-lg font-bold">+</button>
        </div>
        <input
          value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan (opsional)"
          className="mt-3 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
        />
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-slate-500">Perkiraan</span>
          <span className="font-bold text-slate-800">{formatRupiah(hargaSatuan * qty)}</span>
        </div>
        <button
          type="button" onClick={simpan} disabled={!siap || menyimpan}
          className="mt-3 w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {menyimpan ? 'Mengirim...' : 'Kirim ke Kasir'}
        </button>
      </div>
    </div>
  );
}
