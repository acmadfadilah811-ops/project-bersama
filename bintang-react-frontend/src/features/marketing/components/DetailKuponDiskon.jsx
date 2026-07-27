import { useState } from 'react';
import { Pencil, Trash2, Check } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/** Tampilan detail untuk Kupon Diskon, didesain persis seperti tangkapan layar */
export default function DetailKuponDiskon({ row, onCancel, onEdit, onSaved }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Hapus kupon "${row.kode}"?`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/discount-coupons/${row.id}/`);
      if (onSaved) onSaved();
      onCancel();
    } catch (err) {
      console.error('[DetailKuponDiskon] delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const fmtIDR = (v) => `IDR ${Number(v || 0).toLocaleString('id-ID')}`;

  const fmtCouponDiskonVal = (r) =>
    r.tipe_diskon === 'percent'
      ? `${Number(r.jumlah_diskon)}%`
      : `IDR ${Number(r.jumlah_diskon).toLocaleString('id-ID')}`;

  // Helper to render soft green active rule box
  const renderRuleBox = (label, activeText, fallbackText, isActive) => (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">✓ {label}</span>
      <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl px-3.5 py-3 flex items-center gap-2.5 font-bold text-xs shadow-sm shadow-emerald-500/[0.02]">
        <Check size={14} className="text-emerald-600 shrink-0" />
        <span className="truncate">{isActive ? activeText : fallbackText || '-'}</span>
      </div>
    </div>
  );

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
          <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
            {/* Grid Detail dalam 2 Kolom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 flex-1">
              {/* Kolom Detail 1 */}
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Kode</div>
                  <div className="text-sm font-semibold text-slate-750">{row.kode}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Maksimal Jumlah Diskon</div>
                  <div className="text-sm font-semibold text-slate-750">{fmtIDR(row.maksimal_jumlah_diskon)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Min. Total Harga Pesanan</div>
                  <div className="text-sm font-semibold text-slate-750">{fmtIDR(row.min_total_pesanan)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Aktif</div>
                  <div className="text-sm font-semibold text-slate-750">{row.tanggal_aktif || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tanggal Berakhir</div>
                  <div className="text-sm font-semibold text-slate-750">
                    {row.tanpa_kadaluarsa ? 'Tidak ada kadaluarsa' : (row.tanggal_kadaluarsa || '-')}
                  </div>
                </div>
              </div>

              {/* Kolom Detail 2 (Toggles/Status) */}
              <div className="space-y-3 pt-0.5">
                {[
                  ['Tampilkan di POS?', row.show_pos],
                  ['Tampilkan di Online Order?', row.show_online],
                  ['Penggunaan Tidak Terbatas?', row.unlimited_usage],
                  ['Digunakan sekali per pelanggan?', row.once_per_customer],
                  ['Penggunaan Ulang Harian?', row.daily_reuse],
                  ['Gunakan untuk Delivery?', row.delivery],
                ].map(([label, active]) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-450">{label}</span>
                    <span className={`font-bold ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                      {active ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Red Badge */}
            <div className="bg-red-500 text-white px-5 py-4.5 rounded-2xl flex flex-col justify-center items-start shadow-md shadow-red-500/10 w-full lg:w-44 h-24 shrink-0">
              <span className="text-[11px] font-bold text-red-105 mb-0.5 truncate w-full">{row.judul}</span>
              <span className="text-3xl font-extrabold tracking-tight">{fmtCouponDiskonVal(row)}</span>
            </div>
          </div>

          {/* Hapus Button */}
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

        {/* Kolom Kanan: Aturan Diskon */}
        <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Aturan Diskon</h3>
          <div className="space-y-3.5">
            {renderRuleBox('Berlaku untuk tipe pelanggan:', 'Berlaku untuk semua tipe pelanggan', row.tipe_pelanggan, row.all_customers)}
            {renderRuleBox('Berlaku untuk pelanggan:', 'Berlaku untuk semua pelanggan', row.pelanggan, row.all_customers)}
            {renderRuleBox('Berlaku untuk grup produk:', 'Berlaku untuk semua produk', row.grup_produk, row.all_products)}
            {renderRuleBox('Berlaku untuk produk:', 'Berlaku untuk semua produk', row.produk, row.all_products)}
            {renderRuleBox('Berlaku untuk paket produk:', 'Berlaku untuk semua paket produk', row.paket_produk, row.all_packages)}
            {renderRuleBox('Berlaku untuk brand:', 'Berlaku untuk semua brand', row.brand, row.all_brands)}
          </div>
        </div>
      </div>
    </div>
  );
}
