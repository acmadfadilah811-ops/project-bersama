/**
 * Faktur untuk pesanan (Order), bukan nota POS.
 *
 * ReceiptPrint sengaja tidak dipakai ulang: bentuk datanya berbeda — nota POS
 * punya `items[].nama_snapshot` dan `subtotal` hasil kalkulasi kasir, sedangkan
 * pesanan punya `items[].jenis_produk` dengan dimensi P x L dan riwayat DP.
 * Memaksakan satu komponen untuk keduanya akan penuh percabangan.
 */
export default function OrderInvoicePrint({ order, dibayarSekarang, metode, settings }) {
  if (!order) return null;

  const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val || 0);

  const items = order.items || [];
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.harga_jual || 0) * Number(it.qty || 1),
    0
  );
  const diskonNominal = (subtotal * Number(order.diskon_persen || 0)) / 100;
  const total = Number(order.total_harga || subtotal - diskonNominal);

  // DP sebelum pembayaran ini = akumulasi yang tercatat dikurangi yang baru
  // diterima, supaya faktur memperlihatkan riwayatnya, bukan hanya saldo akhir.
  const dpSebelumnya = Math.max(0, Number(order.dp_dibayar || 0) - Number(dibayarSekarang || 0));
  const sisaAkhir = Math.max(0, total - Number(order.dp_dibayar || 0));

  const tanggal = new Date().toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="print-area hidden print:block bg-white p-8 text-black font-sans text-xs min-h-screen">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">
            {settings?.nama_bisnis || 'BINTANG ADVERTISING'}
          </h1>
          <p className="text-[10px] text-slate-500 font-semibold mt-1">
            Solusi Cetak &amp; Promosi Terpercaya
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-700">
            Faktur Pesanan
          </h2>
          <p className="text-[11px] font-bold mt-1">No. {order.id}</p>
          <p className="text-[10px] text-slate-500">{tanggal}</p>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">
          Ditagihkan kepada
        </p>
        <p className="font-bold text-sm">{order.nama}</p>
        <p className="text-[11px] text-slate-600">{order.nomor_wa}</p>
      </div>

      <table className="w-full border-collapse mb-5">
        <thead>
          <tr className="border-y border-slate-300 text-[10px] uppercase tracking-wider text-slate-600">
            <th className="text-left py-2">Deskripsi Item</th>
            <th className="text-center py-2 w-20">Ukuran</th>
            <th className="text-center py-2 w-12">Qty</th>
            <th className="text-right py-2 w-24">Harga</th>
            <th className="text-right py-2 w-28">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-slate-100">
              <td className="py-2 font-semibold">{it.jenis_produk}</td>
              <td className="py-2 text-center text-slate-600">
                {Number(it.panjang || 0)} &times; {Number(it.lebar || 0)} m
              </td>
              <td className="py-2 text-center">{it.qty}</td>
              <td className="py-2 text-right">{formatCurrency(it.harga_jual)}</td>
              <td className="py-2 text-right font-semibold">
                {formatCurrency(Number(it.harga_jual || 0) * Number(it.qty || 1))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          {Number(order.diskon_persen || 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">Diskon ({order.diskon_persen}%)</span>
              <span className="font-semibold">-{formatCurrency(diskonNominal)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-1">
            <span className="font-bold">Total</span>
            <span className="font-black">{formatCurrency(total)}</span>
          </div>
          {dpSebelumnya > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-600">DP sebelumnya</span>
              <span>-{formatCurrency(dpSebelumnya)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">
              Dibayar sekarang{metode ? ` (${metode})` : ''}
            </span>
            <span>-{formatCurrency(dibayarSekarang)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-slate-900 pt-1 text-sm">
            <span className="font-black">{sisaAkhir > 0 ? 'Sisa Tagihan' : 'LUNAS'}</span>
            <span className="font-black">{formatCurrency(sisaAkhir)}</span>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500">
        <p>Terima kasih atas kepercayaan Anda.</p>
        <p className="mt-0.5">Faktur ini sah tanpa tanda tangan basah.</p>
      </div>
    </div>
  );
}
