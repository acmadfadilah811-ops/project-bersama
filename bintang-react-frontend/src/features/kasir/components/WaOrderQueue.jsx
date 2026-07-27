import { useState, useEffect } from 'react';
import NumericInput from '../../../components/NumericInput';
import {
  MessageCircle,
  Clock,
  User,
  Phone,
  FileText,
  Save,
  Send,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

export default function WaOrderQueue() {
  // Kasir hanya boleh menerbitkan SPK ke antrean divisi — aturan yang sama
  // dengan SpkPublishModal, ditegakkan backend di api/spk.py. Layar ini punya
  // pemilih penugasan sendiri, jadi gatenya harus ikut dipasang di sini.
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
  const [editItems, setEditItems] = useState([]);
  const [deletedItemIds, setDeletedItemIds] = useState([]);

  // Assignment Options for SPK
  const [staffList, setStaffList] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [tahapList, setTahapList] = useState([]);
  
  const [selectedAssignType, setSelectedAssignType] = useState('divisi'); // 'divisi' | 'staff'
  const [targetDivisiId, setTargetDivisiId] = useState('');
  const [targetStaffId, setTargetStaffId] = useState('');
  const [targetTahapId, setTargetTahapId] = useState('');
  const [targetStatusGlobal, setTargetStatusGlobal] = useState('desain');

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Fetch queue
  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/orders/', {
        params: { status_global: 'review', sumber: 'wa' },
      });
      setOrders(res.data || []);
      if (selectedOrder) {
        // Refresh selected order details if open
        const refreshed = (res.data || []).find(o => o.id === selectedOrder.id);
        if (refreshed) {
          handleSelectOrder(refreshed);
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
      const [resStaff, resDivisi, resTahap] = await Promise.allSettled([
        bolehPilihStaff
          ? apiClient.get('/users/', { params: { role: 'staff' } })
          : Promise.resolve({ data: [] }),
        apiClient.get('/divisi/'),
        apiClient.get('/tahap-proses/'),
      ]);

      const staff = resStaff.status === 'fulfilled' ? (resStaff.value.data || []) : [];
      const divisi = resDivisi.status === 'fulfilled' ? (resDivisi.value.data || []) : [];
      const tahap = resTahap.status === 'fulfilled' ? (resTahap.value.data || []) : [];

      setStaffList(staff);
      setDivisiList(divisi);
      setTahapList(tahap);

      if (divisi.length > 0) setTargetDivisiId(divisi[0].id);
      if (staff.length > 0) setTargetStaffId(staff[0].id);
      if (tahap.length > 0) setTargetTahapId(tahap[0].id);
    } catch (err) {
      console.error('Error fetching assignment data:', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    fetchAssignmentData();
  }, []);

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    setEditNama(order.nama || '');
    setEditWa(order.nomor_wa || '');
    setEditDp(order.dp_dibayar || 0);
    setEditDiskon(order.diskon_persen || 0);
    setEditMetode(order.metode_pembayaran || 'tunai');
    setEditCatatan(order.catatan_pelanggan || '');
    setEditItems(order.items ? [...order.items] : []);
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
      panjang: 1,
      lebar: 1,
      qty: 1,
      harga_jual: 0,
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

  const getSubtotal = () => {
    return editItems.reduce((sum, item) => sum + (parseFloat(item.harga_jual || 0) * parseFloat(item.qty || 1)), 0);
  };

  const getTotal = () => {
    const sub = getSubtotal();
    const disc = sub * (parseFloat(editDiskon || 0) / 100);
    return Math.max(0, sub - disc);
  };

  const getSisaTagihan = () => {
    return Math.max(0, getTotal() - parseFloat(editDp || 0));
  };

  const handleSaveOrderChanges = async () => {
    if (!selectedOrder) return;
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
      });

      // 2. Delete Items
      for (const id of deletedItemIds) {
        await apiClient.delete(`/order-items/${id}/`);
      }

      // 3. Create or Update Items
      for (const item of editItems) {
        const payload = {
          jenis_produk: item.jenis_produk,
          panjang: parseFloat(item.panjang || 0),
          lebar: parseFloat(item.lebar || 0),
          qty: parseInt(item.qty || 1),
          harga_jual: parseInt(item.harga_jual || 0),
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

      alert('Perubahan pesanan berhasil disimpan.');
      // Reload order list and update detail screen
      await fetchQueue();
    } catch (err) {
      console.error('Error saving order changes:', err);
      alert('Gagal menyimpan perubahan pesanan.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishSPK = async () => {
    if (!selectedOrder) return;
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

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden w-full">
      {/* Kiri: Antrean Order List */}
      <div className="w-full lg:w-[380px] border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
              <MessageCircle size={18} />
            </div>
            <div>
              <h5 className="font-extrabold text-slate-800 text-sm">Antrean Pesanan WA</h5>
              <p className="text-[10px] text-slate-500 font-semibold">Tinjau & verifikasi chat masuk</p>
            </div>
          </div>
          <button
            onClick={fetchQueue}
            className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {/* List of cards */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : orders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
              <div className="bg-white p-3 rounded-full text-slate-400 mb-2">
                <CheckCircle size={24} />
              </div>
              <p className="text-xs text-slate-500 font-bold">Semua Pesanan Bersih!</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">Tidak ada order masuk dari WhatsApp bot yang memerlukan review kasir saat ini.</p>
            </div>
          ) : (
            orders.map((order) => {
              const itemsText = order.items?.map(i => `${i.jenis_produk} (x${i.qty})`).join(', ') || 'Tanpa detail item';
              const isSelected = selectedOrder?.id === order.id;
              return (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`w-full p-3 text-left border rounded-xl transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/10'
                      : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="font-extrabold text-slate-800 text-xs truncate max-w-[200px]">{order.nama}</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                      {order.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                    <Phone size={10} />
                    <span>{order.nomor_wa}</span>
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium line-clamp-1 italic">
                    "{itemsText}"
                  </p>

                  <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100 w-full text-[10px] font-bold">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(order.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-indigo-600">
                      {formatCurrency(order.total_harga || 0)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                        <th className="px-4 py-2">Nama Produk / Jenis</th>
                        <th className="px-4 py-2 w-24">P x L (m)</th>
                        <th className="px-4 py-2 w-20">Qty</th>
                        <th className="px-4 py-2 w-32">Harga Satuan</th>
                        <th className="px-4 py-2 text-right">Subtotal</th>
                        <th className="px-3 py-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-100 text-xs font-semibold text-slate-700">
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={item.jenis_produk}
                              placeholder="Nama bahan / produk..."
                              onChange={(e) => handleItemChange(idx, 'jenis_produk', e.target.value)}
                              className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-xs font-bold text-slate-800"
                            />
                          </td>
                          <td className="px-4 py-2 flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={item.panjang || 0}
                              onChange={(e) => handleItemChange(idx, 'panjang', parseFloat(e.target.value) || 0)}
                              className="w-10 bg-transparent border-0 focus:outline-none text-center p-0"
                            />
                            <span>×</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.lebar || 0}
                              onChange={(e) => handleItemChange(idx, 'lebar', parseFloat(e.target.value) || 0)}
                              className="w-10 bg-transparent border-0 focus:outline-none text-center p-0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={item.qty || 1}
                              onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)}
                              className="w-12 bg-transparent border-0 focus:outline-none p-0"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <NumericInput
                              value={item.harga_jual || 0}
                              onChange={(val) => handleItemChange(idx, 'harga_jual', val)}
                              className="w-24 bg-transparent border-0 focus:outline-none p-0 font-bold text-right"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-black text-slate-900">
                            {formatCurrency(parseFloat(item.harga_jual || 0) * parseFloat(item.qty || 1))}
                          </td>
                          <td className="px-3 py-2 text-center">
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
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveOrderChanges}
                  disabled={saving}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer border border-slate-200"
                >
                  <Save size={14} />
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan Nota'}
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

              {/* Stage processes dropdown */}
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
              </div>

              {/* Publish Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePublishSPK}
                  disabled={publishing || editItems.length === 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {publishing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Verifikasi Nota & Kirim ke Antrean Produksi</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
