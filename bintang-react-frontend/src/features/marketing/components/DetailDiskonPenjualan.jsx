import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fmtDiskon } from '../format';

/** Tampilan detail untuk Diskon Penjualan, didesain persis seperti tangkapan layar */
export default function DetailDiskonPenjualan({ row, onCancel, onEdit, onSaved }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Hapus diskon penjualan ini?')) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/sales-discounts/${row.id}/`);
      if (onSaved) onSaved();
      onCancel();
    } catch (err) {
      console.error('[DetailDiskonPenjualan] delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const fmtIDR = (v) => `IDR ${Number(v || 0).toLocaleString('id-ID')}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-6">
        <h2 className="text-slate-800 font-extrabold text-base">Rincian Diskon</h2>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="bg-blue-50/70 hover:bg-blue-100/70 text-blue-600 border border-blue-100/80 rounded-lg px-5 py-2 text-xs font-bold transition-all cursor-pointer"
          >
            Kembali
          </button>
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Pencil size={13} /> Ubah
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri & Tengah: Rincian & Badge */}
        <div className="md:col-span-2 border border-slate-100 rounded-2xl p-6 bg-slate-50/20 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row gap-6 items-start justify-between">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Min. Total Harga Pesanan</div>
                <div className="text-sm font-semibold text-slate-750">{fmtIDR(row.minimal_total_pesanan)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Aktif</div>
                <div className="text-sm font-semibold text-slate-750">{row.tanggal_aktif || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Berakhir</div>
                <div className="text-sm font-semibold text-slate-750">
                  {row.tanpa_kadaluarsa ? 'Tanpa Kadaluarsa' : (row.tanggal_kadaluarsa || '-')}
                </div>
              </div>
            </div>

            <div className="bg-red-500 text-white px-5 py-4.5 rounded-2xl flex flex-col justify-center items-start shadow-md shadow-red-500/10 w-full sm:w-44 h-24 shrink-0">
              <span className="text-[11px] font-bold text-red-100 mb-0.5">Jumlah Diskon</span>
              <span className="text-3xl font-extrabold tracking-tight">{fmtDiskon(row)}</span>
            </div>
          </div>

          {/* Hapus Button - diletakkan sejajar di bawah rincian kiri */}
          <div className="mt-8">
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="flex items-center gap-1.5 border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50/50 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 size={13} /> {deleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>

        {/* Kolom Kanan: Kriteria */}
        <div className="space-y-4">
          <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm min-h-[100px] flex flex-col justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Berlaku untuk pelanggan</h3>
            <div className="text-xs text-slate-500 leading-relaxed font-semibold">
              {row.tipe_pelanggan ? row.tipe_pelanggan : ''}
            </div>
          </div>

          <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm min-h-[100px] flex flex-col justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Berlaku untuk brand</h3>
            <div className="text-xs text-slate-500 leading-relaxed font-semibold">
              {row.brand ? row.brand : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
