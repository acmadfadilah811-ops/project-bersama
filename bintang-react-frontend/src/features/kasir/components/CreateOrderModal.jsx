import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Plus, Trash2, ShoppingCart, ShoppingBag, Send, FileText, X, AlertTriangle, Search, PackagePlus } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import ProductMasterPicker from '../../orders/components/ProductMasterPicker';
import SpkPublishModal from './SpkPublishModal';
import NumericInput from '../../../components/NumericInput';
import { useKasir } from '../context/KasirContext';

const emptyItem = () => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  jenis_produk: '',
  product: null,
  product_nama: '',
  panjang: 1,
  lebar: 1,
  qty: 1,
  harga_jual: 0,
  addonIds: [],
  addonQty: {},
});

const checkIsMeteran = (product) => {
  if (!product) return false;
  const priceTypeM2 = product.price_type === 'per_m2';
  const nameMatch = (name) => {
    if (!name) return false;
    const n = String(name).toLowerCase();
    return (
      n.includes('per_m2') ||
      n.includes('outdoor') ||
      n.includes('banner') ||
      n.includes('spanduk') ||
      n.includes('baliho') ||
      n.includes('sticker') ||
      n.includes('meter')
    );
  };
  return (
    product.is_meteran === true ||
    product.tipe_kalkulasi === 'meteran' ||
    priceTypeM2 ||
    nameMatch(product.kategori_nama) ||
    nameMatch(product.kategori)
  );
};

export default function CreateOrderModal({ isOpen, onClose, onSuccess, initialCustomer, initialCart }) {
  const navigate = useNavigate();
  let shiftAktif = null;
  try {
    const kasirCtx = useKasir();
    shiftAktif = kasirCtx?.shiftAktif;
  } catch (e) {
    // If used outside KasirProvider
  }

  const [orderBaru, setOrderBaru] = useState(null);
  const [nama, setNama] = useState('');
  const [nomorWa, setNomorWa] = useState('');
  const [metode, setMetode] = useState('tunai');
  const [dp, setDp] = useState(0);
  const [diskon, setDiskon] = useState(0);
  const [couponInput, setCouponInput] = useState('');
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  const [evaluatingCoupon, setEvaluatingCoupon] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);

  // Pilihan EKSPLISIT kasir dari selector diskon: 'tidak_ada' | 'otomatis' | 'kupon'.
  // Kupon & Diskon Penjualan saling eksklusif (tampilan tersendiri, tidak lagi
  // dibandingkan diam-diam) — mengurangi risiko salah paham diskon mana yang
  // sebenarnya berlaku, sama seperti di POS Terminal.
  const [metodeDiskon, setMetodeDiskon] = useState('tidak_ada');

  // Diskon Penjualan otomatis (tanpa kode) — preview saja; server yang benar-benar
  // menerapkan (bila metode_diskon === 'otomatis') secara reaktif saat item
  // ditambahkan (lihat OrderItemViewSet di backend).
  const [salesDiscountPreview, setSalesDiscountPreview] = useState(null);

  // "Dilayani oleh" — karyawan yang melayani (bukan pemroses SPK).
  const [pelayanId, setPelayanId] = useState('');
  const [staffList, setStaffList] = useState([]);
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await apiClient.get('/pos/sales/staff-list/');
        setStaffList(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch {
        setStaffList([]);
      }
    })();
  }, [isOpen]);

  // Customer Autocomplete States
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef(null);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasInitialized.current) {
        if (initialCustomer) {
          setNama(initialCustomer.nama || '');
          setNomorWa(initialCustomer.nomor_wa || '');
        }
        if (initialCart && initialCart.length > 0) {
          const mappedItems = initialCart.map((c) => ({
            id: `cart-${c.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            jenis_produk: c.nama || c.jenis_produk || '',
            product: c.product?.id || c.product_id || c.id || null,
            product_nama: c.nama || '',
            panjang: c.panjang || 1,
            lebar: c.lebar || 1,
            qty: c.qty || 1,
            harga_jual: c.harga_jual_toko || c.harga || 0,
          }));
          setItems(mappedItems);
        }
        hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
    }
  }, [isOpen, initialCustomer, initialCart]);

  // Click outside to close customer dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchCustomers = async (query) => {
    try {
      const res = await apiClient.get('/contacts/', { params: { search: query } });
      setCustomerSuggestions(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Error searching customers:', err);
    }
  };

  // Product Catalog States for Left Panel
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Add-on per item — sebelumnya form Antrean WA tidak punya pilihan addon
  // sama sekali (beda dari POS Terminal), daftarnya diambil sekali saat modal
  // dibuka lalu difilter per item berdasarkan produk yang dipilih (sama
  // dengan pola PosItemDetailPanel: berlaku umum kalau applies_to/
  // applies_to_categories kosong, kalau tidak harus cocok salah satunya).
  const [addons, setAddons] = useState([]);
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const res = await apiClient.get('/addons/');
        setAddons(Array.isArray(res.data) ? res.data : res.data?.results || []);
      } catch (err) {
        console.error('Error fetching addons:', err);
      }
    })();
  }, [isOpen]);

  const getApplicableAddons = (it) => {
    if (!it.product) return [];
    const prod = products.find((p) => p.id === it.product);
    const kategoriId = prod?.kategori || null;
    return addons.filter((a) => {
      const scopedToProduct = Array.isArray(a.applies_to) && a.applies_to.length > 0;
      const scopedToCategory = Array.isArray(a.applies_to_categories) && a.applies_to_categories.length > 0;
      if (!scopedToProduct && !scopedToCategory) return true;
      if (scopedToProduct && a.applies_to.includes(it.product)) return true;
      if (scopedToCategory && kategoriId && a.applies_to_categories.includes(kategoriId)) return true;
      return false;
    });
  };

  const getAddonsTotal = (it) => {
    const applicable = getApplicableAddons(it);
    return (it.addonIds || []).reduce((sum, id) => {
      const addon = applicable.find((a) => a.id === id);
      if (!addon) return sum;
      return sum + (Number(addon.harga) || 0) * (it.addonQty?.[id] || 1);
    }, 0);
  };

  const toggleItemAddon = (idx, addonId) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it;
      const already = (it.addonIds || []).includes(addonId);
      const addonIds = already ? it.addonIds.filter((id) => id !== addonId) : [...(it.addonIds || []), addonId];
      const addonQty = { ...(it.addonQty || {}) };
      if (!already && !addonQty[addonId]) addonQty[addonId] = 1;
      return { ...it, addonIds, addonQty };
    }));
  };

  const setItemAddonQty = (idx, addonId, val) => {
    const n = Math.max(1, parseInt(val) || 1);
    setItems((prev) => prev.map((it, i) => (
      i === idx ? { ...it, addonQty: { ...(it.addonQty || {}), [addonId]: n } } : it
    )));
  };

  // Fetch Categories
  useEffect(() => {
    if (!isOpen) return;
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get('/product-categories/');
        const activeCats = (res.data || []).filter((c) => c.tampil_pos);
        setCategories(activeCats);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, [isOpen]);

  // Fetch Products based on category & search
  useEffect(() => {
    if (!isOpen) return;
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const params = { is_active: true };
        if (selectedCategory && selectedCategory !== 'all') {
          params.kategori = selectedCategory;
        }
        if (searchTerm) {
          params.search = searchTerm;
        }
        const data = await fetchAllPages('/products/', { params });
        setProducts(data);
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoadingProducts(false);
      }
    };

    const delayDebounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(delayDebounce);
  }, [isOpen, selectedCategory, searchTerm]);

  // Add Product from Left Catalog to Right Order Items
  const addProductToOrder = (product) => {
    const detectedPrice = product.harga_jual_toko ?? product.harga_jual ?? 0;
    const isMeteran = checkIsMeteran(product);

    const newItem = {
      id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jenis_produk: product.nama,
      product: product.id,
      product_nama: product.nama,
      panjang: 1,
      lebar: 1,
      is_meteran: isMeteran,
      qty: 1,
      harga_jual: detectedPrice,
      addonIds: [],
      addonQty: {},
    };

    setItems((prev) => {
      if (prev.length === 1 && !prev[0].jenis_produk && !prev[0].product) {
        return [newItem];
      }
      return [...prev, newItem];
    });
  };

  // Preview Diskon Penjualan otomatis — murni informasi untuk kasir sebelum
  // order disimpan; nilai final dievaluasi ulang & mengikat di server begitu
  // item-item order benar-benar dibuat (lihat OrderItemViewSet). Ditaruh
  // sebelum early-return di bawah (Rules of Hooks: hook tak boleh kondisional),
  // sehingga subtotal item dihitung inline (helper getItemSubtotal didefinisikan
  // setelah early-return, belum bisa dipakai di sini).
  useEffect(() => {
    const validItems = items.filter((it) => it.jenis_produk && it.jenis_produk.trim());
    if (!isOpen || validItems.length === 0) {
      setSalesDiscountPreview(null);
      return undefined;
    }
    const hitungSubtotalItem = (it) => {
      const pRaw = parseFloat(it.panjang);
      const lRaw = parseFloat(it.lebar);
      const isMeteran = it.is_meteran === true || (it.is_meteran !== false && (pRaw > 0 || lRaw > 0));
      const p = pRaw > 0 ? pRaw : 1;
      const l = lRaw > 0 ? lRaw : 1;
      const qty = parseInt(it.qty) || 1;
      const harga = parseFloat(it.harga_jual) || 0;
      return (isMeteran ? p * l * harga * qty : harga * qty) + getAddonsTotal(it);
    };
    const subtotal = validItems.reduce((sum, it) => sum + hitungSubtotalItem(it), 0);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.post('/sales-discounts/preview/', {
          subtotal,
          pelanggan: null,
          items: validItems.map((it) => {
            const qty = parseInt(it.qty) || 1;
            return { product_id: it.product || null, harga: hitungSubtotalItem(it) / qty, qty };
          }),
        });
        if (!cancelled) setSalesDiscountPreview(res.data?.diskon > 0 ? res.data : null);
      } catch {
        if (!cancelled) setSalesDiscountPreview(null);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, items]);

  if (!isOpen && !orderBaru) return null;

  const formatCurrency = (v) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);

  // Subtotal item TANPA addon — ini yang dikirim sebagai harga_jual ke server
  // (lihat handleSubmit). Server menghitung ulang & menambahkan harga addon
  // sendiri dari Addon.harga (M6) - kalau addon ikut dijumlahkan di sini,
  // harganya kena hitung dobel (client + server).
  const getItemPokokSubtotal = (it) => {
    const p_raw = parseFloat(it.panjang);
    const l_raw = parseFloat(it.lebar);
    const isMeteran =
      it.is_meteran === true ||
      (it.is_meteran !== false && (p_raw > 0 || l_raw > 0));
    const p = p_raw > 0 ? p_raw : 1;
    const l = l_raw > 0 ? l_raw : 1;
    const qty = parseInt(it.qty) || 1;
    const harga = parseFloat(it.harga_jual) || 0;
    return isMeteran ? p * l * harga * qty : harga * qty;
  };

  // Subtotal item TERMASUK addon — dipakai untuk tampilan (kolom Subtotal,
  // ringkasan Total) supaya kasir melihat angka akhir yang benar sebelum submit.
  const getItemSubtotal = (it) => getItemPokokSubtotal(it) + getAddonsTotal(it);

  const changeItem = (idx, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: value };
        if (field === 'panjang' || field === 'lebar') {
          const p = parseFloat(field === 'panjang' ? value : it.panjang) || 0;
          const l = parseFloat(field === 'lebar' ? value : it.lebar) || 0;
          if (p > 0 || l > 0) {
            updated.is_meteran = true;
            if (!updated.panjang || parseFloat(updated.panjang) <= 0) updated.panjang = 1;
            if (!updated.lebar || parseFloat(updated.lebar) <= 0) updated.lebar = 1;
          }
        }
        return updated;
      })
    );
  };
  const updateItem = (idx, patch) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const getSubtotal = () =>
    items.reduce((sum, it) => sum + getItemSubtotal(it), 0);

  const getCouponDiscountAmount = () => {
    if (!selectedCoupon) return 0;
    const subtotal = getSubtotal();
    if (selectedCoupon.min_total_pesanan && subtotal < Number(selectedCoupon.min_total_pesanan)) {
      return 0;
    }
    if (selectedCoupon.tipe_diskon === 'percent') {
      let val = Math.round((subtotal * Number(selectedCoupon.jumlah_diskon || 0)) / 100);
      if (Number(selectedCoupon.maksimal_jumlah_diskon) > 0) {
        val = Math.min(val, Number(selectedCoupon.maksimal_jumlah_diskon));
      }
      return Math.min(val, subtotal);
    }
    return Math.min(subtotal, Number(selectedCoupon.jumlah_diskon || 0));
  };

  const getPercentDiscountAmount = () =>
    Math.round((getSubtotal() * parseFloat(diskon || 0)) / 100);

  const getSalesDiscountAmount = () => Number(salesDiscountPreview?.diskon || 0);

  // Nilai diskon Kupon/Diskon Penjualan yang BENAR-BENAR berlaku — ditentukan
  // oleh pilihan eksplisit kasir (`metodeDiskon`), harus konsisten dengan
  // `metode_diskon` yang dikirim ke server saat submit.
  const getPromoDiscountAmount = () => {
    if (metodeDiskon === 'kupon') return getCouponDiscountAmount();
    if (metodeDiskon === 'otomatis') return getSalesDiscountAmount();
    return 0;
  };

  const getTotal = () =>
    Math.max(0, getSubtotal() - getPercentDiscountAmount() - getPromoDiscountAmount());

  const getSisa = () =>
    Math.max(0, getTotal() - parseFloat(dp || 0));

  const applyCouponCode = async (codeToApply) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;
    setEvaluatingCoupon(true);
    try {
      const res = await apiClient.post('/discount-coupons/evaluate/', {
        kode: code,
        subtotal: getSubtotal(),
        pelanggan: null,
        items: items.map(it => ({
          product_id: it.product,
          harga: it.harga_jual,
          qty: it.qty
        }))
      });
      if (res.data?.ok) {
        const kupon = res.data.kupon;
        // Hanya simpan `selectedCoupon` — JANGAN ikut mengisi `diskon` (field
        // diskon manual/persen). Diskon kupon sudah dihitung & dikirim sendiri
        // lewat `kupon_kode`/`diskon_kupon` di handleSubmit. Kalau `diskon` ikut
        // diisi dari kupon, getTotal() akan memotong diskon yang sama dua kali
        // (sekali sebagai diskon manual, sekali lagi sebagai diskon kupon) —
        // begitu pula di server (diskon_persen + diskon_kupon dihitung terpisah).
        setSelectedCoupon(kupon);
        setMetodeDiskon('kupon');
        setCouponInput('');
        alert('Kupon berhasil diterapkan!');
      } else {
        alert(res.data?.alasan || 'Kupon tidak dapat digunakan.');
      }
    } catch (err) {
      alert(err.response?.data?.alasan || err.response?.data?.error || 'Kode kupon tidak valid atau tidak dapat digunakan.');
    } finally {
      setEvaluatingCoupon(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!shiftAktif) {
      alert('Shift kasir belum dibuka. Buka shift terlebih dahulu sebelum membuat order.');
      return;
    }
    if (!nama.trim()) {
      alert('Nama pelanggan wajib diisi.');
      return;
    }
    // Validasi format nomor WhatsApp — sama dengan yang ditegakkan server
    // (angka 8-15 digit, boleh diawali +). Order tanpa data pelanggan yang
    // valid tidak bisa dipertanggungjawabkan, jadi ditolak di sini SEBELUM
    // mengirim ke server (server tetap menegakkan ulang sebagai jaring aman).
    const nomorBersih = nomorWa.replace(/[\s\-()]+/g, '');
    if (!/^\+?\d{8,15}$/.test(nomorBersih)) {
      alert('Nomor WhatsApp pelanggan tidak valid. Gunakan format angka 8-15 digit (boleh diawali +).');
      return;
    }
    if (!pelayanId) {
      alert('Karyawan yang melayani (Dilayani Oleh) wajib dipilih, supaya order dapat dipertanggungjawabkan.');
      return;
    }
    const validItems = items.filter((it) => it.jenis_produk.trim());
    if (validItems.length === 0) {
      alert('Order harus memuat minimal satu item pesanan.');
      return;
    }

    setSaving(true);
    try {
      const resOrder = await apiClient.post('/orders/', {
        nama,
        nomor_wa: nomorWa,
        catatan_pelanggan: catatan,
        metode_pembayaran: metode,
        dp_dibayar: parseInt(dp || 0),
        diskon_persen: parseFloat(diskon || 0),
        status_global: 'review',
        metode_diskon: metodeDiskon,
        kupon_kode: metodeDiskon === 'kupon' && selectedCoupon ? selectedCoupon.kode : null,
        diskon_kupon: metodeDiskon === 'kupon' ? getCouponDiscountAmount() : 0,
        dilayani_oleh: pelayanId || null,
      });
      const orderId = resOrder.data.id;
      for (const it of validItems) {
        const itemSubtotal = getItemPokokSubtotal(it);
        await apiClient.post('/order-items/', {
          order: orderId,
          jenis_produk: it.jenis_produk,
          product: it.product || null,
          panjang: parseFloat(it.panjang || 0),
          lebar: parseFloat(it.lebar || 0),
          harga_per_m2: parseFloat(it.harga_jual || 0),
          qty: parseInt(it.qty || 1),
          harga_jual: Math.round(itemSubtotal),
          // Harga & qty addon SELALU dihitung ulang di server dari Addon.harga
          // (M6) - payload ini cuma bawa id + qty per addon yang dipilih kasir.
          addons: (it.addonIds || []).map((id) => ({ id, qty: it.addonQty?.[id] || 1 })),
        });
      }
      setOrderBaru({ id: orderId, nama });
    } catch (err) {
      console.error('Gagal membuat order:', err);
      alert(
        'Order gagal disimpan: ' +
          (err.response?.data?.detail || err.response?.data?.error || err.message || 'terjadi kesalahan pada server.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = () => {
    setOrderBaru(null);
    setNama('');
    setNomorWa('');
    setCatatan('');
    setDp(0);
    setDiskon(0);
    setCouponInput('');
    setSelectedCoupon(null);
    setPelayanId('');
    setItems([emptyItem()]);
    if (onSuccess) onSuccess();
    if (onClose) onClose();
  };

  const terbitkanSpk = async (payload) => {
    try {
      await apiClient.post(`/orders/${orderBaru.id}/assign/`, payload);
      alert(`Order #${orderBaru.id} tersimpan dan SPK telah diterbitkan ke divisi produksi.`);
    } catch (err) {
      console.error('Gagal terbit SPK:', err);
      alert(
        `Order #${orderBaru.id} tersimpan, namun SPK gagal diterbitkan. Terbitkan ulang melalui menu Antrean WA.`
      );
      throw err;
    }
    handleFinish();
  };

  const lewatiSpk = () => {
    handleFinish();
  };

  const inputCls =
    'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F4F7FE] overflow-hidden">
      {orderBaru && (
        <SpkPublishModal
          judul={`Terbitkan SPK — Order ${orderBaru.id}`}
          keterangan={`Order atas nama ${orderBaru.nama} telah tersimpan. Pilih divisi produksi untuk menerbitkan SPK sekarang, atau lewati bila penugasan akan dilakukan kemudian melalui Antrean WA.`}
          onTerbitkan={terbitkanSpk}
          onClose={lewatiSpk}
        />
      )}

      {!orderBaru && (
        <div className="flex-1 flex flex-col h-screen w-full bg-[#F4F7FE] overflow-hidden">
          {/* Top Navbar Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-md shadow-emerald-600/20">
                <ShoppingCart size={20} />
              </div>
              <div>
                <h1 className="text-base font-black text-slate-800 tracking-tight">Pembuatan Order & Penerbitan SPK</h1>
                <p className="text-[11px] font-semibold text-slate-500">
                  Pilih produk dari katalog atau tambahkan item manual, lengkapi data pelanggan, lalu terbitkan SPK ke divisi produksi.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <X size={16} />
                <span>Kembali ke Terminal</span>
              </button>
            </div>
          </header>

          {!shiftAktif && (
            <div className="mx-6 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-900 text-xs uppercase tracking-wider">Shift Kasir Belum Dibuka</h4>
                  <p className="text-[11px] text-amber-700 font-medium">
                    Order tidak dapat disimpan sebelum shift dibuka. Buka shift terlebih dahulu agar transaksi tercatat pada periode kas yang benar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onClose) onClose();
                  navigate('/kasir/shift');
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg shrink-0 transition-all shadow-sm cursor-pointer"
              >
                Buka Shift Sekarang
              </button>
            </div>
          )}

          {/* 2-Column Terminal Split View */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            {/* Left Column: Product Catalog */}
            <div className="w-full lg:w-5/12 xl:w-[420px] bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0">
              <div className="p-3.5 bg-white border-b border-slate-200 space-y-2.5 shrink-0">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari produk berdasarkan nama atau SKU"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.nama}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Cards Grid */}
              <div className="flex-1 p-3.5 overflow-y-auto">
                {loadingProducts ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600"></div>
                  </div>
                ) : products.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-dashed border-slate-200 rounded-xl">
                    <ShoppingBag size={28} className="text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-500">Produk tidak ditemukan</p>
                    <p className="text-[11px] font-semibold text-slate-400 mt-1">
                      Ubah kata kunci pencarian atau pilih kategori lain.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                    {products.map((product) => {
                      const fotoUtama =
                        product.fotos?.find((f) => f.is_primary)?.foto ||
                        product.fotos?.[0]?.foto ||
                        product.gambar ||
                        product.foto ||
                        null;

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProductToOrder(product)}
                          className="group bg-white rounded-xl border border-slate-200 p-2 text-left hover:shadow-md hover:border-indigo-300 transition-all flex items-center gap-2 cursor-pointer overflow-hidden min-w-0"
                        >
                          {fotoUtama ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-150">
                              <img
                                src={fotoUtama}
                                alt={product.nama}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => {
                                  e.target.parentElement.style.display = 'none';
                                }}
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 shrink-0 flex items-center justify-center text-indigo-500">
                              <ShoppingBag size={16} />
                            </div>
                          )}

                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h6 className="font-extrabold text-slate-800 text-xs truncate leading-snug" title={product.nama}>
                              {product.nama}
                            </h6>
                            <span className="text-[11px] font-black text-indigo-600 block mt-0.5 truncate">
                              {formatCurrency(product.harga_jual_toko)}
                            </span>
                          </div>
                          <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 opacity-80 group-hover:opacity-100 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                            <Plus size={14} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Customer Data & SPK Order Form */}
            <div className="flex-1 bg-white overflow-y-auto p-5 flex flex-col gap-4">
              {/* Customer Data Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm">
                <h2 className="text-xs font-extrabold text-slate-800 mb-2.5 flex items-center gap-2">
                  <User size={15} className="text-indigo-600" /> Data Pelanggan
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative" ref={customerDropdownRef}>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1">Nama Pelanggan *</label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={nama}
                        onChange={(e) => {
                          setNama(e.target.value);
                          searchCustomers(e.target.value);
                          setShowCustomerDropdown(true);
                        }}
                        onFocus={() => {
                          searchCustomers(nama);
                          setShowCustomerDropdown(true);
                        }}
                        placeholder="Ketik nama untuk mencari pelanggan terdaftar"
                        className={inputCls}
                      />
                      <Search size={14} className="absolute right-3 text-slate-400 pointer-events-none" />
                    </div>

                    {showCustomerDropdown && customerSuggestions.length > 0 && (
                      <div className="absolute inset-x-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {customerSuggestions.map((c) => (
                          <button
                            key={c.id || c.nomor_wa}
                            type="button"
                            onClick={() => {
                              setNama(c.nama);
                              setNomorWa(c.nomor_wa);
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full px-3 py-2 hover:bg-indigo-50 text-left text-xs font-semibold text-slate-700 flex justify-between cursor-pointer border-b border-slate-100"
                          >
                            <span className="font-bold text-slate-800">{c.nama}</span>
                            <span className="text-slate-400">{c.nomor_wa}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                      <Phone size={12} /> Nomor WhatsApp *
                    </label>
                    <input
                      type="text"
                      value={nomorWa}
                      onChange={(e) => setNomorWa(e.target.value)}
                      placeholder="Format 62, contoh: 6281234567890"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Dilayani oleh (service order) — karyawan yang melayani, bukan pemroses SPK.
                    WAJIB diisi supaya setiap order dapat dipertanggungjawabkan. */}
                <div className="mt-3">
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 flex items-center gap-1">
                    <User size={12} /> Dilayani oleh <span className="text-rose-500">*</span>
                    <span className="font-medium text-slate-400 normal-case">(pelayanan, bukan pemroses order)</span>
                  </label>
                  <select
                    value={pelayanId}
                    onChange={(e) => setPelayanId(e.target.value)}
                    className={`${inputCls} ${!pelayanId ? 'border-rose-300' : ''}`}
                  >
                    <option value="">— Pilih karyawan yang melayani —</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama}{s.role ? ` — ${s.role}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order Items Table Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm flex-1">
                <div className="flex items-center justify-between mb-2.5">
                  <h2 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                    <FileText size={15} className="text-indigo-600" /> Rincian Item Pesanan ({items.length})
                  </h2>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    title="Tambahkan item di luar katalog produk"
                  >
                    <Plus size={14} /> Tambah Item Manual
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl bg-white overflow-visible">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                        <th className="px-3 py-2 min-w-[220px]">Deskripsi Item / Produk Master</th>
                        <th className="px-3 py-2 w-28">Ukuran P × L (m)</th>
                        <th className="px-3 py-2 w-16 text-center">Qty</th>
                        <th className="px-3 py-2 w-28 text-right">Harga Satuan</th>
                        <th className="px-3 py-2 text-right">Subtotal</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr
                          key={it.id}
                          className="border-b border-slate-100 text-xs font-semibold text-slate-700 hover:bg-slate-50/50"
                        >
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={it.jenis_produk}
                              placeholder="Contoh: Cetak Banner Flexi 280gr"
                              onChange={(e) => changeItem(idx, 'jenis_produk', e.target.value)}
                              className="w-full bg-transparent border-0 focus:outline-none p-0 text-xs font-extrabold text-slate-800 placeholder:font-normal mb-1"
                            />
                            <ProductMasterPicker
                              value={it.product}
                              valueLabel={it.product_nama}
                              onChange={(p) => {
                                if (p) {
                                  const detectedPrice = p.harga_jual_toko ?? p.harga_jual ?? 0;
                                  const isMeteran = checkIsMeteran(p);
                                  updateItem(idx, {
                                    product: p.id,
                                    product_nama: p.nama,
                                    jenis_produk: it.jenis_produk ? it.jenis_produk : p.nama,
                                    harga_jual: detectedPrice > 0 ? detectedPrice : it.harga_jual,
                                    is_meteran: isMeteran,
                                    panjang: it.panjang || 1,
                                    lebar: it.lebar || 1,
                                    // Addon lama belum tentu berlaku untuk produk baru
                                    // (applies_to/applies_to_categories beda) — reset.
                                    addonIds: [],
                                    addonQty: {},
                                  });
                                } else {
                                  updateItem(idx, { product: null, product_nama: '', is_meteran: false, addonIds: [], addonQty: {} });
                                }
                              }}
                            />
                            {getApplicableAddons(it).length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {getApplicableAddons(it).map((addon) => {
                                  const isSelected = (it.addonIds || []).includes(addon.id);
                                  return (
                                    <div
                                      key={addon.id}
                                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${
                                        isSelected ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                                      }`}
                                    >
                                      <label className="flex items-center gap-1 cursor-pointer">
                                        <PackagePlus size={10} />
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleItemAddon(idx, addon.id)}
                                          className="accent-indigo-600 w-3 h-3"
                                        />
                                        <span>{addon.nama}</span>
                                      </label>
                                      {isSelected && (
                                        <input
                                          type="number"
                                          min={1}
                                          value={it.addonQty?.[addon.id] || 1}
                                          onChange={(e) => setItemAddonQty(idx, addon.id, e.target.value)}
                                          title="Qty addon"
                                          className="w-8 bg-white border border-indigo-200 rounded px-0.5 text-center"
                                        />
                                      )}
                                      <span className="text-slate-400">
                                        +Rp{Number(addon.harga || 0).toLocaleString('id-ID')}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <NumericInput
                                allowDecimal={true}
                                value={it.panjang}
                                onChange={(val) => changeItem(idx, 'panjang', val)}
                                className="w-10 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-center text-xs font-extrabold focus:bg-white focus:outline-none"
                              />
                              <span className="text-slate-400 text-xs font-bold">×</span>
                              <NumericInput
                                allowDecimal={true}
                                value={it.lebar}
                                onChange={(val) => changeItem(idx, 'lebar', val)}
                                className="w-10 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-center text-xs font-extrabold focus:bg-white focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <NumericInput
                              min={1}
                              value={it.qty}
                              onChange={(val) => changeItem(idx, 'qty', val)}
                              className="w-12 bg-slate-50 border border-slate-200 rounded-lg px-1 py-0.5 text-center text-xs font-bold focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <NumericInput
                              value={it.harga_jual}
                              onChange={(val) => changeItem(idx, 'harga_jual', val)}
                              className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-right text-xs font-extrabold focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-black text-slate-900 text-xs">
                            {formatCurrency(getItemSubtotal(it))}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Notes & Payment Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-800 block mb-1">Catatan Produksi</label>
                  <textarea
                    rows="4"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Instruksi desain, spesifikasi bahan, finishing, atau tenggat pengerjaan"
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between items-center">
                    <span>Subtotal</span>
                    <span className="text-slate-800 font-extrabold text-xs">{formatCurrency(getSubtotal())}</span>
                  </div>
                    <div className="flex items-center justify-between">
                      <span>Diskon (%)</span>
                      <NumericInput
                        min={0}
                        max={100}
                        allowDecimal={true}
                        formatThousand={true}
                        value={diskon}
                        onChange={(val) => setDiskon(val)}
                        className="w-20 text-right px-2 py-0.5 border border-slate-200 rounded-lg font-bold bg-white text-slate-800"
                      />
                    </div>

                  {/* Selector Jenis Diskon — pilihan EKSPLISIT kasir (bukan lagi
                      dibandingkan otomatis di belakang layar), tampilan tersendiri
                      supaya jelas mekanisme mana yang aktif. */}
                  <div className="pt-1 border-t border-dashed border-slate-200">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Jenis Diskon
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => { setMetodeDiskon('tidak_ada'); setSelectedCoupon(null); }}
                        className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          metodeDiskon === 'tidak_ada' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Tidak Ada
                      </button>
                      <button
                        type="button"
                        disabled={!salesDiscountPreview?.diskon}
                        onClick={() => { setMetodeDiskon('otomatis'); setSelectedCoupon(null); }}
                        title={!salesDiscountPreview?.diskon ? 'Tidak ada Diskon Penjualan yang berlaku' : ''}
                        className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          metodeDiskon === 'otomatis' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Otomatis{salesDiscountPreview?.diskon ? ` (${formatCurrency(salesDiscountPreview.diskon)})` : ''}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMetodeDiskon('kupon')}
                        className={`py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          metodeDiskon === 'kupon' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Kupon Diskon
                      </button>
                    </div>

                    {metodeDiskon === 'kupon' && (
                      <div className="mt-1.5">
                        {!selectedCoupon ? (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              placeholder="KODE KUPON PROMO"
                              value={couponInput}
                              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                              className="flex-1 px-2 py-1 text-[11px] border border-slate-200 rounded-lg uppercase font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => applyCouponCode()}
                              disabled={evaluatingCoupon}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg disabled:opacity-50 cursor-pointer"
                            >
                              {evaluatingCoupon ? 'Checking...' : 'Terapkan'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-lg p-1.5 text-[11px]">
                            <div className="flex flex-col">
                              <span className="font-bold text-emerald-800 uppercase">{selectedCoupon.kode}</span>
                              <span className="text-[10px] text-slate-500">{selectedCoupon.judul}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-emerald-700">-{formatCurrency(getCouponDiscountAmount())}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedCoupon(null)}
                                className="text-slate-400 hover:text-rose-500 font-bold p-0.5 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center font-black text-slate-900 text-xs pt-1 border-t border-slate-200">
                    <span>Total</span>
                    <span className="text-indigo-600 text-sm">{formatCurrency(getTotal())}</span>
                  </div>
                  <div className="h-px bg-slate-200 my-0.5" />
                  <div className="flex items-center justify-between">
                    <span>DP / Uang Muka</span>
                    <NumericInput
                      value={dp}
                      onChange={(val) => setDp(val)}
                      className="w-28 text-right px-2 py-0.5 border border-slate-200 rounded-lg font-extrabold bg-white text-slate-800"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Metode Pembayaran DP</span>
                    <select
                      value={metode}
                      onChange={(e) => setMetode(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="tunai">Tunai</option>
                      <option value="transfer">Transfer</option>
                      <option value="debit">Debit</option>
                      <option value="qris">QRIS</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>Sisa Tagihan</span>
                    <span className="text-rose-600 text-sm">{formatCurrency(getSisa())}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Submit Action */}
              <div className="flex justify-end gap-3 pt-2 pb-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send size={16} />
                  )}
                  <span>{saving ? 'Menyimpan Order...' : 'Simpan Order & Terbitkan SPK'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
