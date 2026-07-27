import { useState } from 'react';
import { Check, Calendar, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { extractApiError, formatRibuan, unformatRibuan } from '../format';
import { Toggle } from './Common';
import TagPicker from './TagPicker';

/** Form "Tambah/Ubah Diskon Penjualan" dengan layout premium split-card matching Detail view */
export default function TambahDiskonForm({ initial, onCancel, onSaved }) {
  const [tanggalAktif, setTanggalAktif] = useState(initial?.tanggal_aktif || new Date().toISOString().slice(0, 10));
  const [noExpiry, setNoExpiry] = useState(initial ? initial.tanpa_kadaluarsa : true);
  const [tanggalKadaluarsa, setTanggalKadaluarsa] = useState(initial?.tanggal_kadaluarsa || '');
  // Nilai awal dibulatkan ke integer agar cocok dengan input angka bertitik
  // (DecimalField diserialisasi "1000.00"; titik desimal bisa mengacaukan format).
  const intStr = (v, fallback) => (v === null || v === undefined || v === '' ? fallback : String(Math.trunc(Number(v) || 0)));
  const [minimalTotal, setMinimalTotal] = useState(initial ? intStr(initial.minimal_total_pesanan, '0') : '0');
  const [discountType, setDiscountType] = useState(initial?.tipe_diskon || 'percent');
  const [jumlahDiskon, setJumlahDiskon] = useState(initial ? intStr(initial.jumlah_diskon, '0') : '0');
  const [tipePelanggan, setTipePelanggan] = useState(initial?.tipe_pelanggan || '');
  const [brand, setBrand] = useState(initial?.brand || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    if (!tanggalAktif) {
      setError('Tanggal Aktif wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      tanggal_aktif: tanggalAktif,
      tanpa_kadaluarsa: noExpiry,
      tanggal_kadaluarsa: noExpiry ? null : tanggalKadaluarsa || null,
      minimal_total_pesanan: parseFloat(minimalTotal) || 0,
      tipe_diskon: discountType,
      jumlah_diskon: parseFloat(jumlahDiskon) || 0,
      tipe_pelanggan: tipePelanggan,
      brand,
    };
    try {
      if (initial?.id) {
        await apiClient.patch(`/sales-discounts/${initial.id}/`, payload);
      } else {
        await apiClient.post('/sales-discounts/', payload);
      }
      onSaved();
    } catch (err) {
      console.error('[VoucherDiskon] save sales discount error:', err);
      setError(extractApiError(err, 'Gagal menyimpan diskon penjualan.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Hapus diskon penjualan ini?')) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/sales-discounts/${initial.id}/`);
      onSaved();
    } catch (err) {
      console.error('[TambahDiskonForm] delete error:', err);
      setError('Gagal menghapus diskon penjualan.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-6">
        <h2 className="text-slate-800 font-extrabold text-base">Rincian Diskon</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="text-blue-600 hover:text-blue-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-xl px-5 py-2.5 text-xs font-bold cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-emerald-500/10"
          >
            <Check size={14} /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kolom Kiri & Tengah: Form Inputs */}
        <div className="md:col-span-2 border border-slate-100 rounded-2xl p-6 bg-slate-50/20 flex flex-col justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            {/* Bagian Input Kiri */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Min. Total Harga Pesanan
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRibuan(minimalTotal)}
                    onChange={(e) => setMinimalTotal(unformatRibuan(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Tanggal Aktif
                </label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450" />
                  <input
                    type="date"
                    value={tanggalAktif}
                    onChange={(e) => setTanggalAktif(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Tanggal Berakhir
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-650">Tanpa Kadaluarsa</span>
                  <Toggle on={noExpiry} onChange={setNoExpiry} />
                </div>
                {!noExpiry && (
                  <input
                    type="date"
                    value={tanggalKadaluarsa}
                    onChange={(e) => setTanggalKadaluarsa(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all animate-in fade-in duration-200"
                  />
                )}
              </div>
            </div>

            {/* Bagian Input Kanan: Persen vs Nominal & Jumlah Diskon */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Tipe & Jumlah Diskon
              </label>

              {/* Segmented Control */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-slate-100/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`flex-1 py-1.5 text-xs font-extrabold text-center rounded-md cursor-pointer transition-all ${
                    discountType === 'percent'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  % Persen
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('nominal')}
                  className={`flex-1 py-1.5 text-xs font-extrabold text-center rounded-md cursor-pointer transition-all ${
                    discountType === 'nominal'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  $ Nominal
                </button>
              </div>

              {/* Input Value */}
              <div>
                <div className="relative">
                  {discountType === 'nominal' && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">Rp</span>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRibuan(jumlahDiskon)}
                    onChange={(e) => setJumlahDiskon(unformatRibuan(e.target.value))}
                    placeholder={discountType === 'percent' ? 'Contoh: 10' : 'Contoh: 10.000'}
                    className={`w-full border border-slate-200 rounded-xl ${discountType === 'nominal' ? 'pl-11' : 'pl-3.5'} pr-3.5 py-3 text-lg font-bold text-slate-800 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-slate-400`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-medium block mt-1">
                  {discountType === 'percent'
                    ? 'Masukkan persentase diskon (1 - 100).'
                    : 'Masukkan nominal rupiah diskon.'}
                </span>
              </div>
            </div>
          </div>

          {/* Delete Button (hanya jika Edit) */}
          {initial?.id && (
            <div className="mt-8 pt-5 border-t border-slate-100 flex justify-start">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex items-center gap-1.5 border border-slate-250 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer"
              >
                <Trash2 size={13} /> {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Kriteria TagPicker */}
        <div className="space-y-4">
          <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Berlaku untuk pelanggan</h3>
            <TagPicker
              value={tipePelanggan}
              onChange={setTipePelanggan}
              fetchUrl="/contacts/"
              placeholder="Tambah Pelanggan"
            />
          </div>

          <div className="border border-slate-150 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Berlaku untuk brand</h3>
            <TagPicker
              value={brand}
              onChange={setBrand}
              fetchUrl="/brands/"
              placeholder="Tambah Brand"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
