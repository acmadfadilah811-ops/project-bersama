import { useState } from 'react';
import { X } from 'lucide-react';
import { STAFF_COLUMNS } from '../jobConstants';

/**
 * EditJobModal — Modal edit info job.
 * FIX: Sekarang menampilkan dropdown Tahap Divisi dan menyertakannya di payload PATCH.
 */
export default function EditJobModal({
  job,
  orderMap,
  tahapList,
  staffList,
  saving,
  isManager,
  onSubmit,
  onClose,
}) {
  // State form lokal
  const [formData, setFormData] = useState({
    status_pekerjaan: job?.status_pekerjaan || 'antrean',
    tahap: job?.tahap || '',
    pic_staff: job?.pic_staff || '',
    insentif: job?.insentif || 0,
  });

  if (!job) return null;
  const orderInfo = orderMap[job.order_item];
  // Job yang sudah selesai/batal tidak bisa dibalik statusnya
  const isLocked = ['selesai', 'batal', 'gagal'].includes(job.status_pekerjaan);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(job.id, formData, isManager);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Edit Info & Status</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              #{orderInfo?.orderId} — {orderInfo?.jenisProduk}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Status Pekerjaan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Status Pekerjaan Internal
            </label>
            {isLocked ? (
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border uppercase tracking-wide ${
                  job.status_pekerjaan === 'selesai'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : job.status_pekerjaan === 'gagal'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {job.status_pekerjaan === 'selesai' ? '✓ Selesai' : job.status_pekerjaan === 'gagal' ? '✗ Gagal' : 'Dibatalkan'}
                </span>
                <span className="text-[10px] text-slate-400 italic">Status terkunci — tidak dapat diubah</span>
              </div>
            ) : (
              <select
                value={formData.status_pekerjaan}
                onChange={(e) => setFormData((f) => ({ ...f, status_pekerjaan: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {STAFF_COLUMNS.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* FIX: Tahap Divisi — hanya tampil jika belum selesai */}
          {isManager && !isLocked && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tahap / Divisi Saat Ini
              </label>
              <select
                value={formData.tahap}
                onChange={(e) => setFormData((f) => ({ ...f, tahap: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <option value="">-- Tidak Ada Tahap --</option>
                {tahapList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nama} ({t.divisi_nama})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                Tahap saat ini:{' '}
                <span className="font-semibold text-slate-500">
                  {job.tahap_nama || 'Belum ada'}
                </span>
              </p>
            </div>
          )}

          {isManager && (
            <>
              {/* Ubah Alokasi Staff */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ubah Alokasi Staf
                </label>
                <select
                  value={formData.pic_staff}
                  onChange={(e) => setFormData((f) => ({ ...f, pic_staff: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">-- Tanpa PIC Staf --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.username} ({s.divisi_nama})
                    </option>
                  ))}
                </select>
              </div>

              {/* Insentif */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ubah Insentif (Rp)
                </label>
                <input
                  type="number"
                  value={formData.insentif}
                  onChange={(e) => setFormData((f) => ({ ...f, insentif: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="0"
                  min="0"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
