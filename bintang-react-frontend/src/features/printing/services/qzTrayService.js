import qz from 'qz-tray';
import apiClient from '../../../api/apiClient';
import { buildQzReceiptHtml, getPaperWidthInches } from './qzReceiptHtml';
import { cetakConfig } from './receiptConfig';
import logoBawaan from '../../../assets/logo-starfoto.png';
import { buildTmU220Receipt, TM_U220_70_PROFILE } from './qzTmU220Receipt';

let securityConfigured = false;

export class QZTrayError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QZTrayError';
  }
}

const getErrorMessage = (error) => error?.response?.data?.detail
  || error?.message
  || 'QZ Tray tidak dapat dihubungkan.';

function configureQzSecurity() {
  if (securityConfigured) return;

  qz.security.setCertificatePromise(async () => {
    const response = await apiClient.get('/integrations/qz/certificate/');
    return response.data.certificate;
  });
  qz.security.setSignatureAlgorithm('SHA512');
  qz.security.setSignaturePromise(async (request) => {
    const response = await apiClient.post('/integrations/qz/sign/', { request });
    return response.data.signature;
  });
  securityConfigured = true;
}

export async function connectQzTray() {
  try {
    configureQzSecurity();
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 2, delay: 1 });
    }
  } catch (error) {
    throw new QZTrayError(getErrorMessage(error));
  }
}

export async function getQzPrinters() {
  await connectQzTray();
  try {
    const printers = await qz.printers.find();
    return Array.isArray(printers) ? printers.sort((left, right) => left.localeCompare(right)) : [];
  } catch (error) {
    throw new QZTrayError(getErrorMessage(error));
  }
}

// Logo resi untuk QZ Tray (2026-10-15): QZ merender HTML sendiri dan tidak
// bisa memuat path relatif/terlindung, jadi logo diubah ke data URL dulu.
// Disimpan per URL supaya tidak diunduh ulang tiap cetak. Gagal -> tanpa logo.
const cacheLogo = new Map();
async function logoSebagaiDataUrl(url) {
  if (!url) return '';
  if (cacheLogo.has(url)) return cacheLogo.get(url);
  try {
    // Logo unggahan (/media/...) diambil lewat origin yang sama supaya tidak
    // terhalang CORS/mixed content bila API mengirim URL absolut.
    const sumber = url.includes('/media/') ? url.slice(url.indexOf('/media/')) : url;
    const res = await fetch(sumber);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const pembaca = new FileReader();
      pembaca.onload = () => resolve(pembaca.result);
      pembaca.onerror = reject;
      pembaca.readAsDataURL(blob);
    });
    cacheLogo.set(url, dataUrl);
    return dataUrl;
  } catch {
    return '';
  }
}

export async function printQzReceipt({ receipt, settings, printerName, paperSize, printerProfile }) {
  if (!printerName) throw new QZTrayError('Pilih printer QZ Tray terlebih dahulu.');

  await connectQzTray();
  try {
    const config = qz.configs.create(printerName, {
      jobName: `Resi POS ${receipt?.nomor || ''}`.trim(),
      margins: 0,
      scaleContent: false,
    });
    // TM-U220 (dot-matrix, perintah teks) tidak mencetak gambar -> tanpa logo.
    const logoDataUrl = printerProfile === TM_U220_70_PROFILE
      ? ''
      : (await logoSebagaiDataUrl(cetakConfig(settings).logoUrl)) || (await logoSebagaiDataUrl(logoBawaan));
    const data = printerProfile === TM_U220_70_PROFILE
      ? [{ type: 'raw', format: 'command', flavor: 'plain', data: buildTmU220Receipt(receipt, settings) }]
      : [{
        type: 'pixel',
        format: 'html',
        flavor: 'plain',
        data: buildQzReceiptHtml({ receipt, settings, paperSize, logoDataUrl }),
        options: { pageWidth: getPaperWidthInches(settings?.pos_ext_settings?.pos_custom_resi_windows ? 'a4' : paperSize) },
      }];
    await qz.print(config, data);
  } catch (error) {
    throw new QZTrayError(getErrorMessage(error));
  }
}
