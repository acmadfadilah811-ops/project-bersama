import OrderHeader from './OrderHeader';

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
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
        <div className="border-b border-slate-100 pb-2.5 mb-3">
          <span className="text-xs font-bold text-slate-800">Produk Pesanan</span>
        </div>
        
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5">Produk</th>
                  <th className="py-2.5 text-center">Jumlah</th>
                  <th className="py-2.5 text-right">Harga Satuan</th>
                  <th className="py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-700">
                {items.map((item, idx) => {
                  const namaProduk = item.jenis_produk || item.product_nama || item.nama_produk || item.nama || 'Produk Custom';
                  const qty = item.qty ?? item.jumlah ?? 1;
                  const harga = item.harga_jual ?? item.harga_satuan ?? item.harga ?? 0;
                  const subtotal = qty * harga;
                  return (
                    <tr key={item.id || idx}>
                      <td className="py-3">
                        <span className="font-bold text-slate-800 block">{namaProduk}</span>
                        {(item.panjang > 0 || item.lebar > 0) && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Ukuran: {item.panjang || 0}m × {item.lebar || 0}m
                          </span>
                        )}
                        {item.catatan && <span className="text-[10px] text-slate-400 block mt-0.5">{item.catatan}</span>}
                      </td>
                      <td className="py-3 text-center font-semibold">{qty} pcs</td>
                      <td className="py-3 text-right font-mono">Rp {harga.toLocaleString('id-ID')}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-800">
                        Rp {subtotal.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[200px] text-center py-4">
            <div className="mb-3 text-slate-300">
              <span className="text-6xl select-none">🐻‍❄️</span>
            </div>
            <span className="text-xs font-bold text-slate-700 block">Tidak ada pesanan</span>
          </div>
        )}
      </div>

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
