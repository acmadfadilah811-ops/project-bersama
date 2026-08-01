import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

const formatIDR = (value) => `IDR ${(Number(value) || 0).toLocaleString('id-ID')}`;

export default function LogJurnalLinesModal({ entryNumber, actionLabel, onClose }) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!entryNumber) return;
    setLoading(true);
    apiClient
      .get(`/accounting/journal-entries/${encodeURIComponent(entryNumber)}/`)
      .then((res) => setEntry(res.data || null))
      .catch((err) => notifyApiError(err, 'Gagal memuat rincian transaksi'))
      .finally(() => setLoading(false));
  }, [entryNumber]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-5xl w-full flex flex-col p-6 relative max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-150 mb-4">
          <h3 className="text-sm font-bold text-slate-800">
            {actionLabel ? `${actionLabel} - ${entryNumber}` : entryNumber}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3 text-[#0088E8]" />
            <p className="text-xs font-semibold">Memuat rincian transaksi...</p>
          </div>
        ) : !entry ? (
          <div className="text-center py-20 text-slate-400 text-xs font-semibold">
            Rincian transaksi tidak ditemukan.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-4 py-3">No. Transaksi</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3">No. Dokumen</th>
                  <th className="px-4 py-3 text-right">Nilai Debit</th>
                  <th className="px-4 py-3 text-right">Nilai Kredit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {entry.lines?.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{dayjs(entry.date).format('DD MMM YYYY')}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{line.account_code} - {line.account_name}</td>
                    <td className="px-4 py-3 text-[#0088E8] font-bold">{entry.entry_number}</td>
                    <td className="px-4 py-3 text-slate-600">{line.description || entry.description}</td>
                    <td className="px-4 py-3 text-slate-500">{line.external_document_no || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {Number(line.debit) > 0 ? formatIDR(line.debit) : 'IDR 0'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {Number(line.kredit) > 0 ? formatIDR(line.kredit) : 'IDR 0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
