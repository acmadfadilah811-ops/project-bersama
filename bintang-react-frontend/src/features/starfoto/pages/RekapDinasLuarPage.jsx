import { useCallback, useEffect, useState } from 'react';
import { Navigation, RefreshCw } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import { todayISO } from '../../../utils/date';
import KartuDinas from '../components/KartuDinas';
import { formatRupiah } from '../hooks/useStarfoto';

// Rekap dinas luar staff (2026-10-11). Server membatasi data per peran:
// owner/manager/admin semua, SPV/Kordiv bawahannya, staff miliknya sendiri.

function geserHari(iso, hari) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + hari);
  return d.toLocaleDateString('sv-SE');
}

export default function RekapDinasLuarPage() {
  const [dari, setDari] = useState(geserHari(todayISO(), -6));
  const [sampai, setSampai] = useState(todayISO());
  const [data, setData] = useState([]);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await apiClient.get('/starfoto/dinas-luar/', { params: { dari, sampai } });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat rekap dinas luar.');
    } finally {
      setMemuat(false);
    }
  }, [dari, sampai]);

  useEffect(() => { muat(); }, [muat]);

  const totalTransport = data.reduce((s, d) => s + Number(d.uang_transport || 0), 0);
  const berjalan = data.filter((d) => d.status === 'berjalan').length;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Navigation size={20} /> Dinas Luar</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5" />
          <span className="text-slate-400">-</span>
          <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5" />
          <button type="button" onClick={muat} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Muat ulang">
            <RefreshCw size={16} className={memuat ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[['Catatan dinas', data.length], ['Masih berjalan', berjalan], ['Uang transport', formatRupiah(totalTransport)]].map(([label, nilai]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">{nilai}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((d) => <KartuDinas key={d.id} d={d} />)}
      </div>
      {!memuat && !data.length && <p className="py-10 text-center text-sm text-slate-400">Belum ada dinas luar pada periode ini.</p>}
    </div>
  );
}
