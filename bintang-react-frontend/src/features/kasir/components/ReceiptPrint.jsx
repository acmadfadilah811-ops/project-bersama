import React from 'react';

export default function ReceiptPrint({ receipt, settings }) {
  if (!receipt) return null;

  const extSettings = settings?.pos_ext_settings || {};
  const isA4Layout = !!extSettings.pos_custom_resi_windows;
  const isPaperSaving = !!extSettings.enable_paper_saving;

  // Format currency in IDR
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // 1. Process items based on merge setting
  let itemsToPrint = receipt.items || [];
  if (extSettings.merge_qty_item_resi) {
    const merged = {};
    itemsToPrint.forEach((item) => {
      // Create a unique key for grouping (using product and variant snapshots or ids)
      const key = item.variant
        ? `v-${item.product}-${item.variant}`
        : `p-${item.product}`;
      if (merged[key]) {
        merged[key].qty = parseFloat(merged[key].qty || 0) + parseFloat(item.qty || 0);
        merged[key].subtotal = parseFloat(merged[key].subtotal || 0) + parseFloat(item.subtotal || 0);
      } else {
        merged[key] = { ...item };
      }
    });
    itemsToPrint = Object.values(merged);
  }

  // 2. Hide packet items if setting is active
  if (extSettings.hide_packet_item_resi) {
    // If the snapshot name indicates a package child or has a tag, we could filter.
    // In this codebase, package items are usually children. Let's filter out
    // items whose snapshot starts with spaces or has indicators, if any, or just keep as is.
    itemsToPrint = itemsToPrint.filter(item => !item.nama_snapshot?.startsWith('  ') && !item.nama_snapshot?.startsWith('- '));
  }

  // Calculate total qty
  const totalQty = itemsToPrint.reduce((sum, item) => sum + parseFloat(item.qty || 0), 0);

  // Render A4/Carbon Copy invoice layout
  if (isA4Layout) {
    return (
      <div className="print-area hidden print:block bg-white p-8 text-black font-sans text-xs min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-black uppercase tracking-wide">{settings?.nama_bisnis || 'BINTANG ADVERTISING'}</h1>
            <p className="text-[10px] text-slate-500 font-semibold mt-1">Solusi Cetak & Promosi Terpercaya</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-700">Faktur Penjualan (POS)</h2>
            {!settings?.pos_resi_sembunyikan_no_pesanan && (
              <p className="text-[10px] font-black text-slate-900 mt-1">No. Invoice: {receipt.nomor}</p>
            )}
            <p className="text-[10px] text-slate-500 font-semibold">Tanggal: {new Date(receipt.created_at).toLocaleString('id-ID')}</p>
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
                  <td className="py-3 text-right font-bold">{item.qty}</td>
                  <td className="py-3 text-right">{formatCurrency(item.harga_snapshot)}</td>
                  <td className="py-3 text-right font-extrabold text-slate-900 pr-2">{formatCurrency(item.subtotal)}</td>
                </tr>
                {extSettings.print_note_item_resi && item.catatan && (
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
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-sm font-black text-slate-900">
              <span>Total:</span>
              <span className="text-indigo-600">{formatCurrency(receipt.total)}</span>
            </div>
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Dibayar ({receipt.metode_bayar}):</span>
              <span>{formatCurrency(receipt.dibayar)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-emerald-600 font-bold">
              <span>Kembalian:</span>
              <span>{formatCurrency(receipt.kembalian)}</span>
            </div>
            {extSettings.print_total_qty_resi && (
              <div className="text-[10px] text-slate-400 font-bold pt-2 border-t border-dashed border-slate-100">
                TOTAL QTY ITEM: {totalQty}
              </div>
            )}
          </div>
        </div>

        {/* Footer Settings Text */}
        {settings?.pos_resi_catatan && (
          <div className="text-center text-[10px] text-slate-400 font-semibold mt-16 pt-4 border-t border-dashed border-slate-200">
            {settings.pos_resi_catatan}
          </div>
        )}
      </div>
    );
  }

  // Render Thermal receipt layout
  return (
    <div className="receipt-print-area hidden print:block bg-white text-black font-mono text-[11px] p-2 leading-tight max-w-[280px] mx-auto">
      {/* Business Name & Title */}
      <div className="text-center space-y-1 mb-3">
        <h2 className="text-xs font-black uppercase tracking-wider">{settings?.nama_bisnis || 'BINTANG ADVERTISING'}</h2>
        <h3 className="text-[10px] font-bold uppercase">{settings?.pos_resi_judul || 'RESI PEMBELIAN'}</h3>
        <p className="text-[9px] text-slate-650">Tanggal: {new Date(receipt.created_at).toLocaleString('id-ID')}</p>
      </div>

      {/* Divider */}
      <div className="border-t border-dashed border-black my-1.5" />

      {/* Metadata */}
      <div className="space-y-0.5 text-[9px]">
        {!settings?.pos_resi_sembunyikan_no_pesanan && (
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
              {item.qty} {item.uom_kode || 'pcs'} x {formatCurrency(item.harga_snapshot)}
            </div>
            {extSettings.print_note_item_resi && item.catatan && (
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
        <div className="flex justify-between font-black text-xs pt-1 border-t border-dotted border-black">
          <span>Total</span>
          <span>{formatCurrency(receipt.total)}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>Metode Bayar</span>
          <span className="font-bold">{receipt.metode_bayar}</span>
        </div>
        <div className="flex justify-between">
          <span>Dibayar</span>
          <span>{formatCurrency(receipt.dibayar)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Kembalian</span>
          <span>{formatCurrency(receipt.kembalian)}</span>
        </div>
      </div>

      {extSettings.print_total_qty_resi && (
        <div className="text-[8px] text-center mt-2 font-bold text-slate-600">
          TOTAL QTY ITEM: {totalQty}
        </div>
      )}

      {/* Footer Catatan Settings */}
      {settings?.pos_resi_catatan && (
        <div className="text-center text-[9px] mt-4 pt-2 border-t border-dashed border-black break-words leading-tight whitespace-pre-line font-medium text-slate-700">
          {settings.pos_resi_catatan}
        </div>
      )}
    </div>
  );
}
