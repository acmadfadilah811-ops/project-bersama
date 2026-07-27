import { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';

export default function PaymentCard({
  metadata,
  onSave,
  readOnly,
}) {
  const [editingCard, setEditingCard] = useState(null);
  const [tempData, setTempData] = useState({});

  const [isCatatanExpanded, setIsCatatanExpanded] = useState(false);
  const [isFooterExpanded, setIsFooterExpanded] = useState(false);

  const startEdit = (cardId) => {
    setEditingCard(cardId);
    if (cardId === 'due') {
      setTempData({ due: metadata.dueDate === '-' ? '' : metadata.dueDate });
    } else if (cardId === 'catatan') {
      setTempData({ catatan: metadata.catatan || '' });
    } else if (cardId === 'footer') {
      setTempData({ footer: metadata.invoiceFooter || '' });
    } else if (cardId === 'pelayan') {
      setTempData({ pelayan: metadata.posStaff || '' });
    }
  };

  const handleSave = async (cardId) => {
    try {
      if (cardId === 'due') {
        await onSave({
          metadata: {
            ...metadata,
            dueDate: tempData.due || '-',
          },
        });
      } else if (cardId === 'catatan') {
        await onSave({
          metadata: {
            ...metadata,
            catatan: tempData.catatan,
          },
        });
      } else if (cardId === 'footer') {
        await onSave({
          metadata: {
            ...metadata,
            invoiceFooter: tempData.footer,
          },
        });
      } else if (cardId === 'pelayan') {
        await onSave({
          metadata: {
            ...metadata,
            posStaff: tempData.pelayan,
          },
        });
      }
      setEditingCard(null);
    } catch (err) {
      alert('Gagal menyimpan perubahan.');
    }
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  const renderCardHeader = (title, cardId, hasBadge = false) => (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-800">{title}</span>
        {hasBadge && (
          <span className="bg-blue-50 text-blue-600 font-bold text-[9px] px-2 py-0.5 rounded-full border border-blue-100">
            Pembeli
          </span>
        )}
      </div>
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 1. Jatuh Tempo Pembayaran */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Jatuh Tempo Pembayaran', 'due')}
        {editingCard === 'due' ? (
          <input
            type="date"
            value={tempData.due}
            onChange={(e) => setTempData({ ...tempData, due: e.target.value })}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300 cursor-pointer"
          />
        ) : (
          <p className="text-xs text-slate-700 font-semibold">{formatDisplayDate(metadata.dueDate)}</p>
        )}
      </div>

      {/* 2. Catatan */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Catatan', 'catatan', true)}
        {editingCard === 'catatan' ? (
          <textarea
            value={tempData.catatan}
            onChange={(e) => setTempData({ ...tempData, catatan: e.target.value })}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300 resize-y font-sans"
            rows={2}
          />
        ) : (
          <div>
            <div className={`text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-line overflow-hidden transition-all duration-200 ${
              isCatatanExpanded ? 'max-h-[500px]' : 'max-h-[60px]'
            }`}>
              {metadata.catatan || '-'}
            </div>
            {metadata.catatan && metadata.catatan.length > 60 && (
              <button
                type="button"
                onClick={() => setIsCatatanExpanded(!isCatatanExpanded)}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-bold mt-1 cursor-pointer"
              >
                {isCatatanExpanded ? 'Ringkas' : 'Selengkapnya'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Invoice Footer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col justify-between">
        <div>
          {renderCardHeader('Invoice Footer', 'footer')}
          {editingCard === 'footer' ? (
            <textarea
              value={tempData.footer}
              onChange={(e) => setTempData({ ...tempData, footer: e.target.value })}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300 resize-y font-sans"
              rows={2}
            />
          ) : (
            <div>
              <div className={`text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-line overflow-hidden transition-all duration-200 ${
                isFooterExpanded ? 'max-h-[500px]' : 'max-h-[60px]'
              }`}>
                {metadata.invoiceFooter || '-'}
              </div>
              {metadata.invoiceFooter && metadata.invoiceFooter.length > 60 && (
                <button
                  type="button"
                  onClick={() => setIsFooterExpanded(!isFooterExpanded)}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-bold mt-1 cursor-pointer"
                >
                  {isFooterExpanded ? 'Ringkas' : 'Selengkapnya'}
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Catatan di bagian bawah cetakan invoice.</p>
      </div>

      {/* 4. Pelayan POS */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        {renderCardHeader('Pelayan POS', 'pelayan')}
        {editingCard === 'pelayan' ? (
          <input
            type="text"
            value={tempData.pelayan}
            onChange={(e) => setTempData({ ...tempData, pelayan: e.target.value })}
            className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-blue-300"
          />
        ) : (
          <p className="text-xs text-slate-700 font-semibold">{metadata.posStaff || '-'}</p>
        )}
      </div>
    </div>
  );
}
