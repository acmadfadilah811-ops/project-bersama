import { useState } from 'react';
import { Undo2, X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

/**
 * Ajukan pengembalian SPK ke tahap sebelumnya (PRD-05 UAT). Alasan wajib.
 * Pengembalian baru berlaku setelah staff tujuan menerimanya
 * (lihat PengembalianKanbanPanel) -- selama menunggu, SPK ini terkunci.
 */
export default function KembalikanJobModal({ job, onClose, onSuccess }) {
  const [alasan, setAlasan] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!job) return null;

  const kirim = async (e) => {
    e.preventDefault();
    if (!alasan.trim()) {
      setError('Alasan pengembalian wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post(`/jobs/${job.id}/kembalikan/`, { alasan: alasan.trim() });
      onSuccess?.();
    } catch (err) {
      const data = err.response?.data;
      const teks = (v) => (Array.isArray(v) ? v[0] : v);
      setError(teks(data?.alasan) || teks(data?.error) || teks(data?.detail) || 'Gagal mengajukan pengembalian.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50">
      <form onSubmit={kirim} className="w-full max-w-md bg-white rounded-xl shadow-xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <Undo2 size={15} className="text-slate-500" /> Kembalikan ke Tahap Sebelumnya
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-slate-500">
            {job.nama_produk || `Job #${job.id}`} &middot; {job.tahap_nama}. Pengembalian menunggu diterima
            staff tujuan (yang mengerjakan tahap sebelumnya); selama itu SPK ini tidak bisa dikerjakan.
          </p>
          <label className="block text-[11px] font-bold text-slate-600">
            Alasan pengembalian <span className="text-rose-500">*</span>
            <textarea
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={4}
              placeholder="Mis. file desain resolusi rendah, warna tidak sesuai brief..."
              className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Mengirim...' : 'Ajukan Pengembalian'}
          </button>
        </div>
      </form>
    </div>
  );
}
