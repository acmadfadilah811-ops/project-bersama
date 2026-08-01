import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notifyApiError } from '../../../../utils/notify';

const asList = (response) => (Array.isArray(response.data) ? response.data : response.data?.results) || [];

export default function PasanganHutangModal({ isOpen, onClose, txNo, paymentIds = [] }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const paymentIdsKey = paymentIds.join(',');

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!paymentIdsKey) {
      setEntries([]);
      return undefined;
    }

    let active = true;
    setLoading(true);
    apiClient.get('/accounting/journal-entries/', {
      params: { source_type: 'purchase_payment', source_ids: paymentIdsKey },
    })
      .then((response) => { if (active) setEntries(asList(response)); })
      .catch((error) => {
        if (!active) return;
        setEntries([]);
        notifyApiError(error, 'Gagal memuat pasangan jurnal');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, paymentIdsKey]);

  const rows = useMemo(() => entries.flatMap((entry) => (entry.lines || []).map((line) => ({
    id: `${entry.id}-${line.id}`,
    date: entry.date,
    account: `${line.account_code} ${line.account_name}`,
    description: line.description || entry.description || '-',
    debit: line.debit,
    kredit: line.kredit,
    processedBy: entry.processed_by_name || 'Sistem',
  }))), [entries]);

  if (!isOpen) return null;
  const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)).replace(/ /g, '-') : '-';
  const formatIDR = (value) => `IDR ${(Number(value) || 0).toLocaleString('id-ID')}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs animate-fade-in text-xs font-semibold text-slate-700">
      <div className="relative max-h-[90vh] w-[940px] overflow-y-auto rounded-2xl border border-slate-205 bg-white shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between border-b border-slate-150 bg-[#F8FAFC] px-6 py-4">
          <h4 className="font-mono text-[13px] font-bold text-slate-800">{txNo} - Pembelian</h4>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-[11px] font-bold text-slate-650 shadow-2xs hover:bg-slate-50 cursor-pointer transition-colors">Tutup</button>
        </div>
        <div className="space-y-4 p-6">
          {loading ? <div className="flex flex-col items-center gap-3 py-16 text-slate-400"><Loader2 size={26} className="animate-spin text-[#0088E8]" /><span>Memuat pasangan jurnal...</span></div> : (
            <div className="overflow-hidden rounded-lg border border-slate-150 bg-white">
              <table className="w-full border-collapse text-left">
                <thead><tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-450"><th className="px-5 py-3">Tanggal</th><th className="px-5 py-3">Akun</th><th className="px-5 py-3">Nama Transaksi</th><th className="px-5 py-3">Deskripsi</th><th className="px-5 py-3 text-right">Nilai Debit</th><th className="px-5 py-3 text-right">Nilai Kredit</th><th className="px-5 py-3">Diproses Oleh</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Belum ada jurnal pembayaran nyata untuk pembelian ini.</td></tr> : rows.map((row) => <tr key={row.id} className="hover:bg-slate-50/50 transition-colors"><td className="px-5 py-3.5 font-medium text-slate-600">{formatDate(row.date)}</td><td className="px-5 py-3.5 font-bold text-slate-750">{row.account}</td><td className="px-5 py-3.5 text-slate-600">Pembelian</td><td className="px-5 py-3.5 font-medium text-slate-500">{row.description}</td><td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">{formatIDR(row.debit)}</td><td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">{formatIDR(row.kredit)}</td><td className="px-5 py-3.5 font-bold text-slate-600">{row.processedBy}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-50 bg-slate-50/30 p-4 text-[11px] font-bold text-slate-500"><span>Total {rows.length}</span></div>
        </div>
      </div>
    </div>
  );
}
