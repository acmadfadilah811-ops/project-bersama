import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Download, Loader2, FileText } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import { downloadFile } from '../../../utils/downloadFile';
import { useAuth } from '../../../context/AuthContext';
import RincianMutasiAkun from './RincianMutasiAkun';
import BukuBesarDetailPrint from '../components/BukuBesarDetailPrint';

export default function BukuBesar({ onToggleSidebar }) {
  const { user, businessSettings } = useAuth();
  const activeUserLabel = user?.username || 'owner_brendy';

  const [viewingAccountId, setViewingAccountId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [allCoaAccounts, setAllCoaAccounts] = useState([]); // All accounts up to 81000
  const [loading, setLoading] = useState(true);

  // Synchronize sidebar visibility
  useEffect(() => {
    const isDetail = viewingAccountId !== null;
    if (onToggleSidebar) {
      onToggleSidebar(isDetail);
    }
    return () => {
      if (onToggleSidebar) {
        onToggleSidebar(false);
      }
    };
  }, [viewingAccountId, onToggleSidebar]);

  // Period / Date Mode state: 'Sesuaikan', 'Bulan', 'Tahun' (Screenshot 1)
  const [dateMode, setDateMode] = useState('Bulan');
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states for PDF/Excel buttons
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);
  const [showOutletDropdown, setShowOutletDropdown] = useState(false);

  // Cetak PDF - Detail Rincian (window.print() setelah data ter-fetch, lihat handlePrintDetail)
  const [detailPrintData, setDetailPrintData] = useState(null);
  const [loadingDetailPrint, setLoadingDetailPrint] = useState(false);

  const pdfRef = useRef(null);
  const excelRef = useRef(null);
  const outletRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const clickOutside = (e) => {
      if (pdfRef.current && !pdfRef.current.contains(e.target)) setShowPdfDropdown(false);
      if (excelRef.current && !excelRef.current.contains(e.target)) setShowExcelDropdown(false);
      if (outletRef.current && !outletRef.current.contains(e.target)) setShowOutletDropdown(false);
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  // Fetch full accounts list for dropdown selection
  useEffect(() => {
    apiClient
      .get('/accounting/accounts/', { params: { semua_akun: 'true' } })
      .then((res) => {
        setAllCoaAccounts((res.data || []).filter((account) => account.is_active !== false));
      })
      .catch(() => {});
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
    let fromStr;
    let toStr;
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

  const fetchLedgerSummary = () => {
    setLoading(true);
    const { date_from, date_to } = resolveDates();

    apiClient
      .get('/accounting/ledger/', {
        params: { date_from, date_to, search: searchQuery },
      })
      .then((res) => {
        setAccounts(res.data || []);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat Ringkasan Buku Besar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!viewingAccountId) {
      fetchLedgerSummary();
    }
  }, [currentDate, currentYear, dateMode, customDateFrom, customDateTo, searchQuery, viewingAccountId]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleDownloadExcel = (type) => {
    const { date_from, date_to } = resolveDates();
    if (type === 'ringkasan') {
      downloadFile(`/accounting/ledger/export/?date_from=${date_from}&date_to=${date_to}`, 'buku-besar-ringkasan.xlsx');
    } else {
      downloadFile(`/accounting/ledger/export-detail/?date_from=${date_from}&date_to=${date_to}`, 'buku-besar-detail.xlsx');
    }
    setShowExcelDropdown(false);
  };

  const handlePrintDetail = async () => {
    setLoadingDetailPrint(true);
    const { date_from, date_to } = resolveDates();
    try {
      const res = await apiClient.get('/accounting/ledger/detail/', {
        params: { date_from, date_to, search: searchQuery },
      });
      setDetailPrintData(res.data);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat detail Buku Besar untuk dicetak');
    } finally {
      setLoadingDetailPrint(false);
    }
  };

  // window.print() dipanggil di sini (bukan langsung setelah setDetailPrintData)
  // supaya menunggu BukuBesarDetailPrint benar-benar ter-render dulu di DOM.
  useEffect(() => {
    if (detailPrintData) {
      window.print();
    }
  }, [detailPrintData]);

  const handlePrintPDF = (type) => {
    if (type === 'ringkasan') {
      window.print();
    } else {
      handlePrintDetail();
    }
    setShowPdfDropdown(false);
  };

  if (viewingAccountId) {
    return (
      <RincianMutasiAkun
        accountId={viewingAccountId}
        onBack={() => setViewingAccountId(null)}
        accounts={allCoaAccounts}
        setViewingAccountId={setViewingAccountId}
        initialDateFrom={resolveDates().date_from}
        initialDateTo={resolveDates().date_to}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Upper header with Outlet selector (Active Account Username) */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Buku Besar</h2>
        
        <div className="flex items-center gap-2">
          {/* Active user label dropdown selector */}
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
              <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-36 text-left text-xs font-bold animate-fade-in">
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
        </div>
      </div>

      {/* Date Toggle, Search, Exports row (Screenshot 1) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          
          {/* Date Selector Box Container (Screenshot 1) */}
          <div className="flex flex-col border border-slate-200 rounded-xl bg-white shadow-2xs p-2 min-w-[280px]">
            {/* Header selector options: Sesuaikan, Bulan, Tahun */}
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-lg text-center text-[10px] font-extrabold text-slate-500 mb-2">
              {['Sesuaikan', 'Bulan', 'Tahun'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateMode(mode)}
                  className={`py-1 rounded-md transition-all cursor-pointer ${
                    dateMode === mode ? 'bg-[#0088E8] text-white shadow-2xs' : 'hover:bg-slate-200/50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Date value rendering depending on chosen mode */}
            {dateMode === 'Bulan' && (
              <div className="flex items-center justify-between border border-slate-150 rounded-lg bg-white relative py-1 px-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer border-r border-slate-100"
                >
                  <ChevronLeft size={13} />
                </button>
                <div
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  className="px-3 text-[11px] font-bold text-slate-700 select-none cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-1.5"
                >
                  <span>{getMonthYearLabel(currentDate)}</span>
                  <ChevronDown size={11} className="text-slate-405 shrink-0" />
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer border-l border-slate-100"
                >
                  <ChevronRight size={13} />
                </button>

                {showMonthPicker && (
                  <div className="absolute top-full left-0 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-60 grid grid-cols-3 gap-1 animate-fade-in">
                    <div className="col-span-3 flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate((prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronLeft size={11} />
                      </button>
                      <span className="text-xs font-bold text-slate-700">{currentDate.getFullYear()}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentDate((prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
                        }}
                        className="p-1 hover:bg-slate-105 rounded text-slate-500 cursor-pointer"
                      >
                        <ChevronRight size={11} />
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
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {mName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {dateMode === 'Tahun' && (
              <div className="flex items-center justify-between border border-slate-150 rounded-lg bg-white py-1 px-2 text-[11px] font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => setCurrentYear((prev) => prev - 1)}
                  className="p-1 hover:bg-slate-50 cursor-pointer text-slate-550"
                >
                  <ChevronLeft size={13} />
                </button>
                <span>Periode Tahun: {currentYear}</span>
                <button
                  type="button"
                  onClick={() => setCurrentYear((prev) => prev + 1)}
                  className="p-1 hover:bg-slate-50 cursor-pointer text-slate-550"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}

            {dateMode === 'Sesuaikan' && (
              <div className="space-y-1.5 text-left">
                <span className="text-[9px] font-extrabold text-[#0088E8] block">Periode Sesuaikan</span>
                <div className="flex gap-1 items-center">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded text-[10px] font-semibold bg-slate-50 focus:bg-white outline-none w-full"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">s/d</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded text-[10px] font-semibold bg-slate-50 focus:bg-white outline-none w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Search bar */}
          <input
            type="text"
            placeholder="Cari berdasarkan No/Nama Akun"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 border border-slate-205 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold min-w-64"
          />
        </div>

        {/* Action dropdown buttons */}
        <div className="flex items-center gap-2">
          {/* PDF export options */}
          <div ref={pdfRef} className="relative">
            <button
              type="button"
              onClick={() => setShowPdfDropdown(!showPdfDropdown)}
              className="flex items-center gap-1 px-4 py-1.5 bg-slate-105 border border-slate-205 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              <span>PDF</span>
              <ChevronDown size={13} />
            </button>
            {showPdfDropdown && (
              <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-32 text-left text-xs font-bold animate-fade-in">
                <button
                  type="button"
                  onClick={() => handlePrintPDF('detail')}
                  disabled={loadingDetailPrint}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingDetailPrint && <Loader2 size={12} className="animate-spin" />}
                  <span>Detail</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintPDF('ringkasan')}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  Ringkasan
                </button>
              </div>
            )}
          </div>

          {/* Excel export options */}
          <div ref={excelRef} className="relative">
            <button
              type="button"
              onClick={() => setShowExcelDropdown(!showExcelDropdown)}
              className="flex items-center gap-1 px-4 py-1.5 bg-slate-105 border border-slate-205 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              <span>Excel</span>
              <ChevronDown size={13} />
            </button>
            {showExcelDropdown && (
              <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-32 text-left text-xs font-bold animate-fade-in">
                <button
                  type="button"
                  onClick={() => handleDownloadExcel('detail')}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadExcel('ringkasan')}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  Ringkasan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Overview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
            <p className="text-xs font-semibold">Memuat Buku Besar...</p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs font-semibold">
            Tidak ada akun yang ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#0088E8] text-white font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Nomor Akun</th>
                  <th className="px-5 py-3">Nama Akun</th>
                  <th className="px-5 py-3">Klasifikasi</th>
                  <th className="px-5 py-3 text-right">Debit</th>
                  <th className="px-5 py-3 text-right">Kredit</th>
                  <th className="px-5 py-3 text-right">Saldo</th>
                  <th className="px-5 py-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {accounts.map((acc) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-505">{acc.code}</td>
                    <td className="px-5 py-3 text-slate-800 font-bold">{acc.name}</td>
                    <td className="px-5 py-3 text-slate-600">{acc.klasifikasi || '-'}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">
                      {acc.debit > 0 ? formatIDR(acc.debit) : '0'}
                    </td>
                    <td className="px-5 py-3 text-right text-rose-600">
                      {acc.kredit > 0 ? formatIDR(acc.kredit) : '0'}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-slate-850">
                      {formatIDR(acc.saldo)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => setViewingAccountId(acc.id)}
                        className="w-6 h-6 rounded-full bg-[#0088E8]/10 text-[#0088E8] hover:bg-[#0088E8]/20 flex items-center justify-center cursor-pointer mx-auto transition-colors"
                        title="Lihat Mutasi Detail"
                      >
                        <FileText size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BukuBesarDetailPrint
        data={detailPrintData}
        businessName={businessSettings?.nama_bisnis}
        dateFromLabel={resolveDates().date_from}
        dateToLabel={resolveDates().date_to}
      />
    </div>
  );
}
