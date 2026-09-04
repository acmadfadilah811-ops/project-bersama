const ESC = '\x1B';
const LF = '\x0A';
const TM_U220_COLUMNS = 36;

const toText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\s+/g, ' ')
  .trim();

const toNumber = (value) => Number(value) || 0;
const money = (value) => `Rp${Math.round(toNumber(value)).toLocaleString('id-ID')}`;
const divider = () => '-'.repeat(TM_U220_COLUMNS);

function wrap(text, width = TM_U220_COLUMNS) {
  const words = toText(text).split(' ').filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let line = '';
  words.forEach((word) => {
    if (word.length > width) {
      if (line) lines.push(line);
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
      line = '';
    } else if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function row(left, right) {
  const safeLeft = toText(left);
  const safeRight = toText(right);
  const available = TM_U220_COLUMNS - safeRight.length - 1;
  const leftLines = wrap(safeLeft, Math.max(1, available));
  const result = leftLines.slice(0, -1);
  const last = leftLines[leftLines.length - 1] || '';
  result.push(`${last.slice(0, available).padEnd(available, ' ')} ${safeRight}`);
  return result;
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('id-ID');
}

export function buildTmU220Receipt(receipt, settings) {
  const storeName = toText(settings?.nama_usaha || settings?.business_name || 'StarPhoto & Advertising');
  const customer = toText(receipt?.pelanggan_name || receipt?.customer_name || 'Pelanggan umum');
  const items = Array.isArray(receipt?.items) ? receipt.items : [];
  const lines = [
    ESC + '@',
    ESC + 'a' + '\x01',
    ...wrap(storeName),
    'RESI PENJUALAN',
    ESC + 'a' + '\x00',
    divider(),
    ...row('No.', receipt?.nomor || '-'),
    ...row('Tanggal', formatDate(receipt?.created_at)),
    ...row('Pelanggan', customer),
    divider(),
  ];

  items.forEach((item) => {
    lines.push(...wrap(item?.nama_snapshot || item?.nama_produk || item?.product_name || 'Item'));
    const quantity = `${toNumber(item?.qty)} ${toText(item?.uom_kode || item?.satuan || 'pcs')}`;
    lines.push(...row(`${quantity} x ${money(item?.harga_snapshot ?? item?.harga)}`, money(item?.subtotal)));
  });

  lines.push(divider(), ...row('Subtotal', money(receipt?.subtotal)));
  if (toNumber(receipt?.diskon)) lines.push(...row('Diskon', `-${money(receipt.diskon)}`));
  if (toNumber(receipt?.pajak)) lines.push(...row('Pajak', money(receipt.pajak)));
  lines.push(
    ESC + 'E' + '\x01',
    ...row('TOTAL', money(receipt?.total)),
    ESC + 'E' + '\x00',
    ...row('Dibayar', money(receipt?.dibayar)),
    ...row('Kembalian', money(receipt?.kembalian)),
    divider(),
    ESC + 'a' + '\x01',
    'Terima kasih',
    ESC + 'a' + '\x00',
    '', '', '',
  );
  return lines.join(LF);
}

export const TM_U220_70_PROFILE = 'epson-tm-u220-70';
