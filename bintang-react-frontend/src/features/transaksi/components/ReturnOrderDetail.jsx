import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronDown, Check, Mail, Phone, MessageSquare, Printer, Calendar } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useTransaksiCrumb } from './TransaksiContext';
import { formatOrderReference } from './orderReference';
import TambahPengembalianPesananModal from './return_order/TambahPengembalianPesananModal';
import PengaturanTambahanModal from './return_order/PengaturanTambahanModal';
import ReturnOrderItemsTable from './return_order/ReturnOrderItemsTable';

export default function ReturnOrderDetail({ orderId, onBack, onSaved }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setSubtitle('Detail Pengembalian');
    return () => setSubtitle('');
  }, [setSubtitle]);

  // Return data states
  const [returnDate, setReturnDate] = useState('');
  const [returnStatus, setReturnStatus] = useState('Tunda');
  const [returnCatatan, setReturnCatatan] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [returnItems, setReturnItems] = useState([]);
  const [tambahan, setTambahan] = useState({ deskripsi: '', jumlah: 0 });

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTambahanModalOpen, setIsTambahanModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Card & Header dropdowns
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pengembalianDbId, setPengembalianDbId] = useState(null);

  const fetchOrderDetail = useCallback(async () => {
    try {
      const res = await apiClient.get(`/orders/${orderId}/`);
      const data = res.data;
      setOrder(data);

      if (data.pengembalian_aktif) {
        setPengembalianDbId(data.pengembalian_aktif.id);
        setReturnDate(data.pengembalian_aktif.tanggal_pengembalian || '');
        setReturnStatus(data.pengembalian_aktif.status || 'Tunda');
        setReturnCatatan(data.pengembalian_aktif.catatan || '');
        if (data.pengembalian_aktif.items_json) {
          try {
            setReturnItems(JSON.parse(data.pengembalian_aktif.items_json));
          } catch {
            setReturnItems([]);
          }
        }
        if (data.pengembalian_aktif.tambahan_json) {
          try {
            setTambahan(JSON.parse(data.pengembalian_aktif.tambahan_json));
          } catch {
            setTambahan({ deskripsi: '', jumlah: 0 });
          }
        }
      } else {
        // Parse from catatan_pelanggan if legacy
        if (data.catatan_pelanggan && data.catatan_pelanggan.includes('[PENGEMBALIAN_ITEMS:')) {
          const match = data.catatan_pelanggan.match(/\[PENGEMBALIAN_ITEMS:(.*?)\]/);
          if (match) {
            try {
              setReturnItems(JSON.parse(match[1]));
            } catch {
              setReturnItems([]);
            }
          }
        }
      }

      if (data.email_pelanggan) {
        setCustomerEmail(data.email_pelanggan);
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memuat detail pengembalian.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handleSaveReturnData = async (newItems, newTambahan, newStatus, newCatatan, newDate) => {
    const itemsToSave = newItems !== undefined ? newItems : returnItems;
    const tambahanToSave = newTambahan !== undefined ? newTambahan : tambahan;
    const statusToSave = newStatus !== undefined ? newStatus : returnStatus;
    const catatanToSave = newCatatan !== undefined ? newCatatan : returnCatatan;
    const dateToSave = newDate !== undefined ? newDate : returnDate;

    try {
      if (pengembalianDbId) {
        await apiClient.patch(`/pengembalian/${pengembalianDbId}/`, {
          status: statusToSave,
          catatan: catatanToSave,
          tanggal_pengembalian: dateToSave,
          items_json: JSON.stringify(itemsToSave),
          tambahan_json: JSON.stringify(tambahanToSave),
        });
      } else {
        // Call retur endpoint or patch order
        await apiClient.post(`/orders/${orderId}/retur/`, {
          catatan: catatanToSave,
          tanggal_pengembalian: dateToSave,
          items_json: JSON.stringify(itemsToSave),
          tambahan_json: JSON.stringify(tambahanToSave),
        });
      }
      await fetchOrderDetail();
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Gagal menyimpan pengembalian pesanan.');
    }
  };

  const handleSaveAddModal = async ({ items }) => {
    let updatedItems = [...returnItems];
    items.forEach((newItem) => {
      const existingIdx = updatedItems.findIndex((it) => it.order_item_id === newItem.order_item_id);
      if (existingIdx >= 0) {
        updatedItems[existingIdx] = newItem;
      } else {
        updatedItems.push(newItem);
      }
    });

    setReturnItems(updatedItems);
    setIsAddModalOpen(false);
    setEditingItem(null);
    await handleSaveReturnData(updatedItems);
  };

  const handleRemoveReturnItem = async (indexOrId) => {
    const updated = returnItems.filter((it, idx) => it.id !== indexOrId && idx !== indexOrId);
    setReturnItems(updated);
    await handleSaveReturnData(updated);
  };

  const handleSaveTambahanModal = async (payload) => {
    setTambahan(payload);
    setIsTambahanModalOpen(false);
    await handleSaveReturnData(undefined, payload);
  };

  const formatLogDateTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const date = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${date}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">Memuat detail pengembalian...</div>;
  }
  if (!order) {
    return <div className="p-8 text-center text-xs font-bold text-rose-500">Data pengembalian tidak ditemukan.</div>;
  }

  const returnId = formatOrderReference(order, 'pengembalian');
  const creatorName = order.dibuat_oleh_nama || 'System';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* Header Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{returnId}</h2>
            <p className="text-[11px] text-slate-400 font-medium">Penjualan Oleh {creatorName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusOpen(!statusOpen)}
              className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 bg-white min-w-[120px] cursor-pointer"
            >
              <span>{returnStatus}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {statusOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 min-w-[140px]">
                {['Draft', 'Tunda', 'Dikonfirmasi', 'Batal'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusOpen(false);
                      setReturnStatus(st);
                      handleSaveReturnData(undefined, undefined, st);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-slate-700 font-semibold cursor-pointer flex items-center justify-between"
                  >
                    <span>{st}</span>
                    {returnStatus === st && <Check size={12} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Email / Contact Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 bg-white cursor-pointer"
            >
              <Mail size={14} className="text-slate-400" /> Email
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 min-w-[130px]">
                <a
                  href={`mailto:${customerEmail}`}
                  className="px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <Mail size={13} className="text-slate-400" /> Kirim Email
                </a>
                <a
                  href={`https://wa.me/${order.nomor_wa}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <MessageSquare size={13} className="text-slate-400" /> Kirim WhatsApp
                </a>
              </div>
            )}
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 bg-white cursor-pointer"
          >
            <Printer size={15} />
          </button>

          {/* Date Picker */}
          <div className="relative flex items-center">
            <Calendar size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={returnDate}
              onChange={(e) => {
                setReturnDate(e.target.value);
                handleSaveReturnData(undefined, undefined, undefined, undefined, e.target.value);
              }}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-300 bg-white cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3 Main Cards: Pelanggan, Pesanan, Catatan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Pelanggan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3 font-bold text-slate-800 text-xs">
            Pelanggan
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium mb-0.5">Nama</span>
              <span className="text-slate-800 font-bold">{order.nama || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium mb-0.5">Email</span>
              <span className="text-slate-700 font-semibold">{customerEmail || '-'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pesanan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3 font-bold text-slate-800 text-xs">
            Pesanan
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium mb-0.5">Pelanggan</span>
              <span className="text-slate-800 font-bold">{order.nama || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium mb-0.5">No. Pesanan</span>
              <span className="text-slate-800 font-bold font-mono">{formatOrderReference(order, 'pengembalian')}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Catatan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3 font-bold text-slate-800 text-xs">
            Catatan
          </div>
          <div className="text-xs font-medium text-slate-500 min-h-[40px] whitespace-pre-line leading-relaxed">
            {returnCatatan || 'Tidak ada Catatan'}
          </div>
        </div>
      </div>

      {/* Section Produk Pesanan Table (SS No 2) */}
      <ReturnOrderItemsTable
        returnItems={returnItems}
        tambahanNominal={tambahan.jumlah || 0}
        onOpenAddReturnModal={() => {
          setEditingItem(null);
          setIsAddModalOpen(true);
        }}
        onEditReturnItem={(item) => {
          setEditingItem(item);
          setIsAddModalOpen(true);
        }}
        onRemoveReturnItem={handleRemoveReturnItem}
        onOpenTambahanModal={() => setIsTambahanModalOpen(true)}
      />

      {/* Log Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="border-b border-slate-100 pb-2.5 mb-3 font-bold text-slate-800 text-xs">
          Log
        </div>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-start py-0.5">
            <span className="text-slate-400 font-medium">Waktu Pembuatan</span>
            <span className="text-slate-700 font-semibold text-right">
              {customerEmail || creatorName}, {formatLogDateTime(order.waktu)}
            </span>
          </div>
        </div>
      </div>

      {/* Modal Pop-Up Pengembalian Pesanan (SS No 1) */}
      <TambahPengembalianPesananModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveAddModal}
        orderItems={order.items || []}
        editingReturnItem={editingItem}
      />

      {/* Modal Pop-Up Tambahan (SS No 3) */}
      <PengaturanTambahanModal
        isOpen={isTambahanModalOpen}
        onClose={() => setIsTambahanModalOpen(false)}
        onSave={handleSaveTambahanModal}
        currentTambahan={tambahan.jumlah || 0}
        currentDeskripsi={tambahan.deskripsi || ''}
      />
    </div>
  );
}
