// FE-16: Ekstraksi pesan error API yang ramah-pengguna dari error axios.
// Interceptor di apiClient.js sudah menandai err.isTimeout / err.isNetworkError /
// err.isServerError. Fungsi ini merangkum semuanya menjadi satu pesan berbahasa
// Indonesia yang bisa langsung ditampilkan ke pengguna.

export function getApiErrorMessage(err, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!err) return fallback;

  // Request dibatalkan (AbortController) bukan error yang perlu ditampilkan.
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return null;

  if (err.isTimeout) return 'Koneksi ke server timeout. Periksa jaringan Anda lalu coba lagi.';
  if (err.isNetworkError) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';

  const data = err.response?.data;
  const status = err.response?.status;

  if (data) {
    if (typeof data === 'string') return data;
    const direct = data.error || data.detail || data.message;
    if (typeof direct === 'string') return direct;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return String(data.non_field_errors[0]);
    }
    // Error validasi per-field: ambil pesan pertama yang tersedia.
    if (typeof data === 'object') {
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val) && val.length) return `${key}: ${val[0]}`;
        if (typeof val === 'string') return `${key}: ${val}`;
      }
    }
  }

  if (status === 403) return 'Anda tidak memiliki akses untuk tindakan ini.';
  if (status === 404) return 'Data yang diminta tidak ditemukan.';
  if (status >= 500 || err.isServerError) return 'Server sedang bermasalah. Silakan coba beberapa saat lagi.';

  return err.message || fallback;
}
