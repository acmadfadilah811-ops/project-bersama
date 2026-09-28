import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { uiConfirm } from '../../../utils/dialog';

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white';

function labelTierHarga(tiers, index) {
  if (!tiers || tiers.length === 0) return 'Harga';
  const bawah = index === 0 ? 1 : tiers[index - 1] + 1;
  const atas = tiers[index];
  return atas === undefined ? `>${tiers[tiers.length - 1]}` : `${bawah}-${atas}`;
}

/**
 * Tab "Pricelist" di Kasir > Pengaturan WA Bot -- form terstruktur (nama
 * bahan + harga per tier qty) utk 4 kategori kalkulator (banner/stiker/
 * kertas_a3/kartu_nama) + teks tampilan bebas utk semua kategori, plus
 * unduh template & impor CSV per kategori terstruktur.
 */
export default function PricelistWaBotPanel() {
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState(null);
  const [draft, setDraft] = useState(null); // { teks, bahan }
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState(null);
  // Form tambah kategori baru (kategori teks, 2026-09-28).
  const [formBaru, setFormBaru] = useState(null); // { label, teks } | null
  const [menambah, setMenambah] = useState(false);

  const fetchList = async (selectSlug) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/wa-pricelist/');
      const list = res.data?.kategori || [];
      setKategoriList(list);
      const target = list.find((k) => k.slug === (selectSlug || activeSlug)) || list[0];
      if (target) {
        setActiveSlug(target.slug);
        setDraft({ teks: target.teks, bahan: target.bahan ? [...target.bahan] : null });
      }
    } catch {
      setMsg({ type: 'error', text: 'Gagal memuat pricelist.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aktif = kategoriList.find((k) => k.slug === activeSlug);

  const pilihKategori = (slug) => {
    const target = kategoriList.find((k) => k.slug === slug);
    if (!target) return;
    setActiveSlug(slug);
    setDraft({ teks: target.teks, bahan: target.bahan ? [...target.bahan] : null });
    setMsg(null);
  };

  const ubahHargaBaris = (index, tierIndex, value) => {
    setDraft((d) => {
      const bahan = [...d.bahan];
      const baris = { ...bahan[index] };
      if (Array.isArray(baris.harga)) {
        const harga = [...baris.harga];
        harga[tierIndex] = value;
        baris.harga = harga;
      } else {
        baris.harga = value;
      }
      bahan[index] = baris;
      return { ...d, bahan };
    });
  };

  const ubahNamaBaris = (index, value) => {
    setDraft((d) => {
      const bahan = [...d.bahan];
      bahan[index] = { ...bahan[index], nama: value };
      return { ...d, bahan };
    });
  };

  const tambahBaris = () => {
    setDraft((d) => {
      const contoh = d.bahan[0];
      const hargaKosong = Array.isArray(contoh?.harga) ? contoh.harga.map(() => 0) : 0;
      return { ...d, bahan: [...d.bahan, { nama: '', harga: hargaKosong }] };
    });
  };

  const simpanKategoriBaru = async () => {
    if (!formBaru) return;
    setMenambah(true);
    setMsg(null);
    try {
      const res = await apiClient.post('/wa-pricelist/', { label: formBaru.label, teks: formBaru.teks });
      setFormBaru(null);
      await fetchList(res.data.slug);
      setMsg({ type: 'success', text: `Kategori "${res.data.label}" ditambahkan.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menambah kategori.' });
    } finally {
      setMenambah(false);
    }
  };

  const hapusKategori = async () => {
    if (!aktif || aktif.terstruktur) return;
    const ok = await uiConfirm(
      `Hapus kategori "${aktif.label}"? Bot tidak akan lagi menampilkan info harga kategori ini.`,
      { title: 'Hapus Kategori', confirmText: 'Hapus', danger: true },
    );
    if (!ok) return;
    setMsg(null);
    try {
      await apiClient.delete(`/wa-pricelist/${aktif.slug}/`);
      const sisa = kategoriList.filter((k) => k.slug !== aktif.slug);
      await fetchList(sisa[0]?.slug);
      setMsg({ type: 'success', text: `Kategori "${aktif.label}" dihapus.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menghapus kategori.' });
    }
  };

  const hapusBaris = (index) => {
    setDraft((d) => ({ ...d, bahan: d.bahan.filter((_, i) => i !== index) }));
  };

  const simpan = async () => {
    if (!aktif) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = { teks: draft.teks };
      if (aktif.terstruktur) payload.bahan = draft.bahan;
      const res = await apiClient.patch(`/wa-pricelist/${aktif.slug}/`, payload);
      setKategoriList((list) => list.map((k) => (k.slug === aktif.slug ? { ...k, ...res.data } : k)));
      setMsg({ type: 'success', text: `Pricelist kategori "${aktif.label}" tersimpan.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan pricelist.' });
    } finally {
      setSaving(false);
    }
  };

  const unduhTemplate = async () => {
    if (!aktif) return;
    try {
      const res = await apiClient.get(`/wa-pricelist/${aktif.slug}/template/`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pricelist_${aktif.slug}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setMsg({ type: 'error', text: 'Gagal mengunduh template.' });
    }
  };

  const importCsv = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !aktif) return;
    setImporting(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post(`/wa-pricelist/${aktif.slug}/import/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setKategoriList((list) => list.map((k) => (k.slug === aktif.slug ? { ...k, ...res.data } : k)));
      setDraft((d) => ({ ...d, bahan: res.data.bahan }));
      setMsg({ type: 'success', text: `Berhasil impor ${res.data.bahan.length} baris bahan dari CSV.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal mengimpor CSV.' });
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h4 className="font-bold text-slate-800 text-base">Pricelist WA Bot</h4>
        <p className="text-xs text-slate-400">
          Sumber harga & info produk resmi yang dijawab bot WhatsApp (tools "daftar_kategori_produk" &
          "hitung_harga_pricelist"). Perubahan di sini langsung dipakai bot, tanpa perlu restart.
        </p>
      </div>

      {msg && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border animate-fade-in
          ${msg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}
        >
          {msg.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
        {kategoriList.map((k) => (
          <button
            key={k.slug}
            type="button"
            onClick={() => pilihKategori(k.slug)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border
              ${activeSlug === k.slug
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {k.label}
            {k.terstruktur && <span className="ml-1 opacity-70">•</span>}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setFormBaru({ label: '', teks: '' }); setMsg(null); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <Plus size={13} /> Tambah Kategori
        </button>
      </div>
      <p className="text-[11px] text-slate-400 -mt-3">
        Tanda • = kategori berkalkulator harga (tidak bisa dihapus). Kategori lain berisi teks info harga.
      </p>

      {formBaru && (
        <div className="space-y-3 p-4 border border-slate-200 rounded-xl bg-slate-50">
          <p className="text-sm font-bold text-slate-700">Kategori Baru</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Nama Kategori</label>
            <input
              type="text"
              value={formBaru.label}
              onChange={(e) => setFormBaru((f) => ({ ...f, label: e.target.value }))}
              placeholder="Contoh: Stempel & Cap"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Teks Tampilan ke Pelanggan</label>
            <textarea
              rows={5}
              value={formBaru.teks}
              onChange={(e) => setFormBaru((f) => ({ ...f, teks: e.target.value }))}
              placeholder="Info harga yang dikirim bot saat pelanggan menanyakan kategori ini"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormBaru(null)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={simpanKategoriBaru}
              disabled={menambah || !formBaru.label.trim() || !formBaru.teks.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
            >
              {menambah ? 'Menyimpan...' : 'Simpan Kategori'}
            </button>
          </div>
        </div>
      )}

      {aktif && draft && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Teks Tampilan ke Pelanggan (kategori "{aktif.label}")
            </label>
            <p className="text-[11px] text-slate-400">
              Dikirim apa adanya oleh bot saat pelanggan tanya kategori ini. Format WhatsApp: *tebal*,
              _miring_, baris baru langsung enter.
            </p>
            <textarea
              rows={8}
              value={draft.teks}
              onChange={(e) => setDraft((d) => ({ ...d, teks: e.target.value }))}
              className={`${inputCls} font-mono text-xs`}
            />
          </div>

          {aktif.terstruktur && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-700">Data Kalkulator Harga</p>
                  <p className="text-[11px] text-slate-400">
                    Dipakai bot menghitung total otomatis. Satuan: {aktif.satuan || '-'}.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={tambahBaris}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <Plus size={13} /> Tambah Baris
                  </button>
                  <button
                    type="button"
                    onClick={unduhTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    <Download size={13} /> Unduh CSV
                  </button>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                    <Upload size={13} /> {importing ? 'Mengimpor...' : 'Impor CSV'}
                    <input type="file" accept=".csv" className="hidden" onChange={importCsv} disabled={importing} />
                  </label>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Nama Bahan</th>
                      {Array.isArray(draft.bahan[0]?.harga) ? (
                        draft.bahan[0].harga.map((_, i) => (
                          <th key={i} className="px-3 py-2 font-semibold text-slate-600 text-xs whitespace-nowrap">
                            Harga {labelTierHarga(aktif.tiers, i)}
                          </th>
                        ))
                      ) : (
                        <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Harga</th>
                      )}
                      <th className="px-2 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.bahan.map((b, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={b.nama}
                            onChange={(e) => ubahNamaBaris(index, e.target.value)}
                            className={inputCls}
                          />
                        </td>
                        {Array.isArray(b.harga) ? (
                          b.harga.map((h, tierIndex) => (
                            <td key={tierIndex} className="px-3 py-1.5">
                              <input
                                type="number"
                                min="0"
                                value={h}
                                onChange={(e) => ubahHargaBaris(index, tierIndex, Number(e.target.value))}
                                className={inputCls}
                              />
                            </td>
                          ))
                        ) : (
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              min="0"
                              value={b.harga}
                              onChange={(e) => ubahHargaBaris(index, 0, Number(e.target.value))}
                              className={inputCls}
                            />
                          </td>
                        )}
                        <td className="px-2 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => hapusBaris(index)}
                            className="text-rose-500 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={tambahBaris}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                <Plus size={14} /> Tambah Baris Bahan
              </button>
            </div>
          )}

          <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100">
            {!aktif.terstruktur ? (
              <button
                type="button"
                onClick={hapusKategori}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                <Trash2 size={15} /> Hapus Kategori
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={simpan}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-60 cursor-pointer shadow-sm"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={15} />
              )}
              Simpan Kategori "{aktif.label}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
