import { ChevronLeft, ChevronDown, Trash2 } from 'lucide-react';

export default function DraftJurnalList({
  drafts,
  kasBankAccounts,
  onDeleteDraft,
  onToggleCollapse,
  onUpdateField,
  formatIDR,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 flex flex-col min-h-[460px] text-xs font-semibold text-slate-700">
      <h3 className="text-xs font-bold text-slate-808 pb-3 border-b border-slate-100 mb-4 text-left">
        Draf Jurnal ({drafts.length})
      </h3>

      {drafts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
          <p className="font-bold text-xs">Belum Ada Draf Jurnal</p>
          <p className="text-[10px] mt-1 text-slate-400">Gunakan form di sebelah kiri untuk menambah draf pemindahan dana.</p>
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
          {drafts.map((d) => (
            <div key={d.id} className="border border-slate-150 rounded-xl bg-slate-50/40 shadow-3xs overflow-hidden flex flex-col transition-all">
              {/* Collapsed Header Bar */}
              <div className="bg-slate-100/70 px-4 py-2 flex items-center justify-between border-b border-slate-150">
                <div className="text-left font-bold text-[10px] text-slate-700">
                  <span className="text-slate-450">- ( {d.date} )</span>
                  <p className="text-xs text-[#0088E8] mt-0.5">IDR {formatIDR(d.amount)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(d.id)}
                    className="p-1 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                    title="Hapus Draf"
                  >
                    <Trash2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleCollapse(d.id)}
                    className="p-1 hover:bg-slate-200 text-slate-500 rounded-lg cursor-pointer transition-colors"
                    title={d.isCollapsed ? 'Buka Draf' : 'Tutup Draf'}
                  >
                    {d.isCollapsed ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronLeft size={14} className="rotate-90" />
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded Detail Inputs Form */}
              {!d.isCollapsed && (
                <div className="p-4 space-y-3 text-left bg-white border-t border-slate-100 animate-fade-in text-[11px]">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] text-slate-500 font-extrabold mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={d.date}
                        onChange={(e) => onUpdateField(d.id, 'date', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-[#0088E8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-slate-500 font-extrabold mb-1">Jumlah (IDR)</label>
                      <input
                        type="number"
                        value={d.amount}
                        onChange={(e) => onUpdateField(d.id, 'amount', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none text-right focus:border-[#0088E8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-500 font-extrabold mb-1">Akun Debit</label>
                    <select
                      value={d.debitAcc?.id || ''}
                      onChange={(e) => onUpdateField(d.id, 'debitAccId', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-[#0088E8]"
                    >
                      {kasBankAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-500 font-extrabold mb-1">Akun Kredit</label>
                    <select
                      value={d.creditAcc?.id || ''}
                      onChange={(e) => onUpdateField(d.id, 'creditAccId', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-[#0088E8]"
                    >
                      {kasBankAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-500 font-extrabold mb-1">Catatan</label>
                    <textarea
                      value={d.notes}
                      onChange={(e) => onUpdateField(d.id, 'notes', e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-[#0088E8]"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] text-slate-500 font-extrabold mb-1">No. Dokumen</label>
                    <input
                      type="text"
                      value={d.docNo || ''}
                      onChange={(e) => onUpdateField(d.id, 'docNo', e.target.value)}
                      className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-[#0088E8]"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
