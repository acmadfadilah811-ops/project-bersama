import { Toggle } from './Common';

const TIPE_PROMOSI_LABEL = {
  BX: 'BX (Beli produk tertentu, gratis produk lain)',
  DQ: 'DQ (Diskon jika membeli produk dengan kuantitas tertentu)',
  DA: 'DA (Diskon jika memenuhi total transaksi yang ditentukan)',
  FI: 'FI (Gratis produk)',
};

/** Sub-komponen untuk Konfigurasi Aturan & Kriteria Promosi POS */
export default function PromoRulesForm({
  tipe,
  setTipe,
  combineQty,
  setCombineQty,
  combineQtyValue,
  setCombineQtyValue,
  kelipatan,
  setKelipatan,
  berlakuMembeli,
  setBerlakuMembeli,
}) {
  return (
    <div className="border border-slate-100 rounded-2xl p-6 bg-white space-y-4">
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Aturan Promo</h3>

      <div>
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipe Promosi</label>
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-750 bg-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
        >
          {Object.entries(TIPE_PROMOSI_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="font-semibold text-slate-500">Kombinasikan Qty Pembelian?</span>
            <Toggle on={combineQty} onChange={setCombineQty} />
          </div>
          {combineQty && (
            <div className="mt-2 animate-in fade-in duration-200">
              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Kombinasi Qty Minimum</label>
              <input
                type="number"
                min="1"
                value={combineQtyValue}
                onChange={(e) => setCombineQtyValue(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-xs py-1">
            <span className="font-semibold text-slate-500">Berlaku Kelipatan?</span>
            <Toggle on={kelipatan} onChange={setKelipatan} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Promo Berlaku Apabila Membeli:</label>
        <div className="flex flex-col sm:flex-row gap-4 text-xs font-semibold text-slate-650">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="berlakuMembeli"
              checked={berlakuMembeli === 'salah-satu'}
              onChange={() => setBerlakuMembeli('salah-satu')}
              className="w-3.5 h-3.5 text-blue-600 border-slate-350 focus:ring-blue-500"
            />
            Salah satu produk yang diatur
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="radio"
              name="berlakuMembeli"
              checked={berlakuMembeli === 'semua'}
              onChange={() => setBerlakuMembeli('semua')}
              className="w-3.5 h-3.5 text-blue-600 border-slate-350 focus:ring-blue-500"
            />
            Semua produk yang diatur
          </label>
        </div>
      </div>
    </div>
  );
}
