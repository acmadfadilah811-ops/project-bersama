import { QZTrayError, printQzReceipt } from './qzTrayService';

const LOCAL_PRINTER_SETTINGS_KEY = 'bintang_pos_printer_settings';

export const DEFAULT_LOCAL_PRINTER_SETTINGS = Object.freeze({
  printerName: '',
  printerProfile: 'generic',
  paperSize: '80mm',
  connectionMode: 'browser',
  autoPrintReceipt: false,
});

export function getLocalPrinterSettings() {
  try {
    const saved = localStorage.getItem(LOCAL_PRINTER_SETTINGS_KEY);
    return saved
      ? { ...DEFAULT_LOCAL_PRINTER_SETTINGS, ...JSON.parse(saved) }
      : { ...DEFAULT_LOCAL_PRINTER_SETTINGS };
  } catch {
    return { ...DEFAULT_LOCAL_PRINTER_SETTINGS };
  }
}

export function saveLocalPrinterSettings(settings) {
  const next = { ...DEFAULT_LOCAL_PRINTER_SETTINGS, ...settings };
  localStorage.setItem(LOCAL_PRINTER_SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getPrintPolicy(businessSettings) {
  const ext = businessSettings?.pos_ext_settings || {};
  return {
    autoPrintPosReceipt: ext.auto_print_pos_receipt !== false,
    useA4ReceiptLayout: Boolean(ext.pos_custom_resi_windows),
  };
}

export function shouldAutoPrintPosReceipt(businessSettings) {
  return getPrintPolicy(businessSettings).autoPrintPosReceipt
    && getLocalPrinterSettings().autoPrintReceipt;
}

export function getPrintErrorMessage(error) {
  if (error instanceof QZTrayError) return error.message;
  return 'Cetak gagal diproses. Periksa pengaturan printer lalu coba lagi.';
}

export function requestBrowserPrint() {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return false;
  window.print();
  return true;
}

// Logo resi sering belum selesai dimuat saat dialog cetak dibuka (resi baru
// saja dirender) sehingga tercetak kosong. Tunggu semua gambar di area cetak,
// maksimal 3 detik (2026-10-15).
function tungguGambarCetak(batasMs = 3000) {
  if (typeof document === 'undefined') return Promise.resolve();
  const gambar = [...document.querySelectorAll('.receipt-print-area img, .print-area img')]
    .filter((img) => img.src && !img.complete);
  if (!gambar.length) return Promise.resolve();
  const semua = Promise.all(gambar.map((img) => new Promise((selesai) => {
    img.addEventListener('load', selesai, { once: true });
    img.addEventListener('error', selesai, { once: true });
  })));
  return Promise.race([semua, new Promise((selesai) => setTimeout(selesai, batasMs))]);
}

function duaFrame() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

export function requestBrowserPrintAfterRender() {
  if (typeof window === 'undefined') return;
  duaFrame().then(() => tungguGambarCetak()).then(() => requestBrowserPrint());
}

export async function printReceipt({ receipt, businessSettings, localSettings = getLocalPrinterSettings() }) {
  if (localSettings.connectionMode === 'qz') {
    await printQzReceipt({
      receipt,
      settings: businessSettings,
      printerName: localSettings.printerName,
      paperSize: localSettings.paperSize,
      printerProfile: localSettings.printerProfile,
    });
    return { channel: 'qz' };
  }

  if (!requestBrowserPrint()) throw new Error('Dialog cetak browser tidak tersedia.');
  return { channel: 'browser' };
}

export async function printReceiptAfterRender(payload) {
  if (payload.localSettings?.connectionMode === 'qz' || getLocalPrinterSettings().connectionMode === 'qz') {
    return printReceipt(payload);
  }
  await duaFrame();
  await tungguGambarCetak();
  return printReceipt(payload);
}
