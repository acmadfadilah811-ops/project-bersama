import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Edit2,
  Check,
  AlertCircle,
  Printer
} from 'lucide-react';
import PrintPdfModal from './PrintPdfModal';

const statusMap = {
  review: { label: 'Tunda', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  desain: { label: 'Dikonfirmasi', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  proses: { label: 'Dikirim', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  ready: { label: 'Terkirim', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  selesai: { label: 'Selesai', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  batal: { label: 'Batal', color: 'text-rose-600 bg-rose-50 border-rose-200' },
};

export default function OrderHeader({
  order,
  metadata,
  onBack,
  onUpdateStatus,
  onTogglePayment,
  onUpdateDate,
}) {
  const [isEditingHeader, setIsEditingHeader] = useState(
    order?.status_global !== 'selesai' && order?.status_global !== 'batal'
  );
  const [statusOpen, setStatusOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const statusRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    if (order) {
      setIsEditingHeader(order.status_global !== 'selesai' && order.status_global !== 'batal');
    }
  }, [order]);

  useEffect(() => {
    const onClick = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isPaid = order.total_harga > 0 ? order.sisa_tagihan === 0 : order.dp_dibayar > 0;

  const getFormattedOrderId = () => {
    if (!order) return '';
    if (typeof order.id === 'string' && order.id.startsWith('ORD-')) return order.id;
    return `ORD-${order.id}`;
  };

  const getDisplayDate = () => {
    if (!order.waktu) return '-';
    const d = new Date(order.waktu);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getLocalDateString = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateChange = (e) => {
    if (e.target.value) {
      const [year, month, day] = e.target.value.split('-');
      const localDate = new Date(year, month - 1, day, 12, 0, 0);
      onUpdateDate(localDate.toISOString());
    }
  };

  const emailLink = `mailto:${metadata.customerEmail || ''}`;
  const smsLink = `sms:${order.nomor_wa || ''}`;
  const waLink = `https://wa.me/${(order.nomor_wa || '').replace(/[^0-9]/g, '')}`;

  const creatorName = order.activity_logs?.find((log) => log.tindakan === 'CREATE_ORDER' || log.keterangan?.includes('dibuat'))?.user_nama
    || order.activity_logs?.[order.activity_logs.length - 1]?.user_nama
    || 'Tidak diketahui';

  const isCancelled = order?.status_global === 'batal';

  return (
    <div className="flex flex-col w-full shadow-sm rounded-xl border border-slate-200">
      {/* Banner */}
      {!isCancelled && (
        <div
          className={`rounded-t-xl px-5 py-2 flex items-center justify-between text-white text-xs font-bold transition-colors duration-300 ${
            isPaid ? 'bg-[#73C247]' : 'bg-[#9CA3AF]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            {isPaid ? (
              <CheckCircle2 size={15} className="text-white" />
            ) : (
              <AlertCircle size={15} className="text-white" />
            )}
            <span>{isPaid ? 'Sudah bayar' : 'Belum bayar'}</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={() => onTogglePayment(!isPaid)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-white/40 rounded-full peer peer-focus:outline-none peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      )}

      {/* Header Info */}
      <div className={`bg-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-700 ${
        isCancelled ? 'rounded-xl' : 'rounded-b-xl'
      }`}>
        {/* Left: ID and Creator info */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{getFormattedOrderId()}</h2>
            <p className="text-[11px] text-slate-400 font-medium">Penjualan Oleh {creatorName}</p>
          </div>
        </div>

        {/* Right: Actions and Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {isEditingHeader ? (
            <>
              {/* Notifikasi Dropdown */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 bg-white cursor-pointer"
                >
                  <Mail size={14} className="text-slate-400" />
                  <span>Notifikasi</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 min-w-[130px]">
                    <a
                      href={emailLink}
                      className="px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Mail size={13} className="text-slate-400" /> Email
                    </a>
                    <a
                      href={smsLink}
                      className="px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <Smartphone size={13} className="text-slate-400" /> SMS
                    </a>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 cursor-pointer"
                    >
                      <MessageSquare size={13} className="text-slate-400" /> Whatsapp
                    </a>
                  </div>
                )}
              </div>

              {/* Cetak Button */}
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 bg-white cursor-pointer"
              >
                Cetak
              </button>

              {/* Status Dropdown */}
              <div className="relative" ref={statusRef}>
                <button
                  type="button"
                  onClick={() => setStatusOpen(!statusOpen)}
                  className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 bg-white min-w-[120px] cursor-pointer"
                >
                  <span>{statusMap[order.status_global]?.label || order.status_global}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                {statusOpen && (
                  <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 min-w-[140px] divide-y divide-slate-50">
                    {Object.entries(statusMap).map(([key, item]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onUpdateStatus(key);
                          setStatusOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs text-slate-700 font-semibold cursor-pointer flex items-center justify-between"
                      >
                        <span>{item.label}</span>
                        {order.status_global === key && <CheckCircle2 size={12} className="text-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Input */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={getLocalDateString(order.waktu)}
                  onChange={handleDateChange}
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-blue-300 bg-white cursor-pointer"
                />
                {order.status_global === 'selesai' && (
                  <button
                    type="button"
                    onClick={() => setIsEditingHeader(false)}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg px-3 py-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Check size={12} /> Selesai
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* View Mode: Only Date and Ubah Button */}
              <div className="flex items-center gap-2">
                {isCancelled && (
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-500 cursor-pointer flex items-center justify-center bg-white"
                  >
                    <Printer size={14} />
                  </button>
                )}
                <div className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-slate-50/50 rounded-lg text-slate-700 font-semibold font-mono">
                  <Calendar size={13} className="text-slate-400" />
                  <span>{getDisplayDate()}</span>
                </div>
                {order.status_global === 'selesai' && (
                  <button
                    type="button"
                    onClick={() => setIsEditingHeader(true)}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Edit2 size={11} /> Ubah
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showPrintModal && <PrintPdfModal onClose={() => setShowPrintModal(false)} />}
    </div>
  );
}
