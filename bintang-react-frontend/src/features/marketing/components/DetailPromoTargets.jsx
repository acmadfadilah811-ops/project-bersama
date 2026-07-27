/** Sub-komponen untuk Kolom Kanan (Produk Hadiah, Produk Terkait, Target Pelanggan) Detail Promosi POS */
export default function DetailPromoTargets({ row }) {
  const produkList = row.produk_qty && row.produk_qty.length > 0
    ? row.produk_qty.map((p) => `${p.nama} (x${p.qty})`).join(', ')
    : 'Semua produk';

  return (
    <div className="space-y-4">
      {row.produk_gratis && (
        <div className="border border-slate-150 bg-rose-50/20 border-rose-100 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Produk Gratis / Hadiah</h3>
          <div className="text-xs text-rose-800 font-extrabold">{row.produk_gratis}</div>
        </div>
      )}

      <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm space-y-3">
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Produk Terkait</h4>
          <div className="text-xs text-slate-650 font-semibold">{produkList}</div>
        </div>
        <div className="border-t border-slate-100 pt-2.5">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Grup Produk</h4>
          <div className="text-xs text-slate-650 font-semibold">{row.grup_produk || 'Semua grup'}</div>
        </div>
        <div className="border-t border-slate-100 pt-2.5">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Paket Produk</h4>
          <div className="text-xs text-slate-650 font-semibold">{row.paket_produk || 'Semua paket'}</div>
        </div>
        <div className="border-t border-slate-100 pt-2.5">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Brand</h4>
          <div className="text-xs text-slate-650 font-semibold">{row.brand || 'Semua brand'}</div>
        </div>
      </div>

      <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Target Pelanggan</h3>
        <div className="text-xs text-slate-600 leading-relaxed font-semibold">
          {row.all_customers ? 'Semua pelanggan' : [row.tipe_pelanggan, row.pelanggan].filter(Boolean).join(', ') || 'Pelanggan tertentu'}
        </div>
      </div>
    </div>
  );
}
