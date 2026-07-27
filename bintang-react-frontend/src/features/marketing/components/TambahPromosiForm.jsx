import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { extractApiError } from '../format';
import PromoDetailsForm from './PromoDetailsForm';
import PromoRulesForm from './PromoRulesForm';
import PromoTargetsForm from './PromoTargetsForm';

const PROMO_DAY_KEYS = ['min', 'sen', 'sel', 'rab', 'kam', 'jum', 'sab'];

/** Form "Tambah/Ubah Promosi (POS)" dengan layout premium split-card matching screenshot & Detail view */
export default function TambahPromosiForm({ initial, onCancel, onSaved }) {
  const { user, businessSettings } = useAuth();
  const accountName = businessSettings?.nama_bisnis || user?.name || user?.email || 'Akun';

  const [judul, setJudul] = useState(initial?.judul || '');
  const [tipe, setTipe] = useState(initial?.tipe_promosi || 'BX');
  const [combineQty, setCombineQty] = useState(initial ? initial.combine_qty : true);
  const [combineQtyValue, setCombineQtyValue] = useState(initial ? String(initial.combine_qty_value) : '1');
  const [produkQty, setProdukQty] = useState(initial?.produk_qty || []);
  const [grupProduk, setGrupProduk] = useState(initial?.grup_produk || '');
  const [paketProduk, setPaketProduk] = useState(initial?.paket_produk || '');
  const [brand, setBrand] = useState(initial?.brand || '');
  const [berlakuMembeli, setBerlakuMembeli] = useState(initial?.berlaku_membeli || 'semua');
  const [produkGratis, setProdukGratis] = useState(initial?.produk_gratis || '');
  const [kelipatan, setKelipatan] = useState(initial ? initial.berlaku_kelipatan : false);
  const [allCustomers, setAllCustomers] = useState(initial ? initial.all_customers : true);
  const [tipePelanggan, setTipePelanggan] = useState(initial?.tipe_pelanggan || '');
  const [pelanggan, setPelanggan] = useState(initial?.pelanggan || '');
  const [tanggalAktif, setTanggalAktif] = useState(initial?.tanggal_aktif || new Date().toISOString().slice(0, 10));
  const [noExpiry, setNoExpiry] = useState(initial ? initial.tanpa_kadaluarsa : true);
  const [tanggalKadaluarsa, setTanggalKadaluarsa] = useState(initial?.tanggal_kadaluarsa || '');
  const [jam24, setJam24] = useState(initial ? initial.jam_24 : true);
  const [jamMulai, setJamMulai] = useState(initial?.jam_mulai || '');
  const [jamBerakhir, setJamBerakhir] = useState(initial?.jam_berakhir || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const initialDayKeys = initial?.hari ? initial.hari.split(',') : PROMO_DAY_KEYS;
  const [days, setDays] = useState(() => {
    const d = { all: PROMO_DAY_KEYS.every((k) => initialDayKeys.includes(k)) };
    PROMO_DAY_KEYS.forEach((k) => {
      d[k] = initialDayKeys.includes(k);
    });
    return d;
  });

  const toggleDay = (k) =>
    setDays((p) => {
      const next = { ...p, [k]: !p[k] };
      next.all = PROMO_DAY_KEYS.every((key) => next[key]);
      return next;
    });

  const toggleAllDays = () =>
    setDays((p) => {
      const v = !p.all;
      const next = { all: v };
      PROMO_DAY_KEYS.forEach((k) => {
        next[k] = v;
      });
      return next;
    });

  const handleSave = async () => {
    if (!judul.trim() || !tanggalAktif) {
      setError('Judul dan Tanggal Aktif wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    const hariStr = PROMO_DAY_KEYS.filter((k) => days[k]).join(',');
    const payload = {
      judul: judul.trim(),
      tipe_promosi: tipe,
      combine_qty: combineQty,
      combine_qty_value: parseInt(combineQtyValue, 10) || 1,
      produk_qty: produkQty,
      grup_produk: grupProduk,
      paket_produk: paketProduk,
      brand,
      berlaku_membeli: berlakuMembeli,
      produk_gratis: tipe === 'BX' || tipe === 'FI' ? produkGratis : '',
      berlaku_kelipatan: kelipatan,
      all_customers: allCustomers,
      tipe_pelanggan: allCustomers ? '' : tipePelanggan,
      pelanggan: allCustomers ? '' : pelanggan,
      tanggal_aktif: tanggalAktif,
      tanpa_kadaluarsa: noExpiry,
      tanggal_kadaluarsa: noExpiry ? null : tanggalKadaluarsa || null,
      jam_24: jam24,
      jam_mulai: jam24 ? null : jamMulai || null,
      jam_berakhir: jam24 ? null : jamBerakhir || null,
      hari: hariStr || 'min,sen,sel,rab,kam,jum,sab',
    };
    try {
      if (initial?.id) {
        await apiClient.patch(`/pos-promotions/${initial.id}/`, payload);
      } else {
        await apiClient.post('/pos-promotions/', payload);
      }
      onSaved();
    } catch (err) {
      console.error('[TambahPromosiForm] save error:', err);
      setError(extractApiError(err, 'Gagal menyimpan promosi.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus promosi "${judul}"?`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/pos-promotions/${initial.id}/`);
      onSaved();
    } catch (err) {
      console.error('[TambahPromosiForm] delete error:', err);
      setError('Gagal menghapus promosi.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-100 mb-6">
        <h2 className="text-slate-800 font-extrabold text-base">Rincian Promosi (POS)</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onCancel}
            className="text-blue-600 hover:text-blue-700 text-xs font-bold cursor-pointer transition-colors"
          >
            Batal
          </button>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 leading-none mb-1 uppercase tracking-wider">Simpan di:</div>
            <select className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-650 bg-white outline-none focus:border-blue-500 transition-all cursor-pointer">
              <option>{accountName}</option>
            </select>
          </div>
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
        <div className="md:col-span-2 space-y-6">
          <PromoDetailsForm
            judul={judul}
            setJudul={setJudul}
            tanggalAktif={tanggalAktif}
            setTanggalAktif={setTanggalAktif}
            noExpiry={noExpiry}
            setNoExpiry={setNoExpiry}
            tanggalKadaluarsa={tanggalKadaluarsa}
            setTanggalKadaluarsa={setTanggalKadaluarsa}
            jam24={jam24}
            setJam24={setJam24}
            jamMulai={jamMulai}
            setJamMulai={setJamMulai}
            jamBerakhir={jamBerakhir}
            setJamBerakhir={setJamBerakhir}
            days={days}
            toggleDay={toggleDay}
            toggleAllDays={toggleAllDays}
          />

          <PromoRulesForm
            tipe={tipe}
            setTipe={setTipe}
            combineQty={combineQty}
            setCombineQty={setCombineQty}
            combineQtyValue={combineQtyValue}
            setCombineQtyValue={setCombineQtyValue}
            kelipatan={kelipatan}
            setKelipatan={setKelipatan}
            berlakuMembeli={berlakuMembeli}
            setBerlakuMembeli={setBerlakuMembeli}
          />

          {initial?.id && (
            <div className="pt-2 flex justify-start">
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

        {/* Kolom Kanan: Target & Kriteria */}
        <PromoTargetsForm
          tipe={tipe}
          produkGratis={produkGratis}
          setProdukGratis={setProdukGratis}
          produkQty={produkQty}
          setProdukQty={setProdukQty}
          grupProduk={grupProduk}
          setGrupProduk={setGrupProduk}
          paketProduk={paketProduk}
          setPaketProduk={setPaketProduk}
          brand={brand}
          setBrand={setBrand}
          allCustomers={allCustomers}
          setAllCustomers={setAllCustomers}
          tipePelanggan={tipePelanggan}
          setTipePelanggan={setTipePelanggan}
          pelanggan={pelanggan}
          setPelanggan={setPelanggan}
        />
      </div>
    </div>
  );
}
