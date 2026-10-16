import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search, ClipboardCheck, Hourglass, AlertTriangle, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import UnitBisnisFilter from '../../../components/UnitBisnisFilter';
import { UNIT_SEMUA } from '../../../utils/unitBisnis';

// Laporan Kerja (2026-10-17): ringkasan SPK selesai per periode, dikelompokkan per
// unit bisnis. Tiga tampilan: Per Divisi, Per Karyawan, Daftar SPK. Absensi dikelola
// di HR sehingga tidak lagi ditampilkan di sini.

const PERIODE = [
  ['hari_ini', 'Hari Ini'],
  ['tujuh_hari', '7 Hari'],
  ['bulan_ini', 'Bulan Ini'],
  ['bulan_lalu', 'Bulan Lalu'],
  ['semua', 'Semua'],
];
const TAB = [
  ['divisi', 'Per Divisi'],
  ['karyawan', 'Per Karyawan'],
  ['spk', 'Daftar SPK'],
];
const STATUS_SPK = {
  selesai: ['Selesai', 'bg-emerald-500'],
  dikerjakan: ['Dikerjakan', 'bg-blue-500'],
  antrean: ['Antrean', 'bg-slate-400'],
  kendala: ['Kendala', 'bg-amber-500'],
  gagal: ['Gagal', 'bg-rose-500'],
  batal: ['Batal', 'bg-rose-500'],
};
const ROLE_LABEL = { staff: 'Staff', kordiv: 'Kordiv' };
const HALAMAN = 20;

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

function durasi(menit) {
  const m = Number(menit) || 0;
  if (m <= 0) return '-';
  if (m < 60) return `${Math.round(m)} mnt`;
  return `${Math.floor(m / 60)} j ${Math.round(m % 60)} mnt`;
}

function Kartu({ ikon: Ikon, label, nilai, catatan }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Ikon size={14} /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{nilai}</p>
      {catatan && <p className="mt-0.5 text-xs text-slate-400">{catatan}</p>}
    </div>
  );
}

function Segmen({ pilihan, nilai, onUbah }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
      {pilihan.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onUbah(id)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            nilai === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Kosong({ teks }) {
  return <p className="px-4 py-12 text-center text-sm text-slate-400">{teks}</p>;
}

export default function Reports() {
  const [range, setRange] = useState('bulan_ini');
  const [unit, setUnit] = useState(UNIT_SEMUA);
  const [tab, setTab] = useState('divisi');
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(1);
  const [staff, setStaff] = useState([]);
  const [spk, setSpk] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [mengunduh, setMengunduh] = useState('');

  const muat = useCallback(() => {
    setMemuat(true);
    setGalat('');
    apiClient
      .get('/reports/staff-performance/', { params: { range, ...(unit ? { unit_bisnis: unit } : {}) } })
      .then((res) => {
        setStaff(res.data.data || []);
        setSpk(res.data.detailed_jobs || []);
      })
      .catch(() => setGalat('Gagal memuat laporan. Coba muat ulang halaman.'))
      .finally(() => setMemuat(false));
  }, [range, unit]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { setHalaman(1); }, [cari, tab, range, unit]);

  const unduh = (tipe = 'global', nilai = '', kunci = 'global') => {
    if (mengunduh) return;
    setMengunduh(kunci);
    const params = { range, type: tipe, ...(unit ? { unit_bisnis: unit } : {}) };
    if (tipe === 'divisi') params.divisi = nilai;
    if (tipe === 'staff') params.staff_id = nilai;
    apiClient
      .get('/export/staff-performance/', { params, responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement('a');
        a.href = url;
        a.download = `laporan-kerja-${tipe}-${range}-${new Date().toLocaleDateString('sv-SE')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert('Gagal mengunduh file Excel.'))
      .finally(() => setMengunduh(''));
  };

  const ringkasan = useMemo(() => {
    const jumlah = (kunci) => staff.reduce((s, r) => s + (r[kunci] || 0), 0);
    return {
      selesai: jumlah('jobs_completed'),
      berjalan: jumlah('jobs_in_progress') + jumlah('jobs_pending'),
      masalah: jumlah('jobs_constraint') + jumlah('jobs_failed'),
      insentif: jumlah('total_insentif'),
    };
  }, [staff]);

  const perDivisi = useMemo(() => {
    const peta = {};
    spk.forEach((j) => {
      const kunci = `${j.divisi}|${j.unit_bisnis ?? ''}`;
      if (!peta[kunci]) {
        peta[kunci] = { nama: j.divisi, unit: j.unit_bisnis_nama, selesai: 0, gagal: 0, menit: 0, insentif: 0 };
      }
      const d = peta[kunci];
      if (j.status === 'selesai') {
        d.selesai += 1;
        d.menit += j.durasi_menit || 0;
        d.insentif += j.insentif || 0;
      } else if (j.status === 'gagal' || j.status === 'batal') {
        d.gagal += 1;
      }
    });
    return Object.values(peta)
      .map((d) => ({ ...d, rata: d.selesai ? d.menit / d.selesai : 0 }))
      .sort((a, b) => b.selesai - a.selesai);
  }, [spk]);

  const kata = cari.trim().toLowerCase();
  const karyawan = useMemo(
    () => staff
      .filter((s) => !kata || [s.nama_lengkap, s.username, s.divisi, s.jabatan].some((v) => String(v || '').toLowerCase().includes(kata)))
      .sort((a, b) => b.jobs_completed - a.jobs_completed),
    [staff, kata],
  );
  const daftarSpk = useMemo(
    () => spk.filter((j) => !kata || [j.id, j.order_id, j.order_nama, j.jenis_produk, j.pic_fullname, j.divisi]
      .some((v) => String(v ?? '').toLowerCase().includes(kata))),
    [spk, kata],
  );
  const jumlahHalaman = Math.max(1, Math.ceil(daftarSpk.length / HALAMAN));
  const spkHalaman = daftarSpk.slice((halaman - 1) * HALAMAN, halaman * HALAMAN);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Laporan Kerja</h1>
          <p className="mt-0.5 text-sm text-slate-500">SPK yang diselesaikan karyawan, per unit bisnis dan divisi.</p>
        </div>
        <button
          type="button"
          onClick={() => unduh('global', '', 'global')}
          disabled={Boolean(mengunduh)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Download size={15} /> {mengunduh === 'global' ? 'Menyiapkan…' : 'Unduh Excel'}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UnitBisnisFilter value={unit} onChange={setUnit} labelTanpaUnit="Tanpa unit" />
        <Segmen pilihan={PERIODE} nilai={range} onUbah={setRange} />
      </div>

      {galat && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{galat}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kartu ikon={ClipboardCheck} label="SPK selesai" nilai={ringkasan.selesai} />
        <Kartu ikon={Hourglass} label="Sedang berjalan" nilai={ringkasan.berjalan} catatan="dikerjakan + antrean" />
        <Kartu ikon={AlertTriangle} label="Kendala / gagal" nilai={ringkasan.masalah} />
        <Kartu ikon={Coins} label="Total insentif" nilai={rupiah(ringkasan.insentif)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-3">
          <Segmen pilihan={TAB} nilai={tab} onUbah={setTab} />
          {tab !== 'divisi' && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder={tab === 'karyawan' ? 'Cari karyawan atau divisi…' : 'Cari SPK, pelanggan, produk…'}
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
              />
            </div>
          )}
        </div>

        {memuat ? (
          <Kosong teks="Memuat laporan…" />
        ) : (
          <div className="overflow-x-auto">
            {tab === 'divisi' && (
              perDivisi.length === 0 ? <Kosong teks="Belum ada SPK selesai pada periode ini." /> : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Divisi</th>
                      <th className="px-4 py-3 text-right">Selesai</th>
                      <th className="px-4 py-3 text-right">Gagal</th>
                      <th className="px-4 py-3 text-right">Rata-rata</th>
                      <th className="px-4 py-3 text-right">Insentif</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {perDivisi.map((d) => (
                      <tr key={`${d.nama}-${d.unit}`} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{d.nama}</p>
                          <p className="text-xs text-slate-400">{d.unit || 'Semua unit'}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{d.selesai}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{d.gagal || '-'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{durasi(d.rata)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-800">{rupiah(d.insentif)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => unduh('divisi', d.nama, `div-${d.nama}`)}
                            disabled={Boolean(mengunduh)}
                            title="Unduh Excel divisi ini"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {tab === 'karyawan' && (
              karyawan.length === 0 ? <Kosong teks="Tidak ada karyawan yang cocok." /> : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Karyawan</th>
                      <th className="px-4 py-3">Divisi</th>
                      <th className="px-4 py-3 text-right">Selesai</th>
                      <th className="px-4 py-3 text-right">Berjalan</th>
                      <th className="px-4 py-3 text-right">Kendala</th>
                      <th className="px-4 py-3 text-right">Rata-rata</th>
                      <th className="px-4 py-3 text-right">Insentif</th>
                      <th className="w-12 px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {karyawan.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{s.nama_lengkap}</p>
                          <p className="text-xs text-slate-400">{s.jabatan || ROLE_LABEL[s.role] || s.role}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-700">{s.divisi}</p>
                          <p className="text-xs text-slate-400">{s.unit_bisnis_nama || 'Tanpa unit'}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{s.jobs_completed}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{(s.jobs_in_progress + s.jobs_pending) || '-'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{(s.jobs_constraint + s.jobs_failed) || '-'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-500">{durasi(s.avg_duration_minutes)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-800">{rupiah(s.total_insentif)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => unduh('staff', s.id, `stf-${s.id}`)}
                            disabled={Boolean(mengunduh)}
                            title="Unduh Excel karyawan ini"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {tab === 'spk' && (
              daftarSpk.length === 0 ? <Kosong teks="Tidak ada SPK yang cocok." /> : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Selesai</th>
                      <th className="px-4 py-3">Pesanan</th>
                      <th className="px-4 py-3">Produk</th>
                      <th className="px-4 py-3">Divisi</th>
                      <th className="px-4 py-3">Karyawan</th>
                      <th className="px-4 py-3 text-right">Durasi</th>
                      <th className="px-4 py-3 text-right">Insentif</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {spkHalaman.map((j) => {
                      const [labelStatus, warna] = STATUS_SPK[j.status] || [j.status, 'bg-slate-400'];
                      return (
                        <tr key={j.id} className="hover:bg-slate-50/60">
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">{j.waktu_selesai}</td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{j.order_nama}</p>
                            <p className="text-xs text-slate-400">{j.order_id}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{j.jenis_produk} <span className="text-slate-400">×{j.qty}</span></td>
                          <td className="px-4 py-3">
                            <p className="text-slate-700">{j.divisi}</p>
                            <p className="text-xs text-slate-400">{j.unit_bisnis_nama || '-'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{j.pic_fullname}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-500">{durasi(j.durasi_menit)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-slate-800">{rupiah(j.insentif)}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                              <span className={`h-1.5 w-1.5 rounded-full ${warna}`} /> {labelStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}

        {!memuat && tab === 'spk' && daftarSpk.length > HALAMAN && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            <span>{daftarSpk.length} SPK</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHalaman((p) => Math.max(1, p - 1))}
                disabled={halaman === 1}
                className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-30"
                aria-label="Halaman sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="tabular-nums">{halaman} / {jumlahHalaman}</span>
              <button
                type="button"
                onClick={() => setHalaman((p) => Math.min(jumlahHalaman, p + 1))}
                disabled={halaman === jumlahHalaman}
                className="rounded-md p-1.5 hover:bg-slate-100 disabled:opacity-30"
                aria-label="Halaman berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
