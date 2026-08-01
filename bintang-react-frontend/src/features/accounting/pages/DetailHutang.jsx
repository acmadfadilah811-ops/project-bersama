import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, ChevronDown, FileText, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

const formatIDR = (value) => `IDR ${(Number(value) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DetailHutang({ purchaseId, onBack }) {
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Semua');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiClient.get(`/purchases/${purchaseId}/`)
      .then((response) => { if (active) setPurchase(response.data); })
      .catch((error) => { if (active) notifyApiError(error, 'Gagal memuat detail hutang'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [purchaseId]);

  const rows = useMemo(() => {
    if (!purchase) return [];
    const supplier = purchase.supplier || 'Supplier';
    return [
      { id: `purchase-${purchase.id}`, date: purchase.tanggal, txNo: purchase.nomor, description: `Pembelian dari ${supplier}`, amount: Number(purchase.total || 0) },
      ...(purchase.payments || []).map((payment) => ({
        id: `payment-${payment.id}`, date: payment.tanggal, txNo: `PP-${payment.id}`,
        description: `Pembayaran ke ${supplier}${payment.metode ? ` (${payment.metode})` : ''}`,
        amount: -Number(payment.nominal || 0),
      })),
    ];
  }, [purchase]);

  const isLunas = purchase?.payment_status === 'lunas' || Number(purchase?.sisa || 0) === 0;

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 shadow-3xs ${isLunas ? 'border-[#A8DAB5] bg-[#E6F4EA] text-[#137333]' : 'border-[#FDE68A] bg-[#FEF3C7] text-[#D97706]'}`}>
            {isLunas ? <CheckCircle size={18} /> : <FileText size={18} />}
            <div className="leading-tight"><span className="block text-[9px] font-bold uppercase tracking-wider opacity-80">Hutang</span><span className="mt-0.5 block text-xs font-black">{isLunas ? 'Lunas' : 'Belum dibayar'}</span></div>
          </div>
          <div><div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Hutang</div><h3 className="text-sm font-bold text-slate-800">Pembelian dari {purchase?.supplier || 'Supplier'}</h3></div>
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border border-emerald-250 bg-emerald-50 px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-700 shadow-2xs hover:bg-emerald-100 cursor-pointer transition-colors">← Kembali</button>
      </div>

      <div className="relative min-h-[320px] space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="w-44"><div className="relative"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="w-full appearance-none rounded-lg border border-slate-205 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-650 shadow-3xs outline-none focus:border-[#0088E8] cursor-pointer">{['Semua', 'No. Transaksi', 'Tgl Transaksi', 'Nama Tipe Transaksi', 'No. Dokumen', 'Deskripsi'].map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2 text-slate-400" /></div></div>
        <div className="overflow-hidden rounded-lg border border-slate-150 bg-white"><table className="w-full border-collapse text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-450"><th className="px-5 py-3">Tanggal</th><th className="px-5 py-3">No. Transaksi</th><th className="px-5 py-3">Deskripsi</th><th className="px-5 py-3 text-right">Amount (IDR)</th><th className="px-5 py-3 text-center">Aksi</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" size={22} /></td></tr> : rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-5 py-4 font-medium text-slate-600">{row.date || '-'}</td><td className="px-5 py-4 font-mono font-bold text-slate-800">{row.txNo || '-'}</td><td className="px-5 py-4 font-bold text-slate-650">{row.description}</td><td className={`px-5 py-4 text-right font-mono font-bold ${row.amount < 0 ? 'font-medium text-slate-500' : 'text-slate-800'}`}>{row.amount < 0 ? `(${formatIDR(Math.abs(row.amount))})` : formatIDR(row.amount)}</td><td className="px-5 py-4 text-center text-slate-350">-</td></tr>)}</tbody></table></div>
        <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/30 p-4 text-[11px] font-bold text-slate-500"><button disabled className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-slate-400 cursor-not-allowed">15 item <ChevronDown size={11} /></button><span>Total {rows.length}</span></div>
      </div>
    </div>
  );
}
