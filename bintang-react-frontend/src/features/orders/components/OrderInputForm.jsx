import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Save,
  Plus,
  Trash2,
  ShoppingCart,
  User,
  Calculator,
  Calendar,
  CreditCard,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import ProductMasterPicker from './ProductMasterPicker';
import { toLocalDateTimeInput } from '../../../utils/date';

export default function OrderInputForm({ isOpen, onClose, onSuccess }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── State Asisten Daftar Harga ──
  const [dbPrices, setDbPrices] = useState([]);
  const [pricelistActiveIndex, setPricelistActiveIndex] = useState(null);
  const [priceSearch, setPriceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

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
    try {
      const res = await apiClient.get('/product-prices/');
      setDbPrices(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrices();
      setFormData({
        waktu: toLocalDateTimeInput(), // Format YYYY-MM-DDTHH:MM
        nomor_wa: '',
        nama: '',
        catatan_pelanggan: '',
        metode_pembayaran: 'tunai',
        status_global: 'review',
        dp_dibayar: 0,
        diskon_persen: 0,
        items: [
          {
            jenis_produk: '',
            product: null,
            product_nama: '',
            bahan: '',
            panjang: 0,
            lebar: 0,
            harga_per_m2: 0,
            qty: 1,
            keterangan_detail: '',
            is_meteran: true,
          },
        ],
      });
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    return dbPrices.filter((prod) => {
      const matchesCategory = selectedCategory === 'all' || prod.kategori === selectedCategory;
      const searchData = `${(prod.nama_produk || '').toLowerCase()} ${(prod.material || '').toLowerCase()}`;
      const matchesSearch = searchData.includes(priceSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [dbPrices, selectedCategory, priceSearch]);

  const handleSelectProduct = (product, selectedPrice) => {
    if (pricelistActiveIndex === null) return;

    const catMap = {
      print_outdoor_per_m2: 'Cetak Outdoor',
      stand_banner: 'Stand Banner',
      print_a3_plus: 'Print A3+',
      sticker_a3_plus: 'Sticker A3+',
      laminasi_a3_plus: 'Laminasi A3+',
      paket_cetak_brosur: 'Paket Brosur',
      merchandise_dan_seminar_kit: 'Merchandise',
      buku_yasin_dan_finishing: 'Yasin & Finishing',
      kartu_nama_ivory_260: 'Kartu Nama',
      kartu_nama_aster_200: 'Kartu Nama',
    };

    const jenisProduk = catMap[product.kategori] || product.kategori;
    const isMeteran = product.kategori === 'print_outdoor_per_m2';

    const newItems = [...formData.items];
    newItems[pricelistActiveIndex].is_meteran = isMeteran;
    newItems[pricelistActiveIndex].jenis_produk = jenisProduk;
    newItems[pricelistActiveIndex].bahan =
      product.nama_produk + (product.material ? ` (${product.material})` : '');
    newItems[pricelistActiveIndex].harga_per_m2 = selectedPrice;
    newItems[pricelistActiveIndex].panjang = isMeteran ? 1 : 0;
    newItems[pricelistActiveIndex].lebar = isMeteran ? 1 : 0;

    setFormData({ ...formData, items: newItems });

    // Close modal
    setPricelistActiveIndex(null);
    setPriceSearch('');
    setSelectedCategory('all');
  };

  // Struktur state baru sesuai rencana
  const [formData, setFormData] = useState({
    waktu: toLocalDateTimeInput(), // Format YYYY-MM-DDTHH:MM
    nomor_wa: '',
    nama: '',
    catatan_pelanggan: '',
    metode_pembayaran: 'tunai',
    status_global: 'review',
    dp_dibayar: 0,
    diskon_persen: 0,
    items: [
      {
        jenis_produk: '',
        product: null,
        product_nama: '',
        bahan: '',
        panjang: 0,
        lebar: 0,
        harga_per_m2: 0,
        qty: 1,
        keterangan_detail: '',
        is_meteran: true,
      },
    ],
  });

  if (!isOpen) return null;

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          jenis_produk: '',
          product: null,
          product_nama: '',
          bahan: '',
          panjang: 0,
          lebar: 0,
          harga_per_m2: 0,
          qty: 1,
          keterangan_detail: '',
          is_meteran: true,
        },
      ],
    });
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length > 1) {
      const newItems = [...formData.items];
      newItems.splice(index, 1);
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    if (field === 'panjang' || field === 'lebar') {
      const p = parseFloat(field === 'panjang' ? value : newItems[index].panjang) || 0;
      const l = parseFloat(field === 'lebar' ? value : newItems[index].lebar) || 0;
      if (p > 0 || l > 0) {
        newItems[index].is_meteran = true;
        if (!newItems[index].panjang || parseFloat(newItems[index].panjang) <= 0) newItems[index].panjang = 1;
        if (!newItems[index].lebar || parseFloat(newItems[index].lebar) <= 0) newItems[index].lebar = 1;
      }
    }
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((total, item) => {
      const p_raw = parseFloat(item.panjang);
      const l_raw = parseFloat(item.lebar);
      const isMeteran =
        item.is_meteran === true ||
        (item.is_meteran !== false && (p_raw > 0 || l_raw > 0));

      const qty = parseInt(item.qty) || 1;
      const harga = parseFloat(item.harga_per_m2) || 0;
      if (isMeteran) {
        const p = p_raw > 0 ? p_raw : 1;
        const l = l_raw > 0 ? l_raw : 1;
        return total + p * l * harga * qty;
      } else {
        return total + harga * qty;
      }
    }, 0);
  };

  const subtotal = calculateSubtotal();
  const nilaiDiskon = subtotal * (parseFloat(formData.diskon_persen || 0) / 100);
  const totalAkhir = subtotal - nilaiDiskon;
  const sisaTagihan = totalAkhir - parseFloat(formData.dp_dibayar || 0);

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // Mencegah double submit jika user klik ganda tombol simpan

    if (!formData.nomor_wa || !formData.nama) return alert('Data pelanggan wajib diisi!');
    if (formData.items.some((item) => !item.jenis_produk))
      return alert('Pastikan semua item memiliki jenis produk!');

    try {
      setIsSubmitting(true);

      let parsedWaktu = new Date().toISOString();
      if (formData.waktu) {
        const d = new Date(formData.waktu);
        if (!isNaN(d.getTime())) {
          parsedWaktu = d.toISOString();
        }
      }

      // 1. Buat Header Order
      const orderRes = await apiClient.post('/orders/', {
        nomor_wa: formData.nomor_wa,
        nama: formData.nama,
        waktu: parsedWaktu,
        catatan_pelanggan: formData.catatan_pelanggan,
        metode_pembayaran: formData.metode_pembayaran,
        status_global: formData.status_global || 'review',
        dp_dibayar: parseInt(formData.dp_dibayar) || 0,
        diskon_persen: parseFloat(formData.diskon_persen) || 0,
      });
      const orderId = orderRes.data.id;

      // 2. Buat Items
      const itemPromises = formData.items.map((item) => {
        const isMeteran = item.is_meteran !== false;
        const p = isMeteran ? parseFloat(item.panjang) || 0 : 0;
        const l = isMeteran ? parseFloat(item.lebar) || 0 : 0;
        const harga_jual = isMeteran
          ? p * l * (parseFloat(item.harga_per_m2) || 0) * (parseInt(item.qty) || 1)
          : (parseFloat(item.harga_per_m2) || 0) * (parseInt(item.qty) || 1);

        return apiClient.post('/order-items/', {
          order: orderId,
          jenis_produk: item.jenis_produk,
          product: item.product || null,
          bahan: item.bahan,
          panjang: p,
          lebar: l,
          harga_per_m2: item.harga_per_m2 || 0,
          qty: item.qty || 1,
          harga_jual: harga_jual,
          keterangan_detail: item.keterangan_detail, // Field baru
          detail: {},
        });
      });

      await Promise.all(itemPromises);
      alert('Pesanan berhasil disimpan!');
      onSuccess(); // Tutup & refresh
    } catch (err) {
      console.error('Gagal simpan order:', err);
      alert('Gagal menyimpan pesanan. Periksa koneksi atau console log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 z-50 overflow-y-auto flex flex-col animate-fade-in">
      {/* Header Fullscreen */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <ShoppingCart size={20} />
          </div>
          <div>
            <h2 className="text-[1.25rem] font-bold text-slate-900 leading-tight">
              Create New Print Job
            </h2>
            <p className="text-[12px] text-slate-500 font-medium">
              Lengkapi detail pesanan dan kalkulasi harga
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition-colors flex items-center gap-1 font-bold text-[12px]"
        >
          <X size={18} /> Tutup (Esc)
        </button>
      </div>

      <div className="p-6 max-w-[1400px] mx-auto w-full">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* KOLOM KIRI (65%) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Baris 1: Info Pelanggan & Tanggal */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <h3 className="text-[13px] font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <User size={14} className="text-indigo-500" /> Customer Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">
                      WhatsApp Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="08123456789"
                      value={formData.nomor_wa}
                      onChange={(e) => setFormData({ ...formData, nomor_wa: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-[13px] outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Pelanggan / PT"
                      value={formData.nama}
                      onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-[13px] outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>
              <div className="w-full md:w-64 space-y-4">
                <h3 className="text-[13px] font-bold text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Calendar size={14} className="text-indigo-500" /> Order Date
                </h3>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1.5 uppercase">
                    Waktu Pesanan
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.waktu}
                    onChange={(e) => setFormData({ ...formData, waktu: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-md text-[13px] outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Baris 2: Order Items */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-4">
                <h3 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                  <Calculator size={14} className="text-indigo-500" /> Item Detail & Kalkulasi Harga
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[11px] font-bold text-indigo-700 hover:text-white hover:bg-indigo-600 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-md border border-indigo-200 transition-colors"
                >
                  <Plus size={12} /> Tambah Item
                </button>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, idx) => {
                  const isMeteran = item.is_meteran !== false;
                  const sub = isMeteran
                    ? (parseFloat(item.panjang) || 0) *
                      (parseFloat(item.lebar) || 0) *
                      (parseFloat(item.harga_per_m2) || 0) *
                      (item.qty || 1)
                    : (parseFloat(item.harga_per_m2) || 0) * (item.qty || 1);
                  return (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-lg relative group"
                    >
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="absolute -top-3 -right-3 bg-red-100 text-red-600 p-1.5 rounded-full hover:bg-red-200 border border-red-200 shadow-sm"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        {/* 1. Product Type */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Product Type *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Banner / Yasin..."
                            value={item.jenis_produk}
                            onChange={(e) => handleItemChange(idx, 'jenis_produk', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] outline-none mt-1 focus:ring-1 focus:ring-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPricelistActiveIndex(idx);
                              setPriceSearch('');
                              setSelectedCategory('all');
                            }}
                            className="mt-1 w-full px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer shadow-sm transition-colors text-center"
                          >
                            Cari Harga
                          </button>
                          {/* Tautan ke master Produk — opsional, dipakai laporan penjualan
                              per SKU/Kategori/Brand. */}
                          <ProductMasterPicker
                            value={item.product}
                            valueLabel={item.product_nama}
                            onChange={(p) => {
                              handleItemChange(idx, 'product', p ? p.id : null);
                              handleItemChange(idx, 'product_nama', p ? p.nama : '');
                            }}
                          />
                        </div>

                        {/* 2. Kalkulasi */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Kalkulasi
                          </label>
                          <select
                            value={isMeteran ? 'meteran' : 'satuan'}
                            onChange={(e) => {
                              const val = e.target.value === 'meteran';
                              handleItemChange(idx, 'is_meteran', val);
                              if (!val) {
                                handleItemChange(idx, 'panjang', 0);
                                handleItemChange(idx, 'lebar', 0);
                              } else {
                                handleItemChange(idx, 'panjang', 1);
                                handleItemChange(idx, 'lebar', 1);
                              }
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] outline-none mt-1 focus:ring-1 focus:ring-slate-900 cursor-pointer"
                          >
                            <option value="meteran">P x L (Meteran)</option>
                            <option value="satuan">Pcs (Satuan)</option>
                          </select>
                        </div>

                        {/* 3. Material */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Material
                          </label>
                          <input
                            type="text"
                            placeholder="Bahan / Deskripsi..."
                            value={item.bahan}
                            onChange={(e) => handleItemChange(idx, 'bahan', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] outline-none mt-1 focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        {/* 4. Ukuran / Spacer */}
                        {isMeteran ? (
                          <div className="md:col-span-2 flex items-end gap-1">
                            <div className="w-full">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                P (m)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.panjang || ''}
                                onChange={(e) => handleItemChange(idx, 'panjang', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] text-center outline-none mt-1 focus:ring-1 focus:ring-slate-900"
                              />
                            </div>
                            <span className="pb-2 text-slate-400 font-bold text-[10px]">x</span>
                            <div className="w-full">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                L (m)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={item.lebar || ''}
                                onChange={(e) => handleItemChange(idx, 'lebar', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] text-center outline-none mt-1 focus:ring-1 focus:ring-slate-900"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="md:col-span-2"></div>
                        )}

                        {/* 5. Price */}
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            {isMeteran ? 'Price /m² (Rp)' : 'Price /Pcs (Rp)'}
                          </label>
                          <input
                            type="number"
                            value={item.harga_per_m2 || ''}
                            onChange={(e) => handleItemChange(idx, 'harga_per_m2', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] outline-none mt-1 focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        {/* 6. Qty */}
                        <div className="md:col-span-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Qty
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.qty || ''}
                            onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                            className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] text-center outline-none mt-1 focus:ring-1 focus:ring-slate-900"
                          />
                        </div>

                        {/* 7. Subtotal */}
                        <div className="md:col-span-1 text-right mt-5 pt-2">
                          <span className="block text-[9px] font-bold text-slate-400 uppercase md:hidden mb-1">
                            Subtotal
                          </span>
                          <p className="text-[12px] font-black text-indigo-700 leading-none">
                            {formatRupiah(sub)}
                          </p>
                        </div>

                        {/* Keterangan Detail Item (Area Baru) */}
                        <div className="md:col-span-12 mt-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">
                            Keterangan Khusus / Finishing (Opsional)
                          </label>
                          <textarea
                            rows="1"
                            placeholder="Mata ayam tiap sudut, laminasi doff..."
                            value={item.keterangan_detail}
                            onChange={(e) =>
                              handleItemChange(idx, 'keterangan_detail', e.target.value)
                            }
                            className="w-full p-2 bg-white border border-slate-200 rounded text-[12px] outline-none mt-1 focus:ring-1 focus:ring-slate-900 resize-none"
                          ></textarea>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* KOLOM KANAN (35%) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#0a0a0a] p-6 rounded-xl text-white shadow-xl sticky top-24">
              <h3 className="text-[13px] font-bold text-slate-300 border-b border-slate-800 pb-3 mb-5 flex items-center gap-2">
                <CreditCard size={16} /> Payment & Summary
              </h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                    Klasifikasi / Status Order
                  </label>
                  <select
                    value={formData.status_global}
                    onChange={(e) =>
                      setFormData({ ...formData, status_global: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-[13px] text-white outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="review">Fix Order (Menunggu Review)</option>
                    <option value="draft">Draft Penawaran</option>
                    <option value="quotation">Kirim Penawaran (Quotation)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                    Metode Pembayaran
                  </label>
                  <select
                    value={formData.metode_pembayaran}
                    onChange={(e) =>
                      setFormData({ ...formData, metode_pembayaran: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-[13px] text-white outline-none focus:ring-1 focus:ring-slate-500 cursor-pointer"
                  >
                    <option value="tunai">Tunai / Cash</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS / E-Wallet</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.diskon_persen}
                      onChange={(e) => setFormData({ ...formData, diskon_persen: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-[13px] text-white outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                      DP Dibayar (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.dp_dibayar}
                      onChange={(e) => setFormData({ ...formData, dp_dibayar: e.target.value })}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-[13px] text-white outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
                    Catatan Tambahan Nota
                  </label>
                  <textarea
                    rows="2"
                    value={formData.catatan_pelanggan}
                    onChange={(e) =>
                      setFormData({ ...formData, catatan_pelanggan: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-[13px] text-white outline-none resize-none focus:ring-1 focus:ring-slate-500"
                  />
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl p-5 border border-slate-800 space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-semibold">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Discount ({formData.diskon_persen || 0}%)</span>
                  <span>- {formatRupiah(nilaiDiskon)}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Down Payment</span>
                  <span className="font-semibold">- {formatRupiah(formData.dp_dibayar)}</span>
                </div>

                <div className="flex justify-between items-center bg-indigo-900/30 p-3 rounded-lg border border-indigo-800/50 mt-4">
                  <span className="font-bold text-indigo-300 text-[11px]">SISA TAGIHAN</span>
                  <span
                    className={`text-[18px] font-black ${sisaTagihan <= 0 ? 'text-emerald-400' : 'text-amber-400'}`}
                  >
                    {sisaTagihan <= 0 ? 'LUNAS' : formatRupiah(sisaTagihan)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-6 bg-white hover:bg-slate-200 text-black px-8 py-3.5 rounded-lg text-[14px] font-extrabold flex justify-center items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Save size={18} />
                )}
                Simpan & Cetak Job
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* MODAL DAFTAR HARGA */}
      {pricelistActiveIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Asisten Daftar Harga</h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Pilih produk untuk mengisi data item #{pricelistActiveIndex + 1}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPricelistActiveIndex(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pencarian */}
            <div className="p-4 border-b border-slate-100 flex gap-3 bg-white">
              <input
                type="text"
                value={priceSearch}
                onChange={(e) => setPriceSearch(e.target.value)}
                placeholder="Cari nama bahan, produk, banner, sticker..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden min-h-[400px]">
              {/* Sidebar Kategori */}
              <div className="w-56 bg-slate-50 border-r border-slate-100 p-2 overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors ${selectedCategory === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200/60'}`}
                >
                  Semua Kategori
                </button>
                {Object.entries(priceCategories).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCategory(key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors ${selectedCategory === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200/60'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Daftar Produk */}
              <div className="flex-1 p-4 overflow-y-auto bg-slate-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((prod, idx) => {
                      const currentQty =
                        parseInt(formData.items[pricelistActiveIndex]?.qty || '1') || 1;

                      return (
                        <div
                          key={idx}
                          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all"
                        >
                          <div>
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {priceCategories[prod.kategori] || prod.kategori}
                            </span>
                            <h4 className="font-bold text-slate-800 text-xs mt-2 capitalize">
                              {prod.nama_produk}
                              {prod.material ? ` (${prod.material})` : ''}
                            </h4>
                          </div>

                          <div className="mt-4 border-t border-slate-100 pt-3">
                            {prod.price_type === 'flat' ? (
                              <div className="flex justify-between items-center">
                                <span className="text-[13px] font-black text-slate-900">
                                  {formatRupiah(prod.harga)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSelectProduct(prod, prod.harga)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors shadow-sm"
                                >
                                  Pilih Item
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase">
                                  Harga Bertingkat (Qty saat ini: {currentQty}):
                                </p>
                                <div className="space-y-1.5">
                                  {Object.entries(prod.tiers || {}).map(([tierKey, tierVal]) => {
                                    const tierPrice = parseInt(tierVal) || 0;

                                    // Pengecekan apakah tier ini cocok dengan qty saat ini
                                    let isMatched;
                                    const cleanKey = tierKey.toLowerCase();
                                    if (cleanKey.includes('-')) {
                                      const parts = cleanKey.split('-');
                                      const min = parseInt(parts[0]) || 0;
                                      const max = parseInt(parts[1]) || 999999;
                                      isMatched = currentQty >= min && currentQty <= max;
                                    } else if (cleanKey.includes('>')) {
                                      const min = parseInt(cleanKey.replace(/[^\d]/g, '')) || 0;
                                      isMatched = currentQty > min;
                                    } else if (cleanKey.includes('<')) {
                                      const max =
                                        parseInt(cleanKey.replace(/[^\d]/g, '')) || 999999;
                                      isMatched = currentQty < max;
                                    } else {
                                      const val = parseInt(cleanKey.replace(/[^\d]/g, '')) || 1;
                                      isMatched = currentQty === val;
                                    }

                                    return (
                                      <div
                                        key={tierKey}
                                        className={`flex justify-between items-center p-1.5 rounded-lg border text-[10px] ${isMatched ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-100'}`}
                                      >
                                        <span
                                          className={`font-semibold ${isMatched ? 'text-emerald-800' : 'text-slate-600'}`}
                                        >
                                          {tierKey}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-800">
                                            {formatRupiah(tierPrice)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleSelectProduct(prod, tierPrice)}
                                            className={`px-2 py-1 rounded text-[9px] font-bold ${isMatched ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
                                          >
                                            Pilih
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 py-8 text-center text-slate-400 text-xs">
                      Tidak ada produk yang cocok dengan pencarian Anda.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setPricelistActiveIndex(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
