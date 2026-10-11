import { useEffect, useState } from 'react';
import { Camera, MapPin, RefreshCw, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess } from '../../../utils/notify';

// Mulai / Selesai Dinas Luar (2026-10-11): GPS + selfie di lokasi.
// Foto dikecilkan di HP (maks 1280px JPEG) supaya unggah cepat di sinyal lemah.

function ambilLokasi() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser ini tidak mendukung GPS.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: Math.round(pos.coords.accuracy) }),
      (err) => reject(new Error(err.code === 1
        ? 'Akses lokasi ditolak. Izinkan lokasi untuk situs ini di pengaturan browser.'
        : 'Lokasi belum didapat. Pastikan GPS HP menyala lalu coba lagi.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function kecilkanFoto(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const skala = Math.min(1, 1280 / Math.max(img.width, img.height));
      const kanvas = document.createElement('canvas');
      kanvas.width = Math.round(img.width * skala);
      kanvas.height = Math.round(img.height * skala);
      kanvas.getContext('2d').drawImage(img, 0, 0, kanvas.width, kanvas.height);
      URL.revokeObjectURL(url);
      kanvas.toBlob((blob) => resolve(blob ? new File([blob], 'selfie.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.75);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function DinasLuarModal({ mode, sesi, dinasId, nonSesi, onClose, onSaved }) {
  const [lokasi, setLokasi] = useState(null);
  const [galatLokasi, setGalatLokasi] = useState('');
  const [mencari, setMencari] = useState(false);
  const [foto, setFoto] = useState(null);
  const [pratinjau, setPratinjau] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [alamat, setAlamat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const cariLokasi = async () => {
    setMencari(true);
    setGalatLokasi('');
    try {
      setLokasi(await ambilLokasi());
    } catch (err) {
      setGalatLokasi(err.message);
    } finally {
      setMencari(false);
    }
  };

  useEffect(() => { cariLokasi(); }, []);
  useEffect(() => () => { if (pratinjau) URL.revokeObjectURL(pratinjau); }, [pratinjau]);

  const pilihFoto = async (e) => {
    const berkas = e.target.files?.[0];
    if (!berkas) return;
    const kecil = await kecilkanFoto(berkas);
    setFoto(kecil);
    setPratinjau(URL.createObjectURL(kecil));
  };

  const siap = lokasi && foto && (!nonSesi || tujuan.trim());

  const simpan = async () => {
    if (!siap || menyimpan) return;
    setMenyimpan(true);
    try {
      const fd = new FormData();
      fd.append('lat', String(lokasi.lat));
      fd.append('lng', String(lokasi.lng));
      fd.append('akurasi', String(lokasi.akurasi));
      fd.append('foto', foto);
      if (mode === 'mulai') {
        if (sesi) fd.append('sesi_id', String(sesi.id));
        if (nonSesi) { fd.append('tujuan', tujuan.trim()); fd.append('alamat', alamat.trim()); }
        await apiClient.post('/starfoto/dinas-luar/mulai/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        notifySuccess('Dinas dimulai', 'Lokasi & foto kedatangan tercatat.');
      } else {
        await apiClient.post(`/starfoto/dinas-luar/${dinasId}/selesai/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        notifySuccess('Dinas selesai', 'Lokasi & foto selesai tercatat.');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan dinas luar.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800">{mode === 'mulai' ? 'Mulai Dinas' : 'Selesai Dinas'}</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400" aria-label="Tutup"><X size={20} /></button>
        </div>
        {sesi && <p className="text-sm text-slate-600">{sesi.pelanggan} · {sesi.paket}{sesi.alamat ? ` · ${sesi.alamat}` : ''}</p>}

        {nonSesi && mode === 'mulai' && (
          <div className="space-y-2">
            <input value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="Tujuan dinas (wajib)" className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" />
            <input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat / lokasi (opsional)" className="w-full rounded-xl border border-slate-300 p-2.5 text-sm" />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 font-semibold text-slate-700"><MapPin size={16} /> Lokasi GPS</p>
            <button type="button" onClick={cariLokasi} disabled={mencari} className="flex items-center gap-1 text-xs font-bold text-[#0088FF] disabled:opacity-50">
              <RefreshCw size={12} className={mencari ? 'animate-spin' : ''} /> Perbarui
            </button>
          </div>
          {mencari && <p className="mt-1 text-slate-500">Mencari lokasi...</p>}
          {lokasi && !mencari && (
            <p className="mt-1 text-slate-600">
              {lokasi.lat.toFixed(5)}, {lokasi.lng.toFixed(5)} · akurasi ±{lokasi.akurasi} m
              {lokasi.akurasi > 100 && <span className="block text-xs text-amber-700">Akurasi rendah, coba di tempat terbuka lalu Perbarui.</span>}
            </p>
          )}
          {galatLokasi && <p className="mt-1 text-xs text-rose-600">{galatLokasi}</p>}
        </div>

        <label className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 p-3 text-center text-sm text-slate-600">
          {pratinjau
            ? <img src={pratinjau} alt="Selfie" className="mx-auto max-h-56 rounded-lg" />
            : <span className="flex flex-col items-center gap-1"><Camera size={28} /> Ambil selfie di lokasi</span>}
          <input type="file" accept="image/*" capture="user" onChange={pilihFoto} className="hidden" />
        </label>

        <button
          type="button" onClick={simpan} disabled={!siap || menyimpan}
          className="w-full rounded-xl bg-[#0088FF] py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {menyimpan ? 'Menyimpan...' : mode === 'mulai' ? 'Mulai Dinas' : 'Selesai Dinas'}
        </button>
      </div>
    </div>
  );
}
