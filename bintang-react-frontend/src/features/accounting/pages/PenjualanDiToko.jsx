import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import PenjualanHeader from '../components/penjualan/PenjualanHeader';
import PenjualanTable from '../components/penjualan/PenjualanTable';
import PenjualanSearchModal from '../components/penjualan/PenjualanSearchModal';
import PenjualanDateModal from '../components/penjualan/PenjualanDateModal';
import PosSettingsModal from '../components/pos/PosSettingsModal';
import PosLogModal from '../components/pos/PosLogModal';
import { notify } from '../../../utils/notify';

export default function PenjualanDiToko() {
  // Settings Panel Open
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dates
  const [dateFrom, setDateFrom] = useState('2026-06-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [isDateOpen, setIsDateOpen] = useState(false);

  // Search Filters
  const [searchFilter, setSearchFilter] = useState({ keyword: '', amount: '', showDeleted: false });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Table Column Filters
  const [filterJumlah, setFilterJumlah] = useState('All'); // 'All' | 'Dilunasi' | 'Parsial' | 'Belum Dilunasi'
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Terposting' | 'Belum Terposting' | 'Double Posted'
  const [filterPostPayment, setFilterPostPayment] = useState('All'); // 'All' | 'Terposting' | 'Belum Terposting' | 'Sebagian' | 'Tunda'

  // Selected row IDs
  const [selectedIds, setSelectedIds] = useState([]);

  // Row Transaction Logs State
  const [isRowLogOpen, setIsRowLogOpen] = useState(false);
  const [activeRowTxNo, setActiveRowTxNo] = useState('');
  const [rowLogs, setRowLogs] = useState([]);
  const [txLogsMap, setTxLogsMap] = useState({
    1: [
      { user: 'SYSTEM', action: 'POST', timestamp: '24 Jul 2026 22:49:57', source: 'DINE IN', description: 'post sales success' },
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '24 Jul 2026 22:49:42', source: 'DINE IN', description: 'posting process' }
    ],
    2: [
      { user: 'SYSTEM', action: 'POST', timestamp: '24 Jul 2026 22:50:11', source: 'DINE IN', description: 'post sales success' },
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '24 Jul 2026 22:49:55', source: 'DINE IN', description: 'posting process' }
    ]
  });

  // Mock Sales Data (based on Screenshot 1)
  const [salesData, setSalesData] = useState([
    { id: 1, date: '2026-07-24', txNo: 'EFC826072400000001', customer: '', amount: 75000, paymentStatus: 'Dilunasi', status: 'Terposting', postPayment: 'Terposting' },
    { id: 2, date: '2026-07-24', txNo: 'EFC826072400000002', customer: 'Gmh f.ndfj', amount: 70000, paymentStatus: 'Dilunasi', status: 'Terposting', postPayment: 'Terposting' },
    { id: 3, date: '2026-07-24', txNo: 'EFC826072400000003', customer: 'BAYU', amount: 75000, paymentStatus: 'Dilunasi', status: 'Terposting', postPayment: 'Terposting' },
    { id: 4, date: '2026-07-24', txNo: 'EFC826072400000004', customer: 'AGUS', amount: 35000, paymentStatus: 'Dilunasi', status: 'Terposting', postPayment: 'Terposting' },
    { id: 5, date: '2026-07-24', txNo: 'EFC826072400000005', customer: 'KEVIN', amount: 62500, paymentStatus: 'Dilunasi', status: 'Terposting', postPayment: 'Terposting' },
    { id: 6, date: '2026-07-24', txNo: '32FB26072400000001', customer: 'BAYU', amount: 25000, paymentStatus: 'Belum Dilunasi', status: 'Terposting', postPayment: 'Belum Terposting' },
    { id: 7, date: '2026-07-17', txNo: 'OL26071700000001', customer: 'Dika', amount: 0, paymentStatus: 'Belum Dilunasi', status: 'Belum Terposting', postPayment: 'Belum Terposting' },
    { id: 8, date: '2026-07-17', txNo: 'OL26071700000002', customer: 'PT Sinar Cemerlang', amount: 0, paymentStatus: 'Belum Dilunasi', status: 'Belum Terposting', postPayment: 'Belum Terposting' },
    { id: 9, date: '2026-07-17', txNo: 'OL26071700000003', customer: 'PT Sinar Cemerlang', amount: 0, paymentStatus: 'Belum Dilunasi', status: 'Belum Terposting', postPayment: 'Belum Terposting' },
  ]);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredData.map((row) => row.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));

    if (allVisibleSelected) {
      // Unselect all visible rows
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible rows
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Perform dynamic filtering based on search criteria, date ranges, and column header dropdown filters
  const filteredData = salesData.filter((row) => {
    // 1. Date Range
    const rowDate = new Date(row.date);
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (rowDate < from || rowDate > to) return false;

    // 2. Keyword Search (Tx No / Customer)
    if (searchFilter.keyword) {
      const kw = searchFilter.keyword.toLowerCase().trim();
      const matchesKw = row.txNo.toLowerCase().includes(kw) || (row.customer && row.customer.toLowerCase().includes(kw));
      if (!matchesKw) return false;
    }

    // 3. Amount Search
    if (searchFilter.amount) {
      const amt = Number(searchFilter.amount);
      if (row.amount !== amt) return false;
    }

    // 4. Header Column: Jumlah filter
    if (filterJumlah !== 'All') {
      if (row.paymentStatus !== filterJumlah) return false;
    }

    // 5. Header Column: Status filter
    if (filterStatus !== 'All') {
      if (row.status !== filterStatus) return false;
    }

    // 6. Header Column: Post Payment filter
    if (filterPostPayment !== 'All') {
      if (row.postPayment !== filterPostPayment) return false;
    }

    return true;
  });

  // Calculate enabled button triggers based on checked statuses
  const checkedItems = salesData.filter((row) => selectedIds.includes(row.id));
  const hasBelumPosted = checkedItems.length > 0 && checkedItems.some((row) => row.status === 'Belum Terposting' || row.postPayment === 'Belum Terposting');
  const hasPosted = checkedItems.length > 0 && checkedItems.some((row) => row.status === 'Terposting');

  // Actions
  const appendTxLog = (txId, actionLabel, userEmail = 'owner_brendy@gmail.com', sourceVal = 'DINE IN', descriptionVal = 'posting process') => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setTxLogsMap((prev) => {
      const current = prev[txId] || [
        { user: 'SYSTEM', action: 'CONFIRM', timestamp: '24 Jul 2026 22:49:42', source: 'DINE IN', description: 'posting process' }
      ];
      return {
        ...prev,
        [txId]: [
          { user: userEmail, action: actionLabel, timestamp: timeStr, source: sourceVal, description: descriptionVal },
          ...current
        ]
      };
    });
  };

  const handleOpenRowLog = (row) => {
    setActiveRowTxNo(row.txNo);
    const logs = txLogsMap[row.id] || [
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '24 Jul 2026 22:49:42', source: 'DINE IN', description: 'posting process' }
    ];
    setRowLogs(logs);
    setIsRowLogOpen(true);
  };

  const handlePost = () => {
    setSalesData((prev) =>
      prev.map((row) =>
        selectedIds.includes(row.id) ? { ...row, status: 'Terposting' } : row
      )
    );
    selectedIds.forEach((id) => {
      appendTxLog(id, 'POST', 'owner_brendy@gmail.com', 'DINE IN', 'post sales success');
    });
    notify({
      type: 'success',
      title: 'Berhasil Diposting',
      message: `${checkedItems.length} transaksi penjualan berhasil diposting ke jurnal akuntansi.`
    });
    setSelectedIds([]);
  };

  const handlePostPayment = () => {
    setSalesData((prev) =>
      prev.map((row) =>
        selectedIds.includes(row.id) ? { ...row, postPayment: 'Terposting' } : row
      )
    );
    selectedIds.forEach((id) => {
      appendTxLog(id, 'POST PAYMENT', 'owner_brendy@gmail.com', 'DINE IN', 'post payment success');
    });
    notify({
      type: 'success',
      title: 'Post Pembayaran Sukses',
      message: `${checkedItems.length} pembayaran transaksi berhasil diposting ke kas/bank.`
    });
    setSelectedIds([]);
  };

  const handleCancelPost = () => {
    setSalesData((prev) =>
      prev.map((row) =>
        selectedIds.includes(row.id) ? { ...row, status: 'Belum Terposting', postPayment: 'Belum Terposting' } : row
      )
    );
    selectedIds.forEach((id) => {
      appendTxLog(id, 'CANCEL', 'owner_brendy@gmail.com', 'DINE IN', 'cancel posting process');
    });
    notify({
      type: 'info',
      title: 'Posting Dibatalkan',
      message: `${checkedItems.length} transaksi berhasil dikembalikan ke status Belum Terposting.`
    });
    setSelectedIds([]);
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID');
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Belum Terhubung ke Kasir POS
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Data transaksi penjualan di bawah ini masih bersifat demonstratif (statis). 
            Hubungkan aplikasi kasir POS Anda pada menu integrasi untuk mensinkronisasi data riil.
          </p>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-base font-bold text-slate-900">Penjualan di Toko</h2>

      {/* Filter Row Header Component */}
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

      {/* POS Sales Table component */}
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

      {/* Footer statistics indicator */}
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center justify-between text-[11px] font-bold text-slate-500">
        <div>Menampilkan {filteredData.length} dari {salesData.length} entri transaksi penjualan</div>
        {selectedIds.length > 0 && (
          <div className="text-[#0088E8] bg-[#E6F4FF] px-3 py-1 rounded-md">
            {selectedIds.length} transaksi dipilih
          </div>
        )}
      </div>

      {/* Pop-up Modals */}
      <PenjualanSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        initialFilter={searchFilter}
        onApply={(filterObj) => {
          setSearchFilter(filterObj);
          setIsSearchOpen(false);
        }}
      />

      <PenjualanDateModal
        isOpen={isDateOpen}
        onClose={() => setIsDateOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={(dateObj) => {
          setDateFrom(dateObj.from);
          setDateTo(dateObj.to);
          setDateLabel(dateObj.label);
          setIsDateOpen(false);
        }}
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
