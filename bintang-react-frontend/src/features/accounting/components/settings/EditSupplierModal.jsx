export default function EditSupplierModal({
  supplier, dueDate, onDueDateChange, payableAccount, onPayableAccountChange,
  payableAccounts, saving, onClose, onSave,
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[560px] overflow-hidden text-xs font-semibold text-slate-700 animate-scale-up">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
          <h4 className="text-sm font-bold text-slate-800">
            {supplier?.name} Tanggal Bayar
          </h4>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-200 bg-[#F4F5F7] hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="px-5 py-1.5 bg-[#51a351] hover:bg-[#419241] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-lg text-xs cursor-pointer shadow-2xs transition-colors"
            >
              {saving ? 'Menyimpan...' : 'Perbarui'}
            </button>
          </div>
        </div>

        {/* Modal Body Form */}
        <div className="p-6 space-y-5">

          {/* Jatuh Tempo */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jatuh Tempo
            </label>
            <div className="flex border border-slate-205 rounded-xl overflow-hidden bg-white shadow-3xs focus-within:border-[#0088E8] transition-all">
              <input
                type="number"
                value={dueDate}
                onChange={(e) => onDueDateChange(e.target.value)}
                placeholder=""
                className="flex-1 px-3.5 py-2.5 outline-none text-xs font-semibold text-slate-800"
              />
              <span className="px-4 py-2.5 bg-slate-50 text-slate-400 font-bold border-l border-slate-205 select-none text-xs flex items-center justify-center">
                Hari
              </span>
            </div>
          </div>

          {/* Akun Hutang */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Akun Hutang
            </label>
            <select
              value={payableAccount}
              onChange={(e) => onPayableAccountChange(e.target.value)}
              className={`w-full px-3.5 py-2.5 border border-slate-205 rounded-xl bg-white outline-none focus:border-[#0088E8] shadow-3xs cursor-pointer text-xs ${
                payableAccount ? 'text-slate-800 font-bold' : 'text-slate-400 font-semibold'
              }`}
            >
              <option value="" disabled hidden>Pilih Akun</option>
              {payableAccounts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

        </div>

      </div>
    </div>
  );
}
