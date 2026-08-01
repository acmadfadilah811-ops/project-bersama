import { useState } from 'react';
import { Minus, Plus, Search, Edit2, X, ListFilter } from 'lucide-react';

/**
 * Tabel Produk Yang Dikembalikan & Ringkasan Retur — Presisi SS No. 1 & SS No. 3
 */
export default function ReturPembelianItemsTable({
  doc,
  items = [],
  availableProducts = [],
  onSelectProductToReturn,
  onEditItem,
  onRemoveItem,
  onToggleStokKeluar,
  onOpenPembayaran,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [headerCounter, setHeaderCounter] = useState(0);

  const fmtIDR = (num) => `IDR ${Math.round(Number(num) || 0).toLocaleString('id-ID')}`;

  const subtotalRetur = items.reduce(
    (acc, it) => acc + Number(it.qty || 1) * Number(it.harga_beli || 0),
    0
  );

  const isDraft = doc.status === 'draft';

  const filteredProducts = availableProducts.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (p.product_nama || '').toLowerCase().includes(q) || (p.product_sku || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 text-xs font-semibold text-slate-700">
      {/* Container Utama Produk Yang Dikembalikan */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {/* Header Bar Biru */}
        <div className="bg-[#0088E8] text-white px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-sm">Produk yang dikembalikan</span>

          {/* Sisi Kanan Header Bar: Counter + Search Dropdown */}
          {isDraft && (
            <div className="flex items-center gap-3">
              {/* Counter [-] 0 [+] */}
              <div className="flex items-center bg-white text-slate-800 rounded-lg overflow-hidden border border-white/30">
                <button
                  type="button"
                  onClick={() => setHeaderCounter((c) => Math.max(0, c - 1))}
                  className="px-2.5 py-1 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <Minus size={12} />
                </button>
                <span className="px-3 font-bold text-xs">{headerCounter}</span>
                <button
                  type="button"
                  onClick={() => setHeaderCounter((c) => c + 1)}
                  className="px-2.5 py-1 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Input Search Dropdown Tambah Produk */}
              <div className="relative">
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onFocus={() => setDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setDropdownOpen(true);
                    }}
                    placeholder="Tambah Produk"
                    className="pl-8 pr-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-semibold placeholder:text-slate-400 focus:outline-none w-48 shadow-2xs"
                  />
                </div>

                {/* Dropdown Options */}
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 top-10 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-1 max-h-56 overflow-y-auto divide-y divide-slate-100">
                      {filteredProducts.length === 0 ? (
                        <div className="px-4 py-3 text-center text-slate-400 text-xs">Produk tidak ditemukan</div>
                      ) : (
                        filteredProducts.map((prod) => (
                          <button
                            key={prod.id || prod.product}
                            type="button"
                            onClick={() => {
                              setDropdownOpen(false);
                              setSearchQuery('');
                              onSelectProductToReturn?.(prod);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-slate-800 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <span className="font-bold block">{prod.product_nama}</span>
                              <span className="text-[10px] text-slate-400 font-medium">Beli: {prod.qty} item</span>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-slate-600">
                              {fmtIDR(prod.harga_beli)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tabel / Empty State Body */}
        {items.length === 0 ? (
          /* Empty State (SS No. 1) */
          <div className="py-12 text-center text-slate-400 font-bold">
            Tidak ada data
          </div>
        ) : (
          /* Table Items Retur (SS No. 3) */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700 font-bold bg-slate-50/50">
                  <th className="py-3 px-4 font-bold">Produk</th>
                  <th className="py-3 px-4 font-bold text-center">QTY Beli</th>
                  <th className="py-3 px-4 font-bold text-left">Harga</th>
                  <th className="py-3 px-4 font-bold text-center">Discount</th>
                  <th className="py-3 px-4 font-bold text-left">Total Harga</th>
                  <th className="py-3 px-4 font-bold text-center">QTY Retur</th>
                  <th className="py-3 px-4 font-bold text-center">Jadikan Stok Keluar</th>
                  <th className="py-3 px-4 font-bold text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {items.map((it) => {
                  const qtyRetur = Number(it.qty || 1);
                  const hargaBeli = Number(it.harga_beli || 0);
                  const totalHarga = qtyRetur * hargaBeli;
                  const stokKeluar = it.jadikan_stok_keluar !== false;

                  return (
                    <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {it.product_nama || 'Produk'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {it.qty_beli || it.original_qty || it.qty || 1}
                      </td>
                      <td className="py-3.5 px-4 font-mono">{fmtIDR(hargaBeli)}</td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-500">0</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {fmtIDR(totalHarga)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {qtyRetur}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500">{stokKeluar ? 'Ya' : 'Tidak'}</span>
                          <button
                            type="button"
                            disabled={!isDraft}
                            onClick={() => onToggleStokKeluar?.(it, !stokKeluar)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                              stokKeluar ? 'bg-blue-600' : 'bg-slate-300'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 shadow-xs ${
                                stokKeluar ? 'translate-x-4.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isDraft && (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={() => onEditItem?.(it)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold cursor-pointer transition-colors"
                            >
                              <Edit2 size={12} /> Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveItem?.(it.id)}
                              className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-700 font-bold cursor-pointer transition-colors"
                            >
                              <X size={12} /> Hapus
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card Ringkasan Retur (Bottom Right SS No. 3) */}
      {items.length > 0 && (
        <div className="flex justify-end pt-2">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs w-full max-w-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 font-bold text-slate-800 text-sm">
              <ListFilter size={16} /> Ringkasan Retur
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Subtotal</span>
                <span className="font-mono font-bold text-slate-800">{fmtIDR(subtotalRetur)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Pajak</span>
                <span className="font-mono font-semibold text-slate-700">IDR 0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Discount</span>
                <span className="font-mono font-semibold text-slate-700">IDR 0</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-800 font-bold">Jumlah</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{fmtIDR(subtotalRetur)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-slate-500 font-medium">Status Bayar</span>
                <button
                  type="button"
                  onClick={onOpenPembayaran}
                  className="text-blue-600 hover:text-blue-800 font-bold text-xs cursor-pointer transition-colors"
                >
                  Atur pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
