import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKasir } from '../context/KasirContext';
import apiClient from '../../../api/apiClient';
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

export default function PosTerminal({ onToggleSidebar }) {
  const navigate = useNavigate();
  const { businessSettings, user } = useAuth();
  const {
    cart,
    addToCart,
    removeFromCart,
    removeItemsFromCart,
    updateCartItem,
    clearCart,
    selectedContact,
    setSelectedContact,
    selectedPelayanId,
    setSelectedPelayanId,
    discountPercent,
    setDiscountPercent,
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
  const [lastTransaction, setLastTransaction] = useState(null);
  const [checkReceipt, setCheckReceipt] = useState(null);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [targetCustomer, setTargetCustomer] = useState(null);

  // Data Contacts, Categories, Products & Staff
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [products, setProducts] = useState([]);
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
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
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
      } catch {
        setProducts([]);
      }
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [selectedCategory, searchTerm]);

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

  // Handle save / update existing item from PosItemDetailPanel (SS 4) —
  // simpan SELURUH hasil kalkulator (meteran/finishing/diskon/hargaTotal),
  // bukan cuma qty & catatan seperti sebelumnya.
  const handleSaveItemDetail = (key, updatedData) => {
    if (updatedData.qty <= 0) {
      removeFromCart(key);
    } else {
      updateCartItem(key, updatedData);
    }
    setSelectedCartItemKey(null);
    setRightPanelMode('catalog');
  };

  // Handle "+ Tambah Ke Pesanan" from PosItemDetailPanel -> saves item & returns to catalog for item #2, #3, etc.
  const handleAddMoreToOrder = (itemData) => {
    if (itemData.key) {
      handleSaveItemDetail(itemData.key, itemData);
    }
    setSelectedCartItemKey(null);
    setRightPanelMode('catalog');
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

  const handleConfirmPayment = async (paymentData) => {
    try {
      // Kontrak nyata endpoint: lihat api/pos_services.py create_sale() — field
      // dan nama harus persis cocok, DRF diam-diam membuang key yang tidak
      // dikenal (tidak error), jadi payload yang salah nama akan "sukses" tapi
      // tidak menyimpan apa pun.
      const res = await apiClient.post('/pos/sales/', {
        // Item hasil kalkulator meteran/finishing/diskon (isCustomPriced)
        // WAJIB dikirim tanpa product_id — server selalu menghitung ulang
        // harga dari Product.harga_jual_toko untuk item ber-product_id (M6),
        // jadi hasil kalkulator hanya benar-benar tertagih lewat jalur item
        // custom (lihat PosItemDetailPanel.isCustomPriced).
        items: cart.map((it) => {
          if (it.isCustomPriced) {
            const qty = Number(it.qty) || 1;
            return {
              product_id: null,
              qty,
              harga: Math.round(Number(it.hargaTotal ?? it.harga * qty) / qty),
              nama: it.nama,
              catatan: it.catatan,
            };
          }
          return {
            product_id: it.product?.id || null,
            variant_id: it.variant?.id || null,
            qty: it.qty,
            uom_kode: it.uomKode || undefined,
            harga: it.harga,
            nama: it.nama,
            catatan: it.catatan,
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
        items: [...cart],
      });

      setShowPaymentModal(false);
      setShowSuccessModal(true);
    } catch (err) {
      notifyApiError(err, 'Pembayaran gagal disimpan. Transaksi belum tercatat — periksa pesan error dan coba lagi.');
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
            onSave={handleSaveItemDetail}
            onAddMoreToOrder={handleAddMoreToOrder}
            onDelete={handleDeleteItemDetail}
            onSplitBill={() => setIsSplitModalOpen(true)}
            onClose={() => {
              setSelectedCartItemKey(null);
              setRightPanelMode('catalog');
            }}
          />
        ) : (
          <PosCatalogPanel
            products={products}
            categories={categories}
            onAddToCart={handleAddToCartFromCatalog}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
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
        contact={targetCustomer || selectedContact}
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
        discountPercent={discountPercent}
        onApplyCoupon={handleApplyCoupon}
        onApplyManualDiscount={(pct) => {
          setDiscountPercent(pct);
          setMetodeDiskon('tidak_ada');
          setSelectedCoupon(null);
        }}
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
        onConfirmPayment={handleConfirmPayment}
      />

      <PaymentSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        transactionData={lastTransaction}
        onNewOrder={handleNewOrder}
      />
      <ReceiptPrint receipt={checkReceipt} settings={businessSettings} />
    </div>
  );
}
