import { Wallet } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import AdminFinanceBoard from '../components/AdminFinanceBoard';
import SpvFinanceBoard from '../components/SpvFinanceBoard';

/**
 * Landing page role admin_finance & spv_finance (2026-09-18). Konten
 * berbeda total per role -- Admin Finance dapat antrean verifikasi,
 * SPV Finance dapat agregat hasil yang sudah diverifikasi.
 */
export default function FinanceDashboard() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-12 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Wallet size={22} className="text-indigo-600" />
          {role === 'spv_finance' ? 'Papan Kerja SPV Finance' : 'Papan Kerja Admin Finance'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {role === 'spv_finance'
            ? 'Ringkasan kas, pengeluaran, dan piutang yang sudah diverifikasi Admin Finance.'
            : 'Verifikasi setoran kas kasir, pengeluaran/kas kecil, dan pantau piutang.'}
        </p>
      </div>
      {role === 'spv_finance' ? <SpvFinanceBoard /> : <AdminFinanceBoard />}
    </div>
  );
}
