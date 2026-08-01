import OrderHeader from './OrderHeader';
import ProdukPesananCard from './ProdukPesananCard';

export default function CancelledOrderDetail({ order, metadata, onBack, onUpdateStatus, onTogglePayment, onUpdateDate, items }) {
  const formatLogTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const creatorName = order.activity_logs?.find((log) => log.tindakan === 'CREATE_ORDER' || log.keterangan?.includes('dibuat') || log.keterangan?.includes('Created'))?.user_nama
    || order.activity_logs?.[order.activity_logs.length - 1]?.user_nama
    || 'Tidak diketahui';
  const updaterName = order.activity_logs?.[0]?.user_nama || 'Tidak diketahui';
  const lastUpdateTime = order.activity_logs?.[0]?.waktu || order.waktu;
  const createTime = order.waktu;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* 1. Header Section */}
      <OrderHeader
        order={order}
        metadata={metadata}
        onBack={onBack}
        onUpdateStatus={onUpdateStatus}
        onTogglePayment={onTogglePayment}
        onUpdateDate={onUpdateDate}
      />

      {/* 2. Three-column Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pelanggan */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3.5">
            <span className="text-xs font-bold text-slate-800">Pelanggan</span>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">Nama</span>
              <span className="text-slate-700 font-semibold block">{order.nama || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">Email</span>
              <span className="text-slate-700 font-semibold block">{metadata.customerEmail || '-'}</span>
            </div>
          </div>
        </div>

        {/* Tujuan Pengiriman */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3.5">
            <span className="text-xs font-bold text-slate-800">Tujuan Pengiriman</span>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">Nama</span>
              <span className="text-slate-700 font-semibold block">{order.nama || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">Alamat</span>
              <span className="text-slate-700 font-semibold block">{metadata.customerAddress || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">Telpon</span>
              <span className="text-slate-700 font-semibold block">{order.nomor_wa || '-'}</span>
            </div>
          </div>
        </div>

        {/* Kurir Pengiriman */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="border-b border-slate-100 pb-2.5 mb-3.5">
            <span className="text-xs font-bold text-slate-800">Kurir Pengiriman</span>
          </div>
          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">Kurir</span>
              <span className="text-slate-700 font-semibold block">{metadata.shippingCourier || '-'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-medium block mb-0.5">No. Tracking</span>
              <span className="text-slate-700 font-semibold block">{metadata.shippingTrackingNo || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Products list section */}
      <ProdukPesananCard order={order} items={items} canEdit={false} />

      {/* 4. Catatan Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="border-b border-slate-100 pb-2.5 mb-3.5">
          <span className="text-xs font-bold text-slate-800">Catatan</span>
        </div>
        <p className="text-xs text-slate-700 font-semibold whitespace-pre-line text-left">
          {metadata.catatan || '-'}
        </p>
      </div>

      {/* 5. Log Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="border-b border-slate-100 pb-2.5 mb-3.5">
          <span className="text-xs font-bold text-slate-800">Log</span>
          </div>
        <div className="space-y-3.5 text-xs text-left">
          <div>
            <span className="text-slate-400 font-medium block mb-0.5">Waktu Pembuatan</span>
            <span className="text-slate-700 font-semibold block">
              {creatorName}, {formatLogTime(createTime)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 font-medium block mb-0.5">Terakhir Diperbarui</span>
            <span className="text-slate-700 font-semibold block">
              {updaterName}, {formatLogTime(lastUpdateTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
