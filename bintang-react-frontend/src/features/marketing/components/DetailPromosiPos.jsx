import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fmtDate } from '../format';
import { StatusToggle } from './Common';
import DetailPromoTargets from './DetailPromoTargets';

const DAY_LABELS = {
  min: 'Minggu',
  sen: 'Senin',
  sel: 'Selasa',
  rab: 'Rabu',
  kam: 'Kamis',
  jum: 'Jumat',
  sab: 'Sabtu',
};

const PROMO_LABELS = {
  BX: 'BX (Beli produk A, gratis produk B)',
  DQ: 'DQ (Diskon kuantitas pembelian)',
  DA: 'DA (Diskon jumlah transaksi)',
  FI: 'FI (Gratis produk langsung)',
};

/** Tampilan detail untuk Promosi POS */
export default function DetailPromosiPos({ row, onCancel, onEdit, onSaved }) {
  const [active, setActive] = useState(row.is_active);
  const [deleting, setDeleting] = useState(false);

  const handleToggle = async () => {
    try {
      const res = await apiClient.post(`/pos-promotions/${row.id}/toggle-status/`);
      setActive(res.data.is_active);
      if (onSaved) onSaved();
    } catch (err) {
      console.error('[DetailPromosiPos] toggle error:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus promosi "${row.judul}"?`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/pos-promotions/${row.id}/`);
      if (onSaved) onSaved();
      onCancel();
    } catch (err) {
      console.error('[DetailPromosiPos] delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const daysList = row.hari
    ? row.hari.split(',').map((h) => DAY_LABELS[h.trim()]).filter(Boolean).join(', ')
    : 'Semua Hari';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-6">
        <div>
          <h2 className="text-slate-800 font-extrabold text-base">Rincian Promosi (POS)</h2>
          <div className="text-xs font-bold text-blue-650 mt-0.5 uppercase tracking-wide">
            TIPE: {PROMO_LABELS[row.tipe_promosi] || row.tipe_promosi}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft size={14} /> Kembali
          </button>
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Pencil size={14} /> Ubah
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri & Tengah: Rincian & Aturan */}
        <div className="md:col-span-2 space-y-6">
          <div className="border border-slate-100 rounded-2xl p-6 bg-slate-50/20 space-y-4">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Judul Promosi</div>
              <div className="text-sm font-semibold text-slate-700">{row.judul}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Mulai</div>
                <div className="text-xs font-semibold text-slate-700">{fmtDate(row.tanggal_aktif)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Selesai</div>
                <div className="text-xs font-semibold text-slate-700">
                  {row.tanpa_kadaluarsa ? 'Tanpa Kadaluarsa' : fmtDate(row.tanggal_kadaluarsa)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Jam Aktif</div>
                <div className="text-xs font-semibold text-slate-700">
                  {row.jam_24 ? '24 Jam Penuh' : `${row.jam_mulai} s/d ${row.jam_berakhir}`}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Hari Aktif</div>
                <div className="text-xs font-semibold text-slate-700">{daysList}</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status Promosi</div>
              <div className="flex items-center gap-2">
                <StatusToggle active={active} onToggle={handleToggle} />
                <span className="text-xs font-bold text-slate-500">{active ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
          </div>

          <div className="border border-slate-100 rounded-2xl p-6 bg-white space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">Aturan Promo</h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-650">
              <div>
                <span className="text-slate-400 block mb-0.5">Kombinasi Qty Pembelian:</span>
                <span>{row.combine_qty ? `Ya (Min. Qty: ${row.combine_qty_value})` : 'Tidak'}</span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Kelipatan:</span>
                <span>{row.berlaku_kelipatan ? 'Berlaku kelipatan' : 'Tidak kelipatan'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block mb-0.5">Berlaku apabila membeli:</span>
                <span>{row.berlaku_membeli === 'salah-satu' ? 'Salah satu produk yang diatur' : 'Semua produk yang diatur'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Kriteria Target & Hadiah */}
        <DetailPromoTargets row={row} />
      </div>

      {/* Footer / Delete */}
      <div className="mt-8 pt-5 border-t border-slate-100 flex justify-start">
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="flex items-center gap-1.5 border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
        >
          <Trash2 size={14} /> {deleting ? 'Menghapus...' : 'Hapus'}
        </button>
      </div>
    </div>
  );
}
