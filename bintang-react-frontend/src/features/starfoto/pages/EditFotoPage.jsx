import { useCallback, useEffect, useState } from 'react';
import { ImagePlus, RefreshCw, Send, Trash2, Wand2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { uiConfirm } from '../../../utils/dialog';

// Editor StarFoto (2026-10-11): file pilihan + catatan pelanggan, unggah
// pratinjau hasil edit (server memberi watermark), kirim ke pelanggan untuk
// disetujui lewat tautan WA. SPK Edit tertutup otomatis saat dikirim.

const daftar = (data) => (Array.isArray(data) ? data : data?.results || []);

// Foto asli hasil edit tetap di PC editor; yang diunggah hanya salinan kecil
// (maks 1600px, sama dengan ukuran pratinjau server) supaya file belasan MB
// tidak membebani jaringan & server (2026-10-15). Gagal dikecilkan -> file asli.
const SISI_MAKS = 1600;
async function kecilkanFoto(berkas) {
  try {
    const bitmap = await createImageBitmap(berkas, { imageOrientation: 'from-image' });
    const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height));
    const kanvas = document.createElement('canvas');
    kanvas.width = Math.round(bitmap.width * skala);
    kanvas.height = Math.round(bitmap.height * skala);
    kanvas.getContext('2d').drawImage(bitmap, 0, 0, kanvas.width, kanvas.height);
    bitmap.close?.();
    const blob = await new Promise((ok) => kanvas.toBlob(ok, 'image/jpeg', 0.88));
    if (!blob || blob.size >= berkas.size) return berkas;
    return new File([blob], `${berkas.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return berkas;
  }
}

// Pratinjau ada di jalur terlindung (butuh login) -> diambil sebagai blob.
function GambarTerlindung({ url, alt }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!url) return undefined;
    let aktif = true;
    let objek = '';
    apiClient.get(url, { responseType: 'blob' })
      .then((res) => { objek = URL.createObjectURL(res.data); if (aktif) setSrc(objek); })
      .catch(() => {});
    return () => { aktif = false; if (objek) URL.revokeObjectURL(objek); };
  }, [url]);
  if (!url) return <div className="flex h-32 w-full items-center justify-center rounded-lg bg-slate-100 p-2 text-center text-xs text-slate-400">Pratinjau sudah dihapus dari server</div>;
  return src ? <img src={src} alt={alt} className="h-32 w-full rounded-lg object-cover" /> : <div className="h-32 w-full animate-pulse rounded-lg bg-slate-100" />;
}

function KartuEdit({ p, onBerubah }) {
  const [unggah, setUnggah] = useState(null);
  const [mengirim, setMengirim] = useState(false);
  const draf = p.pratinjau.filter((f) => f.putaran === p.putaran_draf);
  const revisiSebelumnya = p.pratinjau.filter((f) => f.putaran === p.approval_putaran && f.keputusan === 'revisi');

  const pilihBerkas = async (pilihanId, files) => {
    if (!files?.length) return;
    setUnggah(pilihanId ?? 'umum');
    try {
      for (const berkas of files) {
        const fd = new FormData();
        fd.append('foto', await kecilkanFoto(berkas));
        if (pilihanId) fd.append('pilihan_file', String(pilihanId));
        await apiClient.post(`/starfoto/pesanan/${p.id}/pratinjau/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      onBerubah();
    } catch (err) {
      notifyApiError(err, 'Gagal mengunggah pratinjau.');
    } finally {
      setUnggah(null);
    }
  };

  const hapus = async (id) => {
    try {
      await apiClient.delete(`/starfoto/pratinjau/${id}/`);
      onBerubah();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus pratinjau.');
    }
  };

  const kirim = async () => {
    if (!(await uiConfirm(`Kirim ${draf.length} pratinjau ke ${p.pelanggan} lewat WhatsApp untuk disetujui?`))) return;
    setMengirim(true);
    try {
      await apiClient.post(`/starfoto/pesanan/${p.id}/kirim-approval/`);
      notifySuccess('Terkirim ke pelanggan', 'Tautan persetujuan dikirim lewat WhatsApp.');
      onBerubah();
    } catch (err) {
      notifyApiError(err, 'Gagal mengirim ke pelanggan.');
    } finally {
      setMengirim(false);
    }
  };

  const tombolUnggah = (pilihanId, label) => (
    <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0088FF] ${unggah === (pilihanId ?? 'umum') ? 'opacity-50' : ''}`}>
      <ImagePlus size={14} /> {unggah === (pilihanId ?? 'umum') ? 'Mengunggah...' : label}
      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pilihBerkas(pilihanId, e.target.files); e.target.value = ''; }} />
    </label>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800">{p.pelanggan} · {p.paket}</p>
          <p className="text-xs text-slate-500">{p.order}{p.nomor_kantong ? ` · Kantong ${p.nomor_kantong}` : ''} · jatah edit {p.jumlah_edit}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.approval_status === 'revisi' ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-[#0088FF]'}`}>
          {p.approval_status === 'revisi' ? `Revisi ke-${p.approval_putaran} · sisa ${p.sisa_revisi}x` : 'Edit baru'}
        </span>
      </div>

      {p.catatan_file && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600"><b>Catatan umum:</b> {p.catatan_file}</p>}

      {revisiSebelumnya.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-bold text-amber-900">Permintaan revisi pelanggan</p>
          {revisiSebelumnya.map((f) => <p key={f.id} className="text-amber-900">File {f.nomor_file || '-'}: {f.catatan_pelanggan}</p>)}
        </div>
      )}

      <div className="space-y-3">
        {p.pilihan_file.map((pf) => {
          const milik = draf.filter((f) => f.pilihan_file === pf.id);
          return (
            <div key={pf.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm">
                  <p className="font-bold text-slate-800">File {pf.nomor_file}{pf.peruntukan ? ` · ${pf.peruntukan}` : ''}</p>
                  {pf.catatan && <p className="text-slate-600">{pf.catatan}</p>}
                </div>
                {tombolUnggah(pf.id, 'Unggah hasil')}
              </div>
              {milik.length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {milik.map((f) => (
                    <div key={f.id} className="relative">
                      <GambarTerlindung url={f.berkas} alt={`File ${pf.nomor_file}`} />
                      <button type="button" onClick={() => hapus(f.id)} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-rose-600 shadow" aria-label="Hapus"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500">{draf.length} pratinjau siap dikirim · watermark dipasang otomatis · foto asli tetap di PC, yang diunggah hanya versi kecil.</p>
        <button
          type="button" onClick={kirim} disabled={!draf.length || mengirim}
          className="flex items-center gap-2 rounded-xl bg-[#0088FF] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          <Send size={16} /> {mengirim ? 'Mengirim...' : 'Kirim ke Pelanggan'}
        </button>
      </div>
    </div>
  );
}

export default function EditFotoPage() {
  const [antrean, setAntrean] = useState([]);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setAntrean(daftar((await apiClient.get('/starfoto/edit-foto/')).data));
    } catch (err) {
      notifyApiError(err, 'Gagal memuat antrean edit foto.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <h1 className="hidden items-center gap-2 text-lg font-bold text-slate-800 md:flex"><Wand2 size={20} /> Edit Foto</h1>
        <button type="button" onClick={muat} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Muat ulang">
          <RefreshCw size={18} className={memuat ? 'animate-spin' : ''} />
        </button>
      </div>
      {antrean.map((p) => <KartuEdit key={p.id} p={p} onBerubah={muat} />)}
      {!memuat && !antrean.length && <p className="py-16 text-center text-sm text-slate-400">Tidak ada foto yang menunggu diedit.</p>}
    </div>
  );
}
