import { useState } from 'react';
import { ChevronLeft, ChevronDown, Check, Mail, Phone, MessageSquare, Printer, Calendar } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function ReturnOrderDetail({ orderId, onBack, onSaved }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Return data parsed from notes
  const [returnDate, setReturnDate] = useState('');
  const [returnStatus, setReturnStatus] = useState('Tunda');
  const [returnCatatan, setReturnCatatan] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Edit states for cards
  const [editingCard, setEditingCard] = useState(null);
  const [tempCatatan, setTempCatatan] = useState('');
  const [tempOrderNo, setTempOrderNo] = useState('');

  // Dropdowns
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const [pengembalianDbId, setPengembalianDbId] = useState(null);

  const getReturnInfo = (catatanPelanggan) => {
    if (!catatanPelanggan) return null;
    const match = catatanPelanggan.match(
      /\[PENGEMBALIAN - Tanggal:\s*([^\s,]*),\s*Status:\s*([^,]*),\s*Catatan:\s*([^\]]*)\]/
    ) || catatanPelanggan.match(
      /\[PENGEMBALIAN - Tanggal:\s*([^\s,]+),\s*Catatan:\s*([^\]]*)\]/
    );
    
    if (match) {
      if (match.length === 4) {
        return {
          tanggal: match[1],
          status: match[2] || 'Tunda',
          catatan: match[3],
        };
      }
      return {
        tanggal: match[1],
        status: 'Tunda',
        catatan: match[2],
      };
    }
    return null;
  };

  const fetchOrderDetail = async () => {
    try {
      const res = await apiClient.get(`/orders/${orderId}/`);
      const data = res.data;
      setOrder(data);

      if (data.pengembalian_aktif) {
        setPengembalianDbId(data.pengembalian_aktif.id);
        setReturnDate(data.pengembalian_aktif.tanggal_pengembalian || '');
        setReturnStatus(data.pengembalian_aktif.status || 'Tunda');
        setReturnCatatan(data.pengembalian_aktif.catatan || '');
      } else {
        const info = getReturnInfo(data.catatan_pelanggan);
        if (info) {
          setReturnDate(info.tanggal || '');
          setReturnStatus(info.status || 'Tunda');
          setReturnCatatan(info.catatan || '');
        }
      }

      if (data.email_pelanggan) {
        setCustomerEmail(data.email_pelanggan);
      } else if (data.catatan_pelanggan && data.catatan_pelanggan.includes('(')) {
        const emailMatch = data.catatan_pelanggan.match(/\(([^)]+)\)/);
        if (emailMatch) {
          setCustomerEmail(emailMatch[1]);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memuat detail pengembalian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const handleUpdateReturn = async (newDate, newStatus, newCatatan) => {
    if (!order) return;
    try {
      if (pengembalianDbId) {
        // Updated native API call (T-208 Revisi 2)
        const payload = {};
        if (newStatus !== undefined) payload.status = newStatus;
        if (newCatatan !== undefined) payload.catatan = newCatatan;
        if (newDate !== undefined) payload.tanggal_pengembalian = newDate;

        await apiClient.patch(`/pengembalian/${pengembalianDbId}/`, payload);
      } else {
        // Fallback legacy note patch
        const cleanNotes = order.catatan_pelanggan
          ? order.catatan_pelanggan.replace(/\[PENGEMBALIAN[^\]]*\]\n?/, '').trim()
          : '';
        const newTag = `[PENGEMBALIAN - Tanggal: ${newDate || returnDate}, Status: ${newStatus || returnStatus}, Catatan: ${newCatatan !== undefined ? newCatatan : returnCatatan}]`;
        const updatedNotes = `${newTag}\n${cleanNotes}`.trim();

        await apiClient.patch(`/orders/${orderId}/`, {
          catatan_pelanggan: updatedNotes,
        });
      }

      await fetchOrderDetail();
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui pengembalian.');
    }
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
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-400">
        Memuat detail pengembalian...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center text-xs font-bold text-rose-500">
        Data pengembalian tidak ditemukan.
      </div>
    );
  }

  const getCreatorName = () => {
    if (!order?.activity_logs || order.activity_logs.length === 0) {
      return 'System';
    }
    // Log pertama adalah CREATE_ORDER
    const createLog = order.activity_logs.find((log) => log.tindakan === 'CREATE_ORDER');
    return createLog?.user_nama || 'System';
  };

  const getLastUpdatedLog = () => {
    if (!order?.activity_logs || order.activity_logs.length === 0) {
      return null;
    }
    // Log paling baru (atau yang terakhir diubah)
    return order.activity_logs[0]; // Assume sorted by waktu desc
  };

  const returnId = `SR${new Date(order.waktu).getFullYear().toString().slice(-2)}${String(
    new Date(order.waktu).getMonth() + 1
  ).padStart(2, '0')}${String(new Date(order.waktu).getDate()).padStart(2, '0')}0000000${order.id}`;

  const creatorName = getCreatorName();
  const lastLog = getLastUpdatedLog();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* Detail Pengembalian Header Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: ID & Creator */}
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

        {/* Right Side: Status, Notif, Print, Date */}
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
                      handleUpdateReturn(returnDate, st, returnCatatan);
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

          {/* Notifikasi Dropdown */}
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
                  href={`sms:${order.nomor_wa}`}
                  className="px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <Phone size={13} className="text-slate-400" /> Kirim SMS
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
            onClick={async () => {
              try {
                const res = await apiClient.get(`/orders/${orderId}/print-return/`);
                const blob = new Blob([res.data], { type: 'text/html;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (win) {
                  setTimeout(() => win.print(), 500);
                }
              } catch (err) {
                alert('Gagal membuka laporan pengembalian.');
                console.error(err);
              }
            }}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 bg-white cursor-pointer"
          >
            <Printer size={15} />
          </button>

          {/* Return Date Picker */}
          <div className="relative flex items-center">
            <Calendar size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={returnDate}
              onChange={(e) => handleUpdateReturn(e.target.value, returnStatus, returnCatatan)}
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-300 bg-white cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3 Main Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Pelanggan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs relative">
          <div className="border-b border-slate-100 pb-2.5 mb-3">
            <span className="text-xs font-bold text-slate-800">Pelanggan</span>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 block font-medium mb-0.5">Nama</span>
              <span className="text-slate-700 font-semibold">{order.nama || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium mb-0.5">Email</span>
              <span className="text-slate-700 font-semibold">{customerEmail}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Pesanan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs relative">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <span className="text-xs font-bold text-slate-800">Pesanan</span>
            {editingCard === 'pesanan' ? (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    handleUpdateReturn(returnDate, returnStatus, returnCatatan);
                    setEditingCard(null);
                  }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCard(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 ml-1.5 cursor-pointer"
                >
                  X
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingCard('pesanan');
                  setTempOrderNo(`ORD-${order.id}`);
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                ✏️
              </button>
            )}
          </div>
          {editingCard === 'pesanan' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tempOrderNo}
                onChange={(e) => setTempOrderNo(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 block font-medium mb-0.5">Pelanggan</span>
                <span className="text-slate-700 font-semibold">{order.nama || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium mb-0.5">No. Pesanan</span>
                <span className="text-slate-700 font-semibold font-mono">ORD-{order.id}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Catatan */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs relative">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <span className="text-xs font-bold text-slate-800">Catatan</span>
            {editingCard === 'catatan' ? (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    handleUpdateReturn(returnDate, returnStatus, tempCatatan);
                    setEditingCard(null);
                  }}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingCard(null)}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 ml-1.5 cursor-pointer"
                >
                  X
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditingCard('catatan');
                  setTempCatatan(returnCatatan);
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
              >
                ✏️
              </button>
            )}
          </div>
          {editingCard === 'catatan' ? (
            <textarea
              value={tempCatatan}
              onChange={(e) => setTempCatatan(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300 resize-none"
              rows={2}
            />
          ) : (
            <p className="text-xs text-slate-700 font-semibold min-h-[40px] whitespace-pre-line leading-relaxed">
              {returnCatatan || '-'}
            </p>
          )}
        </div>
      </div>

      {/* Produk Pesanan Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <span className="text-xs font-bold text-slate-800">Produk Pesanan</span>
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1 cursor-pointer transition-colors"
          >
            + Pengembalian Pesanan
          </button>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[220px] text-center">
          <div className="mb-4 text-slate-300">
            <span className="text-6xl select-none">🐻‍❄️</span>
          </div>
          <span className="text-xs font-bold text-slate-700 block">Tidak ada pesanan</span>
        </div>
      </div>

      {/* Log Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="border-b border-slate-100 pb-2.5 mb-3">
          <span className="text-xs font-bold text-slate-800">Log</span>
        </div>
        <div className="space-y-3.5 text-xs">
          <div className="flex justify-between items-start py-0.5">
            <span className="text-slate-400 font-medium">Waktu Pembuatan</span>
            <span className="text-slate-700 font-semibold text-right">
              {creatorName}, {formatLogDateTime(order.waktu)}
            </span>
          </div>
          <div className="flex justify-between items-start py-0.5">
            <span className="text-slate-400 font-medium">Terakhir Diperbarui</span>
            <span className="text-slate-700 font-semibold text-right">
              {lastLog?.user_nama || creatorName}, {formatLogDateTime(lastLog?.waktu || order.waktu)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
