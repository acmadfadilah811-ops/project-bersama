import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { uiConfirm } from '../../../utils/dialog';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { formatRupiah, usePaketFoto, usePengaturanStarfoto } from '../hooks/useStarfoto';

// Pengaturan StarFoto (2026-10-11, Owner/Manager): aturan DP, durasi & studio,
// tahap produksi, serta master Paket Foto (melengkapi produk jasa StarFoto).

const TAHAP = [
  ['tahap_sesi_id', 'Tahap Sesi Foto (fotografer)'],
  ['tahap_asisten_id', 'Tahap Asisten Foto'],
  ['tahap_edit_id', 'Tahap Edit (editor)'],
  ['tahap_cetak_id', 'Tahap Cetak (operator)'],
];
const PAKET_KOSONG = {
  id: null, product: '', kuota_orang: 1, addon_tambah_orang: '', jumlah_edit: 0, jumlah_sesi: 1,
  durasi_menit: '', lokasi: 'studio', dp_minimal_persen: '', isi_paket: '',
};
const kelasInput = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

function Kolom({ label, children, bantuan }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      {children}
      {bantuan && <span className="block text-[11px] text-slate-400">{bantuan}</span>}
    </label>
  );
}

export default function PengaturanStarfotoPage() {
  const { setSubtitle } = useTransaksiCrumb();
  const { pengaturan, muatUlang } = usePengaturanStarfoto();
  const { paket, muatUlang: muatPaket } = usePaketFoto();
  const [atur, setAtur] = useState(null);
  const [tahapList, setTahapList] = useState([]);
  const [produkJasa, setProdukJasa] = useState([]);
  const [addons, setAddons] = useState([]);
  const [form, setForm] = useState(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => { setSubtitle('StarFoto'); }, [setSubtitle]);
  useEffect(() => { if (pengaturan) setAtur(pengaturan); }, [pengaturan]);
  useEffect(() => {
    (async () => {
      try {
        const [tahap, produk, addon] = await Promise.all([
          fetchAllPages('/tahap-proses/'), fetchAllPages('/products/'), fetchAllPages('/addons/'),
        ]);
        setTahapList(tahap);
        setProdukJasa(produk.filter((p) => p.lacak_inventori === false));
        setAddons(addon);
      } catch (err) {
        notifyApiError(err, 'Gagal memuat data master.');
      }
    })();
  }, []);

  const simpanPengaturan = async () => {
    setMenyimpan(true);
    try {
      const payload = {};
      ['dp_minimal_persen', 'durasi_default_menit', 'jumlah_studio', 'kantong_terakhir', 'dinas_luar_non_sesi', 'uang_transport', ...TAHAP.map(([k]) => k)]
        .forEach((k) => { payload[k] = atur[k] ?? ''; });
      await apiClient.patch('/starfoto/pengaturan/', payload);
      notifySuccess('Tersimpan', 'Pengaturan StarFoto disimpan.');
      muatUlang();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan pengaturan StarFoto.');
    } finally {
      setMenyimpan(false);
    }
  };

  const simpanPaket = async () => {
    setMenyimpan(true);
    try {
      const payload = {
        ...form,
        addon_tambah_orang: form.addon_tambah_orang || null,
        durasi_menit: form.durasi_menit === '' ? null : Number(form.durasi_menit),
        dp_minimal_persen: form.dp_minimal_persen === '' ? null : form.dp_minimal_persen,
      };
      delete payload.id;
      if (form.id) await apiClient.patch(`/starfoto/paket/${form.id}/`, payload);
      else await apiClient.post('/starfoto/paket/', payload);
      notifySuccess('Tersimpan', 'Paket foto disimpan.');
      setForm(null);
      muatPaket();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan paket foto.');
    } finally {
      setMenyimpan(false);
    }
  };

  const hapusPaket = async (p) => {
    if (!(await uiConfirm(`Lepas "${p.nama}" dari daftar paket foto? Produknya tetap ada di katalog.`))) return;
    try {
      await apiClient.delete(`/starfoto/paket/${p.id}/`);
      muatPaket();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus paket foto.');
    }
  };

  const ubah = (k, v) => setAtur((prev) => ({ ...prev, [k]: v }));
  const ubahForm = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const sudahPaket = new Set(paket.map((p) => p.product));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Pengaturan StarFoto</h1>
        <p className="mt-1 max-w-2xl text-xs text-slate-500">
          Aturan pesanan sesi foto di kasir StarFoto. Insentif fotografer/asisten per sesi diatur di Jenis Insentif
          (divisi tahap Sesi & Asisten Foto).
        </p>
      </div>

      {atur && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Kolom label="DP minimal (%)" bantuan="Bisa diganti per paket.">
              <input type="number" min={0} max={100} value={atur.dp_minimal_persen} onChange={(e) => ubah('dp_minimal_persen', e.target.value)} className={kelasInput} />
            </Kolom>
            <Kolom label="Durasi sesi bawaan (menit)" bantuan="Untuk paket tanpa durasi.">
              <input type="number" min={1} value={atur.durasi_default_menit} onChange={(e) => ubah('durasi_default_menit', e.target.value)} className={kelasInput} />
            </Kolom>
            <Kolom label="Jumlah studio" bantuan="Sesi studio yang boleh bersamaan.">
              <input type="number" min={1} value={atur.jumlah_studio} onChange={(e) => ubah('jumlah_studio', e.target.value)} className={kelasInput} />
            </Kolom>
          </div>
          <Kolom label="No. kantong terakhir" bantuan={`Pesanan foto berikutnya otomatis memakai ${atur.kantong_berikutnya || 'nomor ini + 1'}. Isi nomor amplop terakhir yang sudah terpakai.`}>
            <input value={atur.kantong_terakhir || ''} onChange={(e) => ubah('kantong_terakhir', e.target.value.replace(/\D/g, ''))} placeholder="mis. 018594" className={`${kelasInput} max-w-xs`} />
          </Kolom>
          <div className="grid gap-4 sm:grid-cols-2">
            {TAHAP.map(([kunci, label]) => (
              <Kolom key={kunci} label={label}>
                <select value={atur[kunci] || ''} onChange={(e) => ubah(kunci, e.target.value)} className={kelasInput}>
                  <option value="">— Belum dipilih —</option>
                  {tahapList.map((t) => <option key={t.id} value={t.id}>{t.nama} ({t.divisi_nama || t.divisi})</option>)}
                </select>
              </Kolom>
            ))}
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(atur.dinas_luar_non_sesi)} onChange={(e) => ubah('dinas_luar_non_sesi', e.target.checked)} />
              Dinas luar non-sesi (opsional)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(atur.uang_transport)} onChange={(e) => ubah('uang_transport', e.target.checked)} />
              Uang transport staff (opsional)
            </label>
          </div>
          <button type="button" onClick={simpanPengaturan} disabled={menyimpan} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            <Save size={16} /> Simpan Pengaturan
          </button>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">Paket Foto</h2>
          <button type="button" onClick={() => setForm({ ...PAKET_KOSONG })} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white">
            <Plus size={14} /> Tambah Paket
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Paket = produk jasa (stok tidak dilacak) di Katalog Produk. Di sini dilengkapi kuota orang, jatah edit, sesi, dan durasi.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Paket</th><th className="px-3 py-2">Harga</th><th className="px-3 py-2">Kuota</th>
                <th className="px-3 py-2">Tambah orang</th><th className="px-3 py-2">Edit</th><th className="px-3 py-2">Sesi</th>
                <th className="px-3 py-2">Durasi</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paket.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-semibold text-slate-800">{p.nama}</td>
                  <td className="px-3 py-2">{formatRupiah(p.harga)}</td>
                  <td className="px-3 py-2">{p.kuota_orang} orang</td>
                  <td className="px-3 py-2">{p.addon_tambah_orang_nama ? `${p.addon_tambah_orang_nama} (${formatRupiah(p.addon_tambah_orang_harga)})` : '-'}</td>
                  <td className="px-3 py-2">{p.jumlah_edit}</td>
                  <td className="px-3 py-2">{p.jumlah_sesi}</td>
                  <td className="px-3 py-2">{p.durasi_menit ? `${p.durasi_menit} mnt` : 'bawaan'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button type="button" onClick={() => setForm({ ...PAKET_KOSONG, ...p, addon_tambah_orang: p.addon_tambah_orang || '', durasi_menit: p.durasi_menit ?? '', dp_minimal_persen: p.dp_minimal_persen ?? '' })} className="p-1 text-slate-500 hover:text-slate-800" aria-label="Ubah"><Pencil size={15} /></button>
                    <button type="button" onClick={() => hapusPaket(p)} className="p-1 text-slate-500 hover:text-rose-600" aria-label="Hapus"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!paket.length && <p className="py-8 text-center text-sm text-slate-400">Belum ada paket foto.</p>}
        </div>
      </section>

      {form && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">{form.id ? 'Ubah' : 'Tambah'} Paket Foto</h3>
              <button type="button" onClick={() => setForm(null)} className="p-1 text-slate-400"><X size={18} /></button>
            </div>
            <Kolom label="Produk jasa" bantuan="Buat dulu produknya di Katalog Produk (jasa, unit StarFoto).">
              <select value={form.product} disabled={Boolean(form.id)} onChange={(e) => ubahForm('product', e.target.value)} className={kelasInput}>
                <option value="">Pilih produk</option>
                {produkJasa.filter((p) => !sudahPaket.has(p.id) || String(p.id) === String(form.product)).map((p) => (
                  <option key={p.id} value={p.id}>{p.nama} — {formatRupiah(p.harga_jual_toko)}</option>
                ))}
              </select>
            </Kolom>
            <div className="grid grid-cols-3 gap-3">
              <Kolom label="Kuota orang"><input type="number" min={1} value={form.kuota_orang} onChange={(e) => ubahForm('kuota_orang', e.target.value)} className={kelasInput} /></Kolom>
              <Kolom label="Jatah edit"><input type="number" min={0} value={form.jumlah_edit} onChange={(e) => ubahForm('jumlah_edit', e.target.value)} className={kelasInput} /></Kolom>
              <Kolom label="Jumlah sesi"><input type="number" min={1} value={form.jumlah_sesi} onChange={(e) => ubahForm('jumlah_sesi', e.target.value)} className={kelasInput} /></Kolom>
            </div>
            <Kolom label="Addon tambah orang" bantuan="Harga per orang di atas kuota.">
              <select value={form.addon_tambah_orang} onChange={(e) => ubahForm('addon_tambah_orang', e.target.value)} className={kelasInput}>
                <option value="">— Tidak ada —</option>
                {addons.map((a) => <option key={a.id} value={a.id}>{a.nama} — {formatRupiah(a.harga)}</option>)}
              </select>
            </Kolom>
            <div className="grid grid-cols-3 gap-3">
              <Kolom label="Durasi (menit)"><input type="number" min={1} value={form.durasi_menit} placeholder="bawaan" onChange={(e) => ubahForm('durasi_menit', e.target.value)} className={kelasInput} /></Kolom>
              <Kolom label="Lokasi">
                <select value={form.lokasi} onChange={(e) => ubahForm('lokasi', e.target.value)} className={kelasInput}>
                  <option value="studio">Studio</option><option value="outdoor">Outdoor</option><option value="studio_outdoor">Studio & Outdoor</option>
                </select>
              </Kolom>
              <Kolom label="DP min (%)"><input type="number" min={0} max={100} value={form.dp_minimal_persen} placeholder="bawaan" onChange={(e) => ubahForm('dp_minimal_persen', e.target.value)} className={kelasInput} /></Kolom>
            </div>
            <Kolom label="Isi paket"><textarea rows={3} value={form.isi_paket} onChange={(e) => ubahForm('isi_paket', e.target.value)} className={kelasInput} placeholder="1 tema 1 kostum, 3 penataan, 1 file edit, 1 lbr cetak 8RP" /></Kolom>
            <button type="button" onClick={simpanPaket} disabled={menyimpan || !form.product} className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {menyimpan ? 'Menyimpan...' : 'Simpan Paket'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
