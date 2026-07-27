import { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';

export default function ShippingCard({
  metadata,
  onSave,
  readOnly,
}) {
  const [editingCard, setEditingCard] = useState(null);
  const [tempData, setTempData] = useState({});

  const startEdit = (cardId) => {
    setEditingCard(cardId);
    if (cardId === 'shipping') {
      setTempData({
        kurir: metadata.shippingCourier || '-',
        layanan: metadata.shippingService || '-',
        tanggalKirim: metadata.shippingDate || '-',
      });
    } else if (cardId === 'dropship') {
      setTempData({
        toko: metadata.dropshipStore || '-',
        pengirim: metadata.dropshipSender || '-',
        telpon: metadata.dropshipPhone || '-',
      });
    }
  };

  const handleSave = async (cardId) => {
    try {
      if (cardId === 'shipping') {
        await onSave({
          metadata: {
            ...metadata,
            shippingCourier: tempData.kurir,
            shippingService: tempData.layanan,
            shippingDate: tempData.tanggalKirim,
          },
        });
      } else if (cardId === 'dropship') {
        await onSave({
          metadata: {
            ...metadata,
            dropshipStore: tempData.toko,
            dropshipSender: tempData.pengirim,
            dropshipPhone: tempData.telpon,
          },
        });
      }
      setEditingCard(null);
    } catch (err) {
      alert('Gagal menyimpan perubahan.');
    }
  };

  const renderCardHeader = (title, cardId) => (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
      <span className="text-xs font-bold text-slate-800">{title}</span>
      {editingCard === cardId ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSave(cardId)}
            className="p-1 hover:bg-emerald-50 rounded text-emerald-600 cursor-pointer transition-colors"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditingCard(null)}
            className="p-1 hover:bg-rose-50 rounded text-rose-600 cursor-pointer transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        !readOnly && (
          <button
            type="button"
            onClick={() => startEdit(cardId)}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-500 hover:text-blue-600 transition-colors bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 rounded px-2 py-0.5 cursor-pointer"
          >
            <Edit3 size={11} /> Ubah
          </button>
        )
      )}
    </div>
  );

  const rowStyle = "flex justify-between items-start text-xs py-1.5 border-b border-slate-50 last:border-b-0";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 3. Status Pengiriman */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Status Pengiriman', 'shipping')}
        {editingCard === 'shipping' ? (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">KURIR PENGIRIMAN</label>
              <input
                type="text"
                value={tempData.kurir}
                onChange={(e) => setTempData({ ...tempData, kurir: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">TIPE LAYANAN PENGIRIMAN</label>
              <input
                type="text"
                value={tempData.layanan}
                onChange={(e) => setTempData({ ...tempData, layanan: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">TANGGAL KIRIM</label>
              <input
                type="text"
                value={tempData.tanggalKirim}
                onChange={(e) => setTempData({ ...tempData, tanggalKirim: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Kurir Pengiriman</span>
              <span className="text-slate-700 font-semibold text-right">{metadata.shippingCourier || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Tipe Layanan Pengiriman</span>
              <span className="text-slate-700 text-right">{metadata.shippingService || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Tanggal Kirim</span>
              <span className="text-slate-700 text-right">{metadata.shippingDate || '-'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. Drop Ship */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Drop Ship', 'dropship')}
        {editingCard === 'dropship' ? (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">NAMA TOKO</label>
              <input
                type="text"
                value={tempData.toko}
                onChange={(e) => setTempData({ ...tempData, toko: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">PENGIRIM</label>
              <input
                type="text"
                value={tempData.pengirim}
                onChange={(e) => setTempData({ ...tempData, pengirim: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">TELPON</label>
              <input
                type="text"
                value={tempData.telpon}
                onChange={(e) => setTempData({ ...tempData, telpon: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Nama Toko</span>
              <span className="text-slate-700 font-semibold text-right">{metadata.dropshipStore || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Pengirim</span>
              <span className="text-slate-700 text-right">{metadata.dropshipSender || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Telpon</span>
              <span className="text-slate-700 text-right">{metadata.dropshipPhone || '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
