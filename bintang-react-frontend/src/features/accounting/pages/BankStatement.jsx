import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Upload, ChevronDown, ChevronLeft, ChevronRight, Calendar, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { notify } from '../../../utils/notify';
import apiClient from '../../../api/apiClient';

export default function BankStatement() {
  const [selectedAccount, setSelectedAccount] = useState('Semua Data');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Accounts list from API
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Statement list state
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Period state
  const [periodMode, setPeriodMode] = useState('Bulan'); // 'Sesuaikan', 'Bulan', 'Tahun'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Date range state for 'Sesuaikan'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Import Modal State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importAccount, setImportAccount] = useState('');
  const [importCurrency, setImportCurrency] = useState('IDR');
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Import Preview & Commit State
  const [importStep, setImportStep] = useState('upload'); // 'upload', 'preview'
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowAccountDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Accounts from API
  useEffect(() => {
    async function fetchAccounts() {
      setAccountsLoading(true);
      try {
        const res = await apiClient.get('/accounting/cash-bank-accounts/');
        const data = res.data.results || res.data || [];
        setAccounts(data);
        if (data.length > 0) {
          // Backend import/list endpoints expect the Account primary key,
          // while this dropdown endpoint returns CashBankAccount rows.
          setImportAccount(data[0].account.toString());
        }
      } catch (err) {
        console.error('Gagal memuat akun kas/bank:', err);
      } finally {
        setAccountsLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  // Compute date_from and date_to parameters
  const getFilterDates = () => {
    if (periodMode === 'Bulan') {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, currentDate.getMonth() + 1, 0).getDate();
      return {
        date_from: `${year}-${month}-01`,
        date_to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
      };
    } else if (periodMode === 'Tahun') {
      const year = currentDate.getFullYear();
      return {
        date_from: `${year}-01-01`,
        date_to: `${year}-12-31`,
      };
    } else if (periodMode === 'Sesuaikan') {
      return {
        date_from: dateFrom,
        date_to: dateTo,
      };
    }
    return { date_from: '', date_to: '' };
  };

  // Fetch Statements List from API
  const fetchStatements = async () => {
    setLoading(true);
    try {
      const { date_from, date_to } = getFilterDates();
      const params = { page };
      if (selectedAccount !== 'Semua Data') {
        params.account = selectedAccount;
      }
      if (date_from) params.date_from = date_from;
      if (date_to) params.date_to = date_to;
      if (searchTerm) params.search = searchTerm;

      const res = await apiClient.get('/accounting/bank-statement/', { params });
      const data = res.data;
      setStatements(data.results || data || []);
      const results = data.results || data || [];
      const total = data.total ?? data.count ?? results.length;
      setTotalCount(total);
      setTotalPages(data.num_pages || Math.max(1, Math.ceil(total / 25)));
    } catch (err) {
      console.error('Gagal memuat data bank statement:', err);
      notify({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: 'Tidak dapat mengambil data rekening koran dari server.',
      });
      setStatements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, [selectedAccount, periodMode, currentDate, dateFrom, dateTo, page, searchTerm]);

  const getMonthYearLabel = (dateObj) => {
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setPage(1);
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setPage(1);
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  // Step 1: Preview CSV Import
  const handlePreviewImport = async () => {
    if (!uploadedFile || !importAccount) {
      notify({
        type: 'warning',
        title: 'Lengkapi Data Impor',
        message: !uploadedFile
          ? 'Silakan pilih berkas CSV template terlebih dahulu.'
          : 'Silakan pilih akun kas/bank tujuan terlebih dahulu.',
      });
      return;
    }

    setPreviewLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('account', importAccount);
      const res = await apiClient.post('/accounting/bank-statement/import/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPreviewData(res.data);
      setImportStep('preview');
      notify({
        type: 'success',
        title: 'Pratinjau Berhasil',
        message: `Ditemukan ${res.data.valid_rows || 0} baris valid dari total ${res.data.total_rows || 0} baris.`,
      });
    } catch (err) {
      console.error('Gagal mempratinjau impor bank statement:', err);
      notify({
        type: 'error',
        title: 'Pratinjau Gagal',
        message: err.response?.data?.detail || 'Format file CSV tidak dapat diproses oleh server.',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Step 2: Commit CSV Import
  const handleCommitImport = async () => {
    if (!previewData || !previewData.rows || previewData.rows.length === 0) {
      notify({
        type: 'warning',
        title: 'Tidak Ada Data',
        message: 'Tidak ada baris valid yang dapat diimpor.',
      });
      return;
    }

    setCommitLoading(true);
    try {
      const payload = {
        account: importAccount ? Number(importAccount) : null,
        rows: previewData.rows.filter((l) => l.is_valid),
      };

      const res = await apiClient.post('/accounting/bank-statement/import/commit/', payload);
      notify({
        type: 'success',
        title: 'Impor Berhasil',
        message: `Berhasil menyimpan ${res.data.created || 0} transaksi rekening koran.`,
      });

      setIsImportOpen(false);
      setUploadedFile(null);
      setPreviewData(null);
      setImportStep('upload');
      fetchStatements();
    } catch (err) {
      console.error('Gagal menyimpan impor bank statement:', err);
      notify({
        type: 'error',
        title: 'Impor Gagal',
        message: err.response?.data?.detail || 'Gagal menyimpan transaksi rekening koran ke server.',
      });
    } finally {
      setCommitLoading(false);
    }
  };

  const getAccountLabel = (accId) => {
    const found = accounts.find((a) => a.account.toString() === accId.toString());
    return found ? `${found.account_code} - ${found.account_name}` : 'Semua Data';
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      {/* Upper header */}
      <div className="flex flex-wrap gap-4 items-center justify-between pb-1">
        <h2 className="text-base font-bold text-slate-900">Bank Statement (Rekening Koran)</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari deskripsi..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#0088E8] w-48 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
        {/* Left - Account Selector Dropdown */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              className="flex items-center justify-between w-64 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-bold cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <span>{selectedAccount === 'Semua Data' ? 'Semua Akun Kas/Bank' : getAccountLabel(selectedAccount)}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {showAccountDropdown && (
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-64 text-left text-xs font-bold animate-fade-in max-h-60 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccount('Semua Data');
                    setShowAccountDropdown(false);
                    setPage(1);
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  Semua Akun Kas/Bank
                </button>
                {accounts.map((acc) => (
                  <button
                    key={acc.account}
                    type="button"
                    onClick={() => {
                      setSelectedAccount(acc.account.toString());
                      setShowAccountDropdown(false);
                      setPage(1);
                    }}
                    className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                  >
                    {acc.account_code} - {acc.account_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center / Right - Unified Stacking Period & Date selector */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex flex-col items-center border border-slate-200 rounded-lg bg-white shadow-2xs overflow-visible">
            {periodMode === 'Bulan' && (
              <div className="flex items-center border-b border-slate-100 w-full relative">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
                >
                  <ChevronLeft size={13} />
                </button>
                <div
                  onClick={() => setShowMonthPicker(!showMonthPicker)}
                  className="flex-1 px-4 py-1 text-xs font-bold text-slate-700 text-center select-none flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 min-w-28"
                >
                  <Calendar size={12} className="text-slate-400 shrink-0" />
                  <span>{getMonthYearLabel(currentDate)}</span>
                  <ChevronDown size={11} className="text-slate-400 shrink-0" />
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer"
                >
                  <ChevronRight size={13} />
                </button>

                {showMonthPicker && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-56 grid grid-cols-3 gap-1 animate-fade-in text-[10px]">
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
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
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
                            setPage(1);
                          }}
                          className={`py-1.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                            isSelected ? 'bg-[#0088E8] text-white' : 'text-slate-600 hover:bg-slate-100'
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

            {periodMode === 'Tahun' && (
              <div className="flex items-center border-b border-slate-100 w-full py-1 px-4 font-bold text-slate-700 justify-center gap-1 select-none min-h-[29px]">
                <Calendar size={12} className="text-slate-400" />
                <span>Tahun {currentDate.getFullYear()}</span>
              </div>
            )}

            {periodMode === 'Sesuaikan' && (
              <div className="flex items-center border-b border-slate-100 w-full py-1 px-2 gap-1 justify-center min-h-[29px]">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="px-1 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-slate-700 bg-white"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="px-1 py-0.5 border border-slate-200 rounded text-[10px] font-bold text-slate-700 bg-white"
                />
              </div>
            )}

            <div className="flex items-center bg-slate-50/50 p-0.5 w-full rounded-b-lg border-t border-slate-100">
              {['Sesuaikan', 'Bulan', 'Tahun'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setPeriodMode(mode); setPage(1); }}
                  className={`flex-1 text-center py-1 px-3.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                    periodMode === mode ? 'bg-[#0088E8] text-white shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsImportOpen(true);
              setImportStep('upload');
              setUploadedFile(null);
              setPreviewData(null);
            }}
            className="px-4 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
          >
            <Upload size={13} className="text-slate-500" />
            <span>Import CSV</span>
          </button>
        </div>
      </div>

      {/* Bank Statement Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-[#0088E8]" />
            <span>Memuat data rekening koran...</span>
          </div>
        ) : statements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs gap-2">
            <FileText className="w-10 h-10 text-slate-300 stroke-[1.5]" />
            <p className="text-slate-600 font-bold">Tidak ada transaksi rekening koran (Bank Statement)</p>
            <p className="text-slate-400 font-normal text-[11px]">
              Gunakan tombol <span className="font-semibold text-slate-600">Import CSV</span> untuk mengunggah transaksi rekening koran bank.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 w-10">#</th>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Nama Akun</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3 text-right">Jumlah Mutasi</th>
                  <th className="px-5 py-3 text-center">Tipe</th>
                  <th className="px-5 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {statements.map((row, idx) => {
                  const isKredit = row.mutation_type === 'kredit';
                  const amountVal = row.mutation_amount || 0;
                  const accName = row.account_code && row.account_name
                    ? `${row.account_code} - ${row.account_name}`
                    : 'Akun Bank';
                  const isReconciled = row.status === 'reconciled' || row.status === 'Sudah Rekonsiliasi';

                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-slate-400">{(page - 1) * 25 + idx + 1}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {row.date ? new Date(row.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                      <td className="px-5 py-3 font-bold text-slate-800">{accName}</td>
                      <td className="px-5 py-3 text-slate-700">{row.description || row.desc || '-'}</td>
                      <td className={`px-5 py-3 text-right font-bold ${isKredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isKredit ? '+' : '-'}{formatIDR(amountVal)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isKredit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isKredit ? 'Masuk (K)' : 'Keluar (D)'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isReconciled ? 'bg-slate-100 text-slate-700' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isReconciled ? 'Sudah Rekonsiliasi' : 'Belum Rekonsiliasi'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalCount > 25 && (
          <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-600">
            <span>Total {totalCount} baris data</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-200 rounded bg-white hover:bg-slate-100 disabled:opacity-50 font-bold"
              >
                Sebelumnya
              </button>
              <span>Halaman {page} dari {totalPages}</span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 border border-slate-200 rounded bg-white hover:bg-slate-100 disabled:opacity-50 font-bold"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {isImportOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[999] animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl p-5 w-[700px] text-left space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                Import Bank Statement (Rekening Koran)
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsImportOpen(false);
                  setUploadedFile(null);
                  setPreviewData(null);
                  setImportStep('upload');
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {importStep === 'upload' ? (
              <>
                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <div className="relative flex-1 min-w-[220px]">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Target Akun Rekening Bank</label>
                    <select
                      value={importAccount}
                      onChange={(e) => setImportAccount(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.account} value={acc.account}>
                          {acc.account_code} - {acc.account_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative w-28">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Mata Uang</label>
                    <select
                      value={importCurrency}
                      onChange={(e) => setImportCurrency(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-750 cursor-pointer shadow-2xs"
                    >
                      <option value="IDR">IDR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>

                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
                    dragActive ? 'border-[#0088E8] bg-sky-50/20' : 'border-slate-200 bg-slate-50/20'
                  }`}
                >
                  <label className="flex flex-col items-center justify-center cursor-pointer space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Upload size={18} />
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      {uploadedFile ? (
                        <span className="text-[#0088E8] underline">{uploadedFile.name}</span>
                      ) : (
                        <>
                          Drop file CSV di sini atau <span className="text-[#0088E8] underline">klik untuk memilih berkas</span>
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold">
                      Format CSV: Tanggal (YYYY-MM-DD), Deskripsi, Nominal, Tipe (D/K)
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsImportOpen(false);
                      setUploadedFile(null);
                    }}
                    className="px-4 py-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handlePreviewImport}
                    disabled={!uploadedFile || previewLoading}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 ${
                      uploadedFile && !previewLoading
                        ? 'bg-[#0088E8] hover:bg-[#0077CC] text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {previewLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Pratinjau Impor</span>
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Preview Results Table */
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">Target Akun: </span>
                    <span className="text-slate-600">{getAccountLabel(importAccount)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 size={12} /> {previewData?.valid_rows || 0} Valid
                    </span>
                    {((previewData?.total_rows || 0) - (previewData?.valid_rows || 0)) > 0 && (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertCircle size={12} /> {(previewData?.total_rows || 0) - (previewData?.valid_rows || 0)} Error
                      </span>
                    )}
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">No</th>
                        <th className="p-2">Tanggal</th>
                        <th className="p-2">Deskripsi</th>
                        <th className="p-2 text-right">Nominal</th>
                        <th className="p-2 text-center">Tipe</th>
                        <th className="p-2 text-center">Status Validasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {(previewData?.rows || []).map((line, idx) => (
                        <tr key={idx} className={!line.is_valid ? 'bg-rose-50/30' : 'hover:bg-slate-50/50'}>
                          <td className="p-2 text-slate-400">{line.line_no || idx + 1}</td>
                          <td className="p-2">{line.date || '-'}</td>
                          <td className="p-2">{line.description || '-'}</td>
                          <td className="p-2 text-right font-bold">{formatIDR(line.mutation_amount)}</td>
                          <td className="p-2 text-center">{line.mutation_type || '-'}</td>
                          <td className="p-2 text-center">
                            {!line.is_valid ? (
                              <span className="text-rose-600 font-bold">{line.errors?.join('; ') || 'Invalid'}</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">Valid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setImportStep('upload')}
                    className="px-4 py-1.5 border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Kembali ke Berkas
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={commitLoading || (previewData?.valid_rows || 0) === 0}
                    className={`px-5 py-1.5 rounded-lg text-xs font-bold cursor-pointer shadow-2xs transition-colors flex items-center gap-1.5 ${
                      (previewData?.valid_rows || 0) > 0 && !commitLoading
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {commitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Proses Simpan Impor</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
