import { AlertTriangle, ClipboardCheck, RefreshCw, Users } from 'lucide-react';
import useLaporanPimpinan from '../hooks/useLaporanPimpinan';

// Tab "SPV & Kordiv" di Laporan Kerja (HR & Kepegawaian): ringkasan divisi tiap
// Supervisor/Kordiv -- angkanya sama dengan Laporan Produksi di dashboard mereka.

const KATEGORI = [
  ['semua', 'Semua'],
  ['spv', 'Supervisor'],
  ['kordiv', 'Kordiv'],
];
const PERIODE = [
  ['hari_ini', 'Hari Ini'],
  ['tujuh_hari', '7 Hari'],
  ['bulan_ini', 'Bulan Ini'],
  ['bulan_lalu', 'Bulan Lalu'],
];
const LABEL_ROLE = { spv: 'Supervisor', kordiv: 'Kordiv' };
const WARNA_ROLE = { spv: 'bg-indigo-50 text-indigo-700', kordiv: 'bg-emerald-50 text-emerald-700' };

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

function Angka({ nilai, label, warna }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${warna}`}>
      <p className="text-lg font-bold tabular-nums">{nilai}</p>
      <p className="text-[10px] font-semibold uppercase">{label}</p>
    </div>
  );
}

function KartuPimpinan({ p }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{p.nama}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
            <Users size={12} /> {p.divisi_nama ? `${p.divisi_nama} · ` : ''}{p.jumlah_anggota_tim} anggota tim
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${WARNA_ROLE[p.role] || 'bg-slate-100 text-slate-600'}`}>
          {LABEL_ROLE[p.role] || p.role}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Angka nilai={p.jumlah_selesai} label="Selesai" warna="bg-emerald-50 text-emerald-700" />
        <Angka nilai={p.jumlah_gagal_batal} label="Gagal/Batal" warna="bg-rose-50 text-rose-700" />
        <Angka nilai={p.jumlah_kendala_aktif} label="Kendala aktif" warna="bg-amber-50 text-amber-700" />
      </div>
      {p.per_divisi.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {p.per_divisi.map((d) => (
            <li key={d.divisi_id ?? 'none'} className="flex justify-between">
              <span>{d.divisi_nama}</span>
              <span className="font-semibold tabular-nums text-slate-800">{d.jumlah_selesai} selesai</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-slate-400">{p.jumlah_laporan_tertulis} laporan tertulis pada periode ini</p>
    </div>
  );
}

export default function LaporanPimpinanTab() {
  const { kategori, setKategori, periode, setPeriode, pimpinan, laporan, memuat, galat, muat } = useLaporanPimpinan();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmen pilihan={KATEGORI} nilai={kategori} onUbah={setKategori} />
        <div className="flex items-center gap-2">
          <Segmen pilihan={PERIODE} nilai={periode} onUbah={setPeriode} />
          <button type="button" onClick={muat} title="Segarkan" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {galat && <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{galat}</div>}

      {memuat ? (
        <p className="px-4 py-12 text-center text-sm text-slate-400">Memuat laporan…</p>
      ) : pimpinan.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-slate-400">Belum ada akun aktif pada kategori ini.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pimpinan.map((p) => <KartuPimpinan key={p.user_id} p={p} />)}
          </div>
          <p className="text-[11px] text-slate-400">
            Cakupan Supervisor mencakup tim Kordiv di bawahnya, jadi angka antar kartu bisa tumpang tindih — jangan dijumlahkan.
          </p>
        </>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <ClipboardCheck size={15} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800">Laporan target &amp; kendala tertulis</h2>
        </div>
        {laporan.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Belum ada laporan tertulis pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Dibuat oleh</th>
                  <th className="px-4 py-3">Divisi</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Aktual</th>
                  <th className="px-4 py-3 text-right">Capaian</th>
                  <th className="px-4 py-3">Kendala</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {laporan.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${WARNA_ROLE[r.dibuat_oleh_role] || 'bg-slate-100 text-slate-600'}`}>
                        {LABEL_ROLE[r.dibuat_oleh_role] || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.dibuat_oleh_nama || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.divisi_nama}</td>
                    <td className="px-4 py-3 text-slate-600">{r.tanggal_mulai} s/d {r.tanggal_selesai}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.target_selesai}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.jumlah_selesai_aktual}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.capaian_persen === null ? '-' : `${r.capaian_persen}%`}</td>
                    <td className="max-w-[260px] px-4 py-3 text-slate-600">
                      {r.kendala_operasional ? (
                        <span className="inline-flex items-start gap-1">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                          {r.kendala_operasional}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
