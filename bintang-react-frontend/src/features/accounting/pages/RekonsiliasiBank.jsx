import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Loader2, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { notify } from '../../../utils/notify';
import apiClient from '../../../api/apiClient';

export default function RekonsiliasiBank() {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Date Range States
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateRef = useRef(null);

  // Data & Loading States
  const [loading, setLoading] = useState(false);
  const [bankLines, setBankLines] = useState([]);
  const [internalLines, setInternalLines] = useState([]);

  // Match selection states
  const [selectedBankLine, setSelectedBankLine] = useState(null);
  const [selectedInternalLine, setSelectedInternalLine] = useState(null);
  const [matching, setMatching] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowAccountDropdown(false);
      if (dateRef.current && !dateRef.current.contains(e.target)) setShowDatePicker(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Fetch Accounts list
  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await apiClient.get('/accounting/cash-bank-accounts/');
        const data = res.data.results || res.data || [];
        setAccounts(data);
        if (data.length > 0) {
          setSelectedAccountId(data[0].account.toString());
        }
      } catch (err) {
        console.error('Gagal memuat akun kas/bank:', err);
      }
    }
    fetchAccounts();
  }, []);

  // Fetch Reconciliation Data from API
  const fetchReconciliationData = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const params = {
        account: selectedAccountId,
        date_from: dateFrom,
        date_to: dateTo,
      };
      const res = await apiClient.get('/accounting/bank-reconciliation/', { params });
      setBankLines(res.data.unreconciled_bank_statement || []);
      setInternalLines(res.data.unreconciled_internal || []);
      setSelectedBankLine(null);
      setSelectedInternalLine(null);
    } catch (err) {
      console.error('Gagal memuat data rekonsiliasi bank:', err);
      notify({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: err.response?.data?.detail || 'Tidak dapat mengambil data rekonsiliasi bank.',
      });
      setBankLines([]);
      setInternalLines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, [selectedAccountId, dateFrom, dateTo]);

  // Execute Match
  const handleExecuteMatch = async () => {
    if (!selectedBankLine || !selectedInternalLine) {
      notify({
        type: 'warning',
        title: 'Pilih Baris',
        message: 'Pilih 1 transaksi Bank Statement dan 1 transaksi Jurnal Internal untuk dicocokkan.',
      });
      return;
    }

    setMatching(true);
    try {
      const payload = {
        bank_statement_line: selectedBankLine.id,
        journal_entry_line: selectedInternalLine.id,
      };
      await apiClient.post('/accounting/bank-reconciliation/match/', payload);
      notify({
        type: 'success',
        title: 'Rekonsiliasi Berhasil',
        message: 'Transaksi berhasil dicocokkan dan berstatus Reconciled.',
      });
      fetchReconciliationData();
    } catch (err) {
      console.error('Gagal melakukan pencocokan:', err);
      notify({
        type: 'error',
        title: 'Rekonsiliasi Gagal',
        message: err.response?.data?.detail || (Array.isArray(err.response?.data) ? err.response?.data.join(', ') : 'Gagal mencocokkan transaksi.'),
      });
    } finally {
      setMatching(false);
    }
  };

  const formatIDR = (num) => {
    return (Number(num) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getAccountLabel = () => {
    const acc = accounts.find((a) => a.account.toString() === selectedAccountId);
    return acc ? `${acc.account_code} - ${acc.account_name}` : 'Pilih Akun Kas/Bank';
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      {/* Header title */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Rekonsiliasi Bank</h2>
        <button
          type="button"
          onClick={fetchReconciliationData}
          className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer font-bold"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Filters row */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between overflow-visible">
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            className="flex items-center justify-between w-64 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-bold cursor-pointer shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <span>{getAccountLabel()}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
          {showAccountDropdown && (
            <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-64 text-left text-xs font-bold animate-fade-in max-h-60 overflow-y-auto">
              {accounts.map((acc) => (
                <button
                  key={acc.account}
                  type="button"
                  onClick={() => {
                    setSelectedAccountId(acc.account.toString());
                    setShowAccountDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  {acc.account_code} - {acc.account_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date range picker */}
        <div ref={dateRef} className="relative">
          <button
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold text-xs"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>{dateFrom} s/d {dateTo}</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>
          {showDatePicker && (
            <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg p-3 w-64 text-left font-bold animate-fade-in space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tanggal Mulai</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Tanggal Akhir</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg outline-none text-xs text-slate-700 bg-white"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom(today);
                    setDateTo(today);
                    setShowDatePicker(false);
                  }}
                  className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded cursor-pointer"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(false)}
                  className="px-3 py-1 text-[10px] bg-[#0088E8] text-white rounded cursor-pointer font-bold"
                >
                  Terapkan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Reconciliation Screen: Side-by-Side Match Panels */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 flex flex-col items-center justify-center min-h-[350px] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0088E8]" />
          <span className="text-slate-500 font-bold">Memuat data transaksi pencocokan bank...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel Left: Bank Statement Lines */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <span>1. Bank Statement (Belum Rekonsiliasi)</span>
                <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {bankLines.length}
                </span>
              </h3>
            </div>
            <div className="max-h-[380px] overflow-y-auto space-y-2">
              {bankLines.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Tidak ada transaksi bank statement pending.
                </div>
              ) : (
                bankLines.map((line) => {
                  const isSelected = selectedBankLine?.id === line.id;
                  const isKredit = line.mutation_type === 'K' || line.kredit > 0;
                  return (
                    <div
                      key={line.id}
                      onClick={() => setSelectedBankLine(line)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0088E8] bg-sky-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-600 mb-1">
                        <span>{line.date}</span>
                        <span className={`font-bold ${isKredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isKredit ? '+' : '-'}{formatIDR(line.amount || line.debit || line.kredit)}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 line-clamp-1">{line.description}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Panel Right: Internal Journal Lines */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <span>2. Jurnal Buku Besar Internal</span>
                <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {internalLines.length}
                </span>
              </h3>
            </div>
            <div className="max-h-[380px] overflow-y-auto space-y-2">
              {internalLines.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Tidak ada transaksi jurnal internal belum terpasang.
                </div>
              ) : (
                internalLines.map((line) => {
                  const isSelected = selectedInternalLine?.id === line.id;
                  const isDebit = Number(line.debit) > 0;
                  return (
                    <div
                      key={line.id}
                      onClick={() => setSelectedInternalLine(line)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#0088E8] bg-sky-50/50 shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between text-slate-600 mb-1">
                        <span>{line.date || line.journal_entry?.date}</span>
                        <span className={`font-bold ${isDebit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isDebit ? '+' : '-'}{formatIDR(line.debit || line.kredit)}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 line-clamp-1">
                        {line.description || line.journal_entry?.description || 'Jurnal Entry'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Match Execution Footer Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs">
          <span className="text-slate-500">Pilihan Terpilih: </span>
          <span className="font-bold text-slate-800">
            {selectedBankLine ? `#BS-${selectedBankLine.id}` : 'Belum memilih Bank Statement'}
          </span>
          <span className="text-slate-400 px-2">|</span>
          <span className="font-bold text-slate-800">
            {selectedInternalLine ? `#JL-${selectedInternalLine.id}` : 'Belum memilih Jurnal Internal'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleExecuteMatch}
          disabled={!selectedBankLine || !selectedInternalLine || matching}
          className={`px-5 py-2 rounded-lg font-bold text-xs cursor-pointer shadow-2xs transition-colors flex items-center gap-2 ${
            selectedBankLine && selectedInternalLine && !matching
              ? 'bg-[#0088E8] hover:bg-[#0077CC] text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {matching ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
          <span>Cocokkan & Rekonsiliasi</span>
        </button>
      </div>
    </div>
  );
}
