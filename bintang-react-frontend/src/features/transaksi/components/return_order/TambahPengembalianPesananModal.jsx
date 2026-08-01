import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Modal Pop-Up "Pengembalian Pesanan" — Presisi SS No. 1
 */
export default function TambahPengembalianPesananModal({
  isOpen,
  onClose,
  onSave,
  orderItems = [],
  editingReturnItem = null,
}) {
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [itemQtys, setItemQtys] = useState({});
  const [alasan, setAlasan] = useState('Kelebihan jumlah yang dikirimkan');
  const [kembalikanStok, setKembalikanStok] = useState(true);

  useEffect(() => {
    if (editingReturnItem) {
      setSelectedItemIds([editingReturnItem.order_item_id || editingReturnItem.id]);
      setItemQtys({ [editingReturnItem.order_item_id || editingReturnItem.id]: editingReturnItem.qty || 1 });
      setAlasan(editingReturnItem.alasan || 'Kelebihan jumlah yang dikirimkan');
      setKembalikanStok(editingReturnItem.kembalikan_stok !== false);
    } else if (orderItems.length > 0) {
      // Default: select first item if available
      const initialQtys = {};
      orderItems.forEach((it) => {
        initialQtys[it.id] = Number(it.qty || 1);
      });
      setItemQtys(initialQtys);
      setSelectedItemIds([orderItems[0].id]);
      setAlasan('Kelebihan jumlah yang dikirimkan');
      setKembalikanStok(true);
    }
  }, [editingReturnItem, orderItems, isOpen]);

  if (!isOpen) return null;

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.length === orderItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(orderItems.map((it) => it.id));
    }
  };

  const handleQtyChange = (id, delta, maxQty) => {
    setItemQtys((prev) => {
      const current = prev[id] || 1;
      const next = Math.max(1, Math.min(maxQty, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const canSave = selectedItemIds.length > 0 && !!alasan;

  const handleSave = () => {
    if (!canSave) return;
    const returnItems = orderItems
      .filter((it) => selectedItemIds.includes(it.id))
      .map((it) => ({
        order_item_id: it.id,
        nama: it.jenis_produk || it.nama || 'Produk',
        qty: itemQtys[it.id] || 1,
        max_qty: Number(it.qty || 1),
        harga: Number(it.harga_jual || it.harga || 0),
        alasan: alasan,
        kembalikan_stok: kembalikanStok,
      }));

    onSave?.({
      items: returnItems,
      alasan,
      kembalikan_stok: kembalikanStok,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-slate-700">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Pengembalian Pesanan</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 py-1.5 cursor-pointer transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              className={`text-xs font-bold rounded-lg px-4 py-1.5 transition-colors ${
                canSave
                  ? 'bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer shadow-2xs font-bold'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 space-y-5 text-xs font-semibold">
          {/* Item List Container */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
            {/* Header Select All */}
            <label className="flex items-center gap-3 font-bold text-slate-700 pb-2 border-b border-slate-100 cursor-pointer">
              <input
                type="checkbox"
                checked={orderItems.length > 0 && selectedItemIds.length === orderItems.length}
                onChange={toggleSelectAll}
                className="accent-blue-600 w-4 h-4 cursor-pointer rounded"
              />
              <span>Pilih Produk</span>
            </label>

            {/* List Products */}
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {orderItems.length === 0 ? (
                <div className="py-6 text-center text-slate-400">Tidak ada produk pesanan</div>
              ) : (
                orderItems.map((item) => {
                  const isSelected = selectedItemIds.includes(item.id);
                  const qty = itemQtys[item.id] || 1;
                  const maxQty = Number(item.qty || 1);

                  return (
                    <div key={item.id} className="flex items-center justify-between py-1.5">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(item.id)}
                          className="accent-blue-600 w-4 h-4 cursor-pointer rounded"
                        />
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-sm">
                          📦
                        </div>
                        <span className="font-bold text-slate-800">{item.jenis_produk || item.nama}</span>
                      </label>

                      {/* Counter [-] [ QTY ] [+] */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, -1, maxQty)}
                          className="px-2.5 py-1 text-slate-500 hover:bg-slate-50 border-r border-slate-200 cursor-pointer"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-10 text-center font-bold text-slate-800">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, 1, maxQty)}
                          className="px-2.5 py-1 text-slate-500 hover:bg-slate-50 border-l border-slate-200 cursor-pointer"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Alasan Pengembalian Dropdown */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Alasan Pengembalian</label>
            <select
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
            >
              <option value="Kelebihan jumlah yang dikirimkan">Kelebihan jumlah yang dikirimkan</option>
              <option value="Barang Rusak / Cacat">Barang Rusak / Cacat</option>
              <option value="Tidak Sesuai Spesifikasi">Tidak Sesuai Spesifikasi</option>
              <option value="Kadaluwarsa">Kadaluwarsa</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {/* Kembalikan ke stock Toggle Switch */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Kembalikan ke stock</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">{kembalikanStok ? 'Ya' : 'Tidak'}</span>
                <button
                  type="button"
                  onClick={() => setKembalikanStok(!kembalikanStok)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                    kembalikanStok ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 shadow-xs ${
                      kembalikanStok ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Barang akan dikembalikan atau ditambahkan ke stok ketika pengembalian dikonfirmasi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
