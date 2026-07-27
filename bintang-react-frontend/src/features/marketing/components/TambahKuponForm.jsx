import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { extractApiError, formatRibuan, unformatRibuan } from '../format';
import KuponRulesForm from './KuponRulesForm';
import KuponFeaturesForm from './KuponFeaturesForm';
import KuponDetailsForm from './KuponDetailsForm';

const randomKode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 12; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

/** Form "Tambah/Ubah Kupon Diskon" dengan layout premium split-card matching screenshot */
export default function TambahKuponForm({ initial, onCancel, onSaved }) {
  const [kode, setKode] = useState(initial?.kode || randomKode);
  const [judul, setJudul] = useState(initial?.judul || '');
  const [tanggalAktif, setTanggalAktif] = useState(initial?.tanggal_aktif || new Date().toISOString().slice(0, 10));
  // Nilai awal dibulatkan ke integer supaya cocok dengan input angka bertitik
  // (DecimalField diserialisasi "1000.00"; titik desimal bisa mengacaukan format).
  const intStr = (v, fallback) => (v === null || v === undefined || v === '' ? fallback : String(Math.trunc(Number(v) || 0)));
  const [minTotal, setMinTotal] = useState(initial ? intStr(initial.min_total_pesanan, '1') : '1');
  const [batasPenggunaan, setBatasPenggunaan] = useState(initial?.batas_penggunaan ? String(initial.batas_penggunaan) : '');
  const [discountType, setDiscountType] = useState(initial?.tipe_diskon || 'percent');
  const [jumlahDiskon, setJumlahDiskon] = useState(initial ? intStr(initial.jumlah_diskon, '') : '');
  const [maksDiskon, setMaksDiskon] = useState(initial ? intStr(initial.maksimal_jumlah_diskon, '0') : '0');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const [tg, setTg] = useState({
    noExpiry: initial ? initial.tanpa_kadaluarsa : true,
    unlimitedUsage: initial ? initial.unlimited_usage : true,
    showPos: initial ? initial.show_pos : true,
    showOnline: initial ? initial.show_online : false,
    oncePerCustomer: initial ? initial.once_per_customer : false,
    dailyReuse: initial ? initial.daily_reuse : false,
    dineIn: initial ? initial.dine_in : false,
    delivery: initial ? initial.delivery : false,
    takeAway: initial ? initial.take_away : false,
    reservasi: initial ? initial.reservasi : false,
    allCustomers: initial ? initial.all_customers : true,
    allProducts: initial ? initial.all_products : true,
    allPackages: initial ? initial.all_packages : true,
    allBrands: initial ? initial.all_brands : true,
  });

  const [tanggalKadaluarsa, setTanggalKadaluarsa] = useState(initial?.tanggal_kadaluarsa || '');
  const [tipePelanggan, setTipePelanggan] = useState(initial?.tipe_pelanggan || '');
  const [pelanggan, setPelanggan] = useState(initial?.pelanggan || '');
  const [grupProduk, setGrupProduk] = useState(initial?.grup_produk || '');
  const [produk, setProduk] = useState(initial?.produk || '');
  const [paketProduk, setPaketProduk] = useState(initial?.paket_produk || '');
  const [brand, setBrand] = useState(initial?.brand || '');

  const setT = (k) => (v) => setTg((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!kode.trim() || !judul.trim()) {
      setError('Kode dan Judul wajib diisi.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      kode: kode.trim(),
      judul: judul.trim(),
      tanggal_aktif: tanggalAktif || null,
      tanpa_kadaluarsa: tg.noExpiry,
      tanggal_kadaluarsa: tg.noExpiry ? null : tanggalKadaluarsa || null,
      min_total_pesanan: parseFloat(minTotal) || 0,
      unlimited_usage: tg.unlimitedUsage,
      batas_penggunaan: tg.unlimitedUsage ? null : parseInt(batasPenggunaan, 10) || null,
      show_pos: tg.showPos,
      show_online: tg.showOnline,
      once_per_customer: tg.oncePerCustomer,
      daily_reuse: tg.dailyReuse,
      dine_in: tg.dineIn,
      delivery: tg.delivery,
      take_away: tg.takeAway,
      reservasi: tg.reservasi,
      tipe_diskon: discountType,
      jumlah_diskon: parseFloat(jumlahDiskon) || 0,
      maksimal_jumlah_diskon: parseFloat(maksDiskon) || 0,
      all_customers: tg.allCustomers,
      tipe_pelanggan: tipePelanggan,
      pelanggan,
      all_products: tg.allProducts,
      grup_produk: grupProduk,
      produk,
      all_packages: tg.allPackages,
      paket_produk: paketProduk,
      all_brands: tg.allBrands,
      brand,
    };
    try {
      if (initial?.id) {
        await apiClient.patch(`/discount-coupons/${initial.id}/`, payload);
      } else {
        await apiClient.post('/discount-coupons/', payload);
      }
      onSaved();
    } catch (err) {
      console.error('[VoucherDiskon] save coupon error:', err);
      setError(extractApiError(err, 'Gagal menyimpan kupon diskon.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Hapus kupon "${kode}"?`)) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/discount-coupons/${initial.id}/`);
      onSaved();
    } catch (err) {
      console.error('[TambahKuponForm] delete error:', err);
      setError('Gagal menghapus kupon diskon.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 animate-in fade-in duration-200">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Bagian Input Kiri */}
            <KuponDetailsForm
              kode={kode}
              setKode={setKode}
              judul={judul}
              setJudul={setJudul}
              maksDiskon={maksDiskon}
              setMaksDiskon={setMaksDiskon}
              minTotal={minTotal}
              setMinTotal={setMinTotal}
              tanggalAktif={tanggalAktif}
              setTanggalAktif={setTanggalAktif}
              tg={tg}
              setT={setT}
              tanggalKadaluarsa={tanggalKadaluarsa}
              setTanggalKadaluarsa={setTanggalKadaluarsa}
            />

            {/* Bagian Input Tengah (Toggles/Features) */}
            <KuponFeaturesForm
              tg={tg}
              setT={setT}
              batasPenggunaan={batasPenggunaan}
              setBatasPenggunaan={setBatasPenggunaan}
            />

            {/* Bagian Input Kanan (Diskon Selector) */}
            <div className="space-y-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diskon</label>

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
                    className={`w-full border border-slate-200 rounded-xl ${discountType === 'nominal' ? 'pl-11' : 'pl-3.5'} pr-3.5 py-3 text-lg font-bold text-slate-800 outline-none bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-slate-450`}
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

          {/* Delete Button */}
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

        {/* Kolom Kanan: Aturan/Kriteria */}
        <KuponRulesForm
          tg={tg}
          setT={setT}
          tipePelanggan={tipePelanggan}
          setTipePelanggan={setTipePelanggan}
          pelanggan={pelanggan}
          setPelanggan={setPelanggan}
          grupProduk={grupProduk}
          setGrupProduk={setGrupProduk}
          produk={produk}
          setProduk={setProduk}
          paketProduk={paketProduk}
          setPaketProduk={setPaketProduk}
          brand={brand}
          setBrand={setBrand}
        />
      </div>
    </div>
  );
}
