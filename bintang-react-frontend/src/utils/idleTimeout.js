// AKS-06: sesi berakhir otomatis setelah tidak aktif 30 menit (disepakati dgn user
// 2026-09-22), terpisah dari umur token JWT (akses 1 jam, refresh 7 hari — itu murni
// batas usia token, bukan deteksi tidak-aktif; lihat AuthContext.logout() untuk
// pencabutan token di server saat idle-logout terjadi).
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000; // tampilkan peringatan 1 menit sebelum keluar

/** Status idle murni dari selisih waktu -- tanpa DOM/timer, gampang diuji. */
export function statusIdle(lastActivityAt, now = Date.now()) {
  const diam = now - lastActivityAt;
  const sisaSebelumLogout = IDLE_LIMIT_MS - diam;
  return {
    harusLogout: diam >= IDLE_LIMIT_MS,
    perluPeringatan: sisaSebelumLogout > 0 && sisaSebelumLogout <= IDLE_WARNING_MS,
    sisaDetik: Math.max(0, Math.ceil(sisaSebelumLogout / 1000)),
  };
}
