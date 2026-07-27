import { ArrowRight, ArrowLeft } from 'lucide-react';

export default function SplitBillSelection({
  billA,
  billB,
  moveToB,
  moveToA,
  formatCurrency,
  getTotal,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0 animate-in fade-in slide-in-from-left duration-200">
      
      {/* Bill A: Sisa Keranjang Utama */}
      <div className="border border-slate-200 rounded-2xl p-4 flex flex-col min-h-0 bg-slate-50/50">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <span className="text-xs font-black text-slate-700">BILL A (Sisa Keranjang)</span>
          <span className="text-xs font-black text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full">
            {formatCurrency(getTotal(billA))}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {billA.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-4">
              <p className="text-xs text-slate-400 font-bold">Tidak ada item tersisa</p>
            </div>
          ) : (
            billA.map((item) => (
              <div key={item.key} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center shadow-sm">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-extrabold text-slate-800 truncate">{item.nama}</p>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {item.qty} x {formatCurrency(item.harga)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.qty > 1 && (
                    <button
                      onClick={() => moveToB(item.key, 1)}
                      className="p-1 bg-slate-100 hover:bg-indigo-55 text-slate-600 hover:text-indigo-600 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center h-6 px-2 cursor-pointer"
                    >
                      1 Unit <ArrowRight size={10} className="ml-0.5" />
                    </button>
                  )}
                  <button
                    onClick={() => moveToB(item.key, item.qty)}
                    className="p-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center h-6 px-2 cursor-pointer"
                  >
                    Semua <ArrowRight size={10} className="ml-0.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bill B: Keranjang Terpisah */}
      <div className="border border-indigo-250 rounded-2xl p-4 flex flex-col min-h-0 bg-white">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <span className="text-xs font-black text-slate-700">BILL B (Siap Bayar)</span>
          <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {formatCurrency(getTotal(billB))}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {billB.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs text-slate-400 font-bold">Belum ada item dipindahkan</p>
              <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">
                Klik tombol arah panah di sebelah kiri untuk memindahkan item belanja ke sini.
              </p>
            </div>
          ) : (
            billB.map((item) => (
              <div key={item.key} className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex justify-between items-center shadow-sm">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-extrabold text-slate-800 truncate">{item.nama}</p>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    {item.qty} x {formatCurrency(item.harga)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => moveToA(item.key, 1)}
                    className="p-1 bg-white hover:bg-rose-50 text-slate-650 hover:text-rose-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center h-6 px-2 cursor-pointer"
                  >
                    <ArrowLeft size={10} className="mr-0.5" /> 1 Unit
                  </button>
                  <button
                    onClick={() => moveToA(item.key, item.qty)}
                    className="p-1 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center h-6 px-2 cursor-pointer"
                  >
                    <ArrowLeft size={10} className="mr-0.5" /> Semua
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
