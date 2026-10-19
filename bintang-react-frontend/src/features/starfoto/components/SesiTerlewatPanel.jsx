import { useCallback, useEffect, useRef, useState } from 'react';
import { AlarmClock, CalendarClock, Play, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useDynamicIsland } from '../../../context/DynamicIslandContext';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { formatJadwal } from '../hooks/useStarfoto';

// Notifikasi sesi foto yang terlewat jadwalnya tapi belum dijalankan (2026-10-19).
// Muncul untuk fotografer/asisten sesi itu dan kasir/pengelola; bisa langsung dijalankan
// atau dijadwal ulang. Dicek ulang tiap menit.
const INTERVAL_MS = 60000;
const KE_INPUT = (iso) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function lamaTerlewat(menit) {
  if (menit < 60) return `${menit} menit`;
  if (menit < 1440) return `${Math.floor(menit / 60)} jam`;
  return `${Math.floor(menit / 1440)} hari`;
}

function ModalJadwal({ sesi, onClose, onSaved }) {
  const [mulai, setMulai] = useState(KE_INPUT(new Date(Date.now() + 3600000).toISOString()));
  const [durasi, setDurasi] = useState(sesi.durasi_menit);
  const [alamat, setAlamat] = useState(sesi.alamat || '');
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = async () => {
    setMenyimpan(true);
    try {
      await apiClient.post(`/starfoto/sesi/${sesi.id}/jadwal/`, {
        mulai: new Date(mulai).toISOString(), durasi_menit: Number(durasi) || sesi.durasi_menit, alamat,
      });
      notifySuccess('Jadwal diubah', `Sesi ${sesi.pelanggan} dijadwalkan ulang.`);
      onSaved();
      onClose();
    } catch (err) {
      notifyApiError(err, 'Gagal mengubah jadwal.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-slate-800">Ubah Jadwal Sesi</p>
            <p className="text-xs text-slate-500">{sesi.pelanggan} · {sesi.paket}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <label className="block text-xs font-bold text-slate-500">Jadwal baru</label>
        <input
          type="datetime-local" value={mulai} onChange={(e) => setMulai(e.target.value)}
          className="mb-3 mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
        />
        <label className="block text-xs font-bold text-slate-500">Durasi (menit)</label>
        <input
          type="number" min="1" value={durasi} onChange={(e) => setDurasi(e.target.value)}
          className="mb-3 mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
        />
        {sesi.lokasi === 'outdoor' && (
          <>
            <label className="block text-xs font-bold text-slate-500">Alamat / tempat</label>
            <input
              value={alamat} onChange={(e) => setAlamat(e.target.value)}
              className="mb-3 mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm"
            />
          </>
        )}
        <button
          type="button" onClick={simpan} disabled={menyimpan || !mulai}
          className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {menyimpan ? 'Menyimpan…' : 'Simpan Jadwal'}
        </button>
      </div>
    </div>
  );
}

export default function SesiTerlewatPanel({ onChanged }) {
  const { user } = useAuth();
  const { triggerNotification } = useDynamicIsland() || {};
  const [daftar, setDaftar] = useState([]);
  const [ubah, setUbah] = useState(null);
  const [proses, setProses] = useState(null);
  const sudahDilihat = useRef(null);

  const muat = useCallback(async () => {
    try {
      const res = await apiClient.get('/starfoto/sesi-terlewat/');
      const data = Array.isArray(res.data) ? res.data : [];
      // Pop-up hanya untuk sesi terlewat yang baru muncul setelah halaman dibuka.
      if (sudahDilihat.current && triggerNotification) {
        const baru = data.find((s) => !sudahDilihat.current.has(s.id));
        if (baru) triggerNotification({ type: 'announcement', title: 'Sesi foto terlewat', message: `${baru.pelanggan} · ${baru.paket} belum dijalankan.` });
      }
      sudahDilihat.current = new Set(data.map((s) => s.id));
      setDaftar(data);
    } catch {
      // notifikasi bersifat tambahan; abaikan bila gagal
    }
  }, [triggerNotification]);

  useEffect(() => {
    muat();
    const t = setInterval(muat, INTERVAL_MS);
    return () => clearInterval(t);
  }, [muat]);

  const setelahUbah = () => { muat(); if (onChanged) onChanged(); };

  const jalankan = async (sesi) => {
    setProses(sesi.id);
    try {
      await apiClient.post(`/starfoto/sesi/${sesi.id}/mulai/`);
      notifySuccess('Sesi dimulai', 'Selamat bekerja!');
      setelahUbah();
    } catch (err) {
      notifyApiError(err, 'Gagal menjalankan sesi.');
    } finally {
      setProses(null);
    }
  };

  if (!daftar.length) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-3">
      <p className="flex items-center gap-2 text-sm font-bold text-rose-900">
        <AlarmClock size={16} /> {daftar.length} sesi foto terlewat jadwal
      </p>
      {daftar.map((sesi) => {
        const petugas = sesi.fotografer === user?.id || sesi.asisten === user?.id;
        return (
          <div key={sesi.id} className="rounded-xl bg-white p-3 text-sm">
            <p className="font-bold text-slate-800">{sesi.pelanggan} <span className="font-normal text-slate-500">· {sesi.paket} · Sesi {sesi.urutan}</span></p>
            <p className="text-xs text-slate-500">
              Jadwal {formatJadwal(sesi.mulai)} · terlewat {lamaTerlewat(sesi.terlewat_menit)}
              {sesi.fotografer_nama ? ` · ${sesi.fotografer_nama}` : ' · belum ada fotografer'}
            </p>
            <div className="mt-2 flex gap-2">
              {petugas && (
                <button
                  type="button" onClick={() => jalankan(sesi)} disabled={proses === sesi.id}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  <Play size={14} /> Jalankan Sekarang
                </button>
              )}
              <button
                type="button" onClick={() => setUbah(sesi)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 py-2 text-xs font-bold text-slate-700"
              >
                <CalendarClock size={14} /> Ubah Jadwal
              </button>
            </div>
          </div>
        );
      })}
      {ubah && <ModalJadwal sesi={ubah} onClose={() => setUbah(null)} onSaved={setelahUbah} />}
    </div>
  );
}
