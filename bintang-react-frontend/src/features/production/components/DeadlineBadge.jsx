import { CalendarClock } from 'lucide-react';

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/** Tingkatan urgensi deadline -- dipakai bareng DeadlineBadge (badge per
 * job) & widget "Alert Deadline Pekerjaan" (ringkasan lintas job, Papan
 * Kerja SPK). Beberapa tingkatan (fitur 2026-09-07): Terlambat > Hari Ini >
 * Besok > Minggu Ini, makin kecil `priority` makin mendesak. */
export function getDeadlineTier(deadline) {
  if (!deadline) return null;
  const deadlineDate = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(deadlineDate.getTime())) return null;

  const daysRemaining = Math.round((deadlineDate - startOfToday()) / 86_400_000);
  const formatted = deadlineDate.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  if (daysRemaining < 0) {
    return {
      tier: 'terlambat', priority: 0, daysRemaining, formatted,
      label: `Terlambat ${Math.abs(daysRemaining)} hari`,
      badgeClassName: 'border-rose-200 bg-rose-50 text-rose-700',
      alertClassName: 'border-rose-500 text-rose-900',
      alertBg: 'rgba(244, 63, 94, 0.06)',
      dotClassName: 'bg-rose-500',
    };
  }
  if (daysRemaining === 0) {
    return {
      tier: 'hari_ini', priority: 1, daysRemaining, formatted,
      label: 'Deadline hari ini',
      badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
      alertClassName: 'border-amber-500 text-amber-900',
      alertBg: 'rgba(245, 158, 11, 0.07)',
      dotClassName: 'bg-amber-500',
    };
  }
  if (daysRemaining === 1) {
    return {
      tier: 'besok', priority: 2, daysRemaining, formatted,
      label: 'Deadline besok',
      badgeClassName: 'border-orange-200 bg-orange-50 text-orange-700',
      alertClassName: 'border-orange-400 text-orange-900',
      alertBg: 'rgba(251, 146, 60, 0.06)',
      dotClassName: 'bg-orange-400',
    };
  }
  if (daysRemaining <= 7) {
    return {
      tier: 'minggu_ini', priority: 3, daysRemaining, formatted,
      label: `Deadline ${formatted}`,
      badgeClassName: 'border-yellow-200 bg-yellow-50 text-yellow-800',
      alertClassName: 'border-yellow-400 text-yellow-900',
      alertBg: 'rgba(234, 179, 8, 0.06)',
      dotClassName: 'bg-yellow-400',
    };
  }
  return {
    tier: 'nanti', priority: 4, daysRemaining, formatted,
    label: `Deadline ${formatted}`,
    badgeClassName: 'border-sky-200 bg-sky-50 text-sky-700',
    alertClassName: 'border-sky-300 text-sky-900',
    alertBg: 'rgba(14, 165, 233, 0.05)',
    dotClassName: 'bg-sky-400',
  };
}

export default function DeadlineBadge({ deadline }) {
  const state = getDeadlineTier(deadline);
  if (!state) return null;

  return (
    <span title={`Deadline: ${state.formatted}`} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${state.badgeClassName}`}>
      <CalendarClock size={11} />
      {state.label}
    </span>
  );
}
