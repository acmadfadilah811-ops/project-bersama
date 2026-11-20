import { useEffect, useMemo, useState } from 'react';
import { Calculator, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

// Asisten Daftar Harga di form Buat Pesanan (2026-10-20): mengambil produk master
// (menu Produk), bukan lagi tabel harga lama yang sudah kosong. Disaring per unit bisnis
// pesanan (produk unit itu + produk umum tanpa unit).
const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const daftar = (data) => (Array.isArray(data) ? data : data?.results || []);
const labelTipe = (t) => (t ? (t === 'Guest' ? 'Guest' : t) : 'Semua tipe');

export default function DaftarHargaModal({ unitBisnis, qty = 1, nomorItem, onPilih, onClose }) {
  const [kategori, setKategori] = useState([]);
  const [kategoriId, setKategoriId] = useState('');
  const [cari, setCari] = useState('');
  const [produk, setProduk] = useState([]);
  const [total, setTotal] = useState(0);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    apiClient.get('/product-categories/')
      .then((res) => setKategori(daftar(res.data)))
      .catch(() => setKategori([]));
  }, []);

  const kategoriUnit = useMemo(
    () => kategori.filter((k) => !unitBisnis || !k.unit_bisnis || String(k.unit_bisnis) === String(unitBisnis)),
    [kategori, unitBisnis],
  );

  useEffect(() => {
    let batal = false;
    const t = setTimeout(async () => {
      setMemuat(true);
      try {
        const res = await apiClient.get('/products/', {
          params: {
            page: 1, page_size: 60, is_active: true,
            search: cari.trim() || undefined,
            kategori: kategoriId || undefined,
            unit_bisnis: unitBisnis || undefined,
            termasuk_umum: unitBisnis ? 1 : undefined,
          },
        });
        if (batal) return;
        setProduk(daftar(res.data));
        setTotal(Array.isArray(res.data) ? res.data.length : res.data?.count || 0);
      } catch {
        if (!batal) setProduk([]);
      } finally {
        if (!batal) setMemuat(false);
      }
    }, 300);
    return () => { batal = true; clearTimeout(t); };
  }, [cari, kategoriId, unitBisnis]);

  // Pilihan harga per produk: varian, tingkatan harga, atau harga toko biasa.
  const pilihanHarga = (p) => {
    if (p.has_variant && p.variants?.length) {
      return p.variants.map((v) => ({
        kunci: `v-${v.id}`, label: v.nama_varian, harga: Number(v.harga_jual_toko) || 0, varian: v,
      }));
    }
    if (p.price_type === 'tier' && Array.isArray(p.tiers) && p.tiers.length) {
      return [...p.tiers]
        .sort((a, b) => (Number(a.min_qty) || 0) - (Number(b.min_qty) || 0))
        .map((t, i) => ({
          kunci: `t-${i}`, label: `${labelTipe(t.tipe_pelanggan)} · min ${t.min_qty}`, harga: Number(t.price) || 0,
          cocok: qty >= (Number(t.min_qty) || 0),
        }));
    }
    return [{ kunci: 'h', label: p.price_type === 'per_m2' ? 'per m²' : 'Harga toko', harga: Number(p.harga_jual_toko) || 0 }];
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-800 text-white rounded">
              <Calculator size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Daftar Harga Produk</h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Pilih produk untuk item #{nomorItem}
                {unitBisnis ? ' · produk unit ini + produk umum' : ' · semua unit'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-white">
          <input
            type="text" value={cari} onChange={(e) => setCari(e.target.value)} autoFocus
            placeholder="Cari nama produk, SKU, atau barcode..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
        </div>

        <div className="flex-1 flex overflow-hidden min-h-[400px]">
          <div className="w-56 bg-slate-50 border-r border-slate-100 p-2 overflow-y-auto space-y-0.5">
            {[{ id: '', nama: 'Semua Kategori' }, ...kategoriUnit].map((k) => (
              <button
                key={k.id || 'semua'} type="button" onClick={() => setKategoriId(String(k.id || ''))}
                className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors ${String(kategoriId) === String(k.id || '') ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200/60'}`}
              >
                {k.nama}
              </button>
            ))}
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-slate-50/30">
            <p className="mb-2 text-[10px] text-slate-400">
              {memuat ? 'Memuat…' : `${total.toLocaleString('id-ID')} produk${total > produk.length ? ` (tampil ${produk.length}, persempit dengan pencarian)` : ''}`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {produk.map((p) => (
                <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {p.kategori_nama || 'Tanpa kategori'}
                    </span>
                    <h4 className="font-bold text-slate-800 text-xs mt-1.5">{p.nama}</h4>
                  </div>
                  <div className="space-y-1">
                    {pilihanHarga(p).map((h) => (
                      <div key={h.kunci} className={`flex justify-between items-center gap-2 p-1.5 rounded-lg border text-[10px] ${h.cocok ? 'bg-slate-100 border-slate-300' : 'bg-slate-50 border-slate-100'}`}>
                        <span className="font-semibold text-slate-600 truncate">{h.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold text-slate-800">{rupiah(h.harga)}</span>
                          <button
                            type="button" onClick={() => onPilih(p, h.harga, h.varian || null)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[9px] font-bold"
                          >
                            Pilih
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!memuat && !produk.length && (
                <div className="col-span-2 py-8 text-center text-slate-400 text-xs">Tidak ada produk yang cocok.</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors">
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
