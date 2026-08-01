import { Loader2, MoreHorizontal, X, Trash2, ArrowRightLeft } from 'lucide-react';

export default function MutasiTable({
  loading,
  filteredRows,
  formatIDR,
  formatDateLabel,
  activeActionRowId,
  setActiveActionRowId,
  actionDropdownRef,
  onOpenPasangan,
  onOpenHapus,
}) {
  return (
    // print-area: dipakai window.print() (tombol PDF) -- tanpa class ini
    // halaman tercetak KOSONG (lihat @media print di index.css).
    <div className="print-area bg-white rounded-xl border border-slate-200 shadow-sm text-xs font-semibold text-slate-700 min-h-[250px]">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
          <p className="text-xs font-bold">Memuat Rincian Mutasi...</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 font-bold text-xs bg-slate-50/10">
          Tidak ada transaksi mutasi untuk kriteria pencarian terpilih.
        </div>
      ) : (
        <div className="overflow-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-5 py-3">No. Transaksi</th>
                <th className="px-5 py-3">Pelanggan / Supplier</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 text-right">Debit</th>
                <th className="px-5 py-3 text-right">Kredit</th>
                <th className="px-5 py-3 text-right">Jumlah</th>
                <th className="no-print px-5 py-3 text-center w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {/* Mutation lines — saldo berjalan (running_balance) dihitung server-side
                  berdasarkan account.normal_balance yang sebenarnya, bukan ditebak di sini. */}
              {(() => {
                return filteredRows.map((row, idx) => {
                  const dVal = Number(row.debit) || 0;
                  const kVal = Number(row.kredit) || 0;
                  const running = Number(row.running_balance) || 0;

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50/20 transition-colors relative ${
                        activeActionRowId === idx ? 'z-[50] bg-slate-50/50' : 'z-[10]'
                      }`}
                    >
                      <td className="px-5 py-3 text-slate-505 whitespace-nowrap">
                        {formatDateLabel(row.date)}
                      </td>
                      <td className="px-5 py-3 text-[#0088E8] font-bold">
                        {row.entry_number}
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          <p>{row.pelanggan_supplier || '-'}</p>
                          {row.email && (
                            <p className="text-[10px] text-slate-450 font-semibold">
                              {row.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          <p className="text-slate-800">{row.description}</p>
                          {row.external_document_no && (
                            <p className="text-[10px] text-slate-450 font-semibold">
                              #{row.external_document_no}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-emerald-600 font-bold whitespace-nowrap">
                        {dVal > 0 ? formatIDR(dVal) : '0,00'}
                      </td>
                      <td className="px-5 py-3 text-right text-rose-600 font-bold whitespace-nowrap">
                        {kVal > 0 ? formatIDR(kVal) : '0,00'}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                        {formatIDR(running)}
                      </td>
                      <td className="no-print px-5 py-3 text-center relative">
                        <button
                          type="button"
                          onClick={() => setActiveActionRowId(activeActionRowId === idx ? null : idx)}
                          className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-405 hover:text-slate-700 flex items-center justify-center cursor-pointer mx-auto transition-colors"
                        >
                          {activeActionRowId === idx ? <X size={13} className="text-slate-500 font-bold" /> : <MoreHorizontal size={14} />}
                        </button>

                        {activeActionRowId === idx && (
                          <div
                            ref={actionDropdownRef}
                            className="absolute right-10 top-1/2 -translate-y-1/2 z-20 w-36 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 text-left text-xs font-bold animate-fade-in"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onOpenPasangan(row.entry_number);
                                setActiveActionRowId(null);
                              }}
                              className="w-full px-4 py-2 text-slate-750 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-2"
                            >
                              <ArrowRightLeft size={13} className="text-slate-400" />
                              <span>Pasangan Jurnal</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenHapus(row.entry_number);
                                setActiveActionRowId(null);
                              }}
                              className="w-full px-4 py-2 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors flex items-center gap-2 border-t border-slate-50 mt-1 pt-1.5"
                            >
                              <Trash2 size={13} className="text-rose-500" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
