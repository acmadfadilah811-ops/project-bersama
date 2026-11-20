import { cetakConfig } from './receiptConfig';

/**
 * Dokumen A4 untuk cetak otomatis lewat QZ Tray (2026-11-02): Invoice, SPK, Surat Jalan.
 * Isinya sama dengan CustomPrintDocument (cetak lewat dialog browser), tetapi ditulis
 * sebagai HTML polos dengan gaya langsung supaya aman dirender QZ Tray (tanpa Tailwind).
 */
export const JENIS_DOKUMEN = Object.freeze({
  invoice: { label: 'Invoice (faktur)', judul: 'INVOICE' },
  spk: { label: 'SPK (surat perintah kerja)', judul: 'SURAT PERINTAH KERJA (SPK)' },
  surat_jalan: { label: 'Surat Jalan', judul: 'SURAT JALAN (DELIVERY ORDER)' },
});

const esc = (nilai) => String(nilai ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const rupiah = (nilai) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
}).format(Number(nilai) || 0);

const tanggalPanjang = (nilai) => new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
}).format(nilai ? new Date(nilai) : new Date());

const STYLE = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #000; }
  .kepala { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  .merek { display: flex; align-items: center; gap: 12px; }
  .merek img { height: 56px; width: auto; }
  h1 { margin: 0; font-size: 16px; text-transform: uppercase; }
  h2 { margin: 0; font-size: 14px; text-align: right; }
  .redup { color: #64748b; font-size: 10px; }
  .kanan { text-align: right; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; font-weight: 700; margin: 0 0 3px; }
  .info { display: flex; justify-content: space-between; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f1f5f9; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 6px; font-size: 10px; text-transform: uppercase; }
  td { padding: 6px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .c { text-align: center; } .r { text-align: right; } .l { text-align: left; }
  .total { width: 280px; margin-left: auto; font-size: 11px; }
  .total div { display: flex; justify-content: space-between; padding: 2px 0; }
  .total .garis { border-top: 1px solid #cbd5e1; margin-top: 3px; padding-top: 4px; font-weight: 700; }
  .total .tebal { border-top: 2px solid #0f172a; margin-top: 3px; padding-top: 4px; font-size: 13px; font-weight: 800; }
  .catatan { border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px; font-size: 11px; white-space: pre-wrap; }
  .ttd { display: flex; justify-content: space-around; margin-top: 56px; text-align: center; font-size: 11px; }
  .ttd .garis { margin-top: 60px; border-top: 1px solid #0f172a; padding-top: 3px; font-weight: 700; width: 180px; }
`;

function tandaTangan(kiri, kanan) {
  return `<div class="ttd">${[kiri, kanan].map((label) => `<div><div>${esc(label)}</div><div class="garis">(............................)</div></div>`).join('')}</div>`;
}

/** Bentuk transaksi (receipt) sama dengan yang dipakai CustomPrintDocument. */
export function buildQzDokumenHtml({ type, data, settings, logoDataUrl = '' }) {
  const judul = JENIS_DOKUMEN[type]?.judul;
  if (!judul || !data) throw new Error('Jenis dokumen tidak dikenal.');
  const cfg = cetakConfig(settings);
  const items = data.items || [];
  const nama = data.pelanggan_name || data.customerName || 'Pelanggan umum';
  const telepon = data.customerPhone || data.nomor_wa || '';
  const subtotal = Number(data.subtotal ?? items.reduce((jumlah, it) => jumlah + Number(it.subtotal || 0), 0));
  const diskon = Number(data.diskon_total ?? data.diskon ?? 0);
  const pajak = Number(data.pajak || 0);
  const total = Number(data.total ?? data.totalAmount ?? subtotal);
  const dibayar = Number(data.dibayar ?? data.payAmount ?? 0);
  const sisa = Number(data.sisa_tagihan || 0);
  const kembalian = Number(data.kembalian ?? data.changeAmount ?? 0);
  const metode = data.metode_bayar || data.method || '';

  const kolomTambahan = type === 'spk' ? '<th class="l">Spesifikasi / Catatan</th>'
    : type === 'surat_jalan' ? '<th class="l">Keterangan</th>' : '';
  const kolomHarga = type === 'invoice' ? '<th class="r">Harga</th><th class="r">Jumlah</th>' : '';
  const baris = items.map((it, idx) => `
    <tr>
      <td class="c redup">${idx + 1}</td>
      <td><strong>${esc(it.nama_snapshot || it.nama)}</strong>${type === 'invoice' && it.catatan ? `<br><span class="redup">${esc(it.catatan)}</span>` : ''}</td>
      ${type === 'spk' || type === 'surat_jalan' ? `<td>${esc(it.catatan || '-')}</td>` : ''}
      <td class="c">${esc(it.qty)}</td>
      ${type === 'invoice' ? `<td class="r">${esc(rupiah(it.harga_snapshot))}</td><td class="r"><strong>${esc(rupiah(it.subtotal))}</strong></td>` : ''}
    </tr>`).join('');

  const rincianBayar = type !== 'invoice' ? '' : `
    <div class="total">
      <div><span>Subtotal</span><strong>${esc(rupiah(subtotal))}</strong></div>
      ${diskon > 0 ? `<div><span>Diskon</span><strong>-${esc(rupiah(diskon))}</strong></div>` : ''}
      ${pajak > 0 ? `<div><span>Pajak</span><strong>${esc(rupiah(pajak))}</strong></div>` : ''}
      <div class="garis"><span>Total</span><span>${esc(rupiah(total))}</span></div>
      <div><span>${data.isOrderReceipt ? 'DP dibayar' : 'Dibayar'}${metode ? ` (${esc(metode)})` : ''}</span><span>${esc(rupiah(dibayar))}</span></div>
      <div class="tebal"><span>${data.isOrderReceipt ? (sisa > 0 ? 'Sisa Tagihan' : 'LUNAS') : 'Kembalian'}</span><span>${esc(rupiah(data.isOrderReceipt ? sisa : kembalian))}</span></div>
    </div>`;

  const catatan = data.catatan && (type === 'spk' || type === 'surat_jalan')
    ? `<div class="catatan"><p class="label">${type === 'spk' ? 'Catatan Produksi' : 'Catatan'}</p>${esc(data.catatan)}</div>` : '';
  const deadline = type === 'spk'
    ? `<div class="kanan"><p class="label">Deadline</p><strong>${data.spk_deadline ? esc(`${tanggalPanjang(data.spk_deadline)}${data.spk_deadline_jam ? ` ${String(data.spk_deadline_jam).slice(0, 5)}` : ''}`) : '-'}</strong></div>` : '<div></div>';
  const penutup = type === 'invoice' ? tandaTangan('Diterima oleh,', 'Hormat Kami,')
    : type === 'spk' ? tandaTangan('Dibuat oleh (Kasir),', 'Diterima (Produksi),')
      : `<p class="redup c" style="margin-top:24px">Barang telah diterima dalam keadaan baik dan jumlah sesuai.</p>${tandaTangan('Penerima,', 'Pengirim,')}`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body>
    <div class="kepala">
      <div class="merek">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="">` : ''}
        <div>
          <h1>${esc(cfg.nama)}</h1>
          ${cfg.alamat ? `<div class="redup">${esc(cfg.alamat)}</div>` : ''}
          ${cfg.telepon ? `<div class="redup">WA: ${esc(cfg.telepon)}</div>` : ''}
        </div>
      </div>
      <div class="kanan">
        <h2>${esc(judul)}</h2>
        <div><strong>No. ${esc(data.nomor)}</strong></div>
        <div class="redup">${esc(tanggalPanjang(data.created_at || data.waktu))}</div>
      </div>
    </div>
    <div class="info">
      <div>
        <p class="label">${type === 'invoice' ? 'Ditagihkan kepada' : type === 'spk' ? 'Pemesan' : 'Dikirim kepada'}</p>
        <strong style="font-size:13px">${esc(nama)}</strong>
        ${telepon ? `<div class="redup">${esc(telepon)}</div>` : ''}
      </div>
      ${deadline}
    </div>
    <table>
      <thead><tr>
        <th class="c" style="width:36px">No</th>
        <th class="l">${type === 'surat_jalan' ? 'Nama Barang' : 'Produk'}</th>
        ${kolomTambahan}
        <th class="c" style="width:48px">Qty</th>
        ${kolomHarga}
      </tr></thead>
      <tbody>${baris}</tbody>
    </table>
    ${rincianBayar}
    ${catatan}
    ${penutup}
  </body></html>`;
}

/** Bentuk pesanan (Order) -> bentuk transaksi yang dipahami buildQzDokumenHtml, untuk faktur pelunasan. */
export function fakturDariOrder(order, metode = '') {
  const items = (order?.items || []).map((it) => {
    const qty = Number(it.qty || 1) || 1;
    const jumlah = Number(it.harga_jual || 0);
    return {
      nama_snapshot: it.jenis_produk || it.nama || 'Item',
      qty,
      harga_snapshot: jumlah / qty,
      subtotal: jumlah,
      catatan: it.catatan || '',
    };
  });
  const subtotal = items.reduce((jumlah, it) => jumlah + it.subtotal, 0);
  const diskon = (subtotal * Number(order?.diskon_persen || 0)) / 100;
  const total = Number(order?.total_harga || subtotal - diskon);
  const dibayar = Number(order?.dp_dibayar || 0);
  return {
    nomor: order?.id,
    created_at: new Date().toISOString(),
    pelanggan_name: order?.nama,
    customerPhone: order?.nomor_wa,
    items,
    subtotal,
    diskon_total: diskon,
    total,
    dibayar,
    sisa_tagihan: Math.max(0, total - dibayar),
    metode_bayar: metode,
    isOrderReceipt: true,
  };
}
