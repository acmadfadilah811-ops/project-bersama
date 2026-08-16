import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/** Pemilih sumber item nota WA: produk/varian katalog, paket, atau custom.
 * Produk katalog dicari lewat kotak pencarian (bukan <select> polos) supaya
 * gampang ditemukan di antara banyak produk — <select> panjang susah
 * di-scroll & type-ahead browser cuma cocok dari awal nama, tidak substring
 * (masalah ditemukan & diperbaiki 2026-08-12). */
export default function WaOrderItemProductSource({
  item,
  products,
  packages,
  onProductChange,
  onVariantChange,
  onPackageChange,
  onNameChange,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef(null);

  const selectedProduct = products.find((product) => String(product.id) === String(item.product));
  const variants = selectedProduct?.variants || [];
  const isCatalogProduct = Boolean(item.product);
  const isPackage = Boolean(item.paket);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => {
      const namaCocok = (product.nama || '').toLowerCase().includes(q);
      const skuCocok = (product.sku || '').toLowerCase().includes(q);
      const variantCocok = (product.variants || []).some((v) => (v.nama_varian || '').toLowerCase().includes(q));
      return namaCocok || skuCocok || variantCocok;
    });
  }, [products, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePilihProduk = (product) => {
    onProductChange(String(product.id));
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleHapusPilihan = () => {
    onProductChange('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-[9px] font-black uppercase tracking-wide text-emerald-700">
        Pilih Produk Katalog
      </label>
      <div ref={searchRef} className="relative">
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            disabled={isPackage}
            placeholder="Cari nama atau SKU produk..."
            value={isDropdownOpen ? searchQuery : (selectedProduct ? `${selectedProduct.nama}${selectedProduct.sku ? ` — ${selectedProduct.sku}` : ''}` : '')}
            onFocus={() => { setIsDropdownOpen(true); setSearchQuery(''); }}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mt-1 w-full rounded-lg border border-emerald-300 bg-white pl-6 pr-6 py-2 text-xs font-bold normal-case tracking-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isCatalogProduct && !isPackage && (
            <button
              type="button"
              onClick={handleHapusPilihan}
              className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Hapus pilihan produk"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {isDropdownOpen && !isPackage && (
          <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-emerald-200 bg-white shadow-lg">
            {filteredProducts.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400">
                {products.length === 0 ? 'Tidak ada produk aktif di katalog.' : 'Tidak ada produk yang cocok.'}
              </div>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => handlePilihProduk(product)}
                  className="block w-full text-left px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-emerald-50 cursor-pointer"
                >
                  {product.nama}{product.sku ? ` — ${product.sku}` : ''}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {isCatalogProduct && variants.length > 0 && (
        <select
          value={item.variant || ''}
          onChange={(event) => onVariantChange(event.target.value)}
          className="w-full rounded border border-emerald-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {variants.map((variant) => (
            <option key={variant.id} value={variant.id}>{variant.nama_varian}</option>
          ))}
        </select>
      )}

      <label className="block text-[9px] font-black uppercase tracking-wide text-indigo-700">
        Atau Paket Produk
        <select
          value={item.paket || ''}
          onChange={(event) => onPackageChange(event.target.value)}
          disabled={isCatalogProduct}
          className="mt-1 w-full rounded border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[10px] font-bold normal-case tracking-normal text-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">-- Pilih paket produk --</option>
          {packages.map((paket) => (
            <option key={paket.id} value={paket.id}>{paket.nama}</option>
          ))}
        </select>
      </label>

      {isCatalogProduct || isPackage ? (
        <p className="text-[10px] font-bold text-slate-500 truncate" title={item.jenis_produk || ''}>
          {item.jenis_produk}
        </p>
      ) : (
        <input
          type="text"
          value={item.jenis_produk || ''}
          placeholder="Atau ketik nama item custom..."
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full bg-transparent border-0 focus:outline-none focus:ring-0 p-0 text-xs font-bold text-slate-800"
        />
      )}
    </div>
  );
}
