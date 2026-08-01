import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notifyApiError } from '../../../../utils/notify';

export default function PasanganJurnalModal({ isOpen, onClose, txNo, sourceIds = [] }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const sourceIdsKey = sourceIds.join(',');

  useEffect(() => {
    if (!isOpen) return;
    if (!sourceIdsKey) {
      setEntries([]);
      return;
    }

    let active = true;
    setLoading(true);
    apiClient
      .get('/accounting/journal-entries/', {
        params: { source_type: 'order_payment', source_ids: sourceIdsKey },
      })
      .then((response) => {
        if (!active) return;
        const data = Array.isArray(response.data) ? response.data : response.data?.results;
        setEntries(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        if (active) {
          setEntries([]);
          notifyApiError(error, 'Gagal memuat pasangan jurnal');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [isOpen, sourceIdsKey]);

  const rows = useMemo(() => entries.flatMap((entry) => (entry.lines || []).map((line) => ({
    id: `${entry.id}-${line.id}`,
    date: entry.date,
    account: `${line.account_code} ${line.account_name}`,
    transactionName: entry.source_type === 'order_payment' ? 'Penjualan' : entry.source_type_label,
    description: line.description || entry.description || '-',
    debit: line.debit,
    kredit: line.kredit,
    processedBy: entry.processed_by_name || 'Sistem',
  }))), [entries]);

  if (!isOpen) return null;

  const formatDate = (dateValue) => {
    if (!dateValue) return '-';
    const date = new Date(`${dateValue}T00:00:00`);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${String(date.getDate()).padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
  };
  const formatIDR = (value) => `IDR ${(Number(value) || 0).toLocaleString('id-ID')}`;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white border border-slate-205 rounded-2xl shadow-2xl w-[940px] max-h-[90vh] overflow-y-auto relative animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-[#F8FAFC]">
          <h4 className="text-[13px] font-bold text-slate-800 font-mono">{txNo} - Penjualan</h4>
          <button type="button" onClick={onClose} className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-bold text-[11px] cursor-pointer transition-colors">
            Tutup
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
              <Loader2 size={26} className="animate-spin text-[#0088E8]" />
              <span>Memuat pasangan jurnal...</span>
            </div>
          ) : (
            <div className="border border-slate-150 rounded-lg overflow-hidden bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider select-none">
                    <th className="px-5 py-3">Tanggal</th><th className="px-5 py-3">Akun</th><th className="px-5 py-3">Nama Transaksi</th><th className="px-5 py-3">Deskripsi</th><th className="px-5 py-3 text-right">Nilai Debit</th><th className="px-5 py-3 text-right">Nilai Kredit</th><th className="px-5 py-3">Diproses Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Belum ada jurnal nyata untuk transaksi ini.</td></tr>
                  ) : rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-600 font-medium">{formatDate(row.date)}</td>
                      <td className="px-5 py-3.5 text-slate-750 font-bold">{row.account}</td>
                      <td className="px-5 py-3.5 text-slate-600">{row.transactionName}</td>
                      <td className="px-5 py-3.5 text-slate-500 font-medium">{row.description}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">{formatIDR(row.debit)}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">{formatIDR(row.kredit)}</td>
                      <td className="px-5 py-3.5 text-slate-600 font-bold">{row.processedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
            <span>Total {rows.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
