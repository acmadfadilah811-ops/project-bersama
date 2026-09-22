// Pesan error login: menyebut sisa percobaan (401) atau lama kunci sementara (429).
export function pesanLoginGagal(err) {
  const status = err?.response?.status;
  const data = err?.response?.data || {};
  if (status === 429 && data.retry_after) {
    return data.detail;
  }
  if (status === 401 && typeof data.sisa_percobaan === 'number') {
    return data.sisa_percobaan <= 2
      ? `${data.detail} Sisa percobaan: ${data.sisa_percobaan}. Setelah itu akun dikunci sementara.`
      : data.detail;
  }
  return data.detail || 'Username atau password salah.';
}

// Detik masa kunci dari jawaban 429 login (0 bila bukan penguncian).
export function detikKunciLogin(err) {
  return err?.response?.status === 429 ? Number(err.response.data?.retry_after) || 0 : 0;
}

// true bila jawaban 429 login menawarkan jalan pintas OTP untuk membuka kunci.
export function otpUnlockDitawarkan(err) {
  return err?.response?.status === 429 && !!err.response.data?.otp_diperlukan;
}

// 'akun' | 'ip' | null -- cakupan kunci dari jawaban 429 login.
export function cakupanKunci(err) {
  return err?.response?.data?.cakupan_kunci || null;
}
