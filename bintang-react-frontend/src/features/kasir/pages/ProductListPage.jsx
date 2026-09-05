import { useState, useEffect, useRef } from 'react';
import { Search, Package, Boxes } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import PosHeaderBar from '../components/PosHeaderBar';

export default function ProductListPage({ onToggleSidebar }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  // Paginasi server sungguhan — sebelumnya fetchAllPages menarik SELURUH
  // produk aktif setiap kali filter berubah (keluhan render Kasir lambat,
  // user 2026-09-06). Sama seperti PosTerminal.jsx & halaman Produk owner.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get('/product-categories/');
        setCategories(res.data || []);
      } catch (err) {
        console.error('Gagal memuat kategori:', err);
      }
    };
    fetchCategories();
  }, []);

  // Filter berubah -> balik ke halaman 1.
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchTerm]);

  useEffect(() => {
    const fetchProducts = async () => {
      const fetchId = ++fetchIdRef.current;
      setLoading(true);
      try {
        const params = { is_active: true, page, page_size: pageSize };
        if (selectedCategory !== 'all') params.kategori = selectedCategory;
        if (searchTerm) params.search = searchTerm;
        const res = await apiClient.get('/products/', { params });
        if (fetchId !== fetchIdRef.current) return; // respons basi, abaikan
        const data = res.data;
        setProducts(Array.isArray(data) ? data : data.results || []);
        setTotalCount(Array.isArray(data) ? data.length : data.count || 0);
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        console.error('Gagal memuat produk:', err);
      } finally {
        if (fetchId === fetchIdRef.current) setLoading(false);
      }
    };
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [selectedCategory, searchTerm, page, pageSize]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F4F7FE]">
      <PosHeaderBar onToggleSidebar={onToggleSidebar} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
            <Package size={18} />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800">Daftar Produk</h1>
            <p className="text-[11px] font-semibold text-slate-500">Katalog produk & stok terkini dari inventori.</p>
          </div>
        </div>

        {/* Search + category filter */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Cari nama produk atau SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.nama}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-2">
                <Boxes size={30} />
              </div>
              <h5 className="font-extrabold text-slate-700 text-sm">Produk tidak ditemukan</h5>
              <p className="text-xs text-slate-400 font-semibold mt-1">Coba kata kunci atau kategori lain.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3 text-right">Harga Toko</th>
                    <th className="px-4 py-3 text-right">Harga Online</th>
                    <th className="px-4 py-3 text-center">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-extrabold text-slate-800 text-xs">{p.nama}</div>
                        {p.sku && <div className="text-[10px] text-slate-400 font-semibold">SKU: {p.sku}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-md">
                          {p.kategori_nama || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-black text-slate-900">{formatCurrency(p.harga_jual_toko)}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">{formatCurrency(p.harga_jual_online)}</td>
                      <td className="px-4 py-3 text-center">
                        {p.lacak_inventori ? (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            p.qty_stok > 10 ? 'bg-emerald-50 text-emerald-600' : p.qty_stok > 0 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {p.qty_stok}
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">∞</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && totalCount > 0 && (
          <div className="flex items-center justify-between gap-3 mt-3 text-[11px] font-bold text-slate-500">
            <div className="flex items-center gap-2">
              <span>Total {totalCount} produk</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer text-slate-700"
              >
                <option value={10}>10/hal</option>
                <option value={20}>20/hal</option>
                <option value={50}>50/hal</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1 cursor-pointer text-slate-700"
              >
                &lt;
              </button>
              <span>{page} / {Math.max(1, Math.ceil(totalCount / pageSize))}</span>
              <button
                type="button"
                disabled={page >= Math.ceil(totalCount / pageSize)}
                onClick={() => setPage((p) => Math.min(Math.ceil(totalCount / pageSize) || 1, p + 1))}
                className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1 cursor-pointer text-slate-700"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
