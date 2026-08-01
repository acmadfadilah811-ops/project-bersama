import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import PenjualanHeader from '../components/penjualan/PenjualanHeader';
import PenjualanTable from '../components/penjualan/PenjualanTable';
import PenjualanSearchModal from '../components/penjualan/PenjualanSearchModal';
import PenjualanDateModal from '../components/penjualan/PenjualanDateModal';
import PosSettingsModal from '../components/pos/PosSettingsModal';
import PosLogModal from '../components/pos/PosLogModal';
import { notify, notifyApiError } from '../../../utils/notify';
import apiClient from '../../../api/apiClient';

export default function PenjualanDiToko() {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDaysAgoStr = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  // Dates
  const [dateFrom, setDateFrom] = useState(getDaysAgoStr(30));
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [isDateOpen, setIsDateOpen] = useState(false);

  // Search Filters
  const [searchFilter, setSearchFilter] = useState({ keyword: '', amount: '', showDeleted: false });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Table Column Dropdown Filters
  const [filterJumlah, setFilterJumlah] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPostPayment, setFilterPostPayment] = useState('All');

  // Selected row IDs & Log state
  const [selectedIds, setSelectedIds] = useState([]);
  const [isRowLogOpen, setIsRowLogOpen] = useState(false);
  const [activeRowTxNo, setActiveRowTxNo] = useState('');
  const [rowLogs, setRowLogs] = useState([]);

  // Backend Sales State
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPenjualanToko = async () => {
    setLoading(true);
    try {
      const params = {
        date_from: dateFrom,
        date_to: dateTo,
        search: searchFilter.keyword,
      };
      const res = await apiClient.get('/accounting/sales/', { params: { ...params, source: 'pos', category: 'pos' } });
      const data = res.data.results || res.data || [];
      const formatted = data.map((item) => ({
        id: Number(item.source_id),
        date: item.date ? item.date.split('T')[0] : getTodayStr(),
        txNo: item.reference || `POS-${item.source_id}`,
        customer: item.customer || '-',
        amount: Number(item.amount || 0),
        paymentStatus: item.payment_status === 'paid' ? 'Dilunasi' : (item.payment_status === 'partial' ? 'Parsial' : (item.payment_status === 'void' ? 'Batal' : 'Belum Dilunasi')),
        status: item.journal_status === 'posted' ? 'Terposting' : (item.journal_status === 'void' ? 'Batal Post' : 'Belum Terposting'),
        postPayment: item.payment_status === 'partial' ? 'Sebagian' : (item.payment_status === 'unpaid' ? 'Tunda' : (item.journal_status === 'posted' ? 'Terposting' : 'Belum Terposting')),
      }));
      setSalesData(formatted);
    } catch (err) {
      console.error('Gagal memuat penjualan di toko:', err);
      notify({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: 'Gagal mengambil data penjualan toko dari server.',
      });
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPenjualanToko();
  }, [dateFrom, dateTo, searchFilter.keyword]);

  // Client-side filtering logic to produce filteredData
  const filteredData = salesData.filter((row) => {
    // 1. Date Range
    if (row.date) {
      const rDate = new Date(row.date);
      const fDate = new Date(dateFrom);
      const tDate = new Date(dateTo);
      if (rDate < fDate || rDate > tDate) return false;
    }

    // 2. Keyword Filter
    if (searchFilter.keyword) {
      const kw = searchFilter.keyword.toLowerCase().trim();
      const matchesKw =
        (row.txNo && row.txNo.toLowerCase().includes(kw)) ||
        (row.customer && row.customer.toLowerCase().includes(kw));
      if (!matchesKw) return false;
    }

    // 3. Amount Filter
    if (searchFilter.amount) {
      const amt = Number(searchFilter.amount);
      if (row.amount !== amt) return false;
    }

    // 4. Jumlah Column Filter
    if (filterJumlah !== 'All' && row.paymentStatus !== filterJumlah) return false;

    // 5. Status Column Filter
    if (filterStatus !== 'All' && row.status !== filterStatus) return false;

    // 6. Post Payment Column Filter
    if (filterPostPayment !== 'All' && row.postPayment !== filterPostPayment) return false;

    return true;
  });

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredData.map((row) => row.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handleOpenRowLog = async (row) => {
    setActiveRowTxNo(row.txNo);
    setIsRowLogOpen(true);
    try {
      const res = await apiClient.get(`/accounting/sales/pos/${row.id}/log/`);
      setRowLogs((res.data || []).map((log) => ({
        user: log.actor_email || 'SYSTEM', action: log.action.toUpperCase(), timestamp: log.created_at,
        source: log.journal_entry, description: log.note || `Aksi jurnal POS dari #${row.txNo}`,
      })));
    } catch (err) {
      notifyApiError(err, 'Gagal memuat log transaksi POS');
      setRowLogs([]);
    }
  };

  const checkedItems = filteredData.filter((row) => selectedIds.includes(row.id));
  const hasBelumPosted = checkedItems.some((r) => r.status === 'Belum Terposting');
  const hasPosted = checkedItems.some((r) => r.status === 'Terposting');

  const runBatchAction = async (path, title, message) => {
    try {
      await apiClient.post(path, { sale_ids: selectedIds });
      await fetchPenjualanToko();
      setSelectedIds([]);
      notify({ type: 'success', title, message });
    } catch (err) {
      notifyApiError(err, 'Aksi posting POS gagal diproses');
    }
  };
  const handlePost = () => runBatchAction('/accounting/sales/pos/post/', 'Berhasil Diposting', 'Transaksi POS diposting ke jurnal akuntansi.');
  const handlePostPayment = () => runBatchAction('/accounting/sales/pos/post/', 'Post Pembayaran Sukses', 'Pembayaran POS diposting melalui jurnal transaksi yang sama.');
  const handleCancelPost = () => runBatchAction('/accounting/sales/pos/cancel-post/', 'Posting Dibatalkan', 'Jurnal pembalik telah dibuat dan transaksi tidak diposting ulang otomatis.');

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Terhubung ke Kasir POS & Akuntansi Backend
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Data transaksi penjualan di bawah ini disinkronkan secara otomatis dari backend REST API POS.
          </p>
        </div>
      </div>

      {/* Page Title */}
      <h2 className="text-base font-bold text-slate-900">Penjualan di Toko</h2>

      {/* Filter Row Header */}
      <PenjualanHeader
        dateLabel={dateLabel}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenDate={() => setIsDateOpen(true)}
        checkedCount={selectedIds.length}
        hasBelumPosted={hasBelumPosted}
        hasPosted={hasPosted}
        onPost={handlePost}
        onPostPayment={handlePostPayment}
        onCancelPost={handleCancelPost}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Loading or Sales Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0088E8]" />
          <span className="text-slate-500 font-bold">Memuat data penjualan toko riil...</span>
        </div>
      ) : (
        <PenjualanTable
          data={filteredData}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          filterJumlah={filterJumlah}
          setFilterJumlah={setFilterJumlah}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterPostPayment={filterPostPayment}
          setFilterPostPayment={setFilterPostPayment}
          formatIDR={formatIDR}
          onOpenRowLog={handleOpenRowLog}
        />
      )}

      {/* Footer Statistics */}
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <div>Menampilkan {filteredData.length} dari {salesData.length} entri transaksi penjualan</div>
        {selectedIds.length > 0 && (
          <div className="text-[#0088E8] bg-[#E6F4FF] px-3 py-1 rounded-md font-bold">
            {selectedIds.length} transaksi dipilih
          </div>
        )}
      </div>

      {/* Modals */}
      <PenjualanDateModal
        isOpen={isDateOpen}
        onClose={() => setIsDateOpen(false)}
        onApply={(dateObj) => {
          setDateFrom(dateObj.from);
          setDateTo(dateObj.to);
          setDateLabel(dateObj.label);
          setIsDateOpen(false);
        }}
        initialFrom={dateFrom}
        initialTo={dateTo}
      />

      <PenjualanSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onApply={(filterObj) => {
          setSearchFilter(filterObj);
          setIsSearchOpen(false);
        }}
        initialFilter={searchFilter}
      />

      <PosSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <PosLogModal
        isOpen={isRowLogOpen}
        onClose={() => setIsRowLogOpen(false)}
        title={`Log Transaksi - ${activeRowTxNo}`}
        logs={rowLogs}
      />
    </div>
  );
}
