import { useState, useEffect } from 'react';
import { Pencil, Info, X, Search, AlertCircle } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Toggle switch andal (Tailwind v4).
 * Sengaja TIDAK memakai pola `input.sr-only.peer` + `after:` pseudo-element,
 * karena kombinasi itu sering tak ter-render di v4. Di sini track & knob adalah
 * elemen nyata sehingga selalu tampil.
 */
function Toggle({ checked, onChange, id }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-blue-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Drawer kanan "Tipe Pelanggan" — meniru Olsera: opsi "Semua", kotak cari,
 * lalu daftar customer-group dengan checkbox, dan tombol "Selesai".
 * Nilai dikembalikan sebagai string: 'Semua' atau daftar nama dipisah koma.
 */
function TipePelangganDrawer({ initialValue, onClose, onApply }) {
  const semuaAwal = !initialValue || initialValue === 'Semua';
  const [semua, setSemua] = useState(semuaAwal);
  const [selected, setSelected] = useState(
    semuaAwal ? [] : initialValue.split(',').map((s) => s.trim()).filter(Boolean),
  );
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/customer-groups/')
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        const list = Array.isArray(data) ? data : data.results || [];
        setGroups(list.map((g) => g.nama).filter(Boolean));
      })
      .catch(() => {
        // Fallback bila endpoint belum ada — tetap izinkan pilih "Guest".
        if (!cancelled) setGroups(['Guest']);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSemua = () => {
    setSemua((v) => {
      const next = !v;
      if (next) setSelected([]);
      return next;
    });
  };

  const toggleOne = (nama) => {
    setSemua(false);
    setSelected((prev) =>
      prev.includes(nama) ? prev.filter((n) => n !== nama) : [...prev, nama],
    );
  };

  const handleSelesai = () => {
    if (semua || selected.length === 0) onApply('Semua');
    else onApply(selected.join(', '));
    onClose();
  };

  const filtered = groups.filter((g) => g.toLowerCase().includes(keyword.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 cursor-default"
      />
      {/* Panel */}
      <div className="relative w-full max-w-sm h-full bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="shrink-0 px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-800">Tipe Pelanggan</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            title="Tutup"
          >
            <span className="text-[10px] font-bold border border-slate-200 rounded px-1.5 py-0.5">ESC</span>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
          {/* Semua */}
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm font-semibold text-slate-700">Semua</span>
            <input
              type="checkbox"
              checked={semua}
              onChange={toggleSemua}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
          </label>

          {/* Cari */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="cari"
              className="w-full text-xs font-medium text-slate-700 border border-slate-200 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Daftar grup */}
          {loading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              {groups.length === 0 ? 'Belum ada tipe pelanggan.' : 'Tidak ada hasil untuk pencarian.'}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((nama) => (
                <label
                  key={nama}
                  className="flex items-center justify-between px-1 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  <span className="text-sm font-medium text-blue-600">{nama}</span>
                  <input
                    type="checkbox"
                    checked={semua || selected.includes(nama)}
                    onChange={() => toggleOne(nama)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleSelesai}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoyaltyPointSettingModal({ isOpen, onClose, settingData, onSave }) {
  const [formData, setFormData] = useState({
    is_active: true,
    cara_mendapatkan: 'product', // 'product' atau 'order'
    min_total_pemesanan: 0,
    point_diperoleh: 0,
    berlaku_kelipatan: false,
    default_poin_baru: 0.0,
    masa_aktif_nilai: 0,
    masa_aktif_satuan: 'pilih',
    berlaku_tipe_pelanggan: 'Semua',
    dapat_poin_saat_tebus: false,
  });
  const [tipeDrawerOpen, setTipeDrawerOpen] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setErrors({});
    if (settingData) {
      setFormData({
        is_active: settingData.is_active ?? true,
        cara_mendapatkan: settingData.cara_mendapatkan || 'product',
        min_total_pemesanan: settingData.min_total_pemesanan ?? 0,
        point_diperoleh: settingData.point_diperoleh ?? 0,
        berlaku_kelipatan: settingData.berlaku_kelipatan ?? false,
        default_poin_baru: settingData.default_poin_baru ?? 0.0,
        masa_aktif_nilai: settingData.masa_aktif_nilai ?? 0,
        masa_aktif_satuan: settingData.masa_aktif_satuan || 'pilih',
        berlaku_tipe_pelanggan: settingData.berlaku_tipe_pelanggan || 'Semua',
        dapat_poin_saat_tebus: settingData.dapat_poin_saat_tebus ?? false,
      });
    }
  }, [settingData]);

  if (!isOpen) return null;

  const update = (patch) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  // Pada mode "Total Pesanan", min. total & point wajib diisi (> 0).
  const validate = () => {
    const e = {};
    if (formData.cara_mendapatkan === 'order') {
      if (!Number(formData.min_total_pemesanan) || Number(formData.min_total_pemesanan) <= 0)
        e.min_total_pemesanan = 'Min. total pemesanan wajib diisi dan harus lebih dari 0.';
      if (!Number(formData.point_diperoleh) || Number(formData.point_diperoleh) <= 0)
        e.point_diperoleh = 'Point diperoleh wajib diisi dan harus lebih dari 0.';
    }
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Pastikan kolom bermasalah terlihat (mode order).
      if (formData.cara_mendapatkan !== 'order') setFormData((p) => ({ ...p, cara_mendapatkan: 'order' }));
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
      {/* max-h + flex-col: header (tombol) selalu terlihat, isi yang panjang scroll di dalam */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header — shrink-0 supaya tidak pernah terpotong */}
        <div className="shrink-0 px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white">
          <h2 className="text-lg font-bold text-slate-800">Pengaturan</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-lime-600 hover:bg-lime-700 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Simpan
            </button>
          </div>
        </div>

        {/* Body — flex-1 + overflow scroll internal */}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
          {/* Aktifkan fitur loyalty point */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Aktifkan fitur loyalty point</span>
            <Toggle
              checked={formData.is_active}
              onChange={(v) => setFormData({ ...formData, is_active: v })}
            />
          </div>

          {/* Cara mendapatkan poin */}
          <div className="space-y-3">
            <label className="text-[11px] text-slate-500 font-medium block">Cara mendapatkan poin</label>
            <div className="grid grid-cols-2 gap-0 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, cara_mendapatkan: 'product' })}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  formData.cara_mendapatkan === 'product'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pembelian Product
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, cara_mendapatkan: 'order' })}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  formData.cara_mendapatkan === 'order'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Total Pesanan
              </button>
            </div>
          </div>

          {/* Konten sesuai mode */}
          {formData.cara_mendapatkan === 'product' ? (
            <div className="bg-sky-50/80 border border-sky-100 rounded-xl p-4 flex items-start gap-3 text-sky-800">
              <Info size={18} className="text-sky-500 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                Point akan diperoleh pelanggan saat membeli produk tertentu. Besar point yang diperoleh dapat diatur pada masing-masing produk
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Min. total pemesanan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={`Rp. ${Number(formData.min_total_pemesanan || 0).toLocaleString('id-ID')}`}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    update({ min_total_pemesanan: Number(val) });
                  }}
                  className={`w-full text-xs font-medium text-slate-800 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.min_total_pemesanan ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {errors.min_total_pemesanan && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                    <AlertCircle size={12} className="shrink-0" /> {errors.min_total_pemesanan}
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] text-slate-500 font-medium block mb-1">
                  Point diperoleh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.point_diperoleh}
                  onChange={(e) => update({ point_diperoleh: Number(e.target.value) })}
                  className={`w-full text-xs font-medium text-slate-800 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    errors.point_diperoleh ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {errors.point_diperoleh && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-600">
                    <AlertCircle size={12} className="shrink-0" /> {errors.point_diperoleh}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-800">Berlaku kelipatan</span>
                <Toggle
                  checked={formData.berlaku_kelipatan}
                  onChange={(v) => setFormData({ ...formData, berlaku_kelipatan: v })}
                />
              </div>

              <p className="text-[10px] text-slate-400">
                <span className="text-rose-500">*</span> Kolom wajib diisi.
              </p>
            </div>
          )}

          {/* Default poin pelanggan baru */}
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Default poin pelanggan baru</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="number"
                step="0.01"
                value={formData.default_poin_baru}
                onChange={(e) => setFormData({ ...formData, default_poin_baru: e.target.value })}
                className="w-full text-xs font-medium text-slate-800 px-3 py-2 focus:outline-none"
              />
              <span className="bg-slate-50 border-l border-slate-200 px-4 flex items-center text-xs font-medium text-slate-500">
                Poin
              </span>
            </div>
          </div>

          {/* Masa aktif poin */}
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Masa aktif poin</label>
            <div className="grid grid-cols-3 gap-0 rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="number"
                value={formData.masa_aktif_nilai}
                onChange={(e) => setFormData({ ...formData, masa_aktif_nilai: Number(e.target.value) })}
                className="col-span-2 text-xs font-medium text-slate-800 px-3 py-2 focus:outline-none"
              />
              <select
                value={formData.masa_aktif_satuan}
                onChange={(e) => setFormData({ ...formData, masa_aktif_satuan: e.target.value })}
                className="col-span-1 bg-slate-50 border-l border-slate-200 px-2 py-2 text-xs font-medium text-slate-600 focus:outline-none cursor-pointer"
              >
                <option value="pilih">Pilih</option>
                <option value="hari">Hari</option>
                <option value="bulan">Bulan</option>
                <option value="tahun">Tahun</option>
              </select>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Masa aktif masing-masing poin dihitung sejak poin diperoleh</p>
          </div>

          {/* Berlaku untuk tipe pelanggan — klik membuka drawer */}
          <div>
            <label className="text-[11px] text-slate-500 font-medium block mb-1">Berlaku untuk tipe pelanggan</label>
            <button
              type="button"
              onClick={() => setTipeDrawerOpen(true)}
              className="w-full flex items-center justify-between text-left text-xs font-medium text-slate-800 border border-slate-300 rounded-lg pl-3 pr-3 py-2 hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              <span className="truncate">{formData.berlaku_tipe_pelanggan || 'Semua'}</span>
              <Pencil size={14} className="text-blue-500 shrink-0" />
            </button>
          </div>

          {/* Dapat poin saat tebus poin */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-slate-800">Dapat poin saat tebus poin</span>
            <Toggle
              checked={formData.dapat_poin_saat_tebus}
              onChange={(v) => setFormData({ ...formData, dapat_poin_saat_tebus: v })}
            />
          </div>
        </div>
      </div>

      {/* Drawer Tipe Pelanggan */}
      {tipeDrawerOpen && (
        <TipePelangganDrawer
          initialValue={formData.berlaku_tipe_pelanggan}
          onClose={() => setTipeDrawerOpen(false)}
          onApply={(val) => setFormData({ ...formData, berlaku_tipe_pelanggan: val })}
        />
      )}
    </div>
  );
}
