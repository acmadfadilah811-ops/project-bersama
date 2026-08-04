import axios from 'axios';
import authSession from '../utils/authSession';

// Ganti URL fallback ke Cloudflare Tunnel untuk testing via Netlify
// Ganti URL fallback ke URL Ngrok / production nanti
const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Otomatis pasang JWT token di setiap request
apiClient.interceptors.request.use((config) => {
  const token = authSession.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto Refresh Token ────────────────────────────────────────────────
// Jika 401, coba refresh dulu pakai refresh_token.
// Kalau refresh juga gagal, baru redirect ke login.
let isRefreshing = false;
let failedQueue = []; // antrian request yang pending saat refresh berlangsung

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 1. Timeout / Network / 5xx error handling and client-side labeling
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('[API Connection Timeout]:', error.config?.url);
      error.isTimeout = true;
    } else if (!error.response) {
      console.error('[API Network Error]: No response received from server. Check internet connection.', error);
      error.isNetworkError = true;
    } else if (error.response.status >= 500) {
      console.error(`[API Server Error ${error.response.status}]:`, error.response.data || error.message);
      error.isServerError = true;
    }

    const originalRequest = error.config;

    // Hanya proses 401 dan yang belum pernah di-retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = authSession.getRefreshToken();

      // Kalau tidak ada refresh token sama sekali → langsung logout
      if (!refreshToken) {
        authSession.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // Kalau sedang refresh, masukkan ke antrian
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Minta access token baru pakai refresh token
        const { data } = await axios.post(`${BASE_URL.replace(/\/api$/, '')}/api/auth/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = data.access;
        authSession.setAccessToken(newAccessToken);

        // Update header default untuk semua request berikutnya
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

        // Selesaikan semua request yang tertahan
        processQueue(null, newAccessToken);

        // Ulangi request asli dengan token baru
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh gagal → hapus semua token & paksa login
        processQueue(refreshError, null);
        authSession.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
