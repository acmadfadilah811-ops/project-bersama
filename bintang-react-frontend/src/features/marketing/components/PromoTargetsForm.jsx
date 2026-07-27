import TagPicker from './TagPicker';
import TagPickerQty from './TagPickerQty';
import { Toggle } from './Common';

/** Sub-komponen untuk Kolom Kanan (Produk Hadiah, Produk Terkait, Target Pelanggan) Promosi POS */
export default function PromoTargetsForm({
  tipe,
  produkGratis,
  setProdukGratis,
  produkQty,
  setProdukQty,
  grupProduk,
  setGrupProduk,
  paketProduk,
  setPaketProduk,
  brand,
  setBrand,
  allCustomers,
  setAllCustomers,
  tipePelanggan,
  setTipePelanggan,
  pelanggan,
  setPelanggan,
}) {
  const showFreeProduct = tipe === 'BX' || tipe === 'FI';

  return (
    <div className="space-y-4">
      {/* Card 1: Produk Gratis (Hadiah) */}
      {showFreeProduct && (
        <div className="border border-rose-100 rounded-2xl p-5 bg-rose-50/20 shadow-sm animate-in fade-in duration-200">
          <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Produk Gratis / Hadiah</h3>
          <TagPicker
            value={produkGratis}
            onChange={setProdukGratis}
            fetchUrl="/products/"
            placeholder="Tambah Produk Hadiah"
          />
        </div>
      )}

      {/* Card 2: Kriteria Produk Terkait */}
      <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Produk Terkait</h3>
        
        <div>
          <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Produk Terkait</label>
          <TagPickerQty value={produkQty} onChange={setProdukQty} fetchUrl="/products/" placeholder="Tambah Produk" />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Grup Produk</label>
          <TagPicker value={grupProduk} onChange={setGrupProduk} fetchUrl="/product-categories/" placeholder="Tambah Grup Produk" />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Paket Produk</label>
          <TagPicker value={paketProduk} onChange={setPaketProduk} fetchUrl="/product-packages/" placeholder="Tambah Paket" />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Brand</label>
          <TagPicker value={brand} onChange={setBrand} fetchUrl="/brands/" placeholder="Tambah Brand" />
        </div>
      </div>

      {/* Card 3: Target Pelanggan */}
      <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Target Pelanggan</h3>
        
        <div className="flex items-center justify-between text-xs py-1">
          <span className="font-semibold text-slate-500">Berlaku untuk semua pelanggan?</span>
          <div className="flex items-center gap-2">
            <Toggle on={allCustomers} onChange={setAllCustomers} />
            <span className="font-bold text-slate-400 w-8">{allCustomers ? 'Ya' : 'Tidak'}</span>
          </div>
        </div>

        {!allCustomers && (
          <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in duration-200">
            <div>
              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Tipe Pelanggan</label>
              <input
                type="text"
                placeholder="Tipe Pelanggan"
                value={tipePelanggan}
                onChange={(e) => setTipePelanggan(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-750 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Berlaku untuk pelanggan</label>
              <TagPicker value={pelanggan} onChange={setPelanggan} fetchUrl="/contacts/" placeholder="Tambah Pelanggan" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
