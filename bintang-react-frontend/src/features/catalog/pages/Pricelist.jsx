import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../api/apiClient';
import { DollarSign, Search, Filter, X, AlertCircle } from 'lucide-react';

export default function Pricelist() {
  const [dbPrices, setDbPrices] = useState([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceSearchQuery, setPriceSearchQuery] = useState('');
  const [priceCategoryFilter, setPriceCategoryFilter] = useState('all');
  const [editingPrice, setEditingPrice] = useState(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceFormLoading, setPriceFormLoading] = useState(false);
  const [priceFormError, setPriceFormError] = useState('');

  const priceCategories = {
    print_outdoor_per_m2: 'Print Outdoor / m²',
    stand_banner: 'Stand Banner',
    print_a3_plus: 'Print A3+',
    sticker_a3_plus: 'Sticker A3+',
    laminasi_a3_plus: 'Laminasi A3+',
    paket_cetak_brosur: 'Paket Cetak Brosur',
    merchandise_dan_seminar_kit: 'Merchandise & Seminar Kit',
    buku_yasin_dan_finishing: 'Buku Yasin & Finishing',
    kartu_nama_ivory_260: 'Kartu Nama Ivory 260',
    kartu_nama_aster_200: 'Kartu Nama Aster 200',
  };

  const fetchPrices = async () => {
    setPriceLoading(true);
    try {
      const res = await apiClient.get('/product-prices/');
      setDbPrices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const handleSeedPrices = async () => {
    const confirmSeed = window.confirm(
      'Daftar harga kosong. Apakah Anda ingin mengimpor data awal dari db_harga.json?'
    );
    if (!confirmSeed) return;
    setPriceLoading(true);
    try {
      await apiClient.post('/product-prices/seed/');
      fetchPrices();
      alert('Berhasil mengimpor harga default!');
    } catch (err) {
      console.error(err);
      alert('Gagal mengimpor harga.');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleCreatePrice = () => {
    setEditingPrice({
      id: null,
      kategori: 'print_outdoor_per_m2',
      nama_produk: '',
      material: '',
      price_type: 'flat',
      harga: 0,
      tiers: null,
    });
    setPriceFormError('');
    setIsPriceModalOpen(true);
  };

  const handleEditPrice = (item) => {
    setEditingPrice(item);
    setPriceFormError('');
    setIsPriceModalOpen(true);
  };

  const handleDeletePrice = async (item) => {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus produk "${item.nama_produk}"?`
    );
    if (!confirmDelete) return;
    setPriceLoading(true);
    try {
      await apiClient.delete(`/product-prices/${item.id}/`);
      fetchPrices();
      alert('Produk berhasil dihapus!');
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus produk.');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleUpdatePrice = async (e) => {
    e.preventDefault();
    setPriceFormLoading(true);
    setPriceFormError('');

    const form = e.target;
    const name = form.nama_produk.value;
    const material = form.material.value || null;
    const category = form.kategori.value;
    const priceType = form.price_type.value;
    const price = parseInt(form.harga.value) || 0;

    let tiersVal = null;
    if (priceType === 'tiered') {
      const text = form.tiers_text.value;
      const obj = {};
      const lines = text.split('\n');
      lines.forEach((line) => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parseInt(parts[1].replace(/[^\d]/g, '')) || 0;
          if (key) obj[key] = val;
        }
      });
      if (Object.keys(obj).length === 0) {
        setPriceFormLoading(false);
        return setPriceFormError('Harga bertingkat wajib diisi dengan format yang benar!');
      }
      tiersVal = obj;
    }

    try {
      const payload = {
        nama_produk: name,
        material: material,
        kategori: category,
        price_type: priceType,
        harga: priceType === 'flat' ? price : 0,
        tiers: priceType === 'tiered' ? tiersVal : null,
      };

      if (editingPrice.id) {
        await apiClient.put(`/product-prices/${editingPrice.id}/`, payload);
      } else {
        await apiClient.post('/product-prices/', payload);
      }
      setIsPriceModalOpen(false);
      fetchPrices();
    } catch (err) {
      console.error(err);
      setPriceFormError(
        editingPrice.id ? 'Gagal memperbarui harga produk.' : 'Gagal menambahkan produk baru.'
      );
    } finally {
      setPriceFormLoading(false);
    }
  };

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  const filteredPrices = useMemo(() => {
    return dbPrices.filter((p) => {
      const matchesCategory = priceCategoryFilter === 'all' || p.kategori === priceCategoryFilter;
      const matchesSearch =
        `${(p.nama_produk || '').toLowerCase()} ${(p.material || '').toLowerCase()}`.includes(
          priceSearchQuery.toLowerCase()
        );
      return matchesCategory && matchesSearch;
    });
  }, [dbPrices, priceCategoryFilter, priceSearchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="text-blue-600 animate-pulse" size={24} /> Daftar Harga
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola katalog harga cetak flat maupun harga grosir bertingkat.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {dbPrices.length === 0 && !priceLoading && (
            <button
              type="button"
              onClick={handleSeedPrices}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              Impor Harga Default
            </button>
          )}
          <button
            type="button"
            onClick={handleCreatePrice}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            + Tambah Produk Baru
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <Search size={14} /> Cari Produk / Bahan
          </label>
          <input
            type="text"
            value={priceSearchQuery}
            onChange={(e) => setPriceSearchQuery(e.target.value)}
            placeholder="Cari nama produk, spanduk, albatros..."
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
          />
        </div>

        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <Filter size={14} /> Filter Kategori
          </label>
          <select
            value={priceCategoryFilter}
            onChange={(e) => setPriceCategoryFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
          >
            <option value="all">Semua Kategori</option>
            {Object.entries(priceCategories).map(([key, val]) => (
              <option key={key} value={key}>
                {val}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabel Utama */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-xs">Kategori</th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Nama Produk
                </th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Material / Bahan
                </th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-xs">
                  Tipe Harga
                </th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-xs text-right">
                  Harga Satuan
                </th>
                <th className="px-6 py-3.5 font-bold uppercase tracking-wider text-xs text-center w-24">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {priceLoading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm">Memuat data harga...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPrices.length > 0 ? (
                filteredPrices.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-indigo-600 uppercase tracking-wider text-[10px]">
                      {priceCategories[item.kategori] || item.kategori}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">{item.nama_produk}</td>
                    <td className="px-6 py-4 text-slate-500 font-semibold">
                      {item.material || '–'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.price_type === 'flat' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                      >
                        {item.price_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-slate-950">
                      {item.price_type === 'flat' ? (
                        formatRupiah(item.harga)
                      ) : (
                        <span className="text-amber-600 font-bold">
                          Bertingkat ({Object.keys(item.tiers || {}).length} tier)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleEditPrice(item)}
                          className="text-blue-600 hover:text-blue-900 font-bold hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePrice(item)}
                          className="text-red-600 hover:text-red-900 font-bold hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                    Belum ada data harga produk yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edit Harga */}
      {isPriceModalOpen && editingPrice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <DollarSign className="text-blue-600" size={16} />
                {editingPrice.id ? 'Edit Harga Produk' : 'Tambah Produk Baru'}
              </h3>
              <button
                onClick={() => setIsPriceModalOpen(false)}
                className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePrice} className="p-5 space-y-4">
              {priceFormError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} /> {priceFormError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Kategori</label>
                  <select
                    name="kategori"
                    defaultValue={editingPrice.kategori}
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 outline-none bg-slate-50"
                  >
                    {Object.entries(priceCategories).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase">Tipe Harga</label>
                  <select
                    name="price_type"
                    id="price_type_select"
                    defaultValue={editingPrice.price_type}
                    onChange={(e) => {
                      const elFlat = document.getElementById('modal_price_flat_container');
                      const elTier = document.getElementById('modal_price_tier_container');
                      if (e.target.value === 'flat') {
                        if (elFlat) elFlat.style.display = 'block';
                        if (elTier) elTier.style.display = 'none';
                      } else {
                        if (elFlat) elFlat.style.display = 'none';
                        if (elTier) elTier.style.display = 'block';
                      }
                    }}
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 outline-none bg-slate-50"
                  >
                    <option value="flat">Flat</option>
                    <option value="tiered">Bertingkat (Tiered)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Nama Produk</label>
                <input
                  type="text"
                  name="nama_produk"
                  required
                  defaultValue={editingPrice.nama_produk}
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Material / Bahan (Opsional)
                </label>
                <input
                  type="text"
                  name="material"
                  defaultValue={editingPrice.material || ''}
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div
                id="modal_price_flat_container"
                style={{ display: editingPrice.price_type === 'flat' ? 'block' : 'none' }}
                className="space-y-1.5"
              >
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Harga Satuan (Rp)
                </label>
                <input
                  type="number"
                  name="harga"
                  defaultValue={editingPrice.harga}
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div
                id="modal_price_tier_container"
                style={{ display: editingPrice.price_type === 'tiered' ? 'block' : 'none' }}
                className="space-y-1.5"
              >
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Tier Harga (Format: `key: harga` per baris)
                </label>
                <textarea
                  name="tiers_text"
                  rows="4"
                  defaultValue={Object.entries(editingPrice.tiers || {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')}
                  placeholder="Contoh:&#10;1-25 lbr: 4200&#10;26-50 lbr: 4000&#10;>100 lbr: 3500"
                  className="w-full border border-slate-300 rounded p-2 text-sm focus:border-blue-500 outline-none font-mono resize-none"
                />
                <p className="text-[10px] text-slate-400 font-bold">
                  Pemisah key dan harga adalah tanda titik dua (:). Jangan menyertakan titik pada
                  nominal harga.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setIsPriceModalOpen(false)}
                  className="px-4 py-2 text-slate-600 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={priceFormLoading}
                  className="px-4 py-2 text-white text-xs font-bold bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 cursor-pointer"
                >
                  {priceFormLoading
                    ? 'Menyimpan...'
                    : editingPrice.id
                      ? 'Simpan Perubahan'
                      : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
