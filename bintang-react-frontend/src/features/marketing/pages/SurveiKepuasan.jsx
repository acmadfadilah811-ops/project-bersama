import { useCallback, useEffect, useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import apiClient from '../../../api/apiClient';

// Laporan survei kepuasan pelanggan dari struk online (2026-10-06).
// Pelanggan mengisi lewat tautan struk di resi/invoice WhatsApp.

const waktu = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Bintang({ nilai }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
      <Star size={14} className="fill-amber-400 text-amber-400" />
      {Number(nilai || 0).toFixed(2)}
    </span>
  );
}

function KelolaAspek() {
  const [aspek, setAspek] = useState([]);
  const [baru, setBaru] = useState('');
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    apiClient.get('/aspek-survei/').then((r) => setAspek(Array.isArray(r.data) ? r.data : r.data.results || []));
  }, []);
  useEffect(muat, [muat]);

  const jalankan = async (aksi) => {
    setGalat('');
    try {
      await aksi();
      muat();
    } catch (err) {
      const d = err.response?.data;
      setGalat(d?.error || d?.nama?.[0] || 'Gagal menyimpan aspek.');
    }
  };

  const tambah = () =>
    baru.trim() &&
    jalankan(async () => {
      await apiClient.post('/aspek-survei/', { nama: baru.trim(), urutan: aspek.length + 1, aktif: true });
      setBaru('');
    });

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-800">Aspek Penilaian</h3>
      <p className="text-xs text-slate-500 mt-0.5">Aspek aktif tampil di struk online. Aspek yang sudah dinilai tidak bisa dihapus, cukup dinonaktifkan.</p>
      <div className="mt-3 divide-y divide-slate-100">
        {aspek.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-sm">
            <span className={a.aktif ? 'text-slate-800' : 'text-slate-400 line-through'}>{a.nama}</span>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                className="text-slate-600 hover:text-slate-900 cursor-pointer"
                onClick={() => jalankan(() => apiClient.patch(`/aspek-survei/${a.id}/`, { aktif: !a.aktif }))}
              >
                {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                type="button"
                className="text-red-600 hover:text-red-700 cursor-pointer"
                onClick={() => window.confirm(`Hapus aspek "${a.nama}"?`) && jalankan(() => apiClient.delete(`/aspek-survei/${a.id}/`))}
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={baru}
          onChange={(e) => setBaru(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tambah()}
          placeholder="Aspek baru, mis. Kebersihan Toko"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button type="button" onClick={tambah} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white cursor-pointer">
          <Plus size={16} /> Tambah
        </button>
      </div>
      {galat && <p className="mt-2 text-xs text-red-600">{galat}</p>}
    </div>
  );
}

export default function SurveiKepuasan() {
  const { setSubtitle } = useTransaksiCrumb();
  const [mulai, setMulai] = useState('');
  const [selesai, setSelesai] = useState('');
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    setSubtitle('Survei Kepuasan Pelanggan');
  }, [setSubtitle]);

  useEffect(() => {
    setMemuat(true);
    apiClient
      .get('/survei-kepuasan/', { params: { mulai: mulai || undefined, selesai: selesai || undefined } })
      .then((r) => setData(r.data))
      .catch(() => setData({ jumlah: 0, rata_rata: 0, per_aspek: [], tanggapan: [] }))
      .finally(() => setMemuat(false));
  }, [mulai, selesai]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          Dari
          <input type="date" value={mulai} onChange={(e) => setMulai(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-xs text-slate-600">
          Sampai
          <input type="date" value={selesai} onChange={(e) => setSelesai(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        {memuat && <span className="pb-2 text-xs text-slate-400">Memuat...</span>}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
          <div className="flex items-baseline gap-6">
            <div>
              <p className="text-xs text-slate-500">Rata-rata keseluruhan</p>
              <p className="text-2xl font-bold text-slate-900">{Number(data?.rata_rata || 0).toFixed(2)} <span className="text-sm font-normal text-slate-500">/ 5</span></p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Jumlah tanggapan</p>
              <p className="text-2xl font-bold text-slate-900">{data?.jumlah || 0}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {(data?.per_aspek || []).map((a) => (
              <div key={a.aspek} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-slate-700">{a.aspek}</span>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-slate-700" style={{ width: `${(a.rata_rata / 5) * 100}%` }} />
                </div>
                <span className="w-12 text-right font-semibold text-slate-800">{a.rata_rata.toFixed(2)}</span>
              </div>
            ))}
            {data && !data.per_aspek.length && <p className="text-sm text-slate-500">Belum ada tanggapan pada periode ini.</p>}
          </div>
        </div>
        <KelolaAspek />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Transaksi</th>
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3">Rata-rata</th>
              <th className="px-4 py-3">Rincian</th>
              <th className="px-4 py-3">Catatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(data?.tanggapan || []).map((t) => (
              <tr key={t.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{waktu(t.waktu)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-semibold text-slate-800">{t.transaksi}</span>
                  <span className="ml-1 text-xs text-slate-400">{t.jenis === 'pos' ? 'Kasir' : 'Pesanan'}</span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {t.pelanggan || '-'}
                  {t.nomor_wa && <div className="text-xs text-slate-400">{t.nomor_wa}</div>}
                </td>
                <td className="px-4 py-3"><Bintang nilai={t.rata_rata} /></td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  {t.nilai.map((n) => <div key={n.aspek}>{n.aspek}: {n.nilai}</div>)}
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-xs">{t.catatan || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
