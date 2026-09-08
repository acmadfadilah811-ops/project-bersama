import { useEffect, useState } from 'react';
import {
  RefreshCw, Plus, X, Wrench, AlertTriangle, Loader2, Trash2, History,
} from 'lucide-react';
import apiClient from '../../../../api/apiClient';

// Saran default di form -- BUKAN batasan. Backend `tipe` sekarang teks bebas
// (lihat api/machine_models.py) supaya owner bisa daftarkan tipe mesin baru
// sendiri kapan pun perusahaan beli mesin lain, tanpa perlu ubah kode/deploy
// (bug dilaporkan user 2026-09-09: dulu cuma bisa pilih 3 tipe ini).
const TIPE_PRESETS = [
  { value: 'docucolor', label: 'Fuji Xerox DocuColor', basis: 'lembar' },
  { value: 'cetak_banner', label: 'Cetak Banner', basis: 'meter' },
  { value: 'printer', label: 'Printer', basis: 'lembar' },
];
const TIPE_CUSTOM = '__custom__';

const BASIS_OPTIONS = [
  { value: 'lembar', label: 'Lembar/Klik (Color & Mono)' },
  { value: 'meter', label: 'Meter/Panjang Bahan' },
  { value: 'lainnya', label: 'Lainnya (catatan manual)' },
];

function MesinFormModal({ mesin, divisions, onClose, onSaved }) {
  const existingPreset = TIPE_PRESETS.find((t) => t.value === mesin?.tipe);
  const [tipeMode, setTipeMode] = useState(mesin && !existingPreset ? TIPE_CUSTOM : (mesin?.tipe || 'docucolor'));
  const [tipeCustom, setTipeCustom] = useState(mesin && !existingPreset ? mesin.tipe : '');
  const [form, setForm] = useState({
    nama: mesin?.nama || '',
    basis_pencatatan: mesin?.basis_pencatatan || 'lembar',
    divisi: mesin?.divisi || '',
    lokasi: mesin?.lokasi || '',
    ambang_servis_klik: mesin?.ambang_servis_klik || '',
    is_active: mesin ? mesin.is_active : true,
    catatan: mesin?.catatan || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSelectTipeMode = (value) => {
    setTipeMode(value);
    // Ganti basis_pencatatan otomatis ke default preset -- tapi tetap bisa
    // ditimpa manual (mis. tipe kustom yang datanya justru berbasis lembar).
    const preset = TIPE_PRESETS.find((t) => t.value === value);
    if (preset) setForm((f) => ({ ...f, basis_pencatatan: preset.basis }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tipe = tipeMode === TIPE_CUSTOM ? tipeCustom.trim() : tipeMode;
    if (!tipe) {
      setErr('Tipe mesin wajib diisi (pilih preset atau tulis tipe baru).');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const payload = {
        ...form,
        tipe,
        divisi: form.divisi || null,
        ambang_servis_klik: form.ambang_servis_klik ? Number(form.ambang_servis_klik) : null,
      };
      if (mesin) {
        await apiClient.patch(`/mesin/${mesin.id}/`, payload);
      } else {
        await apiClient.post('/mesin/', payload);
      }
      onSaved();
    } catch (error) {
      console.error('Gagal menyimpan mesin:', error);
      setErr(error.response?.data?.detail || 'Gagal menyimpan data mesin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-700 text-white px-5 py-3 flex justify-between items-center">
          <h2 className="font-bold text-sm">{mesin ? 'Edit Mesin' : 'Tambah Mesin'}</h2>
          <button onClick={onClose} className="text-indigo-200 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Nama Mesin *</label>
            <input
              type="text"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Mis: DocuColor 1"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Mesin *</label>
            <select
              value={tipeMode}
              onChange={(e) => handleSelectTipeMode(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {TIPE_PRESETS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
              <option value={TIPE_CUSTOM}>+ Tipe Baru (tulis manual)...</option>
            </select>
            {tipeMode === TIPE_CUSTOM && (
              <input
                type="text"
                required
                value={tipeCustom}
                onChange={(e) => setTipeCustom(e.target.value)}
                placeholder="Mis: Mesin Laminating"
                className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Basis Pencatatan Penggunaan *</label>
            <select
              value={form.basis_pencatatan}
              onChange={(e) => setForm({ ...form, basis_pencatatan: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {BASIS_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">
              Menentukan field yang muncul untuk staff saat mencatat penggunaan mesin ini.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Divisi</label>
            <select
              value={form.divisi}
              onChange={(e) => setForm({ ...form, divisi: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Tidak diset --</option>
              {(divisions || []).map((d) => (
                <option key={d.id} value={d.id}>{d.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi</label>
            <input
              type="text"
              value={form.lokasi}
              onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ambang Servis (klik/lembar)
            </label>
            <input
              type="number"
              min="0"
              value={form.ambang_servis_klik}
              onChange={(e) => setForm({ ...form, ambang_servis_klik: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Mis: 50000"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Kosongkan jika tidak perlu pengingat servis otomatis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mesin-aktif"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="cursor-pointer"
            />
            <label htmlFor="mesin-aktif" className="text-xs font-bold text-slate-700 cursor-pointer">
              Mesin aktif dipakai
            </label>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan</label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MaintenanceModal({ mesin, onClose, onSaved }) {
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ jenis: '', tanggal: new Date().toISOString().slice(0, 10), counter_saat_servis: mesin.total_klik || '', catatan: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const fetchRiwayat = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/maintenance-mesin/', { params: { mesin: mesin.id } });
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setRiwayat(data);
    } catch (error) {
      console.error('Gagal memuat riwayat maintenance:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRiwayat(); }, [mesin.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await apiClient.post('/maintenance-mesin/', {
        mesin: mesin.id,
        jenis: form.jenis,
        tanggal: form.tanggal,
        counter_saat_servis: form.counter_saat_servis ? Number(form.counter_saat_servis) : null,
        catatan: form.catatan,
      });
      setForm({ jenis: '', tanggal: new Date().toISOString().slice(0, 10), counter_saat_servis: '', catatan: '' });
      await fetchRiwayat();
      onSaved();
    } catch (error) {
      console.error('Gagal mencatat maintenance:', error);
      setErr(error.response?.data?.detail || 'Gagal menyimpan riwayat maintenance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-indigo-700 text-white px-5 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Wrench size={16} />
            <h2 className="font-bold text-sm">Riwayat Maintenance — {mesin.nama}</h2>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-b border-slate-100 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Jenis Servis *</label>
              <input
                type="text"
                required
                value={form.jenis}
                onChange={(e) => setForm({ ...form, jenis: e.target.value })}
                placeholder="Ganti Toner, Servis Rutin..."
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tanggal</label>
              <input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Counter Saat Servis</label>
            <input
              type="number"
              min="0"
              value={form.counter_saat_servis}
              onChange={(e) => setForm({ ...form, counter_saat_servis: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Catatan</label>
            <textarea
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm({ ...form, catatan: e.target.value })}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {err && <p className="text-[11px] font-semibold text-rose-600">{err}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Catat Servis
            </button>
          </div>
        </form>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center text-slate-400 text-xs py-6">Memuat riwayat...</div>
          ) : riwayat.length === 0 ? (
            <div className="text-center text-slate-400 text-xs italic py-6">Belum ada riwayat maintenance.</div>
          ) : (
            riwayat.map((r) => (
              <div key={r.id} className="border border-slate-100 rounded-lg p-2.5 bg-slate-50/50">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-800">{r.jenis}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{r.tanggal}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {r.counter_saat_servis != null && <span>Counter: {r.counter_saat_servis.toLocaleString()} · </span>}
                  {r.dicatat_oleh_nama && <span>oleh {r.dicatat_oleh_nama}</span>}
                </div>
                {r.catatan && <p className="text-[10px] text-slate-600 mt-1">{r.catatan}</p>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDetailPenggunaan(entry) {
  const basis = entry.mesin_basis_pencatatan;
  if (basis === 'meter') {
    const meter = entry.panjang_bahan_meter != null ? Number(entry.panjang_bahan_meter).toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '0';
    return `${meter} m${entry.jenis_bahan ? ` — ${entry.jenis_bahan}` : ''}`;
  }
  if (basis === 'lainnya') {
    return entry.catatan_konfirmasi || '-';
  }
  const parts = [];
  if (entry.lembar_color) parts.push(`${entry.lembar_color} color`);
  if (entry.lembar_mono) parts.push(`${entry.lembar_mono} mono`);
  return parts.length > 0 ? parts.join(' / ') : '0';
}

function LogPenggunaanSection({ mesinList, staffList }) {
  const [rows, setRows] = useState([]);
  const [ringkasan, setRingkasan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMesin, setFilterMesin] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterMulai, setFilterMulai] = useState('');
  const [filterAkhir, setFilterAkhir] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const mesinById = Object.fromEntries((mesinList || []).map((m) => [String(m.id), m]));

  const buildParams = (extra = {}) => {
    const params = { ...extra };
    if (filterMesin) params.mesin = filterMesin;
    if (filterStaff) params.operator = filterStaff;
    if (filterMulai) params.tanggal_mulai = filterMulai;
    if (filterAkhir) params.tanggal_akhir = filterAkhir;
    return params;
  };

  const fetchLog = async () => {
    setLoading(true);
    try {
      const [logRes, ringkasanRes] = await Promise.all([
        apiClient.get('/penggunaan-mesin/', { params: buildParams({ page, page_size: 20 }) }),
        apiClient.get('/penggunaan-mesin/ringkasan-staff/', { params: buildParams() }),
      ]);
      const logData = logRes.data;
      const list = Array.isArray(logData) ? logData : (logData?.results || []);
      // Lampirkan basis_pencatatan mesin ke tiap baris (dibutuhkan
      // formatDetailPenggunaan) -- serializer log tidak menyertakan field
      // mesin lain selain nama, jadi di-join di sini dari mesinList yang
      // sudah dimuat panel utama.
      const enriched = list.map((row) => ({
        ...row,
        mesin_basis_pencatatan: mesinById[String(row.mesin)]?.basis_pencatatan,
      }));
      setRows(enriched);
      if (!Array.isArray(logData)) {
        setTotalItems(logData.count ?? list.length);
        setTotalPages(Math.max(1, Math.ceil((logData.count ?? list.length) / 20)));
      } else {
        setTotalItems(list.length);
        setTotalPages(1);
      }
      setRingkasan(Array.isArray(ringkasanRes.data) ? ringkasanRes.data : []);
    } catch (error) {
      console.error('Gagal memuat log penggunaan mesin:', error);
      setRows([]);
      setRingkasan([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMesin, filterStaff, filterMulai, filterAkhir, page, mesinList.length]);

  useEffect(() => { setPage(1); }, [filterMesin, filterStaff, filterMulai, filterAkhir]);

  return (
    <div className="space-y-3">
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-800">Log Penggunaan</h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Riwayat pencatatan pemakaian mesin dari semua staff -- filter per mesin/staff untuk pertanggungjawaban.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <select
            value={filterMesin}
            onChange={(e) => setFilterMesin(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Mesin</option>
            {(mesinList || []).map((m) => (
              <option key={m.id} value={m.id}>{m.nama}</option>
            ))}
          </select>
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Semua Staff</option>
            {(staffList || []).map((s) => (
              <option key={s.id} value={s.id}>{s.username}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterMulai}
            onChange={(e) => setFilterMulai(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={filterAkhir}
            onChange={(e) => setFilterAkhir(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {ringkasan.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ringkasan.map((r) => (
            <div key={r.operator_id} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-extrabold text-slate-800 truncate">{r.operator_nama}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{r.jumlah_entri} entri</p>
              <div className="flex gap-3 mt-1.5 text-[10px] font-bold text-slate-600">
                {r.total_klik > 0 && <span>{r.total_klik.toLocaleString()} klik</span>}
                {r.total_meter > 0 && <span>{r.total_meter.toLocaleString('id-ID')} m</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center text-slate-400 text-xs py-10">Memuat log...</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-slate-400 text-xs italic py-10">Belum ada catatan penggunaan untuk filter ini.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5">Mesin</th>
                  <th className="px-3 py-2.5">Staff</th>
                  <th className="px-3 py-2.5">Job</th>
                  <th className="px-3 py-2.5">Detail Pemakaian</th>
                  <th className="px-3 py-2.5">Kondisi</th>
                  <th className="px-3 py-2.5">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">
                      {new Date(row.waktu).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{row.mesin_nama}</td>
                    <td className="px-3 py-2.5 text-slate-700">{row.operator_nama || '-'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{row.job_nomor_sumber || '-'}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-800">{formatDetailPenggunaan(row)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${row.kondisi_hasil === 'kendala' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {row.kondisi_hasil === 'kendala' ? 'Ada Kendala' : 'OK'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-[200px] truncate" title={row.catatan_konfirmasi}>
                      {row.catatan_konfirmasi || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 text-[11px] font-bold text-slate-500">
            <span>Total {totalItems} entri</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1 border border-slate-200 rounded disabled:opacity-30 cursor-pointer"
              >
                &lt;
              </button>
              <span>{page}/{totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1 border border-slate-200 rounded disabled:opacity-30 cursor-pointer"
              >
                &gt;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MesinPanel({ divisions, staffList }) {
  const [mesinList, setMesinList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMesin, setEditingMesin] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [maintenanceMesin, setMaintenanceMesin] = useState(null);

  const fetchMesin = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/mesin/');
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setMesinList(data);
    } catch (error) {
      console.error('Gagal memuat daftar mesin:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMesin(); }, []);

  const handleDelete = async (mesin) => {
    if (!window.confirm(`Hapus mesin "${mesin.nama}"? Log penggunaan yang tercatat tetap tersimpan.`)) return;
    try {
      await apiClient.delete(`/mesin/${mesin.id}/`);
      fetchMesin();
    } catch (error) {
      console.error('Gagal menghapus mesin:', error);
      alert(error.response?.data?.detail || 'Gagal menghapus mesin.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Penggunaan Mesin</h2>
          <p className="text-[11px] text-slate-400">
            Master mesin produksi (DocuColor, Cetak Banner, Printer) + jadwal maintenance berbasis akumulasi klik/lembar.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchMesin}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <RefreshCw size={12} />
            Segarkan
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            <Plus size={12} />
            Tambah Mesin
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-xs py-10">Memuat data mesin...</div>
      ) : mesinList.length === 0 ? (
        <div className="text-center text-slate-400 text-xs italic py-10 bg-white border border-slate-200 rounded-xl">
          Belum ada mesin terdaftar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mesinList.map((m) => (
            <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800">{m.nama}</h3>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide">{m.tipe_display}</p>
                  {m.lokasi && <p className="text-[10px] text-slate-400">{m.lokasi}</p>}
                  {m.divisi_nama && <p className="text-[10px] text-slate-400">Divisi: {m.divisi_nama}</p>}
                </div>
                {!m.is_active && (
                  <span className="bg-slate-100 text-slate-500 text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    Nonaktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50/60 border border-slate-150 rounded-lg p-2.5 text-center">
                {m.basis_pencatatan === 'meter' ? (
                  <div className="col-span-2">
                    <div className="text-xs font-black text-slate-800">
                      {Number(m.total_meter || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 })} m
                    </div>
                    <div className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                      Total Pemakaian (Meter)
                    </div>
                  </div>
                ) : m.basis_pencatatan === 'lainnya' ? (
                  <div className="col-span-2 text-[10px] text-slate-400 italic py-1">
                    Basis pencatatan manual — lihat Log Penggunaan untuk detail.
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-xs font-black text-slate-800">{(m.total_klik || 0).toLocaleString()}</div>
                      <div className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                        Total Klik
                      </div>
                    </div>
                    <div className="border-l border-slate-200">
                      <div className="text-xs font-black text-slate-800">{(m.klik_sejak_servis_terakhir || 0).toLocaleString()}</div>
                      <div className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                        Sejak Servis
                      </div>
                    </div>
                  </>
                )}
              </div>

              {m.perlu_servis && (
                <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1.5 rounded-lg">
                  <AlertTriangle size={12} />
                  Perlu servis (ambang {Number(m.ambang_servis_klik).toLocaleString()} klik terlampaui)
                </div>
              )}

              <div className="flex gap-2 pt-1 border-t border-slate-100">
                <button
                  onClick={() => setMaintenanceMesin(m)}
                  className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg cursor-pointer"
                >
                  <History size={11} />
                  Riwayat Servis
                </button>
                <button
                  onClick={() => setEditingMesin(m)}
                  className="flex-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 px-2 py-1.5 rounded-lg cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  className="text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 px-2 py-1.5 rounded-lg cursor-pointer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LogPenggunaanSection mesinList={mesinList} staffList={staffList} />

      {showAddModal && (
        <MesinFormModal
          divisions={divisions}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchMesin(); }}
        />
      )}
      {editingMesin && (
        <MesinFormModal
          mesin={editingMesin}
          divisions={divisions}
          onClose={() => setEditingMesin(null)}
          onSaved={() => { setEditingMesin(null); fetchMesin(); }}
        />
      )}
      {maintenanceMesin && (
        <MaintenanceModal
          mesin={maintenanceMesin}
          onClose={() => setMaintenanceMesin(null)}
          onSaved={fetchMesin}
        />
      )}
    </div>
  );
}
