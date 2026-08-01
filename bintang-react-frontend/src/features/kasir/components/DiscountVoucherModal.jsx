import React, { useState } from 'react';
import { X, BadgePercent, Tag, Check, Trash2, Percent } from 'lucide-react';

export default function DiscountVoucherModal({
  isOpen,
  onClose,
  availableCoupons = [],
  selectedCoupon,
  discountPercent,
  onApplyCoupon,
  onApplyManualDiscount,
  onRemoveCoupon,
  salesDiscountPreview,
  isAutoDiscountActive,
  onApplyAutoDiscount,
  onRemoveAutoDiscount,
}) {
  const [voucherCode, setVoucherCode] = useState('');
  const [manualPercent, setManualPercent] = useState(discountPercent || 0);

  if (!isOpen) return null;

  const handleApplyVoucherSubmit = (e) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    onApplyCoupon(voucherCode.trim());
    setVoucherCode('');
  };

  const handleSelectCouponCard = (coupon) => {
    setVoucherCode(coupon.kode);
    onApplyCoupon(coupon.kode);
  };

  const handleSaveManual = () => {
    onApplyManualDiscount(Number(manualPercent || 0));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header Blue Bar matching SS */}
        <div className="bg-[#0088FF] px-5 py-3.5 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
              <BadgePercent size={20} />
            </div>
            <h3 className="font-extrabold text-sm tracking-wide">Disc. Pesanan</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-5 bg-white text-xs max-h-[80vh] overflow-y-auto">
          {/* Form Input Kode Voucher */}
          <form onSubmit={handleApplyVoucherSubmit} className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 block">
              Masukkan Kode Voucher Diskon
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="[Masukkan Kode Voucher]"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-extrabold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all uppercase"
              />
              <button
                type="submit"
                disabled={!voucherCode.trim()}
                className="px-4 py-2.5 bg-[#0088FF] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer shrink-0"
              >
                Gunakan
              </button>
            </div>
          </form>

          {/* Active Voucher Tag if selected */}
          {selectedCoupon && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="font-extrabold text-xs block">{selectedCoupon.kode}</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {selectedCoupon.tipe_diskon === 'percent'
                      ? `Diskon ${selectedCoupon.jumlah_diskon}%`
                      : `Potongan Rp ${Number(selectedCoupon.jumlah_diskon).toLocaleString('id-ID')}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="p-1 text-emerald-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                title="Hapus Voucher"
              >
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {/* List Voucher Aktif POS */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <Tag size={14} className="text-blue-500" />
              <span>Voucher Diskon Tersedia</span>
            </label>

            {availableCoupons.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 font-semibold text-[11px]">
                Tidak ada voucher promo aktif saat ini.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {availableCoupons.map((coupon) => {
                  const isSelected = selectedCoupon?.kode === coupon.kode;
                  return (
                    <button
                      key={coupon.id || coupon.kode}
                      type="button"
                      onClick={() => handleSelectCouponCard(coupon)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 shadow-sm'
                          : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>{coupon.kode}</span>
                          {isSelected && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Aktif</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                          {coupon.tipe_diskon === 'percent'
                            ? `Diskon ${coupon.jumlah_diskon}%`
                            : `Potongan Rp ${Number(coupon.jumlah_diskon).toLocaleString('id-ID')}`}
                          {coupon.min_total_pesanan > 0 && ` • Min. Ordr Rp ${Number(coupon.min_total_pesanan).toLocaleString('id-ID')}`}
                        </div>
                      </div>

                      <div className="text-blue-600 font-bold text-xs">
                        Pilih
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diskon Penjualan Otomatis (promo_engine, tanpa kode) */}
          {salesDiscountPreview && Number(salesDiscountPreview.diskon) > 0 && (
            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              isAutoDiscountActive ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div>
                <span className="font-extrabold text-xs block">Diskon Penjualan Otomatis</span>
                <span className="text-[10px] font-semibold opacity-80">
                  {salesDiscountPreview.aturan?.tipe_diskon === '%'
                    ? `Potongan ${salesDiscountPreview.aturan.jumlah_diskon}%`
                    : `Potongan Rp ${Number(salesDiscountPreview.diskon).toLocaleString('id-ID')}`}
                  {isAutoDiscountActive ? ' — aktif' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={isAutoDiscountActive ? onRemoveAutoDiscount : onApplyAutoDiscount}
                className={`px-3 py-1.5 rounded-lg font-bold text-[11px] cursor-pointer transition-all ${
                  isAutoDiscountActive
                    ? 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                {isAutoDiscountActive ? 'Lepas' : 'Terapkan'}
              </button>
            </div>
          )}

          <div className="h-px bg-slate-200 my-1" />

          {/* Opsi Diskon Manual (%) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
              <Percent size={14} className="text-blue-500" />
              <span>Atau Masukkan Diskon Manual (%)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={manualPercent}
                onChange={(e) => setManualPercent(e.target.value)}
                placeholder="0"
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white text-right"
              />
              <span className="font-bold text-slate-600">%</span>
              <button
                type="button"
                onClick={handleSaveManual}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-bold text-xs transition-all cursor-pointer text-center"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
