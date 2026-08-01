import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import PasanganJurnalModal from './PasanganJurnalModal';

const CATEGORY_LABELS = {
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
const PAGE_SIZE = 10;

export default function ArusKasDetail({ category, dateFrom, dateTo, onBack }) {
  const [detail, setDetail] = useState({ results: [], page: 1, total_pages: 1, saldo_awal: 0 });
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState(null);
  const [selectedEntryNumber, setSelectedEntryNumber] = useState(null);
  const [isPasanganOpen, setIsPasanganOpen] = useState(false);
  const actionRef = useRef(null);

  const fetchDetail = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/accounting/reports/cash-flow/${category}/`, {
        params: { date_from: dateFrom, date_to: dateTo, page, page_size: PAGE_SIZE },
      });
      setDetail(response.data);
      setActiveAction(null);
    } catch (error) {
      setDetail({ results: [], page: 1, total_pages: 1, saldo_awal: 0 });
      notifyApiError(error, 'Gagal memuat rincian Arus Kas');
    } finally {
      setLoading(false);
    }
  }, [category, dateFrom, dateTo]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => {
    const closeAction = (event) => {
      if (actionRef.current && !actionRef.current.contains(event.target)) setActiveAction(null);
    };
    document.addEventListener('mousedown', closeAction);
    return () => document.removeEventListener('mousedown', closeAction);
  }, []);

  const formatNumber = (value, withParentheses = false) => {
    const amount = Number(value) || 0;
    const formatted = Math.abs(amount).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return amount < 0 || (withParentheses && amount > 0) ? `(${formatted})` : formatted;
  };
  const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const rows = detail.results || [];
  const changePage = (requestedPage) => {
    const nextPage = Math.min(Math.max(requestedPage, 1), detail.total_pages || 1);
    if (!loading && nextPage !== detail.page) fetchDetail(nextPage);
  };

  return (
    <div className="space-y-4 animate-fade-in pb-12 text-xs font-semibold text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="flex items-center gap-1 px-3 py-1.5 border border-[#73C240] text-[#73C240] rounded-lg hover:bg-slate-50 cursor-pointer"><ChevronLeft size={14} />Kembali</button>
          <div><h2 className="text-sm font-bold text-slate-900">{CATEGORY_LABELS[category] || 'Rincian Arus Kas'}</h2><p className="text-[11px] text-slate-400 font-medium">{dateFrom} s/d {dateTo}</p></div>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          <button type="button" onClick={() => changePage(detail.page - 1)} disabled={loading || detail.page <= 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={14} /></button>
          <span>Halaman {detail.page} dari {detail.total_pages}</span>
          <button type="button" onClick={() => changePage(detail.page + 1)} disabled={loading || detail.page >= detail.total_pages} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? <div className="flex flex-col items-center py-20 text-slate-400"><Loader2 size={30} className="animate-spin mb-3 text-[#0088E8]" /><span>Memuat rincian Arus Kas...</span></div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-xs border-collapse min-w-[940px]">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100"><tr><th className="px-4 py-3">Akun</th><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">No. Transaksi</th><th className="px-4 py-3">Deskripsi</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Kredit</th><th className="px-4 py-3 text-right">Jumlah</th><th className="px-4 py-3 text-center">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              <tr className="bg-slate-50/40 font-bold"><td colSpan={6} className="px-4 py-3">Saldo Awal</td><td className="px-4 py-3 text-right text-slate-900">{formatNumber(detail.saldo_awal)}</td><td /></tr>
              {rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-16 text-center text-slate-400">Tidak ada transaksi untuk kategori dan periode ini.</td></tr> : rows.map((row, index) => {
                const openUpward = index >= rows.length - 2;
                return (
                <tr key={`${row.entry_number}-${row.account_id}-${index}`} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-800">{row.account_code} - {row.account_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-[#0088E8] font-bold">{row.entry_number}{row.external_document_no ? <div className="text-[10px] text-slate-400">({row.external_document_no})</div> : null}</td>
                  <td className="px-4 py-3">{row.description || '-'}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.debit)}</td>
                  <td className="px-4 py-3 text-right">{formatNumber(row.kredit, true)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatNumber(row.amount)}</td>
                  <td className="px-4 py-3 text-center relative"><button type="button" onClick={() => setActiveAction(activeAction === index ? null : index)} className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 inline-flex items-center justify-center"><MoreHorizontal size={15} /></button>
                    {activeAction === index && <div ref={actionRef} className={`absolute right-8 z-20 w-40 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 text-left ${openUpward ? 'bottom-9' : 'top-9'}`}><button type="button" onClick={() => { setSelectedEntryNumber(row.entry_number); setIsPasanganOpen(true); setActiveAction(null); }} className="w-full px-3 py-2 hover:bg-slate-50 flex items-center gap-2"><ArrowRightLeft size={13} />Pasangan Jurnal</button><button type="button" onClick={() => setActiveAction(null)} className="w-full px-3 py-2 hover:bg-slate-50 text-slate-500 flex items-center gap-2"><X size={13} />Tutup</button></div>}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
      <PasanganJurnalModal isOpen={isPasanganOpen} onClose={() => { setIsPasanganOpen(false); setSelectedEntryNumber(null); }} entryNumber={selectedEntryNumber} />
    </div>
  );
}
