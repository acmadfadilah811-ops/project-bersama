import { NavLink } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const TABS = [
  { to: '/dashboard-eksekutif', label: 'Ringkasan' },
  { to: '/dashboard-eksekutif/operasional', label: 'Operasional' },
  { to: '/dashboard-eksekutif/ai-analyst', label: 'AI Business Analyst', peran: ['owner', 'admin'] },
];

/** Navigasi antar sub-halaman Dashboard Eksekutif (area khusus owner/manager). */
export default function ExecutiveNav() {
  const { user } = useAuth();
  // AI Business Analyst hanya owner & admin; manager tidak (2026-10-14).
  const tabs = TABS.filter((t) => !t.peran || t.peran.includes(user?.role));
  return (
    <nav className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
      {tabs.map((t) => (
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
