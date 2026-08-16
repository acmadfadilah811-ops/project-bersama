import React, { useState, useEffect } from 'react';
import { X, BadgePercent, Image, Calculator, Plus, PackagePlus, Trash2, PlusCircle } from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';
import NumericInput from '../../../components/NumericInput';

// Satu produk (meteran ATAU unit biasa) bisa dibeli beberapa kali dalam satu
// transaksi dengan detail berbeda-beda per unit — meteran butuh ukuran (P x
// L) berbeda, unit biasa bisa butuh catatan atau jenis finishing berbeda per
// qty (mis. 2 kartu nama tapi finishing beda). Sebelumnya cuma ada satu Qty
// polos yang mengalikan SATU set detail yang sama untuk semuanya. Tiap baris
// di sini jadi baris cart TERPISAH saat disimpan (bug diperbaiki 2026-08-12).
const barisAwal = (it) => {
  const isMeteran = it?.panjang > 0 || it?.lebar > 0;
  return [{
    panjang: isMeteran ? (it.panjang || 1) : 0,
    lebar: isMeteran ? (it.lebar || 1) : 0,
    qty: it?.qty || 1,
    catatan: it?.catatan || '',
    finishingJenis: it?.finishingJenis || 'Polosan',
    finishingBiaya: it?.finishingBiaya || 0,
    serialNumbers: it?.serialNumbers || [],
  }];
};

export default function PosItemDetailPanel({ item, addons = [], onSave, onAddMoreToOrder, onDelete, onSplitBill, onDiscountClick, onClose }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tipeHitung, setTipeHitung] = useState(item?.panjang > 0 || item?.lebar > 0 ? 'meteran' : 'pcs');
  const [rows, setRows] = useState(() => barisAwal(item));
  const [hargaPerM2, setHargaPerM2] = useState(item?.hargaPerM2 || item?.harga || 0);
  const [harga, setHarga] = useState(item?.harga || 0);

  // Addon — hanya untuk item katalog (punya product_id), harga dihitung ulang
  // di server dari Addon.harga (M6); ini cuma preview & daftar pilihan.
  const [selectedAddonIds, setSelectedAddonIds] = useState(item?.addonIds || []);
  // Qty per addon independen dari qty item induk — default 1, kasir bisa ubah per addon.
  const [addonQty, setAddonQty] = useState(item?.addonQty || {});

  useEffect(() => {
    if (item) {
      const isMeteran = item.panjang > 0 || item.lebar > 0;
      setTipeHitung(isMeteran ? 'meteran' : 'pcs');
      setRows(barisAwal(item));
      setHargaPerM2(item.hargaPerM2 || item.harga || 0);
      setHarga(item.harga || 0);
      setSelectedAddonIds(item.addonIds || []);
      setAddonQty(item.addonQty || {});
    }
  }, [item]);

  const updateRow = (idx, field, value) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const addRow = () => {
    setRows((prev) => [...prev, {
      panjang: tipeHitung === 'meteran' ? 1 : 0,
      lebar: tipeHitung === 'meteran' ? 1 : 0,
      qty: 1,
      catatan: '',
      finishingJenis: 'Polosan',
      finishingBiaya: 0,
      serialNumbers: [],
    }]);
  };

  // No. Seri — hanya untuk produk dengan `pesanan_no_seri=True`. Satu unit =
  // satu nomor seri, dipilih dari pool Product.serial_numbers (bukan diketik
  // bebas) supaya server bisa validasi & tandai "terjual" (lihat
  // pos_services.create_sale). Sebelumnya kolom ini tersimpan di kartu
  // produk tapi tidak pernah tercatat terjual di transaksi mana pun (bug
  // ditemukan & diperbaiki 2026-08-13).
  const butuhSeri = !!item?.product?.pesanan_no_seri;
  const poolSeri = Array.isArray(item?.product?.serial_numbers) ? item.product.serial_numbers : [];
  const namaVarianItem = item?.variant?.nama_varian || '';
  const poolTersedia = poolSeri.filter((s) => (
    s && !s.no_pesanan && (s.variant === 'All' || s.variant === namaVarianItem)
  ));
  const semuaTerpilihBarisLain = (idxAktif) => rows
    .filter((_, i) => i !== idxAktif)
    .flatMap((r) => r.serialNumbers || []);
  const toggleSeri = (idx, noSeri) => {
    setRows((prev) => {
      const next = [...prev];
      const current = next[idx].serialNumbers || [];
      if (current.includes(noSeri)) {
        next[idx] = { ...next[idx], serialNumbers: current.filter((s) => s !== noSeri) };
      } else if (current.length < Math.max(1, parseInt(next[idx].qty || 1))) {
        next[idx] = { ...next[idx], serialNumbers: [...current, noSeri] };
      }
      return next;
    });
  };
  const removeRow = (idx) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  if (!item) return null;

  const productId = item.product?.id || null;
  const productKategoriId = item.product?.kategori || item.product?.kategori_id || null;
  // Addon hanya berlaku untuk item katalog produk (ada product_id) — sama
  // dengan validasi server di api/services/addon_sales.py resolve_addons().
  const applicableAddons = productId
    ? addons.filter((a) => {
        const scopedToProduct = Array.isArray(a.applies_to) && a.applies_to.length > 0;
        const scopedToCategory = Array.isArray(a.applies_to_categories) && a.applies_to_categories.length > 0;
        if (!scopedToProduct && !scopedToCategory) return true;
        if (scopedToProduct && a.applies_to.includes(productId)) return true;
        if (scopedToCategory && productKategoriId && a.applies_to_categories.includes(productKategoriId)) return true;
        return false;
      })
    : [];
  const toggleAddon = (addonId) => {
    setSelectedAddonIds((prev) => (
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    ));
    setAddonQty((prev) => (prev[addonId] ? prev : { ...prev, [addonId]: 1 }));
  };
  const setAddonQtyFor = (addonId, val) => {
    const n = Math.max(1, parseInt(val) || 1);
    setAddonQty((prev) => ({ ...prev, [addonId]: n }));
  };

  // Tiap baris dihitung sendiri-sendiri — harga & finishing bisa berbeda per
  // baris. rowsComputed dipakai LANGSUNG untuk tampilan (bukan disalin ke
  // state lain), jadi selalu sinkron begitu rows/harga berubah — tidak ada
  // nilai basi (bug qty->harga tidak sinkron diperbaiki 2026-08-12).
  const rowsComputed = rows.map((row) => {
    const p = tipeHitung === 'meteran' ? (parseFloat(row.panjang) || 0) : 0;
    const l = tipeHitung === 'meteran' ? (parseFloat(row.lebar) || 0) : 0;
    const luas = tipeHitung === 'meteran' ? Math.round(p * l * 100) / 100 : 0;
    const hargaSatuan = tipeHitung === 'meteran'
      ? Math.round(luas * (parseFloat(hargaPerM2) || 0))
      : (parseFloat(harga) || 0);
    const rowFinishing = parseFloat(row.finishingBiaya) || 0;
    const rowQty = Math.max(1, parseInt(row.qty || 1));
    return {
      p, l, luas, hargaSatuan, rowQty,
      subtotal: (hargaSatuan + rowFinishing) * rowQty,
    };
  });
  const totalLuasSemuaBaris = rowsComputed.reduce((sum, r) => sum + r.luas, 0);
  const totalQtySemuaBaris = rowsComputed.reduce((sum, r) => sum + r.rowQty, 0);

  // Meteran/finishing dulu dikirim ke server TANPA product_id ("item custom")
  // supaya harga hasil kalkulator client benar-benar tertagih — akibatnya
  // addon (wajib product) & potong stok otomatis tidak pernah jalan untuk
  // item begini. Sekarang product_id TETAP dikirim; server yang menghitung
  // ulang harga meteran (product_pricing.hitung_harga, M6) dari panjang/lebar
  // yang dikirim di bawah — bukan dari angka hasil kalkulator ini. Flag ini
  // cuma dipakai untuk preview UI, bukan lagi menentukan product_id dikirim/tidak.
  const isCustomPriced = tipeHitung === 'meteran' || rows.some((r) => (parseFloat(r.finishingBiaya) || 0) > 0);

  // Addon berlaku sekali per produk (tidak dikalikan qty/jumlah baris) —
  // makanya cuma ditempel ke baris pertama saat produk punya beberapa baris.
  const selectedAddons = applicableAddons.filter((a) => selectedAddonIds.includes(a.id));
  const addonsTotal = selectedAddons.reduce(
    (sum, a) => sum + (Number(a.harga) || 0) * (addonQty[a.id] || 1), 0
  );

  const totalItemAmount = rowsComputed.reduce((sum, r) => sum + r.subtotal, 0) + addonsTotal;

  // Wajib pilih No. Seri sejumlah qty per baris sebelum bisa disimpan —
  // dicek juga di server (pos_services.create_sale), ini cuma cegah kasir
  // terlanjur checkout dengan nomor seri belum lengkap.
  const serialBelumLengkap = butuhSeri && rows.some(
    (r) => (r.serialNumbers || []).length !== Math.max(1, parseInt(r.qty || 1))
  );

  // Satu baris = satu baris cart terpisah (server tidak bisa menyimpan >1
  // detail dalam satu item — lihat OrderItem/POSSaleItem, panjang/lebar/qty/
  // catatan/finishing per baris tunggal). Baris pertama menimpa item asal
  // (key sama persis), baris berikutnya dapat key baru supaya jadi baris
  // cart baru, bukan menimpa satu sama lain.
  const getItemDataList = () => rows.map((row, idx) => {
    const rc = rowsComputed[idx];
    return {
      ...item,
      key: idx === 0 ? item.key : `${item.key}-r${idx}-${Date.now()}`,
      tipeHitung,
      panjang: rc.p,
      lebar: rc.l,
      luas: rc.luas,
      hargaPerM2: tipeHitung === 'meteran' ? (parseFloat(hargaPerM2) || 0) : 0,
      harga: rc.hargaSatuan,
      finishingJenis: row.finishingJenis,
      finishingBiaya: parseFloat(row.finishingBiaya) || 0,
      diskon: 0,
      diskonTipe: 'percent',
      qty: rc.rowQty,
      catatan: row.catatan,
      hargaTotal: rc.subtotal + (idx === 0 ? addonsTotal : 0),
      isCustomPriced,
      serialNumbers: row.serialNumbers || [],
      addonQty: idx === 0 ? addonQty : {},
      addonIds: idx === 0 ? selectedAddons.map((a) => a.id) : [],
      addons: idx === 0 ? selectedAddons : [],
    };
  });

  const handleSave = () => {
    onSave(getItemDataList());
  };

  const handleAddMore = () => {
    onAddMoreToOrder(getItemDataList());
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
                ({totalQtySemuaBaris} pcs{rows.length > 1 ? `, ${rows.length} baris berbeda` : ''})
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

          {/* Harga satuan / per m2 — satu tarif dipakai semua baris di bawah */}
          {tipeHitung === 'meteran' ? (
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Harga per m² (Rp)</label>
              <NumericInput
                value={hargaPerM2}
                min={0}
                onChange={setHargaPerM2}
                className="w-full bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Harga Satuan</label>
              <div className="flex items-center gap-2 border-b border-slate-300 pb-1 focus-within:border-blue-500">
                <span className="text-xs font-bold text-slate-600">Rp</span>
                <NumericInput
                  value={harga}
                  min={0}
                  onChange={setHarga}
                  className="flex-1 text-xs font-bold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>
            </div>
          )}

          {/* Baris detail — tiap baris punya Qty sendiri (dan P x L kalau
              meteran), plus catatan & finishing sendiri, supaya beberapa
              unit produk yang sama bisa beda ukuran/catatan/finishing
              sekaligus (bug diperbaiki 2026-08-12). */}
          <div className="space-y-2">
            {rows.map((row, idx) => (
              <div key={idx} className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-700 uppercase tracking-wide">
                    Baris {idx + 1}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Hapus baris ini"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {tipeHitung === 'meteran' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Panjang (m)</label>
                      <NumericInput
                        value={row.panjang}
                        min={0.01}
                        allowDecimal
                        onChange={(val) => updateRow(idx, 'panjang', val)}
                        className="w-full bg-white px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Lebar (m)</label>
                      <NumericInput
                        value={row.lebar}
                        min={0.01}
                        allowDecimal
                        onChange={(val) => updateRow(idx, 'lebar', val)}
                        className="w-full bg-white px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Qty</label>
                      <NumericInput
                        value={row.qty}
                        min={1}
                        onChange={(val) => updateRow(idx, 'qty', Math.max(1, val))}
                        className="w-full bg-white px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {tipeHitung !== 'meteran' && (
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Qty</label>
                    <NumericInput
                      value={row.qty}
                      min={1}
                      onChange={(val) => updateRow(idx, 'qty', Math.max(1, val))}
                      className="w-24 bg-white px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Jenis Finishing</label>
                    <select
                      value={row.finishingJenis}
                      onChange={(e) => updateRow(idx, 'finishingJenis', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] font-semibold text-slate-800 focus:outline-none cursor-pointer"
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
                    <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Biaya Finishing (Rp)</label>
                    <NumericInput
                      value={row.finishingBiaya}
                      min={0}
                      onChange={(val) => updateRow(idx, 'finishingBiaya', val)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-[11px] font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Catatan Baris Ini</label>
                  <input
                    type="text"
                    placeholder="Catatan khusus baris ini..."
                    value={row.catatan}
                    onChange={(e) => updateRow(idx, 'catatan', e.target.value)}
                    className="w-full bg-white px-2 py-1.5 border border-slate-300 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {butuhSeri && (() => {
                  const qtyBaris = Math.max(1, parseInt(row.qty || 1));
                  const terpilih = row.serialNumbers || [];
                  const dipakaiBarisLain = new Set(semuaTerpilihBarisLain(idx));
                  return (
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 block mb-0.5">
                        No. Seri ({terpilih.length}/{qtyBaris}) — wajib dipilih
                      </label>
                      {poolTersedia.length === 0 ? (
                        <div className="text-[10px] text-rose-600 font-semibold bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">
                          Tidak ada No. Seri tersedia untuk produk ini. Tambahkan dulu di kartu produk (tab Seri).
                        </div>
                      ) : (
                        <div className="max-h-28 overflow-y-auto grid grid-cols-2 gap-1 bg-white border border-slate-300 rounded-lg p-1.5">
                          {poolTersedia.map((s) => {
                            const dipilih = terpilih.includes(s.no_seri);
                            const dipakaiLain = dipakaiBarisLain.has(s.no_seri);
                            const disabled = !dipilih && (dipakaiLain || terpilih.length >= qtyBaris);
                            return (
                              <button
                                type="button"
                                key={s.id || s.no_seri}
                                disabled={disabled}
                                onClick={() => toggleSeri(idx, s.no_seri)}
                                className={`text-[10px] font-bold rounded-md px-2 py-1 border transition-colors cursor-pointer ${
                                  dipilih
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : disabled
                                      ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                      : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400'
                                }`}
                                title={dipakaiLain ? 'Sudah dipakai di baris lain' : s.no_seri}
                              >
                                {s.no_seri}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-1 border-t border-blue-100">
                  {tipeHitung === 'meteran' && <span>{rowsComputed[idx]?.luas || 0} m² / lembar</span>}
                  <span className="font-black text-blue-700 ml-auto">
                    Rp {(rowsComputed[idx]?.subtotal || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-blue-300 text-blue-600 text-xs font-bold hover:bg-blue-50 transition-all cursor-pointer"
          >
            <Plus size={13} /> Tambah Baris Lain (ukuran/catatan/finishing beda)
          </button>

          {tipeHitung === 'meteran' && (
            <div className="flex justify-between items-center bg-blue-50 p-2 rounded-lg border border-blue-200 text-xs">
              <span className="font-semibold text-slate-600">Total Luas Semua Baris:</span>
              <span className="font-black text-blue-700">{Math.round(totalLuasSemuaBaris * 100) / 100} m²</span>
            </div>
          )}

          {/* Addon — berlaku untuk semua item katalog, termasuk meteran/finishing */}
          {applicableAddons.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <PackagePlus size={14} className="text-[#0088FF]" />
                <span>Addon</span>
              </div>
              <div className="space-y-1.5 pt-1">
                  {applicableAddons.map((addon) => {
                    const isSelected = selectedAddonIds.includes(addon.id);
                    return (
                    <div
                      key={addon.id}
                      className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-blue-300"
                    >
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleAddon(addon.id)}
                          className="accent-[#0088FF] shrink-0"
                        />
                        <span className="truncate">{addon.nama}</span>
                      </label>
                      {isSelected && (
                        <input
                          type="number"
                          min={1}
                          value={addonQty[addon.id] || 1}
                          onChange={(e) => setAddonQtyFor(addon.id, e.target.value)}
                          className="w-12 shrink-0 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-center text-xs font-bold focus:outline-none focus:bg-white"
                          title="Qty addon"
                        />
                      )}
                      <span className="text-xs font-bold text-slate-600 shrink-0 w-20 text-right">
                        +Rp {Number((addon.harga || 0) * (isSelected ? (addonQty[addon.id] || 1) : 1)).toLocaleString('id-ID')}
                      </span>
                    </div>
                    );
                  })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onDiscountClick}
            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-left transition-colors hover:bg-blue-100"
          >
            <span className="flex items-center gap-2 text-xs font-extrabold text-blue-800">
              <BadgePercent size={16} /> Pilih Diskon Marketing
            </span>
            <span className="mt-0.5 block text-[10px] font-semibold text-blue-700">
              Gunakan kupon atau Diskon Penjualan dari menu Disc. Pesanan. Diskon manual per item tidak tersedia.
            </span>
          </button>
        </div>

        {/* Action Buttons: Delete & Split Bill */}
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
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              Split Bill
            </button>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar SS 4 — Save & "tambah produk lain" selalu
          terlihat tanpa scroll, supaya kasir tahu cara kembali ke katalog
          untuk menambah produk lain saat sedang di layar Detail Item. */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
        {serialBelumLengkap && (
          <div className="text-[10px] text-rose-600 font-semibold text-center">
            Lengkapi pilihan No. Seri di setiap baris sebelum menyimpan.
          </div>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={serialBelumLengkap}
          className={`w-full py-3 rounded-xl text-white font-extrabold text-xs tracking-wide shadow-lg transition-all ${
            serialBelumLengkap
              ? 'bg-slate-300 shadow-none cursor-not-allowed'
              : 'bg-[#0088FF] hover:bg-blue-600 shadow-blue-500/20 cursor-pointer'
          }`}
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleAddMore}
          disabled={serialBelumLengkap}
          className={`w-full py-2.5 rounded-xl border font-extrabold text-xs tracking-wide flex items-center justify-center gap-1.5 transition-all ${
            serialBelumLengkap
              ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
              : 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer'
          }`}
        >
          <PlusCircle size={16} /> Simpan &amp; Tambah Produk Lain dari Katalog
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
