import { QZTrayError, printQzDokumen, printQzReceipt } from './qzTrayService';

const LOCAL_PRINTER_SETTINGS_KEY = 'bintang_pos_printer_settings';

export const DEFAULT_LOCAL_PRINTER_SETTINGS = Object.freeze({
  printerName: '',
  printerProfile: 'generic',
  paperSize: '80mm',
  connectionMode: 'browser',
  autoPrintReceipt: false,
  // Dokumen A4 lain di PC ini (2026-11-02): { invoice|spk|surat_jalan: { auto, printerName } }.
  // Dicetak lewat QZ Tray ke printer masing-masing (USB/Bluetooth yang terpasang di Windows).
  dokumen: {},
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
    autoPrintDokumen: ext.auto_print_dokumen !== false,
    useA4ReceiptLayout: Boolean(ext.pos_custom_resi_windows),
  };
}

export function shouldAutoPrintPosReceipt(businessSettings) {
  return getPrintPolicy(businessSettings).autoPrintPosReceipt
    && getLocalPrinterSettings().autoPrintReceipt;
}

/** Pengaturan cetak satu jenis dokumen di PC ini: { auto, printerName }. */
export function getDokumenPrinter(type, localSettings = getLocalPrinterSettings()) {
  const baris = localSettings?.dokumen?.[type] || {};
  return { auto: Boolean(baris.auto), printerName: baris.printerName || '' };
}

/** Jenis dokumen yang harus dicetak otomatis begitu transaksi selesai (kebijakan global + profil PC ini). */
export function jenisDokumenOtomatis(businessSettings, localSettings = getLocalPrinterSettings()) {
  if (!getPrintPolicy(businessSettings).autoPrintDokumen) return [];
  return ['invoice', 'spk', 'surat_jalan'].filter((type) => {
    const cfg = getDokumenPrinter(type, localSettings);
    return cfg.auto && cfg.printerName;
  });
}

/** Cetak dokumen ke printer yang diatur di PC ini; return false bila tidak ada printer khusus (pakai dialog browser). */
export async function printDokumen({ type, data, businessSettings, localSettings = getLocalPrinterSettings() }) {
  const { printerName } = getDokumenPrinter(type, localSettings);
  if (!printerName) return false;
  await printQzDokumen({ type, data, settings: businessSettings, printerName });
  return true;
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
