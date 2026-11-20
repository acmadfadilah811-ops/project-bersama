import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { aktifkanPush, dukungPush, izinNotifikasi } from '../utils/webPush';

// Ajakan "Izinkan notifikasi" (2026-10-21) untuk staff yang menerima order (mis. fotografer).
// Bila sudah diizinkan, perangkat didaftarkan ulang diam-diam setiap login supaya langganan
// selalu tersimpan di server.
export default function AktifkanNotifikasi() {
  const [izin, setIzin] = useState(izinNotifikasi());
  const [tutup, setTutup] = useState(() => {
    try {
      return sessionStorage.getItem('tutup_ajakan_notif') === '1';
    } catch {
      return false;
    }
  });
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (izin === 'granted') aktifkanPush().catch(() => {});
  }, [izin]);

  if (!dukungPush() || izin === 'granted' || tutup) return null;

  const aktifkan = async () => {
    setProses(true);
    try {
      setIzin(await aktifkanPush({ minta: true }));
    } catch {
      setIzin(izinNotifikasi());
    } finally {
      setProses(false);
    }
  };
  const sembunyikan = () => {
    setTutup(true);
    try {
      sessionStorage.setItem('tutup_ajakan_notif', '1');
    } catch {
      // abaikan
    }
  };

  return (
    <div className="mb-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <BellRing size={18} className="mt-0.5 shrink-0 text-slate-600" />
      <div className="flex-1">
        {izin === 'denied' ? (
          <>
            <p className="font-semibold text-slate-800">Notifikasi diblokir di browser ini</p>
            <p className="text-xs text-slate-500">
              Buka ikon gembok di samping alamat situs &rarr; Notifikasi &rarr; Izinkan, lalu muat ulang halaman.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-slate-800">Aktifkan notifikasi order baru</p>
            <p className="text-xs text-slate-500">Supaya order baru tetap muncul di HP/komputer walaupun ERP sedang ditutup.</p>
            <button
              type="button" onClick={aktifkan} disabled={proses}
              className="mt-2 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {proses ? 'Memproses…' : 'Izinkan Notifikasi'}
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={sembunyikan} aria-label="Tutup" className="rounded p-1 text-slate-400 hover:bg-slate-100">
        <X size={16} />
      </button>
    </div>
  );
}
