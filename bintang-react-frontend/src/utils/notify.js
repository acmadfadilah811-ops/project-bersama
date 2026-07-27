// FE-16: Jembatan notifikasi global agar penanganan error bisa dipakai di mana
// saja, termasuk di luar komponen React / helper non-hook. Provider UI
// (DynamicIslandProvider) mendaftarkan handler nyata via registerNotifier; bila
// belum ada handler, pesan tetap tercatat di console sebagai fallback.

import { getApiErrorMessage } from './apiError';

let notifier = null;

export function registerNotifier(fn) {
  notifier = typeof fn === 'function' ? fn : null;
}

export function notify({ type = 'info', title = '', message = '' }) {
  if (!message) return;
  if (notifier) {
    notifier({ type, title, message });
  } else if (type === 'error') {
    console.error(`[notify:${type}] ${title} - ${message}`);
  } else {
    console.log(`[notify:${type}] ${title} - ${message}`);
  }
}

export function notifyError(title, message) {
  notify({ type: 'error', title: title || 'Terjadi Kesalahan', message });
}

export function notifySuccess(title, message) {
  notify({ type: 'success', title: title || 'Berhasil', message });
}

// Helper utama untuk blok catch: tampilkan pesan error API ke pengguna.
// Mengembalikan pesan yang ditampilkan (atau null bila request dibatalkan).
export function notifyApiError(err, fallback) {
  const message = getApiErrorMessage(err, fallback);
  if (!message) return null; // request dibatalkan -> jangan ganggu pengguna
  notify({ type: 'error', title: 'Terjadi Kesalahan', message });
  return message;
}
