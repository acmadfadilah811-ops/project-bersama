import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../../../api/apiClient';
import ReturPembelianHeaderCards from './ReturPembelianHeaderCards';
import ReturPembelianItemsTable from './ReturPembelianItemsTable';
import ProdukReturModal from './ProdukReturModal';
import PembayaranReturModal from './PembayaranReturModal';

/**
 * Complete Return Purchase Detail View — Presisi 1:1 SS No. 1, 2, 3, 4
 */
export default function ReturPembelianDetailView({ docId, onBack, onSaved }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiClient.get(`/purchases/${docId}/`);
      setDoc(res.data);
    } catch (err) {
      console.error('Gagal memuat retur:', err);
      alert(err.response?.data?.error || 'Gagal memuat retur.');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const refreshAll = async () => {
    await fetchDetail();
    onSaved?.();
  };

  const handleSelectProductToReturn = (productItem) => {
    setSelectedProductForModal({
      id: null, // item baru
      product: productItem.product || productItem.id,
      variant: productItem.variant,
      product_nama: productItem.product_nama,
      product_satuan: productItem.product_satuan,
      qty_beli: productItem.qty,
      qty: 1,
      harga_beli: productItem.harga_beli,
      alasan_retur: '',
      catatan_retur: '',
      jadikan_stok_keluar: true,
    });
    setIsProductModalOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedProductForModal({
      ...item,
      qty_beli: item.qty_beli || item.qty,
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProductModal = async (payload) => {
    try {
      if (payload.item_id) {
        await apiClient.post(`/purchases/${docId}/update-item/`, {
          item_id: payload.item_id,
          qty: payload.qty,
          alasan_retur: payload.alasan_retur,
          catatan_retur: payload.catatan_retur,
          jadikan_stok_keluar: payload.jadikan_stok_keluar,
        });
      } else {
        await apiClient.post(`/purchases/${docId}/add-item/`, {
          product: payload.product,
          variant: payload.variant,
          qty: payload.qty,
          harga_beli: payload.harga_beli,
          uom_kode: payload.satuan,
          alasan_retur: payload.alasan_retur,
          catatan_retur: payload.catatan_retur,
          jadikan_stok_keluar: payload.jadikan_stok_keluar,
        });
      }
      setIsProductModalOpen(false);
      setSelectedProductForModal(null);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan produk retur.');
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await apiClient.post(`/purchases/${docId}/remove-item/`, { item_id: itemId });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus produk retur.');
    }
  };

  const handleToggleStokKeluar = async (item, newValue) => {
    try {
      await apiClient.post(`/purchases/${docId}/update-item/`, {
        item_id: item.id,
        jadikan_stok_keluar: newValue,
      });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengubah status stok keluar.');
    }
  };

  const handleAddPayment = async (payload) => {
    try {
      await apiClient.post(`/purchases/${docId}/add-payment/`, payload);
      setIsPayModalOpen(false);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mencatat pembayaran retur.');
    }
  };

  const handlePostRetur = async () => {
    if (!window.confirm('Post sekarang retur pembelian ini?')) return;
    try {
      await apiClient.post(`/purchases/${docId}/post-retur/`);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memposting retur.');
    }
  };

  const handleCancelRetur = async () => {
    if (!window.confirm('Batalkan retur pembelian ini?')) return;
    try {
      await apiClient.post(`/purchases/${docId}/cancel/`);
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membatalkan retur.');
    }
  };

  const handleSaveCatatan = async (newCatatan) => {
    try {
      await apiClient.patch(`/purchases/${docId}/`, { catatan: newCatatan });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan catatan.');
      throw err;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Memuat detail retur...</div>;
  }
  if (!doc) {
    return <div className="p-8 text-center text-xs font-bold text-rose-500">Data retur tidak ditemukan.</div>;
  }

  const items = doc.items || [];
  const refDetails = doc.retur_ref_details || {};
  const availableProducts = refDetails.items || [];

  const totalAmount = items.reduce(
    (acc, it) => acc + Number(it.qty || 1) * Number(it.harga_beli || 0),
    0
  );

  return (
    <div className="p-6 w-full mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* Top Header & 3 Info Cards (SS No. 1) */}
      <ReturPembelianHeaderCards
        doc={doc}
        onBack={onBack}
        onPost={handlePostRetur}
        onCancel={handleCancelRetur}
        onSaveCatatan={handleSaveCatatan}
      />

      {/* Tabel "Produk yang dikembalikan" & Ringkasan Retur (SS No. 1 & SS No. 3) */}
      <ReturPembelianItemsTable
        doc={doc}
        items={items}
        availableProducts={availableProducts}
        onSelectProductToReturn={handleSelectProductToReturn}
        onEditItem={handleEditItem}
        onRemoveItem={handleRemoveItem}
        onToggleStokKeluar={handleToggleStokKeluar}
        onOpenPembayaran={() => setIsPayModalOpen(true)}
      />

      {/* Pop Up Modal Produk Retur (SS No. 2) */}
      <ProdukReturModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setSelectedProductForModal(null);
        }}
        onSave={handleSaveProductModal}
        itemData={selectedProductForModal}
        maxQty={selectedProductForModal?.qty_beli || 9999}
      />

      {/* Pop Up Modal Pembayaran Retur (SS No. 4) */}
      <PembayaranReturModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onSave={handleAddPayment}
        totalAmount={totalAmount}
      />
    </div>
  );
}
