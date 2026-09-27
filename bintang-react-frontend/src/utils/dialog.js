// Dialog konfirmasi & input berbasis UI (pengganti window.confirm / window.prompt
// bawaan browser, 2026-09-27). Berbeda dengan versi browser, keduanya ASINKRON:
//   if (!(await uiConfirm('Hapus data ini?'))) return;
//   const alasan = await uiPrompt('Alasan pembatalan:');   // null bila dibatalkan
// Tampilan dirender oleh <ConfirmDialogHost /> yang dipasang sekali di App.jsx.
// Bila host belum terpasang (mis. di luar aplikasi), jatuh ke dialog browser.

let host = null;

export function registerDialogHost(fn) {
  host = typeof fn === 'function' ? fn : null;
}

const KATA_BERBAHAYA = /(hapus|batal|void|refund|nonaktif|reset|tolak|keluar|kosongkan|hilang)/i;

export function uiConfirm(message, options = {}) {
  const pesan = String(message ?? '');
  if (!host) return Promise.resolve(window.confirm(pesan));
  return new Promise((resolve) => {
    host({
      kind: 'confirm',
      message: pesan,
      title: options.title || 'Konfirmasi',
      confirmText: options.confirmText || 'Ya, lanjutkan',
      cancelText: options.cancelText || 'Batal',
      danger: options.danger ?? KATA_BERBAHAYA.test(pesan),
      resolve,
    });
  });
}

export function uiPrompt(message, defaultValue = '', options = {}) {
  const pesan = String(message ?? '');
  if (!host) return Promise.resolve(window.prompt(pesan, defaultValue));
  return new Promise((resolve) => {
    host({
      kind: 'prompt',
      message: pesan,
      title: options.title || 'Masukkan data',
      confirmText: options.confirmText || 'Simpan',
      cancelText: options.cancelText || 'Batal',
      defaultValue: defaultValue == null ? '' : String(defaultValue),
      danger: false,
      resolve,
    });
  });
}
