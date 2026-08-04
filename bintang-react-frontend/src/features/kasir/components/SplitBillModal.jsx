import { useState, useEffect } from 'react';
import { X, CreditCard, Check, Factory, Printer } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import ReceiptPrint from './ReceiptPrint';
import SpkPublishModal from './SpkPublishModal';
import SplitBillPayment from './SplitBillPayment';
import SplitBillSelection from './SplitBillSelection';
import useSplitBillPricing from '../hooks/useSplitBillPricing';
import { notifyError, notifySuccess } from '../../../utils/notify';
import { getPrintErrorMessage, printReceipt } from '../../printing/services/printService';

export default function SplitBillModal({
  isOpen,
  onClose,
  cart,
  selectedContact,
  discountPercent,
  taxPercent,
  cartNotes,
  selectedCoupon,
  metodeDiskon,
  selectedRedemption,
  selectedPelayanId,
  onSplitSuccess,
  settings,
}) {
  const [step, setStep] = useState(1); // 1: Select items, 2: Payment, 3: Success
  const [billA, setBillA] = useState([]);
  const [billB, setBillB] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [isSpkModalOpen, setIsSpkModalOpen] = useState(false);

  // FE-12: inisialisasi hanya saat modal DIBUKA. Sebelumnya efek ini juga
  // bergantung pada `cart`; ketika pembayaran split memicu penghapusan item
  // dari cart, `cart` berubah -> efek jalan lagi -> layar sukses (step 3)
  // langsung ter-reset ke step 1. Penghapusan cart kini ditunda sampai selesai.
  useEffect(() => {
    if (isOpen) {
      // Clone original cart items
      setBillA(cart.map((item) => {
        const qty = Number(item.qty) || 1;
        const total = item.hargaTotal != null
          ? Number(item.hargaTotal)
          : Number(item.harga) * qty;
        return {
          ...item,
          // Nilai ini tetap per unit meski qty dipindahkan antar Bill A/B.
          splitUnitPrice: item.isCustomPriced ? total / qty : Number(item.harga),
        };
      }));
      setBillB([]);
      setStep(1);
      setLastReceipt(null);
      setIsSpkModalOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const {
    getUnitPrice,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
    isCheckingAutoDiscount,
  } = useSplitBillPricing({
    billItems: billB,
    discountPercent,
    taxPercent,
    selectedContact,
    selectedCoupon,
    metodeDiskon,
    selectedRedemption,
  });

  if (!isOpen) return null;

  // Helper currency formatter
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // Move items from A to B
  const moveToB = (itemKey, qtyToMove = 1) => {
    const target = billA.find((x) => x.key === itemKey);
    if (!target || target.qty < qtyToMove) return;

    // Update billA
    if (target.qty === qtyToMove) {
      setBillA((prev) => prev.filter((x) => x.key !== itemKey));
    } else {
      setBillA((prev) =>
        prev.map((x) => (x.key === itemKey ? { ...x, qty: x.qty - qtyToMove } : x))
      );
    }

    // Update billB
    setBillB((prev) => {
      const existing = prev.find((x) => x.key === itemKey);
      if (existing) {
        return prev.map((x) =>
          x.key === itemKey ? { ...x, qty: x.qty + qtyToMove } : x
        );
      } else {
        return [...prev, { ...target, qty: qtyToMove }];
      }
    });
  };

  // Move items from B to A
  const moveToA = (itemKey, qtyToMove = 1) => {
    const target = billB.find((x) => x.key === itemKey);
    if (!target || target.qty < qtyToMove) return;

    // Update billB
    if (target.qty === qtyToMove) {
      setBillB((prev) => prev.filter((x) => x.key !== itemKey));
    } else {
      setBillB((prev) =>
        prev.map((x) => (x.key === itemKey ? { ...x, qty: x.qty - qtyToMove } : x))
      );
    }

    // Update billA
    setBillA((prev) => {
      const existing = prev.find((x) => x.key === itemKey);
      if (existing) {
        return prev.map((x) =>
          x.key === itemKey ? { ...x, qty: x.qty + qtyToMove } : x
        );
      } else {
        return [...prev, { ...target, qty: qtyToMove }];
      }
    });
  };

  const handleNextToPayment = () => {
    if (billB.length === 0) return;
    setStep(2);
  };

  const submitSplitTransaction = async (payMethod, paidAmount) => {
    const totalVal = getTotal(billB);
    if (paidAmount < totalVal) {
      alert('Jumlah pembayaran belum mencukupi total tagihan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        // PK Contact adalah nomor_wa.
        pelanggan: selectedContact ? selectedContact.nomor_wa : null,
        subtotal: getSubtotal(billB),
        diskon: getDiscountAmount(billB),
        diskon_persen: Number(discountPercent || 0),
        pajak: getTaxAmount(billB),
        pajak_persen: Number(taxPercent || 0),
        total: totalVal,
        metode_bayar: payMethod,
        dibayar: paidAmount,
        kembalian: paidAmount - totalVal,
        catatan: cartNotes ? `[Split Bill] ${cartNotes}` : '[Split Bill]',
        status: 'paid',
        dilayani_oleh_id: selectedPelayanId || null,
        metode_diskon: metodeDiskon,
        kupon_kode: metodeDiskon === 'kupon' ? selectedCoupon?.kode : undefined,
        loyalty_redemption_id: selectedRedemption?.id || undefined,
        items: billB.map((item) => ({
          // Harga hasil meteran/finishing/diskon harus menjadi item kustom.
          // Bila product_id tetap dikirim, backend mengganti harganya dengan
          // harga katalog dan menolak total Split Bill sebagai tidak cocok.
          product_id: item.isCustomPriced ? null : item.product?.id || null,
          variant_id: item.variant ? item.variant.id : null,
          nama: item.nama,
          harga: getUnitPrice(item),
          qty: item.qty,
          catatan: item.catatan,
          uom_kode: item.uomKode || null,
        })),
      };

      const res = await apiClient.post('/pos/sales/', payload);
      setLastReceipt(res.data);
      // Item billB dihapus dari cart saat user menekan Selesai (handleFinish).
      setStep(3);
    } catch (err) {
      console.error('Error split payment:', err);
      alert('Gagal memproses pembayaran split: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    // FE-12: sekarang baru kurangi qty billB dari cart utama, setelah alur
    // split selesai sepenuhnya, lalu tutup modal.
    onSplitSuccess(billB);
    onClose();
  };

  const handleTerbitkanSpk = async (payload) => {
    const response = await apiClient.post(
      `/pos/sales/${lastReceipt.id}/terbitkan-spk/`,
      payload,
    );
    notifySuccess('SPK diterbitkan', response.data?.message || 'SPK berhasil dikirim ke antrean produksi.');
    setIsSpkModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-100 max-w-4xl w-full p-6 relative flex flex-col shadow-2xl h-[85vh] max-h-[700px] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-150 shrink-0">
          <div>
            <h5 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <CreditCard size={18} className="text-indigo-600" />
              <span>Split Bill (Pisah Pembayaran)</span>
            </h5>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              {step === 1 && 'Pindahkan item yang ingin dibayar terlebih dahulu ke Bill B.'}
              {step === 2 && 'Selesaikan pembayaran untuk Bill B.'}
              {step === 3 && 'Pembayaran Bill B berhasil! Silakan cetak struk.'}
            </p>
          </div>
          {step !== 3 && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content body */}
        <div className="flex-1 min-h-0 overflow-y-auto py-4">
          
          {/* STEP 1: Select Items */}
          {step === 1 && (
            <SplitBillSelection
              billA={billA}
              billB={billB}
              moveToB={moveToB}
              moveToA={moveToA}
              formatCurrency={formatCurrency}
              getTotal={getTotal}
              getUnitPrice={getUnitPrice}
            />
          )}

          {/* STEP 2: Payment for Bill B */}
          {step === 2 && (
            <SplitBillPayment
              billB={billB}
              discountPercent={discountPercent}
              taxPercent={taxPercent}
              isSubmitting={isSubmitting}
              isCheckingAutoDiscount={isCheckingAutoDiscount}
              onBack={() => setStep(1)}
              onSubmit={submitSplitTransaction}
              formatCurrency={formatCurrency}
              getSubtotal={getSubtotal}
              getDiscountAmount={getDiscountAmount}
              getTaxAmount={getTaxAmount}
              getTotal={getTotal}
              getUnitPrice={getUnitPrice}
            />
          )}

          {/* STEP 3: Success Screen */}
          {step === 3 && lastReceipt && (
            <div className="flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
              <div className="bg-emerald-100 p-3 rounded-full text-emerald-600 mb-3 animate-bounce">
                <Check size={28} />
              </div>
              <h5 className="font-extrabold text-slate-800 text-base">Pembayaran Berhasil!</h5>
              <p className="text-xs text-slate-400 font-semibold mb-6">
                Transaksi <span className="font-bold text-slate-700">{lastReceipt.nomor}</span> untuk Bill B telah selesai diproses.
              </p>

              {/* Miniature Receipt View */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs font-semibold text-slate-600 space-y-2 mb-6">
                <div className="flex justify-between font-bold text-slate-700 border-b border-slate-200 pb-2">
                  <span>Nomor Nota:</span>
                  <span>{lastReceipt.nomor}</span>
                </div>
                <div className="space-y-1 py-1">
                  {lastReceipt.items?.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.nama_snapshot} x {item.qty}</span>
                      <span>{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-800">
                  <span>Total Dibayar:</span>
                  <span className="text-indigo-600">{formatCurrency(lastReceipt.total)}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer buttons */}
        <div className="pt-3 border-t border-slate-150 flex justify-end gap-2 shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleNextToPayment}
                disabled={billB.length === 0}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Lanjut ke Pembayaran
              </button>
            </>
          )}



          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => setIsSpkModalOpen(true)}
                className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Factory size={14} />
                <span>Kirim SPK</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    await printReceipt({ receipt: lastReceipt, businessSettings: settings });
                  } catch (error) {
                    notifyError('Cetak struk gagal', getPrintErrorMessage(error));
                  }
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-250 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Cetak Struk</span>
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
              >
                Selesai (Ubah Keranjang Utama)
              </button>
            </>
          )}
        </div>

      </div>
      <ReceiptPrint receipt={lastReceipt} settings={settings} />
      {isSpkModalOpen && lastReceipt && (
        <SpkPublishModal
          judul={`Terbitkan SPK — ${lastReceipt.nomor}`}
          keterangan="Pilih divisi dan tahap agar Bill B langsung masuk ke antrean pengerjaan produksi."
          onClose={() => setIsSpkModalOpen(false)}
          onTerbitkan={handleTerbitkanSpk}
        />
      )}
    </div>
  );
}
