const PAPER_WIDTH_MM = {
  '58mm': 58,
  '80mm': 80,
  a4: 210,
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatCurrency = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
}).format(Number(value || 0));

export function getPaperWidthInches(paperSize) {
  return (PAPER_WIDTH_MM[paperSize] || PAPER_WIDTH_MM['80mm']) / 25.4;
}

export function buildQzReceiptHtml({ receipt, settings, paperSize }) {
  const isA4 = paperSize === 'a4' || settings?.pos_ext_settings?.pos_custom_resi_windows;
  const widthMm = isA4 ? PAPER_WIDTH_MM.a4 : (PAPER_WIDTH_MM[paperSize] || PAPER_WIDTH_MM['80mm']);
  const items = receipt?.items || [];
  const itemRows = items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.nama_snapshot || item.nama || 'Item')}</strong><br>
        <small>${escapeHtml(item.qty || 0)} ${escapeHtml(item.uom_kode || 'pcs')} x ${escapeHtml(formatCurrency(item.harga_snapshot ?? item.harga))}</small>
      </td>
      <td class="right">${escapeHtml(formatCurrency(item.subtotal ?? item.hargaTotal))}</td>
    </tr>`).join('');
  const customer = receipt?.pelanggan_name || receipt?.customerName;
  const documentTitle = receipt?.documentTitle || settings?.pos_resi_judul || 'RESI PEMBELIAN';

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { margin: 0; size: ${widthMm}mm auto; }
  * { box-sizing: border-box; }
  body { width: ${widthMm}mm; margin: 0; padding: ${isA4 ? '12mm' : '3mm'}; color: #000; font: ${isA4 ? '11pt' : '10pt'} Arial, sans-serif; }
  h1, h2, p { margin: 0; } .center { text-align: center; } .right { text-align: right; white-space: nowrap; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; } table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 0; vertical-align: top; } small { font-size: 0.85em; } .total { font-weight: 700; font-size: 1.1em; }
</style></head><body>
  <div class="center"><h1>${escapeHtml(settings?.nama_bisnis || 'BINTANG ADVERTISING')}</h1>
  <h2>${escapeHtml(documentTitle)}</h2>
  <p>${escapeHtml(new Date(receipt?.created_at || Date.now()).toLocaleString('id-ID'))}</p></div>
  <div class="divider"></div>
  <table><tr><td>Nota</td><td class="right">${escapeHtml(receipt?.nomor || '-')}</td></tr>
  <tr><td>Kasir</td><td class="right">${escapeHtml(receipt?.kasir_name || 'POS')}</td></tr>
  ${customer ? `<tr><td>Pelanggan</td><td class="right">${escapeHtml(customer)}</td></tr>` : ''}</table>
  <div class="divider"></div><table>${itemRows}</table><div class="divider"></div>
  <table><tr><td>Subtotal</td><td class="right">${escapeHtml(formatCurrency(receipt?.subtotal))}</td></tr>
  ${Number(receipt?.diskon || 0) ? `<tr><td>Diskon</td><td class="right">-${escapeHtml(formatCurrency(receipt.diskon))}</td></tr>` : ''}
  ${Number(receipt?.pajak || 0) ? `<tr><td>Pajak</td><td class="right">${escapeHtml(formatCurrency(receipt.pajak))}</td></tr>` : ''}
  <tr class="total"><td>Total</td><td class="right">${escapeHtml(formatCurrency(receipt?.total))}</td></tr>
  ${receipt?.isDraft ? '<tr><td colspan="2" class="total">STATUS: BELUM DIBAYAR</td></tr>' : `<tr><td>Dibayar</td><td class="right">${escapeHtml(formatCurrency(receipt?.dibayar))}</td></tr>
  <tr><td>Kembalian</td><td class="right">${escapeHtml(formatCurrency(receipt?.kembalian))}</td></tr>`}</table>
  ${settings?.pos_resi_catatan ? `<div class="divider"></div><p class="center">${escapeHtml(settings.pos_resi_catatan)}</p>` : ''}
</body></html>`;
}
