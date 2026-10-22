import { useEffect, useRef, useState } from 'react';
import apiClient from '../../../api/apiClient';

// Kolom "Product Type" yang langsung mencari produk master saat diketik (2026-10-22),
// tanpa perlu membuka Daftar Harga. Teks bebas tetap boleh (produk kustom).
const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

// Harga bawaan saat dipilih dari saran: tier umum/Guest yang cocok dengan qty, atau harga toko.
function hargaBawaan(p, qty) {
  if (p.price_type === 'tier' && Array.isArray(p.tiers) && p.tiers.length) {
    const umum = p.tiers.filter((t) => !t.tipe_pelanggan || t.tipe_pelanggan === 'Guest')
      .filter((t) => qty >= (Number(t.min_qty) || 0))
      .sort((a, b) => (Number(b.min_qty) || 0) - (Number(a.min_qty) || 0));
    if (umum.length) return Number(umum[0].price) || 0;
  }
  return Number(p.harga_jual_toko) || 0;
}

export default function CariProdukInline({ value, onChange, onPilih, unitBisnis, qty = 1, placeholder }) {
  const [saran, setSaran] = useState([]);
  const [buka, setBuka] = useState(false);
  const diketik = useRef(false);

  useEffect(() => {
    const kata = (value || '').trim();
    if (!diketik.current || kata.length < 2) {
      setSaran([]);
      return undefined;
    }
    let batal = false;
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products/', {
          params: {
            page: 1, page_size: 10, is_active: true, search: kata,
            unit_bisnis: unitBisnis || undefined, termasuk_umum: unitBisnis ? 1 : undefined,
          },
        });
        if (batal) return;
        const rows = Array.isArray(res.data) ? res.data : res.data?.results || [];
        // Varian ditampilkan sebagai pilihan sendiri.
        setSaran(rows.flatMap((p) => (p.has_variant && p.variants?.length
          ? p.variants.map((v) => ({ kunci: `v${v.id}`, p, v, harga: Number(v.harga_jual_toko) || 0 }))
          : [{ kunci: `p${p.id}`, p, v: null, harga: hargaBawaan(p, qty) }])));
        setBuka(true);
      } catch {
        if (!batal) setSaran([]);
      }
    }, 300);
    return () => { batal = true; clearTimeout(t); };
  }, [value, unitBisnis, qty]);

  return (
    <div className="relative">
      <input
        type="text" required value={value} placeholder={placeholder}
        onChange={(e) => { diketik.current = true; onChange(e.target.value); }}
        onFocus={() => saran.length && setBuka(true)}
        onBlur={() => setTimeout(() => setBuka(false), 200)}
        className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] outline-none mt-1 focus:ring-1 focus:ring-slate-900"
      />
      {buka && saran.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {saran.map((s) => (
            <button
              key={s.kunci} type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                diketik.current = false;
                setBuka(false);
                setSaran([]);
                onPilih(s.p, s.harga, s.v);
              }}
              className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-2.5 py-2 text-left text-[11px] hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-slate-800">{s.p.nama}{s.v ? ` (${s.v.nama_varian})` : ''}</span>
                <span className="block text-[10px] text-slate-400">
                  {s.p.kategori_nama || 'Tanpa kategori'}{s.p.price_type === 'per_m2' ? ' · per m²' : ''}{s.p.price_type === 'tier' ? ' · harga bertingkat' : ''}
                </span>
              </span>
              <span className="shrink-0 font-bold text-slate-700">{rupiah(s.harga)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
