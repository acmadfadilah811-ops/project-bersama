import { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';

export default function CustomerCard({
  order,
  metadata,
  onSave,
  readOnly,
}) {
  const [editingCard, setEditingCard] = useState(null);
  const [tempData, setTempData] = useState({});

  const [isAddressExpanded, setIsAddressExpanded] = useState(false);

  const startEdit = (cardId) => {
    setEditingCard(cardId);
    if (cardId === 'pelanggan') {
      setTempData({
        nama: order.nama || '',
        email: metadata.customerEmail || '',
        telpon: order.nomor_wa || '',
      });
    } else if (cardId === 'tujuan') {
      setTempData({
        nama: order.nama || '',
        alamat: metadata.customerAddress || '',
        telpon: order.nomor_wa || '',
      });
    }
  };

  const handleSave = async (cardId) => {
    try {
      if (cardId === 'pelanggan') {
        await onSave({
          nama: tempData.nama,
          nomor_wa: tempData.telpon,
          metadata: {
            ...metadata,
            customerEmail: tempData.email,
          },
        });
      } else if (cardId === 'tujuan') {
        await onSave({
          nama: tempData.nama,
          nomor_wa: tempData.telpon,
          metadata: {
            ...metadata,
            customerAddress: tempData.alamat,
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
      {/* 1. Pelanggan */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Pelanggan', 'pelanggan')}
        {editingCard === 'pelanggan' ? (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">NAMA</label>
              <input
                type="text"
                value={tempData.nama}
                onChange={(e) => setTempData({ ...tempData, nama: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">EMAIL</label>
              <input
                type="text"
                value={tempData.email}
                onChange={(e) => setTempData({ ...tempData, email: e.target.value })}
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
              <span className="text-slate-400 font-medium">Nama</span>
              <span className="text-slate-700 font-semibold text-right">{order.nama || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Email</span>
              <span className="text-slate-700 text-right">{metadata.customerEmail || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Telpon</span>
              <span className="text-slate-700 text-right">{order.nomor_wa || '-'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Tujuan Pengiriman */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Tujuan Pengiriman', 'tujuan')}
        {editingCard === 'tujuan' ? (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">NAMA</label>
              <input
                type="text"
                value={tempData.nama}
                onChange={(e) => setTempData({ ...tempData, nama: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-semibold block mb-1">ALAMAT</label>
              <textarea
                value={tempData.alamat}
                onChange={(e) => setTempData({ ...tempData, alamat: e.target.value })}
                className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300 resize-y font-sans"
                rows={3}
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
              <span className="text-slate-400 font-medium">Nama</span>
              <span className="text-slate-700 font-semibold text-right">{order.nama || '-'}</span>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Alamat</span>
              <div className="text-right max-w-[200px]">
                <div className={`text-slate-700 whitespace-pre-line leading-relaxed overflow-hidden transition-all duration-200 ${
                  isAddressExpanded ? 'max-h-[500px]' : 'max-h-[60px]'
                }`}>
                  {metadata.customerAddress || '-'}
                </div>
                {metadata.customerAddress && metadata.customerAddress.length > 50 && (
                  <button
                    type="button"
                    onClick={() => setIsAddressExpanded(!isAddressExpanded)}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-bold mt-1 cursor-pointer"
                  >
                    {isAddressExpanded ? 'Ringkas' : 'Selengkapnya'}
                  </button>
                )}
              </div>
            </div>
            <div className={rowStyle}>
              <span className="text-slate-400 font-medium">Telpon</span>
              <span className="text-slate-700 text-right">{order.nomor_wa || '-'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
