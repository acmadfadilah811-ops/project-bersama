import { useState } from 'react';
import apiClient from '../../../api/apiClient';

/**
 * Info Penerimaan (khusus PO, bukan retur). Mengisi form ini lalu "Simpan"
 * memicu penerimaan barang (endpoint receive): status jadi Diterima dan — bila
 * "lanjut tambah stok" aktif — stok bertambah. Sesuai alur Olsera.
 */
export default function PenerimaanCard({ doc, isDraft, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTanggalDiterima, setEditTanggalDiterima] = useState('');
  const [editNoTerima, setEditNoTerima] = useState('');
  const [editLanjutStok, setEditLanjutStok] = useState(true);

  // Penerima otomatis dari pembuat PO.
  const penerimaDariPembuat = doc.dibuat_oleh_nama || '';

  const handleSave = async () => {
    if (!window.confirm('Tandai barang Diterima? Bila "lanjut tambah stok" aktif, stok akan bertambah dan data tidak dapat diubah lagi.')) return;
    setSaving(true);
    try {
      await apiClient.post(`/purchases/${doc.id}/receive/`, {
        tanggal_diterima: editTanggalDiterima || new Date().toISOString().slice(0, 10),
        no_terima: editNoTerima || '',
        lanjut_tambah_stok: editLanjutStok,
      });
      setIsEditing(false);
      onSaved();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memproses penerimaan.');
    } finally {
      setSaving(false);
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
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
          <span className="text-xs font-bold text-slate-800">Info Penerimaan</span>
          {isDraft && !isEditing && (
            <button
              onClick={() => {
                setEditTanggalDiterima(doc.tanggal_diterima || '');
                setEditNoTerima(doc.no_terima || '');
                setEditLanjutStok(doc.lanjut_tambah_stok !== false);
                setIsEditing(true);
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Terima
            </button>
          )}
          {isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3 text-xs text-slate-700">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Tanggal Diterima</label>
              <input
                type="date"
                value={editTanggalDiterima}
                onChange={(e) => setEditTanggalDiterima(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">No. Terima</label>
              <input
                type="text"
                value={editNoTerima}
                onChange={(e) => setEditNoTerima(e.target.value)}
                placeholder="contoh: 0001"
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Penerima</label>
              <input
                type="text"
                value={penerimaDariPembuat}
                readOnly
                disabled
                placeholder={penerimaDariPembuat ? '' : 'Data pembuat tidak tersedia'}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 block mt-1">Otomatis dari pembuat pembelian</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-slate-600">Lanjut tambah stok masuk</span>
              <button
                type="button"
                onClick={() => setEditLanjutStok(!editLanjutStok)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                  editLanjutStok ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition duration-200 ${
                    editLanjutStok ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs text-slate-700">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Tanggal Diterima</span>
              <span className="font-semibold text-slate-800">{formatDate(doc.tanggal_diterima)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">No. Terima</span>
              <span className="font-semibold text-slate-800">{doc.no_terima || '-'}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">Penerima</span>
              <span className="font-semibold text-slate-800">{doc.receive_status === 'diterima' ? (penerimaDariPembuat || '-') : '-'}</span>
            </div>
            {doc.lanjut_tambah_stok && (
              <div className="pt-2">
                <span className="px-2 py-1 text-[10px] font-bold rounded bg-blue-50 text-blue-600 border border-blue-100">
                  Lanjut tambah stok: Ya
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
