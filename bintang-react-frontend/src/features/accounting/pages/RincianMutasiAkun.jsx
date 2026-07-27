import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Download, FileText, Loader2, Search, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notify } from '../../../utils/notify';
import { downloadFile } from '../../../utils/downloadFile';
import { useAuth } from '../../../context/AuthContext';

export default function RincianMutasiAkun({
  accountId,
  onBack,
  accounts = [],
  setViewingAccountId,
  initialDateFrom,
  initialDateTo
}) {
  const { user } = useAuth();
  const activeUserLabel = user?.username || 'owner_brendy';

  const [account, setAccount] = useState(null);
  const [rows, setRows] = useState([]);
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Period / Date States inside detail view
  const [dateMode, setDateMode] = useState('Bulan');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026
  const [currentYear, setCurrentYear] = useState(2026);
  const [customDateFrom, setCustomDateFrom] = useState(initialDateFrom || '2026-07-01');
  const [customDateTo, setCustomDateTo] = useState(initialDateTo || '2026-07-31');
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Filter and search states (Screenshot 2)
  const [selectedFilter, setSelectedFilter] = useState('Semua');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showOutletDropdown, setShowOutletDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const filterRef = useRef(null);
  const exportRef = useRef(null);
  const outletRef = useRef(null);
  const accountRef = useRef(null);
  const periodRef = useRef(null);

  const filterOptions = [
    'Semua',
    'No. Transaksi',
    'Nama Tipe Transaksi',
    'Pelanggan',
    'Supplier',
    'Departemen',
    'No. Dokumen',
    'Deskripsi',
    'Mata Uang',
  ];

  // Click outside dropdowns listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilterDropdown(false);
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportDropdown(false);
      if (outletRef.current && !outletRef.current.contains(e.target)) setShowOutletDropdown(false);
      if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccountDropdown(false);
      if (periodRef.current && !periodRef.current.contains(e.target)) setShowPeriodDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPeriodString = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const getPeriodEndString = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  };

  const getMonthYearLabel = (dateObj) => {
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const resolveDates = () => {
    let fromStr = '';
    let toStr = '';
    if (dateMode === 'Bulan') {
      const period = getPeriodString(currentDate);
      fromStr = `${period}-01`;
      toStr = getPeriodEndString(currentDate);
    } else if (dateMode === 'Tahun') {
      fromStr = `${currentYear}-01-01`;
      toStr = `${currentYear}-12-31`;
    } else {
      fromStr = customDateFrom;
      toStr = customDateTo;
    }
    return { date_from: fromStr, date_to: toStr };
  };

  const fetchMutationDetails = () => {
    setLoading(true);
    const { date_from, date_to } = resolveDates();

    apiClient
      .get(`/accounting/ledger/${accountId}/`, {
        params: { date_from, date_to },
      })
      .then((res) => {
        setAccount(res.data?.account || null);
        setSaldoAwal(res.data?.saldo_awal || 0);
        setRows(res.data?.rows || []);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat rincian mutasi akun'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMutationDetails();
  }, [currentDate, currentYear, dateMode, customDateFrom, customDateTo, accountId]);

  const handlePrevPeriod = () => {
    if (dateMode === 'Bulan') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (dateMode === 'Tahun') {
      setCurrentYear((prev) => prev - 1);
    }
  };

  const handleNextPeriod = () => {
    if (dateMode === 'Bulan') {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (dateMode === 'Tahun') {
      setCurrentYear((prev) => prev + 1);
    }
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExport = (format) => {
    const { date_from, date_to } = resolveDates();
    if (format === 'excel') {
      downloadFile(`/accounting/ledger/${accountId}/export/?date_from=${date_from}&date_to=${date_to}`, 'rincian-mutasi-akun.xlsx');
    } else {
      window.print();
    }
    setShowExportDropdown(false);
  };

  // Client-side dynamic filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const query = searchQuery.toLowerCase();

    return rows.filter((row) => {
      switch (selectedFilter) {
        case 'No. Transaksi':
          return (row.entry_number || '').toLowerCase().includes(query);
        case 'Nama Tipe Transaksi':
          return (row.description || '').toLowerCase().includes(query);
        case 'Pelanggan':
          return (row.pelanggan_supplier || '').toLowerCase().includes(query) && !(row.pelanggan_supplier || '').toLowerCase().includes('supplier');
        case 'Supplier':
          return (row.pelanggan_supplier || '').toLowerCase().includes(query) && !(row.pelanggan_supplier || '').toLowerCase().includes('pembeli');
        case 'No. Dokumen':
          return (row.external_document_no || '').toLowerCase().includes(query);
        case 'Deskripsi':
          return (row.description || '').toLowerCase().includes(query);
        case 'Mata Uang':
          return 'idr'.includes(query) || 'rupiah'.includes(query);
        case 'Semua':
        default:
          return (
            (row.entry_number || '').toLowerCase().includes(query) ||
            (row.pelanggan_supplier || '').toLowerCase().includes(query) ||
            (row.description || '').toLowerCase().includes(query) ||
            (row.external_document_no || '').toLowerCase().includes(query) ||
            formatDateLabel(row.date).toLowerCase().includes(query)
          );
      }
    });
  }, [rows, selectedFilter, searchQuery]);

  return (
    <div className="space-y-4 animate-fade-in pb-12">
      
      {/* 1. Upper Header Section (Screenshot 2) */}
      <div className="flex flex-wrap gap-4 items-center justify-between pb-1">
        <div className="flex items-center gap-3">
          {/* Outlet Selection Dropdown */}
          <div ref={outletRef} className="relative">
            <button
              type="button"
              onClick={() => setShowOutletDropdown(!showOutletDropdown)}
              className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-205 bg-white text-xs font-bold text-slate-700 rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              <span>{activeUserLabel}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            {showOutletDropdown && (
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left text-xs font-bold animate-fade-in">
                <button
                  type="button"
                  onClick={() => setShowOutletDropdown(false)}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  {activeUserLabel}
                </button>
              </div>
            )}
          </div>

          {/* Account Selector Dropdown (lists up to 81000 - Penyesuaian barang) */}
          <div ref={accountRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-205 bg-white text-xs font-bold text-slate-808 rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              <span>{account ? `${account.code} ${account.name}` : 'Pilih Akun'}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            {showAccountDropdown && (
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-64 max-h-[300px] overflow-y-auto text-left text-xs font-bold animate-fade-in">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setViewingAccountId(acc.id);
                      setShowAccountDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left transition-colors cursor-pointer block border-b border-slate-50 last:border-b-0 ${
                      String(accountId) === String(acc.id)
                        ? 'bg-blue-50 text-[#0088E8]'
                        : 'text-slate-705 hover:bg-slate-50'
                    }`}
                  >
                    {acc.code} {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Back green border button */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-1.5 border border-[#73C240] bg-white hover:bg-slate-50 text-[#73C240] font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
        >
          <ChevronLeft size={13} />
          <span>Kembali</span>
        </button>
      </div>

      {/* 2. Filter Navigation and Export Actions Row (Screenshot 2) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between">
        
        {/* Left filter options */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Clickable Blue Period Badge dropdown (notif only applies here!) */}
          <div ref={periodRef} className="relative inline-block text-left">
            <button
              type="button"
              onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
              className="px-3 py-1.5 rounded-lg bg-[#0088E8] text-white text-[10px] font-extrabold cursor-pointer hover:bg-[#0077CC] flex items-center gap-1 select-none shadow-2xs"
            >
              <span>{dateMode === 'Bulan' ? 'Periode Bulan' : dateMode === 'Tahun' ? 'Periode Tahun' : 'Periode Sesuaikan'}</span>
              <ChevronDown size={10} className="text-white opacity-80" />
            </button>
            {showPeriodDropdown && (
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-32 text-left text-xs font-bold animate-fade-in">
                {['Sesuaikan', 'Bulan', 'Tahun'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setDateMode(mode);
                      setShowPeriodDropdown(false);
                      // Trigger notice ONLY here in detailed view!
                      notify({
                        type: 'warning',
                        title: 'Peringatan',
                        message: 'Filter periode dan range tidak boleh terisi sekaligus, silakan gunakan salah satu saja.'
                      });
                    }}
                    className="w-full px-4 py-1.5 text-slate-700 hover:bg-slate-50 text-left cursor-pointer transition-colors"
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Caret separator (>>) */}
          <span className="text-slate-400 font-bold text-xs select-none">»</span>

          {/* Date range selection navigator */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs relative">
            <button
              type="button"
              onClick={handlePrevPeriod}
              disabled={dateMode === 'Sesuaikan'}
              className="p-1.5 hover:bg-slate-50 text-slate-500 disabled:text-slate-300 transition-colors cursor-pointer border-r border-slate-200"
            >
              <ChevronLeft size={14} />
            </button>
            
            {/* Click monthly label to trigger monthly picker overlay */}
            <div
              onClick={() => {
                if (dateMode === 'Bulan') setShowMonthPicker(!showMonthPicker);
              }}
              className="px-4 py-1.5 text-xs font-bold text-slate-700 min-w-32 text-center select-none cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-1"
            >
              {dateMode === 'Bulan' ? (
                <>
                  <span>{getMonthYearLabel(currentDate)}</span>
                  <ChevronDown size={12} className="text-slate-400 shrink-0" />
                </>
              ) : dateMode === 'Tahun' ? (
                <span>{currentYear}</span>
              ) : (
                <span>{formatDateLabel(customDateFrom)} - {formatDateLabel(customDateTo)}</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextPeriod}
              disabled={dateMode === 'Sesuaikan'}
              className="p-1.5 hover:bg-slate-50 text-slate-500 disabled:text-slate-300 transition-colors cursor-pointer border-l border-slate-200"
            >
              <ChevronRight size={14} />
            </button>

            {/* Month Picker Overlay */}
            {showMonthPicker && dateMode === 'Bulan' && (
              <div className="absolute top-full left-0 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-64 grid grid-cols-3 gap-1 animate-fade-in">
                <div className="col-span-3 flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <span className="text-xs font-bold text-slate-700">{currentDate.getFullYear()}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
                    }}
                    className="p-1 hover:bg-slate-100 rounded text-slate-505 cursor-pointer"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>

                {Array.from({ length: 12 }, (_, i) => {
                  const mName = new Date(2026, i, 1).toLocaleDateString('id-ID', { month: 'short' });
                  const isSelected = currentDate.getMonth() === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentDate(new Date(currentDate.getFullYear(), i, 1));
                        setShowMonthPicker(false);
                      }}
                      className={`py-1.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#0088E8] text-white'
                          : 'text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      {mName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pilih Filter Dropdown Selector (Screenshot 2) */}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between w-40 px-3 py-1.5 border border-slate-205 bg-white text-slate-650 rounded-lg text-xs font-bold cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <span>{selectedFilter}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {showFilterDropdown && (
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-40 text-left text-xs font-bold animate-fade-in max-h-[220px] overflow-y-auto">
                {filterOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setSelectedFilter(opt);
                      setShowFilterDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search box input with glass icon */}
          <div className="relative w-48">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={12} />
            </span>
            <input
              type="text"
              placeholder="Cari..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold shadow-2xs"
            />
          </div>
        </div>

        {/* Right export options */}
        <div ref={exportRef} className="relative">
          <button
            type="button"
            onClick={() => setShowExportDropdown(!showExportDropdown)}
            className="flex items-center gap-1.5 px-4 py-1.5 border border-slate-205 hover:bg-slate-50 text-slate-700 bg-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
          >
            <span>Export</span>
            <ChevronDown size={13} />
          </button>
          {showExportDropdown && (
            <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left text-xs font-bold animate-fade-in">
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
              >
                Export Excel
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 3. Detailed Mutations Table - NO ACTION COLUMN */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
            <p className="text-xs font-bold">Memuat Rincian Mutasi...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-bold text-xs bg-slate-50/10">
            Tidak ada transaksi mutasi untuk kriteria pencarian terpilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">No. Transaksi</th>
                  <th className="px-5 py-3">Pelanggan / Supplier</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3 text-right">Debit</th>
                  <th className="px-5 py-3 text-right">Kredit</th>
                  <th className="px-5 py-3 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {/* Saldo Awal row */}
                <tr className="bg-slate-50/30 text-slate-650 font-bold">
                  <td className="px-5 py-3" colSpan={4}>
                    Saldo Awal
                  </td>
                  <td className="px-5 py-3 text-right">-</td>
                  <td className="px-5 py-3 text-right">-</td>
                  <td className="px-5 py-3 text-right font-extrabold text-slate-800">
                    {formatIDR(saldoAwal)}
                  </td>
                </tr>

                {/* Mutation lines */}
                {(() => {
                  let running = saldoAwal;
                  const isDebitNormal = account?.classification?.account_type === 'asset' ||
                                       account?.classification?.account_type === 'expense' ||
                                       (account?.classification?.name && (
                                         account.classification.name === 'Kas & Bank' ||
                                         account.classification.name === 'Piutang' ||
                                         account.classification.name === 'Persediaan'
                                       ));

                  return filteredRows.map((row, idx) => {
                    const dVal = Number(row.debit) || 0;
                    const kVal = Number(row.kredit) || 0;
                    
                    if (isDebitNormal) {
                      running = running + dVal - kVal;
                    } else {
                      running = running + kVal - dVal;
                    }

                    return (
                      <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                        <td className="px-5 py-3 text-slate-505 whitespace-nowrap">
                          {formatDateLabel(row.date)}
                        </td>
                        <td className="px-5 py-3 text-[#0088E8] font-bold">
                          {row.entry_number}
                        </td>
                        <td className="px-5 py-3">
                          {row.pelanggan_supplier || '-'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="space-y-0.5">
                            <p className="text-slate-800">{row.description}</p>
                            {row.external_document_no && (
                              <p className="text-[10px] text-slate-450 font-semibold">
                                #{row.external_document_no}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-emerald-600 font-bold whitespace-nowrap">
                          {dVal > 0 ? formatIDR(dVal) : '0,00'}
                        </td>
                        <td className="px-5 py-3 text-right text-rose-600 font-bold whitespace-nowrap">
                          {kVal > 0 ? formatIDR(kVal) : '0,00'}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          {formatIDR(running)}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
