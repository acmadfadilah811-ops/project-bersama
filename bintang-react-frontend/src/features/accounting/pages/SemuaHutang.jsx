import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Calendar, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import HutangFilterModal from '../components/pos/HutangFilterModal';
import HutangExportModal from '../components/pos/HutangExportModal';
import HutangDateModal from '../components/pos/HutangDateModal';
import TambahJurnalDropdown from '../components/pos/TambahJurnalDropdown';
import HutangActionDropdown from '../components/pos/HutangActionDropdown';
import PasanganHutangModal from '../components/pos/PasanganHutangModal';
import DetailHutang from './DetailHutang';
import { notify } from '../../../utils/notify';
import { fetchAllPages } from '../../../utils/paginatedApi';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

const getTodayStr = () => new Date().toISOString().split('T')[0];

export default function SemuaHutang() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Belum Bayar'); // 'Belum Bayar' | 'Sebagian' | 'Lunas'

  // Modal states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  // Date range states
  const [dateFrom, setDateFrom] = useState(getTodayStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [dateLabel, setDateLabel] = useState('Semua');

  // Limit page size states
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);
  const [hutangData, setHutangData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetailId, setSelectedDetailId] = useState(null);
  const [selectedJournalRow, setSelectedJournalRow] = useState(null);

  const loadHutang = async () => {
    setLoading(true);
    try {
      const purchases = await fetchAllPages('/purchases/');
      const rows = purchases
        .filter((purchase) => !purchase.is_retur)
        .map((purchase) => {
          const total = Number(purchase.total || 0);
          const paidAmount = Number(purchase.total_dibayar || 0);
          const remaining = Math.max(0, Number(purchase.sisa ?? total - paidAmount));
          return {
            id: purchase.id,
            date: purchase.tanggal || '-',
            txNo: purchase.nomor || `PUR-${purchase.id}`,
            supplier: purchase.supplier || 'Supplier',
            amount: total,
            paidAmount,
            remaining,
            dueDate: purchase.jatuh_tempo || '-',
            paymentIds: (purchase.payments || []).map((payment) => payment.id),
            status: purchase.payment_status === 'lunas' || remaining === 0
              ? 'Lunas'
              : paidAmount > 0 ? 'Sebagian' : 'Belum Bayar',
          };
        });
      setHutangData(rows);
    } catch (error) {
      setHutangData([]);
      notify({ type: 'error', title: 'Gagal Memuat Hutang', message: 'Data pembelian tidak dapat dimuat dari server.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    loadHutang();
  }, []);

  const handleDelete = async (row) => {
    if (!window.confirm(`Hapus pembelian ${row.txNo}? Hanya pembelian draft yang dapat dihapus.`)) return;
    try {
      await apiClient.delete(`/purchases/${row.id}/`);
      notify({ type: 'success', title: 'Pembelian Dihapus', message: `${row.txNo} telah dihapus.` });
      await loadHutang();
    } catch (error) {
      notifyApiError(error, 'Pembelian tidak dapat dihapus. Dokumen yang sudah diposting harus tetap disimpan untuk audit.');
    }
  };

  const filteredData = hutangData.filter((row) => {
    const query = searchQuery.trim().toLowerCase();
    if (query && ![row.txNo, row.supplier].some((value) => value.toLowerCase().includes(query))) return false;
    if (statusFilter && row.status !== statusFilter) return false;
    if (dateLabel !== 'Semua' && dateLabel !== 'Semua Data') {
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
    }
    return true;
  });
  const visibleData = filteredData.slice(0, pageSize);
  const totalRemaining = filteredData.reduce((total, row) => total + row.remaining, 0);
  const totalPaid = filteredData.reduce((total, row) => total + row.paidAmount, 0);
  const formatIDR = (value) => (Number(value) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleApplyFilter = (filters) => {
    console.log('Applied filters:', filters);
    notify({
      type: 'success',
      title: 'Filter Diterapkan',
      message: 'Pencarian hutang disaring berdasarkan kriteria kustom.'
    });
  };

  const handleApplyDateModal = (res) => {
    setDateFrom(res.from);
    setDateTo(res.to);
    setDateLabel(res.label);
    notify({
      type: 'success',
      title: 'Rentang Tanggal Disetel',
      message: `Rentang hutang disaring berdasarkan rentang tanggal: ${res.label}`
    });
  };

  if (selectedDetailId) {
    return <DetailHutang purchaseId={selectedDetailId} onBack={() => { setSelectedDetailId(null); loadHutang(); }} />;
  }

  return (
      <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Semua Hutang</h2>
        
        <div className="flex items-center gap-2">
          {/* Tambah Jurnal Dropdown */}
          <TambahJurnalDropdown />

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[10px] uppercase cursor-pointer transition-colors"
          >
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar matching Screenshot 1 */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[#F8FAFC]/50 p-1.5 border border-slate-100 rounded-xl">
        
        {/* Left Side: Filter button + Search input + Status Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Advanced Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Filter size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          {/* Search box input */}
          <div className="relative flex items-center bg-white rounded-lg shadow-2xs">
            <Search className="absolute left-3 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Transaksi/Supplier/Deskripsi"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg outline-none hover:bg-slate-50/50 focus:bg-white text-xs font-semibold text-slate-700 w-52 transition-all"
            />
          </div>

          {/* Status Checkbox Pills with Large Blue Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {['Belum Bayar', 'Sebagian', 'Lunas'].map((pill) => {
              const active = statusFilter === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setStatusFilter(pill)}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg font-extrabold transition-all cursor-pointer text-[10px] uppercase tracking-wide ${
                    active
                      ? 'border-[#0088E8] text-[#0088E8] bg-[#E6F4FF]/45 shadow-3xs'
                      : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex items-center justify-center w-3.5 h-3.5 rounded-full border shrink-0 transition-all ${
                    active ? 'border-[#0088E8] bg-[#E6F4FF]' : 'border-slate-300 bg-white'
                  }`}>
                    {active && (
                      <span className="bg-[#0088E8] w-2 h-2 rounded-full" />
                    )}
                  </span>
                  <span>{pill}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Date Range button triggers HutangDateModal */}
        <div>
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold transition-all cursor-pointer"
          >
            <Filter size={11} className="text-slate-400" />
            <span>
              {dateLabel} {dateLabel !== 'Semua Data' && dateLabel !== 'Semua' && `${dateFrom.split('-').reverse().join('-')} - ${dateTo.split('-').reverse().join('-')}`}
            </span>
          </button>
        </div>

      </div>

      {/* Main Table Card showing "No Data" as in Screenshot */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 space-y-4 min-h-[360px] relative">
        
        <div className="border border-slate-100 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                <th className="px-5 py-3.5 w-[15%]">Tanggal</th>
                <th className="px-5 py-3.5 w-[25%]">Transaksi</th>
                <th className="px-5 py-3.5 w-[30%]">Supplier</th>
                <th className="px-5 py-3.5 w-[15%] text-right">Jumlah</th>
                <th className="px-5 py-3.5 w-[10%] text-center">Jatuh Tempo</th>
                <th className="px-5 py-3.5 w-[5%] text-center rounded-tr-lg">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400"><Loader2 className="mx-auto animate-spin" size={22} /></td></tr>
              ) : visibleData.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-slate-400 font-bold">No Data</td></tr>
              ) : visibleData.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600">{row.date}</td>
                  <td className="px-5 py-3.5 font-bold text-[#0088E8]">{row.txNo}</td>
                  <td className="px-5 py-3.5 text-slate-800 font-bold">{row.supplier}</td>
                  <td className="px-5 py-3.5 text-right font-bold text-slate-800">Rp {formatIDR(row.amount)}</td>
                  <td className="px-5 py-3.5 text-center text-slate-500">{row.dueDate}</td>
                  <td className="px-5 py-3.5 text-center"><HutangActionDropdown purchaseId={row.id} isLunas={row.status === 'Lunas'} onDetailClick={() => setSelectedDetailId(row.id)} onJournalClick={() => setSelectedJournalRow(row)} onDeleteClick={() => handleDelete(row)} /></td>
                </tr>
              ))}
              {/* Total Summary Row below the table row */}
              <tr className="bg-slate-50/50 font-bold text-slate-800 text-[11px]">
                <td className="px-5 py-3">Total</td>
                <td colSpan={2} />
                <td className="px-5 py-3 text-right">
                  <div className="text-[10px] text-rose-600 font-extrabold leading-normal">
                    Belum dibayar : Rp {formatIDR(totalRemaining)}
                  </div>
                </td>
                <td className="px-5 py-3 text-center">
                  <div className="text-[10px] text-slate-500 font-extrabold leading-normal">
                    Dibayar : Rp {formatIDR(totalPaid)}
                  </div>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Limit & Pagination Bar */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          
          {/* Page Limit Selector (Bottom Left) */}
          <div className="relative" ref={pageSizeRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-3xs cursor-pointer text-[11px]"
            >
              <span>{pageSize} item</span>
              <ChevronDown size={11} className="text-slate-350" />
            </button>
            {isPageSizeOpen && (
              <div className="absolute left-0 bottom-full mb-1.5 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 w-28 text-left animate-fade-in">
                {[15, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setIsPageSizeOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {size} item
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-4">
            <span>Total {filteredData.length}</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed select-none">
                &gt;
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none select-none"
              />
            </div>
          </div>

        </div>

      </div>

      {/* Modals Mounting */}
      <HutangFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={handleApplyFilter}
      />

      <HutangExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        rows={filteredData}
      />

      <HutangDateModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={handleApplyDateModal}
      />

      <PasanganHutangModal
        isOpen={Boolean(selectedJournalRow)}
        onClose={() => setSelectedJournalRow(null)}
        txNo={selectedJournalRow?.txNo || ''}
        paymentIds={selectedJournalRow?.paymentIds || []}
      />

    </div>
  );
}
