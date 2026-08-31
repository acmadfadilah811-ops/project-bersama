import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/dashboard-eksekutif', label: 'Ringkasan' },
  { to: '/dashboard-eksekutif/ai-analyst', label: 'AI Business Analyst' },
];

/** Navigasi antar sub-halaman Dashboard Eksekutif (area khusus owner/manager). */
export default function ExecutiveNav() {
  return (
    <nav className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end
          className={({ isActive }) =>
            `px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
              isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
