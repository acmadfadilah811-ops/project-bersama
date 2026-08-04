import { CalendarClock } from 'lucide-react';

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

export default function DeadlineBadge({ deadline }) {
  if (!deadline) return null;

  const deadlineDate = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(deadlineDate.getTime())) return null;

  const daysRemaining = Math.round((deadlineDate - startOfToday()) / 86_400_000);
  const formatted = deadlineDate.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const state = daysRemaining < 0
    ? { className: 'border-rose-200 bg-rose-50 text-rose-700', label: `Terlambat ${Math.abs(daysRemaining)} hari` }
    : daysRemaining === 0
      ? { className: 'border-amber-200 bg-amber-50 text-amber-800', label: 'Deadline hari ini' }
      : { className: 'border-sky-200 bg-sky-50 text-sky-700', label: `Deadline ${formatted}` };

  return (
    <span title={`Deadline: ${formatted}`} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${state.className}`}>
      <CalendarClock size={11} />
      {state.label}
    </span>
  );
}
