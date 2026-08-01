import { Loader2 } from 'lucide-react';

const LABELS = {
  penerimaan_pelanggan: 'Penerimaan dari pelanggan',
  penerimaan_penjualan_aset_lancar: 'Penerimaan/penjualan aset lancar lainnya',
  pembayaran_pemasok: 'Pembayaran ke pemasok',
  biaya_operasional: 'Biaya operasional',
  pendapatan_lain: 'Pendapatan lain',
  pengeluaran_lain: 'Pengeluaran lain',
  aset_tetap: 'Pendapatan/pembelian aset tetap',
  aset_tidak_berwujud: 'Pendapatan/pembelian aset tidak berwujud',
  investasi_lain: 'Aktivitas investasi lain',
  pembayaran_penerimaan_pinjaman: 'Pembayaran/penerimaan pinjaman',
  penambahan_pengambilan_modal: 'Penambahan/pengambilan modal',
};

function Rows({ rows, formatRupiah, onViewCategory }) {
  return (
    <div className="space-y-1 pl-6">
      {(rows || []).map((row) => (
        <div key={row.key} className="flex items-center justify-between py-0.5">
          <span className="text-slate-700">{LABELS[row.key] || row.key}</span>
          {Number(row.amount) !== 0 ? (
            <button
              type="button"
              onClick={() => onViewCategory(row.key)}
              className="font-semibold text-[#0088E8] hover:underline cursor-pointer"
            >
              {formatRupiah(row.amount)}
            </button>
          ) : <span className="font-semibold text-slate-800">{formatRupiah(row.amount)}</span>}
        </div>
      ))}
    </div>
  );
}

function Activity({ title, rows, subtotal, formatRupiah, onViewCategory }) {
  return (
    <div className="pt-2">
      <div className="font-semibold text-slate-600 mb-1">{title}</div>
      <Rows rows={rows} formatRupiah={formatRupiah} onViewCategory={onViewCategory} />
      <div className="flex items-center justify-between font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-2">
        <span>SubTotal {title}</span>
        <span>{formatRupiah(subtotal)}</span>
      </div>
    </div>
  );
}

export default function ArusKasReport({ loading, reportData, formatRupiah, onViewCategory }) {
  const report = reportData || {};
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative min-h-[450px]">
      {loading && (
        <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
          <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs"><Loader2 size={20} className="animate-spin" /><span>Memuat data Arus Kas...</span></div>
        </div>
      )}
      <div className="space-y-4">
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">Saldo kas awal</div>
          <div className="p-3"><div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-100 p-2.5 rounded-lg"><span>Total Saldo kas awal</span><span>{formatRupiah(report.saldo_kas_awal)}</span></div></div>
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">Arus Kas</div>
          <div className="p-3 space-y-2 text-xs">
            <Activity title="Aktivitas operasional" rows={report.operasional} subtotal={report.subtotal_operasional} formatRupiah={formatRupiah} onViewCategory={onViewCategory} />
            <Activity title="Aktivitas Investasi" rows={report.investasi} subtotal={report.subtotal_investasi} formatRupiah={formatRupiah} onViewCategory={onViewCategory} />
            <Activity title="Aktivitas Pendanaan" rows={report.pendanaan} subtotal={report.subtotal_pendanaan} formatRupiah={formatRupiah} onViewCategory={onViewCategory} />
            <div className="flex items-center justify-between font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-3 border-t border-dashed border-black"><span>Total Kenaikan/penurunan kas</span><span>{formatRupiah(report.total_kenaikan_kas)}</span></div>
          </div>
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">Saldo kas akhir</div>
          <div className="p-3"><div className="flex items-center justify-between font-black text-slate-900 bg-slate-200/90 p-2.5 border-t border-dashed border-black"><span>Total Saldo kas akhir</span><span>{formatRupiah(report.saldo_kas_akhir)}</span></div></div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-slate-400 italic">Dihitung dari jurnal terposting yang menyentuh akun Kas &amp; Bank.</p>
    </div>
  );
}
