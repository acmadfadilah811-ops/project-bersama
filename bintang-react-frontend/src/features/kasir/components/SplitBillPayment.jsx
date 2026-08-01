import { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import NumericInput from '../../../components/NumericInput';

export default function SplitBillPayment({
  billB,
  discountPercent,
  taxPercent,
  isSubmitting,
  isCheckingAutoDiscount,
  onBack,
  onSubmit,
  formatCurrency,
  getSubtotal,
  getDiscountAmount,
  getTaxAmount,
  getTotal,
  getUnitPrice,
}) {
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState(() => getTotal(billB));

  useEffect(() => {
    setAmountPaid(getTotal(billB));
  }, [billB]);

  const handleQuickCash = (amt) => {
    setAmountPaid(amt);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    onSubmit(paymentMethod, Number(amountPaid || 0));
  };

  const totalVal = getTotal(billB);
  const paidVal = Number(amountPaid || 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right duration-200">
      {/* Bill B Summary */}
      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 flex flex-col justify-between">
        <div>
          <h6 className="font-extrabold text-slate-700 text-xs mb-3">Rincian Item Bill B</h6>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-4 text-xs font-semibold text-slate-650">
            {billB.map((item) => (
              <div key={item.key} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                <div>
                  <p className="text-slate-800 font-bold truncate max-w-[200px]">{item.nama}</p>
                  <span className="text-[10px] text-slate-400">{item.qty} x {formatCurrency(getUnitPrice(item))}</span>
                </div>
                <span className="font-extrabold text-slate-900">{formatCurrency(getUnitPrice(item) * item.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 text-xs border-t border-slate-200 pt-3">
          <div className="flex justify-between font-semibold text-slate-500">
            <span>Subtotal:</span>
            <span>{formatCurrency(getSubtotal(billB))}</span>
          </div>
          {discountPercent > 0 && (
            <div className="flex justify-between text-rose-500 font-semibold">
              <span>Diskon ({discountPercent}%):</span>
              <span>-{formatCurrency(getDiscountAmount(billB))}</span>
            </div>
          )}
          {taxPercent > 0 && (
            <div className="flex justify-between text-slate-500 font-semibold">
              <span>Pajak ({taxPercent}%):</span>
              <span>{formatCurrency(getTaxAmount(billB))}</span>
            </div>
          )}
          <div className="h-px bg-slate-200 my-1" />
          <div className="flex justify-between font-black text-sm text-slate-900">
            <span>Total Bill B:</span>
            <span className="text-indigo-650">{formatCurrency(totalVal)}</span>
          </div>
        </div>
      </div>

      {/* Payment Processing Form */}
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-extrabold text-slate-650 block mb-1">Metode Pembayaran</label>
          <div className="grid grid-cols-2 gap-2">
            {['Cash', 'Transfer', 'Debit', 'QRIS'].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPaymentMethod(m)}
                className={`py-2 text-xs font-extrabold rounded-lg border transition-all cursor-pointer ${
                  paymentMethod === m
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-extrabold text-slate-600 block mb-1">Jumlah Bayar (Rp.)</label>
          <NumericInput
            value={amountPaid}
            onChange={(val) => setAmountPaid(val)}
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right"
          />
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 block mb-1.5">Pintasan Uang Cash</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickCash(totalVal)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
            >
              Uang Pas
            </button>
            {[10000, 20000, 50000, 100000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickCash(val)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg cursor-pointer"
              >
                {formatCurrency(val)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center">
          <span className="text-xs font-extrabold text-emerald-800">Kembalian:</span>
          <span className="text-base font-black text-emerald-600">
            {formatCurrency(Math.max(0, paidVal - totalVal))}
          </span>
        </div>

        {/* Action Buttons inside Form context */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onBack}
            className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-650 font-bold text-xs rounded-xl transition-all cursor-pointer"
          >
            Kembali ke Item
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isCheckingAutoDiscount || paidVal < totalVal}
            className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting || isCheckingAutoDiscount ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
            ) : (
              <>
                <CreditCard size={14} />
                <span>Bayar Sekarang</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
