import { Users } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import KordivSpvTeamBoard from '../components/KordivSpvTeamBoard';
import LaporanProduksiSpvPanel from '../components/LaporanProduksiSpvPanel';

/**
 * Halaman landing SPV/Kordiv (HomeRedirect di App.jsx mengarahkan ke sini,
 * bukan /staff-dashboard). Sebelumnya cuma kartu job_per_status + tabel
 * pemakaian mesin -- diganti ke KordivSpvTeamBoard (2026-09-18) yang
 * mencakup itu semua PLUS antrean void request, distribusi & assign job,
 * beban kerja staff, dan (khusus SPV) perbandingan antar divisi.
 */
export default function RingkasanTim() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <div className="max-w-7xl mx-auto px-4 pt-6 pb-12 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Users size={22} className="text-indigo-600" /> Papan Kerja Tim
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {role === 'spv'
            ? 'Ringkasan & approval lintas divisi bawahan Anda.'
            : 'Ringkasan & approval divisi Anda.'}
        </p>
      </div>
      <KordivSpvTeamBoard role={role} />
      {/* Laporan target & kendala operasional -- khusus SPV, instruksi user
          2026-09-23. Kordiv tidak diminta ikut fitur ini. */}
      {role === 'spv' && <LaporanProduksiSpvPanel />}
    </div>
  );
}
