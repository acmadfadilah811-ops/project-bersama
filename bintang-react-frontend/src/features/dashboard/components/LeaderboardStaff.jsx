import { useEffect, useState } from 'react';
import { Crown, Medal, Trophy } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import UnitBisnisFilter from '../../../components/UnitBisnisFilter';
import { UNIT_SEMUA } from '../../../utils/unitBisnis';

// Leaderboard staff & kordiv aktif menurut SPK selesai per periode dan unit bisnis
// (2026-10-15). Data dari GET /dashboard/leaderboard/.

const PERIODE = [
  ['bulan_ini', 'Bulan ini'],
  ['bulan_lalu', 'Bulan lalu'],
  ['semua', 'Semua'],
];
const ROLE_LABEL = { staff: 'Staff', kordiv: 'Kordiv' };

const formatRupiah = (angka) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(angka) || 0);

function Podium({ s, peringkat }) {
  const besar = peringkat === 1;
  return (
    <div className={`flex flex-col items-center ${besar ? 'w-28' : 'w-24'}`}>
      <div className="relative">
        <div className={`${besar ? 'h-12 w-12 border-amber-400' : 'h-10 w-10 border-slate-300'} flex items-center justify-center rounded-full border-2 bg-slate-50 text-xs font-bold uppercase text-slate-600`}>
          {s.nama.charAt(0)}
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-200 text-[8.5px] font-black text-slate-800">
          {peringkat}
        </span>
      </div>
      <span className="mt-1.5 w-full truncate text-center text-[9.5px] font-bold text-slate-700">{s.nama}</span>
      <span className="mt-0.5 text-[8px] font-extrabold uppercase text-slate-400">{s.jumlah_job_selesai} SPK</span>
    </div>
  );
}

export default function LeaderboardStaff() {
  const [periode, setPeriode] = useState('bulan_ini');
  const [unit, setUnit] = useState(UNIT_SEMUA);
  const [hasil, setHasil] = useState([]);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    let aktif = true;
    setMemuat(true);
    apiClient
      .get('/dashboard/leaderboard/', { params: { periode, ...(unit ? { unit_bisnis: unit } : {}) } })
      .then((res) => { if (aktif) setHasil(res.data?.hasil || []); })
      .catch(() => { if (aktif) setHasil([]); })
      .finally(() => { if (aktif) setMemuat(false); });
    return () => { aktif = false; };
  }, [periode, unit]);

  const ikon = [
    <Trophy key={0} size={12} className="text-amber-500" />,
    <Medal key={1} size={12} className="text-slate-400" />,
    <Medal key={2} size={12} className="text-orange-400" />,
  ];

  return (
    <div className="flex w-full flex-col rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-50 pb-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
            <Crown size={14} className="text-amber-500" /> Leaderboard Staff
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400">Staff & kordiv aktif, diurutkan menurut SPK selesai.</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {PERIODE.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriode(id)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${periode === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <UnitBisnisFilter value={unit} onChange={setUnit} className="pt-3" />

      {hasil.length > 0 && (
        <div className="flex items-end justify-center gap-5 border-b border-slate-50 py-4">
          {hasil[1] && <Podium s={hasil[1]} peringkat={2} />}
          {hasil[0] && <Podium s={hasil[0]} peringkat={1} />}
          {hasil[2] && <Podium s={hasil[2]} peringkat={3} />}
        </div>
      )}

      <div className="grid grid-cols-12 border-b border-slate-100 bg-slate-50 px-5 py-2 text-[8.5px] font-black uppercase tracking-widest text-slate-400">
        <div className="col-span-1">#</div>
        <div className="col-span-4">Nama</div>
        <div className="col-span-3">Jabatan · Unit</div>
        <div className="col-span-2 text-center">SPK Selesai</div>
        <div className="col-span-2 text-right">Insentif</div>
      </div>
      <div className="max-h-[300px] divide-y divide-slate-50 overflow-y-auto">
        {hasil.map((s, i) => (
          <div key={s.id} className="grid grid-cols-12 items-center px-5 py-2.5 text-[10.5px] hover:bg-slate-50/50">
            <div className="col-span-1 flex items-center">{ikon[i] || <span className="text-[9px] font-black text-slate-400">{i + 1}</span>}</div>
            <div className="col-span-4 truncate font-bold text-slate-800">{s.nama}</div>
            <div className="col-span-3 min-w-0">
              <p className="truncate text-[10px] font-semibold text-slate-600">{s.jabatan || ROLE_LABEL[s.role] || s.role}</p>
              <p className="truncate text-[9px] text-slate-400">{ROLE_LABEL[s.role] || s.role}{s.unit_bisnis_nama ? ` · ${s.unit_bisnis_nama}` : ''}</p>
            </div>
            <div className="col-span-2 text-center font-black text-slate-700">{s.jumlah_job_selesai}</div>
            <div className="col-span-2 text-right font-black text-slate-700">{formatRupiah(s.total_insentif)}</div>
          </div>
        ))}
        {!memuat && hasil.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">Belum ada SPK selesai pada periode ini.</div>
        )}
        {memuat && hasil.length === 0 && <div className="py-8 text-center text-xs text-slate-400">Memuat...</div>}
      </div>
    </div>
  );
}
