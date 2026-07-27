import { useState, useRef, useEffect } from 'react';
import { Filter, Settings, AlertTriangle, FileText, ChevronDown } from 'lucide-react';
import PembelianSettingsModal from '../components/pos/PembelianSettingsModal';
import PembelianSearchModal from '../components/pembelian/PembelianSearchModal';
import PembelianDateModal from '../components/pembelian/PembelianDateModal';
import PosLogModal from '../components/pos/PosLogModal';
import { notify } from '../../../utils/notify';

export default function Pembelian() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Date and Search Modals State
  const [dateFrom, setDateFrom] = useState('2026-06-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [isDateOpen, setIsDateOpen] = useState(false);

  const [searchFilter, setSearchFilter] = useState({ keyword: '', amount: '', showDeleted: false });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Log Modal States
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [activeTxNo, setActiveTxNo] = useState('');
  const [txLogs, setTxLogs] = useState([]);
  const [purchaseLogsMap, setPurchaseLogsMap] = useState({
    1: [
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '16 Jul 2026 14:32:10', source: 'BACKOFFICE', description: 'purchase process confirm' }
    ],
    2: [
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '17 Jul 2026 15:45:00', source: 'BACKOFFICE', description: 'purchase process confirm' }
    ],
    3: [
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '18 Jul 2026 09:12:11', source: 'BACKOFFICE', description: 'purchase process confirm' }
    ]
  });

  // Table lists
  const [purchaseData, setPurchaseData] = useState([
    { id: 1, date: '16-Jul-2026', txNo: 'PO26071600000001', supplier: 'Fkmvx', email: '', amount: 0, paymentStatus: 'Belum Bayar', status: 'Belum Terposting', postPayment: 'Belum Terposting' },
    { id: 2, date: '17-Jul-2026', txNo: 'PO26071700000002', supplier: 'Sinar Cemerlang, PT', email: '', amount: 0, paymentStatus: 'Belum Bayar', status: 'Belum Terposting', postPayment: 'Belum Terposting' },
    { id: 3, date: '18-Jul-2026', txNo: 'PO26071800000003', supplier: 'Jaya Makmur, CV', email: 'andre@jayamakmur.com', amount: 0, paymentStatus: 'Belum Bayar', status: 'Belum Terposting', postPayment: 'Belum Terposting' }
  ]);

  // Selections
  const [selectedIds, setSelectedIds] = useState([]);
  
  const [semuaStatus, setSemuaStatus] = useState(true);

  // Table Column Dropdowns
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null); // 'jumlah' | 'status' | 'pembayaran' | null
  const [filterJumlah, setFilterJumlah] = useState('All'); // 'All' | 'Dibayar' | 'Parsial' | 'Belum Bayar'
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Terposting' | 'Belum Terposting'
  const [filterPembayaran, setFilterPembayaran] = useState('All'); // 'All' | 'Dibayar' | 'Parsial' | 'Retur Pembelian' | 'Belum Bayar'

  const dropdownRef = useRef(null);

  // Close header dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const visibleIds = filteredData.map((row) => row.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const appendPurchaseLog = (txId, actionLabel, descText) => {
    const now = new Date();
    const timeStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setPurchaseLogsMap((prev) => {
      const current = prev[txId] || [
        { user: 'SYSTEM', action: 'CONFIRM', timestamp: '16 Jul 2026 14:32:10', source: 'BACKOFFICE', description: 'purchase process confirm' }
      ];
      return {
        ...prev,
        [txId]: [
          { user: 'owner_brendy@gmail.com', action: actionLabel, timestamp: timeStr, source: 'BACKOFFICE', description: descText },
          ...current
        ]
      };
    });
  };

  const handlePost = () => {
    setPurchaseData((prev) =>
      prev.map((row) =>
        selectedIds.includes(row.id) ? { ...row, status: 'Terposting' } : row
      )
    );
    selectedIds.forEach((id) => {
      appendPurchaseLog(id, 'POST', 'post purchase invoice success');
    });
    notify({
      type: 'success',
      title: 'Berhasil Diposting',
      message: `${selectedIds.length} transaksi pembelian berhasil diposting ke jurnal akuntansi.`
    });
    setSelectedIds([]);
  };

  const handleCancelPost = () => {
    setPurchaseData((prev) =>
      prev.map((row) =>
        selectedIds.includes(row.id) ? { ...row, status: 'Belum Terposting', postPayment: 'Belum Terposting' } : row
      )
    );
    selectedIds.forEach((id) => {
      appendPurchaseLog(id, 'CANCEL', 'cancel posting purchase invoice');
    });
    notify({
      type: 'info',
      title: 'Posting Dibatalkan',
      message: `${selectedIds.length} posting transaksi pembelian berhasil dibatalkan.`
    });
    setSelectedIds([]);
  };

  const handleOpenRowLog = (row) => {
    setActiveTxNo(row.txNo);
    const logs = purchaseLogsMap[row.id] || [
      { user: 'SYSTEM', action: 'CONFIRM', timestamp: '16 Jul 2026 14:32:10', source: 'BACKOFFICE', description: 'purchase process confirm' }
    ];
    setTxLogs(logs);
    setIsLogOpen(true);
  };

  // Filter logic
  const filteredData = purchaseData.filter((row) => {
    // 1. Date Range Filter
    const parts = row.date.split('-');
    const months = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
    const rowDate = new Date(parseInt(parts[2]), months[parts[1]], parseInt(parts[0]));
    
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    // Remove hours for clean day-level compare
    rowDate.setHours(0,0,0,0);
    from.setHours(0,0,0,0);
    to.setHours(0,0,0,0);
    
    if (rowDate < from || rowDate > to) return false;

    // 2. Keyword Search
    if (searchFilter.keyword) {
      const kw = searchFilter.keyword.toLowerCase().trim();
      const matchesKw = row.txNo.toLowerCase().includes(kw) || row.supplier.toLowerCase().includes(kw);
      if (!matchesKw) return false;
    }

    // 3. Amount Search
    if (searchFilter.amount) {
      const amt = Number(searchFilter.amount);
      if (row.amount !== amt) return false;
    }

    // 4. Column dropdowns
    if (filterJumlah !== 'All' && row.paymentStatus !== filterJumlah) return false;
    if (filterStatus !== 'All' && row.status !== filterStatus) return false;
    if (filterPembayaran !== 'All' && row.postPayment !== filterPembayaran) return false;
    return true;
  });

  const checkedItems = purchaseData.filter((row) => selectedIds.includes(row.id));
  const hasBelumPosted = checkedItems.length > 0 && checkedItems.some((row) => row.status === 'Belum Terposting' || row.postPayment === 'Belum Terposting');
  const hasPosted = checkedItems.length > 0 && checkedItems.some((row) => row.status === 'Terposting');

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Belum Terhubung ke POS Pembelian
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Data transaksi pembelian di bawah ini masih bersifat demonstratif (statis). 
            Hubungkan aplikasi POS Pembelian Anda pada menu integrasi untuk mensinkronisasi data riil.
          </p>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-base font-bold text-slate-900">Pembelian</h2>

      {/* Action Row */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        
        {/* Left Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-105 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Filter size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDateOpen(true)}
            className="px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-105 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {dateLabel} {dateFrom} - {dateTo}
          </button>

          <button
            type="button"
            onClick={() => setSemuaStatus(!semuaStatus)}
            className="flex items-center gap-2 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
              semuaStatus ? 'border-[#0088E8] bg-[#0088E8] text-white' : 'border-slate-300 bg-white'
            }`}>
              {semuaStatus && <span className="text-[9px] font-bold">✓</span>}
            </div>
            <span>Semua Status</span>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPosted}
            onClick={handleCancelPost}
            className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs border ${
              hasPosted
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            Batal Post
          </button>

          <button
            type="button"
            disabled={!hasBelumPosted}
            onClick={handlePost}
            className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs border ${
              hasBelumPosted
                ? 'bg-[#0088E8] hover:bg-[#0077CC] text-white border-transparent cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            Post
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs ml-1"
          >
            <Settings size={14} />
          </button>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                      filteredData.length > 0 && filteredData.every((row) => selectedIds.includes(row.id))
                        ? 'border-[#0088E8] bg-[#0088E8] text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {filteredData.length > 0 && filteredData.every((row) => selectedIds.includes(row.id)) && (
                      <span className="text-[9px] font-bold">✓</span>
                    )}
                  </button>
                </th>
                <th className="px-5 py-3.5">Tanggal Beli</th>
                <th className="px-5 py-3.5">Transaksi</th>
                <th className="px-5 py-3.5">Supplier</th>

                {/* Jumlah Column Filter */}
                <th className="px-5 py-3.5 text-right relative min-w-[120px]">
                  <div
                    onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'jumlah' ? null : 'jumlah')}
                    className="flex items-center justify-end gap-1 cursor-pointer select-none hover:text-slate-700 transition-colors"
                  >
                    <span>Jumlah</span>
                    <ChevronDown size={12} className="text-slate-400" />
                  </div>
                  {activeHeaderDropdown === 'jumlah' && (
                    <div ref={dropdownRef} className="absolute right-5 top-11 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-40 w-36 font-semibold animate-fade-in">
                      {['All', 'Dibayar', 'Parsial', 'Belum Bayar'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setFilterJumlah(opt);
                            setActiveHeaderDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                            filterJumlah === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </th>

                {/* Status Column Filter */}
                <th className="px-5 py-3.5 text-center relative min-w-[140px]">
                  <div
                    onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'status' ? null : 'status')}
                    className="flex items-center justify-center gap-1 cursor-pointer select-none hover:text-slate-700 transition-colors"
                  >
                    <span>Status</span>
                    <ChevronDown size={12} className="text-slate-400" />
                  </div>
                  {activeHeaderDropdown === 'status' && (
                    <div ref={dropdownRef} className="absolute left-1/2 -translate-x-1/2 top-11 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-40 w-36 font-semibold animate-fade-in">
                      {['All', 'Terposting', 'Belum Terposting'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setFilterStatus(opt);
                            setActiveHeaderDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                            filterStatus === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </th>

                {/* Pembayaran Column Filter */}
                <th className="px-5 py-3.5 text-center relative min-w-[140px]">
                  <div
                    onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'pembayaran' ? null : 'pembayaran')}
                    className="flex items-center justify-center gap-1 cursor-pointer select-none hover:text-slate-700 transition-colors"
                  >
                    <span>Pembayaran</span>
                    <ChevronDown size={12} className="text-slate-400" />
                  </div>
                  {activeHeaderDropdown === 'pembayaran' && (
                    <div ref={dropdownRef} className="absolute right-5 top-11 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-40 w-40 font-semibold animate-fade-in">
                      {['All', 'Dibayar', 'Parsial', 'Retur Pembelian', 'Belum Bayar'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setFilterPembayaran(opt);
                            setActiveHeaderDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                            filterPembayaran === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-750">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">
                    No Data
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-55/40 transition-colors">
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(row.id)}
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer ${
                          selectedIds.includes(row.id)
                            ? 'border-[#0088E8] bg-[#0088E8] text-white'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        {selectedIds.includes(row.id) && (
                          <span className="text-[9px] font-bold">✓</span>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-550 whitespace-nowrap">{row.date}</td>
                    <td className="px-5 py-3.5 text-sky-655 font-bold cursor-pointer hover:underline">
                      {row.txNo}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <div className="text-slate-800 font-bold">{row.supplier}</div>
                        {row.email && <div className="text-[10px] text-slate-400 font-normal">{row.email}</div>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-800">
                      IDR {row.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        row.status === 'Terposting'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        row.postPayment === 'Terposting'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {row.postPayment}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <div>Menampilkan {filteredData.length} dari {purchaseData.length} entri transaksi pembelian</div>
          
          <div className="flex items-center gap-1.5">
            <button className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
              &lt;
            </button>
            <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
              1
            </span>
            <button className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
              &gt;
            </button>
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      <PembelianSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Row Log Modal */}
      <PosLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        title={`Penjualan ${activeTxNo} Detail Log`}
        type="transaction"
        logs={txLogs}
      />

      {/* Search Filter Modal */}
      <PembelianSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        initialFilter={searchFilter}
        onApply={(filterObj) => {
          setSearchFilter(filterObj);
          setIsSearchOpen(false);
        }}
      />

      {/* Date Filter Modal */}
      <PembelianDateModal
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

    </div>
  );
}
