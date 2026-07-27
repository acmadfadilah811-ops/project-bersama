import { encode } from './code128';

/**
 * Menyusun seluruh lembar label menjadi satu SVG, lalu mengunduhnya sebagai PNG.
 *
 * Dipakai tombol "Unduh PNG" di BarcodePage: hasilnya bisa disimpan, dikirim ke
 * tukang cetak, atau diarsipkan tanpa lewat dialog print.
 *
 * Encoder Code 128 diambil dari code128.js — satu sumber dengan preview, supaya
 * barcode di layar dan di file unduhan tidak mungkin berbeda.
 */

// 300 dpi: resolusi yang cukup agar batang barcode tetap tajam saat dicetak.
const PX_PER_MM = 300 / 25.4;

/** Nama produk berasal dari database — harus di-escape sebelum masuk XML. */
function xml(value) {
  return String(value ?? '').replace(/[<>&'"]/g, (c) => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
  ));
}

const rupiah = (v) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(v) || 0);

// Teks SVG tidak mengenal text-overflow: ellipsis seperti preview HTML-nya,
// jadi nama panjang harus dipotong sendiri — kalau tidak, ia meluber ke label
// tetangga dan hasil PNG berbeda dari yang dilihat di layar.
let _ukur;
function lebarTeks(teks, fontSize, tebal) {
  if (!_ukur) _ukur = document.createElement('canvas').getContext('2d');
  _ukur.font = `${tebal ? 'bold ' : ''}${fontSize}px Arial, sans-serif`;
  return _ukur.measureText(teks).width;
}

/** Potong dengan elipsis agar muat dalam `maksLebar`, diukur bukan ditaksir. */
function potong(teks, maksLebar, fontSize, tebal = false) {
  const isi = String(teks ?? '');
  if (!isi || lebarTeks(isi, fontSize, tebal) <= maksLebar) return isi;
  let bawah = 0;
  let atas = isi.length;
  while (bawah < atas) {
    const tengah = Math.ceil((bawah + atas) / 2);
    if (lebarTeks(`${isi.slice(0, tengah)}…`, fontSize, tebal) <= maksLebar) bawah = tengah;
    else atas = tengah - 1;
  }
  return `${isi.slice(0, bawah)}…`;
}

// Jarak baseline-ke-baseline. Nilai di bawah ~1.2 membuat huruf bertumpukan.
const LINE = 1.3;

function barcodeMarkup(value, x, y, lebar, tinggi, fontSize) {
  const { text, modules } = encode(value);
  if (!text) return '';
  const quiet = 10;
  const isi = modules.reduce((s, m) => s + m.width, 0);
  const skala = lebar / (isi + quiet * 2);
  let cursor = x + quiet * skala;
  let out = '';
  for (const m of modules) {
    const w = m.width * skala;
    if (m.bar) out += `<rect x="${cursor.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${tinggi.toFixed(2)}" fill="#111827"/>`;
    cursor += w;
  }
  out += `<text x="${(x + lebar / 2).toFixed(2)}" y="${(y + tinggi + fontSize).toFixed(2)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize.toFixed(1)}" fill="#111827">${xml(text)}</text>`;
  return out;
}

export function buildSheetSvg(labels, preset, options) {
  const w = preset.width * PX_PER_MM;
  const h = preset.height * PX_PER_MM;
  const gap = preset.gap * PX_PER_MM;
  const cols = Math.max(1, preset.columns);
  const baris = Math.ceil(labels.length / cols);
  const totalW = cols * w + (cols - 1) * gap;
  const totalH = Math.max(1, baris) * h + Math.max(0, baris - 1) * gap;
  const pad = 2 * PX_PER_MM;

  let body = '';
  labels.forEach((item, i) => {
    const x = (i % cols) * (w + gap);
    const y = Math.floor(i / cols) * (h + gap);
    const nama = options.useAltName && item.altName ? item.altName : item.name;
    const isiW = w - pad * 2;

    body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`;

    // Susun dulu daftar baris yang benar-benar aktif, baru tentukan ukurannya.
    const skuAtas = options.skuTop && options.showSku;
    const namaBawah = options.nameBottom && options.showName;
    const baris = [];
    if (skuAtas) baris.push({ teks: item.sku || '-', tebal: false });
    if (!namaBawah && options.showName) baris.push({ teks: nama, tebal: true });
    const sebelumBarcode = baris.length;
    if (namaBawah && options.showName) baris.push({ teks: nama, tebal: true });
    if (!skuAtas && options.showSku) baris.push({ teks: `SKU: ${item.sku || '-'}`, tebal: false });
    if (options.showPrice) baris.push({ teks: rupiah(item.price), tebal: true });

    const tinggiBar = h * 0.3;
    const barFont = Math.max(8, tinggiBar * 0.3);
    // Blok barcode = batang + angka di bawahnya. Angka ini dulu tidak pernah
    // ikut dihitung, sehingga baris berikutnya menimpanya.
    const blokBarcode = tinggiBar + barFont * LINE;
    const sisa = h - pad * 2 - blokBarcode;
    // Ukuran teks menyesuaikan ruang yang benar-benar tersisa; dibatasi agar
    // tidak melebihi proporsi label maupun mengecil sampai tak terbaca.
    const teksSize = baris.length
      ? Math.max(7, Math.min(h * 0.11, sisa / (baris.length * LINE)))
      : 0;

    let cursorY = y + pad;
    const tulis = ({ teks, tebal }) => {
      cursorY += teksSize; // maju ke baseline
      body += `<text x="${(x + w / 2).toFixed(2)}" y="${cursorY.toFixed(2)}" text-anchor="middle" font-family="Arial, sans-serif"${tebal ? ' font-weight="bold"' : ''} font-size="${teksSize.toFixed(1)}" fill="#111827">${xml(potong(teks, isiW, teksSize, tebal))}</text>`;
      cursorY += teksSize * (LINE - 1); // sisa jarak antar baris
    };

    baris.slice(0, sebelumBarcode).forEach(tulis);
    body += barcodeMarkup(item.barcode, x + pad, cursorY, isiW, tinggiBar, barFont);
    cursorY += blokBarcode;
    baris.slice(sebelumBarcode).forEach(tulis);
  });

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(0)}" height="${totalH.toFixed(0)}" viewBox="0 0 ${totalW.toFixed(0)} ${totalH.toFixed(0)}"><rect width="100%" height="100%" fill="#ffffff"/>${body}</svg>`,
    width: totalW,
    height: totalH,
  };
}

/** Ubah SVG lembar menjadi PNG dan picu unduhan. */
export function downloadSheetPng(labels, preset, options, filename = 'barcode.png') {
  const { svg, width, height } = buildSheetSvg(labels, preset, options);
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round(height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) { reject(new Error('Gagal membuat PNG.')); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal merender lembar barcode.')); };
    img.src = url;
  });
}
