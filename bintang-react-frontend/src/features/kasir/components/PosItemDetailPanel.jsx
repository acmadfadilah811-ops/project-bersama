import React, { useState, useEffect } from 'react';
import { X, Percent, DollarSign, MessageSquare, Image, Calculator, Scissors, Plus } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function PosItemDetailPanel({ item, onSave, onAddMoreToOrder, onDelete, onSplitBill, onClose }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipeHitung, setTipeHitung] = useState(item?.panjang > 0 || item?.lebar > 0 ? 'meteran' : 'pcs');
  const [panjang, setPanjang] = useState(item?.panjang || 1);
  const [lebar, setLebar] = useState(item?.lebar || 1);
  const [hargaPerM2, setHargaPerM2] = useState(item?.hargaPerM2 || item?.harga || 0);

  const [harga, setHarga] = useState(item?.harga || 0);
  const [diskon, setDiskon] = useState(item?.diskon || 0);
  const [diskonTipe, setDiskonTipe] = useState(item?.diskonTipe || 'percent'); // 'percent' | 'nominal'
  const [qty, setQty] = useState(item?.qty || 1);
  const [catatan, setCatatan] = useState(item?.catatan || '');

  // Finishing / Menu Input Tambahan
  const [finishingJenis, setFinishingJenis] = useState(item?.finishingJenis || 'Polosan');
  const [finishingBiaya, setFinishingBiaya] = useState(item?.finishingBiaya || 0);

  useEffect(() => {
    if (item) {
      const isMeteran = item.panjang > 0 || item.lebar > 0;
      setTipeHitung(isMeteran ? 'meteran' : 'pcs');
      setPanjang(item.panjang || 1);
      setLebar(item.lebar || 1);
      setHargaPerM2(item.hargaPerM2 || item.harga || 0);
      setHarga(item.harga || 0);
      setDiskon(item.diskon || 0);
      setDiskonTipe(item.diskonTipe || 'percent');
      setQty(item.qty || 1);
      setCatatan(item.catatan || '');
      setFinishingJenis(item.finishingJenis || 'Polosan');
      setFinishingBiaya(item.finishingBiaya || 0);
    }
  }, [item]);

  if (!item) return null;

  // Calculators
  const p = parseFloat(panjang) || 0;
  const l = parseFloat(lebar) || 0;
  const luas = Math.round(p * l * 100) / 100;

  const basePriceUnit = tipeHitung === 'meteran'
    ? Math.round(luas * (parseFloat(hargaPerM2) || 0))
    : (parseFloat(harga) || 0);

  const totalBiayaFinishing = parseFloat(finishingBiaya) || 0;
  const priceBeforeDiscount = basePriceUnit + totalBiayaFinishing;

  let diskonAmount;
  if (diskonTipe === 'percent') {
    diskonAmount = Math.round((priceBeforeDiscount * (parseFloat(diskon) || 0)) / 100);
  } else {
    diskonAmount = parseFloat(diskon) || 0;
  }

  const priceAfterDiscount = Math.max(0, priceBeforeDiscount - diskonAmount);
  const totalItemAmount = priceAfterDiscount * (parseInt(qty || 1));

  // Item ini menyimpang dari harga katalog polos (meteran, ada finishing,
  // atau ada diskon per-item) -> harus dikirim ke server sebagai item custom
  // (tanpa product_id) supaya harga hasil kalkulator benar-benar tertagih.
  // Server SELALU menghitung ulang harga dari Product.harga_jual_toko untuk
  // item ber-product_id (M6) — mengirim item begini dengan product_id akan
  // membuat harga hasil kalkulator diam-diam diabaikan saat checkout.
  const isCustomPriced = tipeHitung === 'meteran' || totalBiayaFinishing > 0 || diskonAmount > 0;

  const getItemData = () => ({
    ...item,
    tipeHitung,
    panjang: tipeHitung === 'meteran' ? p : 0,
    lebar: tipeHitung === 'meteran' ? l : 0,
    luas: tipeHitung === 'meteran' ? luas : 0,
    hargaPerM2: tipeHitung === 'meteran' ? parseFloat(hargaPerM2) || 0 : 0,
    harga: basePriceUnit,
    finishingJenis,
    finishingBiaya: totalBiayaFinishing,
    diskon: parseFloat(diskon) || 0,
    diskonTipe,
    qty: parseInt(qty || 1),
    catatan,
    hargaTotal: totalItemAmount,
    isCustomPriced,
  });

  const handleSave = () => {
    onSave(item.key, getItemData());
  };

  const handleAddMore = () => {
    onAddMoreToOrder(getItemData());
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  return (
    <div className="flex-1 bg-[#F4F7FE] flex flex-col h-full overflow-hidden border-l border-slate-200">
      {/* Header Blue Bar SS 4 */}
      <div className="bg-[#0088FF] px-4 py-3 text-white flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-wide">Detail Item</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-100/70">
        {/* Item Image Box & Name */}
        <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
            <Image size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-800 text-sm truncate">{item.nama}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-bold text-blue-600">
                Rp {totalItemAmount.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                ({qty} pcs @ Rp {priceAfterDiscount.toLocaleString('id-ID')})
              </span>
            </div>
          </div>
        </div>

        {/* Form Input Fields */}
        <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          {/* Toggle Tipe Hitung: Pcs vs Meteran */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Tipe Hitungan Produk</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTipeHitung('pcs')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  tipeHitung === 'pcs' ? 'bg-[#0088FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Unit Biasa (Pcs)
              </button>
              <button
                type="button"
                onClick={() => setTipeHitung('meteran')}
                className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  tipeHitung === 'meteran' ? 'bg-[#0088FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Calculator size={13} /> Meteran (P × L)
              </button>
            </div>
          </div>

          {/* Section Input Meteran jika tipeHitung === 'meteran' */}
          {tipeHitung === 'meteran' ? (
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Panjang (meter)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={panjang}
                    onChange={(e) => setPanjang(e.target.value)}
                    className="w-full bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Lebar (meter)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={lebar}
                    onChange={(e) => setLebar(e.target.value)}
                    className="w-full bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-blue-200 text-xs">
                <span className="font-semibold text-slate-600">Total Luas:</span>
                <span className="font-black text-blue-700">{luas} m²</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Harga per m² (Rp)</label>
                <input
                  type="number"
                  value={hargaPerM2}
                  onChange={(e) => setHargaPerM2(e.target.value)}
                  className="w-full bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Harga Satuan</label>
              <div className="flex items-center gap-2 border-b border-slate-300 pb-1 focus-within:border-blue-500">
                <span className="text-xs font-bold text-slate-600">$</span>
                <input
                  type="number"
                  value={harga}
                  onChange={(e) => setHarga(e.target.value)}
                  className="flex-1 text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>
            </div>
          )}

          {/* Menu Input Tambahan / Finishing */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Scissors size={14} className="text-[#0088FF]" />
              <span>Menu Input Tambahan / Finishing</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Jenis Finishing</label>
                <select
                  value={finishingJenis}
                  onChange={(e) => setFinishingJenis(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="Polosan">Polosan / Tanpa Finishing</option>
                  <option value="Mata Ayam">Mata Ayam (Ring)</option>
                  <option value="Lipat Pres">Lipat Pres Keliling</option>
                  <option value="Laminating Glossy">Laminating Glossy</option>
                  <option value="Laminating Doff">Laminating Doff</option>
                  <option value="Potong Pas">Potong Pas Gambar</option>
                  <option value="Custom">Finishing Custom</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Biaya Finishing (Rp)</label>
                <input
                  type="number"
                  value={finishingBiaya}
                  onChange={(e) => setFinishingBiaya(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Diskon Field */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Diskon</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 border-b border-slate-300 pb-1 focus-within:border-blue-500">
                <Scissors size={14} className="text-[#0088FF]" />
                <input
                  type="number"
                  value={diskon}
                  onChange={(e) => setDiskon(e.target.value)}
                  className="flex-1 text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDiskonTipe('percent')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    diskonTipe === 'percent' ? 'bg-[#0088FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Percent size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setDiskonTipe('nominal')}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    diskonTipe === 'nominal' ? 'bg-[#0088FF] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <DollarSign size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Qty & Catatan */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Qty</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || 1)))}
                className="w-full border-b border-blue-500 pb-1 text-xs font-extrabold text-blue-600 focus:outline-none bg-transparent"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Catatan</label>
              <div className="flex items-center gap-1 border-b border-slate-300 pb-1 focus-within:border-blue-500">
                <MessageSquare size={13} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Catatan..."
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  className="w-full text-xs font-medium text-slate-700 focus:outline-none bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons: Multi-Item & Split Bill */}
        <div className="flex justify-between items-center pt-1 gap-2">
          <button
            type="button"
            onClick={handleDelete}
            className="px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer shrink-0"
          >
            Batal Item
          </button>

          {onSplitBill && (
            <button
              type="button"
              onClick={onSplitBill}
              className="px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
            >
              Split Bill
            </button>
          )}

          <button
            type="button"
            onClick={handleAddMore}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <Plus size={15} /> Tambah Pesanan
          </button>
        </div>
      </div>

      {/* Save Button SS 4 */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-[#0088FF] hover:bg-blue-600 text-white font-extrabold text-xs tracking-wide shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
        >
          Save
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        title="Hapus Item"
        message="Apakah anda yakin ingin menghapus item ini?"
        onConfirm={() => {
          setShowDeleteModal(false);
          onDelete(item.key);
        }}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
