import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import AksiPostingGaji from '../components/payroll/AksiPostingGaji';
import PemetaanKomponenGaji from '../components/payroll/PemetaanKomponenGaji';
import PersetujuanGaji from '../components/payroll/PersetujuanGaji';
import PratinjauJurnalGaji from '../components/payroll/PratinjauJurnalGaji';
import RiwayatPostingGaji from '../components/payroll/RiwayatPostingGaji';
import { usePostingGaji } from '../hooks/usePostingGaji';

export default function PostingGaji() {
  const { user } = useAuth();
  const g = usePostingGaji();
  const bolehPosting = ['owner', 'manager', 'spv_finance'].includes(user?.role);
  // Admin/SPV Finance (2026-09-24): boleh BACA riwayat posting gaji yang
  // sudah masuk ke Finance (poin UAT "menerima data payroll otomatis"),
  // tapi tidak boleh memicu pratinjau/posting/koreksi/bayar -- itu murni
  // Owner/Manager (backend juga menolak, Aturan M2). Role lain di luar
  // keduanya tetap ditolak sama sekali.
  const bolehLihatRiwayat = bolehPosting || ['admin_finance', 'spv_finance'].includes(user?.role);

  if (!bolehLihatRiwayat) {
    return <p className="text-sm text-slate-500 p-6">Posting Gaji hanya dapat diakses Owner, Manager, Admin Finance, atau SPV Finance.</p>;
  }

  if (!bolehPosting) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat Posting Gaji</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gaji final dari HR (Horilla) yang sudah dicatat sebagai jurnal ke Finance. Admin Finance mencatat pembayaran gaji yang sudah diotorisasi (dengan bukti transfer).
          </p>
        </div>
        <PersetujuanGaji />
        {g.memuat && <p className="text-sm text-slate-400">Memuat...</p>}
        <RiwayatPostingGaji riwayat={g.riwayat} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Posting Gaji</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gaji final dari HR (Horilla) dicatat sebagai jurnal: Biaya gaji, Hutang gaji, dan komponen potongan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={g.periode} onChange={(e) => g.setPeriode(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
          <button type="button" onClick={g.muat} className="p-2 text-slate-400 hover:text-slate-700" title="Segarkan">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <PersetujuanGaji />

      {g.memuat && !g.pratinjau && <p className="text-sm text-slate-400">Memuat...</p>}
      {g.galat && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{g.galat}</p>
      )}

      {g.pratinjau && (
        <>
          <PratinjauJurnalGaji pratinjau={g.pratinjau} />
          <AksiPostingGaji
            pratinjau={g.pratinjau} akun={g.akun} sedangProses={g.sedangProses}
            onPosting={g.posting} onKoreksi={g.koreksi} onBayar={g.bayar}
          />
          <PemetaanKomponenGaji
            komponenHr={g.pratinjau.komponen_hr} pemetaan={g.pemetaan} akun={g.akun}
            sedangProses={g.sedangProses} onSimpan={g.simpanPemetaan} onHapus={g.hapusPemetaan}
          />
        </>
      )}

      <RiwayatPostingGaji riwayat={g.riwayat} />
    </div>
  );
}
