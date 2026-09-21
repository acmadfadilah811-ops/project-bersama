// Kriteria sandi baru pada alur Lupa Password. Harus sejalan dengan aturan server
// (users/views.py ForgotPasswordVerifyView): min. 8 karakter, memuat huruf & angka,
// tidak mirip username. "Tidak terlalu umum" hanya bisa dicek server.
export const MIN_PANJANG_SANDI = 8;

export function kriteriaSandi(sandi, username = '') {
  const nama = String(username || '').trim().toLowerCase();
  const rendah = String(sandi || '').toLowerCase();
  return [
    { id: 'panjang', label: `Minimal ${MIN_PANJANG_SANDI} karakter`, ok: sandi.length >= MIN_PANJANG_SANDI },
    { id: 'huruf', label: 'Mengandung huruf', ok: /[A-Za-z]/.test(sandi) },
    { id: 'angka', label: 'Mengandung angka', ok: /\d/.test(sandi) },
    {
      id: 'username',
      label: 'Tidak memuat username Anda',
      ok: sandi.length > 0 && !(nama.length >= 3 && rendah.includes(nama)),
    },
  ];
}

export function semuaKriteriaTerpenuhi(sandi, username) {
  return kriteriaSandi(sandi, username).every((k) => k.ok);
}

export function formatSisaWaktu(detik) {
  const d = Math.max(0, Math.ceil(detik));
  const m = Math.floor(d / 60);
  const s = d % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
