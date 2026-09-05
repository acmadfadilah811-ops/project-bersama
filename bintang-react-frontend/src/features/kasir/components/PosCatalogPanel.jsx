import React, { useState } from 'react';
import { Search, Filter, Image, RefreshCw } from 'lucide-react';

export default function PosCatalogPanel({
  products = [],
  packages = [],
  categories = [],
  onAddToCart,
  onAddPackage,
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  onSync,
  syncing = false,
}) {
  const [activeTab, setActiveTab] = useState('produk');
  const showingPackages = activeTab === 'paket';
  const catalogItems = showingPackages ? packages : products;

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
          onClick={() => setActiveTab('paket')}
          className={`pb-2.5 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'paket' ? 'border-white text-white' : 'border-transparent text-blue-100 hover:text-white'
          }`}
        >
          Paket
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
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            title="Sinkronkan harga & stok produk terbaru"
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Sync...' : 'Sync'}</span>
          </button>
          <button className="text-white hover:bg-white/10 p-2 rounded-lg transition-all cursor-pointer">
            <Filter size={18} />
          </button>
        </div>

        {/* Product Grid Cards SS 1 */}
        <div className="flex-1 overflow-y-auto pr-1">
          {catalogItems.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/70 text-xs font-bold">
              {showingPackages ? 'Tidak ada paket aktif untuk POS' : 'Tidak ada produk ditemukan'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {catalogItems.map((item) => {
                const hargaDisplay = showingPackages
                  ? (item.harga_jual_offline || 0)
                  : (item.harga_jual_toko || item.harga || 0);
                return (
                  <button
                    key={`${showingPackages ? 'paket' : 'produk'}-${item.id}`}
                    onClick={() => (showingPackages ? onAddPackage(item) : onAddToCart(item))}
                    className="bg-white rounded-lg p-2.5 text-left shadow-md hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer flex flex-col gap-2 overflow-hidden min-w-0 border border-white/20"
                  >
                    <div className="w-full h-20 shrink-0 overflow-hidden bg-slate-50 rounded flex items-center justify-center text-slate-300">
                      {item.foto_url || item.foto ? (
                        <img
                          src={item.foto_url || item.foto}
                          alt={item.nama}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Image size={32} />
                      )}
                    </div>
                    <div className="w-full min-w-0">
                      <h5 className="font-bold text-xs leading-tight text-slate-800 h-[30px] overflow-hidden break-words">
                        {item.nama}
                      </h5>
                      <div className="text-right text-[11px] leading-tight font-extrabold text-slate-900 mt-1">
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
        {!showingPackages && <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
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
        </div>}
      </div>
    </div>
  );
}
