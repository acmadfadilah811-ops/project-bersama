export default function PengaturanAkuntansiStep({
  dueDays,
  setDueDays,
  useStockAsCapital,
  setUseStockAsCapital,
  canProceed,
  onNext,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-sky-50 rounded-xl flex items-center justify-center p-10">
        <div className="w-40 h-40 rounded-full bg-sky-100 flex items-center justify-center">
          <div className="w-24 h-24 rounded-lg bg-white shadow-sm" />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-600">
            <span className="text-rose-500">*</span> Jatuh Tempo Pembayaran
          </label>
          <div className="flex">
            <input
              type="number"
              min="0"
              value={dueDays}
              onChange={(e) => setDueDays(e.target.value)}
              className="flex-1 px-3 py-2 rounded-l-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
            />
            <span className="bg-slate-100 border border-l-0 border-slate-200 text-slate-500 text-xs px-3.5 py-2 rounded-r-lg font-medium flex items-center">
              Hari
            </span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-xs font-medium text-slate-700">
            Apakah Anda ingin menjadikan stock awal sebagai modal awal
          </p>
          <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-bold w-fit">
            <button
              type="button"
              onClick={() => setUseStockAsCapital(true)}
              className={`px-5 py-2 transition-colors cursor-pointer ${
                useStockAsCapital ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Ya
            </button>
            <button
              type="button"
              onClick={() => setUseStockAsCapital(false)}
              className={`px-5 py-2 transition-colors cursor-pointer ${
                !useStockAsCapital ? 'bg-[#0088E8] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Tidak
            </button>
          </div>
        </div>

        <div className="pt-4">
          <button
            type="button"
            onClick={onNext}
            disabled={!canProceed}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              canProceed
                ? 'bg-[#0088E8] hover:bg-sky-600 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            Selanjutnya
          </button>
        </div>
      </div>
    </div>
  );
}
