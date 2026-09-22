import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { statusIdle } from '../utils/idleTimeout';

// AKS-06: dipasang sekali di root (App.jsx, di dalam BrowserRouter) sehingga aktif
// di semua halaman yang butuh login, dan mati sendiri saat tidak ada user (mis. di
// /login). Sesi per-tab (lihat authSession.js) -> guard ini juga per-tab, sengaja
// TIDAK disinkronkan lewat localStorage antar tab: aktivitas di tab akun A tidak
// boleh memperpanjang sesi tab akun B di komputer yang sama.
const EVENT_AKTIVITAS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'click'];
const CEK_SETIAP_MS = 5000;

export default function IdleLogoutGuard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const lastActivityRef = useRef(Date.now());
  const [sisaDetik, setSisaDetik] = useState(null); // null = peringatan tidak tampil

  // Ref murah (tidak memicu render) -- throttling tidak perlu, tiap event cuma
  // menulis satu angka. Re-render hanya terjadi saat status peringatan berubah.
  const catatAktivitas = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSisaDetik((s) => (s !== null ? null : s));
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    lastActivityRef.current = Date.now();
    EVENT_AKTIVITAS.forEach((ev) => window.addEventListener(ev, catatAktivitas, { passive: true }));
    return () => EVENT_AKTIVITAS.forEach((ev) => window.removeEventListener(ev, catatAktivitas));
  }, [user, catatAktivitas]);

  useEffect(() => {
    if (!user) return undefined;

    const cek = () => {
      const { harusLogout, perluPeringatan, sisaDetik: sisa } = statusIdle(lastActivityRef.current);
      if (harusLogout) {
        logout();
        navigate('/login', { replace: true, state: { alasan: 'idle' } });
        return;
      }
      setSisaDetik(perluPeringatan ? sisa : null);
    };

    // Cek langsung saat mount & saat tab kembali terlihat -- jangan tunggu interval
    // pertama, supaya tab yang lama di-background langsung ter-logout begitu dibuka
    // lagi, bukan baru CEK_SETIAP_MS kemudian.
    cek();
    const interval = setInterval(cek, CEK_SETIAP_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') cek();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, logout, navigate]);

  if (!user || sisaDetik === null) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-[revealUp_0.2s_ease]">
        <h2 className="text-lg font-bold text-slate-800">Sesi akan berakhir</h2>
        <p className="text-sm text-slate-500 mt-2">
          Tidak ada aktivitas selama hampir 30 menit. Anda akan keluar otomatis dalam{' '}
          <span className="font-bold text-rose-600">{sisaDetik}</span> detik.
        </p>
        <button
          type="button"
          onClick={catatAktivitas}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl cursor-pointer"
        >
          Saya masih di sini
        </button>
      </div>
    </div>
  );
}
