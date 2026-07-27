import { useState, useEffect } from 'react';
import { Tag, Trash2, AlertCircle } from 'lucide-react';

export default function LoyaltyPointRedemptionModal({ isOpen, onClose, redemptionItem, onSave, onDelete }) {
  const [formData, setFormData] = useState({
    besar_point: 0,
    tipe_diskon: 'IDR', // 'IDR' atau '%'
    jumlah_diskon: 0,
    maksimal_jumlah_diskon: 0,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setErrors({});
    if (redemptionItem) {
      setFormData({
        besar_point: redemptionItem.besar_point ?? 0,
        tipe_diskon: redemptionItem.tipe_diskon || 'IDR',
        jumlah_diskon: redemptionItem.jumlah_diskon ?? 0,
        maksimal_jumlah_diskon: redemptionItem.maksimal_jumlah_diskon ?? 0,
      });
    } else {
      setFormData({
        besar_point: 0,
        tipe_diskon: 'IDR',
        jumlah_diskon: 0,
        maksimal_jumlah_diskon: 0,
      });
    }
  }, [redemptionItem, isOpen]);

  if (!isOpen) return null;

  // Kolom wajib: besar point & nilai diskon harus > 0. Untuk tipe persen,
  // maksimal diskon juga wajib agar diskon tidak tak terbatas.
  const validate = () => {
    const e = {};
    if (!Number(formData.besar_point) || Number(formData.besar_point) <= 0)
      e.besar_point = 'Besar point wajib diisi dan harus lebih dari 0.';
    if (!Number(formData.jumlah_diskon) || Number(formData.jumlah_diskon) <= 0)
      e.jumlah_diskon = 'Nilai diskon wajib diisi dan harus lebih dari 0.';
    if (formData.tipe_diskon === '%' &&
        (!Number(formData.maksimal_jumlah_diskon) || Number(formData.maksimal_jumlah_diskon) <= 0))
      e.maksimal_jumlah_diskon = 'Maksimal diskon wajib diisi untuk tipe persen (%).';
    return e;
  };

  const update = (patch) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    // Bersihkan pesan error kolom yang sedang diubah.
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
        {/* Modal Header — shrink-0 supaya tombol Simpan/Batal tidak pernah terpotong */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white">
          <h2 className="text-lg font-bold text-slate-800">Diskon</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Modal Content — flex-1 + scroll internal */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-5">
          {/* Banner Box with Red Tag Icon */}
          <div className="bg-rose-100/60 border border-rose-200/50 rounded-2xl h-32 flex items-center justify-center">
            <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-md transform -rotate-12">
              <Tag size={24} className="fill-white" />
            </div>
          </div>

          {/* Besar Point */}
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">
              Besar Point <span className="text-rose-500">*</span>
            </label>
            <div className={`flex rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 ${
              errors.besar_point ? 'border-rose-400' : 'border-slate-300'
            }`}>
              <input
                type="number"
                min="0"
                value={formData.besar_point}
                onChange={(e) => update({ besar_point: Number(e.target.value) })}
                className="w-full text-xs font-medium text-slate-800 px-3 py-2 focus:outline-none"
              />
              <span className="bg-slate-50 border-l border-slate-200 px-4 flex items-center text-xs font-medium text-slate-500">
                Poin
              </span>
            </div>
            {errors.besar_point && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                <AlertCircle size={12} className="shrink-0" /> {errors.besar_point}
              </p>
            )}
          </div>

          {/* Diskon yang diperoleh */}
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">
              Diskon yang diperoleh <span className="text-rose-500">*</span>
            </label>
            <div className={`flex rounded-lg border overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 ${
              errors.jumlah_diskon ? 'border-rose-400' : 'border-slate-300'
            }`}>
              <input
                type="number"
                min="0"
                value={formData.jumlah_diskon}
                onChange={(e) => update({ jumlah_diskon: Number(e.target.value) })}
                className="w-full text-xs font-medium text-slate-800 px-3 py-2 focus:outline-none"
              />
              <div className="flex border-l border-slate-200 bg-slate-100 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => update({ tipe_diskon: 'IDR' })}
                  className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    formData.tipe_diskon === 'IDR'
                      ? 'bg-blue-500 text-white rounded-md shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  IDR
                </button>
                <button
                  type="button"
                  onClick={() => update({ tipe_diskon: '%' })}
                  className={`px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    formData.tipe_diskon === '%'
                      ? 'bg-blue-500 text-white rounded-md shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  %
                </button>
              </div>
            </div>
            {errors.jumlah_diskon && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                <AlertCircle size={12} className="shrink-0" /> {errors.jumlah_diskon}
              </p>
            )}
          </div>

          {/* Maksimal jumlah diskon (hanya jika tipe_diskon === '%') */}
          {formData.tipe_diskon === '%' && (
            <div className="animate-fade-in">
              <label className="text-[11px] text-slate-500 font-medium block mb-1">
                Maksimal jumlah diskon <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={`Rp. ${Number(formData.maksimal_jumlah_diskon || 0).toLocaleString('id-ID')}`}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  update({ maksimal_jumlah_diskon: Number(val) });
                }}
                className={`w-full text-xs font-medium text-slate-800 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                  errors.maksimal_jumlah_diskon ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              {errors.maksimal_jumlah_diskon && (
                <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                  <AlertCircle size={12} className="shrink-0" /> {errors.maksimal_jumlah_diskon}
                </p>
              )}
            </div>
          )}

          {/* Catatan kolom wajib */}
          <p className="text-[10px] text-slate-400">
            <span className="text-rose-500">*</span> Kolom wajib diisi.
          </p>

          {/* Tombol Hapus (hanya jika mode edit / redemptionItem tersedia) */}
          {redemptionItem && onDelete && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onDelete(redemptionItem.id)}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Trash2 size={14} />
                <span>Hapus</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
