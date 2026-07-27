import { Plus } from 'lucide-react';

export default function TransferKasForm({
  txDate,
  setTxDate,
  debitAccId,
  setDebitAccId,
  creditAccId,
  setCreditAccId,
  catatan,
  setCatatan,
  jumlah,
  setJumlah,
  noDokumen,
  setNoDokumen,
  kasBankAccounts,
  onAddDraft,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4 text-left text-xs font-semibold text-slate-700">
      {/* Tanggal */}
      <div className="space-y-1">
        <label className="block text-[10px] text-slate-500 font-extrabold">Tanggal <span className="text-rose-500">*</span></label>
        <input
          type="date"
          value={txDate}
          onChange={(e) => setTxDate(e.target.value)}
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-xs font-semibold text-slate-800 shadow-2xs"
        />
      </div>

      {/* Akun Debit */}
      <div className="space-y-1">
        <label className="block text-[10px] text-slate-500 font-extrabold">Akun Debit <span className="text-rose-500">*</span></label>
        <select
          value={debitAccId}
          onChange={(e) => setDebitAccId(e.target.value)}
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-xs font-semibold text-slate-800 shadow-2xs"
        >
          <option value="">Pilih Akun Debit</option>
          {kasBankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Akun Kredit */}
      <div className="space-y-1">
        <label className="block text-[10px] text-slate-500 font-extrabold">Akun Kredit <span className="text-rose-500">*</span></label>
        <select
          value={creditAccId}
          onChange={(e) => setCreditAccId(e.target.value)}
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-xs font-semibold text-slate-800 shadow-2xs"
        >
          <option value="">Pilih Akun Kredit</option>
          {kasBankAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Catatan */}
      <div className="space-y-1">
        <label className="block text-[10px] text-slate-500 font-extrabold">Catatan <span className="text-rose-500">*</span></label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Masukkan catatan pemindahan..."
          rows={3}
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-xs font-semibold text-slate-800 shadow-2xs resize-y"
        />
      </div>

      {/* Jumlah */}
      <div className="space-y-1">
        <label className="block text-[10px] text-slate-500 font-extrabold">Jumlah <span className="text-rose-500">*</span></label>
        <div className="flex shadow-2xs rounded-lg overflow-hidden border border-slate-200">
          <span className="bg-slate-100 text-slate-660 px-3 py-1.5 border-r border-slate-200 flex items-center justify-center font-bold text-[10px]">
            IDR
          </span>
          <input
            type="number"
            placeholder="0,00"
            value={jumlah}
            onChange={(e) => setJumlah(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 focus:bg-white outline-none text-xs font-semibold text-slate-808 text-right"
          />
        </div>
      </div>

      {/* No. Dokumen */}
      <div className="space-y-1">
        <label className="block text-[10px] text-slate-500 font-extrabold">No. Dokumen</label>
        <input
          type="text"
          placeholder="Masukkan nomor referensi dokumen..."
          value={noDokumen}
          onChange={(e) => setNoDokumen(e.target.value)}
          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-xs font-semibold text-slate-808 shadow-2xs"
        />
      </div>

      {/* Tambah Lainnya Button */}
      <button
        type="button"
        onClick={onAddDraft}
        className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-650 border border-slate-205 hover:border-slate-300 font-bold rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-2xs"
      >
        <Plus size={13} />
        <span>Tambah Lainnya</span>
      </button>
    </div>
  );
}
