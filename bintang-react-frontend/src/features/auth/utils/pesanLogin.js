import { formatSisaWaktu } from './kriteriaSandi';

// Pesan error login: menyebut sisa percobaan (401) atau lama kunci sementara (429).
export function pesanLoginGagal(err) {
  const status = err?.response?.status;
  const data = err?.response?.data || {};
  if (status === 429 && data.retry_after) {
    return `${data.detail} Coba lagi dalam ${formatSisaWaktu(data.retry_after)} menit, atau hubungi Owner/Manager untuk membuka kunci.`;
  }
  if (status === 401 && typeof data.sisa_percobaan === 'number') {
    return data.sisa_percobaan <= 2
      ? `${data.detail} Sisa percobaan: ${data.sisa_percobaan}. Setelah itu akun dikunci sementara.`
      : data.detail;
  }
  return data.detail || 'Username atau password salah.';
}
