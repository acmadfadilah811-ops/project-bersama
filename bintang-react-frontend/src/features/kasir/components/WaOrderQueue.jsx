import { useState, useEffect } from 'react';
import NumericInput from '../../../components/NumericInput';
import {
  MessageCircle,
  User,
  FileText,
  Save,
  Send,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Wallet,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { useAuth } from '../../../context/AuthContext';
import PosHeaderBar from './PosHeaderBar';
import PelunasanModal from './PelunasanModal';
import WaOrderItemProductSource from './WaOrderItemProductSource';
import WaOrderList from './WaOrderList';

export default function WaOrderQueue({ onToggleSidebar }) {
  // Kasir hanya boleh menerbitkan SPK ke antrean divisi — aturan sama dgn
  // SpkPublishModal (ditegakkan backend di api/spk.py), gate diulang di sini.
  const { user } = useAuth();
  const bolehPilihStaff = (user?.role || '').toLowerCase() !== 'kasir';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [contactData, setContactData] = useState(null);

  // Edit states for the selected order
  const [editNama, setEditNama] = useState('');
  const [editWa, setEditWa] = useState('');
  const [editDp, setEditDp] = useState(0);
  const [editDiskon, setEditDiskon] = useState(0);
  const [editMetode, setEditMetode] = useState('tunai');
  const [editCatatan, setEditCatatan] = useState('');
  const [editPelayanId, setEditPelayanId] = useState('');
  const [editItems, setEditItems] = useState([]);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  // Assignment Options for SPK
  const [staffList, setStaffList] = useState([]);
  const [pelayanList, setPelayanList] = useState([]);
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [tahapList, setTahapList] = useState([]);
  
  const [selectedAssignType, setSelectedAssignType] = useState('divisi'); // 'divisi' | 'staff'
  const [targetDivisiId, setTargetDivisiId] = useState('');
  const [targetStaffId, setTargetStaffId] = useState('');
  const [targetTahapId, setTargetTahapId] = useState('');
  const [targetDeadline, setTargetDeadline] = useState('');
  const [targetStatusGlobal, setTargetStatusGlobal] = useState('desain');

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [orderDibayar, setOrderDibayar] = useState(null);

  // Seluruh order dari WhatsApp ditampilkan; status tetap tampil agar order
  // yang sudah masuk produksi tak disangka order baru perlu SPK ulang.
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/orders/', {
        params: { sumber: 'wa' },
      });
      setOrders(res.data || []);
      if (selectedOrder) {
        // Poll tiap 15 detik ini TIDAK BOLEH menimpa form yang sedang
        // diedit kasir (nama/harga/item) — cuma sinkronkan header ringan
        // (status_global, sisa_tagihan) yang dibaca langsung dari
        // selectedOrder. Reload penuh form terjadi saat kasir klik ulang
        // kartu order di daftar kiri (lihat handleSelectOrder).
        const refreshed = (res.data || []).find(o => o.id === selectedOrder.id);
        if (refreshed) {
          setSelectedOrder(refreshed);
        } else {
          setSelectedOrder(null);
        }
      }
    } catch (err) {
      console.error('Error fetching WA orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch lists for SPK assignment
  const fetchAssignmentData = async () => {
    try {
      // /users/ tertutup untuk kasir (IsOwnerManagerOrAdmin). Tidak perlu
      // dipanggil hanya untuk menerima 403 — kasir tidak memilih staff.
      const [resPelayan, resStaff, resDivisi, resTahap] = await Promise.allSettled([
        // Endpoint khusus ini memang terbuka untuk kasir, berbeda dengan
        // /users/. Nilainya dipakai sebagai audit "Dilayani oleh", bukan PIC
        // produksi pada SPK.
        apiClient.get('/pos/sales/staff-list/'),
        bolehPilihStaff
          ? apiClient.get('/users/', { params: { role: 'staff' } })
          : Promise.resolve({ data: [] }),
        apiClient.get('/divisi/'),
        apiClient.get('/tahap-proses/'),
      ]);

      const pelayan = resPelayan.status === 'fulfilled'
        ? (Array.isArray(resPelayan.value.data) ? resPelayan.value.data : (resPelayan.value.data?.results || []))
        : [];
      const staff = resStaff.status === 'fulfilled' ? (resStaff.value.data || []) : [];
      const divisi = resDivisi.status === 'fulfilled' ? (resDivisi.value.data || []) : [];
      const tahap = resTahap.status === 'fulfilled' ? (resTahap.value.data || []) : [];

      setStaffList(staff);
      setPelayanList(pelayan);
      setDivisiList(divisi);
      setTahapList(tahap);

      if (divisi.length > 0) setTargetDivisiId(divisi[0].id);
      if (staff.length > 0) setTargetStaffId(staff[0].id);
      if (tahap.length > 0) setTargetTahapId(tahap[0].id);
    } catch (err) {
      console.error('Error fetching assignment data:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await apiClient.get('/product-packages/', { params: { page: 1, page_size: 1000 } });
      const list = res.data?.results || res.data || [];
      setPackages(list.filter((item) => item.publikasi && !item.habis_stok));
    } catch {
      setPackages([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const list = await fetchAllPages('/products/');
      setProducts(list.filter((item) => item.is_active !== false));
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchAssignmentData();
    fetchPackages();
    fetchProducts();

    const interval = setInterval(fetchQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    setEditNama(order.nama || '');
    setEditWa(order.nomor_wa || '');
    setEditDp(order.dp_dibayar || 0);
    setEditDiskon(order.diskon_persen || 0);
    setEditMetode(order.metode_pembayaran || 'tunai');
    setEditCatatan(order.catatan_pelanggan || '');
    setEditPelayanId(order.dilayani_oleh ? String(order.dilayani_oleh) : '');
    setEditItems((order.items || []).map((item) => {
      const qty = Number(item.qty) || 1;
      const hargaBaris = Number(item.harga_jual) || 0;
      // Produk/paket dari server menyimpan total baris; item custom lama
      // memakai harga per unit dari editor WA sebelumnya.
      const hargaSatuan = item.product || item.paket ? hargaBaris / qty : hargaBaris;
      return { ...item, harga_satuan: hargaSatuan };
    }));
    setDeletedItemIds([]);

    // Fetch contact details to check handover status
    try {
      const res = await apiClient.get(`/contacts/${order.nomor_wa}/`);
      setContactData(res.data);
    } catch (err) {
      console.error('Error fetching contact details:', err);
      setContactData(null);
    }
  };

  const handleToggleHandover = async () => {
    if (!contactData) return;
    const newStatus = !contactData.handover_to_staff;
    try {
      const res = await apiClient.patch(`/contacts/${contactData.nomor_wa}/`, {
        handover_to_staff: newStatus,
      });
      setContactData(res.data);
    } catch (err) {
      console.error('Error updating handover status:', err);
      alert('Status pengambilalihan percakapan gagal diperbarui. Silakan coba kembali.');
    }
  };

  const handleAddItem = () => {
    const newItem = {
      id: `new-${Date.now()}`,
      jenis_produk: '',
      panjang: 0, // kosong, bukan 1x1 — P x L sekarang jadi pengali harga kalau diisi
      lebar: 0,
      qty: 1,
      harga_jual: 0,
      harga_satuan: 0,
      paket: null,
      detail: [],
    };
    setEditItems([...editItems, newItem]);
  };

  const handleRemoveItem = (item) => {
    if (typeof item.id === 'number' || !item.id.toString().startsWith('new-')) {
      setDeletedItemIds([...deletedItemIds, item.id]);
    }
    setEditItems(editItems.filter(i => i.id !== item.id));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...editItems];
    updated[index] = { ...updated[index], [field]: value };
    setEditItems(updated);
  };

  const priceFromCatalog = (...candidates) => {
    const validPrice = candidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0);
    return validPrice ?? 0;
  };

  const handlePackageChange = (index, packageId) => {
    const selectedPackage = packages.find((item) => String(item.id) === String(packageId));
    if (!selectedPackage) {
      handleItemChange(index, 'paket', null);
      return;
    }
    const updated = [...editItems];
    updated[index] = {
      ...updated[index],
      paket: selectedPackage.id,
      product: null,
      variant: null,
      jenis_produk: selectedPackage.nama,
      harga_satuan: priceFromCatalog(
        selectedPackage.harga_jual_online,
        selectedPackage.harga_jual_offline,
      ),
      panjang: 0,
      lebar: 0,
    };
    setEditItems(updated);
  };

  // Harga dihitung server-side (sumber sama dgn bot WA); paksaPerM2 = P x L
  // selalu jadi pengali harga kalau diisi, apa pun price_type-nya.
  const fetchHargaKatalog = async (productId, { variantId, qty, panjang, lebar, paksaPerM2 } = {}) => {
    const params = new URLSearchParams();
    if (variantId) params.set('variant_id', variantId);
    params.set('qty', qty || 1);
    if (panjang) params.set('panjang', panjang);
    if (lebar) params.set('lebar', lebar);
    if (paksaPerM2) params.set('paksa_per_m2', 'true');
    const res = await apiClient.get(`/products/${productId}/hitung-harga/?${params.toString()}`);
    return res.data.harga_satuan;
  };

  const handleProductChange = async (index, productId) => {
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      setEditItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], product: null, variant: null };
        return updated;
      });
      return;
    }
    const variant = (product.variants || []).find((item) => item.pilihan_default) || product.variants?.[0];
    const isPerM2 = product.price_type === 'per_m2';
    const current = editItems[index]; // P x L lama dipertahankan (ganti produk tanpa hilang ukuran)
    const panjang = isPerM2 ? (current.panjang || 1) : (current.panjang || 0);
    const lebar = isPerM2 ? (current.lebar || 1) : (current.lebar || 0);
    const paksaPerM2 = !isPerM2 && panjang > 0 && lebar > 0;
    const qty = current.qty || 1;

    let hargaSatuan = 0;
    try {
      hargaSatuan = await fetchHargaKatalog(product.id, { variantId: variant?.id, qty, panjang, lebar, paksaPerM2 });
    } catch (err) {
      console.error('[WaOrderQueue] Gagal hitung harga produk:', err);
    }

    setEditItems((prev) => {
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
    const current = editItems[index];
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
      console.error('[WaOrderQueue] Gagal hitung harga varian:', err);
    }

    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        variant: variant.id,
        jenis_produk: `${product.nama} - ${variant.nama_varian}`,
        harga_satuan: hargaSatuan,
      };
      return updated;
    });
  };

  // onBlur P x L / Qty — hitung ulang harga, apa pun price_type produknya.
  const recalculateHargaKatalog = async (index) => {
    const current = editItems[index];
    if (!current?.product) return;
    const product = products.find((item) => String(item.id) === String(current.product));
    if (!product) return;
    const paksaPerM2 = product.price_type !== 'per_m2' && current.panjang > 0 && current.lebar > 0;
    if (product.price_type === 'flat' && !paksaPerM2) return; // tarif tetap, tak perlu ke server

    try {
      const hargaSatuan = await fetchHargaKatalog(product.id, {
        variantId: current.variant, qty: current.qty, panjang: current.panjang, lebar: current.lebar, paksaPerM2,
      });
      setEditItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], harga_satuan: hargaSatuan };
        return updated;
      });
    } catch (err) {
      // Per_m2/paksa tanpa ukuran valid, dsb — biarkan kasir isi manual, jangan timpa diam-diam.
      console.error('[WaOrderQueue] Gagal hitung ulang harga:', err);
    }
  };

  const getSubtotal = () => {
    return editItems.reduce((sum, item) => sum + (parseFloat(item.harga_satuan || 0) * parseFloat(item.qty || 1)), 0);
  };

  const getTotal = () => {
    const sub = getSubtotal();
    const disc = sub * (parseFloat(editDiskon || 0) / 100);
    return Math.max(0, sub - disc);
  };

  const getSisaTagihan = () => {
    return Math.max(0, getTotal() - parseFloat(editDp || 0));
  };

  const handleSaveOrderChanges = async ({ notify = true } = {}) => {
    if (!selectedOrder) return false;
    setSaving(true);
    try {
      // 1. Update Order Header
      await apiClient.patch(`/orders/${selectedOrder.id}/`, {
        nama: editNama,
        nomor_wa: editWa,
        dp_dibayar: editDp,
        diskon_persen: editDiskon,
        metode_pembayaran: editMetode,
        catatan_pelanggan: editCatatan,
        dilayani_oleh: editPelayanId || null,
      });

      // 2. Delete Items
      for (const id of deletedItemIds) {
        await apiClient.delete(`/order-items/${id}/`);
      }

      // 3. Create or Update Items
      for (const item of editItems) {
        const payload = {
          jenis_produk: item.jenis_produk,
          product: item.product || null,
          variant: item.variant || null,
          paket: item.paket || null,
          panjang: parseFloat(item.panjang || 0),
          lebar: parseFloat(item.lebar || 0),
          qty: parseInt(item.qty || 1),
          harga_jual: Math.round((Number(item.harga_satuan) || 0) * (Number(item.qty) || 1)),
        };
        if (item.id.toString().startsWith('new-')) {
          await apiClient.post('/order-items/', {
            ...payload,
            order: selectedOrder.id,
          });
        } else {
          await apiClient.patch(`/order-items/${item.id}/`, payload);
        }
      }

      if (notify) alert('Nota pesanan berhasil diverifikasi dan disimpan.');
      // Reload order list and update detail screen
      await fetchQueue();
      return true;
    } catch (err) {
      console.error('Error saving order changes:', err);
      if (notify) alert('Gagal menyimpan perubahan pesanan.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvoiceWhatsApp = async () => {
    if (!selectedOrder) return;
    const saved = await handleSaveOrderChanges({ notify: false });
    if (!saved) {
      alert('Invoice belum dikirim karena nota gagal disimpan.');
      return;
    }

    setSendingInvoice(true);
    try {
      const { data } = await apiClient.post(`/orders/${selectedOrder.id}/invoice-whatsapp/`);
      alert(`Invoice pesanan terkirim ke WhatsApp ${data.number}.`);
    } catch (err) {
      const detail = err?.response?.data?.reason;
      alert(detail === 'invalid_number'
        ? 'Invoice tidak dikirim karena nomor WhatsApp pelanggan tidak valid.'
        : 'Invoice gagal dikirim ke WhatsApp. Periksa koneksi gateway lalu coba lagi.');
    } finally {
      setSendingInvoice(false);
    }
  };

  const handlePublishSPK = async () => {
    if (!selectedOrder) return;
    if (!['draft', 'review'].includes(selectedOrder.status_global)) return;
    if (!editPelayanId) {
      alert('Pilih Staff Pelayan Order terlebih dahulu agar tercatat pada laporan penjualan.');
      return;
    }
    if (!targetDeadline) {
      alert('Pilih deadline/jatuh tempo pengerjaan terlebih dahulu agar staff produksi tahu batas waktunya.');
      return;
    }
    setPublishing(true);
    try {
      // Step A: Save any pending modifications first
      await handleSaveOrderChanges();

      // Step B: Set Order status to next stage (desain / proses)
      await apiClient.patch(`/orders/${selectedOrder.id}/`, {
        status_global: targetStatusGlobal,
      });

      // Step C: Assign Job to Division/Staff & Stage (Call AssignOrderView)
      const assignPayload = {
        status_global: targetStatusGlobal,
      };

      if (bolehPilihStaff && selectedAssignType === 'staff') {
        assignPayload.staff_id = targetStaffId;
      } else {
        assignPayload.divisi_id = targetDivisiId;
      }

      if (targetTahapId) {
        assignPayload.tahap_id = targetTahapId;
      }
      assignPayload.deadline = targetDeadline;

      await apiClient.post(`/orders/${selectedOrder.id}/assign/`, assignPayload);

      alert('Pesanan telah diverifikasi dan diteruskan ke Papan Kerja Produksi.');
      setSelectedOrder(null);
      await fetchQueue();
    } catch (err) {
      console.error('Error publishing SPK:', err);
      alert(
        'Gagal mengirim ke antrean produksi: ' +
          (err.response?.data?.error ||
            err.response?.data?.detail ||
            'terjadi kesalahan pada server.')
      );
    } finally {
      setPublishing(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const handlePembayaranSelesai = () => {
    // Modal tetap terbuka agar kasir dapat melihat konfirmasi serta mencetak
    // faktur. Daftar di belakangnya tetap diperbarui untuk nominal sisa baru.
    fetchQueue();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden w-full select-none">
      {orderDibayar && (
        <PelunasanModal
          order={orderDibayar}
          onClose={() => setOrderDibayar(null)}
          onSelesai={handlePembayaranSelesai}
        />
      )}
      <PosHeaderBar onToggleSidebar={onToggleSidebar} />

      <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden w-full">
        <WaOrderList
          orders={orders}
          loading={loading}
          selectedOrder={selectedOrder}
          onSelectOrder={handleSelectOrder}
          onRefresh={fetchQueue}
        />

      {/* Kanan: Editor / Verification Panel */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 flex flex-col h-full">
        {!selectedOrder ? (
          <div className="m-auto text-center max-w-sm">
            <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col items-center">
              <div className="bg-indigo-50 p-4 rounded-full text-indigo-500 mb-3 animate-pulse">
                <FileText size={32} />
              </div>
              <h5 className="font-extrabold text-slate-700 text-sm">Pilih Pesanan untuk Diverifikasi</h5>
              <p className="text-xs text-slate-400 font-semibold mt-1">Pilih salah satu nomor pesanan dari daftar antrean sebelah kiri untuk memulai proses review detail nota & SPK produksi.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Header Detail */}
            <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[9px] bg-indigo-50 text-indigo-600 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Reviewing Order {selectedOrder.id}
                </span>
                <h4 className="font-extrabold text-slate-800 text-base mt-1 capitalize">{editNama}</h4>
                <p className="text-xs text-slate-400 font-semibold">{editWa}</p>
              </div>

              {Number(selectedOrder.sisa_tagihan || 0) > 0 && selectedOrder.status_global !== 'batal' && (
                <button
                  type="button"
                  onClick={() => setOrderDibayar(selectedOrder)}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <Wallet size={14} /> Terima Pembayaran
                </button>
              )}

              {/* Handover Chat Toggle */}
              {contactData && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <h6 className="text-xs font-extrabold text-slate-700">Ambil Alih Chat</h6>
                    <p className="text-[9px] text-slate-400 font-semibold">Tutup Bot WA sementara</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleHandover}
                    className="text-indigo-600 hover:text-indigo-800 transition-all cursor-pointer"
                  >
                    {contactData.handover_to_staff ? (
                      <ToggleRight size={32} className="text-indigo-600" />
                    ) : (
                      <ToggleLeft size={32} className="text-slate-400" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Form & Items Editor */}
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
              <h5 className="font-extrabold text-slate-800 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                <FileText size={16} className="text-indigo-600" />
                <span>Detail Nota Pelanggan</span>
              </h5>

              {/* Customer Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-600 block mb-1">Nama Pelanggan</label>
                  <input
                    type="text"
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-600 block mb-1">Nomor WhatsApp</label>
                  <input
                    type="text"
                    value={editWa}
                    onChange={(e) => setEditWa(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="text-xs font-extrabold text-slate-600 block mb-1 flex items-center gap-1">
                    <User size={13} className="text-indigo-600" /> Staff Pelayan Order <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editPelayanId}
                    onChange={(e) => setEditPelayanId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white ${!editPelayanId ? 'border-amber-300' : 'border-slate-200'}`}
                  >
                    <option value="">-- Pilih staff yang melayani --</option>
                    {pelayanList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.nama}{staff.role ? ` — ${staff.role}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    Dicatat sebagai “Dilayani Oleh” di laporan; bukan PIC SPK.
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-extrabold text-slate-600">Daftar Item Produk</label>
                  <button
                    onClick={handleAddItem}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={14} /> Add Item
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                        <th className="px-4 py-2">Nama Produk / Jenis</th>
                        <th className="px-4 py-2 w-24">P x L (m)</th>
                        <th className="px-4 py-2 w-20">Qty</th>
                        <th className="px-4 py-2 w-44 bg-indigo-100 text-indigo-700">INPUT HARGA / UNIT (Rp)</th>
                        <th className="px-4 py-2 text-right">Subtotal</th>
                        <th className="px-3 py-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-100 text-xs font-semibold text-slate-700 align-top">
                          <td className="px-4 py-3 align-top">
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
                          <td className="px-4 py-3 align-top">
                            <div className="flex items-center gap-1">
                              {/* NumericInput (bukan <input type="number"> mentah) — value={item.panjang || 0}
                                  di controlled input mentah bikin field "kembali ke 0" setiap kali dikosongkan
                                  (parseFloat('') = NaN, NaN || 0 = 0, langsung snap balik sebelum sempat ketik
                                  angka baru) sehingga field terasa tidak bisa diklik/diedit dan 0 tidak bisa
                                  dihapus. Bug ditemukan 2026-08-13. */}
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
                          <td className="px-4 py-3 align-top">
                            <input
                              type="number"
                              value={item.qty || 1}
                              onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)}
                              onBlur={() => recalculateHargaKatalog(idx)}
                              className="w-12 bg-transparent border-0 focus:outline-none p-0"
                            />
                          </td>
                          <td className="px-4 py-3 align-top bg-indigo-50/30">
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 shadow-sm transition-colors focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black text-indigo-600">Rp</span>
                              <NumericInput
                                value={item.harga_satuan || 0}
                                onChange={(val) => handleItemChange(idx, 'harga_satuan', val)}
                                placeholder="Masukkan harga"
                                aria-label={`Harga satuan ${item.jenis_produk || `item ${idx + 1}`}`}
                                readOnly={Boolean(item.product || item.paket)}
                                className="w-full min-w-[112px] bg-transparent border-0 focus:outline-none p-0 font-black text-right text-slate-800"
                              />
                              </div>
                            </div>
                            <p className="mt-1 text-[9px] font-semibold text-slate-400">
                              {item.product ? 'Harga produk katalog.' : item.paket ? 'Harga paket dari master; divalidasi ulang server.' : 'Isi harga per unit'}
                            </p>
                          </td>
                          <td className="px-4 py-3 align-top text-right font-black text-slate-900">
                            {formatCurrency(parseFloat(item.harga_satuan || 0) * parseFloat(item.qty || 1))}
                          </td>
                          <td className="px-3 py-3 align-top text-center">
                            <button
                              onClick={() => handleRemoveItem(item)}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom calculations & Billing details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                <div>
                  <label className="text-xs font-extrabold text-slate-600 block mb-1">Catatan Pesanan Pelanggan</label>
                  <textarea
                    rows="3"
                    value={editCatatan}
                    onChange={(e) => setEditCatatan(e.target.value)}
                    placeholder="Instruksi pengerjaan desain, bahan, atau finishing"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50/30"
                  />
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs font-semibold text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal Items</span>
                    <span>{formatCurrency(getSubtotal())}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Diskon Nota (%)</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editDiskon}
                      onChange={(e) => setEditDiskon(parseFloat(e.target.value) || 0)}
                      className="w-16 text-right px-2 py-0.5 border border-slate-200 rounded-md font-bold focus:outline-none text-slate-700 bg-white"
                    />
                  </div>

                  <div className="flex justify-between font-black text-slate-800">
                    <span>Total Harga</span>
                    <span className="text-slate-900">{formatCurrency(getTotal())}</span>
                  </div>

                  <div className="h-px bg-slate-200 my-2" />

                  <div className="flex items-center justify-between">
                    <span className="text-indigo-600 font-bold">DP / Uang Muka (Rp.)</span>
                    <NumericInput
                      value={editDp || 0}
                      onChange={(val) => setEditDp(val)}
                      className="w-28 text-right px-2 py-0.5 border border-slate-200 rounded-md font-bold focus:outline-none text-slate-700 bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Metode Pembayaran DP</span>
                    <select
                      value={editMetode}
                      onChange={(e) => setEditMetode(e.target.value)}
                      className="bg-white border border-slate-200 rounded-md px-2 py-0.5 font-bold text-slate-700 focus:outline-none"
                    >
                      <option value="tunai">Tunai / Cash</option>
                      <option value="transfer">Transfer</option>
                      <option value="debit">Debit</option>
                      <option value="qris">QRIS</option>
                    </select>
                  </div>

                  <div className="flex justify-between font-black text-slate-800 pt-1.5 border-t border-slate-200">
                    <span>Sisa Tagihan</span>
                    <span className="text-rose-600 font-extrabold text-sm">{formatCurrency(getSisaTagihan())}</span>
                  </div>
                </div>
              </div>

              {/* Save changes only */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveOrderChanges}
                  disabled={saving}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer border border-slate-200"
                >
                  <Save size={14} />
                  {saving ? 'Menyimpan...' : 'Simpan & Verifikasi Nota'}
                </button>
              </div>
            </div>

            {/* Publishing Area (SPK Creation) */}
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <h5 className="font-extrabold text-slate-800 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                <Send size={16} className="text-emerald-500" />
                <span>Penerbitan SPK Produksi</span>
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
                
                {/* 1. Target Status */}
                <div>
                  <label className="block text-slate-500 mb-1">Tahap Alur Awal</label>
                  <select
                    value={targetStatusGlobal}
                    onChange={(e) => setTargetStatusGlobal(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="desain">Antrean Desain (Perlu Desainer)</option>
                    <option value="proses">Langsung Cetak / Produksi</option>
                  </select>
                </div>

                {/* 2. Assignment Type Selection — kasir dikunci ke divisi */}
                {bolehPilihStaff ? (
                  <div>
                    <label className="block text-slate-500 mb-1">Penugasan SPK Ke</label>
                    <select
                      value={selectedAssignType}
                      onChange={(e) => setSelectedAssignType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                    >
                      <option value="divisi">Divisi (Global Pool)</option>
                      <option value="staff">Staff Spesifik (PIC)</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-slate-500 mb-1">Penugasan SPK Ke</label>
                    <p className="bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 font-semibold text-slate-500 leading-snug">
                      Antrean divisi. Pembagian ke staff dilakukan kepala divisi.
                    </p>
                  </div>
                )}

                {/* 3. Division or Staff dropdown */}
                <div>
                  {bolehPilihStaff && selectedAssignType === 'staff' ? (
                    <>
                      <label className="block text-slate-500 mb-1">Pilih Staff PIC</label>
                      <select
                        value={targetStaffId}
                        onChange={(e) => setTargetStaffId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="">-- Tanpa PIC Staff --</option>
                        {staffList.map(s => (
                          <option key={s.id} value={s.id}>{s.username} ({s.divisi_nama || 'No Divisi'})</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <label className="block text-slate-500 mb-1">Pilih Divisi Penerima</label>
                      <select
                        value={targetDivisiId}
                        onChange={(e) => setTargetDivisiId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="">-- Tanpa Divisi --</option>
                        {divisiList.map(d => (
                          <option key={d.id} value={d.id}>{d.nama}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </div>

              {/* Stage processes dropdown + deadline */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-600">
                <div>
                  <label className="block text-slate-500 mb-1">Detail Tahap Proses</label>
                  <select
                    value={targetTahapId}
                    onChange={(e) => setTargetTahapId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="">-- Pilih Tahap Proses --</option>
                    {tahapList
                      .filter(t => !targetDivisiId || t.divisi == targetDivisiId)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.nama}</option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">
                    Deadline / Jatuh Tempo <span className="text-rose-500">(wajib)</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={targetDeadline}
                    onChange={(e) => setTargetDeadline(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* Publish Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePublishSPK}
                  disabled={publishing || editItems.length === 0 || !targetDeadline || !['draft', 'review'].includes(selectedOrder.status_global)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {publishing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>
                        {['draft', 'review'].includes(selectedOrder.status_global)
                          ? 'Verifikasi Nota & Kirim ke Antrean Produksi'
                          : 'SPK Sudah Diterbitkan'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Kirim Invoice — aksi terpisah setelah nota diverifikasi & SPK diterbitkan */}
            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-3">
              <h5 className="font-extrabold text-slate-800 text-sm pb-2 border-b border-slate-100 flex items-center gap-2">
                <MessageCircle size={16} className="text-emerald-500" />
                <span>Kirim Invoice ke Pelanggan</span>
              </h5>
              <p className="text-xs text-slate-500 font-semibold">
                Nota akan disimpan ulang otomatis sebelum invoice dikirim ke nomor WhatsApp pelanggan.
              </p>
              <button
                type="button"
                onClick={handleSendInvoiceWhatsApp}
                disabled={saving || sendingInvoice}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <MessageCircle size={16} />
                <span>{sendingInvoice ? 'Mengirim Invoice...' : 'Kirim Invoice WA'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
