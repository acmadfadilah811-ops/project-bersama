import { useEffect, useState } from 'react';
import { X, Loader2, ArrowRightCircle, CheckCircle, Unlock, AlertTriangle } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

/**
 * ForwardJobModal — Modal untuk meneruskan job ke tahap/divisi berikutnya
 * atau menandainya selesai. Dipanggil setelah OTP staff berhasil diverifikasi.
 *
 * Catat Penggunaan Mesin DIPINDAH ke sheet "Bahan Baku" WorkspaceSPK.jsx
 * (instruksi user 2026-09-09) -- sebelumnya di sini, di ujung alur, staff
 * sering salah input karena tidak lagi lihat konteks job saat mengisi.
 * Modal ini sekarang cuma cek: kalau job PUNYA catatan penggunaan mesin
 * dengan kondisi_hasil='kendala' (dicatat di WorkspaceSPK), staff TIDAK BISA
 * pilih "Selesai"/"Teruskan" -- wajib ditandai GAGAL (aksi='gagal', beda
 * dari 'selesai' biasa, backend TIDAK memicu order jadi 'ready').
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
  const [availableTahap, setAvailableTahap] = useState(tahapList || []);
  const [loadingTahap, setLoadingTahap] = useState(false);
  const [tahapError, setTahapError] = useState('');

  const [checkingMesin, setCheckingMesin] = useState(true);
  const [adaKendalaMesin, setAdaKendalaMesin] = useState(false);
  const [kendalaEntries, setKendalaEntries] = useState([]);
  const [alasanGagal, setAlasanGagal] = useState('');

  useEffect(() => {
    setAvailableTahap(tahapList || []);
  }, [tahapList]);

  useEffect(() => {
    let active = true;

    const fetchTahapTujuan = async () => {
      setLoadingTahap(true);
      setTahapError('');
      try {
        const response = await apiClient.get('/tahap-proses/');
        const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
        if (active) setAvailableTahap(data);
      } catch (error) {
        console.error('Gagal memuat tahap tujuan:', error);
        if (active) setTahapError('Tahap tujuan tidak dapat dimuat. Coba buka kembali dialog ini.');
      } finally {
        if (active) setLoadingTahap(false);
      }
    };

    // Cek apakah job ini punya catatan Penggunaan Mesin berkondisi "Kendala"
    // (diisi staff di sheet Bahan Baku WorkspaceSPK) -- kalau ada, job WAJIB
    // ditandai Gagal, tidak boleh lolos ke Selesai/Teruskan.
    const checkKendalaMesin = async () => {
      setCheckingMesin(true);
      try {
        const response = await apiClient.get('/penggunaan-mesin/', { params: { job: job.id } });
        const data = response.data;
        const list = Array.isArray(data) ? data : (data?.results || []);
        const kendala = list.filter((entry) => entry.kondisi_hasil === 'kendala');
        if (active) {
          setKendalaEntries(kendala);
          setAdaKendalaMesin(kendala.length > 0);
          if (kendala.length > 0) setAksi('gagal');
        }
      } catch (error) {
        console.error('Gagal memeriksa status penggunaan mesin:', error);
      } finally {
        if (active) setCheckingMesin(false);
      }
    };

    if (job) {
      fetchTahapTujuan();
      checkKendalaMesin();
    }
    return () => { active = false; };
  }, [job?.id]);

  if (!job) return null;
  const orderInfo = orderMap[job.order_item];
  const tahapTujuan = availableTahap.filter((tahap) => String(tahap.id) !== String(job.tahap));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;

    if (adaKendalaMesin) {
      if (!alasanGagal.trim()) {
        return;
      }
      onSubmit(job.id, { aksi: 'gagal', alasan_gagal: alasanGagal.trim() });
      return;
    }

    onSubmit(job.id, {
      aksi,
      tahap_id: aksi === 'forward' ? form.tahap_id.value : null,
      pic_staff_id: aksi === 'forward' && form.pic_staff_id?.value ? form.pic_staff_id.value : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className={`px-5 py-4 flex justify-between items-center shrink-0 text-white ${adaKendalaMesin ? 'bg-amber-600' : 'bg-indigo-700'}`}>
          <div className="flex items-center gap-3">
            {adaKendalaMesin ? <AlertTriangle size={22} /> : <Unlock size={22} className="text-emerald-300" />}
            <div>
              <h2 className="font-bold text-base">{adaKendalaMesin ? 'Job Bermasalah — Wajib Ditandai Gagal' : 'Teruskan / Selesaikan Job'}</h2>
              <p className={`text-xs mt-0.5 ${adaKendalaMesin ? 'text-amber-100' : 'text-indigo-200'}`}>
                Job: {orderInfo?.jenis_produk || orderInfo?.jenisProduk || '-'} — Tahap:{' '}
                {job.tahap_nama}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {checkingMesin ? (
            <div className="flex items-center justify-center gap-2 py-6 text-slate-400 text-xs font-semibold">
              <Loader2 size={16} className="animate-spin" /> Memeriksa catatan penggunaan mesin...
            </div>
          ) : adaKendalaMesin ? (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-relaxed space-y-1.5">
                <p>
                  <strong>Ada {kendalaEntries.length} catatan penggunaan mesin berstatus "Ada Kendala"</strong> untuk
                  job ini (dicatat di sheet Bahan Baku). Job tidak bisa ditandai Selesai/Diteruskan — wajib ditandai{' '}
                  <strong>Gagal</strong> supaya masuk antrean perbaikan/cetak ulang, bukan seolah-olah tuntas.
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {kendalaEntries.map((k) => (
                    <li key={k.id}>{k.mesin_nama}: {k.catatan_konfirmasi || 'Tidak ada keterangan.'}</li>
                  ))}
                </ul>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Kegagalan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={alasanGagal}
                  onChange={(e) => setAlasanGagal(e.target.value)}
                  rows={3}
                  required
                  placeholder="Jelaskan kendala mesin/hasil cetak (bisa salin dari catatan konfirmasi di atas)..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </>
          ) : (
            <>
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
                      disabled={loadingTahap}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">
                        {loadingTahap ? 'Memuat tahap...' : '-- Pilih Tahap --'}
                      </option>
                      {tahapTujuan.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nama} ({t.divisi_nama})
                          </option>
                        ))}
                    </select>
                    {tahapError ? (
                      <p className="mt-1 text-[11px] font-semibold text-rose-600">{tahapError}</p>
                    ) : tahapTujuan.length === 0 && !loadingTahap ? (
                      <p className="mt-1 text-[11px] font-semibold text-amber-600">
                        Belum ada tahap lain yang dapat dipilih.
                      </p>
                    ) : null}
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
            </>
          )}
        </div>

          <div className="flex justify-end gap-2 p-4 border-t border-slate-100 shrink-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || checkingMesin || (adaKendalaMesin && !alasanGagal.trim())}
              className={`px-5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer ${
                adaKendalaMesin ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : adaKendalaMesin ? (
                <AlertTriangle size={14} />
              ) : (
                <ArrowRightCircle size={14} />
              )}
              {adaKendalaMesin ? 'Tandai Gagal' : 'Konfirmasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
