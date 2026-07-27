import { X, Search, Calculator } from 'lucide-react';

const formatRupiah = (angka) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(angka || 0);

export default function PriceSelectorModal({
  isOpen,
  onClose,
  priceSearch,
  setPriceSearch,
  selectedCategory,
  setSelectedCategory,
  priceCategories,
  filteredProducts,
  editItems,
  editPricelistActiveIndex,
  onSelectProduct
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 text-white rounded">
              <Calculator size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Asisten Daftar Harga (Edit Item)</h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Pilih produk untuk mengisi data item #{editPricelistActiveIndex + 1}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-450 hover:text-slate-650 hover:bg-slate-200 p-1.5 rounded transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Pencarian */}
        <div className="p-4 border-b border-slate-100 flex gap-3 bg-white">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={priceSearch}
              onChange={(e) => setPriceSearch(e.target.value)}
              placeholder="Cari nama bahan, produk, banner, sticker..."
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex overflow-hidden min-h-[400px]">
          {/* Sidebar Kategori */}
          <div className="w-56 bg-slate-50 border-r border-slate-100 p-2 overflow-y-auto space-y-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                selectedCategory === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-650 hover:bg-slate-200/60'
              }`}
            >
              Semua Kategori
            </button>
            {Object.entries(priceCategories).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                  selectedCategory === key ? 'bg-indigo-600 text-white' : 'text-slate-650 hover:bg-slate-200/60'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Daftar Produk */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((prod, idx) => {
                  const currentQty =
                    parseInt(editItems[editPricelistActiveIndex]?.qty || '1') || 1;

                  return (
                    <div
                      key={idx}
                      className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all"
                    >
                      <div>
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {priceCategories[prod.kategori] || prod.kategori}
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs mt-2 capitalize">
                          {prod.nama_produk}
                          {prod.material ? ` (${prod.material})` : ''}
                        </h4>
                      </div>

                      <div className="mt-4 border-t border-slate-100 pt-3">
                        {prod.price_type === 'flat' ? (
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] font-black text-slate-900">
                              {formatRupiah(prod.harga)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSelectProduct(prod, prod.harga)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                            >
                              Pilih Item
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase">
                              Harga Bertingkat (Qty saat ini: {currentQty}):
                            </p>
                            <div className="space-y-1.5">
                              {Object.entries(prod.tiers || {}).map(([tierKey, tierVal]) => {
                                const tierPrice = parseInt(tierVal) || 0;

                                let isMatched;
                                const cleanKey = tierKey.toLowerCase();
                                if (cleanKey.includes('-')) {
                                  const parts = cleanKey.split('-');
                                  const min = parseInt(parts[0]) || 0;
                                  const max = parseInt(parts[1]) || 999999;
                                  isMatched = currentQty >= min && currentQty <= max;
                                } else if (cleanKey.includes('>')) {
                                  const min = parseInt(cleanKey.replace(/[^\d]/g, '')) || 0;
                                  isMatched = currentQty > min;
                                } else if (cleanKey.includes('<')) {
                                  const max =
                                    parseInt(cleanKey.replace(/[^\d]/g, '')) || 999999;
                                  isMatched = currentQty < max;
                                } else {
                                  const val = parseInt(cleanKey.replace(/[^\d]/g, '')) || 1;
                                  isMatched = currentQty === val;
                                }

                                return (
                                  <div
                                    key={tierKey}
                                    className={`flex justify-between items-center p-1.5 rounded-lg border text-[10px] ${
                                      isMatched ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-100'
                                    }`}
                                  >
                                    <span
                                      className={`font-semibold ${isMatched ? 'text-emerald-800' : 'text-slate-650'}`}
                                    >
                                      {tierKey}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-800">
                                        {formatRupiah(tierPrice)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => onSelectProduct(prod, tierPrice)}
                                        className={`px-2 py-1 rounded text-[9px] font-bold cursor-pointer ${
                                          isMatched
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
                                        }`}
                                      >
                                        Pilih
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-center py-12 text-slate-400 text-xs italic">
                  Tidak ada produk ditemukan.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
