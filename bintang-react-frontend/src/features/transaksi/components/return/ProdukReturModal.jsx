import { useState, useEffect } from 'react';
import { Minus, Plus } from 'lucide-react';

/**
 * Modal Pop-Up "Produk Retur" — Presisi SS No. 2
 */
export default function ProdukReturModal({ isOpen, onClose, onSave, itemData, maxQty = 9999 }) {
  const [qty, setQty] = useState(1);
  const [satuan, setSatuan] = useState('');
  const [alasan, setAlasan] = useState('');
  const [catatan, setCatatan] = useState('');
  const [jadikanStokKeluar, setJadikanStokKeluar] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (itemData) {
      setQty(Number(itemData.qty_retur || itemData.qty || 1));
      setSatuan(itemData.uom_kode || itemData.product_satuan || 'Pcs');
      setAlasan(itemData.alasan_retur || '');
      setCatatan(itemData.catatan_retur || '');
      setJadikanStokKeluar(itemData.jadikan_stok_keluar !== false);
      setErrorMsg('');
    }
  }, [itemData]);

  if (!isOpen || !itemData) return null;

  const handleIncrement = () => setQty((prev) => Math.min(maxQty, prev + 1));
  const handleDecrement = () => setQty((prev) => Math.max(1, prev - 1));

  const handleSubmit = () => {
    if (!alasan.trim()) {
      setErrorMsg('Alasan pengembalian wajib diisi.');
      return;
    }
    setErrorMsg('');
    onSave?.({
      item_id: itemData.id,
      product: itemData.product || itemData.product_id,
      variant: itemData.variant || itemData.variant_id,
      qty,
      satuan,
      alasan_retur: alasan,
      catatan_retur: catatan,
      jadikan_stok_keluar: jadikanStokKeluar,
      harga_beli: itemData.harga_beli,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-slate-700">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base">Produk Retur</h3>
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
              onClick={handleSubmit}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg px-4 py-1.5 cursor-pointer transition-colors"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs font-semibold">
          {/* Card Info Produk */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 text-sm block">{itemData.product_nama || 'Produk'}</span>
              <span className="text-[11px] text-slate-400 font-medium block">
                {itemData.qty_beli || itemData.qty || 1} item
              </span>
            </div>
          </div>

          {/* QTY Retur */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">QTY Retur</label>
            <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button
                type="button"
                onClick={handleDecrement}
                className="w-12 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 border-r border-slate-200 cursor-pointer"
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
                className="w-full text-center font-bold text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleIncrement}
                className="w-12 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 border-l border-slate-200 cursor-pointer"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Pilih Satuan */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">Pilih Satuan</label>
            <select
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
              className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer"
            >
              <option value="">Pilih Satuan</option>
              <option value="Pcs">Pcs</option>
              <option value="Sheet">Sheet</option>
              <option value="Box">Box</option>
              <option value="Pack">Pack</option>
              <option value="Roll">Roll</option>
            </select>
          </div>

          {/* Alasan pengembalian (MANDATORY) */}
          <div>
            <label className="block text-slate-600 mb-1 font-bold">
              Alasan pengembalian <span className="text-rose-500">*</span>
            </label>
            <select
              value={alasan}
              onChange={(e) => {
                setAlasan(e.target.value);
                if (e.target.value) setErrorMsg('');
              }}
              className={`w-full text-xs font-semibold bg-white border rounded-xl px-3 py-2.5 focus:outline-none cursor-pointer ${
                errorMsg ? 'border-rose-500 text-rose-600 bg-rose-50/30' : 'border-slate-200 text-slate-700'
              }`}
            >
              <option value="">Alasan pengembalian</option>
              <option value="Barang Rusak / Cacat">Barang Rusak / Cacat</option>
              <option value="Salah Kirim / Tidak Sesuai Spesifikasi">Salah Kirim / Tidak Sesuai Spesifikasi</option>
              <option value="Kelebihan Kirim">Kelebihan Kirim</option>
              <option value="Kadaluwarsa">Kadaluwarsa</option>
              <option value="Lainnya">Lainnya</option>
            </select>
            {errorMsg && <p className="text-[11px] font-bold text-rose-500 mt-1">{errorMsg}</p>}
          </div>

          {/* Catatan */}
          <div>
            <textarea
              rows={3}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan"
              className="w-full text-xs border border-slate-200 rounded-xl p-3 text-slate-700 placeholder:text-slate-400 focus:outline-none resize-none"
            />
          </div>

          {/* Toggle Switch Jadikan Stok Keluar */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-slate-700">Jadikan Stok Keluar</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">{jadikanStokKeluar ? 'Ya' : 'Tidak'}</span>
              <button
                type="button"
                onClick={() => setJadikanStokKeluar(!jadikanStokKeluar)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer ${
                  jadikanStokKeluar ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 shadow-xs ${
                    jadikanStokKeluar ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
