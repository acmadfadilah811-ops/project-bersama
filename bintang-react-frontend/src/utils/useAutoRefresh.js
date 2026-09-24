import { useEffect, useRef } from 'react';

/**
 * Panggil `callback` otomatis tiap tab kembali aktif dan tiap `intervalMs`
 * selama tab terlihat (2026-09-24, instruksi user: perubahan produk di menu
 * Produk harus otomatis terbaca di Kasir, Buat Order, dan Antrean WA tanpa
 * kasir/staff menekan sync atau reload halaman).
 *
 * `callback` boleh berganti tiap render (disimpan di ref), jadi pemanggil tidak
 * perlu useCallback. Kegagalan callback ditelan -- refresh latar belakang tidak
 * boleh mengganggu layar yang sedang dipakai.
 */
export default function useAutoRefresh(callback, { intervalMs = 60000, enabled = true } = {}) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const jalankan = () => {
      if (document.visibilityState !== 'visible') return;
      Promise.resolve()
        .then(() => callbackRef.current())
        .catch(() => {});
    };

    const timer = setInterval(jalankan, intervalMs);
    document.addEventListener('visibilitychange', jalankan);
    window.addEventListener('focus', jalankan);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', jalankan);
      window.removeEventListener('focus', jalankan);
    };
  }, [intervalMs, enabled]);
}
