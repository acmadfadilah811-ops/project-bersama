import { useEffect, useRef, useState } from 'react';
import { ShoppingCart, Plus, Trash2, User, Info, CheckCircle2, Search } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import NumericInput from '../../../../components/NumericInput';
import WaOrderItemProductSource from '../../../kasir/components/WaOrderItemProductSource';
import { fetchActiveProducts, fetchActivePackages, fetchHargaKatalog } from '../../../kasir/utils/orderCatalogPricing';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

const buatItemKosong = () => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product: null,
  variant: null,
  paket: null,
  jenis_produk: '',
  panjang: 0,
  lebar: 0,
  qty: 1,
  harga_satuan: 0,
});

/** Panel "Buat Order" untuk staff (Papan Kerja SPK, tab khusus staff) --
 * staff cuma mencatat data pelanggan & item pesanan, TIDAK ADA input
 * status/DP/metode bayar/diskon sama sekali di sini (wewenang kasir
 * sepenuhnya, instruksi eksplisit user). Backend juga memaksa ulang
 * status_global='review', dp_dibayar=0, dilayani_oleh=staff yang login,
 * sumber='staff' di OrderViewSet.perform_create() -- pengaman ini bukan
 * cuma disembunyikan di UI. Order yang tersimpan muncul di antrean kasir
 * "Antrean Online & Offline" (/kasir/antrean-wa, satu daftar gabungan
 * dengan order WA, dilabeli "Order via Offline") untuk diverifikasi
 * harga, diproses pembayarannya, baru diterbitkan SPK oleh kasir.
 *
 * Pola pemilihan produk/harga direplikasi dari WaOrderQueue.jsx (Antrean
 * WA) yang sudah modern -- katalog Produk/Paket asli (bukan daftar harga
 * hardcode lama di OrderInputForm.jsx), harga selalu dihitung server via
 * /products/{id}/hitung-harga/, dan sudah menyaring is_active/tampil_pos.
 * Fitur 2026-09-06. */
export default function StaffCreateOrderPanel() {
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [nama, setNama] = useState('');
  const [nomorWa, setNomorWa] = useState('');
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState([buatItemKosong()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sukses, setSukses] = useState(false);

  // Cari Pelanggan Terdaftar + filter Tipe Pelanggan (Agen/MOU/dst) --
  // staff TIDAK bisa akses /customers/ atau /customer-groups/ penuh (BE-24,
  // database pelanggan finansial dikunci untuk staff), jadi dilayani lewat
  // endpoint sempit /contacts/production-lite/ yang cuma mengembalikan
  // nama+nomor_wa+tipe (tanpa piutang/deposit/batas kredit). Menggabungkan
  // Contact (riwayat WA) & Customer (Pelanggan & Supplier, punya tipe).
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef(null);
  const [tipeList, setTipeList] = useState([]);
  const [tipeFilter, setTipeFilter] = useState('');

  useEffect(() => {
    apiClient.get('/contacts/production-lite/')
      .then((res) => setTipeList(res.data?.tipe_list || []))
      .catch((err) => console.error('[StaffCreateOrderPanel] Gagal memuat tipe pelanggan:', err));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setProducts(await fetchActiveProducts());
      } catch {
        setProducts([]);
      }
      try {
        setPackages(await fetchActivePackages());
      } catch {
        setPackages([]);
      }
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCustomers = async (query, tipe) => {
    if (!(query || '').trim() && !tipe) {
      setCustomerSuggestions([]);
      return;
    }
    try {
      const params = {};
      if (query && query.trim()) params.search = query.trim();
      if (tipe) params.tipe = tipe;
      const res = await apiClient.get('/contacts/production-lite/', { params });
      setCustomerSuggestions(res.data?.results || []);
    } catch (err) {
      console.error('[StaffCreateOrderPanel] Gagal mencari pelanggan:', err);
    }
  };

  const handleSelectCustomer = (row) => {
    setNama(row.nama);
    setNomorWa(row.nomor_wa || '');
    setShowCustomerDropdown(false);
  };

  const handleTipeFilterChange = (value) => {
    setTipeFilter(value);
    searchCustomers(nama, value);
    setShowCustomerDropdown(true);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddItem = () => setItems((prev) => [...prev, buatItemKosong()]);

  const handleRemoveItem = (id) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const priceFromCatalog = (...candidates) => {
    const validPrice = candidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0);
    return validPrice ?? 0;
  };

  const handleProductChange = async (index, productId) => {
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      handleItemChange(index, 'product', null);
      return;
    }
    const variant = (product.variants || []).find((item) => item.pilihan_default) || product.variants?.[0];
    const isPerM2 = product.price_type === 'per_m2';
    const current = items[index];
    const panjang = isPerM2 ? (current.panjang || 1) : (current.panjang || 0);
    const lebar = isPerM2 ? (current.lebar || 1) : (current.lebar || 0);
    const paksaPerM2 = !isPerM2 && panjang > 0 && lebar > 0;
    const qty = current.qty || 1;

    let hargaSatuan = 0;
    try {
      hargaSatuan = await fetchHargaKatalog(product.id, { variantId: variant?.id, qty, panjang, lebar, paksaPerM2 });
    } catch (err) {
      console.error('[StaffCreateOrderPanel] Gagal hitung harga produk:', err);
    }

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        product: product.id,
        variant: variant?.id || null,
        paket: null,
        jenis_produk: variant ? `${product.nama} - ${variant.nama_varian}` : product.nama,
        harga_satuan: hargaSatuan,
        panjang,
        lebar,
      };
      return updated;
    });
  };

  const handleVariantChange = async (index, variantId) => {
    const current = items[index];
    const product = products.find((item) => String(item.id) === String(current.product));
    const variant = product?.variants?.find((item) => String(item.id) === String(variantId));
    if (!product || !variant) return;

    const paksaPerM2 = product.price_type !== 'per_m2' && current.panjang > 0 && current.lebar > 0;
    let hargaSatuan = current.harga_satuan || 0;
    try {
      hargaSatuan = await fetchHargaKatalog(product.id, {
        variantId: variant.id, qty: current.qty, panjang: current.panjang, lebar: current.lebar, paksaPerM2,
      });
    } catch (err) {
      console.error('[StaffCreateOrderPanel] Gagal hitung harga varian:', err);
    }

    handleItemChange(index, 'variant', variant.id);
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], jenis_produk: `${product.nama} - ${variant.nama_varian}`, harga_satuan: hargaSatuan };
      return updated;
    });
  };

  const handlePackageChange = (index, packageId) => {
    const selectedPackage = packages.find((item) => String(item.id) === String(packageId));
    if (!selectedPackage) {
      handleItemChange(index, 'paket', null);
      return;
    }
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        paket: selectedPackage.id,
        product: null,
        variant: null,
        jenis_produk: selectedPackage.nama,
        harga_satuan: priceFromCatalog(selectedPackage.harga_jual_online, selectedPackage.harga_jual_offline),
        panjang: 0,
        lebar: 0,
      };
      return updated;
    });
  };

  const recalculateHargaKatalog = async (index) => {
    const current = items[index];
    if (!current?.product) return;
    const product = products.find((item) => String(item.id) === String(current.product));
    if (!product) return;
    const paksaPerM2 = product.price_type !== 'per_m2' && current.panjang > 0 && current.lebar > 0;
    if (product.price_type === 'flat' && !paksaPerM2) return;
    try {
      const hargaSatuan = await fetchHargaKatalog(product.id, {
        variantId: current.variant, qty: current.qty, panjang: current.panjang, lebar: current.lebar, paksaPerM2,
      });
      handleItemChange(index, 'harga_satuan', hargaSatuan);
    } catch (err) {
      console.error('[StaffCreateOrderPanel] Gagal hitung ulang harga:', err);
    }
  };

  const getTotal = () => items.reduce((sum, item) => sum + (parseFloat(item.harga_satuan || 0) * parseFloat(item.qty || 1)), 0);

  const resetForm = () => {
    setNama('');
    setNomorWa('');
    setCatatan('');
    setItems([buatItemKosong()]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    setSukses(false);

    if (!nama.trim() || !nomorWa.trim()) {
      setError('Nama & nomor WhatsApp pelanggan wajib diisi.');
      return;
    }
    if (items.some((item) => !item.jenis_produk.trim())) {
      setError('Pastikan setiap item sudah dipilih produk/paketnya.');
      return;
    }

    setSaving(true);
    try {
      // status_global/dp_dibayar/diskon/dilayani_oleh sengaja TIDAK
      // dikirim -- backend memaksa nilai amannya sendiri untuk role staff.
      const orderRes = await apiClient.post('/orders/', {
        nama: nama.trim(),
        nomor_wa: nomorWa.trim(),
        catatan_pelanggan: catatan,
      });
      const orderId = orderRes.data.id;

      for (const item of items) {
        await apiClient.post('/order-items/', {
          order: orderId,
          jenis_produk: item.jenis_produk,
          product: item.product || null,
          variant: item.variant || null,
          paket: item.paket || null,
          panjang: parseFloat(item.panjang || 0),
          lebar: parseFloat(item.lebar || 0),
          qty: parseInt(item.qty || 1, 10),
          harga_jual: Math.round((Number(item.harga_satuan) || 0) * (Number(item.qty) || 1)),
        });
      }

      setSukses(true);
      resetForm();
    } catch (err) {
      console.error('[StaffCreateOrderPanel] Gagal menyimpan order:', err);
      setError(err?.response?.data?.error || err?.response?.data?.nomor_wa?.[0] || 'Gagal menyimpan pesanan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-1">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
          <ShoppingCart size={18} />
        </div>
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Buat Order</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Catat data pelanggan & item pesanan untuk bantu kasir saat ramai.
          </p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 mb-4 flex items-start gap-2">
        <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-[11px] font-semibold text-indigo-700">
          Order ini otomatis tercatat atas nama Anda dan masuk ke antrean kasir "Antrean Online
          & Offline" untuk diverifikasi & diproses pembayarannya. SPK baru diterbitkan setelah
          kasir memverifikasi pembayaran.
        </p>
      </div>

      {sukses && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
          <p className="text-[11px] font-bold text-emerald-700">
            Pesanan tersimpan & sudah masuk antrean kasir. Silakan catat pesanan berikutnya.
          </p>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-4">
          <p className="text-[11px] font-bold text-rose-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
              <User size={12} /> Data Pelanggan
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative" ref={customerDropdownRef}>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nama Pelanggan *</label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => {
                    setNama(e.target.value);
                    searchCustomers(e.target.value, tipeFilter);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => {
                    if (nama.trim() || tipeFilter) searchCustomers(nama, tipeFilter);
                    setShowCustomerDropdown(true);
                  }}
                  placeholder="Ketik nama untuk cari pelanggan terdaftar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <Search size={13} className="absolute right-3 text-slate-400 pointer-events-none" />
              </div>
              {showCustomerDropdown && customerSuggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                  {customerSuggestions.map((c, i) => (
                    <button
                      key={`${c.nomor_wa || 'x'}-${i}`}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      className="w-full px-3 py-2 hover:bg-indigo-50 text-left text-xs font-semibold text-slate-700 flex items-center justify-between gap-2 cursor-pointer border-b border-slate-100"
                    >
                      <span className="font-bold text-slate-800 truncate">{c.nama}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {c.tipe && (
                          <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{c.tipe}</span>
                        )}
                        <span className="text-slate-400">{c.nomor_wa}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tipe Pelanggan</label>
              <select
                value={tipeFilter}
                onChange={(e) => handleTipeFilterChange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white cursor-pointer"
              >
                <option value="">Semua Tipe</option>
                {tipeList.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nomor WhatsApp *</label>
              <input
                type="text"
                required
                value={nomorWa}
                onChange={(e) => setNomorWa(e.target.value)}
                placeholder="08123456789"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Catatan (opsional)</label>
              <textarea
                rows="2"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Permintaan khusus pelanggan..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold outline-none resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-500">Item Pesanan</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100"
            >
              <Plus size={12} /> Tambah Item
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full min-w-[680px] text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <th className="px-3 py-2">Produk / Paket</th>
                  <th className="px-3 py-2 w-24">P x L (m)</th>
                  <th className="px-3 py-2 w-16">Qty</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-100 text-xs font-semibold text-slate-700 align-top">
                    <td className="px-3 py-3 align-top">
                      <WaOrderItemProductSource
                        item={item}
                        products={products}
                        packages={packages}
                        onProductChange={(productId) => handleProductChange(idx, productId)}
                        onVariantChange={(variantId) => handleVariantChange(idx, variantId)}
                        onPackageChange={(packageId) => handlePackageChange(idx, packageId)}
                        onNameChange={(name) => handleItemChange(idx, 'jenis_produk', name)}
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1">
                        <NumericInput
                          value={item.panjang || 0}
                          allowDecimal
                          onChange={(val) => handleItemChange(idx, 'panjang', val)}
                          onBlur={() => recalculateHargaKatalog(idx)}
                          className="w-10 bg-transparent border-0 focus:outline-none text-center p-0"
                        />
                        <span>×</span>
                        <NumericInput
                          value={item.lebar || 0}
                          allowDecimal
                          onChange={(val) => handleItemChange(idx, 'lebar', val)}
                          onBlur={() => recalculateHargaKatalog(idx)}
                          className="w-10 bg-transparent border-0 focus:outline-none text-center p-0"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input
                        type="number"
                        min="1"
                        value={item.qty || 1}
                        onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                        onBlur={() => recalculateHargaKatalog(idx)}
                        className="w-12 bg-transparent border-0 focus:outline-none p-0"
                      />
                    </td>
                    <td className="px-3 py-3 align-top text-right font-black text-slate-900">
                      {formatCurrency(parseFloat(item.harga_satuan || 0) * parseFloat(item.qty || 1))}
                    </td>
                    <td className="px-2 py-3 align-top text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-3 pt-3 border-t border-slate-100">
            <div className="text-right">
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Perkiraan Total</span>
              <span className="text-sm font-black text-slate-900">{formatCurrency(getTotal())}</span>
              <p className="text-[9px] font-semibold text-slate-400 mt-0.5">Pembayaran diproses & diverifikasi oleh kasir.</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-xs font-extrabold flex justify-center items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
        >
          {saving ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <ShoppingCart size={16} />
          )}
          Kirim Order ke Antrean Kasir
        </button>
      </form>
    </div>
  );
}
