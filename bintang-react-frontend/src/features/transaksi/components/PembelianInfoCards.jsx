import { useState } from 'react';
import SupplierCard from './SupplierCard';
import PenerimaanCard from './PenerimaanCard';
import NotesAndDueCard from './NotesAndDueCard';
import apiClient from '../../../api/apiClient';

/** Kartu opsi retur: toggle "Exchange for New Item" (ditukar barang baru). */
function ReturOptionsCard({ doc, isDraft, onSaved }) {
  const [saving, setSaving] = useState(false);

  const toggleExchange = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/purchases/${doc.id}/`, { exchange_new: !doc.exchange_new });
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memperbarui opsi retur.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
      <div>
        <div className="border-b border-slate-100 pb-2 mb-3">
          <span className="text-xs font-bold text-slate-800">Opsi Retur</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="pr-3">
            <span className="text-xs font-semibold text-slate-700 block">Exchange for New Item</span>
            <span className="text-[10px] text-slate-400">Supplier menukar barang rusak dengan barang baru (stok ditambah kembali saat post).</span>
          </div>
          <button
            type="button"
            disabled={!isDraft || saving}
            onClick={toggleExchange}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
              doc.exchange_new ? 'bg-blue-600' : 'bg-slate-300'
            } ${!isDraft ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ${
                doc.exchange_new ? 'translate-x-4.5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PembelianInfoCards({ doc, isDraft, isRetur, onSaved }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-slate-700">
      <SupplierCard doc={doc} isDraft={isDraft} onSaved={onSaved} />
      {isRetur ? (
        <ReturOptionsCard doc={doc} isDraft={isDraft} onSaved={onSaved} />
      ) : (
        <PenerimaanCard doc={doc} isDraft={isDraft} onSaved={onSaved} />
      )}
      <NotesAndDueCard doc={doc} isDraft={isDraft} onSaved={onSaved} />
    </div>
  );
}
