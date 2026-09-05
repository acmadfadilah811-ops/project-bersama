import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { notifyApiError, notifyError, notifySuccess } from '../../../utils/notify';
import { useAuth } from '../../../context/AuthContext';
import { getPrintErrorMessage, printReceiptAfterRender } from '../../printing/services/printService';

// Subcomponents for POS Kasir v2
import PosHeaderBar from '../components/PosHeaderBar';
import PosOrderPanel from '../components/PosOrderPanel';
import PosCatalogPanel from '../components/PosCatalogPanel';
import PosItemDetailPanel from '../components/PosItemDetailPanel';
import PosCustomerListPanel from '../components/PosCustomerListPanel';
import CustomerProfileModal from '../components/CustomerProfileModal';
import CustomerEditModal from '../components/CustomerEditModal';
import AddCustomerConfirmModal from '../components/AddCustomerConfirmModal';
import SplitBillModal from '../components/SplitBillModal';
import DiscountVoucherModal from '../components/DiscountVoucherModal';
import TebusPointModal from '../components/TebusPointModal';
import VoidOrderModal from '../components/VoidOrderModal';
import OrderNoteModal from '../components/OrderNoteModal';
import PosShareWaPanel from '../components/PosShareWaPanel';
import PaymentProcessModal from '../components/PaymentProcessModal';
import PaymentSuccessModal from '../components/PaymentSuccessModal';
import ReceiptPrint from '../components/ReceiptPrint';
import SpkPublishModal from '../components/SpkPublishModal';

const makeCheckoutKey = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const suffix = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.replace(/[^a-f0-9]/g, '').padEnd(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${suffix}`;
};

const itemReceiptNote = (item) => {
  const rows = [];
  if (item.tipeHitung === 'meteran') rows.push(`Ukuran ${item.panjang || 0} m × ${item.lebar || 0} m`);
  if (item.finishingJenis && item.finishingJenis !== 'Polosan') {
    rows.push(`Finishing: ${item.finishingJenis}${Number(item.finishingBiaya || 0) > 0 ? ` (Rp ${Number(item.finishingBiaya).toLocaleString('id-ID')})` : ''}`);
  }
  if (Number(item.diskon || 0) > 0) {
    rows.push(`Diskon item: ${item.diskonTipe === 'percent' ? `${item.diskon}%` : `Rp ${Number(item.diskon).toLocaleString('id-ID')}`}`);
  }
  if (item.catatan) rows.push(item.catatan);
  return rows.join(' | ');
};

const itemBeforeDiscountTotal = (item) => {
  const qty = Number(item.qty) || 1;
  const finalTotal = Math.round(Number(item.hargaTotal ?? (item.harga * qty)) || 0);
  const calculatedBeforeDiscount = Math.round(
    (Number(item.harga || 0) + Number(item.finishingBiaya || 0)) * qty,
  );
  return Math.max(finalTotal, calculatedBeforeDiscount);
};

const itemDiscountTotal = (item) => {
  const qty = Number(item.qty) || 1;
  const finalTotal = Math.round(Number(item.hargaTotal ?? (item.harga * qty)) || 0);
  return Math.max(0, itemBeforeDiscountTotal(item) - finalTotal);
};

export default function PosTerminal({ onToggleSidebar }) {
  const navigate = useNavigate();
  const { businessSettings, user } = useAuth();
  const {
    cart,
    addToCart,
    addPackageToCart,
    removeFromCart,
    removeItemsFromCart,
    upsertCartItems,
    clearCart,
    selectedContact,
    setSelectedContact,
    selectedPelayanId,
    setSelectedPelayanId,
    discountPercent,
    selectedCoupon,
    setSelectedCoupon,
    metodeDiskon,
    setMetodeDiskon,
    selectedRedemption,
    setSelectedRedemption,
    taxPercent,
    cartNotes,
    getTotal,
    getSubtotal,
    getTaxAmount,
    setCartNotes,
    salesDiscountPreview,
  } = useKasir();

  // Mode Tampilan Panel Kanan: 'catalog' | 'itemDetail' | 'customerList'
  const [rightPanelMode, setRightPanelMode] = useState('catalog');
  const [selectedCartItemKey, setSelectedCartItemKey] = useState(null);

  // Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmAddModal, setShowConfirmAddModal] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showRedeemPointModal, setShowRedeemPointModal] = useState(false);
  const [showVoidOrderModal, setShowVoidOrderModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingPayment, setPendingPayment] = useState(null);
  const [lastTransaction, setLastTransaction] = useState(null);
  const [checkReceipt, setCheckReceipt] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [targetCustomer, setTargetCustomer] = useState(null);

  // Data Contacts, Categories, Products & Staff
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [loyaltyRedemptions, setLoyaltyRedemptions] = useState([]);

  // Fetch Contacts
  const fetchContacts = async () => {
    try {
      const res = await apiClient.get('/contacts/', { params: { page: 1, page_size: 100 } });
      setContacts(res.data?.results || res.data || []);
    } catch {
      setContacts([]);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Fetch Categories
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/product-categories/');
        const activeCats = (res.data || []).filter((c) => c.tampil_pos);
        setCategories(activeCats);
      } catch (err) {
        notifyApiError(err, 'Gagal memuat kategori produk.');
      }
    })();
  }, []);

  // Fetch Real Loyalty Point Redemption Tiers from Backend (/loyalty-point-redemptions/)
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/loyalty-point-redemptions/');
        setLoyaltyRedemptions(res.data?.results || res.data || []);
      } catch {
        setLoyaltyRedemptions([]);
      }
    })();
  }, []);

  // Fetch Available Discount Coupons for POS
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/discount-coupons/');
        const list = res.data?.results || res.data || [];
        const posActive = list.filter((c) => c.is_active && c.show_pos);
        setAvailableCoupons(posActive);
      } catch (err) {
        setAvailableCoupons([]);
      }
    })();
  }, []);

  // Fetch Addons — harga tetap dihitung ulang di server (M6), ini hanya
  // untuk menampilkan pilihan & estimasi harga ke kasir.
  const [addons, setAddons] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/addons/');
        const list = res.data?.results || res.data || [];
        setAddons(list.filter((a) => a.is_active));
      } catch (err) {
        setAddons([]);
      }
    })();
  }, []);

  // Fetch Real Staff / Employee List from Backend (/pos/sales/staff-list/)
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/pos/sales/staff-list/');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setStaffList(res.data);
          if (!selectedPelayanId) {
            setSelectedPelayanId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Gagal memuat daftar karyawan asli:', err);
      }
    })();
  }, []);

  const handleApplyCoupon = async (code) => {
    if (!code) return;
    try {
      const res = await apiClient.post('/discount-coupons/evaluate/', {
        kode: code,
        subtotal: getSubtotal(),
        pelanggan: selectedContact ? selectedContact.nomor_wa : null,
        items: cart.map((it) => ({
          product_id: it.product ? it.product.id : null,
          package_id: it.paket ? it.paket.id : null,
          harga: it.harga,
          qty: it.qty,
        })),
      });
      if (res.data?.ok) {
        setSelectedCoupon(res.data.kupon);
        setMetodeDiskon('kupon');
        alert(`Voucher ${res.data.kupon.kode} berhasil digunakan.`);
      } else {
        alert(res.data?.alasan || 'Voucher diskon tidak dapat digunakan.');
      }
    } catch (err) {
      alert(err.response?.data?.alasan || err.response?.data?.error || 'Kode voucher diskon tidak valid.');
    }
  };

  // Fetch Products based on search and category
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const fetchProducts = async () => {
    const params = { is_active: true };
    if (selectedCategory && selectedCategory !== 'all') {
      params.kategori = selectedCategory;
    }
    if (searchTerm) {
      params.search = searchTerm;
    }
    const data = await fetchAllPages('/products/', { params });
    setProducts(data);
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchProducts().catch(() => setProducts([]));
    }, 300);
    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchTerm]);

  // Sync manual — kasir bisa tekan kapan saja selama layar Kasir terbuka
  // (harga/stok dari fetch pertama bisa jadi basi kalau layar dibiarkan
  // terbuka lama tanpa ganti pencarian/kategori, karena effect di atas cuma
  // jalan ulang saat searchTerm/selectedCategory berubah). Instruksi user
  // 2026-09-05: sediakan tombol sync eksplisit, plus pengingat di layar Buka
  // Shift (lihat PosShift.jsx) supaya kasir terbiasa sync sebelum melayani.
  const handleSyncCatalog = async () => {
    if (syncingCatalog) return;
    setSyncingCatalog(true);
    try {
      await fetchProducts();
      notifySuccess('Katalog disinkronkan', 'Harga & stok produk sudah diperbarui.');
    } catch (err) {
      notifyApiError(err, 'Gagal menyinkronkan katalog produk.');
    } finally {
      setSyncingCatalog(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/product-packages/', { params: { page: 1, page_size: 1000 } });
        const list = res.data?.results || res.data || [];
        setPackages(list.filter((item) => item.publikasi && item.tampil_pos && !item.habis_stok));
      } catch {
        setPackages([]);
      }
    })();
  }, []);

  // Handle adding product from catalog -> opens smart calculator detail panel
  const handleAddToCartFromCatalog = (product) => {
    // KasirContext.addToCart() menentukan sendiri key item (`${product.id}` tanpa
    // varian) — key harus dicocokkan persis, bukan dibuat terpisah di sini, supaya
    // PosItemDetailPanel (dipilih lewat selectedCartItemKey) benar-benar menemukan
    // item yang baru ditambahkan.
    const key = `${product.id}`;
    addToCart(product);
    setSelectedCartItemKey(key);
    setRightPanelMode('itemDetail');
  };

  const handleAddPackageFromCatalog = (paket) => {
    addPackageToCart(paket);
    setRightPanelMode('catalog');
  };

  // Handle selecting item from cart -> show PosItemDetailPanel (SS 4)
  const handleSelectItem = (item) => {
    if (selectedCartItemKey === item.key && rightPanelMode === 'itemDetail') {
      setSelectedCartItemKey(null);
      setRightPanelMode('catalog');
    } else {
      setSelectedCartItemKey(item.key);
      setRightPanelMode('itemDetail');
    }
  };

  // Handle save / update item(s) from PosItemDetailPanel (SS 4) — simpan
  // SELURUH hasil kalkulator (meteran/finishing/diskon/hargaTotal). Produk
  // meteran dengan beberapa ukuran berbeda (mis. Banner 2x3m + 1x1m dalam
  // satu produk) mengirim beberapa baris sekaligus — baris pertama menimpa
  // item asal (key sama), baris berikutnya jadi baris cart baru terpisah.
  const handleSaveItemDetail = (itemDataList) => {
    const list = Array.isArray(itemDataList) ? itemDataList : [itemDataList];
    const toRemove = list.filter((data) => data.qty <= 0);
    const toKeep = list.filter((data) => data.qty > 0);
    toRemove.forEach((data) => removeFromCart(data.key));
    if (toKeep.length > 0) upsertCartItems(toKeep);
    setSelectedCartItemKey(null);
    setRightPanelMode('catalog');
  };

  // Handle "+ Tambah Ke Pesanan" from PosItemDetailPanel -> saves item(s) & returns to catalog for item #2, #3, etc.
  const handleAddMoreToOrder = (itemDataList) => {
    handleSaveItemDetail(itemDataList);
  };

  // Handle delete item from PosItemDetailPanel (SS 4)
  const handleDeleteItemDetail = (key) => {
    removeFromCart(key);
    setSelectedCartItemKey(null);
    setRightPanelMode('catalog');
  };

  // Customer Actions from List Panel
  const handleCandidateCustomerSelect = (customer) => {
    setTargetCustomer(customer);
    setShowConfirmAddModal(true);
  };

  const handleConfirmAddCustomer = () => {
    if (targetCustomer) {
      setSelectedContact(targetCustomer);
    }
    setShowConfirmAddModal(false);
    setTargetCustomer(null);
    setRightPanelMode('catalog');
  };

  const handleViewCustomerProfile = (customer) => {
    setTargetCustomer(customer || selectedContact);
    setShowProfileModal(true);
  };

  const handleEditCustomerProfile = (customer) => {
    setTargetCustomer(customer || selectedContact);
    setShowEditModal(true);
  };

  const handleDeleteCustomerProfile = (customer) => {
    if (window.confirm(`Hapus/lepas pelanggan ${customer?.nama || ''}?`)) {
      if (selectedContact?.id === customer?.id || selectedContact?.nomor_wa === customer?.nomor_wa) {
        setSelectedContact(null);
      }
    }
  };

  const handleSaveEditCustomer = async (updatedData) => {
    // Contact (kontak WA/Order) hanya punya field `nama` dari form ini — email,
    // telepon, alamat, dst TIDAK ADA di model Contact (sengaja dipisah dari
    // Customer, lihat customer_models.py). Field itu hanya benar-benar
    // tersimpan kalau Contact ini tertaut ke akun member (Customer) via
    // `contact.customer`. Tanpa pengecekan ini, PATCH ke /contacts/ akan
    // sukses tapi DRF diam-diam membuang field yang tidak dikenal.
    try {
      if (!targetCustomer) {
        // Pelanggan benar-benar baru (bukan edit): nama+gender+telepon wajib
        // diisi di form supaya bisa dipakai untuk Order/DP. Buat akun Customer
        // (pembawa gender) lalu Contact (identitas nomor_wa yang dipakai
        // Order/DP) sekaligus ditautkan — sebelumnya cabang ini cuma menaruh
        // nama di state lokal tanpa pernah tersimpan ke server.
        const nomorBersih = (updatedData.telepon || '').replace(/[\s\-()]+/g, '');
        if (!/^\+?\d{8,15}$/.test(nomorBersih)) {
          alert('Nomor HP tidak valid. Gunakan format angka 8-15 digit (boleh diawali +).');
          return;
        }
        const custRes = await apiClient.post('/customers/', {
          nama: updatedData.nama,
          customer_group: updatedData.tipe_pelanggan || null,
          jenis_kelamin: updatedData.gender === 'Female' ? 'P' : 'L',
          handphone: nomorBersih,
          email: updatedData.email,
          tanggal_lahir: updatedData.tanggal_lahir || null,
          alamat: updatedData.alamat,
          negara: updatedData.negara,
          provinsi: updatedData.provinsi,
          kota: updatedData.kota,
          kecamatan: updatedData.kecamatan,
          kode_pos: updatedData.kode_pos,
          kode_pelanggan: updatedData.no_keanggotaan,
          catatan: updatedData.catatan,
        });
        const contactRes = await apiClient.post('/contacts/', {
          nomor_wa: nomorBersih,
          nama: updatedData.nama,
          customer: custRes.data.id,
        });
        setSelectedContact(contactRes.data);
        fetchContacts();
        setShowEditModal(false);
        notifySuccess('Pelanggan baru tersimpan', `${updatedData.nama} siap dipakai untuk transaksi, termasuk DP.`);
        return;
      }

      let customerId = targetCustomer?.customer || null;
      if (targetCustomer?.nomor_wa) {
        const res = await apiClient.patch(
          `/contacts/${encodeURIComponent(targetCustomer.nomor_wa)}/`,
          { nama: updatedData.nama }
        );
        if (selectedContact?.nomor_wa === targetCustomer.nomor_wa) {
          setSelectedContact(res.data);
        }
        customerId = customerId || res.data.customer;
      } else {
        setSelectedContact({ ...targetCustomer, nama: updatedData.nama });
      }

      if (customerId) {
        await apiClient.patch(`/customers/${customerId}/`, {
          customer_group: updatedData.tipe_pelanggan || null,
          email: updatedData.email,
          handphone: updatedData.telepon,
          tanggal_lahir: updatedData.tanggal_lahir || null,
          jenis_kelamin: updatedData.gender === 'Female' ? 'P' : (updatedData.gender === 'Male' ? 'L' : ''),
          alamat: updatedData.alamat,
          negara: updatedData.negara,
          provinsi: updatedData.provinsi,
          kota: updatedData.kota,
          kecamatan: updatedData.kecamatan,
          kode_pos: updatedData.kode_pos,
          kode_pelanggan: updatedData.no_keanggotaan,
          catatan: updatedData.catatan,
        });
      }

      fetchContacts();
      setShowEditModal(false);
      alert(
        customerId
          ? 'Data pelanggan berhasil disimpan.'
          : 'Nama tersimpan. Field lain (email, telepon, alamat, dst) memerlukan akun member — hubungkan pelanggan ini ke akun Customer terlebih dahulu.'
      );
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan data pelanggan.');
    }
  };

  const executeLunasPayment = async (paymentData, spkPayload) => {
    try {
      // Kontrak nyata endpoint: lihat api/pos_services.py create_sale() — field
      // dan nama harus persis cocok, DRF diam-diam membuang key yang tidak
      // dikenal (tidak error), jadi payload yang salah nama akan "sukses" tapi
      // tidak menyimpan apa pun.
      const res = await apiClient.post('/pos/sales/', {
        // Item dengan product_id (termasuk hasil kalkulator meteran/finishing)
        // SELALU dikirim dengan product_id-nya — server yang menghitung ulang
        // harganya lewat product_pricing.hitung_harga (M6), bukan dipercaya
        // dari `harga` di sini. product_id cuma null untuk item kustom murni
        // (tanpa dasar produk katalog sama sekali, lihat PosCatalog "Item Kustom").
        items: cart.map((it) => {
          if (it.paket) {
            return {
              package_id: it.paket.id,
              qty: it.qty,
              nama: it.nama,
              catatan: itemReceiptNote(it),
            };
          }
          if (!it.product?.id) {
            const qty = Number(it.qty) || 1;
            return {
              product_id: null,
              qty,
              harga: Math.round(Number(it.hargaTotal ?? it.harga * qty) / qty),
              nama: it.nama,
              catatan: itemReceiptNote(it),
            };
          }
          const isMeteran = Number(it.panjang) > 0 && Number(it.lebar) > 0;
          return {
            product_id: it.product.id,
            variant_id: it.variant?.id || null,
            qty: it.qty,
            uom_kode: it.uomKode || undefined,
            panjang: isMeteran ? it.panjang : undefined,
            lebar: isMeteran ? it.lebar : undefined,
            finishing_biaya: it.finishingBiaya || undefined,
            nama: it.nama,
            catatan: itemReceiptNote(it),
            addons: (it.addonIds || []).map((id) => ({ id, qty: it.addonQty?.[id] || 1 })),
            serial_numbers: (it.serialNumbers && it.serialNumbers.length) ? it.serialNumbers : undefined,
          };
        }),
        status: 'paid',
        diskon_persen: discountPercent,
        pajak_persen: taxPercent,
        dibayar: paymentData.payAmount,
        metode_bayar: paymentData.method,
        catatan: cartNotes,
        pelanggan: selectedContact?.nomor_wa || null,
        dilayani_oleh_id: selectedPelayanId || null,
        metode_diskon: metodeDiskon,
        kupon_kode: selectedCoupon?.kode || undefined,
        loyalty_redemption_id: selectedRedemption?.id || undefined,
        spk: spkPayload,
      });

      setLastTransaction({
        ...res.data,
        id: res.data.id,
        nomor: res.data.nomor,
        customerName: res.data.pelanggan_name || null,
        customerPhone: selectedContact?.nomor_wa || null,
        totalAmount: Number(res.data.total),
        payAmount: Number(res.data.dibayar),
        changeAmount: Number(res.data.kembalian),
        method: res.data.metode_bayar,
        items: cart.map((item) => ({
          ...item,
          nama_snapshot: item.nama,
          harga_snapshot: Math.round(Number(item.hargaTotal ?? (item.harga * item.qty)) / (Number(item.qty) || 1)),
          subtotal: Number(item.hargaTotal ?? (item.harga * item.qty)),
          catatan: itemReceiptNote(item),
        })),
      });

      setShowPaymentModal(false);
      setPendingPayment(null);
      setShowSuccessModal(true);
    } catch (err) {
      notifyApiError(err, 'Pembayaran gagal disimpan. Transaksi belum tercatat — periksa pesan error dan coba lagi.');
      throw err;
    }
  };

  const handleConfirmPayment = (paymentData) => {
    if (paymentData.paymentType === 'dp') {
      if (!selectedContact?.nama || !selectedContact?.nomor_wa) {
        notifyError('Data pelanggan diperlukan', 'Pilih pelanggan beserta nomor WhatsApp sebelum menerima DP.');
        return;
      }
      if (!selectedPelayanId) {
        notifyError('Karyawan diperlukan', 'Pilih karyawan yang melayani sebelum menerima DP.');
        return;
      }
    }
    setPendingPayment({ ...paymentData, checkoutKey: makeCheckoutKey() });
    setShowPaymentModal(false);
  };

  const handlePublishSpkAndCheckout = async (spkPayload) => {
    if (!pendingPayment) return;
    if (pendingPayment.paymentType !== 'dp') {
      return executeLunasPayment(pendingPayment, spkPayload);
    }

    const items = cart.map((item) => {
      const qty = Number(item.qty) || 1;
      const hargaSatuan = Math.round(Number(item.hargaTotal ?? (item.harga * qty)) / qty);
      const hargaSebelumDiskon = itemBeforeDiscountTotal(item);
        return {
          package_id: item.paket?.id || null,
          product_id: item.product?.id || null,
        variant_id: item.variant?.id || null,
        qty,
        harga_satuan: hargaSatuan,
        nama: item.nama,
        is_custom_priced: Boolean(item.isCustomPriced),
        addon_ids: item.addonIds || [],
        panjang: item.panjang || 0,
        lebar: item.lebar || 0,
        harga_per_m2: item.hargaPerM2 || 0,
        catatan: itemReceiptNote(item),
        detail: {
          tipe_hitung: item.tipeHitung || 'pcs',
          finishing: item.finishingJenis || 'Polosan',
          biaya_finishing: Number(item.finishingBiaya || 0),
          diskon: Number(item.diskon || 0),
          tipe_diskon: item.diskonTipe || 'percent',
          harga_sebelum_diskon: hargaSebelumDiskon,
          diskon_nominal: itemDiscountTotal(item),
          catatan: item.catatan || '',
        },
      };
    });

    try {
      const res = await apiClient.post('/orders/checkout-pos/', {
        idempotency_key: pendingPayment.checkoutKey,
        nama: selectedContact.nama,
        nomor_wa: selectedContact.nomor_wa,
        items,
        jumlah_bayar: Math.round(pendingPayment.payAmount),
        metode_pembayaran: pendingPayment.method,
        diskon_persen: discountPercent,
        metode_diskon: metodeDiskon,
        kupon_kode: selectedCoupon?.kode || undefined,
        catatan: cartNotes,
        jatuh_tempo: pendingPayment.dueDate,
        dilayani_oleh_id: selectedPelayanId,
        spk: spkPayload,
      });
      const order = res.data;
      setLastTransaction({
        ...order,
        isOrderReceipt: true,
        nomor: order.id,
        created_at: order.waktu,
        pelanggan_name: order.nama,
        customerName: order.nama,
        customerPhone: order.nomor_wa,
        total: Number(order.total_harga),
        totalAmount: Number(order.total_harga),
        subtotal: Number(order.items?.reduce((sum, item) => sum + Number(item.harga_jual || 0), 0) || 0),
        dibayar: Number(order.dp_dibayar),
        payAmount: Number(order.dp_dibayar),
        kembalian: 0,
        changeAmount: 0,
        metode_bayar: order.metode_pembayaran,
        method: order.metode_pembayaran,
        sisa_tagihan: Number(order.sisa_tagihan),
        catatan: order.catatan_pelanggan || cartNotes,
        items: cart.map((item) => ({
          ...item,
          nama_snapshot: item.nama,
          harga_snapshot: Math.round(Number(item.hargaTotal ?? (item.harga * item.qty)) / (Number(item.qty) || 1)),
          subtotal: Number(item.hargaTotal ?? (item.harga * item.qty)),
          catatan: itemReceiptNote(item),
        })),
      });
      setPendingPayment(null);
      setShowSuccessModal(true);
    } catch (err) {
      notifyApiError(err, 'Pembayaran atau penerbitan SPK gagal. Transaksi tidak disimpan â€” periksa pesan error dan coba lagi.');
      throw err;
    }
  };

  const handleNewOrder = () => {
    clearCart();
    setCartNotes('');
    setShowSuccessModal(false);
    setRightPanelMode('catalog');
  };

  const selectedStaffObj = staffList.find((s) => String(s.id) === String(selectedPelayanId));
  const selectedCartItem = cart.find((i) => i.key === selectedCartItemKey);

  const handlePrintCheck = async () => {
    if (cart.length === 0) return;

    const subtotal = Number(getSubtotal());
    const pajak = Number(getTaxAmount());
    const total = Number(getTotal());
    const receipt = {
      nomor: 'CEK-PESANAN',
      documentTitle: 'CEK PESANAN',
      isDraft: true,
      created_at: new Date().toISOString(),
      pelanggan_name: selectedContact?.nama || selectedContact?.name || 'Pelanggan umum',
      kasir_name: selectedStaffObj?.nama || user?.username || 'Kasir POS',
      catatan: cartNotes || '',
      items: cart.map((item) => {
        const qty = Number(item.qty || 0);
        const harga = Number(item.harga_snapshot ?? item.harga ?? 0);
        return {
          ...item,
          nama_snapshot: item.nama_snapshot || item.nama || item.product?.nama || 'Item',
          uom_kode: item.uom_kode || item.uomKode || 'pcs',
          harga_snapshot: harga,
          subtotal: Number(item.subtotal ?? item.hargaTotal ?? (harga * qty)),
        };
      }),
      subtotal,
      diskon: Math.max(0, subtotal + pajak - total),
      pajak,
      total,
      dibayar: 0,
      kembalian: 0,
    };

    setCheckReceipt(receipt);
    try {
      const result = await printReceiptAfterRender({ receipt, businessSettings });
      if (result.channel === 'qz') {
        notifySuccess('Cek pesanan dikirim', 'Cek pesanan telah dikirim ke antrean printer QZ Tray.');
      }
    } catch (error) {
      notifyError('Cetak cek pesanan gagal', getPrintErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-900 font-sans">
      {/* Top Header Bar SS 1 */}
      <PosHeaderBar
        selectedCustomer={selectedContact}
        onViewCustomer={() => handleViewCustomerProfile(selectedContact)}
        onEditCustomer={() => handleEditCustomerProfile(selectedContact)}
        onDeleteCustomer={() => setSelectedContact(null)}
        onToggleSidebar={onToggleSidebar}
      />

      {/* Main Split Layout: Left Order Panel & Right View Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden bg-white">
        {/* Left Panel: Order Panel */}
        <PosOrderPanel
          cart={cart}
          selectedCustomer={selectedContact}
          selectedStaffName={selectedStaffObj?.nama || '-'}
          staffList={staffList}
          selectedPelayanId={selectedPelayanId}
          onSelectStaff={(staff) => setSelectedPelayanId(staff.id || staff)}
          totalAmount={getTotal()}
          onOpenCustomerList={() => setRightPanelMode('customerList')}
          onOpenCustomerSelect={() => setRightPanelMode('customerList')}
          onAddNewCustomerClick={() => {
            setTargetCustomer(null);
            setShowEditModal(true);
          }}
          onSelectItem={handleSelectItem}
          selectedCartItemKey={selectedCartItemKey}
          onPayClick={() => {
            if (cart.length === 0) return;
            setShowPaymentModal(true);
          }}
          onVoidClick={() => {
            if (cart.length === 0) return;
            setShowVoidOrderModal(true);
          }}
          onRedeemPointClick={() => {
            setShowRedeemPointModal(true);
          }}
          onAddNoteClick={() => {
            setShowNoteModal(true);
          }}
          onDiscountClick={() => {
            setShowDiscountModal(true);
          }}
          onShareWaClick={() => {
            setRightPanelMode('shareWa');
          }}
          onPrintCheckClick={handlePrintCheck}
        />

        {/* Right Panel View Switcher: Catalog | Item Detail | Customer List | Share WA */}
        {rightPanelMode === 'shareWa' ? (
          <PosShareWaPanel
            cart={cart}
            selectedCustomer={selectedContact}
            totalAmount={getTotal()}
            contacts={contacts}
            onClose={() => setRightPanelMode('catalog')}
          />
        ) : rightPanelMode === 'customerList' ? (
          <PosCustomerListPanel
            contacts={contacts}
            onSelectCustomer={handleCandidateCustomerSelect}
            onViewCustomerProfile={handleViewCustomerProfile}
            onEditCustomerProfile={handleEditCustomerProfile}
            onDeleteCustomerProfile={handleDeleteCustomerProfile}
            onAddNewCustomer={() => {
              setTargetCustomer(null);
              setShowEditModal(true);
            }}
            onClose={() => setRightPanelMode('catalog')}
          />
        ) : rightPanelMode === 'itemDetail' && selectedCartItem ? (
          <PosItemDetailPanel
            item={selectedCartItem}
            addons={addons}
            onSave={handleSaveItemDetail}
            onAddMoreToOrder={handleAddMoreToOrder}
            onDelete={handleDeleteItemDetail}
            onSplitBill={() => setIsSplitModalOpen(true)}
            onDiscountClick={() => setShowDiscountModal(true)}
            onClose={() => {
              setSelectedCartItemKey(null);
              setRightPanelMode('catalog');
            }}
          />
        ) : (
          <PosCatalogPanel
            products={products}
            packages={packages}
            categories={categories}
            onAddToCart={handleAddToCartFromCatalog}
            onAddPackage={handleAddPackageFromCatalog}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            onSync={handleSyncCatalog}
            syncing={syncingCatalog}
          />
        )}
      </div>

      {/* Modals */}
      <CustomerProfileModal
        isOpen={showProfileModal}
        contact={targetCustomer || selectedContact}
        onClose={() => setShowProfileModal(false)}
      />

      <CustomerEditModal
        isOpen={showEditModal}
        contact={targetCustomer}
        contacts={contacts}
        onSave={handleSaveEditCustomer}
        onClose={() => setShowEditModal(false)}
      />

      <AddCustomerConfirmModal
        isOpen={showConfirmAddModal}
        customerName={targetCustomer?.nama || 'Customer'}
        onConfirm={handleConfirmAddCustomer}
        onCancel={() => {
          setShowConfirmAddModal(false);
          setTargetCustomer(null);
        }}
      />

      <SplitBillModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        cart={cart}
        selectedContact={selectedContact}
        discountPercent={discountPercent}
        taxPercent={taxPercent}
        cartNotes={cartNotes}
        selectedCoupon={selectedCoupon}
        metodeDiskon={metodeDiskon}
        selectedRedemption={selectedRedemption}
        selectedPelayanId={selectedPelayanId}
        onSplitSuccess={(itemsToRemove) => {
          removeItemsFromCart(itemsToRemove);
          setIsSplitModalOpen(false);
        }}
      />

      <DiscountVoucherModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        availableCoupons={availableCoupons}
        selectedCoupon={selectedCoupon}
        onApplyCoupon={handleApplyCoupon}
        onRemoveCoupon={() => {
          setSelectedCoupon(null);
          setMetodeDiskon('tidak_ada');
        }}
        salesDiscountPreview={salesDiscountPreview}
        isAutoDiscountActive={metodeDiskon === 'otomatis'}
        onApplyAutoDiscount={() => setMetodeDiskon('otomatis')}
        onRemoveAutoDiscount={() => setMetodeDiskon('tidak_ada')}
      />

      <TebusPointModal
        isOpen={showRedeemPointModal}
        onClose={() => setShowRedeemPointModal(false)}
        selectedContact={selectedContact}
        redemptionOptions={loyaltyRedemptions}
        selectedRedemption={selectedRedemption}
        onConfirmRedeem={(rule) => {
          setSelectedRedemption(rule);
        }}
      />

      <VoidOrderModal
        isOpen={showVoidOrderModal}
        onClose={() => setShowVoidOrderModal(false)}
        onConfirmVoid={(alasan) => {
          clearCart();
          alert(`Pesanan berhasil di-void/dibatalkan. Alasan: ${alasan}`);
        }}
      />

      <OrderNoteModal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        initialNote={cartNotes}
        onSaveNote={(noteText) => {
          setCartNotes(noteText);
        }}
      />

      <PaymentProcessModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        totalAmount={getTotal()}
        subtotalAmount={Number(getSubtotal()) + cart.reduce((sum, item) => sum + itemDiscountTotal(item), 0)}
        discountAmount={cart.reduce((sum, item) => sum + itemDiscountTotal(item), 0) + Math.max(0, Number(getSubtotal()) + Number(getTaxAmount()) - Number(getTotal()))}
        onConfirmPayment={handleConfirmPayment}
      />

      {pendingPayment && (
        <SpkPublishModal
          judul="Tujuan SPK Produksi"
          keterangan={pendingPayment.paymentType === 'dp'
            ? 'DP akan dicatat dan SPK langsung masuk ke antrean global divisi yang dipilih.'
            : 'Pembayaran lunas dan SPK akan disimpan bersamaan ke antrean global divisi yang dipilih.'}
          onClose={() => {
            setPendingPayment(null);
            setShowPaymentModal(true);
          }}
          onTerbitkan={handlePublishSpkAndCheckout}
        />
      )}

      <PaymentSuccessModal
        isOpen={showSuccessModal}
        // Tombol "X" (onClose) dulu cuma menutup popup tanpa reset
        // keranjang/pelanggan/diskon — beda dari tombol "+ Baru" (onNewOrder)
        // yang sudah benar. Akibatnya kalau kasir tutup popup pakai "X",
        // terminal tetap menampilkan sisa transaksi yang baru selesai,
        // bukan kembali default (bug ditemukan 2026-08-13). Disamakan:
        // keduanya sekarang reset penuh lewat handleNewOrder.
        onClose={handleNewOrder}
        transactionData={lastTransaction}
        onNewOrder={handleNewOrder}
      />
      <ReceiptPrint receipt={checkReceipt} settings={businessSettings} />
    </div>
  );
}
