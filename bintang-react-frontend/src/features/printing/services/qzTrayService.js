import qz from 'qz-tray';
import apiClient from '../../../api/apiClient';
import { buildQzReceiptHtml, getPaperWidthInches } from './qzReceiptHtml';

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

export async function printQzReceipt({ receipt, settings, printerName, paperSize }) {
  if (!printerName) throw new QZTrayError('Pilih printer QZ Tray terlebih dahulu.');

  await connectQzTray();
  try {
    const config = qz.configs.create(printerName, {
      jobName: `Resi POS ${receipt?.nomor || ''}`.trim(),
      margins: 0,
      scaleContent: false,
    });
    const data = [{
      type: 'pixel',
      format: 'html',
      flavor: 'plain',
      data: buildQzReceiptHtml({ receipt, settings, paperSize }),
      options: { pageWidth: getPaperWidthInches(settings?.pos_ext_settings?.pos_custom_resi_windows ? 'a4' : paperSize) },
    }];
    await qz.print(config, data);
  } catch (error) {
    throw new QZTrayError(getErrorMessage(error));
  }
}
