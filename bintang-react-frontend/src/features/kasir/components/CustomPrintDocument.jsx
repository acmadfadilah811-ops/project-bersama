import { createPortal } from 'react-dom';
import logoStarfoto from '../../../assets/logo-starfoto.png';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(val) || 0);

const formatTanggal = (value) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' })
    .format(value ? new Date(value) : new Date());

const JUDUL = {
  invoice: 'INVOICE',
  spk: 'SURAT PERINTAH KERJA (SPK)',
  surat_jalan: 'SURAT JALAN (DELIVERY ORDER)',
};

/**
 * Dokumen "Cetak Custom" di PaymentSuccessModal: Invoice, SPK, Surat Jalan
 * untuk transaksi yang baru selesai (POS lunas maupun order DP -- keduanya
 * sudah dinormalkan PosTerminal ke bentuk `transactionData` yang sama).
 *
 * Di-render lewat portal ke <body> (bukan di dalam modal yang `fixed` +
 * backdrop-blur): ancestor fixed membuat konten A4 terpotong di halaman
 * pertama saat dicetak. Class `.print-area` sudah diatur di index.css.
 */
export default function CustomPrintDocument({ type, data, settings }) {
  if (!type || !data) return null;

  const items = data.items || [];
  const nama = data.pelanggan_name || data.customerName || 'Pelanggan umum';
  const telepon = data.customerPhone || data.nomor_wa || '';
  const tanggal = formatTanggal(data.created_at || data.waktu);

  const subtotal = Number(data.subtotal ?? items.reduce((s, it) => s + Number(it.subtotal || 0), 0));
  const diskon = Number(data.diskon_total ?? data.diskon ?? 0);
  const pajak = Number(data.pajak || 0);
  const total = Number(data.total ?? data.totalAmount ?? subtotal);
  const dibayar = Number(data.dibayar ?? data.payAmount ?? 0);
  const sisa = Number(data.sisa_tagihan || 0);
  const kembalian = Number(data.kembalian ?? data.changeAmount ?? 0);
  const metode = data.metode_bayar || data.method || '';

  const th = 'py-2 px-2 font-bold text-[10px] uppercase tracking-wider text-slate-700 border-y border-slate-300 bg-slate-100';

  const tandaTangan = (kiri, kanan) => (
    <div className="mt-14 grid grid-cols-2 gap-16 text-center text-[11px]">
      {[kiri, kanan].map((label) => (
        <div key={label}>
          <p className="text-slate-600">{label}</p>
          <div className="mt-16 border-t border-slate-800 pt-1 font-bold">(............................)</div>
        </div>
      ))}
    </div>
  );

  const dokumen = (
    <div className="print-area hidden print:block bg-white p-4 text-black font-sans text-xs">
      <div className="flex justify-between items-start gap-6 border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <img src={logoStarfoto} alt="StarPhoto & Advertising" className="h-16 w-auto" />
          <div>
            <h1 className="text-base font-black uppercase tracking-wide">
              {settings?.nama_bisnis || 'StarPhoto & Advertising'}
            </h1>
            {settings?.alamat && <p className="text-[10px] text-slate-500 mt-0.5">{settings.alamat}</p>}
            {settings?.no_telepon && <p className="text-[10px] text-slate-500">WA: {settings.no_telepon}</p>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <h2 className="text-sm font-extrabold tracking-wide text-slate-800 whitespace-nowrap">{JUDUL[type]}</h2>
          <p className="text-[11px] font-bold mt-1">No. {data.nomor}</p>
          <p className="text-[10px] text-slate-500">{tanggal}</p>
        </div>
      </div>

      <div className="flex justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
            {type === 'invoice' ? 'Ditagihkan kepada' : type === 'spk' ? 'Pemesan' : 'Dikirim kepada'}
          </p>
          <p className="font-bold text-sm">{nama}</p>
          {telepon && <p className="text-[11px] text-slate-600">{telepon}</p>}
        </div>
        {type === 'spk' && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">Deadline</p>
            <p className="font-bold text-sm">{data.spk_deadline ? formatTanggal(data.spk_deadline) : '-'}</p>
          </div>
        )}
      </div>

      <table className="w-full border-collapse mb-5">
        <thead>
          <tr>
            <th className={`${th} text-center w-10`}>No</th>
            <th className={`${th} text-left`}>{type === 'surat_jalan' ? 'Nama Barang' : 'Produk'}</th>
            {type === 'spk' && <th className={`${th} text-left`}>Spesifikasi / Catatan</th>}
            {type === 'surat_jalan' && <th className={`${th} text-left`}>Keterangan</th>}
            <th className={`${th} text-center w-14`}>Qty</th>
            {type === 'invoice' && <th className={`${th} text-right w-28`}>Harga</th>}
            {type === 'invoice' && <th className={`${th} text-right w-32`}>Jumlah</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id ?? idx} className="border-b border-slate-100 align-top">
              <td className="py-2 px-2 text-center text-slate-500">{idx + 1}</td>
              <td className="py-2 px-2 font-semibold">
                {it.nama_snapshot || it.nama}
                {type === 'invoice' && it.catatan && (
                  <span className="block text-[10px] font-normal text-slate-500">{it.catatan}</span>
                )}
              </td>
              {(type === 'spk' || type === 'surat_jalan') && (
                <td className="py-2 px-2 text-slate-700">{it.catatan || '-'}</td>
              )}
              <td className="py-2 px-2 text-center">{it.qty}</td>
              {type === 'invoice' && (
                <td className="py-2 px-2 text-right">{formatCurrency(it.harga_snapshot)}</td>
              )}
              {type === 'invoice' && (
                <td className="py-2 px-2 text-right font-semibold">{formatCurrency(it.subtotal)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {type === 'invoice' && (
        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            {diskon > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Diskon</span>
                <span className="font-semibold">-{formatCurrency(diskon)}</span>
              </div>
            )}
            {pajak > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Pajak</span>
                <span className="font-semibold">{formatCurrency(pajak)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-300 pt-1">
              <span className="font-bold">Total</span>
              <span className="font-black">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">{data.isOrderReceipt ? 'DP dibayar' : 'Dibayar'}{metode ? ` (${metode})` : ''}</span>
              <span>{formatCurrency(dibayar)}</span>
            </div>
            {data.isOrderReceipt ? (
              <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-sm">
                <span className="font-black">{sisa > 0 ? 'Sisa Tagihan' : 'LUNAS'}</span>
                <span className="font-black">{formatCurrency(sisa)}</span>
              </div>
            ) : (
              <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-sm">
                <span className="font-black">Kembalian</span>
                <span className="font-black">{formatCurrency(kembalian)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {data.catatan && (type === 'spk' || type === 'surat_jalan') && (
        <div className="border border-slate-300 rounded p-3 text-[11px]">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
            {type === 'spk' ? 'Catatan Produksi' : 'Catatan'}
          </p>
          <p className="whitespace-pre-wrap">{data.catatan}</p>
        </div>
      )}

      {type === 'invoice' && tandaTangan('Diterima oleh,', 'Hormat Kami,')}
      {type === 'spk' && tandaTangan('Dibuat oleh (Kasir),', 'Diterima (Produksi),')}
      {type === 'surat_jalan' && (
        <>
          <p className="mt-6 text-[10px] text-slate-500 text-center">
            Barang telah diterima dalam keadaan baik dan jumlah sesuai.
          </p>
          {tandaTangan('Penerima,', 'Pengirim,')}
        </>
      )}
    </div>
  );

  return createPortal(dokumen, document.body);
}
