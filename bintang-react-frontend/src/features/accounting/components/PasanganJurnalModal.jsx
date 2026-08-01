import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

export default function PasanganJurnalModal({ isOpen, onClose, entryNumber }) {
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !entryNumber) return;
    setLoading(true);
    apiClient
      .get(`/accounting/journal-entries/${encodeURIComponent(entryNumber)}/`)
      .then((res) => setEntry(res.data || null))
      .catch((err) => notifyApiError(err, 'Gagal memuat pasangan jurnal'))
      .finally(() => setLoading(false));
  }, [isOpen, entryNumber]);

  if (!isOpen) return null;

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return `IDR ${num.toLocaleString('id-ID')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const transactionName = (journal) => {
    const labels = {
      pos_sale: 'Pembayaran penjualan',
      order_payment: 'Pembayaran penjualan',
      purchase: 'Pembelian',
      purchase_payment: 'Pembayaran pembelian',
      cash_transaction: 'Transaksi kas',
      cash_transfer: 'Transfer kas',
      capital_transfer: 'Transfer modal',
    };
    return labels[journal?.source_type] || journal?.source_type_label || 'Jurnal umum';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-5xl w-full flex flex-col p-6 relative max-h-[85vh]">
        
        {/* Header Section */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-150 mb-4">
          <h3 className="text-sm font-bold text-slate-800">
            {entryNumber} - {transactionName(entry)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            Tutup
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={28} className="animate-spin mb-3 text-[#0088E8]" />
            <p className="text-xs font-semibold">Memuat Jurnal...</p>
          </div>
        ) : !entry ? (
          <div className="text-center py-20 text-slate-400 text-xs font-semibold">
            Detail pasangan jurnal tidak ditemukan.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-4 py-3">Nama Transaksi</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3 text-right">Nilai Debit</th>
                  <th className="px-4 py-3 text-right">Nilai Kredit</th>
                  <th className="px-4 py-3 text-center">Diproses Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {entry.lines?.map((line, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{line.account_code} - {line.account_name}</td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{transactionName(entry)}</td>
                    <td className="px-4 py-3 text-slate-500">{line.description || entry.description}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {line.debit > 0 ? formatIDR(line.debit) : 'IDR 0'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {line.kredit > 0 ? formatIDR(line.kredit) : 'IDR 0'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{entry.processed_by_name || 'Sistem'}</td>
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
