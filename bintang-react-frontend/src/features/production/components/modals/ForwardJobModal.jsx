import { useState } from 'react';
import { X, Loader2, ArrowRightCircle, CheckCircle, Unlock } from 'lucide-react';

/**
 * ForwardJobModal — Modal untuk meneruskan job ke tahap/divisi berikutnya
 * atau menandainya selesai. Dipanggil setelah OTP staff berhasil diverifikasi.
 */
export default function ForwardJobModal({
  job,
  orderMap,
  tahapList,
  staffList,
  saving,
  onSubmit,
  onClose,
}) {
  const [aksi, setAksi] = useState('forward');

  if (!job) return null;
  const orderInfo = orderMap[job.order_item];

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    onSubmit(job.id, {
      aksi,
      tahap_id: aksi === 'forward' ? form.tahap_id.value : null,
      pic_staff_id: aksi === 'forward' && form.pic_staff_id?.value ? form.pic_staff_id.value : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="bg-indigo-700 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Unlock size={22} className="text-emerald-300" />
            <div>
              <h2 className="font-bold text-base">Teruskan / Selesaikan Job</h2>
              <p className="text-indigo-200 text-xs mt-0.5">
                Job: {orderInfo?.jenis_produk || orderInfo?.jenisProduk || '-'} — Tahap:{' '}
                {job.tahap_nama}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Pilih Aksi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Apa yang ingin dilakukan?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  aksi === 'forward'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="aksi"
                  value="forward"
                  checked={aksi === 'forward'}
                  onChange={() => setAksi('forward')}
                  className="hidden"
                />
                <ArrowRightCircle
                  size={18}
                  className={aksi === 'forward' ? 'text-indigo-600' : 'text-slate-400'}
                />
                <div>
                  <p
                    className={`text-xs font-bold ${aksi === 'forward' ? 'text-indigo-700' : 'text-slate-700'}`}
                  >
                    Teruskan
                  </p>
                  <p className="text-[10px] text-slate-500">Ke divisi/tahap lain</p>
                </div>
              </label>

              <label
                className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  aksi === 'selesai'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="aksi"
                  value="selesai"
                  checked={aksi === 'selesai'}
                  onChange={() => setAksi('selesai')}
                  className="hidden"
                />
                <CheckCircle
                  size={18}
                  className={aksi === 'selesai' ? 'text-indigo-600' : 'text-slate-400'}
                />
                <div>
                  <p
                    className={`text-xs font-bold ${aksi === 'selesai' ? 'text-indigo-700' : 'text-slate-700'}`}
                  >
                    Selesai
                  </p>
                  <p className="text-[10px] text-slate-500">Tutup Job / Finish</p>
                </div>
              </label>
            </div>
          </div>

          {/* Sembunyikan Tahap Tujuan & PIC jika memilih Selesai */}
          {aksi === 'forward' && (
            <>
              {/* Pilih Tahap Tujuan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tahap Tujuan *
                </label>
                <select
                  name="tahap_id"
                  required
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Tahap --</option>
                  {tahapList
                    .filter((t) => t.id !== job.tahap)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama} ({t.divisi_nama})
                      </option>
                    ))}
                </select>
              </div>

              {/* Assign Staff (opsional) */}
              {staffList.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assign Staff (Opsional)
                  </label>
                  <select
                    name="pic_staff_id"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Pilih Staff --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.username} ({s.divisi_nama})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {aksi === 'selesai' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] leading-relaxed">
              <strong>Informasi:</strong> Pekerjaan ini akan langsung ditandai sebagai{' '}
              <strong>Selesai (Tutup Job)</strong>. Jika seluruh pekerjaan pada pesanan ini telah
              selesai, status pesanan global juga akan otomatis ter-update menjadi Selesai.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ArrowRightCircle size={14} />
              )}
              Konfirmasi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
