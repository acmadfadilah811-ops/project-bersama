import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import DetailTutupBuku from '../components/DetailTutupBuku';
import useAccountingPeriods from '../hooks/useAccountingPeriods';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export default function TutupBukuTokoPusatCabang() {
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const { periods, loading } = useAccountingPeriods(fiscalYear);
  const sortedPeriods = useMemo(() => [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date)), [periods]);

  if (selectedPeriod) return <DetailTutupBuku period={selectedPeriod} onBack={() => setSelectedPeriod(null)} />;

  return (
    <div className="space-y-4 pb-12 text-xs text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div><h1 className="text-base font-bold text-slate-900">Tutup Buku Semua Bulan</h1><p className="mt-1 text-slate-500">Riwayat periode akuntansi per bulan.</p></div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
          <button type="button" onClick={() => setFiscalYear((year) => year - 1)} className="rounded p-1.5 hover:bg-slate-100" aria-label="Tahun sebelumnya"><ChevronLeft size={16} /></button>
          <span className="min-w-14 text-center font-bold text-slate-900">{fiscalYear}</span>
          <button type="button" onClick={() => setFiscalYear((year) => year + 1)} className="rounded p-1.5 hover:bg-slate-100" aria-label="Tahun berikutnya"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-400"><Loader2 className="animate-spin text-[#0088E8]" size={28} />Memuat periode...</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-500"><tr><th className="px-4 py-3">Tahun</th><th className="px-4 py-3">Bulan</th><th className="px-4 py-3">Periode</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{sortedPeriods.length === 0 ? <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-400">Belum ada data periode untuk tahun ini.</td></tr> : sortedPeriods.map((period) => {
              const month = Number(period.start_date.slice(5, 7)) - 1;
              return <tr key={period.id} className="hover:bg-slate-50"><td className="px-4 py-3">{period.fiscal_year}</td><td className="px-4 py-3 font-semibold text-slate-900">{MONTH_NAMES[month] || '-'}</td><td className="px-4 py-3">{formatDate(period.start_date)} s/d {formatDate(period.end_date)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${period.status === 'closed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{period.status === 'closed' ? 'Ditutup' : 'Terbuka'}</span></td><td className="px-4 py-3 text-center"><button type="button" onClick={() => setSelectedPeriod(period)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-bold text-[#0088E8] hover:bg-blue-50"><Eye size={14} />Detail</button></td></tr>;
            })}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
