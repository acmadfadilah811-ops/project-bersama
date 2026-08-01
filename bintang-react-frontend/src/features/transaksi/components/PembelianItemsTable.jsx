import { Settings, X } from 'lucide-react';

/**
 * Tabel Produk Pesanan Pembelian & Ringkasan Keuangan — Presisi 1:1 SS No. 1 (Olsera Style).
 */
export default function PembelianItemsTable({
  items,
  diskonAmount = 0,
  pajakAmount = 0,
  pengirimanAmount = 0,
  jumlahTerbayar = 0,
  payments = [],
  onOpenDiskon,
  onOpenPajak,
  onOpenPengiriman,
  onOpenPembayaran,
  onRemovePayment,
  removingPaymentId,
}) {
  const fmtIDR = (num) => `IDR ${Math.round(Number(num) || 0).toLocaleString('id-ID')}`;
  const fmtDate = (date) => date
    ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
    : '-';
  const accountName = (payment) => (payment.metode || 'Kas').replace(/^\d+\s+/, '');

  const subtotal = (items || []).reduce(
    (acc, it) => acc + Number(it.qty || 1) * Number(it.harga_beli || 0),
    0
  );
  const totalQty = (items || []).reduce((acc, it) => acc + Number(it.qty || 0), 0);

  const totalDitagihkan = Math.max(0, subtotal - diskonAmount + pajakAmount + pengirimanAmount);
  const pembayaranBelumLunas = Math.max(0, totalDitagihkan - jumlahTerbayar);

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-3">
        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-slate-100 shadow-2xs">
          🐻‍❄️
        </div>
        <span className="text-xs font-bold text-slate-400">Tidak ada produk</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto text-slate-700">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-slate-700 font-bold bg-slate-50/50">
            <th className="py-3 px-3 w-10 text-slate-400">#</th>
            <th className="py-3 px-3 font-bold">Deskripsi</th>
            <th className="py-3 px-3 text-center font-bold">Qty</th>
            <th className="py-3 px-3 text-left font-bold">Harga(IDR)</th>
            <th className="py-3 px-3 text-right font-bold">Diskon</th>
            <th className="py-3 px-3 text-left font-bold">Total Harga(IDR)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
          {/* Baris Item Produk */}
          {items.map((item, idx) => {
            const qty = Number(item.qty || 1);
            const harga = Number(item.harga_beli || 0);
            const itemTotal = qty * harga;

            return (
              <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-3 text-slate-400 font-semibold">{idx + 1}</td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs border border-slate-200">
                      📦
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 block">{item.product_nama}</span>
                      {item.product_sku && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          SKU: {item.product_sku}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-center font-bold text-slate-800">{qty}</td>
                <td className="py-3 px-3 text-left font-mono font-semibold">{fmtIDR(harga)}</td>
                <td className="py-3 px-3 text-right font-mono text-slate-500">0</td>
                <td className="py-3 px-3 text-left font-mono font-bold text-slate-800">
                  {fmtIDR(itemTotal)}
                </td>
              </tr>
            );
          })}

          {/* Baris Total Pesanan */}
          <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/30">
            <td colSpan={2} className="py-3 px-3 text-right">
              Total Pesanan
            </td>
            <td className="py-3 px-3 text-center font-bold text-slate-900">{totalQty}</td>
            <td colSpan={3} />
          </tr>

          {/* Baris Ringkasan Keuangan (Olsera Style) */}
          <tr>
            <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-semibold">
              Subtotal
            </td>
            <td className="py-2 px-3 text-left font-mono font-bold text-slate-800">{fmtIDR(subtotal)}</td>
          </tr>

          <tr>
            <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-semibold">
              Diskon
            </td>
            <td className="py-2 px-3 text-left font-mono font-semibold text-slate-700">
              {fmtIDR(diskonAmount)}
            </td>
            <td className="py-2 px-3 text-left">
              <button
                type="button"
                onClick={onOpenDiskon}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                <Settings size={12} /> Diskon
              </button>
            </td>
          </tr>

          <tr>
            <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-semibold">
              Pajak
            </td>
            <td className="py-2 px-3 text-left font-mono font-semibold text-slate-700">
              {fmtIDR(pajakAmount)}
            </td>
            <td className="py-2 px-3 text-left">
              <button
                type="button"
                onClick={onOpenPajak}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                <Settings size={12} /> Pajak
              </button>
            </td>
          </tr>

          <tr>
            <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-semibold">
              Biaya Pengiriman
            </td>
            <td className="py-2 px-3 text-left font-mono font-semibold text-slate-700">
              {fmtIDR(pengirimanAmount)}
            </td>
            <td className="py-2 px-3 text-left">
              <button
                type="button"
                onClick={onOpenPengiriman}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
              >
                <Settings size={12} /> Pengiriman
              </button>
            </td>
          </tr>

          {/* Baris Total Ditagihkan */}
          <tr className="border-t border-b border-slate-300 font-bold bg-slate-50/50">
            <td colSpan={4} className="py-3 px-3 text-right text-slate-800 font-bold">
              Total Ditagihkan
            </td>
            <td className="py-3 px-3 text-left font-mono font-bold text-slate-900 text-sm">
              {fmtIDR(totalDitagihkan)}
            </td>
          </tr>

          <tr>
            <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-semibold">
              Jumlah Terbayar
            </td>
            <td className="py-2 px-3 text-left font-mono font-semibold text-slate-700">
              {fmtIDR(jumlahTerbayar)}
            </td>
          </tr>

          <tr>
            <td colSpan={4} className="py-2 px-3 text-right text-slate-500 font-semibold">
              Pembayaran yang belum lunas
            </td>
            <td className="py-2 px-3 text-left font-mono font-bold text-rose-600">
              {fmtIDR(pembayaranBelumLunas)}
            </td>
            <td className="py-2 px-3 text-left">
              {pembayaranBelumLunas > 0 && (
                <button
                  type="button"
                  onClick={onOpenPembayaran}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  <Settings size={12} /> Pengaturan Pembayaran
                </button>
              )}
            </td>
          </tr>

          {payments.map((payment) => (
              <tr key={`payment-summary-${payment.id}`}>
                <td colSpan={6} className="pt-2 px-3">
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <span className="pt-0.5 text-xs font-bold text-emerald-800">{accountName(payment)}</span>
                    <div className="ml-auto text-right">
                      <div className="font-mono text-xs font-bold text-emerald-800">{fmtIDR(payment.nominal)}</div>
                      <div className="mt-0.5 text-[10px] font-medium text-emerald-700">{fmtDate(payment.tanggal)}</div>
                    </div>
                    <button
                      type="button"
                      disabled={removingPaymentId === payment.id}
                      onClick={() => onRemovePayment?.(payment.id)}
                      title="Batalkan pembayaran ini"
                      className="-mr-1 -mt-1 rounded p-1 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900 disabled:opacity-50 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
