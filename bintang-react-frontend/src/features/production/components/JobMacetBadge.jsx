import { AlarmClockOff } from 'lucide-react';

/** Format "X jam" / "X hari Y jam" ringkas. */
function formatDurasi(jam) {
  if (jam < 24) return `${jam} jam`;
  const hari = Math.floor(jam / 24);
  const sisaJam = jam % 24;
  return sisaJam > 0 ? `${hari} hr ${sisaJam} jam` : `${hari} hari`;
}

/**
 * Deteksi "pekerjaan macet" (PRD-10 UAT): job yang diam terlalu lama di satu
 * status, bukan job yang terlambat dari deadline order (itu DeadlineBadge/
 * SPK-10). Dua sumber waktu:
 *  - 'antrean' -- lama sejak SPK dibuat (job.dibuat_pada), belum ada yang
 *    mengklaim/mulai.
 *  - 'dikerjakan'/'kendala' -- lama sejak staff menekan Mulai (job.waktu_mulai).
 *    Job 'kendala' dianggap masih "dikerjakan" untuk keperluan ini karena
 *    biasanya berhenti di tengah pengerjaan, bukan sebelum diklaim.
 *
 * `ambangAntreanJam`/`ambangDikerjakanJam` dari BusinessSettings
 * (job_macet_jam_antrean/job_macet_jam_dikerjakan, diatur Owner/Manager).
 * Job lama (dibuat sebelum kolom dibuat_pada ada) punya dibuat_pada null --
 * sengaja TIDAK dianggap macet (data tidak ada, bukan tidak macet).
 */
export function getMacetInfo(job, ambangAntreanJam = 24, ambangDikerjakanJam = 8) {
  if (!job || !['antrean', 'dikerjakan', 'kendala'].includes(job.status_pekerjaan)) return null;

  const acuan = job.status_pekerjaan === 'antrean' ? job.dibuat_pada : job.waktu_mulai;
  if (!acuan) return null;

  const mulai = new Date(acuan);
  if (Number.isNaN(mulai.getTime())) return null;

  const jamBerlalu = Math.floor((Date.now() - mulai.getTime()) / 3_600_000);
  const ambang = job.status_pekerjaan === 'antrean' ? ambangAntreanJam : ambangDikerjakanJam;
  if (jamBerlalu < ambang) return null;

  const labelStatus = job.status_pekerjaan === 'antrean' ? 'menunggu diklaim' : 'dikerjakan';
  return {
    jamBerlalu,
    label: `Macet ${formatDurasi(jamBerlalu)} ${labelStatus}`,
    badgeClassName: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    alertClassName: 'border-fuchsia-500 text-fuchsia-900',
    alertBg: 'rgba(217, 70, 239, 0.06)',
    dotClassName: 'bg-fuchsia-500',
  };
}

export default function JobMacetBadge({ job, ambangAntreanJam, ambangDikerjakanJam }) {
  const info = getMacetInfo(job, ambangAntreanJam, ambangDikerjakanJam);
  if (!info) return null;

  return (
    <span
      title="Pekerjaan ini sudah lama tidak bergerak -- perlu dicek."
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${info.badgeClassName}`}
    >
      <AlarmClockOff size={11} />
      {info.label}
    </span>
  );
}
