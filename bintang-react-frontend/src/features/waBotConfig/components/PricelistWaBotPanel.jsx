import { useEffect, useState } from 'react';
import { AlertCircle, Calculator, CheckCircle2, Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { uiConfirm } from '../../../utils/dialog';

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all bg-white';
const tombolCls =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer';

const KALKULATOR_BARU = { mode: 'qty', satuan: 'pcs', tiers: [], bahan: [{ nama: '', harga: 0 }] };

function labelTierHarga(tiers, index) {
  if (!tiers || tiers.length === 0) return '';
  const bawah = index === 0 ? 1 : tiers[index - 1] + 1;
  const atas = tiers[index];
  return atas === undefined ? `>${tiers[tiers.length - 1]}` : `${bawah}-${atas}`;
}

/** Sesuaikan jumlah kolom harga tiap bahan dengan jumlah tingkatan baru. */
function sesuaikanHarga(harga, tiers) {
  const lama = Array.isArray(harga) ? harga : [harga ?? 0];
  if (!tiers.length) return Number(lama[0]) || 0;
  const n = tiers.length + 1;
  return Array.from({ length: n }, (_, i) => Number(lama[Math.min(i, lama.length - 1)]) || 0);
}

function kalkulatorDariKategori(k) {
  if (!k?.terstruktur) return null;
  return { mode: k.mode || 'qty', satuan: k.satuan || '', tiers: [...(k.tiers || [])], bahan: (k.bahan || []).map((b) => ({ ...b })) };
}

/**
 * Editor kalkulator harga bot (2026-09-28): jenis (per m2 / per jumlah),
 * satuan, tingkatan qty, dan baris bahan. Dipakai di kategori yang sudah ada
 * maupun di form Tambah Kategori.
 */
function KalkulatorEditor({ kalk, onChange }) {
  const [teksTier, setTeksTier] = useState((kalk.tiers || []).join(', '));

  const ubah = (patch) => onChange({ ...kalk, ...patch });

  const terapkanTier = (teks) => {
    const tiers = teks.split(/[,\s]+/).map((t) => parseInt(t, 10)).filter((t) => Number.isFinite(t) && t > 0);
    const unik = [...new Set(tiers)].sort((a, b) => a - b);
    setTeksTier(unik.join(', '));
    ubah({ tiers: unik, bahan: kalk.bahan.map((b) => ({ ...b, harga: sesuaikanHarga(b.harga, unik) })) });
  };

  const gantiMode = (mode) => {
    if (mode === 'luas') {
      setTeksTier('');
      ubah({ mode, satuan: 'm2', tiers: [], bahan: kalk.bahan.map((b) => ({ ...b, harga: sesuaikanHarga(b.harga, []) })) });
    } else {
      ubah({ mode, satuan: kalk.satuan === 'm2' ? 'pcs' : kalk.satuan });
    }
  };

  const ubahBaris = (index, patch) => ubah({ bahan: kalk.bahan.map((b, i) => (i === index ? { ...b, ...patch } : b)) });
  const tambahBaris = () => ubah({ bahan: [...kalk.bahan, { nama: '', harga: sesuaikanHarga(0, kalk.tiers) }] });
  const hapusBaris = (index) => ubah({ bahan: kalk.bahan.filter((_, i) => i !== index) });

  const jumlahKolom = kalk.tiers.length ? kalk.tiers.length + 1 : 1;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Jenis Hitungan</label>
          <select value={kalk.mode} onChange={(e) => gantiMode(e.target.value)} className={inputCls}>
            <option value="qty">Per jumlah (lembar/box/pcs)</option>
            <option value="luas">Per luas (m², panjang × lebar)</option>
          </select>
        </div>
        {kalk.mode === 'qty' && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Satuan</label>
              <input type="text" value={kalk.satuan} onChange={(e) => ubah({ satuan: e.target.value })} placeholder="lembar / box / pcs" className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Tingkatan Qty (batas atas)</label>
              <input
                type="text"
                value={teksTier}
                onChange={(e) => setTeksTier(e.target.value)}
                onBlur={(e) => terapkanTier(e.target.value)}
                placeholder="mis. 25, 50, 100 (kosong = satu harga)"
                className={inputCls}
              />
            </div>
          </>
        )}
      </div>
      <p className="text-[11px] text-slate-400">
        {kalk.mode === 'luas'
          ? 'Bot meminta panjang & lebar (meter), lalu total = luas × harga per m² × jumlah lembar.'
          : kalk.tiers.length
            ? `Harga per ${kalk.satuan || 'satuan'} mengikuti jumlah pesanan: ${kalk.tiers.map((_, i) => labelTierHarga(kalk.tiers, i)).concat(labelTierHarga(kalk.tiers, kalk.tiers.length)).join(' / ')}.`
            : `Satu harga per ${kalk.satuan || 'satuan'}, total = harga × jumlah.`}
      </p>

      <div className="flex justify-end">
        <button type="button" onClick={tambahBaris} className={tombolCls}>
          <Plus size={13} /> Tambah Baris
        </button>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 font-semibold text-slate-600 text-xs">Nama Bahan</th>
              {Array.from({ length: jumlahKolom }, (_, i) => (
                <th key={i} className="px-3 py-2 font-semibold text-slate-600 text-xs whitespace-nowrap">
                  {kalk.mode === 'luas' ? 'Harga / m²' : kalk.tiers.length ? `Harga ${labelTierHarga(kalk.tiers, i)}` : `Harga / ${kalk.satuan || 'satuan'}`}
                </th>
              ))}
              <th className="px-2 py-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {kalk.bahan.map((b, index) => {
              const daftarHarga = Array.isArray(b.harga) ? b.harga : [b.harga];
              return (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <input type="text" value={b.nama} onChange={(e) => ubahBaris(index, { nama: e.target.value })} className={inputCls} />
                  </td>
                  {daftarHarga.map((h, tierIndex) => (
                    <td key={tierIndex} className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        value={h}
                        onChange={(e) => {
                          const nilai = Number(e.target.value);
                          ubahBaris(index, {
                            harga: Array.isArray(b.harga) ? b.harga.map((x, j) => (j === tierIndex ? nilai : x)) : nilai,
                          });
                        }}
                        className={inputCls}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <button type="button" onClick={() => hapusBaris(index)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={tambahBaris} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer">
        <Plus size={14} /> Tambah Baris Bahan
      </button>
    </div>
  );
}

/**
 * Tab "Pricelist" di Pengaturan WA Bot: teks tampilan per kategori + kalkulator
 * harga opsional per kategori, tambah/hapus kategori, unduh & impor CSV bahan.
 */
export default function PricelistWaBotPanel() {
  const [kategoriList, setKategoriList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState(null);
  const [draft, setDraft] = useState(null); // { teks, kalk }
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [formBaru, setFormBaru] = useState(null); // { label, teks, kalk }
  const [menambah, setMenambah] = useState(false);

  const pasangDraft = (k) => setDraft({ teks: k.teks, kalk: kalkulatorDariKategori(k) });

  const fetchList = async (selectSlug) => {
    setLoading(true);
    try {
      const res = await apiClient.get('/wa-pricelist/');
      const list = res.data?.kategori || [];
      setKategoriList(list);
      const target = list.find((k) => k.slug === (selectSlug || activeSlug)) || list[0];
      if (target) {
        setActiveSlug(target.slug);
        pasangDraft(target);
      } else {
        setActiveSlug(null);
        setDraft(null);
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
    pasangDraft(target);
    setMsg(null);
  };

  const simpan = async () => {
    if (!aktif) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await apiClient.patch(`/wa-pricelist/${aktif.slug}/`, { teks: draft.teks, kalkulator: draft.kalk });
      setKategoriList((list) => list.map((k) => (k.slug === aktif.slug ? res.data : k)));
      pasangDraft(res.data);
      setMsg({ type: 'success', text: `Pricelist kategori "${aktif.label}" tersimpan.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menyimpan pricelist.' });
    } finally {
      setSaving(false);
    }
  };

  const hapusKalkulator = async () => {
    const ok = await uiConfirm(
      `Hapus kalkulator harga kategori "${aktif.label}"? Bot tidak bisa lagi menghitung total otomatis untuk kategori ini. Perubahan berlaku setelah Simpan.`,
      { title: 'Hapus Kalkulator', confirmText: 'Hapus', danger: true },
    );
    if (ok) setDraft((d) => ({ ...d, kalk: null }));
  };

  const hapusKategori = async () => {
    if (!aktif) return;
    const ok = await uiConfirm(
      `Hapus kategori "${aktif.label}"${aktif.terstruktur ? ' beserta kalkulator harganya' : ''}? Bot tidak akan lagi mengenal kategori ini.`,
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

  const simpanKategoriBaru = async () => {
    if (!formBaru) return;
    setMenambah(true);
    setMsg(null);
    try {
      const res = await apiClient.post('/wa-pricelist/', { label: formBaru.label, teks: formBaru.teks, kalkulator: formBaru.kalk });
      setFormBaru(null);
      await fetchList(res.data.slug);
      setMsg({ type: 'success', text: `Kategori "${res.data.label}" ditambahkan.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Gagal menambah kategori.' });
    } finally {
      setMenambah(false);
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
      setKategoriList((list) => list.map((k) => (k.slug === aktif.slug ? res.data : k)));
      setDraft((d) => ({ ...d, kalk: kalkulatorDariKategori(res.data) }));
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

  // CSV hanya untuk kalkulator yang sudah tersimpan dengan tingkatan yang sama.
  const csvTersedia = aktif?.terstruktur && draft?.kalk
    && JSON.stringify(aktif.tiers || []) === JSON.stringify(draft.kalk.tiers) && aktif.mode === draft.kalk.mode;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h4 className="font-bold text-slate-800 text-base">Pricelist WA Bot</h4>
        <p className="text-xs text-slate-400">
          Sumber harga & info produk resmi yang dijawab bot WhatsApp. Kategori dengan kalkulator harga bisa dihitung
          totalnya otomatis oleh bot. Perubahan langsung dipakai bot, tanpa perlu restart.
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
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border
              ${activeSlug === k.slug
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {k.label}
            {k.terstruktur && <Calculator size={11} className="opacity-70" />}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setFormBaru({ label: '', teks: '', kalk: null }); setMsg(null); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <Plus size={13} /> Tambah Kategori
        </button>
      </div>
      <p className="text-[11px] text-slate-400 -mt-3 inline-flex items-center gap-1">
        <Calculator size={11} /> = kategori punya kalkulator harga.
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
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!!formBaru.kalk}
              onChange={(e) => setFormBaru((f) => ({ ...f, kalk: e.target.checked ? { ...KALKULATOR_BARU, bahan: [{ nama: '', harga: 0 }] } : null }))}
            />
            Tambahkan kalkulator harga (bot bisa menghitung total otomatis)
          </label>
          {formBaru.kalk && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <KalkulatorEditor kalk={formBaru.kalk} onChange={(kalk) => setFormBaru((f) => ({ ...f, kalk }))} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormBaru(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer">
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

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-bold text-slate-700">Kalkulator Harga</p>
                <p className="text-[11px] text-slate-400">
                  {draft.kalk ? 'Dipakai bot menghitung total otomatis.' : 'Kategori ini belum punya kalkulator; bot hanya mengirim teks di atas.'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {draft.kalk ? (
                  <>
                    {csvTersedia && (
                      <>
                        <button type="button" onClick={unduhTemplate} className={tombolCls}>
                          <Download size={13} /> Unduh CSV
                        </button>
                        <label className={tombolCls}>
                          <Upload size={13} /> {importing ? 'Mengimpor...' : 'Impor CSV'}
                          <input type="file" accept=".csv" className="hidden" onChange={importCsv} disabled={importing} />
                        </label>
                      </>
                    )}
                    <button type="button" onClick={hapusKalkulator} className={tombolCls}>
                      <Trash2 size={13} /> Hapus Kalkulator
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, kalk: { ...KALKULATOR_BARU, bahan: [{ nama: '', harga: 0 }] } }))}
                    className={tombolCls}
                  >
                    <Calculator size={13} /> Tambah Kalkulator Harga
                  </button>
                )}
              </div>
            </div>
            {draft.kalk && (
              <KalkulatorEditor key={activeSlug} kalk={draft.kalk} onChange={(kalk) => setDraft((d) => ({ ...d, kalk }))} />
            )}
          </div>

          <div className="flex justify-between items-center gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={hapusKategori}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <Trash2 size={15} /> Hapus Kategori
            </button>
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
