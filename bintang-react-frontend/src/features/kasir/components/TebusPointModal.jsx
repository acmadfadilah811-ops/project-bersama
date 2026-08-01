import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';

export default function TebusPointModal({
  isOpen,
  onClose,
  selectedContact,
  redemptionOptions = [],
  selectedRedemption,
  onConfirmRedeem,
}) {
  const [chosenId, setChosenId] = useState(selectedRedemption?.id ?? null);

  const isMember = selectedContact?.member_poin != null;
  const availablePoints = isMember ? Number(selectedContact.member_poin) : 0;

  useEffect(() => {
    if (isOpen) {
      setChosenId(selectedRedemption?.id ?? null);
    }
  }, [isOpen, selectedRedemption]);

  if (!isOpen) return null;

  const describeDiskon = (rule) =>
    rule.tipe_diskon === '%'
      ? `${rule.jumlah_diskon}%${Number(rule.maksimal_jumlah_diskon) > 0 ? ` (maks Rp ${Number(rule.maksimal_jumlah_diskon).toLocaleString('id-ID')})` : ''}`
      : `Rp ${Number(rule.jumlah_diskon).toLocaleString('id-ID')}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    const rule = redemptionOptions.find((r) => r.id === chosenId) || null;
    onConfirmRedeem(rule);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header Blue Bar SS 1 */}
        <div className="bg-[#0088FF] px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <Star size={20} className="fill-white" />
            </div>
            <h3 className="font-extrabold text-base tracking-wide">Tebus Point</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content Body */}
        <form onSubmit={handleSubmit} className="p-7 space-y-5 bg-white text-sm">
          {!isMember ? (
            <p className="text-xs text-slate-500 font-semibold">
              Pelanggan belum tertaut ke akun member — tidak bisa menebus poin.
            </p>
          ) : (
            <>
              <div className="font-black text-slate-900 text-base">
                Saldo: {availablePoints} pts
              </div>

              {redemptionOptions.length === 0 ? (
                <p className="text-xs text-slate-400 font-semibold">
                  Belum ada opsi penukaran poin yang diatur.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {redemptionOptions.map((rule) => {
                    const disabled = rule.besar_point > availablePoints;
                    const isChosen = chosenId === rule.id;
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setChosenId(isChosen ? null : rule.id)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          isChosen ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="font-bold text-slate-800 text-xs">{rule.besar_point} pts</span>
                        <span className="font-semibold text-blue-600 text-xs">Potongan {describeDiskon(rule)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Confirmation Button */}
          <div className="pt-2 flex gap-2">
            {selectedRedemption && (
              <button
                type="button"
                onClick={() => {
                  onConfirmRedeem(null);
                  onClose();
                }}
                className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
              >
                Batal Penukaran
              </button>
            )}
            <button
              type="submit"
              disabled={!isMember || !chosenId}
              className="flex-1 py-3.5 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Konfirmasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
