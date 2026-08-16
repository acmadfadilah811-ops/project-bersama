import React, { useRef, useState } from 'react';
import { CheckCircle2, X, Send, Printer, FileText, Plus, ChevronDown } from 'lucide-react';
import ReceiptEmailField from './ReceiptEmailField';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifyError, notifySuccess } from '../../../utils/notify';
import { useAuth } from '../../../context/AuthContext';
import ReceiptPrint from './ReceiptPrint';
import {
  getPrintErrorMessage,
  printReceipt,
  printReceiptAfterRender,
  shouldAutoPrintPosReceipt,
} from '../../printing/services/printService';

const toReceipt = (transactionData) => {
  if (!transactionData) return null;
  const total = Number(transactionData.total ?? transactionData.totalAmount ?? 0);
  const fallbackDiscount = [
    transactionData.diskon,
    transactionData.diskon_manual,
    transactionData.diskon_kupon,
    transactionData.diskon_promo,
    transactionData.diskon_penjualan,
    transactionData.diskon_otomatis,
    transactionData.diskon_loyalti,
  ].reduce((sum, value) => sum + Number(value || 0), 0);
  return {
    ...transactionData,
    nomor: transactionData.nomor || transactionData.refCode || '-',
    pelanggan_name: transactionData.pelanggan_name || transactionData.customerName || 'Pelanggan umum',
    subtotal: transactionData.subtotal ?? total,
    diskon: Number(transactionData.diskon_total ?? fallbackDiscount),
    total: transactionData.total ?? total,
    dibayar: transactionData.dibayar ?? transactionData.payAmount ?? total,
    kembalian: transactionData.kembalian ?? transactionData.changeAmount ?? 0,
  };
};

export default function PaymentSuccessModal({
  isOpen,
  onClose,
  transactionData,
  onNewOrder,
}) {
  const { businessSettings } = useAuth();
  const [waResi, setWaResi] = useState('');
  const [sendingWa, setSendingWa] = useState(false);
  const [showCustomPrintDropdown, setShowCustomPrintDropdown] = useState(false);
  const autoPrintedSaleId = useRef(null);
  const receipt = React.useMemo(() => toReceipt(transactionData), [transactionData]);

  React.useEffect(() => {
    if (isOpen && transactionData) {
      setWaResi(transactionData.customerPhone || '');
      setShowCustomPrintDropdown(false);
    }
  }, [isOpen, transactionData]);

  React.useEffect(() => {
    if (!isOpen || transactionData?.isOrderReceipt || !transactionData?.id || !shouldAutoPrintPosReceipt(businessSettings)) return;
    if (autoPrintedSaleId.current === transactionData.id) return;
    autoPrintedSaleId.current = transactionData.id;
    void printReceiptAfterRender({ receipt, businessSettings }).catch((error) => {
      notifyError('Cetak resi otomatis gagal', getPrintErrorMessage(error));
    });
  }, [businessSettings, isOpen, receipt, transactionData]);

  if (!isOpen) return null;

  const refCode = transactionData?.nomor || transactionData?.refCode || '-';
  const customerName = receipt?.pelanggan_name || 'Pelanggan umum';
  const totalAmount = Number(transactionData?.total ?? transactionData?.totalAmount ?? 0);
  const changeAmount = Number(transactionData?.kembalian ?? transactionData?.changeAmount ?? 0);
  const isOrderReceipt = Boolean(transactionData?.isOrderReceipt);
  // Untuk order DP, "dibayar" adalah nominal DP yang benar-benar diterima —
  // beda dari totalAmount (nilai order penuh). Sisa tagihan dipakai supaya
  // kasir & pelanggan langsung tahu berapa yang belum dilunasi.
  const paidAmount = Number(transactionData?.dibayar ?? transactionData?.payAmount ?? totalAmount);
  const sisaTagihan = Number(transactionData?.sisa_tagihan ?? 0);

  const handleSendWa = async () => {
    if (!transactionData?.id) {
      notifyError('Resi belum siap', 'Transaksi belum memiliki ID untuk pengiriman resi.');
      return;
    }
    if (!waResi.trim()) {
      notifyError('Nomor diperlukan', 'Masukkan nomor WhatsApp penerima resi.');
      return;
    }

    setSendingWa(true);
    try {
      const response = await apiClient.post(`/pos/sales/${transactionData.id}/whatsapp-resi/`, {
        number: waResi.trim(),
      });
      notifySuccess('Resi terkirim', response.data?.message || 'Resi berhasil dikirim ke WhatsApp.');
    } catch (error) {
      notifyApiError(error, 'Gagal mengirim resi via WhatsApp.');
    } finally {
      setSendingWa(false);
    }
  };

  const handlePrintReceipt = async () => {
    try {
      const result = await printReceipt({ receipt, businessSettings });
      if (result.channel === 'qz') {
        notifySuccess('Resi dikirim', 'Resi sudah dikirim ke antrean printer QZ Tray.');
      }
    } catch (error) {
      notifyError('Cetak resi gagal', getPrintErrorMessage(error));
    }
  };

  const handleCustomPrint = (type) => {
    setShowCustomPrintDropdown(false);
    notifyError('Dokumen belum tersedia', `Template cetak ${type} belum tersedia untuk transaksi POS ini. Gunakan Cetak Resi.`);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0A2540]/90 backdrop-blur-md animate-fade-in text-white">
      <div className="w-full max-w-xl flex flex-col items-center relative py-6">
        
        {/* Close Button X Top Right SS */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-0 right-0 text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer"
        >
          <X size={24} />
        </button>

        {/* Big Green Checkmark Icon SS */}
        <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-500/10 animate-bounce-short">
          <CheckCircle2 size={64} className="stroke-[2.5]" />
        </div>

        {/* Transaction Reference Code SS */}
        <h2 className="text-xl font-extrabold tracking-wider text-white mb-1">
          {refCode}
        </h2>

        {/* Customer Name Addition */}
        <div className="text-xs font-bold text-blue-300 bg-blue-900/60 px-3 py-1 rounded-full mb-4 border border-blue-400/30">
          Pelanggan: <span className="text-white">{customerName}</span>
        </div>

        {/* Total Pembayaran & Kembalian/Sisa Tagihan SS */}
        <div className="flex items-center gap-12 text-center mb-6">
          <div>
            <span className="text-xs font-medium text-white/70 block mb-0.5">
              {isOrderReceipt ? 'DP Dibayar' : 'Total Pembayaran'}
            </span>
            <span className="text-2xl font-black text-white">
              {Math.round(isOrderReceipt ? paidAmount : totalAmount).toLocaleString('id-ID')}
            </span>
          </div>
          <div>
            <span className="text-xs font-medium text-white/70 block mb-0.5">
              {isOrderReceipt ? 'Sisa Tagihan' : 'Kembalian'}
            </span>
            <span className={`text-2xl font-black ${isOrderReceipt && sisaTagihan > 0 ? 'text-rose-400' : 'text-white'}`}>
              {isOrderReceipt
                ? (sisaTagihan > 0 ? Math.round(sisaTagihan).toLocaleString('id-ID') : 'LUNAS')
                : Math.round(changeAmount).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Send Inputs: Email & WhatsApp Resi SS */}
        <div className="w-full max-w-md space-y-3 mb-8">
          {!isOrderReceipt && <ReceiptEmailField saleId={transactionData?.id} initialEmail={transactionData?.customerEmail} />}

          {isOrderReceipt && (
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              Invoice DP dijadwalkan otomatis ke WhatsApp pelanggan setelah transaksi tersimpan.
            </div>
          )}

          {/* SMS / WhatsApp Resi Input */}
          {!isOrderReceipt && <div>
            <label className="text-[10px] font-medium text-white/60 block mb-0.5">SMS/WhatsApp Resi</label>
            <div className="flex items-center border-b border-white/30 pb-1">
              <input
                type="text"
                value={waResi}
                onChange={(e) => setWaResi(e.target.value)}
                className="w-full text-xs font-semibold text-white bg-transparent focus:outline-none placeholder:text-white/40"
                placeholder="+6281234567890"
              />
              <button
                type="button"
                onClick={handleSendWa}
                disabled={sendingWa}
                className="w-8 h-8 rounded-full bg-[#0088FF] hover:bg-blue-600 text-white flex items-center justify-center ml-2 transition-all shadow-md cursor-pointer shrink-0 disabled:opacity-50"
                title="Kirim Resi via WhatsApp"
              >
                <Send size={15} />
              </button>
            </div>
          </div>}
        </div>

        {/* Action Buttons Row SS */}
        <div className="w-full flex items-center justify-center gap-3 relative">
          
          {/* Cetak Custom (Orange Button with Clean Dropdown Menu) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCustomPrintDropdown(!showCustomPrintDropdown)}
              className="px-4 py-3 rounded-lg bg-[#FF9800] hover:bg-amber-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Printer size={16} />
              <span>Cetak Custom</span>
              <ChevronDown size={14} />
            </button>

            {/* Clean Dropdown Menu (No Emojis) */}
            {showCustomPrintDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50 text-slate-800 text-xs font-bold animate-fade-in">
                <button
                  type="button"
                  onClick={() => handleCustomPrint('Invoice')}
                  className="w-full px-4 py-2.5 hover:bg-slate-100 text-left flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                >
                  <FileText size={15} className="text-blue-600" />
                  <span>Invoice</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomPrint('SPK (Surat Perintah Kerja)')}
                  className="w-full px-4 py-2.5 hover:bg-slate-100 text-left flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                >
                  <FileText size={15} className="text-indigo-600" />
                  <span>SPK (Surat Perintah Kerja)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCustomPrint('Delivery Order (Surat Jalan)')}
                  className="w-full px-4 py-2.5 hover:bg-slate-100 text-left flex items-center gap-2 cursor-pointer"
                >
                  <FileText size={15} className="text-teal-600" />
                  <span>Delivery Order (Surat Jalan)</span>
                </button>
              </div>
            )}
          </div>

          {/* Cetak Resi (Blue Button) SS */}
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="px-4 py-3 rounded-lg bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>{isOrderReceipt ? 'Cetak Invoice' : 'Cetak Resi'}</span>
          </button>

          <button
            type="button"
            disabled
            title="SPK sudah diterbitkan ke antrean divisi saat transaksi disimpan."
            className="px-4 py-3 rounded-lg bg-teal-700/80 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 cursor-default"
          >
            <CheckCircle2 size={16} />
            <span>SPK Diterbitkan</span>
          </button>

          {/* + Baru (Green Button) SS */}
          <button
            type="button"
            onClick={onNewOrder}
            className="px-5 py-3 rounded-lg bg-[#4CAF50] hover:bg-emerald-600 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus size={18} />
            <span>Baru</span>
          </button>
        </div>

      </div>
      <ReceiptPrint receipt={receipt} settings={businessSettings} />
    </div>
  );
}
