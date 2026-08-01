import { useState } from 'react';
import { Plus, Upload, Edit3, Check, X, Trash2, Percent } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import ImportOrderItemsModal from './ImportOrderItemsModal';
import TambahProdukPesananModal from './TambahProdukPesananModal';
import TambahPaketModal from './TambahPaketModal';
import RingkasanPesananCard from './RingkasanPesananCard';
import PengaturanDiskonModal from './PengaturanDiskonModal';

/**
 * Baris item produk pesanan. Kolom: No | Deskripsi | Seri | Qty | Harga (IDR)
 * | Diskon | Total Harga (IDR) | Aksi.
 */
function ItemRow({ item, idx, order, canEdit, editingId, setEditingId, editQty, setEditQty, editHarga, setEditHarga, busyId, onSave, onDelete, onOpenDiskon }) {
  const namaProduk = item.jenis_produk || item.product_nama || item.nama_produk || item.nama || 'Produk Custom';
  const qty = item.qty ?? item.jumlah ?? 1;
  const harga = item.harga_jual ?? item.harga_satuan ?? item.harga ?? 0;
  const rawSubtotal = qty * harga;
  const diskonPersen = order?.diskon_persen ?? 0;
  const itemDiskon = Math.round(rawSubtotal * (diskonPersen / 100));
  const netSubtotal = rawSubtotal - itemDiskon;
  const isEditing = editingId === item.id;
  const isBusy = busyId === item.id;

  return (
    <tr>
      <td className="py-3 text-slate-400">{idx + 1}</td>
      <td className="py-3">
        <span className="font-bold text-slate-800 block">{namaProduk}</span>
        {(item.panjang > 0 || item.lebar > 0) && (
          <span className="text-[10px] text-slate-400 block mt-0.5">Ukuran: {item.panjang || 0}m × {item.lebar || 0}m</span>
        )}
        {item.keterangan_detail && <span className="text-[10px] text-slate-400 block mt-0.5">{item.keterangan_detail}</span>}
      </td>
      <td className="py-3 text-slate-400">-</td>
      <td className="py-3 text-center font-semibold">
        {isEditing ? (
          <input type="number" min="1" value={editQty} onChange={(e) => setEditQty(e.target.value)} className="w-16 text-center border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-blue-300" />
        ) : `${qty} pcs`}
      </td>
      <td className="py-3 text-right font-mono">
        {isEditing ? (
          <input type="number" min="0" value={editHarga} onChange={(e) => setEditHarga(e.target.value)} className="w-24 text-right border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-blue-300 font-mono" />
        ) : `${harga.toLocaleString('id-ID')}`}
      </td>
      <td className="py-3 text-right font-mono">
        {itemDiskon > 0 ? (
          <div>
            <span className="font-semibold text-rose-600">-{itemDiskon.toLocaleString('id-ID')}</span>
            <span className="text-[10px] text-slate-400 block">({diskonPersen}%)</span>
          </div>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>
      <td className="py-3 text-right font-mono font-bold text-slate-800">{netSubtotal.toLocaleString('id-ID')}</td>
      {canEdit && (
        <td className="py-3 text-right">
          {isEditing ? (
            <div className="flex items-center justify-end gap-1">
              <button type="button" disabled={isBusy} onClick={() => onSave(item)} className="p-1 hover:bg-emerald-50 rounded text-emerald-600 cursor-pointer disabled:opacity-40" title="Simpan">
                <Check size={14} />
              </button>
              <button type="button" disabled={isBusy} onClick={() => setEditingId(null)} className="p-1 hover:bg-rose-50 rounded text-rose-600 cursor-pointer disabled:opacity-40" title="Batal">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <button type="button" disabled={isBusy} onClick={onOpenDiskon} className="p-1 hover:bg-amber-50 rounded text-amber-600 cursor-pointer disabled:opacity-40" title="Input / Edit Diskon Nota">
                <Percent size={13} />
              </button>
              <button type="button" disabled={isBusy} onClick={() => { setEditingId(item.id); setEditQty(String(qty)); setEditHarga(String(harga)); }} className="p-1 hover:bg-blue-50 rounded text-blue-600 cursor-pointer disabled:opacity-40" title="Ubah Qty/Harga">
                <Edit3 size={13} />
              </button>
              <button type="button" disabled={isBusy} onClick={() => onDelete(item, namaProduk)} className="p-1 hover:bg-rose-50 rounded text-rose-600 cursor-pointer disabled:opacity-40" title="Hapus">
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

/**
 * Kartu "Produk Pesanan" — SATU tabel menyatu dengan kalkulasi diskon per-baris
 * dan aksi diskon pada header & kolom aksi.
 */
export default function ProdukPesananCard({ orderId, order, items, canEdit = false, onItemsChanged }) {
  const [showImport, setShowImport] = useState(false);
  const [showTambahProduk, setShowTambahProduk] = useState(false);
  const [showTambahPaket, setShowTambahPaket] = useState(false);
  const [showDiskonModal, setShowDiskonModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editQty, setEditQty] = useState('');
  const [editHarga, setEditHarga] = useState('');
  const [busyId, setBusyId] = useState(null);

  const subtotal = items.reduce((sum, it) => sum + (it.qty ?? 1) * (it.harga_jual ?? 0), 0);

  const handleSave = async (item) => {
    setBusyId(item.id);
    try {
      await apiClient.patch(`/order-items/${item.id}/`, {
        qty: Number(editQty) || 1,
        harga_jual: Math.round(Number(editHarga)) || 0,
      });
      setEditingId(null);
      onItemsChanged?.();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Gagal menyimpan perubahan item.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item, namaProduk) => {
    if (!window.confirm(`Hapus "${namaProduk}" dari pesanan ini?`)) return;
    setBusyId(item.id);
    try {
      await apiClient.delete(`/order-items/${item.id}/`);
      onItemsChanged?.();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.detail || 'Gagal menghapus item.');
      setBusyId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <span className="text-xs font-bold text-slate-800">Produk Pesanan</span>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDiskonModal(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors"
              title="Input / Edit Diskon Nota"
            >
              <Percent size={12} /> Diskon
            </button>
            <button type="button" onClick={() => setShowTambahPaket(true)} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors">
              <Plus size={12} /> Paket Produk
            </button>
            <button type="button" onClick={() => setShowTambahProduk(true)} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors">
              <Plus size={12} /> Produk
            </button>
            <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors">
              <Upload size={12} /> Import
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-semibold">
              <th className="py-2.5 font-semibold">No.</th>
              <th className="py-2.5 font-semibold">Deskripsi</th>
              <th className="py-2.5 font-semibold">Seri</th>
              <th className="py-2.5 text-center font-semibold">Qty</th>
              <th className="py-2.5 text-right font-semibold">Harga (IDR)</th>
              <th className="py-2.5 text-right font-semibold">Diskon</th>
              <th className="py-2.5 text-right font-semibold">Total Harga (IDR)</th>
              {canEdit && <th className="py-2.5 text-right font-semibold">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-700">
            {items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 8 : 7} className="py-8 text-center">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="text-5xl select-none mb-2">🐻‍❄️</span>
                    <span className="text-xs font-bold text-slate-700 block">Tidak ada pesanan</span>
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <ItemRow
                  key={item.id || idx}
                  item={item}
                  idx={idx}
                  order={order}
                  canEdit={canEdit}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  editQty={editQty}
                  setEditQty={setEditQty}
                  editHarga={editHarga}
                  setEditHarga={setEditHarga}
                  busyId={busyId}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onOpenDiskon={() => setShowDiskonModal(true)}
                />
              ))
            )}

            {order && (
              <RingkasanPesananCard order={order} items={items} canEdit={canEdit} onOrderChanged={onItemsChanged} />
            )}
          </tbody>
        </table>
      </div>

      {showDiskonModal && (
        <PengaturanDiskonModal
          orderId={orderId}
          subtotal={subtotal}
          currentPersen={order?.diskon_persen || 0}
          onClose={() => setShowDiskonModal(false)}
          onSaved={() => {
            setShowDiskonModal(false);
            onItemsChanged?.();
          }}
        />
      )}

      {showTambahPaket && (
        <TambahPaketModal orderId={orderId} onClose={() => setShowTambahPaket(false)} onAdded={() => { setShowTambahPaket(false); onItemsChanged?.(); }} />
      )}

      {showTambahProduk && (
        <TambahProdukPesananModal orderId={orderId} onClose={() => setShowTambahProduk(false)} onAdded={() => { setShowTambahProduk(false); onItemsChanged?.(); }} />
      )}

      {showImport && (
        <ImportOrderItemsModal orderId={orderId} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); onItemsChanged?.(); }} />
      )}
    </div>
  );
}
