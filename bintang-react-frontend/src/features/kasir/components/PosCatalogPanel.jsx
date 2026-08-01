import React, { useState } from 'react';
import { Search, Filter, Image } from 'lucide-react';

export default function PosCatalogPanel({
  products = [],
  categories = [],
  onAddToCart,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
}) {
  const [activeTab, setActiveTab] = useState('produk');

  return (
    <div className="flex-1 bg-[#0088FF] flex flex-col h-full overflow-hidden">
      {/* Secondary Header Tabs SS 1 */}
      <div className="bg-[#0088FF] px-6 pt-3 pb-0 border-b border-blue-400/40 flex items-center justify-center gap-12 text-white shrink-0">
        <button
          onClick={() => setActiveTab('produk')}
          className={`pb-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'produk' ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'
          }`}
        >
          Produk
        </button>
        <button
          onClick={() => setActiveTab('barcode')}
          className={`pb-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'barcode' ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'
          }`}
        >
          Barcode
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`pb-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'custom' ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'
          }`}
        >
          Custom/Deposit
        </button>
      </div>

      {/* Main Catalog View */}
      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
        {/* Search Input Bar SS 1 */}
        <div className="flex items-center justify-between gap-3 shrink-0">
          <div className="flex-1 max-w-sm bg-white rounded-md px-3 py-1.5 flex items-center gap-2 shadow-sm">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Cari"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
          </div>
          <button className="text-white hover:bg-white/10 p-2 rounded-lg transition-all cursor-pointer">
            <Filter size={18} />
          </button>
        </div>

        {/* Product Grid Cards SS 1 */}
        <div className="flex-1 overflow-y-auto pr-1">
          {products.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/70 text-xs font-bold">
              Tidak ada produk ditemukan
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {products.map((product) => {
                const hargaDisplay = product.harga_jual_toko || product.harga || 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => onAddToCart(product)}
                    className="bg-white rounded-lg p-3 text-left shadow-md hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between h-36 border border-white/20"
                  >
                    <div className="w-full flex-1 bg-slate-50 rounded flex items-center justify-center text-slate-300 mb-2">
                      {product.foto_url ? (
                        <img src={product.foto_url} alt={product.nama} className="h-full w-full object-cover rounded" />
                      ) : (
                        <Image size={32} />
                      )}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-800 truncate">{product.nama}</h5>
                      <div className="text-right text-[11px] font-extrabold text-slate-900 mt-1">
                        {Number(hargaDisplay).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Category Chips SS 1 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-400/80 text-white border border-white/40 shadow-sm'
                : 'bg-blue-600/50 text-blue-100 hover:bg-blue-600/80'
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-400/80 text-white border border-white/40 shadow-sm'
                  : 'bg-blue-600/50 text-blue-100 hover:bg-blue-600/80'
              }`}
            >
              {cat.nama}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
