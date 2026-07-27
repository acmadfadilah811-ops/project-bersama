import SiapDiambilPanel from '../components/SiapDiambilPanel';

/**
 * Halaman tersendiri untuk pesanan produksi — dipisahkan dari dashboard agar
 * rincian per divisi tidak menumpuk di layar depan. Dashboard hanya
 * menampilkan ringkasannya.
 */
export default function PesananPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#F4F7FE]">
      <div className="mb-5 print:hidden">
        <h1 className="text-xl font-black text-slate-800">Pesanan Produksi</h1>
        <p className="text-xs font-semibold text-slate-500 mt-0.5">
          Pesanan yang siap diambil beserta progres pengerjaan tiap divisi. Klik pesanan yang
          masih diproses untuk melihat rinciannya.
        </p>
      </div>

      <SiapDiambilPanel />
    </div>
  );
}
