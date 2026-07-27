import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Plus, Boxes } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useKasir } from '../context/KasirContext';

export default function ProductListPage() {
  const navigate = useNavigate();
  const { addToCart } = useKasir();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = { is_active: true };
        if (selectedCategory !== 'all') params.kategori = selectedCategory;
        if (searchTerm) params.search = searchTerm;
        const res = await apiClient.get('/products/', { params });
        setProducts(res.data?.results || res.data || []);
      } catch (err) {
        console.error('Gagal memuat produk:', err);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [selectedCategory, searchTerm]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  const handleAdd = (product) => {
    if (product.has_variant) {
      // Varian dipilih di terminal
      navigate('/kasir/terminal');
      return;
    }
    addToCart(product);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F4F7FE]">
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
                  <th className="px-4 py-3 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const hasStock = !p.lacak_inventori || p.qty_stok > 0;
                  return (
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
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleAdd(p)}
                          disabled={!hasStock}
                          className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[11px] px-2.5 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                        >
                          <Plus size={12} /> Keranjang
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
