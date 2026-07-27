import TagPicker from './TagPicker';
import { Toggle } from './Common';

/** Sub-komponen untuk form Aturan/Kriteria Diskon pada Kupon */
export default function KuponRulesForm({
  tg,
  setT,
  tipePelanggan,
  setTipePelanggan,
  pelanggan,
  setPelanggan,
  grupProduk,
  setGrupProduk,
  produk,
  setProduk,
  paketProduk,
  setPaketProduk,
  brand,
  setBrand,
}) {
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
    <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Aturan Diskon</h3>
      
      <div className="space-y-3.5">
        <div>
          {renderToggleField('Berlakukan untuk semua tipe pelanggan?', 'allCustomers')}
          {!tg.allCustomers && (
            <input
              type="text"
              placeholder="Tipe Pelanggan"
              value={tipePelanggan}
              onChange={(e) => setTipePelanggan(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-750 outline-none bg-white mt-1.5"
            />
          )}
        </div>

        <div>
          {!tg.allCustomers && (
            <div className="mt-2 animate-in fade-in duration-200">
              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Berlaku untuk pelanggan</label>
              <TagPicker value={pelanggan} onChange={setPelanggan} fetchUrl="/contacts/" placeholder="Tambah Pelanggan" />
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3">
          {renderToggleField('Berlakukan untuk semua produk?', 'allProducts')}
          {!tg.allProducts && (
            <div className="space-y-2 mt-1.5 animate-in fade-in duration-200">
              <div>
                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Berlaku untuk grup produk</label>
                <TagPicker value={grupProduk} onChange={setGrupProduk} fetchUrl="/product-categories/" placeholder="Tambah Grup Produk" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Berlaku untuk produk</label>
                <TagPicker value={produk} onChange={setProduk} fetchUrl="/products/" placeholder="Tambah Produk" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3">
          {renderToggleField('Berlakukan untuk semua paket produk?', 'allPackages')}
          {!tg.allPackages && (
            <div className="mt-1.5 animate-in fade-in duration-200">
              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Berlaku untuk paket produk</label>
              <TagPicker value={paketProduk} onChange={setPaketProduk} fetchUrl="/product-packages/" placeholder="Tambah Paket" />
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-3">
          {renderToggleField('Berlakukan untuk semua brand?', 'allBrands')}
          {!tg.allBrands && (
            <div className="mt-1.5 animate-in fade-in duration-200">
              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Berlaku untuk brand</label>
              <TagPicker value={brand} onChange={setBrand} fetchUrl="/brands/" placeholder="Tambah Brand" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
