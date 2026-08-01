import { Edit2, X, Settings } from 'lucide-react';

/**
 * Tabel Produk Pesanan & Summary Footer — Presisi SS No. 2
 */
export default function ReturnOrderItemsTable({
  returnItems = [],
  tambahanNominal = 0,
  onOpenAddReturnModal,
  onEditReturnItem,
  onRemoveReturnItem,
  onOpenTambahanModal,
}) {
  const fmtIDR = (num) => `IDR ${Math.round(Number(num) || 0).toLocaleString('id-ID')}`;

  const subtotal = returnItems.reduce(
    (acc, it) => acc + Number(it.qty || 1) * Number(it.harga || 0),
    0
  );

  const totalPengembalian = subtotal + Number(tambahanNominal || 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-4 text-xs font-semibold text-slate-700">
      {/* Header Section */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="text-xs font-bold text-slate-800">Produk Pesanan</span>
        <button
          type="button"
          onClick={onOpenAddReturnModal}
          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
        >
          + Pengembalian Pesanan
        </button>
      </div>

      {/* Table Body / Empty State */}
      {returnItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[180px] text-center">
          <div className="mb-3 text-slate-300">
            <span className="text-5xl select-none">🐻‍❄️</span>
          </div>
          <span className="text-xs font-bold text-slate-400 block">Tidak ada pengembalian pesanan</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50/50">
                <th className="py-3 px-3 font-bold w-12 text-slate-400">#</th>
                <th className="py-3 px-3 font-bold">Deskripsi</th>
                <th className="py-3 px-3 text-center font-bold">Qty</th>
                <th className="py-3 px-3 text-left font-bold">Harga (IDR)</th>
                <th className="py-3 px-3 text-left font-bold">Total Harga (IDR)</th>
                <th className="py-3 px-3 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {returnItems.map((it, idx) => {
                const qty = Number(it.qty || 1);
                const harga = Number(it.harga || 0);
                const totalHarga = qty * harga;

                return (
                  <tr key={it.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-3 text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-xs text-slate-400">
                          📦
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 block">{it.nama}</span>
                          {it.alasan && (
                            <span className="text-[11px] font-semibold text-slate-400 block mt-0.5">
                              ⓘ {it.alasan}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-slate-800">{qty}</td>
                    <td className="py-3.5 px-3 font-mono font-semibold">{fmtIDR(harga)}</td>
                    <td className="py-3.5 px-3 font-mono font-bold text-slate-800">{fmtIDR(totalHarga)}</td>
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => onEditReturnItem?.(it)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer transition-colors"
                        >
                          <Edit2 size={12} /> Ubah
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveReturnItem?.(it.id || idx)}
                          className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-700 font-bold cursor-pointer transition-colors"
                        >
                          <X size={12} /> Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Footer Table Summary (Olsera SS 2) */}
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/40">
                <td colSpan={6} className="py-2.5 px-3 font-bold text-right text-slate-500">
                  Total Pesanan
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="py-2 px-3 font-bold text-right text-slate-500">
                  Subtotal
                </td>
                <td colSpan={2} className="py-2 px-3 font-mono font-bold text-slate-800">
                  {fmtIDR(subtotal)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="py-2 px-3 font-bold text-right text-slate-500">
                  Tambahan
                </td>
                <td className="py-2 px-3 font-mono font-bold text-slate-800">
                  {fmtIDR(tambahanNominal)}
                </td>
                <td className="py-2 px-3 text-left">
                  <button
                    type="button"
                    onClick={onOpenTambahanModal}
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer transition-colors"
                  >
                    <Settings size={12} /> Pengaturan Tambahan
                  </button>
                </td>
              </tr>
              <tr className="border-t border-slate-200 font-bold bg-slate-50/60">
                <td colSpan={4} className="py-3 px-3 font-bold text-right text-slate-800">
                  Total Pengembalian
                </td>
                <td colSpan={2} className="py-3 px-3 font-mono font-bold text-slate-900 text-sm">
                  {fmtIDR(totalPengembalian)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
