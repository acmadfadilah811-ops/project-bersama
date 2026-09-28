import { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

// Daftar Harga Papan Kerja membaca katalog Produk (2026-09-28). Sebelumnya
// membaca tabel pricelist lama (ProductPrice, sumber harga bot WA) yang tidak
// ikut berubah saat katalog Produk diperbarui/diimpor, jadi tampil kosong/usang.
const TIPE_TARIF = { flat: 'Flat', tier: 'Bertingkat', per_m2: 'Per m²' };
const UKURAN_HALAMAN = 50;

const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

function hargaTampil(p) {
  const varian = (p.variants || []).filter((v) => v.is_active !== false);
  if (varian.length > 0) {
    const daftar = varian.map((v) => Number(v.harga_jual_toko) || 0);
    const min = Math.min(...daftar);
    const max = Math.max(...daftar);
    return min === max ? rupiah(min) : `${rupiah(min)} – ${rupiah(max)}`;
  }
  if (p.price_type === 'tier' && Array.isArray(p.tiers) && p.tiers.length > 0) {
    const termurah = Math.min(...p.tiers.map((t) => Number(t.price) || 0));
    return `mulai ${rupiah(termurah)}`;
  }
  const harga = rupiah(p.harga_jual_toko);
  return p.price_type === 'per_m2' ? `${harga} / m²` : harga;
}

export default function PricelistPanel() {
  const [search, setSearch] = useState('');
  const [cari, setCari] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [muatUlang, setMuatUlang] = useState(0);

  // Tunggu user berhenti mengetik sebelum mencari ke server.
  useEffect(() => {
    const t = setTimeout(() => { setCari(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let batal = false;
    setLoading(true);
    setError('');
    const params = { page, page_size: UKURAN_HALAMAN };
    if (cari) params.search = cari;
    apiClient.get('/products/', { params })
      .then((res) => {
        if (batal) return;
        const data = res.data;
        const list = Array.isArray(data) ? data : (data.results || []);
        setItems(list);
        setTotal(Array.isArray(data) ? list.length : (data.count || 0));
      })
      .catch(() => { if (!batal) setError('Gagal memuat daftar harga.'); })
      .finally(() => { if (!batal) setLoading(false); });
    return () => { batal = true; };
  }, [cari, page, muatUlang]);

  const jumlahHalaman = Math.max(1, Math.ceil(total / UKURAN_HALAMAN));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Daftar Harga Produk</h2>
          <p className="text-[11px] text-slate-400">
            Harga jual toko dari katalog Produk. Ubah harga di menu Produk.
          </p>
        </div>
        <button
          onClick={() => setMuatUlang((n) => n + 1)}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <RefreshCw size={12} />
          Segarkan Data
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Cari nama produk, SKU, atau varian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-6 py-3">Nama Produk</th>
              <th className="px-6 py-3">Kategori</th>
              <th className="px-6 py-3">Satuan</th>
              <th className="px-6 py-3">Tipe Tarif</th>
              <th className="px-6 py-3 text-right">Harga Jual Toko</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">Memuat...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-red-600">{error}</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                  Tidak ada produk ditemukan
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3.5">
                    <div className="font-bold text-slate-800">
                      {p.nama}
                      {p.is_active === false && (
                        <span className="ml-2 text-[9px] font-bold text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded uppercase">Nonaktif</span>
                      )}
                    </div>
                    {(p.variants || []).length > 0 && (
                      <div className="text-[10px] text-slate-400">{p.variants.length} varian</div>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-[9px] bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded uppercase">
                      {p.kategori_nama || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-slate-500">{p.satuan || '-'}</td>
                  <td className="px-6 py-3.5 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    {TIPE_TARIF[p.price_type] || p.price_type || 'Flat'}
                  </td>
                  <td className="px-6 py-3.5 text-right font-black text-slate-900">{hargaTampil(p)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {total > UKURAN_HALAMAN && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100 text-[11px] text-slate-500">
            <span>{total} produk</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                disabled={page <= 1}
                className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span>Halaman {page} / {jumlahHalaman}</span>
              <button
                onClick={() => setPage((n) => Math.min(jumlahHalaman, n + 1))}
                disabled={page >= jumlahHalaman}
                className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
