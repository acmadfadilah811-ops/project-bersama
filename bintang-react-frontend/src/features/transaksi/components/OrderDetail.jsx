import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import OrderHeader from './OrderHeader';
import CustomerCard from './CustomerCard';
import ShippingCard from './ShippingCard';
import PaymentCard from './PaymentCard';
import OrderLogSection from './OrderLogSection';
import { parseOrderMetadata, serializeOrderMetadata } from './metadataHelper';
import CancelledOrderDetail from './CancelledOrderDetail';

export default function OrderDetail({ orderId, onBack, onSaved }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState({});

  const fetchOrderDetail = async () => {
    try {
      const res = await apiClient.get(`/orders/${orderId}/`);
      const data = res.data;
      setOrder(data);
      // Parse metadata directly from native Order object fields (T-209 Revisi 2)
      const parsedMeta = parseOrderMetadata(data);
      setMetadata(parsedMeta);
    } catch (err) {
      console.error(err);
      alert('Gagal memuat detail pesanan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const handleUpdate = async ({ nama, nomor_wa, status_global, dp_dibayar, waktu, metadata: newMetadata }) => {
    if (!order) return;
    try {
      const payload = {};
      if (nama !== undefined) payload.nama = nama;
      if (nomor_wa !== undefined) payload.nomor_wa = nomor_wa;
      if (status_global !== undefined) payload.status_global = status_global;
      if (dp_dibayar !== undefined) payload.dp_dibayar = dp_dibayar;
      if (waktu !== undefined) payload.waktu = waktu;

      // Update metadata fields natively
      if (newMetadata !== undefined) {
        if (newMetadata.customerEmail !== undefined) payload.email_pelanggan = newMetadata.customerEmail;
        if (newMetadata.customerAddress !== undefined) payload.alamat_pelanggan = newMetadata.customerAddress;
        if (newMetadata.shippingCourier !== undefined) payload.kurir_pengiriman = newMetadata.shippingCourier;
        if (newMetadata.shippingService !== undefined) payload.layanan_pengiriman = newMetadata.shippingService;
        if (newMetadata.shippingDate !== undefined) payload.tanggal_pengiriman = newMetadata.shippingDate === '-' ? null : newMetadata.shippingDate;
        if (newMetadata.dropshipStore !== undefined) payload.toko_dropship = newMetadata.dropshipStore;
        if (newMetadata.dropshipSender !== undefined) payload.pengirim_dropship = newMetadata.dropshipSender;
        if (newMetadata.dropshipPhone !== undefined) payload.telepon_dropship = newMetadata.dropshipPhone;
        if (newMetadata.dueDate !== undefined) payload.jatuh_tempo = newMetadata.dueDate === '-' ? null : newMetadata.dueDate;
        if (newMetadata.invoiceFooter !== undefined) payload.catatan_footer = newMetadata.invoiceFooter;
        if (newMetadata.catatan !== undefined) payload.catatan_pelanggan = newMetadata.catatan;
      }

      const res = await apiClient.patch(`/orders/${orderId}/`, payload);
      const data = res.data;
      setOrder(data);
      
      const parsedMeta = parseOrderMetadata(data);
      setMetadata(parsedMeta);
      onSaved?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memperbarui data pesanan.');
    }
  };

  const handleTogglePayment = async (toBePaid) => {
    if (!order) return;
    const dp = toBePaid ? (order.total_harga || 10000) : 0;
    await handleUpdate({ dp_dibayar: dp });
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!order) return;
    if (newStatus === 'selesai') {
      try {
        const res = await apiClient.post(`/orders/${orderId}/selesaikan/`);
        const data = res.data;
        setOrder(data);
        setMetadata(parseOrderMetadata(data));
        onSaved?.();
      } catch (err) {
        alert(err.response?.data?.error || 'Gagal menyelesaiakan pesanan.');
      }
    } else if (newStatus === 'batal') {
      const alasan = window.prompt('Masukkan alasan pembatalan pesanan:');
      if (alasan === null) return;
      try {
        const res = await apiClient.post(`/orders/${orderId}/batalkan/`, { alasan });
        const data = res.data;
        setOrder(data);
        setMetadata(parseOrderMetadata(data));
        onSaved?.();
      } catch (err) {
        alert(err.response?.data?.error || 'Gagal membatalkan pesanan.');
      }
    } else {
      await handleUpdate({ status_global: newStatus });
    }
  };

  const handleCancelOrder = async () => {
    const alasan = window.prompt('Apakah Anda yakin ingin membatalkan pesanan ini? Masukkan alasan pembatalan:');
    if (alasan === null) return;
    try {
      const res = await apiClient.post(`/orders/${orderId}/batalkan/`, { alasan });
      const data = res.data;
      setOrder(data);
      setMetadata(parseOrderMetadata(data));
      onSaved?.();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membatalkan pesanan.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs font-bold text-slate-400">
        Memuat detail pesanan...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 text-center text-xs font-bold text-rose-500">
        Pesanan tidak ditemukan.
      </div>
    );
  }

  const items = order.items || [];

  if (order.status_global === 'batal') {
    return (
      <CancelledOrderDetail
        order={order}
        metadata={metadata}
        onBack={onBack}
        onUpdateStatus={handleUpdateStatus}
        onTogglePayment={handleTogglePayment}
        onUpdateDate={(dateStr) => handleUpdate({ waktu: dateStr })}
        items={items}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* 1. Header Section */}
      <OrderHeader
        order={order}
        metadata={metadata}
        onBack={onBack}
        onUpdateStatus={handleUpdateStatus}
        onTogglePayment={handleTogglePayment}
        onUpdateDate={(dateStr) => handleUpdate({ waktu: dateStr })}
      />

      {/* 2. Customer and shipping destination cards */}
      <CustomerCard
        order={order}
        metadata={metadata}
        onSave={handleUpdate}
        readOnly={order.status_global === 'batal'}
      />

      {/* 3. Shipping Status and Dropship cards */}
      <ShippingCard
        metadata={metadata}
        onSave={handleUpdate}
        readOnly={order.status_global === 'batal'}
      />

      {/* 4. Products list section */}
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

      {/* 5. Payments and notes cards */}
      <PaymentCard
        metadata={metadata}
        onSave={handleUpdate}
        readOnly={order.status_global === 'batal'}
      />

      {/* 6. Logs & Attachments */}
      <OrderLogSection
        order={order}
        metadata={metadata}
        onSave={handleUpdate}
        onCancelOrder={handleCancelOrder}
        readOnly={order.status_global === 'batal'}
      />
    </div>
  );
}
