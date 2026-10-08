import { MapPin } from 'lucide-react';
import DeadlineBadge from './DeadlineBadge';
import JobMacetBadge from './JobMacetBadge';

/**
 * JobCard — Kartu job minimal di papan kanban staff.
 * Props: job, orderInfo, onOpenWorkspace, ambangAntreanJam, ambangDikerjakanJam
 *
 * BUG FIX: prop bernama `_job` (underscore) → tidak bisa diakses sebagai `job`.
 * Diubah ke `job` agar data status dan tahap bisa ditampilkan.
 */
export default function JobCard({ job, orderInfo, onOpenWorkspace, ambangAntreanJam, ambangDikerjakanJam }) {
  return (
    <div
      onClick={onOpenWorkspace}
      className="bg-white rounded-lg border border-slate-200 p-3 hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all leading-tight text-xs font-semibold text-slate-800"
      title="Klik untuk membuka layar kerja produksi"
    >
      <div className="flex justify-between items-center gap-2">
        <span className="truncate font-bold text-slate-900">
          {orderInfo?.customerName || 'Memuat...'}
        </span>
        <span className="text-[9px] text-slate-400 font-mono shrink-0">
          #{orderInfo?.orderId || '...'}
        </span>
      </div>
      <p className="text-[11px] text-indigo-700 font-semibold truncate mt-1">
        {orderInfo?.jenisProduk || '...'}
      </p>
      {job?.tahap_nama && (
        <p className="text-[9px] text-slate-400 mt-0.5 flex items-center">
          <MapPin size={10} className="mr-1 text-slate-400 shrink-0" />
          <span className="truncate">{job.tahap_nama}</span>
        </p>
      )}
      <div className="mt-1 flex flex-wrap gap-1">
        <DeadlineBadge deadline={job?.deadline} jam={job?.deadline_jam} />
        <JobMacetBadge job={job} ambangAntreanJam={ambangAntreanJam} ambangDikerjakanJam={ambangDikerjakanJam} />
        {job?.insentif > 0 && (
          <span
            className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-600"
            title={(job.rincian_insentif || []).map((r) => `${r.nama}: Rp ${Number(r.nominal).toLocaleString('id-ID')}`).join('\n')}
          >
            Insentif Rp {Number(job.insentif).toLocaleString('id-ID')}
          </span>
        )}
      </div>
      {orderInfo?.desainSusulan && (
        <div className="mt-2 flex items-center gap-1.5 bg-cyan-50 border border-cyan-150 rounded px-1.5 py-0.5 w-fit">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-450 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
          </span>
          <span className="text-[8.5px] font-extrabold text-cyan-700 uppercase tracking-wider">
            Desain Susulan
          </span>
        </div>
      )}
    </div>
  );
}
