import { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

const KasirContext = createContext(null);

export function KasirProvider({ children }) {
  const { user } = useAuth();
  const [shiftAktif, setShiftAktif] = useState(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [cart, setCart] = useState([]);
  const [cartNotes, setCartNotes] = useState('');
  const [selectedContact, setSelectedContact] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [selectedCoupon, setSelectedCoupon] = useState(null);
  // Pilihan EKSPLISIT kasir dari selector diskon: 'tidak_ada' | 'otomatis' | 'kupon'.
  // Kupon & Diskon Penjualan saling eksklusif (tampilan tersendiri, bukan lagi
  // dibandingkan diam-diam) — mengurangi risiko kasir salah paham diskon mana
  // yang sebenarnya berlaku. Tebus Poin Loyalti tetap independen (bisa gabung).
  const [metodeDiskon, setMetodeDiskon] = useState('tidak_ada');
  // Opsi penukaran poin loyalty yang diterapkan pada transaksi (atau null).
  const [selectedRedemption, setSelectedRedemption] = useState(null);
  // Karyawan yang melayani (service order) — id User, diinput kasir.
  const [selectedPelayanId, setSelectedPelayanId] = useState('');

  // Fetch active shift status on mount
  const checkActiveShift = async () => {
    setLoadingShift(true);
    try {
      const response = await apiClient.get('/saldo-kas-harian/');
      const list = response.data.results || response.data || [];
      const now = new Date();
      const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      const isOpen = (item) =>
        (item.kas_akhir === null || item.kas_akhir === undefined) && !item.waktu_tutup;
      const getKasirId = (item) => {
        if (!item || item.kasir === undefined || item.kasir === null) return null;
        if (typeof item.kasir === 'object') return item.kasir.id;
        return item.kasir;
      };
      const milikSaya = (item) => {
        const kId = getKasirId(item);
        return user?.id && kId && String(kId) === String(user.id);
      };
      const active =
        list.find((item) => isOpen(item) && milikSaya(item) && item.tanggal === todayStr) ||
        list.find((item) => isOpen(item) && milikSaya(item)) ||
        null;
      setShiftAktif(active);
    } catch (error) {
      console.error('Error checking active shift:', error);
      setShiftAktif(null);
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    checkActiveShift();
  }, []);

  /**
   * Ganti satuan (UOM) sebuah baris keranjang. Harga ikut menyesuaikan ke harga
   * satuan tersebut; qty dibiarkan apa adanya karena diinput dalam satuan itu.
   * Backend yang mengonversi ke satuan dasar saat transaksi disimpan.
   */
  const setCartItemUom = (key, kode) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const units = Array.isArray(item.product?.uom_units) ? item.product.uom_units : [];
        const unit = units.find((u) => u.kode_satuan === kode);
        if (!unit) {
          // Kembali ke satuan dasar.
          const dasar = item.variant
            ? (item.variant.harga ?? 0)
            : (item.product?.harga_jual_toko || 0);
          return { ...item, uomKode: '', harga: Number(dasar) };
        }
        const hargaUnit =
          Number(unit.harga_jual_toko) ||
          Number(item.product?.harga_jual_toko || 0) * (Number(unit.konverter) || 1);
        return { ...item, uomKode: kode, harga: Number(hargaUnit) };
      })
    );
  };

  const addToCart = (product, variant = null) => {
    setCart((prev) => {
      const key = variant ? `${product.id}-${variant.id}` : `${product.id}`;
      const existing = prev.find((item) => item.key === key);

      if (existing) {
        return prev.map((item) =>
          item.key === key ? { ...item, qty: item.qty + 1 } : item
        );
      }

      // Snapshot harga: varian pakai `harga`/`nama_varian` sesuai model ProductVariant
      const price = variant ? (variant.harga ?? 0) : (product.harga_jual_toko || 0);
      const name = variant ? `${product.nama} (${variant.nama_varian})` : product.nama;

      return [
        ...prev,
        {
          key,
          product,
          variant,
          nama: name,
          harga: Number(price),
          qty: 1,
          catatan: '',
          // Satuan alternatif (UOM); '' = satuan dasar produk.
          uomKode: '',
        },
      ];
    });
  };

  const addCustomToCart = (nama, harga, qty = 1, catatan = '') => {
    setCart((prev) => {
      const key = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      return [
        ...prev,
        {
          key,
          product: null,
          variant: null,
          nama,
          harga: Number(harga),
          qty: Number(qty),
          catatan,
          uomKode: '',
        },
      ];
    });
  };

  const removeFromCart = (key) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const updateCartQty = (key, qty) => {
    if (qty <= 0) {
      removeFromCart(key);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, qty } : item))
    );
  };

  const updateCartItemNote = (key, note) => {
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, catatan: note } : item))
    );
  };

  // Simpan hasil kalkulator Detail Item (meteran/finishing/diskon per-item)
  // ke baris cart yang sesuai. Dipakai PosItemDetailPanel — sebelumnya hasil
  // kalkulator ini dihitung di layar tapi tidak pernah tersimpan ke cart sama
  // sekali (hanya qty & catatan yang persist).
  const updateCartItem = (key, patch) => {
    setCart((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  };

  const clearCart = () => {
    setCart([]);
    setCartNotes('');
    setSelectedContact(null);
    setDiscountPercent(0);
    setTaxPercent(0);
    setSelectedCoupon(null);
    setMetodeDiskon('tidak_ada');
    setSelectedRedemption(null);
  };

  const removeItemsFromCart = (itemsToRemove) => {
    if (!Array.isArray(itemsToRemove) || itemsToRemove.length === 0) return;
    setCart((prev) => {
      const removeMap = new Map();
      itemsToRemove.forEach((item) => {
        const current = removeMap.get(item.key) || 0;
        removeMap.set(item.key, current + Number(item.qty || 0));
      });

      return prev
        .map((item) => {
          const qtyToRemove = removeMap.get(item.key) || 0;
          if (!qtyToRemove) return item;
          const remainingQty = item.qty - qtyToRemove;
          return remainingQty > 0 ? { ...item, qty: remainingQty } : null;
        })
        .filter(Boolean);
    });
  };

  // Baris yang sudah dihitung PosItemDetailPanel (meteran/finishing/diskon
  // per-item) punya `hargaTotal` final — dipakai kalau ada, supaya subtotal
  // tidak diam-diam mengabaikan hasil kalkulator (harga*qty saja tidak
  // memperhitungkan finishing/diskon per-item).
  const getSubtotal = () => {
    return Math.round(
      cart.reduce(
        (sum, item) => sum + (item.hargaTotal != null ? Number(item.hargaTotal) : Number(item.harga) * Number(item.qty)),
        0
      )
    );
  };

  const getDiscountAmount = () => {
    return Math.round((getSubtotal() * Number(discountPercent || 0)) / 100);
  };

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

  // ── Diskon Penjualan otomatis (tanpa kode) ──
  // Server mengevaluasi aturan aktif tiap kali cart/pelanggan berubah (debounced)
  // supaya kasir tahu potongan SEBELUM checkout, dan supaya `total` yang dikirim
  // saat checkout cocok dengan yang backend hitung ulang (lihat create_sale).
  const [salesDiscountPreview, setSalesDiscountPreview] = useState(null);

  useEffect(() => {
    if (cart.length === 0) {
      setSalesDiscountPreview(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.post('/sales-discounts/preview/', {
          subtotal: getSubtotal(),
          pelanggan: selectedContact ? selectedContact.nomor_wa : null,
          items: cart.map((it) => ({
            product_id: it.product ? it.product.id : null,
            harga: it.harga,
            qty: it.qty,
          })),
        });
        if (!cancelled) setSalesDiscountPreview(res.data?.diskon > 0 ? res.data : null);
      } catch {
        if (!cancelled) setSalesDiscountPreview(null);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedContact]);

  const getSalesDiscountAmount = () => Number(salesDiscountPreview?.diskon || 0);

  // Nilai diskon Kupon/Diskon Penjualan yang BENAR-BENAR berlaku — ditentukan
  // oleh pilihan eksplisit kasir (`metodeDiskon`), bukan lagi dibandingkan
  // otomatis. Harus konsisten dengan `metode_diskon` yang dikirim ke server.
  const getPromoDiscountAmount = () => {
    if (metodeDiskon === 'kupon') return getCouponDiscountAmount();
    if (metodeDiskon === 'otomatis') return getSalesDiscountAmount();
    return 0;
  };

  // Diskon dari penebusan poin loyalty — cerminan compute_redemption_discount
  // di backend (persen dari subtotal dengan batas maksimal, atau nominal),
  // dibatasi agar tidak melebihi subtotal.
  const getLoyaltyDiscountAmount = () => {
    if (!selectedRedemption) return 0;
    const subtotal = getSubtotal();
    if (selectedRedemption.tipe_diskon === '%') {
      let val = Math.round((subtotal * Number(selectedRedemption.jumlah_diskon || 0)) / 100);
      if (Number(selectedRedemption.maksimal_jumlah_diskon) > 0) {
        val = Math.min(val, Number(selectedRedemption.maksimal_jumlah_diskon));
      }
      return Math.min(val, subtotal);
    }
    return Math.min(subtotal, Number(selectedRedemption.jumlah_diskon || 0));
  };

  const getTaxAmount = () => {
    const afterDiscount = Math.max(
      0,
      getSubtotal() - getDiscountAmount() - getPromoDiscountAmount() - getLoyaltyDiscountAmount(),
    );
    return Math.round((afterDiscount * Number(taxPercent || 0)) / 100);
  };

  const getTotal = () => {
    return Math.max(
      0,
      Math.round(
        getSubtotal() - getDiscountAmount() - getPromoDiscountAmount() - getLoyaltyDiscountAmount() + getTaxAmount(),
      ),
    );
  };

  return (
    <KasirContext.Provider
      value={{
        shiftAktif,
        setShiftAktif,
        loadingShift,
        checkActiveShift,
        cart,
        addToCart,
        addCustomToCart,
        setCartItemUom,
        removeFromCart,
        removeItemsFromCart,
        updateCartQty,
        updateCartItemNote,
        updateCartItem,
        clearCart,
        selectedContact,
        setSelectedContact,
        discountPercent,
        setDiscountPercent,
        taxPercent,
        setTaxPercent,
        selectedCoupon,
        setSelectedCoupon,
        metodeDiskon,
        setMetodeDiskon,
        selectedRedemption,
        setSelectedRedemption,
        selectedPelayanId,
        setSelectedPelayanId,
        getSubtotal,
        getDiscountAmount,
        getCouponDiscountAmount,
        salesDiscountPreview,
        getSalesDiscountAmount,
        getPromoDiscountAmount,
        getLoyaltyDiscountAmount,
        getTaxAmount,
        getTotal,
        cartNotes,
        setCartNotes,
      }}
    >
      {children}
    </KasirContext.Provider>
  );
}

export function useKasir() {
  const context = useContext(KasirContext);
  if (!context) {
    throw new Error('useKasir must be used within a KasirProvider');
  }
  return context;
}
