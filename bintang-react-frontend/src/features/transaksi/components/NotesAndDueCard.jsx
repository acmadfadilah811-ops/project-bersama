import { useState } from 'react';
import apiClient from '../../../api/apiClient';

export default function NotesAndDueCard({ doc, isDraft, onSaved }) {
  const [isEditingCatatan, setIsEditingCatatan] = useState(false);
  const [editCatatanVal, setEditCatatanVal] = useState('');
  const [isEditingTempo, setIsEditingTempo] = useState(false);
  const [editTempoVal, setEditTempoVal] = useState('');

  const handleSaveCatatan = async () => {
    try {
      await apiClient.patch(`/purchases/${doc.id}/`, { catatan: editCatatanVal });
      setIsEditingCatatan(false);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan catatan.');
    }
  };

  const handleSaveTempo = async () => {
    try {
      await apiClient.patch(`/purchases/${doc.id}/`, { jatuh_tempo: editTempoVal || null });
      setIsEditingTempo(false);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan jatuh tempo.');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-5 flex flex-col justify-between text-slate-700">
      {/* Catatan */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2 flex-1">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
          <span className="text-xs font-bold text-slate-800">Catatan</span>
          {isDraft && !isEditingCatatan && (
            <button
              onClick={() => {
                setEditCatatanVal(doc.catatan || '');
                setIsEditingCatatan(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Ubah
            </button>
          )}
          {isEditingCatatan && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingCatatan(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveCatatan}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                Simpan
              </button>
            </div>
          )}
        </div>
        {isEditingCatatan ? (
          <textarea
            value={editCatatanVal}
            onChange={(e) => setEditCatatanVal(e.target.value)}
            placeholder="Tulis catatan..."
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none h-16 resize-none"
          />
        ) : (
          <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap">{doc.catatan || 'Tidak ada'}</p>
        )}
      </div>

      {/* Jatuh Tempo */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-2">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-1">
          <span className="text-xs font-bold text-slate-800">Jatuh Tempo</span>
          {isDraft && !isEditingTempo && (
            <button
              onClick={() => {
                setEditTempoVal(doc.jatuh_tempo || '');
                setIsEditingTempo(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Ubah
            </button>
          )}
          {isEditingTempo && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingTempo(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTempo}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                Simpan
              </button>
            </div>
          )}
        </div>
        {isEditingTempo ? (
          <input
            type="date"
            value={editTempoVal}
            onChange={(e) => setEditTempoVal(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          />
        ) : (
          <p className="text-xs font-semibold text-slate-700">{formatDate(doc.jatuh_tempo)}</p>
        )}
      </div>
    </div>
  );
}
