import { Loader2 } from 'lucide-react';

function AccountLine({ item, onViewAccount }) {
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
          {item.formatted}
        </button>
      ) : (
        <span className="font-semibold text-slate-800">{item.formatted}</span>
      )}
    </div>
  );
}

function AsetBox({ listAsetLancar, listAsetTidakLancar, subTotalAsetLancar, subTotalAsetTidakLancar, totalAset, rounded, onViewAccount }) {
  return (
    <div className={`border border-slate-200 overflow-hidden flex flex-col ${rounded}`}>
      <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">Aset</div>
      <div className="p-3 space-y-1">
        <div className="text-xs font-semibold text-slate-600 mb-1">Aset Lancar</div>
        <div className="space-y-1 pl-4">
          {listAsetLancar.map((item) => <AccountLine key={item.code} item={item} onViewAccount={onViewAccount} />)}
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
          <span>SubTotal Aset Lancar</span>
          <span>{subTotalAsetLancar}</span>
        </div>

        <div className="pt-2">
          <div className="text-xs font-semibold text-slate-600 mb-1">Aset Tidak Lancar</div>
          <div className="space-y-1 pl-4">
            {listAsetTidakLancar.map((item) => <AccountLine key={item.code} item={item} onViewAccount={onViewAccount} />)}
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
            <span>SubTotal Aset Tidak Lancar</span>
            <span>{subTotalAsetTidakLancar}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-2 border-t border-dashed border-black">
          <span>Total Aset</span>
          <span>{totalAset}</span>
        </div>
      </div>
    </div>
  );
}

function KewajibanModalBox({ listKewajiban, listModal, subTotalKewajiban, subTotalModal, totalKewajibanModal, rounded, onViewAccount }) {
  return (
    <div className={`border border-slate-200 overflow-hidden flex flex-col ${rounded}`}>
      <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">Kewajiban dan Modal</div>
      <div className="p-3 space-y-1">
        <div className="text-xs font-semibold text-slate-600 mb-1">Kewajiban</div>
        <div className="space-y-1 pl-4">
          {listKewajiban.map((item) => <AccountLine key={item.code} item={item} onViewAccount={onViewAccount} />)}
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
          <span>SubTotal Kewajiban</span>
          <span>{subTotalKewajiban}</span>
        </div>

        <div className="pt-2">
          <div className="text-xs font-semibold text-slate-600 mb-1">Modal</div>
          <div className="space-y-1 pl-4">
            {listModal.map((item, idx) => <AccountLine key={item.code || idx} item={item} onViewAccount={onViewAccount} />)}
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
            <span>SubTotal Modal</span>
            <span>{subTotalModal}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-2 border-t border-dashed border-black">
          <span>Total Kewajiban dan Modal</span>
          <span>{totalKewajibanModal}</span>
        </div>
      </div>
    </div>
  );
}

export default function NeracaReport({
  loading, layoutMode,
  listAsetLancar, listAsetTidakLancar, listKewajiban, listModal,
  subTotalAsetLancar, subTotalAsetTidakLancar, totalAset,
  subTotalKewajiban, subTotalModal, totalKewajibanModal,
  onViewAccount,
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative min-h-[450px]">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
            <Loader2 size={20} className="animate-spin" />
            <span>Memuat data Neraca...</span>
          </div>
        </div>
      )}

      {layoutMode === 'side' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <AsetBox
            listAsetLancar={listAsetLancar} listAsetTidakLancar={listAsetTidakLancar}
            subTotalAsetLancar={subTotalAsetLancar} subTotalAsetTidakLancar={subTotalAsetTidakLancar}
            totalAset={totalAset} rounded="rounded-lg" onViewAccount={onViewAccount}
          />
          <KewajibanModalBox
            listKewajiban={listKewajiban} listModal={listModal}
            subTotalKewajiban={subTotalKewajiban} subTotalModal={subTotalModal}
            totalKewajibanModal={totalKewajibanModal} rounded="rounded-lg" onViewAccount={onViewAccount}
          />
        </div>
      ) : (
        <div className="space-y-0">
          <AsetBox
            listAsetLancar={listAsetLancar} listAsetTidakLancar={listAsetTidakLancar}
            subTotalAsetLancar={subTotalAsetLancar} subTotalAsetTidakLancar={subTotalAsetTidakLancar}
            totalAset={totalAset} rounded="rounded-t-lg border-b-0" onViewAccount={onViewAccount}
          />
          <KewajibanModalBox
            listKewajiban={listKewajiban} listModal={listModal}
            subTotalKewajiban={subTotalKewajiban} subTotalModal={subTotalModal}
            totalKewajibanModal={totalKewajibanModal} rounded="rounded-b-lg" onViewAccount={onViewAccount}
          />
        </div>
      )}
    </div>
  );
}
