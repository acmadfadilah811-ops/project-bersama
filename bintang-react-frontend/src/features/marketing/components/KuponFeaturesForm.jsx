import { Toggle } from './Common';

/** Sub-komponen untuk kolom Tengah (Pengaturan & Fitur) pada Kupon Form */
export default function KuponFeaturesForm({ tg, setT, batasPenggunaan, setBatasPenggunaan }) {
  const renderToggleField = (label, k) => (
    <div className="flex items-center justify-between text-xs py-1.5">
      <span className="font-semibold text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <Toggle on={tg[k]} onChange={setT(k)} />
        <span className="font-bold text-slate-400 w-8">{tg[k] ? 'Ya' : 'Tidak'}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-2 border-t lg:border-t-0 lg:border-x border-slate-200/60 lg:px-6 py-4 lg:py-0">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Pengaturan & Fitur</label>
      {renderToggleField('Tampilkan di POS?', 'showPos')}
      {renderToggleField('Tampilkan di Online Order?', 'showOnline')}
      
      {renderToggleField('Penggunaan Tidak Terbatas?', 'unlimitedUsage')}
      {!tg.unlimitedUsage && (
        <div className="pl-1 pb-1 animate-in fade-in duration-200">
          <label className="text-[9px] font-bold text-slate-450 block mb-0.5">Batas Penggunaan</label>
          <input
            type="number"
            min="0"
            placeholder="Batas Penggunaan"
            value={batasPenggunaan}
            onChange={(e) => setBatasPenggunaan(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
      )}

      {renderToggleField('Digunakan sekali per pelanggan?', 'oncePerCustomer')}
      {renderToggleField('Penggunaan Ulang Harian?', 'dailyReuse')}
      {renderToggleField('Gunakan untuk Delivery?', 'delivery')}
    </div>
  );
}
