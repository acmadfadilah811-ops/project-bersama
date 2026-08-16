import React, { useState, useEffect } from 'react';
import { Banknote, QrCode, CreditCard, Wallet, X, CheckCircle2 } from 'lucide-react';
import { todayISO } from '../../../utils/date';

export default function PaymentProcessModal({
  isOpen,
  onClose,
  totalAmount = 0,
  subtotalAmount = 0,
  discountAmount = 0,
  onConfirmPayment,
}) {
  const [selectedMethod, setSelectedMethod] = useState('CASH');
  const [paymentType, setPaymentType] = useState('lunas');
  const [payAmountStr, setPayAmountStr] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPayAmountStr(String(Math.round(totalAmount)));
      setSelectedMethod('CASH');
      setPaymentType('lunas');
      setDueDate('');
    }
  }, [isOpen, totalAmount]);

  if (!isOpen) return null;

  const currentPayAmount = parseFloat(payAmountStr) || 0;
  const changeAmount = Math.max(0, currentPayAmount - totalAmount);

  // Quick amount chips calculation based on totalAmount
  const generateQuickChips = () => {
    const total = Math.round(totalAmount);
    const chips = [total];
    
    // Nearest roundups
    const next10k = Math.ceil((total + 1) / 10000) * 10000;
    if (next10k > total && !chips.includes(next10k)) chips.push(next10k);

    const next50k = Math.ceil((total + 1) / 50000) * 50000;
    if (next50k > total && !chips.includes(next50k)) chips.push(next50k);

    const next100k = Math.ceil((total + 1) / 100000) * 100000;
    if (next100k > total && !chips.includes(next100k)) chips.push(next100k);

    return chips.slice(0, 3);
  };

  const quickChips = generateQuickChips();

  // Numpad key handlers
  const handleNumpadClick = (val) => {
    if (val === 'C') {
      setPayAmountStr('0');
    } else if (val === '00') {
      if (payAmountStr === '0' || !payAmountStr) return;
      setPayAmountStr((prev) => prev + '00');
    } else {
      if (payAmountStr === '0') {
        setPayAmountStr(val);
      } else {
        setPayAmountStr((prev) => prev + val);
      }
    }
  };

  const handlePaySubmit = () => {
    if (paymentType === 'lunas' && currentPayAmount < totalAmount) {
      alert(`Nominal pembayaran (Rp ${currentPayAmount.toLocaleString('id-ID')}) kurang dari total tagihan (Rp ${totalAmount.toLocaleString('id-ID')}).`);
      return;
    }
    if (paymentType === 'dp' && (currentPayAmount <= 0 || currentPayAmount >= totalAmount)) {
      alert('Nominal DP harus lebih dari Rp0 dan lebih kecil dari total tagihan. Untuk pembayaran penuh, pilih Lunas.');
      return;
    }
    if (paymentType === 'dp' && !dueDate) {
      alert('Jatuh tempo wajib diisi untuk transaksi DP/Uang Muka.');
      return;
    }
    onConfirmPayment({
      method: selectedMethod,
      paymentType,
      payAmount: currentPayAmount,
      changeAmount,
      dueDate: paymentType === 'dp' ? dueDate : null,
    });
  };

  const paymentMethods = [
    { id: 'CASH', label: 'CASH', icon: <Banknote size={20} />, active: true },
    { id: 'QRIS_NETZME', label: 'QRIS Tap by Netzme', icon: <QrCode size={20} />, active: true },
    { id: 'QRIS_BCA', label: 'QRIS by BCA', icon: <QrCode size={20} />, active: true },
    { id: 'QRIS_NETZME_WAITING', label: 'QRIS by Netzme (Belum Aktif)', icon: <QrCode size={20} />, active: false },
    { id: 'QRIS_NETZME_WAITING2', label: 'QRIS by Netzme (Belum Aktif)', icon: <QrCode size={20} />, active: false },
    { id: 'OVO_WAITING', label: 'OVO (Belum Aktif)', icon: <Wallet size={20} />, active: false },
    { id: 'TRANSFER_BANK', label: 'Transfer Bank / EDC', icon: <CreditCard size={20} />, active: true },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] max-h-[650px] overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        
        {/* Main Content Split (Left Methods, Right Numpad) */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          
          {/* LEFT PANEL: Pilih Cara Pembayaran (SS Acuan) */}
          <div className="w-80 md:w-96 bg-[#004B87] flex flex-col shrink-0 border-r border-slate-300">
            {/* Header Navy SS */}
            <div className="bg-[#002D54] px-5 py-3.5 text-white font-extrabold text-sm tracking-wide shadow-sm flex items-center justify-between shrink-0">
              <span>Pilih Cara Pembayaran</span>
            </div>

            {/* List of Payment Methods */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => { setPaymentType('lunas'); setPayAmountStr(String(Math.round(totalAmount))); }}
                  className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition-all ${paymentType === 'lunas' ? 'bg-emerald-500 text-white border-emerald-300' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
                >
                  Bayar Lunas
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentType('dp'); setPayAmountStr(''); }}
                  className={`rounded-lg px-2.5 py-2 text-xs font-extrabold border transition-all ${paymentType === 'dp' ? 'bg-amber-400 text-slate-900 border-amber-200' : 'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
                >
                  DP / Uang Muka
                </button>
              </div>
              {paymentType === 'dp' && (
                <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-[11px] font-semibold text-amber-950">
                  <p className="leading-relaxed">DP langsung menerbitkan SPK ke antrean divisi setelah tujuan dan deadline dipilih.</p>
                  <div className="space-y-1 border-y border-amber-200 py-2 text-[11px]">
                    <div className="flex justify-between"><span>Subtotal Item</span><span>Rp {Math.round(subtotalAmount).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between"><span>Diskon</span><span>-Rp {Math.round(discountAmount).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between font-extrabold"><span>Total Harga</span><span>Rp {Math.round(totalAmount).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between"><span>DP / Uang Muka</span><span>Rp {Math.round(currentPayAmount).toLocaleString('id-ID')}</span></div>
                    <div className="flex justify-between"><span>Metode Pembayaran</span><span>{paymentMethods.find((item) => item.id === selectedMethod)?.label || selectedMethod}</span></div>
                    <div className="flex justify-between font-extrabold text-amber-800"><span>Sisa Tagihan</span><span>Rp {Math.max(0, Math.round(totalAmount - currentPayAmount)).toLocaleString('id-ID')}</span></div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block font-extrabold">Jatuh Tempo</span>
                    <input
                      type="date"
                      min={todayISO()}
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    />
                  </label>
                </div>
              )}
              {paymentMethods.map((method) => {
                const isSelected = selectedMethod === method.id;

                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedMethod(method.id)}
                    className={`w-full p-3.5 rounded-lg flex items-center gap-3 font-bold text-xs text-left transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#0088FF] text-white border-blue-400 shadow-md ring-2 ring-blue-300'
                        : 'bg-[#1976D2]/80 hover:bg-[#0088FF]/90 text-white border-blue-400/40'
                    }`}
                  >
                    <div className="p-1.5 rounded-md bg-white/10 shrink-0">
                      {method.icon}
                    </div>
                    <span className="flex-1">{method.label}</span>
                    {isSelected && <CheckCircle2 size={16} className="text-white shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL: Input Nominal & Smart Numpad (SS Acuan) */}
          <div className="flex-1 bg-white flex flex-col min-h-0 overflow-hidden">
            
            {/* Top Blue Header Bar SS */}
            <div className="bg-[#0088FF] px-6 py-3 text-white flex items-center justify-between shadow-sm shrink-0">
              {/* Left Total Bill Amount */}
              <div className="font-extrabold text-lg tracking-tight">
                {Math.round(totalAmount).toLocaleString('id-ID')}
              </div>

              {/* Right Quick Money Chips & Close Button */}
              <div className="flex items-center gap-2">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPayAmountStr(String(chip))}
                    className="px-3 py-1 rounded border border-white/60 bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    {chip.toLocaleString('id-ID')}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer ml-2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Display Input Nominal & Kembalian SS */}
            <div className="px-8 py-5 flex flex-col items-end justify-center border-b border-slate-100 shrink-0 bg-slate-50/50">
              <div className="w-full text-right pb-1 border-b-2 border-blue-500 font-extrabold text-4xl text-slate-800 tracking-wider">
                {currentPayAmount ? currentPayAmount.toLocaleString('id-ID') : '0'}
              </div>
              <div className="flex items-center justify-between w-full mt-2">
                <span className="text-xs font-bold text-slate-500">
                  Tagihan: Rp {Math.round(totalAmount).toLocaleString('id-ID')}
                </span>
                <span className={`text-xs font-extrabold ${changeAmount > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  Kembalian: Rp {changeAmount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Numpad Grid 3x4 SS */}
            <div className="flex-1 p-6 grid grid-cols-3 gap-4 items-center justify-center bg-white min-h-0">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '00'].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => handleNumpadClick(btn)}
                  className={`h-full min-h-[50px] max-h-[70px] rounded-xl font-bold text-2xl flex items-center justify-center transition-all shadow-sm border border-slate-200 cursor-pointer active:scale-95 ${
                    btn === 'C'
                      ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
                      : 'bg-white hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>

            {/* Bottom Full-Width Green Bayar Button SS */}
            <div className="p-3 bg-white shrink-0">
              <button
                type="button"
                onClick={handlePaySubmit}
                className="w-full py-3.5 rounded-lg bg-[#4CAF50] hover:bg-emerald-600 text-white font-extrabold text-lg shadow-lg shadow-emerald-500/20 transition-all cursor-pointer text-center"
              >
                Bayar
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
