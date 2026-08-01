import { Loader2 } from 'lucide-react';

function AccountRow({ item, formatRupiah, onViewAccount }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-slate-700">
        {item.code ? `${item.code} - ${item.name}` : item.name}
      </span>
      {item.id && Number(item.amount) !== 0 ? (
        <button
          type="button"
          onClick={() => onViewAccount(item.id)}
          className="font-semibold text-[#0088E8] hover:underline cursor-pointer"
        >
          {formatRupiah(item.amount)}
        </button>
      ) : (
        <span className="font-semibold text-slate-800">{formatRupiah(item.amount)}</span>
      )}
    </div>
  );
}

export default function LabaRugiSatuPeriodeReport({
  loading,
  listPendapatan, listHpp, listBiayaOp, listPendapatanNonOp, listBiayaNonOp,
  subTotalPendapatan, subTotalHpp, totalLabaKotor, totalBiayaOp,
  subTotalPendapatanNonOp, subTotalBiayaNonOp, totalPendapatanNonOp, labaBersih,
  formatRupiah, onViewAccount,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 relative min-h-[500px]">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
            <Loader2 size={20} className="animate-spin" />
            <span>Memuat data Laba Rugi...</span>
          </div>
        </div>
      )}

      {/* SECTION 1: PENDAPATAN BERSIH OPERASIONAL */}
      <div className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-[#0099E6] text-white px-4 py-2.5 font-bold text-xs tracking-wide">
          Pendapatan bersih operasional
        </div>
        <div className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-b border-slate-200">
          Laba kotor
        </div>

        <div className="p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-600 mb-2">Pendapatan</div>
          <div className="space-y-1.5 pl-6">
            {listPendapatan.map((item) => (
              <AccountRow key={item.code || item.name} item={item} formatRupiah={formatRupiah} onViewAccount={onViewAccount} />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-3">
            <span>SubTotal Pendapatan</span>
            <span>{formatRupiah(subTotalPendapatan)}</span>
          </div>

          <div className="pt-4">
            <div className="text-xs font-semibold text-slate-600 mb-2">Biaya pokok penjualan</div>
            <div className="space-y-1.5 pl-6">
              {listHpp.map((item, idx) => (
                <AccountRow key={item.code || idx} item={item} formatRupiah={formatRupiah} onViewAccount={onViewAccount} />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-3">
              <span>SubTotal Biaya pokok penjualan</span>
              <span>{formatRupiah(subTotalHpp)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-3 mt-4 border-t border-dashed border-black">
            <span>Total Laba kotor</span>
            <span>{formatRupiah(totalLabaKotor)}</span>
          </div>

          <div className="pt-4">
            <div className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs rounded-lg mb-3">
              Biaya Operasional
            </div>
            <div className="space-y-1.5 pl-6">
              {listBiayaOp.map((item) => (
                <AccountRow key={item.code} item={item} formatRupiah={formatRupiah} onViewAccount={onViewAccount} />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-3 mt-4 border-t border-dashed border-black">
              <span>Total Biaya Operasional</span>
              <span>{formatRupiah(totalBiayaOp)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: TOTAL PENDAPATAN NON OPERASIONAL */}
      <div className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-[#0099E6] text-white px-4 py-2.5 font-bold text-xs tracking-wide">
          Total pendapatan non operasional
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-600 mb-2">Pendapatan non operasional</div>
          <div className="space-y-1.5 pl-6">
            {listPendapatanNonOp.map((item) => (
              <AccountRow key={item.code} item={item} formatRupiah={formatRupiah} onViewAccount={onViewAccount} />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-2">
            <span>SubTotal Pendapatan non operasional</span>
            <span>{formatRupiah(subTotalPendapatanNonOp)}</span>
          </div>

          <div className="pt-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">Biaya non operasional</div>
            <div className="space-y-1.5 pl-6">
              {listBiayaNonOp.map((item) => (
                <AccountRow key={item.code} item={item} formatRupiah={formatRupiah} onViewAccount={onViewAccount} />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-2">
              <span>SubTotal Biaya non operasional</span>
              <span>{formatRupiah(subTotalBiayaNonOp)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-3 mt-4 border-t border-dashed border-black">
            <span>Total pendapatan non operasional</span>
            <span>{formatRupiah(totalPendapatanNonOp)}</span>
          </div>
        </div>
      </div>

      {/* SECTION 3: LABA BERSIH */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-[#0099E6] text-white px-4 py-2.5 font-bold text-xs tracking-wide">
          Laba bersih
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between text-xs font-black text-slate-900 bg-slate-200/90 p-3 border-t border-dashed border-black">
            <span>Laba bersih</span>
            <span>{formatRupiah(labaBersih)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
