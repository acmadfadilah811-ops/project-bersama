import { useState, useEffect } from 'react';
import apiClient from '../../../api/apiClient';
import OrderHeader from './OrderHeader';
import CustomerCard from './CustomerCard';
import ShippingCard from './ShippingCard';
import PaymentCard from './PaymentCard';
import OrderLogSection from './OrderLogSection';
import ProdukPesananCard from './ProdukPesananCard';
import { parseOrderMetadata, serializeOrderMetadata } from './metadataHelper';
import CancelledOrderDetail from './CancelledOrderDetail';
import { useTransaksiCrumb } from './TransaksiContext';
import { useAuth } from '../../../context/AuthContext';
import VoidOrderModal from '../../kasir/components/VoidOrderModal';
import VoidOrderOtpModal from '../../kasir/components/VoidOrderOtpModal';

export default function OrderDetail({ orderId, onBack, onSaved }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState({});
  const { setSubtitle } = useTransaksiCrumb();
  const { user } = useAuth();
  const isKasir = user?.role?.toLowerCase() === 'kasir';
  // Pembatalan pesanan diselaraskan dengan Kasir (PosHistory.jsx): kasir wajib
  // lewat persetujuan OTP owner (VoidOrderOtpModal), role lain langsung isi
  // alasan (VoidOrderModal) — dua-duanya memanggil /orders/{id}/batalkan/ yang
  // sama. Sebelumnya di sini cuma pakai window.prompt() polos tanpa OTP sama
  // sekali untuk semua role, tidak selaras dengan alur Kasir yang sudah ada
  // (diperbaiki 2026-09-05 atas permintaan user, audit Transaksi & Pembayaran).
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [showVoidOtpModal, setShowVoidOtpModal] = useState(false);

  useEffect(() => {
    if (order?.status_global === 'batal') {
      setSubtitle('Detail Pesanan Dibatalkan');
    } else if (order?.status_global === 'selesai') {
      setSubtitle('Detail Pesanan Selesai');
    } else {
      setSubtitle('Open Order Detail');
    }
    return () => setSubtitle('');
  }, [order?.status_global, setSubtitle]);

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
      openCancelFlow();
    } else {
      await handleUpdate({ status_global: newStatus });
    }
  };

  const openCancelFlow = () => {
    if (isKasir) {
      setShowVoidOtpModal(true);
    } else {
      setShowVoidModal(true);
    }
  };

  const handleCancelOrder = () => openCancelFlow();

  const handleConfirmVoidLangsung = async (alasan) => {
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

  const canEditItems = order.status_global !== 'selesai' && order.status_global !== 'batal';

  return (
    <>
    <div className="p-6 max-w-6xl mx-auto space-y-5 animate-fade-in text-slate-700">
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

      {/* 4. Products list + order summary (satu kartu menyatu) */}
      <ProdukPesananCard
        orderId={orderId}
        order={order}
        items={items}
        canEdit={canEditItems}
        onItemsChanged={fetchOrderDetail}
      />

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

    <VoidOrderModal
      isOpen={showVoidModal}
      onClose={() => setShowVoidModal(false)}
      onConfirmVoid={handleConfirmVoidLangsung}
    />
    <VoidOrderOtpModal
      isOpen={showVoidOtpModal}
      onClose={() => setShowVoidOtpModal(false)}
      tipe="order"
      target={order}
      onVoided={() => {
        setShowVoidOtpModal(false);
        fetchOrderDetail();
        onSaved?.();
      }}
    />
    </>
  );
}
