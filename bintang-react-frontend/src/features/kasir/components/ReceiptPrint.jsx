import React from 'react';
import logoStarfoto from '../../../assets/logo-starfoto.png';
import { getLocalPrinterSettings } from '../../printing/services/printService';
import { cetakConfig, itemUntukCetak, judulDokumen, totalQtyItem } from '../../printing/services/receiptConfig';

export default function ReceiptPrint({ receipt, settings }) {
  if (!receipt) return null;

  // Semua pengaturan cetak (identitas toko, judul, catatan, syarat, toggle resi)
  // dibaca lewat receiptConfig supaya sama dengan jalur cetak lain.
  const cfg = cetakConfig(settings);
  const { paperSize } = getLocalPrinterSettings();
  const isA4Layout = cfg.a4;
  const isPaperSaving = cfg.hematKertas;
  const thermalWidth = paperSize === '58mm' ? '48mm' : '72mm';
  const documentTitle = judulDokumen(receipt, cfg);
  const logoSrc = cfg.logoUrl || logoStarfoto;
  const isReprint = !!receipt.isReprint;
  const formatReceiptDateTime = (value) => new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));

  // Format currency in IDR
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // Item sama digabung bila "Gabungkan Qty item di resi" aktif. (Paket tercetak
  // sebagai satu baris -- isi paket memang tidak pernah dicetak -- jadi
  // "Sembunyikan item paket" tidak berlaku.)
  const itemsToPrint = itemUntukCetak(receipt.items, cfg);
  const totalQty = totalQtyItem(itemsToPrint);

  // Render A4/Carbon Copy invoice layout
  if (isA4Layout) {
    return (
      <div className="print-area hidden print:block bg-white p-8 text-black font-sans text-xs min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={logoSrc} alt={cfg.nama} className="h-16 w-auto" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">{cfg.nama}</h1>
              {cfg.tagline && <p className="text-[10px] text-slate-500 font-semibold mt-1">{cfg.tagline}</p>}
              {cfg.alamat && <p className="text-[10px] text-slate-500 whitespace-pre-line">{cfg.alamat}</p>}
              {cfg.telepon && <p className="text-[10px] text-slate-500">Telp: {cfg.telepon}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-700">{documentTitle}</h2>
            {isReprint && (
              <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 border border-rose-300 rounded px-2 py-0.5 inline-block mt-1">
                SALINAN
              </p>
            )}
            {!cfg.sembunyikanNomor && (
              <p className="text-[10px] font-black text-slate-900 mt-1">No. Invoice: {receipt.nomor}</p>
            )}
            <p className="text-[10px] text-slate-500 font-semibold">Tanggal: {formatReceiptDateTime(receipt.created_at)}</p>
          </div>
        </div>

        {/* Info Rows */}
        <div className="grid grid-cols-2 gap-4 mb-6 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Kasir</span>
            <span className="font-extrabold text-slate-800">{receipt.kasir_name || 'Kasir POS'}</span>
          </div>
          {receipt.pelanggan_name && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Pelanggan</span>
              <span className="font-extrabold text-slate-800">{receipt.pelanggan_name}</span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <table className="w-full text-left border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-slate-350 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <th className="py-2.5 pl-2">No.</th>
              <th className="py-2.5">Item Deskripsi</th>
              <th className="py-2.5 text-right">Qty</th>
              <th className="py-2.5 text-right">Harga Satuan</th>
              <th className="py-2.5 text-right pr-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itemsToPrint.map((item, index) => (
              <React.Fragment key={item.id || index}>
                <tr className="border-b border-slate-100 text-slate-800 font-semibold">
                  <td className="py-3 pl-2 text-slate-400">{index + 1}</td>
                  <td className="py-3">
                    <span className="font-bold text-slate-900">{item.nama_snapshot}</span>
                    {item.uom_kode && (
                      <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                        {item.uom_kode}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right font-bold">{Number(item.qty).toLocaleString('id-ID')}</td>
                  <td className="py-3 text-right">{formatCurrency(item.harga_snapshot)}</td>
                  <td className="py-3 text-right font-extrabold text-slate-900 pr-2">{formatCurrency(item.subtotal)}</td>
                </tr>
                {(item.addons || []).map((addon) => (
                  <tr key={addon.id} className="text-slate-500">
                    <td></td>
                    <td className="py-1 pl-3 text-[10px]">+ {addon.nama_snapshot} &times; {addon.qty}</td>
                    <td className="py-1 text-right text-[10px]"></td>
                    <td className="py-1 text-right text-[10px]">{formatCurrency(addon.harga_snapshot)}</td>
                    <td className="py-1 text-right text-[10px] pr-2">{formatCurrency(addon.subtotal)}</td>
                  </tr>
                ))}
                {cfg.catatanItem && item.catatan && (
                  <tr className="bg-slate-50/50">
                    <td></td>
                    <td colSpan="4" className="py-1 px-3 text-[10px] text-slate-500 italic font-semibold">
                      Catatan: {item.catatan}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {/* Bottom Section */}
        <div className="flex justify-between items-start">
          {/* Notes / Tanda Tangan */}
          <div className="w-1/2 space-y-8">
            {(receipt.info_sesi || []).length > 0 && (
              <div className="text-[10px] text-slate-700 font-bold max-w-sm space-y-0.5">
                {receipt.info_sesi.map((baris) => <p key={baris}>{baris}</p>)}
              </div>
            )}
            {receipt.catatan && (
              <div className="text-[10px] text-slate-500 font-semibold bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-sm">
                <span className="font-bold block text-slate-600 mb-0.5">Catatan Faktur:</span>
                {receipt.catatan}
              </div>
            )}
            
            {/* Signature Blocks */}
            <div className="flex gap-16 pt-4 text-center font-bold text-slate-700">
              <div className="w-28 border-t border-slate-300 pt-1 mt-12 text-[10px]">Penerima</div>
              <div className="w-28 border-t border-slate-300 pt-1 mt-12 text-[10px]">Hormat Kami</div>
            </div>
          </div>

          {/* Totals */}
          <div className="w-1/3 space-y-1.5 text-right font-semibold text-slate-600 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-bold text-slate-800">{formatCurrency(receipt.subtotal)}</span>
            </div>
            {parseFloat(receipt.diskon) > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon:</span>
                <span className="font-bold">-{formatCurrency(receipt.diskon)}</span>
              </div>
            )}
            {parseFloat(receipt.pajak) > 0 && (
              <div className="flex justify-between">
                <span>Pajak:</span>
                <span className="font-bold text-slate-800">{formatCurrency(receipt.pajak)}</span>
              </div>
            )}
            {parseFloat(receipt.pembulatan) !== 0 && !Number.isNaN(parseFloat(receipt.pembulatan)) && (
              <div className="flex justify-between">
                <span>Pembulatan:</span>
                <span className="font-bold text-slate-800">{parseFloat(receipt.pembulatan) < 0 ? '-' : ''}{formatCurrency(Math.abs(parseFloat(receipt.pembulatan)))}</span>
              </div>
            )}
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-sm font-black text-slate-900">
              <span>Total:</span>
              <span className="text-indigo-600">{formatCurrency(receipt.total)}</span>
            </div>
            <div className="h-px bg-slate-200 my-1" />
            {receipt.isDraft ? (
              <div className="text-[10px] font-bold text-amber-700">STATUS: BELUM DIBAYAR</div>
            ) : (
              <>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Dibayar ({receipt.metode_bayar}):</span>
                  <span>{formatCurrency(receipt.dibayar)}</span>
                </div>
                {Number(receipt.sisa_tagihan || 0) > 0 && (
                  <div className="flex justify-between text-[10px] text-amber-700 font-extrabold">
                    <span>Sisa Tagihan:</span>
                    <span>{formatCurrency(receipt.sisa_tagihan)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-emerald-600 font-bold">
                  <span>Kembalian:</span>
                  <span>{formatCurrency(receipt.kembalian)}</span>
                </div>
              </>
            )}
            {cfg.totalQty && (
              <div className="text-[10px] text-slate-400 font-bold pt-2 border-t border-dashed border-slate-100">
                TOTAL QTY ITEM: {totalQty}
              </div>
            )}
          </div>
        </div>

        {/* Footer: syarat & ketentuan dan catatan dari Pengaturan */}
        {(cfg.syarat || cfg.catatan) && (
          <div className="text-center text-[10px] text-slate-400 font-semibold mt-16 pt-4 border-t border-dashed border-slate-200 space-y-1">
            {cfg.syarat && (
              <p className="whitespace-pre-line text-left">
                <span className="font-bold text-slate-500">Syarat &amp; Ketentuan: </span>{cfg.syarat}
              </p>
            )}
            {cfg.catatan && <p className="whitespace-pre-line">{cfg.catatan}</p>}
          </div>
        )}
      </div>
    );
  }

  // Render Thermal receipt layout
  return (
    <div
      className="receipt-print-area hidden bg-white p-2 font-mono text-[11px] leading-tight text-black print:block"
      style={{ width: thermalWidth, maxWidth: thermalWidth, margin: '0 auto' }}
    >
      {/* Business Name & Title */}
      <div className="text-center space-y-1 mb-3">
        {/* Printer thermal monokrom: grayscale+kontras supaya logo (perisai biru)
            tidak jadi bercak abu-abu kabur saat di-dither. */}
        <img
          src={logoSrc}
          alt={cfg.nama}
          className="mx-auto block"
          style={{ width: '80%', height: 'auto', filter: 'grayscale(1) contrast(1.4)' }}
        />
        <h2 className="text-xs font-black uppercase tracking-wider">{cfg.nama}</h2>
        {cfg.alamat && <p className="text-[8px] leading-tight whitespace-pre-line">{cfg.alamat}</p>}
        {cfg.telepon && <p className="text-[8px] leading-tight">Telp: {cfg.telepon}</p>}
        <h3 className="text-[10px] font-bold uppercase">{documentTitle}</h3>
        {isReprint && (
          <p className="text-[10px] font-black uppercase tracking-widest border border-black px-2 py-0.5 inline-block">
            *** SALINAN ***
          </p>
        )}
        <p className="text-[9px] text-slate-650">Tanggal: {formatReceiptDateTime(receipt.created_at)}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-1.5" />

      {/* Metadata */}
      <div className="space-y-0.5 text-[9px]">
        {!cfg.sembunyikanNomor && (
          <div className="flex justify-between">
            <span>Nota:</span>
            <span className="font-bold">{receipt.nomor}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Kasir:</span>
          <span>{receipt.kasir_name || 'POS'}</span>
        </div>
        {receipt.pelanggan_name && (
          <div className="flex justify-between font-bold">
            <span>Pelanggan:</span>
            <span>{receipt.pelanggan_name}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-1.5" />

      {/* Items List */}
      <div className={isPaperSaving ? 'space-y-0.5' : 'space-y-1.5'}>
        {itemsToPrint.map((item, idx) => (
          <div key={item.id || idx} className="text-[9px]">
            <div className="flex justify-between items-start font-bold">
              <span className="break-words max-w-[180px]">{item.nama_snapshot}</span>
              <span>{formatCurrency(item.subtotal)}</span>
            </div>
            <div className="text-[8px] text-slate-700">
              {Number(item.qty).toLocaleString('id-ID')} {item.uom_kode || 'pcs'} x {formatCurrency(item.harga_snapshot)}
            </div>
            {(item.addons || []).map((addon) => (
              <div key={addon.id} className="flex justify-between text-[8px] text-slate-600 pl-2">
                <span>+ {addon.nama_snapshot} &times; {addon.qty}</span>
                <span>{formatCurrency(addon.subtotal)}</span>
              </div>
            ))}
            {cfg.catatanItem && item.catatan && (
              <div className="text-[8px] text-slate-600 italic pl-2">
                * Note: {item.catatan}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-1.5" />

      {/* Totals Block */}
      <div className="space-y-0.5 text-[9px] font-semibold">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatCurrency(receipt.subtotal)}</span>
        </div>
        {parseFloat(receipt.diskon) > 0 && (
          <div className="flex justify-between">
            <span>Diskon</span>
            <span>-{formatCurrency(receipt.diskon)}</span>
          </div>
        )}
        {parseFloat(receipt.pajak) > 0 && (
          <div className="flex justify-between">
            <span>Pajak</span>
            <span>{formatCurrency(receipt.pajak)}</span>
          </div>
        )}
        {parseFloat(receipt.pembulatan) !== 0 && !Number.isNaN(parseFloat(receipt.pembulatan)) && (
          <div className="flex justify-between">
            <span>Pembulatan</span>
            <span>{parseFloat(receipt.pembulatan) < 0 ? '-' : ''}{formatCurrency(Math.abs(parseFloat(receipt.pembulatan)))}</span>
          </div>
        )}
        <div className="flex justify-between font-black text-xs pt-1 border-t border-dotted border-black">
          <span>Total</span>
          <span>{formatCurrency(receipt.total)}</span>
        </div>
        {!receipt.isDraft && (
          <div className="flex justify-between pt-1">
            <span>Metode Bayar</span>
            <span className="font-bold">{receipt.metode_bayar}</span>
          </div>
        )}
        {receipt.isDraft ? (
          <div className="font-bold text-amber-700">STATUS: BELUM DIBAYAR</div>
        ) : (
          <>
            <div className="flex justify-between">
              <span>Dibayar</span>
              <span>{formatCurrency(receipt.dibayar)}</span>
            </div>
            {Number(receipt.sisa_tagihan || 0) > 0 && (
              <div className="flex justify-between font-bold">
                <span>Sisa Tagihan</span>
                <span>{formatCurrency(receipt.sisa_tagihan)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold">
              <span>Kembalian</span>
              <span>{formatCurrency(receipt.kembalian)}</span>
            </div>
          </>
        )}
      </div>

      {cfg.totalQty && (
        <div className="text-[8px] text-center mt-2 font-bold text-slate-600">
          TOTAL QTY ITEM: {totalQty}
        </div>
      )}

      {(receipt.info_sesi || []).length > 0 && (
        <div className="text-[9px] mt-2 pt-2 border-t border-dashed border-black font-bold text-slate-800 space-y-0.5 break-words">
          {receipt.info_sesi.map((baris) => <p key={baris}>{baris}</p>)}
        </div>
      )}

      {/* Footer: catatan resi dan syarat & ketentuan dari Pengaturan */}
      {(cfg.catatan || cfg.syarat) && (
        <div className="text-center text-[9px] mt-4 pt-2 border-t border-dashed border-black break-words leading-tight whitespace-pre-line font-medium text-slate-700 space-y-1">
          {cfg.catatan && <p>{cfg.catatan}</p>}
          {cfg.syarat && <p className="text-[8px] text-left">{cfg.syarat}</p>}
        </div>
      )}
    </div>
  );
}
