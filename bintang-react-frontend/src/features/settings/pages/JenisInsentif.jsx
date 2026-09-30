import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { uiConfirm } from '../../../utils/dialog';
import { notifySuccess, notifyApiError } from '../../../utils/notify';

const FORM_KOSONG = { id: null, nama: '', nominal_default: '', divisi: [], keterangan: '', aktif: true };
const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

/**
 * Master Jenis Insentif (Owner/Manager/Admin). Tiap jenis punya nominal standar
 * dan divisi target: begitu SPK terbit ke tahap milik divisi itu, insentifnya
 * otomatis masuk ke SPK di papan kerja staff. Nominal per SPK tetap bisa
 * dikustom Manager di kartu SPK.
 */
export default function JenisInsentif() {
  const { setSubtitle } = useTransaksiCrumb();
  const [daftar, setDaftar] = useState([]);
  const [divisiList, setDivisiList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setSubtitle('Jenis Insentif'); }, [setSubtitle]);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const [jenis, divisi] = await Promise.all([
        fetchAllPages('/jenis-insentif/'),
        fetchAllPages('/divisi/'),
      ]);
      setDaftar(jenis);
      setDivisiList(divisi);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat jenis insentif.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const toggleDivisi = (id) => setForm((f) => ({
    ...f,
    divisi: f.divisi.includes(id) ? f.divisi.filter((d) => d !== id) : [...f.divisi, id],
  }));

  const simpan = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nama: form.nama.trim(),
      nominal_default: parseInt(form.nominal_default || 0, 10),
      divisi: form.divisi,
      keterangan: form.keterangan.trim(),
      aktif: form.aktif,
    };
    try {
      if (form.id) await apiClient.patch(`/jenis-insentif/${form.id}/`, payload);
      else await apiClient.post('/jenis-insentif/', payload);
      notifySuccess('Tersimpan', `Jenis insentif "${payload.nama}" disimpan.`);
      setForm(null);
      muat();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan jenis insentif.');
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (j) => {
    if (!(await uiConfirm(`Hapus jenis insentif "${j.nama}"? SPK yang sudah memakainya tetap menyimpan barisnya.`))) return;
    try {
      await apiClient.delete(`/jenis-insentif/${j.id}/`);
      muat();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus jenis insentif.');
    }
  };

  const ubahAktif = async (j) => {
    try {
      await apiClient.patch(`/jenis-insentif/${j.id}/`, { aktif: !j.aktif });
      muat();
    } catch (err) {
      notifyApiError(err, 'Gagal mengubah status.');
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Jenis Insentif</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Insentif dengan divisi target otomatis masuk ke SPK yang diterbitkan ke divisi itu dan tampil di papan kerja
            staff. Nominal per SPK tetap bisa diubah Manager di kartu SPK. Perubahan di sini hanya berlaku untuk SPK baru.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...FORM_KOSONG })}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg px-3 py-2 hover:bg-slate-700"
        >
          <Plus size={14} /> Tambah Jenis
        </button>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Nama</th>
              <th className="text-right px-4 py-2.5">Nominal standar</th>
              <th className="text-left px-4 py-2.5">Divisi target</th>
              <th className="text-center px-4 py-2.5">Aktif</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">Memuat…</td></tr>
            )}
            {!loading && daftar.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-xs">Belum ada jenis insentif.</td></tr>
            )}
            {daftar.map((j) => (
              <tr key={j.id} className={j.aktif ? '' : 'text-slate-400'}>
                <td className="px-4 py-3 font-semibold">
                  {j.nama}
                  {j.keterangan && <div className="text-[11px] font-normal text-slate-400">{j.keterangan}</div>}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{rupiah(j.nominal_default)}</td>
                <td className="px-4 py-3">
                  {j.divisi_nama.length === 0 ? (
                    <span className="text-[11px] text-slate-400">Manual saja (tidak otomatis)</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {j.divisi_nama.map((n) => (
                        <span key={n} className="text-[11px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{n}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={j.aktif} onChange={() => ubahAktif(j)} aria-label={`Aktif ${j.nama}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...j, nominal_default: String(j.nominal_default) })}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      aria-label={`Ubah ${j.nama}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => hapus(j)}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                      aria-label={`Hapus ${j.nama}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={simpan} className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">{form.id ? 'Ubah Jenis Insentif' : 'Tambah Jenis Insentif'}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Tutup">
                <X size={16} />
              </button>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Nama</span>
              <input
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="mis. Insentif Desain"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Nominal standar (Rp)</span>
              <input
                required
                type="number"
                min="0"
                value={form.nominal_default}
                onChange={(e) => setForm({ ...form, nominal_default: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>

            <fieldset className="space-y-1">
              <legend className="text-[11px] font-semibold text-slate-500 uppercase">Divisi target (otomatis masuk SPK)</legend>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 grid grid-cols-2 gap-1">
                {divisiList.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 text-xs text-slate-700 px-1 py-0.5">
                    <input type="checkbox" checked={form.divisi.includes(d.id)} onChange={() => toggleDivisi(d.id)} />
                    {d.nama}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">Kosongkan bila insentif ini hanya ditambahkan manual oleh Manager.</p>
            </fieldset>

            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Keterangan (opsional)</span>
              <input
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
              />
            </label>

            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
              Aktif
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} className="text-xs font-semibold text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100">
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg px-3 py-2 hover:bg-slate-700 disabled:opacity-60"
              >
                <Save size={14} /> {saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
