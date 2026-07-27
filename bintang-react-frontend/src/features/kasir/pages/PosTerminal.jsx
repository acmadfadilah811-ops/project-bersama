import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Minus, Trash2, User, UserCheck, CreditCard, ShoppingBag, Percent, AlertCircle, X, Factory, Tag, Sparkles } from 'lucide-react';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';
import CustomItemModal from '../components/CustomItemModal';
import CreateOrderModal from '../components/CreateOrderModal';
import SpkPublishModal from '../components/SpkPublishModal';
import SplitBillModal from '../components/SplitBillModal';
import ReceiptPrint from '../components/ReceiptPrint';
import NumericInput from '../../../components/NumericInput';
import { notifyApiError } from '../../../utils/notify';
import PosCatalog from '../components/PosCatalog';

export default function PosTerminal() {
  const navigate = useNavigate();
  const {
    shiftAktif,
    cart,
    addToCart,
    addCustomToCart,
    setCartItemUom,
    removeFromCart,
    removeItemsFromCart,
    updateCartQty,
    updateCartItemNote,
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
    getLoyaltyDiscountAmount,
    getTaxAmount,
    getTotal,
    cartNotes,
    setCartNotes,
  } = useKasir();

  // Loyalty Point States
  const [redemptions, setRedemptions] = useState([]);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showLinkMemberModal, setShowLinkMemberModal] = useState(false);
  const [memberList, setMemberList] = useState([]);
  const [memberQuery, setMemberQuery] = useState('');

  // Daftar karyawan untuk pilihan "Dilayani oleh" (service order).
  const [staffList, setStaffList] = useState([]);

  // Coupon States
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponInput, setCouponInput] = useState('');
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [evaluatingCoupon, setEvaluatingCoupon] = useState(false);

  // Catalog States
  // Pengaturan POS yang memengaruhi perilaku kasir. Penegakan sesungguhnya ada
  // di server; ini hanya cermin agar kasir dapat umpan balik lebih awal.
  const [uomAktif, setUomAktif] = useState(false);
  const [fullSettings, setFullSettings] = useState(null);
  const [aturanPos, setAturanPos] = useState({
    blokirStokKosong: true,
    sembunyikanStok: false,
    sembunyikanDaftarPelanggan: false,
    disableAddCustomItem: false,
    hideSplitbill: false,
    passkey: {},
  });
  useEffect(() => {
    (async () => {
      try {
        const [bs, rules] = await Promise.all([
          apiClient.get('/business-settings/'),
          apiClient.get('/pos/sales/pos-rules/'),
        ]);
        setUomAktif(!!bs.data?.uom_multi_enabled);
        setFullSettings(bs.data);
        setAturanPos({
          blokirStokKosong: !!rules.data?.blokir_stok_kosong,
          sembunyikanStok: !!rules.data?.sembunyikan_stok,
          sembunyikanDaftarPelanggan: !!rules.data?.sembunyikan_daftar_pelanggan,
          disableAddCustomItem: !!rules.data?.disable_add_custom_item,
          hideSplitbill: !!rules.data?.hide_splitbill,
          passkey: rules.data?.passkey || {},
        });
      } catch (err) {
        console.error('Gagal memuat aturan POS:', err);
        notifyApiError(err, 'Gagal memuat aturan POS.');
      }
    })();
  }, []);

  // Muat daftar opsi penukaran poin (loyalty) sekali.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/loyalty-point-redemptions/');
        setRedemptions(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch {
        setRedemptions([]);
      }
    })();
  }, []);

  // Muat daftar karyawan (pelayan) — endpoint ringan yang terbuka untuk kasir.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/pos/sales/staff-list/');
        setStaffList(Array.isArray(res.data) ? res.data : res.data.results || []);
      } catch {
        setStaffList([]);
      }
    })();
  }, []);

  // Bila pelanggan diganti/dilepas dan tak lagi punya poin member, lepas penebusan.
  useEffect(() => {
    if (selectedRedemption && (!selectedContact || selectedContact.member_poin == null)) {
      setSelectedRedemption(null);
    }
  }, [selectedContact, selectedRedemption, setSelectedRedemption]);

  // Cari akun member (Customer) untuk modal "Tautkan Member".
  useEffect(() => {
    if (!showLinkMemberModal) return undefined;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get('/customers/', { params: memberQuery ? { search: memberQuery } : {} });
        if (!cancelled) setMemberList(res.data?.results || res.data || []);
      } catch {
        if (!cancelled) setMemberList([]);
      }
    }, memberQuery ? 300 : 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showLinkMemberModal, memberQuery]);

  // Tautkan Contact pelanggan POS ke akun member, lalu segarkan data kontak.
  const linkMember = async (member) => {
    if (!selectedContact) return;
    try {
      const res = await apiClient.patch(
        `/contacts/${encodeURIComponent(selectedContact.nomor_wa)}/`,
        { customer: member.id },
      );
      setSelectedContact(res.data);
      setShowLinkMemberModal(false);
      setMemberQuery('');
    } catch (err) {
      notifyApiError(err, 'Gagal menautkan member.');
    }
  };

  /**
   * Minta PIN PassKey untuk tindakan sensitif (diskon / pilih pelanggan).
   * Verifikasi dilakukan di server; UI hanya menampung input.
   * Mengembalikan true bila boleh lanjut.
   */
  const mintaPasskey = async (aksi) => {
    if (!aturanPos.passkey?.[aksi]) return true;
    const pin = window.prompt('Masukkan PIN PassKey untuk melanjutkan:');
    if (pin === null) return false;
    try {
      const res = await apiClient.post('/pos/sales/verify-passkey/', { aksi, pin });
      if (res.data?.ok) return true;
      alert('PIN PassKey tidak sesuai. Transaksi tidak dapat dilanjutkan.');
      return false;
    } catch (err) {
      alert(err.response?.data?.error || 'PIN PassKey tidak sesuai. Transaksi tidak dapat dilanjutkan.');
      return false;
    }
  };

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Variant Picker Modal State
  const [activeProductForVariant, setActiveProductForVariant] = useState(null);

  // Custom Item Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Create Order Modal State
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);

  // Split Bill Modal State
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);

  // Customer Select States
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [isSubmittingTrans, setIsSubmittingTrans] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  // Nota yang sedang diterbitkan SPK-nya (pesanan custom yang perlu produksi).
  const [spkUntukNota, setSpkUntukNota] = useState(null);

  const contactDropdownRef = useRef(null);

  // Fetch active coupons for POS
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        const res = await apiClient.get('/discount-coupons/');
        const list = res.data?.results || res.data || [];
        const posActive = list.filter(c => c.is_active && c.show_pos);
        setAvailableCoupons(posActive);
      } catch (err) {
        console.error('Error fetching coupons:', err);
      }
    };
    fetchCoupons();
  }, []);

  const applyCouponCode = async (codeToApply) => {
    const code = (codeToApply || couponInput).trim();
    if (!code) return;
    setEvaluatingCoupon(true);
    try {
      const res = await apiClient.post('/discount-coupons/evaluate/', {
        kode: code,
        subtotal: getSubtotal(),
        // PK Contact adalah nomor_wa (serializer tidak punya field `id`).
        pelanggan: selectedContact ? selectedContact.nomor_wa : null,
        items: cart.map(it => ({
          product_id: it.product ? it.product.id : null,
          harga: it.harga,
          qty: it.qty
        }))
      });
      if (res.data?.ok) {
        const kupon = res.data.kupon;
        // Hanya simpan `selectedCoupon` — jangan ikut mengisi `discountPercent`.
        // Diskon kupon sudah dihitung & ditampilkan sendiri lewat baris "Kupon
        // Diskon" (getCouponDiscountAmount) dan dikirim via `kupon_kode` saat
        // checkout. `discountPercent` adalah diskon MANUAL yang terpisah; kalau
        // ikut diisi dari kupon, getTotal() akan memotong diskon yang sama dua
        // kali (sekali sebagai "Diskon (%)", sekali lagi sebagai "Kupon Diskon"),
        // begitu pula di server (diskon_persen + kupon_kode dihitung terpisah).
        setSelectedCoupon(kupon);
        setMetodeDiskon('kupon');
        setCouponInput('');
        setShowCouponModal(false);
      } else {
        alert(res.data?.alasan || 'Kupon tidak dapat digunakan.');
      }
    } catch (err) {
      alert(err.response?.data?.alasan || err.response?.data?.error || 'Kode kupon tidak valid atau tidak dapat digunakan.');
    } finally {
      setEvaluatingCoupon(false);
    }
  };

  // Fetch Categories and initial Products
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await apiClient.get('/product-categories/');
        // Filter categories showing on POS
        const activeCats = (res.data || []).filter(c => c.tampil_pos);
        setCategories(activeCats);
      } catch (err) {
        console.error('Error fetching categories:', err);
        notifyApiError(err, 'Gagal memuat kategori produk.');
      }
    };
    fetchCategories();
  }, []);

  // Fetch Products based on search and category
  useEffect(() => {
    const fetchProducts = async () => {
      setLoadingProducts(true);
      try {
        const params = { is_active: true, page: 1, page_size: 1000 };
        if (selectedCategory && selectedCategory !== 'all') {
          params.kategori = selectedCategory;
        }
        if (searchTerm) {
          params.search = searchTerm;
        }
        const res = await apiClient.get('/products/', { params });
        setProducts(res.data?.results || res.data || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setProducts([]);
        notifyApiError(err, 'Gagal memuat katalog produk. Silakan coba lagi.');
      } finally {
        setLoadingProducts(false);
      }
    };

    const delayDebounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(delayDebounce);
  }, [selectedCategory, searchTerm]);

  // Fetch Contacts for Customer autocomplete
  const fetchContactsList = async (query = '') => {
    try {
      const params = { page: 1, page_size: 100, ...(query ? { search: query } : {}) };
      const res = await apiClient.get('/contacts/', { params });
      setContacts(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      setContacts([]);
      notifyApiError(err, 'Gagal memuat data pelanggan. Silakan coba lagi.');
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchContactsList(contactSearch);
    }, contactSearch ? 300 : 0);
    return () => clearTimeout(delayDebounce);
  }, [contactSearch]);

  // Close contact dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const handleProductClick = (product) => {
    if (product.has_variant && product.variants && product.variants.length > 0) {
      setActiveProductForVariant(product);
    } else {
      addToCart(product);
    }
  };

  const handleSelectVariant = (variant) => {
    if (activeProductForVariant) {
      addToCart(activeProductForVariant, variant);
      setActiveProductForVariant(null);
    }
  };

  const handlePayClick = () => {
    if (cart.length === 0) return;
    setAmountPaid(getTotal().toString());
    setShowPaymentModal(true);
  };

  const handleQuickCash = (amt) => {
    setAmountPaid(amt.toString());
  };

  const submitTransaction = async (autoPublishSpk = false) => {
    const paidVal = parseFloat(amountPaid || 0);
    const totalVal = getTotal();
    if (paidVal < totalVal) {
      alert('Jumlah pembayaran belum mencukupi total tagihan.');
      return;
    }

    setIsSubmittingTrans(true);
    try {
      const payload = {
        // PK Contact adalah nomor_wa — `id` tidak ada di serializer, sehingga
        // sebelumnya undefined dan transaksi tersimpan tanpa pelanggan.
        pelanggan: selectedContact ? selectedContact.nomor_wa : null,
        subtotal: getSubtotal(),
        diskon: getDiscountAmount(),
        diskon_persen: discountPercent,
        pajak: getTaxAmount(),
        pajak_persen: taxPercent,
        total: totalVal,
        metode_bayar: paymentMethod,
        dibayar: paidVal,
        kembalian: paidVal - totalVal,
        catatan: cartNotes,
        metode_diskon: metodeDiskon,
        kupon_kode: metodeDiskon === 'kupon' && selectedCoupon ? selectedCoupon.kode : null,
        loyalty_redemption_id: selectedRedemption ? selectedRedemption.id : null,
        dilayani_oleh_id: selectedPelayanId || null,
        status: 'paid',
        items: cart.map(item => ({
          product_id: item.product ? item.product.id : null,
          variant_id: item.variant ? item.variant.id : null,
          nama: item.nama,
          harga: item.harga,
          qty: item.qty,
          catatan: item.catatan,
          uom_kode: item.uomKode || null,
        })),
      };

      const res = await apiClient.post('/pos/sales/', payload);
      clearCart();
      setShowPaymentModal(false);
      if (autoPublishSpk) {
        setSpkUntukNota(res.data);
      } else {
        setLastReceipt(res.data);
      }
    } catch (err) {
      console.error('Error saving transaction:', err);
      alert('Gagal memproses transaksi: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmittingTrans(false);
    }
  };

  const terbitkanSpkNota = async (payload) => {
    await apiClient.post(`/pos/sales/${spkUntukNota.id}/terbitkan-spk/`, payload);
    setSpkUntukNota(null);
    alert('SPK produksi berhasil diterbitkan ke divisi yang dipilih.');
  };

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden w-full">
      {/* Kolom Kiri: Keranjang Belanja */}
      <div className="w-full lg:w-[400px] bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
        {/* Customer & Info */}
        <div className="p-4 border-b border-slate-200 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-800 text-sm">Keranjang Belanja</span>
            <button
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-xs font-bold text-rose-500 hover:text-rose-700 disabled:opacity-50 cursor-pointer"
            >
              Kosongkan
            </button>
          </div>

          {/* Customer Lookup Dropdown Search */}
          <div className="relative" ref={contactDropdownRef}>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <User size={14} className="text-slate-400" />
              {selectedContact ? (
                <div className="flex-1 flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>{selectedContact.nama} ({selectedContact.nomor_wa})</span>
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setContactSearch('');
                    }}
                    className="text-slate-400 hover:text-slate-600 text-sm"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder="Cari Pelanggan..."
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                  className="flex-1 bg-transparent text-xs font-semibold focus:outline-none"
                />
              )}
            </div>

            {/* Suggestions Dropdown — disembunyikan bila setelan
                "Sembunyikan daftar pelanggan" aktif (kasir harus ketik kode/nomor persis) */}
            {showContactDropdown && contacts.length > 0 && !aturanPos.sembunyikanDaftarPelanggan && (
              <div className="absolute inset-x-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                {contacts.map((contact) => (
                  <button
                    key={contact.nomor_wa}
                    onClick={async () => {
                      // PassKey pelanggan: minta PIN sebelum menautkan pelanggan.
                      if (!(await mintaPasskey('pelanggan'))) return;
                      setSelectedContact(contact);
                      setShowContactDropdown(false);
                    }}
                    className="w-full px-4 py-2 hover:bg-slate-50 text-left text-xs font-semibold text-slate-700 flex justify-between cursor-pointer border-b border-slate-100"
                  >
                    <span>{contact.nama}</span>
                    <span className="text-slate-400">{contact.nomor_wa}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dilayani oleh (service order) — karyawan yang melayani pelanggan */}
          <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <UserCheck size={14} className="text-slate-400 shrink-0" />
            <select
              value={selectedPelayanId}
              onChange={(e) => setSelectedPelayanId(e.target.value)}
              className="flex-1 bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              title="Karyawan yang melayani pelanggan"
            >
              <option value="">Dilayani oleh… (opsional)</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}{s.role ? ` — ${s.role}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="bg-slate-100 p-3 rounded-full text-slate-400 mb-2">
                <ShoppingBag size={24} />
              </div>
              <p className="text-xs text-slate-400 font-bold">Keranjang masih kosong</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">Pilih produk di katalog sebelah kanan untuk menambah ke keranjang belanja.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.key} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h6 className="font-extrabold text-xs text-slate-800 leading-tight truncate">
                      {item.nama}
                    </h6>
                    <span className="text-[10px] font-bold text-indigo-600 block mt-0.5">
                      {formatCurrency(item.harga)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.key)}
                    className="text-slate-300 hover:text-rose-500 transition-colors p-0.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Pemilih Satuan (UOM) — muncul bila produk punya satuan alternatif */}
                {uomAktif && item.product?.uom_enabled
                  && Array.isArray(item.product.uom_units) && item.product.uom_units.length > 0 && (
                  <select
                    value={item.uomKode || ''}
                    onChange={(e) => setCartItemUom(item.key, e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white cursor-pointer focus:outline-none"
                  >
                    <option value="">{item.product.satuan || 'pcs'} (satuan dasar)</option>
                    {item.product.uom_units.map((u) => (
                      <option key={u.id || u.kode_satuan} value={u.kode_satuan}>
                        {u.nama_satuan} — 1 = {u.konverter} {item.product.satuan || 'pcs'}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex items-center justify-between mt-1">
                  {/* Quantity Controls */}
                  <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => updateCartQty(item.key, item.qty - 1)}
                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-bold"
                    >
                      <Minus size={10} />
                    </button>
                    <span className="px-3 text-xs font-bold text-slate-800">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateCartQty(item.key, item.qty + 1)}
                      className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-550 text-xs font-bold"
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  <span className="text-xs font-black text-slate-900">
                    {formatCurrency(item.harga * item.qty)}
                  </span>
                </div>

                {/* Optional Item Note */}
                <input
                  type="text"
                  placeholder="Tambah catatan item..."
                  value={item.catatan}
                  onChange={(e) => updateCartItemNote(item.key, e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 border border-slate-100 rounded-lg text-[10px] font-semibold bg-slate-50/50 focus:bg-white focus:outline-none focus:border-indigo-300 transition-all"
                />
              </div>
            ))
          )}
        </div>

        {/* Summary and Action Buttons */}
        <div className="p-4 border-t border-slate-200 space-y-3 bg-white shrink-0">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-semibold text-slate-500">
              <span>Subtotal</span>
              <span>{formatCurrency(getSubtotal())}</span>
            </div>

            {/* Discount Section */}
            <div className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1">
                <Percent size={12} /> Diskon (%)
              </span>
              <NumericInput
                min={0}
                max={100}
                allowDecimal={true}
                formatThousand={true}
                value={discountPercent || 0}
                onChange={async (val) => {
                  const nilai = val || 0;
                  // PassKey diskon: minta PIN saat kasir mulai memberi diskon.
                  if (nilai > 0 && !discountPercent && !(await mintaPasskey('diskon'))) return;
                  setDiscountPercent(nilai);
                }}
                className="w-16 text-right px-2 py-0.5 border border-slate-200 rounded-md font-bold focus:outline-none text-slate-700"
              />
            </div>

            {/* Selector Jenis Diskon — pilihan EKSPLISIT kasir (bukan lagi
                dibandingkan otomatis di belakang layar) untuk meminimalisir
                kesalahan: kasir selalu tahu persis mekanisme mana yang aktif. */}
            <div className="py-1">
              <span className="flex items-center gap-1 font-bold text-slate-500 text-xs mb-1.5">
                <Tag size={12} className="text-indigo-600" /> Jenis Diskon
              </span>
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setMetodeDiskon('tidak_ada'); setSelectedCoupon(null); }}
                  className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    metodeDiskon === 'tidak_ada' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Tidak Ada
                </button>
                <button
                  type="button"
                  disabled={!salesDiscountPreview?.diskon}
                  onClick={() => { setMetodeDiskon('otomatis'); setSelectedCoupon(null); }}
                  title={!salesDiscountPreview?.diskon ? 'Tidak ada Diskon Penjualan yang berlaku untuk keranjang ini' : ''}
                  className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    metodeDiskon === 'otomatis' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Diskon Penjualan{salesDiscountPreview?.diskon ? ` (${formatCurrency(salesDiscountPreview.diskon)})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setMetodeDiskon('kupon')}
                  className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                    metodeDiskon === 'kupon' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Kupon Diskon
                </button>
              </div>

              {metodeDiskon === 'kupon' && (
                <div className="mt-1.5 flex items-center justify-between text-slate-500">
                  {selectedCoupon ? (
                    <div className="w-full flex items-center justify-between gap-1 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg text-[11px] font-black text-emerald-700">
                      <span>{selectedCoupon.kode} (-{formatCurrency(getCouponDiscountAmount())})</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCoupon(null)}
                        className="text-emerald-500 hover:text-emerald-800 font-bold ml-1 cursor-pointer"
                        title="Lepas kupon"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCouponModal(true)}
                      className="w-full text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-indigo-100"
                    >
                      + Pilih Kupon / Voucher
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tebus Poin (Loyalty) Section */}
            <div className="flex items-center justify-between text-slate-500 py-0.5">
              <span className="flex items-center gap-1 font-bold">
                <Sparkles size={12} className="text-amber-500" /> Tebus Poin
                {selectedContact?.member_poin != null && (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
                    {Number(selectedContact.member_poin).toLocaleString('id-ID')} poin
                  </span>
                )}
              </span>
              {!selectedContact ? (
                <span className="text-[10px] font-semibold text-slate-400">Pilih pelanggan dulu</span>
              ) : selectedContact.member_poin == null ? (
                <button
                  type="button"
                  onClick={() => setShowLinkMemberModal(true)}
                  className="text-[11px] font-extrabold text-slate-500 hover:text-amber-700 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer transition-all hover:bg-amber-50 hover:border-amber-200"
                >
                  Tautkan Member
                </button>
              ) : selectedRedemption ? (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px] font-black text-amber-700">
                  <span>{selectedRedemption.besar_point} poin (-{formatCurrency(getLoyaltyDiscountAmount())})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRedemption(null)}
                    className="text-amber-500 hover:text-amber-800 font-bold ml-1 cursor-pointer"
                    title="Lepas penebusan"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRedeemModal(true)}
                  className="text-[11px] font-extrabold text-amber-600 hover:text-amber-800 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg cursor-pointer transition-all hover:bg-amber-100"
                >
                  + Tebus Poin
                </button>
              )}
            </div>

            {/* Tax Section */}
            <div className="flex items-center justify-between text-slate-500">
              <span>Pajak (%)</span>
              <NumericInput
                min={0}
                max={100}
                allowDecimal={true}
                formatThousand={true}
                value={taxPercent || 0}
                onChange={(val) => setTaxPercent(val || 0)}
                className="w-16 text-right px-2 py-0.5 border border-slate-200 rounded-md font-bold focus:outline-none text-slate-700"
              />
            </div>

            <div className="h-px bg-slate-200 my-2" />

            <div className="flex justify-between font-black text-sm text-slate-900">
              <span>Total Belanja</span>
              <span className="text-indigo-600">{formatCurrency(getTotal())}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (window.confirm('Kosongkan keranjang? Seluruh item pada transaksi berjalan akan dihapus.')) {
                  clearCart();
                }
              }}
              disabled={cart.length === 0}
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer text-center"
            >
              Batal
            </button>
            {!aturanPos.hideSplitbill && (
              <button
                onClick={() => setIsSplitModalOpen(true)}
                disabled={cart.length === 0}
                className="flex-1 py-2.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer text-center"
              >
                Split Bill
              </button>
            )}
            <button
              onClick={handlePayClick}
              disabled={!shiftAktif || cart.length === 0}
              className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <CreditCard size={14} />
              <span>Bayar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Katalog Produk */}
      <PosCatalog
        shiftAktif={shiftAktif}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        aturanPos={aturanPos}
        setIsCreateOrderModalOpen={setIsCreateOrderModalOpen}
        setIsCustomModalOpen={setIsCustomModalOpen}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categories={categories}
        loadingProducts={loadingProducts}
        products={products}
        handleProductClick={handleProductClick}
        formatCurrency={formatCurrency}
        navigate={navigate}
      />

      {/* Modal Variant Picker */}
      {activeProductForVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col">
            <button
              onClick={() => setActiveProductForVariant(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={16} />
            </button>
            <h5 className="font-extrabold text-slate-800 text-sm mb-1">Pilih Varian</h5>
            <p className="text-xs text-slate-500 font-semibold mb-4">{activeProductForVariant.nama}</p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activeProductForVariant.variants.map((v) => {
                const isOutOfStock =
                  activeProductForVariant.lacak_inventori && v.qty_stok <= 0
                  && aturanPos.blokirStokKosong;
                return (
                  <button
                    key={v.id}
                    disabled={isOutOfStock}
                    onClick={() => handleSelectVariant(v)}
                    className="w-full flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <div>
                      <span className="font-extrabold text-slate-800 text-xs">{v.nama_varian}</span>
                      {v.sku && <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">SKU: {v.sku}</span>}
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 text-xs block">{formatCurrency(v.harga)}</span>
                      {activeProductForVariant.lacak_inventori && !aturanPos.sembunyikanStok && (
                        <span className="text-[10px] text-slate-500 font-bold">Stok: {v.qty_stok}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pembayaran */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-lg w-full p-6 relative flex flex-col shadow-2xl">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={16} />
            </button>
            <h5 className="font-extrabold text-slate-800 text-base mb-4 flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-600" />
              <span>Pembayaran</span>
            </h5>

            <div className="grid grid-cols-2 gap-4 mb-4">
              {/* Sisi Kiri: Metode & Input */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-600 block mb-1">Metode Pembayaran</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Cash', 'Transfer', 'Debit', 'QRIS'].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          paymentMethod === m
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-600 block mb-1">Jumlah Bayar (Rp.)</label>
                  <NumericInput
                    value={amountPaid}
                    onChange={(val) => setAmountPaid(val)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-right"
                  />
                </div>
              </div>

              {/* Sisi Kanan: Ringkasan & Kembalian */}
              <div className="bg-slate-50 rounded-2xl p-4 flex flex-col justify-between border border-slate-100">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>Total Belanja:</span>
                    <span>{formatCurrency(getTotal())}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-bold">
                    <span>Dibayar:</span>
                    <span>{formatCurrency(parseFloat(amountPaid || 0))}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 my-2 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 block leading-none mb-1">Kembalian</span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatCurrency(Math.max(0, parseFloat(amountPaid || 0) - getTotal()))}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick cash shortcuts */}
            <div className="mb-4">
              <span className="text-[10px] font-bold text-slate-400 block mb-1.5">Uang Pas / Pintasan Cash</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleQuickCash(getTotal())}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Uang Pas
                </button>
                {[10000, 20000, 50000, 100000].map((val) => (
                  <button
                    key={val}
                    onClick={() => handleQuickCash(val)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
                  >
                    {formatCurrency(val)}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => submitTransaction(false)}
                disabled={isSubmittingTrans || parseFloat(amountPaid || 0) < getTotal()}
                className="py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingTrans ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <CreditCard size={15} />
                    <span>Bayar (Biasa)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => submitTransaction(true)}
                disabled={isSubmittingTrans || parseFloat(amountPaid || 0) < getTotal()}
                className="py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingTrans ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Factory size={15} />
                    <span>Bayar & Terbitkan SPK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Receipt Preview / Printer Simulation */}
      {spkUntukNota && (
        <SpkPublishModal
          judul={`Terbitkan SPK — Nota ${spkUntukNota.nomor}`}
          keterangan="Seluruh item pada nota ini akan diteruskan ke papan kerja produksi sesuai divisi yang dipilih."
          onTerbitkan={terbitkanSpkNota}
          onClose={() => setSpkUntukNota(null)}
        />
      )}
      {lastReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-sm w-full p-6 relative flex flex-col shadow-2xl">
            <button
              onClick={() => setLastReceipt(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={16} />
            </button>
            
            <div className="flex flex-col items-center text-center pb-4 border-b border-dashed border-slate-200">
              <h5 className="font-extrabold text-slate-800 text-base">Bintang Advertising</h5>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Nota Penjualan Kasir</p>
              <span className="text-[9px] text-slate-400 font-semibold block mt-1">No: {lastReceipt.nomor}</span>
              <span className="text-[9px] text-slate-400 font-semibold block">{new Date(lastReceipt.created_at).toLocaleString('id-ID')}</span>
            </div>

            {/* Receipt Items */}
            <div className="py-4 space-y-2 max-h-48 overflow-y-auto text-xs font-semibold text-slate-700">
              {lastReceipt.items?.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-bold">{item.nama_snapshot}</p>
                    <span className="text-[10px] text-slate-400 font-semibold block">{item.qty} x {formatCurrency(item.harga_snapshot)}</span>
                  </div>
                  <span className="font-extrabold text-slate-900">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-3 border-t border-dashed border-slate-200 text-xs font-semibold text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(lastReceipt.subtotal)}</span>
              </div>
              {parseFloat(lastReceipt.diskon) > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Diskon</span>
                  <span>-{formatCurrency(lastReceipt.diskon)}</span>
                </div>
              )}
              {parseFloat(lastReceipt.pajak) > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span>{formatCurrency(lastReceipt.pajak)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-slate-900 pt-1">
                <span>Total</span>
                <span>{formatCurrency(lastReceipt.total)}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex justify-between text-[10px]">
                <span>Metode Pembayaran</span>
                <span className="font-bold">{lastReceipt.metode_bayar}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Dibayar</span>
                <span>{formatCurrency(lastReceipt.dibayar)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-emerald-600 font-bold">
                <span>Kembalian</span>
                <span>{formatCurrency(lastReceipt.kembalian)}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl text-center cursor-pointer"
              >
                Cetak Resi
              </button>
              <button
                onClick={() => setLastReceipt(null)}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl text-center cursor-pointer"
              >
                Tutup
              </button>
            </div>
            {/* Pesanan custom di terminal tetap perlu dikerjakan divisi
                produksi — SPK-nya diterbitkan dari nota ini. */}
            <button
              onClick={() => setSpkUntukNota(lastReceipt)}
              className="w-full mt-2 py-2 border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold text-xs rounded-xl text-center cursor-pointer"
            >
              Terbitkan SPK Produksi
            </button>
          </div>
        </div>
      )}

      {/* Modal Kupon Diskon */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col shadow-2xl">
            <button
              onClick={() => setShowCouponModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
            <h5 className="font-extrabold text-slate-800 text-base mb-1 flex items-center gap-2">
              <Tag size={18} className="text-emerald-600" />
              <span>Gunakan Kupon Diskon / Voucher</span>
            </h5>
            <p className="text-xs text-slate-500 font-semibold mb-4">Masukkan kode kupon promo atau pilih voucher yang tersedia.</p>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Ketik kode kupon (contoh: HEMAT10)..."
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCouponCode(); }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => applyCouponCode()}
                disabled={evaluatingCoupon || !couponInput.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl cursor-pointer"
              >
                {evaluatingCoupon ? 'Memeriksa...' : 'Gunakan'}
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] font-extrabold text-slate-400 block mb-2">Kupon Kasir Yang Tersedia</span>
              {availableCoupons.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">Belum ada kupon diskon aktif untuk kasir.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableCoupons.map((c) => (
                    <div
                      key={c.id}
                      className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 hover:bg-emerald-50/50 hover:border-emerald-300 transition-all flex items-center justify-between gap-3 cursor-pointer"
                      onClick={() => applyCouponCode(c.kode)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">{c.kode}</span>
                          <span className="font-extrabold text-xs text-slate-800 truncate">{c.judul}</span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-500 mt-1">
                          {c.tipe_diskon === 'percent' ? `Diskon ${c.jumlah_diskon}%` : `Potongan ${formatCurrency(c.jumlah_diskon)}`}
                          {c.min_total_pesanan > 0 && ` • Min. Belanja ${formatCurrency(c.min_total_pesanan)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-extrabold rounded-lg shadow-sm hover:bg-emerald-700 cursor-pointer shrink-0"
                      >
                        Pilih
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col shadow-2xl">
            <button
              onClick={() => setShowRedeemModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
            <h5 className="font-extrabold text-slate-800 text-base mb-1 flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" />
              <span>Tebus Poin Loyalty</span>
            </h5>
            <p className="text-xs text-slate-500 font-semibold mb-4">
              Poin tersedia:{' '}
              <span className="font-black text-amber-600">
                {Number(selectedContact?.member_poin || 0).toLocaleString('id-ID')} poin
              </span>
            </p>

            <div className="border-t border-slate-100 pt-3">
              {redemptions.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">Belum ada opsi penukaran poin.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {redemptions.map((r) => {
                    const cukup = Number(selectedContact?.member_poin || 0) >= Number(r.besar_point || 0);
                    const nilai = r.tipe_diskon === '%'
                      ? `Diskon ${r.jumlah_diskon}%${Number(r.maksimal_jumlah_diskon) > 0 ? ` (maks ${formatCurrency(r.maksimal_jumlah_diskon)})` : ''}`
                      : `Potongan ${formatCurrency(r.jumlah_diskon)}`;
                    return (
                      <div
                        key={r.id}
                        className={`border rounded-xl p-3 flex items-center justify-between gap-3 transition-all ${
                          cukup
                            ? 'border-slate-200 bg-slate-50/50 hover:bg-amber-50/50 hover:border-amber-300 cursor-pointer'
                            : 'border-slate-100 bg-slate-50/30 opacity-60'
                        }`}
                        onClick={() => {
                          if (!cukup) return;
                          setSelectedRedemption(r);
                          setShowRedeemModal(false);
                        }}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md">{r.besar_point} poin</span>
                            <span className="font-extrabold text-xs text-slate-800 truncate">{nilai}</span>
                          </div>
                          {!cukup && <p className="text-[10px] font-bold text-rose-500 mt-1">Poin tidak cukup</p>}
                        </div>
                        <button
                          type="button"
                          disabled={!cukup}
                          className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-lg shadow-sm hover:bg-amber-600 disabled:opacity-40 cursor-pointer shrink-0"
                        >
                          Tebus
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLinkMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col shadow-2xl max-h-[80vh]">
            <button
              onClick={() => setShowLinkMemberModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
            <h5 className="font-extrabold text-slate-800 text-base mb-1 flex items-center gap-2">
              <User size={18} className="text-amber-500" />
              <span>Tautkan Akun Member</span>
            </h5>
            <p className="text-xs text-slate-500 font-semibold mb-4">
              Pilih akun member untuk pelanggan{' '}
              <span className="font-black text-slate-700">{selectedContact?.nama}</span> — poin loyalty
              akan tercatat di akun ini.
            </p>

            <input
              type="text"
              placeholder="Cari nama / no. HP member..."
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 mb-3"
            />

            <div className="flex-1 overflow-y-auto min-h-0 border-t border-slate-100 pt-3">
              {memberList.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold italic text-center py-4">
                  Tidak ada member ditemukan. Buat dulu di menu Pelanggan &amp; Supplier.
                </p>
              ) : (
                <div className="space-y-2 pr-1">
                  {memberList.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => linkMember(m)}
                      className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 hover:bg-amber-50/50 hover:border-amber-300 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="font-extrabold text-xs text-slate-800 block truncate">{m.nama}</span>
                        <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          {m.handphone || 'Tanpa no. HP'} • {Number(m.loyalty_points || 0).toLocaleString('id-ID')} poin
                        </p>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-amber-500 text-white text-[10px] font-extrabold rounded-lg shadow-sm hover:bg-amber-600 cursor-pointer shrink-0"
                      >
                        Tautkan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal & Print Sub-components */}
      <CreateOrderModal
        isOpen={isCreateOrderModalOpen}
        onClose={() => setIsCreateOrderModalOpen(false)}
        onSuccess={() => { clearCart(); setIsCreateOrderModalOpen(false); }}
        initialCustomer={selectedContact}
        initialCart={cart}
      />

      <CustomItemModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onAdd={addCustomToCart}
      />

      <SplitBillModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        cart={cart}
        selectedContact={selectedContact}
        discountPercent={discountPercent}
        taxPercent={taxPercent}
        cartNotes={cartNotes}
        onSplitSuccess={removeItemsFromCart}
        settings={fullSettings}
      />

      <ReceiptPrint
        receipt={lastReceipt}
        settings={fullSettings}
      />
    </div>
  );
}
