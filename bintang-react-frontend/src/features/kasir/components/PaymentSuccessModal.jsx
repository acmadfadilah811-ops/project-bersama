import React, { useState } from 'react';
import { CheckCircle2, X, Send, Printer, FileText, Plus, ChevronDown } from 'lucide-react';
import ReceiptEmailField from './ReceiptEmailField';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifyError, notifySuccess } from '../../../utils/notify';

export default function PaymentSuccessModal({
  isOpen,
  onClose,
  transactionData,
  onNewOrder,
}) {
  const [waResi, setWaResi] = useState('');
  const [sendingWa, setSendingWa] = useState(false);
  const [showCustomPrintDropdown, setShowCustomPrintDropdown] = useState(false);

  React.useEffect(() => {
    if (isOpen && transactionData) {
      setWaResi(transactionData.customerPhone || '');
      setShowCustomPrintDropdown(false);
    }
  }, [isOpen, transactionData]);

  if (!isOpen) return null;

  const refCode = transactionData?.refCode || `32FB${Date.now().toString().slice(-12)}`;
  const customerName = transactionData?.customerName || 'Dika';
  const totalAmount = transactionData?.totalAmount || 50000;
  const changeAmount = transactionData?.changeAmount || 0;

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

  const handleKirimSpk = () => {
    alert(`SPK (Surat Perintah Kerja) untuk transaksi ${refCode} berhasil dikirim ke Tim Produksi & WhatsApp.`);
  };

  const handlePrintReceipt = () => {
    alert(`Mencetak Resi/Struk POS untuk transaksi: ${refCode}`);
  };

  const handleCustomPrint = (type) => {
    setShowCustomPrintDropdown(false);
    alert(`Mencetak dokumen ${type} untuk transaksi: ${refCode}`);
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

        {/* Total Pembayaran & Kembalian SS */}
        <div className="flex items-center gap-12 text-center mb-6">
          <div>
            <span className="text-xs font-medium text-white/70 block mb-0.5">Total Pembayaran</span>
            <span className="text-2xl font-black text-white">
              {Math.round(totalAmount).toLocaleString('id-ID')}
            </span>
          </div>
          <div>
            <span className="text-xs font-medium text-white/70 block mb-0.5">Kembalian</span>
            <span className="text-2xl font-black text-white">
              {Math.round(changeAmount).toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Send Inputs: Email & WhatsApp Resi SS */}
        <div className="w-full max-w-md space-y-3 mb-8">
          <ReceiptEmailField saleId={transactionData?.id} initialEmail={transactionData?.customerEmail} />

          {/* SMS / WhatsApp Resi Input */}
          <div>
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
          </div>
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
            <span>Cetak Resi</span>
          </button>

          {/* Kirim SPK (New Requested Button - Teal/Purple) */}
          <button
            type="button"
            onClick={handleKirimSpk}
            className="px-4 py-3 rounded-lg bg-[#00A896] hover:bg-teal-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all cursor-pointer"
          >
            <Send size={16} />
            <span>Kirim SPK</span>
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
    </div>
  );
}
