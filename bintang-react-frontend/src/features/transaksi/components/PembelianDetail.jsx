import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, ShoppingBag, RotateCcw, Printer } from 'lucide-react';
import TambahProdukModal from './TambahProdukModal';
import PembelianInfoCards from './PembelianInfoCards';
import PembelianItemsTable from './PembelianItemsTable';
import PembelianPembayaranModal from './PembelianPembayaranModal';
import PembelianDiskonModal from './PembelianDiskonModal';
import PembelianPajakModal from './PembelianPajakModal';
import PembelianPengirimanModal from './PembelianPengirimanModal';
import PurchaseWorkflowLog from './PurchaseWorkflowLog';
import PurchaseAttachmentCard from './PurchaseAttachmentCard';
import ReturPembelianDetailView from './return/ReturPembelianDetailView';
import apiClient from '../../../api/apiClient';

export default function PembelianDetail({ docId, detailMode = 'butuh-diproses', onBack, onSaved }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [togglingPayment, setTogglingPayment] = useState(false);
  const [removingPaymentId, setRemovingPaymentId] = useState(null);

  // Modals for Diskon, Pajak, Pengiriman (Presisi SS No 1-4)
  const [showDiskonModal, setShowDiskonModal] = useState(false);
  const [showPajakModal, setShowPajakModal] = useState(false);
  const [showPengirimanModal, setShowPengirimanModal] = useState(false);

  // Values for Diskon, Pajak, Pengiriman
  const [diskonVal, setDiskonVal] = useState(0);
  const [diskonType, setDiskonType] = useState('persen');
  const [pajakVal, setPajakVal] = useState(0);
  const [pajakType, setPajakType] = useState('persen');
  const [pengirimanVal, setPengirimanVal] = useState(0);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiClient.get(`/purchases/${docId}/`);
      setDoc(res.data);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || err.response?.data?.detail || 'Gagal memuat detail pembelian.';
      alert(message);
    } finally {
      setLoading(false);
    }

    // Riwayat workflow adalah informasi tambahan. Detail pembelian tetap harus
    // bisa dibuka jika tabel log belum termigrasi atau dokumen merupakan retur.
    try {
      const logRes = await apiClient.get(`/purchases/${docId}/workflow/logs/`);
      setLogs(logRes.data || []);
    } catch (err) {
      console.warn('Gagal memuat riwayat workflow pembelian.', err);
      setLogs([]);
    }
  }, [docId]);

  useEffect(() => {
    fetchDetail();
  }, [docId, fetchDetail]);

  const handleAddProduct = async (payload) => {
    try {
      await apiClient.post(`/purchases/${docId}/add-item/`, payload);
      await fetchDetail();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menambahkan produk.');
      throw err;
    }
  };

  const handleAddPayment = async (payload) => {
    try {
      await apiClient.post(`/purchases/${docId}/add-payment/`, payload);
      await refreshAll();
      setIsPayOpen(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mencatat pembayaran.');
      throw err;
    }
  };

  const handleRemovePayment = async (paymentId) => {
    setRemovingPaymentId(paymentId);
    try {
      await apiClient.post(`/purchases/${docId}/remove-payment/`, { payment_id: paymentId });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Gagal membatalkan pembayaran.');
    } finally {
      setRemovingPaymentId(null);
    }
  };

  const handleUploadAttachment = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await apiClient.post(`/purchases/${docId}/upload-attachment/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Gagal mengunggah lampiran.');
      throw err;
    }
  };

  const handlePostRetur = async () => {
    if (!window.confirm('Post sekarang dokumen retur ini?')) return;
    try {
      await apiClient.post(`/purchases/${docId}/workflow/update-status/`, { status_pembelian: 'Selesai' });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memposting retur.');
    }
  };

  const refreshAll = async () => {
    await fetchDetail();
    onSaved?.();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Memuat detail...</div>;
  }
  if (doc?.is_retur) {
    return <ReturPembelianDetailView docId={docId} onBack={onBack} onSaved={onSaved} />;
  }

  const isDraft = doc.status === 'draft';
  const isRetur = !!doc.is_retur;
  const isCancelled = doc.status === 'batal' || detailMode === 'dibatalkan';

  const subtotal = (doc.items || []).reduce(
    (acc, it) => acc + Number(it.qty || 1) * Number(it.harga_beli || 0),
    0
  );
  const diskonAmount = diskonType === 'persen' ? Math.round(subtotal * (diskonVal / 100)) : diskonVal;
  const subtotalAfterDiskon = Math.max(0, subtotal - diskonAmount);
  const pajakAmount = pajakType === 'persen' ? Math.round(subtotalAfterDiskon * (pajakVal / 100)) : pajakVal;
  const pengirimanAmount = Number(pengirimanVal) || 0;
  const totalDitagihkan = Math.max(0, subtotalAfterDiskon + pajakAmount + pengirimanAmount);
  const jumlahTerbayar = Number(doc.total_dibayar || 0);
  const sisa = Math.max(0, totalDitagihkan - jumlahTerbayar);

  const hasProducts = Boolean(doc?.items && doc.items.length > 0);
  const hasReception = Boolean((doc?.no_terima && doc?.tanggal_diterima) || doc?.receive_status === 'diterima');
  const canTogglePayment = hasProducts && hasReception && isDraft;
  const isLunas = doc?.payment_status === 'lunas';

  const handleTogglePayment = async () => {
    if (!canTogglePayment || togglingPayment) return;
    setTogglingPayment(true);
    try {
      const targetStatus = isLunas ? 'belum' : 'lunas';
      await apiClient.post(`/purchases/${docId}/workflow/toggle-payment/`, { target_status: targetStatus });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Gagal mengubah status pembayaran.');
    } finally {
      setTogglingPayment(false);
    }
  };

  const handleStatusSelect = async (newStatus) => {
    try {
      await apiClient.post(`/purchases/${docId}/workflow/update-status/`, { status_pembelian: newStatus });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memperbarui status pembelian.');
    }
  };

  const getDropdownStatusValue = () => {
    if (doc.status === 'batal') return 'Batal';
    if (doc.status === 'selesai') return 'Selesai';
    if (doc.receive_status === 'diterima') return 'Diterima';
    return 'Tunda';
  };

  const handleDateChange = async (newDateIso) => {
    try {
      await apiClient.patch(`/purchases/${docId}/`, { tanggal: newDateIso });
      await refreshAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal mengubah tanggal.');
    }
  };

  return (
    <div className="p-6 w-full mx-auto space-y-5 animate-fade-in text-slate-700">
      {/* Breadcrumb Paling Atas */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="cursor-pointer hover:text-blue-600 transition-colors" onClick={onBack}>
            Daftar Pembelian
          </span>
          <span>/</span>
          <span className="font-bold text-slate-800">Open Purchase Detail</span>
        </div>
      </div>

      {/* Banner status warna merah/hijau (Minimalis) */}
      {isRetur ? (
        <div className="flex items-center px-5 py-3 rounded-xl text-white shadow-2xs bg-indigo-600">
          <div className="flex items-center gap-2 font-bold text-xs">
            <RotateCcw size={14} />
            <span>Retur Pembelian{doc.retur_ref_nomor ? ` — Ref: ${doc.retur_ref_nomor}` : ''}</span>
          </div>
        </div>
      ) : isCancelled ? (
        <div className="flex items-center justify-between px-5 py-3 rounded-xl text-white shadow-2xs bg-rose-600">
          <div className="flex items-center gap-2 font-bold text-xs">
            <span>❌ Pembelian Dibatalkan</span>
          </div>
          <span className="text-[11px] font-semibold opacity-90">Dokumen read-only</span>
        </div>
      ) : (
        <div className={`flex items-center justify-between px-5 py-3 rounded-xl text-white shadow-2xs transition-colors duration-300 ${
          isLunas ? 'bg-emerald-600' : doc.payment_status === 'sebagian' ? 'bg-amber-500' : 'bg-rose-600'
        }`}>
          <div className="flex items-center gap-2 font-bold text-xs">
            <span>{isLunas ? '✔️ Sudah Dibayar' : doc.payment_status === 'sebagian' ? '◐ Bayar Sebagian' : '❌ Belum Dibayar'}</span>
          </div>

          {/* Toggle Switch di sebelah kanan (posisi bekas nominal) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={togglingPayment}
              onClick={() => {
                if (!canTogglePayment) {
                  alert('Toggle pembayaran aktif setelah produk dan informasi penerimaan terisi.');
                  return;
                }
                handleTogglePayment();
              }}
              title={!canTogglePayment ? 'Toggle aktif setelah produk & info penerimaan terisi' : 'Ubah status pembayaran'}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none border border-white/30 ${
                isLunas ? 'bg-emerald-500' : 'bg-rose-500'
              } ${!canTogglePayment ? 'opacity-50 cursor-pointer' : 'cursor-pointer hover:opacity-90'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 shadow-xs ${
                  isLunas ? 'translate-x-4.5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Header Utama Dokumen */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer transition-colors"
            title="Kembali"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-2xs">
            <ShoppingBag size={20} />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-800 font-mono block leading-none mb-1">{doc.nomor}</span>
            <span className="text-[10px] text-slate-400 block font-semibold">
              {isRetur ? 'Retur' : 'Pembelian'} Oleh {doc.dibuat_oleh_nama || 'Tidak diketahui'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Aksi utama sesuai jenis dokumen */}
          {isRetur && isDraft && (
            <button
              type="button"
              onClick={handlePostRetur}
              className="text-xs font-bold bg-indigo-600 text-white rounded-lg px-3 py-2 hover:bg-indigo-700 cursor-pointer shadow-sm"
            >
              Post Sekarang
            </button>
          )}
          {/* Tombol Cetak */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 text-xs font-bold bg-white text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
          >
            <Printer size={14} className="text-slate-500" /> Cetak
          </button>

          {/* Dropdown Status Pembelian */}
          <select
            value={getDropdownStatusValue()}
            onChange={(e) => handleStatusSelect(e.target.value)}
            disabled={!isDraft && doc.status !== 'selesai'}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none cursor-pointer hover:bg-slate-50"
          >
            <option value="Tunda">Tunda</option>
            <option value="Terkirim">Terkirim</option>
            <option value="Dikirim">Dikirim</option>
            <option value="Diterima">Diterima</option>
            <option value="Selesai">Selesai</option>
            <option value="Batal">Batal</option>
          </select>

          {/* Date Picker (Kalender) */}
          <input
            type="date"
            disabled={!isDraft}
            value={doc.tanggal ? doc.tanggal.substring(0, 10) : ''}
            onChange={(e) => handleDateChange(e.target.value)}
            className={`text-xs font-mono font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none ${
              isDraft ? 'cursor-pointer hover:bg-slate-50' : 'cursor-not-allowed text-slate-400 bg-slate-50'
            }`}
          />
        </div>
      </div>

      {/* Grid Info */}
      <PembelianInfoCards doc={doc} isDraft={isDraft} isRetur={isRetur} onSaved={fetchDetail} />

      {/* Produk Pesanan */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-2.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">Produk {isRetur ? 'Diretur' : 'Pesanan'}</span>
          </div>
          {isDraft && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
              >
                <Plus size={12} /> Produk
              </button>
            </div>
          )}
        </div>

        {/* Tabel Items + Ringkasan (Presisi SS No. 1 Olsera) */}
        <PembelianItemsTable
          items={doc.items}
          diskonAmount={diskonAmount}
          pajakAmount={pajakAmount}
          pengirimanAmount={pengirimanAmount}
          jumlahTerbayar={jumlahTerbayar}
          payments={doc.payments || []}
          onOpenDiskon={() => setShowDiskonModal(true)}
          onOpenPajak={() => setShowPajakModal(true)}
          onOpenPengiriman={() => setShowPengirimanModal(true)}
          onOpenPembayaran={() => setIsPayOpen(true)}
          onRemovePayment={handleRemovePayment}
          removingPaymentId={removingPaymentId}
        />
      </div>

      {/* File lampiran tetap berada sebelum riwayat aktivitas pembelian. */}
      <PurchaseAttachmentCard
        attachments={doc.attachments || []}
        canUpload={!isCancelled}
        onUpload={handleUploadAttachment}
      />

      {/* Log Workflow */}
      <PurchaseWorkflowLog doc={doc} logs={logs} />

      <TambahProdukModal
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        onAdd={handleAddProduct}
      />

      {isPayOpen && (
        <PembelianPembayaranModal
          sisa={sisa}
          onClose={() => setIsPayOpen(false)}
          onSave={handleAddPayment}
        />
      )}

      {/* Pop-up Modals Presisi SS No 2, 3, 4 */}
      {showDiskonModal && (
        <PembelianDiskonModal
          currentVal={diskonVal}
          currentType={diskonType}
          onClose={() => setShowDiskonModal(false)}
          onSave={({ val, type }) => {
            setDiskonVal(val);
            setDiskonType(type);
          }}
        />
      )}

      {showPajakModal && (
        <PembelianPajakModal
          currentVal={pajakVal}
          currentType={pajakType}
          onClose={() => setShowPajakModal(false)}
          onSave={({ val, type }) => {
            setPajakVal(val);
            setPajakType(type);
          }}
        />
      )}

      {showPengirimanModal && (
        <PembelianPengirimanModal
          currentVal={pengirimanVal}
          onClose={() => setShowPengirimanModal(false)}
          onSave={(val) => setPengirimanVal(val)}
        />
      )}
    </div>
  );
}
