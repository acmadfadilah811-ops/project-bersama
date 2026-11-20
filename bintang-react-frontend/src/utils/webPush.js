import apiClient from '../api/apiClient';

// Web Push (2026-10-21): daftarkan perangkat ini supaya notifikasi order muncul walaupun
// tab ERP ditutup. Lihat public/sw-push.js dan api/services/web_push.py.

export const dukungPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const izinNotifikasi = () => (dukungPush() ? Notification.permission : 'unsupported');

function keUint8(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const mentah = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...mentah].map((c) => c.charCodeAt(0)));
}

async function daftarkanSw() {
  return navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
}

/** Simpan langganan perangkat ini ke server. `minta=true` memunculkan dialog izin browser. */
export async function aktifkanPush({ minta = false } = {}) {
  if (!dukungPush()) return 'unsupported';
  let izin = Notification.permission;
  if (izin === 'default' && minta) izin = await Notification.requestPermission();
  if (izin !== 'granted') return izin;

  const reg = await daftarkanSw();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await apiClient.get('/push/kunci-publik/');
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keUint8(data.kunci) });
  }
  await apiClient.post('/push/langganan/', sub.toJSON());
  return 'granted';
}
