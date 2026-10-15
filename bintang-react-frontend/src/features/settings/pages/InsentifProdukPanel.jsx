import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { uiConfirm } from '../../../utils/dialog';
import { notifyApiError, notifyError, notifySuccess } from '../../../utils/notify';

const CARA = [
  ['qty', 'Per qty', 'Nominal × jumlah (mis. Rp500 per lembar)'],
  ['m2', 'Per m²', 'Nominal × luas cetak (panjang × lebar × qty)'],
  ['flat', 'Flat per SPK', 'Nominal tetap per SPK, berapa pun jumlahnya'],
];
const FORM_KOSONG = { id: null, product: null, product_nama: '', divisi: '', cara_hitung: 'qty', nominal: '', keterangan: '', aktif: true };
const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const daftar = (data) => (Array.isArray(data) ? data : data?.results || []);

/**
 * Insentif khusus per produk & divisi (2026-10-15), semua unit bisnis.
 * Bila SPK produk ini terbit ke divisi itu, insentifnya dihitung dari aturan
 * ini dan menggantikan Jenis Insentif umum divisi tersebut.
 */
export default function InsentifProdukPanel({ divisiList, unitOptions }) {
  const [aturan, setAturan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUnit, setFilterUnit] = useState('');
  const [filterDivisi, setFilterDivisi] = useState('');
  const [cari, setCari] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cariProduk, setCariProduk] = useState('');
  const [hasilProduk, setHasilProduk] = useState([]);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/insentif-produk/', {
        params: {
          ...(filterUnit ? { unit_bisnis: filterUnit } : {}),
          ...(filterDivisi ? { divisi: filterDivisi } : {}),
          ...(cari.trim() ? { cari: cari.trim() } : {}),
        },
      });
      setAturan(daftar(res.data));
    } catch (err) {
      notifyApiError(err, 'Gagal memuat insentif per produk.');
    } finally {
      setLoading(false);
    }
  }, [filterUnit, filterDivisi, cari]);

  useEffect(() => {
    const t = setTimeout(muat, 250);
    return () => clearTimeout(t);
  }, [muat]);

  // Pencarian produk di form (server-side, katalog bisa besar).
  useEffect(() => {
    if (!form || form.id || cariProduk.trim().length < 2) { setHasilProduk([]); return undefined; }
    let aktif = true;
    const t = setTimeout(() => {
      apiClient.get('/products/', { params: { search: cariProduk.trim(), page: 1, page_size: 20 } })
        .then((res) => { if (aktif) setHasilProduk(daftar(res.data)); })
        .catch(() => { if (aktif) setHasilProduk([]); });
    }, 250);
    return () => { aktif = false; clearTimeout(t); };
  }, [cariProduk, form]);

  // Divisi yang cocok dengan unit produk terpilih (divisi umum tanpa unit selalu boleh).
  const divisiUntuk = (unitId) => divisiList.filter((d) => !unitId || !d.unit_bisnis || String(d.unit_bisnis) === String(unitId));

  const simpan = async (e) => {
    e.preventDefault();
    if (!form.product) { notifyError('Produk belum dipilih', 'Pilih produk terlebih dahulu.'); return; }
    setSaving(true);
    const payload = {
      product: form.product,
      divisi: Number(form.divisi),
      cara_hitung: form.cara_hitung,
      nominal: parseInt(form.nominal || 0, 10),
      keterangan: form.keterangan.trim(),
      aktif: form.aktif,
    };
    try {
      if (form.id) await apiClient.patch(`/insentif-produk/${form.id}/`, payload);
      else await apiClient.post('/insentif-produk/', payload);
      notifySuccess('Tersimpan', `Insentif ${form.product_nama} disimpan.`);
      setForm(null);
      muat();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan insentif produk.');
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (a) => {
    if (!(await uiConfirm(`Hapus insentif ${a.product_nama} untuk divisi ${a.divisi_nama}? SPK yang sudah terbit tetap menyimpan insentifnya.`))) return;
    try {
      await apiClient.delete(`/insentif-produk/${a.id}/`);
      muat();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus insentif produk.');
    }
  };

  const ubahAktif = async (a) => {
    try {
      await apiClient.patch(`/insentif-produk/${a.id}/`, { aktif: !a.aktif });
      muat();
    } catch (err) {
      notifyApiError(err, 'Gagal mengubah status.');
    }
  };

  const labelCara = (id) => (CARA.find((c) => c[0] === id) || [])[1] || id;
  const satuanNominal = (id) => (id === 'qty' ? ' / qty' : id === 'm2' ? ' / m²' : ' / SPK');

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-xs text-slate-500 max-w-xl">
          Insentif khusus produk untuk divisi tertentu, berlaku di semua unit bisnis. Bila SPK produk ini terbit ke divisi
          itu, insentifnya dihitung dari aturan di sini dan menggantikan Jenis Insentif umum divisi tersebut. Berlaku untuk
          SPK baru.
        </p>
        <button
          type="button"
          onClick={() => { setForm({ ...FORM_KOSONG }); setCariProduk(''); }}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-800 text-white rounded-lg px-3 py-2 hover:bg-slate-700"
        >
          <Plus size={14} /> Tambah Insentif Produk
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Semua unit</option>
          {unitOptions.map((u) => <option key={u.id} value={String(u.id)}>{u.nama}</option>)}
        </select>
        <select value={filterDivisi} onChange={(e) => setFilterDivisi(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">Semua divisi</option>
          {divisiUntuk(filterUnit).map((d) => <option key={d.id} value={String(d.id)}>{d.nama}</option>)}
        </select>
        <div className="relative">
          <Search size={13} className="absolute left-2 top-2 text-slate-400" />
          <input
            value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari produk..."
            className="text-xs border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 w-48"
          />
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2.5">Produk</th>
              <th className="text-left px-4 py-2.5">Divisi</th>
              <th className="text-left px-4 py-2.5">Cara hitung</th>
              <th className="text-right px-4 py-2.5">Nominal</th>
              <th className="text-center px-4 py-2.5">Aktif</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && aturan.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs">Memuat…</td></tr>
            )}
            {!loading && aturan.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-xs">Belum ada insentif per produk.</td></tr>
            )}
            {aturan.map((a) => (
              <tr key={a.id} className={a.aktif ? '' : 'text-slate-400'}>
                <td className="px-4 py-3 font-semibold">
                  {a.product_nama}
                  <div className="text-[11px] font-normal text-slate-400">{a.unit_bisnis_nama || 'Semua unit'}{a.keterangan ? ` · ${a.keterangan}` : ''}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">{a.divisi_nama}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{labelCara(a.cara_hitung)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{rupiah(a.nominal)}<span className="text-[11px] text-slate-400">{satuanNominal(a.cara_hitung)}</span></td>
                <td className="px-4 py-3 text-center">
                  <input type="checkbox" checked={a.aktif} onChange={() => ubahAktif(a)} aria-label={`Aktif ${a.product_nama}`} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...a, divisi: String(a.divisi), nominal: String(a.nominal) })}
                      className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label={`Ubah ${a.product_nama}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => hapus(a)} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label={`Hapus ${a.product_nama}`}>
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
        <div className="fixed inset-0 z-[70] bg-slate-900/40 flex items-center justify-center p-4">
          <form onSubmit={simpan} className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-bold text-slate-800">{form.id ? 'Ubah Insentif Produk' : 'Tambah Insentif Produk'}</h2>
              <button type="button" onClick={() => setForm(null)} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Tutup">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Produk</span>
                {form.product ? (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <span className="font-semibold text-slate-800">{form.product_nama}</span>
                    {!form.id && (
                      <button type="button" onClick={() => setForm({ ...form, product: null, product_nama: '', divisi: '' })} className="text-xs text-slate-500 underline">
                        Ganti
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <input
                      autoFocus value={cariProduk} onChange={(e) => setCariProduk(e.target.value)}
                      placeholder="Ketik minimal 2 huruf nama produk..."
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
                    />
                    {hasilProduk.length > 0 && (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                        {hasilProduk.map((p) => (
                          <button
                            key={p.id} type="button"
                            onClick={() => setForm({ ...form, product: p.id, product_nama: p.nama, unit_produk: p.unit_bisnis, divisi: '' })}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            {p.nama}
                            {p.unit_bisnis_nama && <span className="ml-1 text-[11px] text-slate-400">({p.unit_bisnis_nama})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Divisi yang menerima insentif</span>
                <select
                  required value={form.divisi} onChange={(e) => setForm({ ...form, divisi: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-slate-500"
                >
                  <option value="">Pilih divisi…</option>
                  {divisiUntuk(form.unit_produk ?? form.unit_bisnis).map((d) => (
                    <option key={d.id} value={String(d.id)}>{d.nama}{d.unit_bisnis_nama ? ` (${d.unit_bisnis_nama})` : ''}</option>
                  ))}
                </select>
              </label>

              <fieldset className="space-y-1">
                <legend className="text-[11px] font-semibold text-slate-500 uppercase">Cara hitung</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CARA.map(([id, label, ket]) => (
                    <button
                      key={id} type="button" onClick={() => setForm({ ...form, cara_hitung: id })}
                      className={`rounded-lg border px-3 py-2 text-left ${form.cara_hitung === id ? 'border-slate-800 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <span className="block text-xs font-bold text-slate-800">{label}</span>
                      <span className="block text-[11px] text-slate-500">{ket}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Nominal (Rp{satuanNominal(form.cara_hitung)})</span>
                  <input
                    required type="number" min="0" value={form.nominal}
                    onChange={(e) => setForm({ ...form, nominal: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase">Keterangan (opsional)</span>
                  <input
                    value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-500"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
                Aktif
              </label>
            </div>

            <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
              <button type="button" onClick={() => setForm(null)} className="text-xs font-semibold text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-100">
                Batal
              </button>
              <button
                type="submit" disabled={saving}
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
