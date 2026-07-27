import { AlertCircle, Search, Plus, ShoppingBag } from 'lucide-react';

export default function PosCatalog({
  shiftAktif,
  searchTerm,
  setSearchTerm,
  aturanPos,
  setIsCreateOrderModalOpen,
  setIsCustomModalOpen,
  selectedCategory,
  setSelectedCategory,
  categories,
  loadingProducts,
  products,
  handleProductClick,
  formatCurrency,
  navigate,
}) {
  return (
    <div className="flex-1 flex flex-col p-4 overflow-y-auto min-w-0">
      {/* Warning if Shift is closed */}
      {!shiftAktif && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm">Shift Belum Dibuka</h4>
              <p className="text-xs text-slate-500 font-semibold">
                Harap buka shift kasir terlebih dahulu sebelum memproses transaksi belanja.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/kasir/shift')}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm shrink-0"
          >
            Buka Shift Sekarang
          </button>
        </div>
      )}

      {/* Bar pencarian & scan barcode */}
      <div className="flex gap-2 mb-4 shrink-0">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Cari nama produk, SKU, atau scan barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
        {!aturanPos.disableAddCustomItem && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                if (!shiftAktif) {
                  alert(
                    'Shift kasir belum dibuka.\n\nBuka shift melalui menu "Kas & Shift" terlebih dahulu sebelum membuat order.'
                  );
                  return;
                }
                setIsCreateOrderModalOpen(true);
              }}
              className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-500/10 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Buat Order (SPK)</span>
            </button>
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-500/10 flex items-center gap-1 transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Item Kustom</span>
            </button>
          </div>
        )}
      </div>

      {/* Kategori Horizontal Scroll */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-2 shrink-0 no-scrollbar">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Semua
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/10'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {cat.nama}
          </button>
        ))}
      </div>

      {/* Grid Produk Compact */}
      {loadingProducts ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border border-dashed border-slate-200 rounded-2xl">
          <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-2">
            <ShoppingBag size={32} />
          </div>
          <h5 className="font-extrabold text-slate-700 text-sm">Produk Tidak Ditemukan</h5>
          <p className="text-xs text-slate-400 font-semibold max-w-xs mt-1">
            Coba gunakan kata kunci lain atau pilih kategori yang berbeda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-8">
          {products.map((product) => {
            const stokHabis = product.lacak_inventori && product.qty_stok <= 0;
            const hasStock = !stokHabis || !aturanPos.blokirStokKosong;
            const fotoUtama =
              product.fotos?.find((f) => f.is_primary)?.foto ||
              product.fotos?.[0]?.foto ||
              product.gambar ||
              product.foto ||
              null;

            return (
              <button
                key={product.id}
                disabled={!shiftAktif || !hasStock}
                onClick={() => handleProductClick(product)}
                className={`group bg-white rounded-xl border border-slate-200 p-2.5 text-left hover:shadow-md hover:border-indigo-300 transition-all flex items-center gap-2.5 cursor-pointer overflow-hidden ${
                  (!shiftAktif || !hasStock) && 'opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Thumbnail Image / Icon */}
                {fotoUtama ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-150">
                    <img
                      src={fotoUtama}
                      alt={product.nama}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        e.target.parentElement.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-indigo-50/80 border border-indigo-100/60 shrink-0 flex items-center justify-center text-indigo-500">
                    <ShoppingBag size={20} />
                  </div>
                )}

                {/* Details */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[9px] bg-slate-100 text-slate-500 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider truncate max-w-[75px]">
                      {product.kategori_nama || 'Produk'}
                    </span>
                    {aturanPos.sembunyikanStok ? null : product.lacak_inventori ? (
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                          product.qty_stok > 10
                            ? 'bg-emerald-50 text-emerald-600'
                            : product.qty_stok > 0
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        Stok: {product.qty_stok}
                      </span>
                    ) : (
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                        Stok ∞
                      </span>
                    )}
                  </div>

                  <h6
                    className="font-extrabold text-slate-800 text-xs leading-snug truncate"
                    title={product.nama}
                  >
                    {product.nama}
                  </h6>

                  <div className="flex items-center justify-between mt-1 gap-1">
                    <span className="text-xs font-black text-slate-900 truncate">
                      {formatCurrency(product.harga_jual_toko)}
                    </span>
                    {product.satuan && (
                      <span className="text-[9px] text-slate-400 font-bold shrink-0">
                        /{product.satuan}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
