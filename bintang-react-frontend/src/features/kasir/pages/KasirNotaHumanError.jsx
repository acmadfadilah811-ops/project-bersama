import PosHeaderBar from '../components/PosHeaderBar';
import { useAuth } from '../../../context/AuthContext';
import NotaHumanError from '../../notaHumanError/pages/NotaHumanError';

// Nota Human Error di dalam area kasir (2026-10-08): tetap memakai sidebar &
// header kasir seperti Riwayat Transaksi, bukan pindah ke layout utama.
export default function KasirNotaHumanError({ onToggleSidebar }) {
  const { user } = useAuth();
  const kasirName = user?.nama_lengkap || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || '-';
  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      <PosHeaderBar accountName={kasirName} onToggleSidebar={onToggleSidebar} />
      <div className="bg-[#0088FF] px-6 py-2.5 text-white shadow-sm shrink-0 font-bold text-xs">Nota Human Error</div>
      <div className="flex-1 overflow-y-auto">
        <NotaHumanError />
      </div>
    </div>
  );
}
