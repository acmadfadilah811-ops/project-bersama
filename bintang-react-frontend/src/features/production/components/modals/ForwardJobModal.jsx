import { useEffect, useState } from 'react';
import { X, Loader2, ArrowRightCircle, CheckCircle, Unlock, Settings2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

/**
 * ForwardJobModal — Modal untuk meneruskan job ke tahap/divisi berikutnya
 * atau menandainya selesai. Dipanggil setelah OTP staff berhasil diverifikasi.
 *
 * Termasuk juga blok opsional "Catat Penggunaan Mesin" (fitur 2026-09-07):
 * operator DocuColor/Cetak Banner/Printer bisa langsung mencatat pemakaian
 * mesin riil (lembar/meter + catatan konfirmasi) di titik yang sama saat
 * menyelesaikan/meneruskan job -- bukan form terpisah yang gampang terlewat.
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

  // Catat Penggunaan Mesin (opsional)
  const [mesinList, setMesinList] = useState([]);
  const [catatMesin, setCatatMesin] = useState(false);
  const [mesinId, setMesinId] = useState('');
  const [lembarColor, setLembarColor] = useState('');
  const [lembarMono, setLembarMono] = useState('');
  const [ukuranKertas, setUkuranKertas] = useState('');
  const [jenisKertas, setJenisKertas] = useState('');
  const [gramasiKertas, setGramasiKertas] = useState('');
  const [panjangBahan, setPanjangBahan] = useState('');
  const [jenisBahan, setJenisBahan] = useState('');
  const [kondisiHasil, setKondisiHasil] = useState('ok');
  const [catatanKonfirmasi, setCatatanKonfirmasi] = useState('');
  const [mesinSaving, setMesinSaving] = useState(false);
  const [mesinErr, setMesinErr] = useState('');

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

    const fetchMesin = async () => {
      try {
        const response = await apiClient.get('/mesin/', { params: { is_active: true } });
        const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
        if (active) setMesinList(data);
      } catch (error) {
        console.error('Gagal memuat daftar mesin:', error);
      }
    };

    if (job) {
      fetchTahapTujuan();
      fetchMesin();
    }
    return () => { active = false; };
  }, [job?.id]);

  if (!job) return null;
  const orderInfo = orderMap[job.order_item];
  const tahapTujuan = availableTahap.filter((tahap) => String(tahap.id) !== String(job.tahap));
  const mesinTerpilih = mesinList.find((m) => String(m.id) === String(mesinId));
  const tipeMesin = mesinTerpilih?.tipe;

  const resetFormMesin = () => {
    setMesinId('');
    setLembarColor('');
    setLembarMono('');
    setUkuranKertas('');
    setJenisKertas('');
    setGramasiKertas('');
    setPanjangBahan('');
    setJenisBahan('');
    setKondisiHasil('ok');
    setCatatanKonfirmasi('');
    setMesinErr('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;

    if (catatMesin) {
      if (!mesinId) {
        setMesinErr('Pilih mesin yang dipakai, atau matikan pencatatan penggunaan mesin.');
        return;
      }
      setMesinSaving(true);
      setMesinErr('');
      try {
        await apiClient.post('/penggunaan-mesin/', {
          mesin: mesinId,
          job: job.id,
          lembar_color: lembarColor ? Number(lembarColor) : 0,
          lembar_mono: lembarMono ? Number(lembarMono) : 0,
          ukuran_kertas: ukuranKertas,
          jenis_kertas: jenisKertas,
          gramasi_kertas: gramasiKertas,
          panjang_bahan_meter: panjangBahan ? Number(panjangBahan) : null,
          jenis_bahan: jenisBahan,
          kondisi_hasil: kondisiHasil,
          catatan_konfirmasi: catatanKonfirmasi,
        });
      } catch (error) {
        console.error('Gagal mencatat penggunaan mesin:', error);
        setMesinErr(
          error.response?.data?.detail ||
            'Gagal menyimpan catatan penggunaan mesin. Coba lagi.'
        );
        setMesinSaving(false);
        return;
      }
      setMesinSaving(false);
    }

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

          {/* Catat Penggunaan Mesin (opsional) */}
          {mesinList.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <label className="flex items-center gap-2 p-3 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catatMesin}
                  onChange={(e) => {
                    setCatatMesin(e.target.checked);
                    if (!e.target.checked) resetFormMesin();
                  }}
                  className="cursor-pointer"
                />
                <Settings2 size={14} className="text-slate-500" />
                <span className="text-xs font-bold text-slate-700 flex-1">
                  Catat Penggunaan Mesin
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">Opsional</span>
              </label>

              {catatMesin && (
                <div className="p-3 space-y-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mesin yang Dipakai *
                    </label>
                    <select
                      value={mesinId}
                      onChange={(e) => setMesinId(e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Pilih Mesin --</option>
                      {mesinList.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nama} ({m.tipe_display})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(tipeMesin === 'docucolor' || tipeMesin === 'printer') && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Lembar Color
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={lembarColor}
                          onChange={(e) => setLembarColor(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Lembar Mono
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={lembarMono}
                          onChange={(e) => setLembarMono(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Ukuran Kertas
                        </label>
                        <input
                          type="text"
                          placeholder="A4, A3, F4..."
                          value={ukuranKertas}
                          onChange={(e) => setUkuranKertas(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Gramasi
                        </label>
                        <input
                          type="text"
                          placeholder="80gsm, 120gsm..."
                          value={gramasiKertas}
                          onChange={(e) => setGramasiKertas(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Jenis Kertas
                        </label>
                        <input
                          type="text"
                          placeholder="Art Paper, HVS..."
                          value={jenisKertas}
                          onChange={(e) => setJenisKertas(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {tipeMesin === 'cetak_banner' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Panjang Bahan (meter)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={panjangBahan}
                          onChange={(e) => setPanjangBahan(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Jenis Bahan
                        </label>
                        <input
                          type="text"
                          placeholder="Flexi, Vinyl..."
                          value={jenisBahan}
                          onChange={(e) => setJenisBahan(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {mesinId && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Kondisi Hasil
                        </label>
                        <div className="flex gap-2">
                          <label
                            className={`flex-1 flex items-center gap-1.5 p-2 border rounded-lg cursor-pointer text-[11px] font-bold ${
                              kondisiHasil === 'ok'
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={kondisiHasil === 'ok'}
                              onChange={() => setKondisiHasil('ok')}
                            />
                            OK
                          </label>
                          <label
                            className={`flex-1 flex items-center gap-1.5 p-2 border rounded-lg cursor-pointer text-[11px] font-bold ${
                              kondisiHasil === 'kendala'
                                ? 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            <input
                              type="radio"
                              className="hidden"
                              checked={kondisiHasil === 'kendala'}
                              onChange={() => setKondisiHasil('kendala')}
                            />
                            Ada Kendala
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Catatan Konfirmasi
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Mis: hasil cetak sesuai, toner cyan mulai menipis..."
                          value={catatanKonfirmasi}
                          onChange={(e) => setCatatanKonfirmasi(e.target.value)}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                    </>
                  )}

                  {mesinErr && (
                    <p className="text-[11px] font-semibold text-rose-600">{mesinErr}</p>
                  )}
                </div>
              )}
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
              disabled={saving || mesinSaving}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving || mesinSaving ? (
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
