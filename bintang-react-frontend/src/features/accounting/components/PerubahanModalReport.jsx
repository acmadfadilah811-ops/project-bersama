import { Loader2 } from 'lucide-react';

function AmountRow({ label, amount, strong = false }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${strong ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span>{amount}</span>
    </div>
  );
}

export default function PerubahanModalReport({ loading, reportData, formatRupiah }) {
  const report = reportData || {};
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative min-h-[400px]">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs"><Loader2 size={20} className="animate-spin" /><span>Memuat data Perubahan Modal...</span></div>
        </div>
      )}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-[#E0F2FE] text-slate-900 px-4 py-2.5 font-bold text-xs flex justify-between items-center border-b border-slate-200"><span>Grup</span><span>Jumlah</span></div>
        <div className="p-4 space-y-3 text-xs">
          <AmountRow label="Modal awal" amount={formatRupiah(report.modal_awal)} strong />
          <div className="pt-2">
            <div className="font-semibold text-slate-600 mb-2">Penambahan Modal</div>
            <div className="space-y-2 pl-6">
              <AmountRow label="Total Laba" amount={formatRupiah(report.total_laba)} />
              <AmountRow label="Investasi kurun waktu" amount={formatRupiah(report.investasi_kurun_waktu)} />
              <AmountRow label="Penarikan" amount={formatRupiah(report.penarikan)} />
            </div>
          </div>
          <div className="flex items-center justify-between font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border-t border-slate-200 mt-3"><span>Total penambahan Modal</span><span>{formatRupiah(report.total_penambahan_modal)}</span></div>
          <div className="flex items-center justify-between font-extrabold text-slate-900 bg-slate-100 p-3 rounded-lg border-t border-slate-300 mt-2"><span>Modal akhir periode</span><span>{formatRupiah(report.modal_akhir_periode)}</span></div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400 italic">Dihitung dari jurnal terposting dan COA Ekuitas; laba bersih memakai periode yang sama.</p>
    </div>
  );
}
