import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar, Plus, Loader2, Filter } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notify } from '../../../utils/notify';
import { downloadFile } from '../../../utils/downloadFile';
import { useAuth } from '../../../context/AuthContext';

// Import sub-components
import FilterKasBankModal from '../components/kasbank/FilterKasBankModal';
import TransferKasForm from '../components/kasbank/TransferKasForm';
import DraftJurnalList from '../components/kasbank/DraftJurnalList';
import ListKasBankTable from '../components/kasbank/ListKasBankTable';
import RincianMutasiKasBank from '../components/kasbank/RincianMutasiKasBank';

export default function ListKasBank({ onToggleSidebar, initialViewState = 'list' }) {
  const { user } = useAuth();

  const [viewState, setViewState] = useState(initialViewState); // 'list', 'transfer', or 'detail'
  const [viewingAccountId, setViewingAccountId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // List View States
  const [accounts, setAccounts] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  
  // Search & Filter Modal States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterAmount, setFilterAmount] = useState('');
  const [filterNonZeroOnly, setFilterNonZeroOnly] = useState(false);
  
  // Applied filters
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedAmount, setAppliedAmount] = useState('');

  // Transfer Form States (Left Side)
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [debitAccId, setDebitAccId] = useState('');
  const [creditAccId, setCreditAccId] = useState('');
  const [catatan, setCatatan] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [noDokumen, setNoDokumen] = useState('');

  // Draf Jurnal States (Right Side)
  const [drafts, setDrafts] = useState([]);

  // All Kas & Bank COA accounts
  const [kasBankAccounts, setKasBankAccounts] = useState([]);

  // Dropdown states
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const pdfRef = useRef(null);

  useEffect(() => {
    setViewState(initialViewState);
  }, [initialViewState]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (pdfRef.current && !pdfRef.current.contains(e.target)) {
        setShowPdfDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    apiClient
      .get('/accounting/accounts/', { params: { semua_akun: 'true' } })
      .then((res) => {
        const list = res.data || [];
        const kb = list.filter(
          (acc) =>
            acc.classification?.name === 'Kas & Bank' ||
            String(acc.code).startsWith('111')
        );
        setKasBankAccounts(kb);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const isTransferOrDetail = viewState === 'transfer' || viewState === 'detail';
    if (onToggleSidebar) {
      onToggleSidebar(isTransferOrDetail);
    }
    return () => {
      if (onToggleSidebar) {
        onToggleSidebar(false);
      }
    };
  }, [viewState, onToggleSidebar]);

  const resolveDates = () => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, currentDate.getMonth() + 1, 0).getDate();
    return {
      date_from: `${year}-${month}-01`,
      date_to: `${year}-${month}-${lastDay}`
    };
  };

  const fetchBalances = () => {
    setLoading(true);
    const { date_from, date_to } = resolveDates();

    apiClient
      .get('/accounting/ledger/', {
        params: { date_from, date_to },
      })
      .then((res) => {
        const ledgerData = res.data || [];
        let filtered = ledgerData.filter(
          (acc) =>
            acc.klasifikasi === 'Kas & Bank' ||
            String(acc.code).startsWith('111')
        );

        if (appliedSearch.trim()) {
          const q = appliedSearch.toLowerCase();
          filtered = filtered.filter(
            (acc) =>
              acc.code.toLowerCase().includes(q) ||
              acc.name.toLowerCase().includes(q)
          );
        }

        if (appliedAmount) {
          const amt = Number(appliedAmount);
          filtered = filtered.filter((acc) => Math.abs(acc.saldo) === amt);
        }

        if (filterNonZeroOnly) {
          filtered = filtered.filter((acc) => Number(acc.saldo) !== 0);
        }

        setAccounts(filtered);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat List Kas & Bank'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (viewState === 'list') {
      fetchBalances();
    }
  }, [currentDate, viewState, appliedSearch, appliedAmount, filterNonZeroOnly]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getMonthYearLabel = (dateObj) => {
    return dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAddDraft = () => {
    const debitAcc = kasBankAccounts.find((a) => String(a.id) === String(debitAccId));
    const creditAcc = kasBankAccounts.find((a) => String(a.id) === String(creditAccId));

    const newDraft = {
      id: Date.now(),
      date: txDate || new Date().toISOString().split('T')[0],
      debitAcc,
      creditAcc,
      notes: catatan,
      amount: Number(jumlah) || 0,
      docNo: noDokumen,
      isCollapsed: false,
    };

    setDrafts([...drafts, newDraft]);

    setDebitAccId('');
    setCreditAccId('');
    setCatatan('');
    setJumlah('');
    setNoDokumen('');

    notify({
      type: 'success',
      title: 'Draf Ditambahkan',
      message: 'Baris draf pemindahan baru telah disisipkan di sebelah kanan.'
    });
  };

  const handleDeleteDraft = (id) => {
    setDrafts(drafts.filter((d) => d.id !== id));
  };

  const toggleDraftCollapse = (id) => {
    setDrafts(
      drafts.map((d) => (d.id === id ? { ...d, isCollapsed: !d.isCollapsed } : d))
    );
  };

  const handleUpdateDraftField = (id, field, value) => {
    setDrafts(
      drafts.map((d) => {
        if (d.id === id) {
          const updated = { ...d, [field]: value };
          if (field === 'debitAccId') {
            updated.debitAcc = kasBankAccounts.find((a) => String(a.id) === String(value));
          }
          if (field === 'creditAccId') {
            updated.creditAcc = kasBankAccounts.find((a) => String(a.id) === String(value));
          }
          return updated;
        }
        return d;
      })
    );
  };

  const handleSaveAllTransfers = async () => {
    let transfersToSave = [...drafts];

    if (transfersToSave.length === 0) {
      // Validate direct left form
      if (!txDate || !debitAccId || !creditAccId || !catatan || !jumlah) {
        notify({
          type: 'warning',
          title: 'Validasi Gagal',
          message: 'Kolom dengan tanda * wajib diisi!'
        });
        return;
      }

      if (debitAccId === creditAccId) {
        notify({
          type: 'warning',
          title: 'Validasi Gagal',
          message: 'Akun Debit dan Kredit tidak boleh sama.'
        });
        return;
      }

      const debitAcc = kasBankAccounts.find((a) => String(a.id) === String(debitAccId));
      const creditAcc = kasBankAccounts.find((a) => String(a.id) === String(creditAccId));
      transfersToSave.push({
        id: Date.now(),
        date: txDate,
        debitAcc,
        creditAcc,
        notes: catatan,
        amount: Number(jumlah),
        docNo: noDokumen,
      });
    } else {
      // Validate all drafts in list
      for (let i = 0; i < transfersToSave.length; i++) {
        const tx = transfersToSave[i];
        if (!tx.date || !tx.debitAcc || !tx.creditAcc || !tx.notes || !tx.amount) {
          notify({
            type: 'warning',
            title: 'Validasi Gagal',
            message: `Kolom dengan tanda * wajib diisi pada Draf #${i + 1}!`
          });
          return;
        }

        if (String(tx.debitAcc.id) === String(tx.creditAcc.id)) {
          notify({
            type: 'warning',
            title: 'Validasi Gagal',
            message: `Akun Debit dan Kredit tidak boleh sama pada Draf #${i + 1}.`
          });
          return;
        }
      }
    }

    setSaving(true);
    let successCount = 0;

    for (const tx of transfersToSave) {
      const payload = {
        date: tx.date,
        description: tx.notes,
        external_document_no: tx.docNo || null,
        lines: [
          {
            account: tx.debitAcc.account || tx.debitAcc.id,
            debit: tx.amount,
            kredit: 0,
          },
          {
            account: tx.creditAcc.account || tx.creditAcc.id,
            debit: 0,
            kredit: tx.amount,
          },
        ],
      };

      try {
        await apiClient.post('/accounting/journal-entries/', payload);
        successCount++;
      } catch (err) {
        console.error('Gagal menyimpan transfer kas:', err);
      }
    }

    setSaving(false);

    if (successCount === transfersToSave.length) {
      notify({
        type: 'success',
        title: 'Berhasil Disimpan',
        message: `${successCount} transaksi transfer kas berhasil disimpan.`
      });
      setDrafts([]);
      setViewState('list');
    } else if (successCount > 0) {
      notify({
        type: 'warning',
        title: 'Tersimpan Sebagian',
        message: `${successCount} dari ${transfersToSave.length} transaksi berhasil disimpan.`
      });
      setDrafts([]);
      setViewState('list');
    } else {
      notify({
        type: 'error',
        title: 'Gagal Menyimpan',
        message: 'Gagal menyimpan transaksi transfer kas ke server.'
      });
    }
  };

  const handleDownloadExcel = () => {
    const { date_from, date_to } = resolveDates();
    downloadFile(
      `/accounting/ledger/export/?date_from=${date_from}&date_to=${date_to}&classification=${encodeURIComponent('Kas & Bank')}`,
      'kas-bank.xlsx',
    );
  };

  const handleApplyFilter = () => {
    setAppliedSearch(filterSearch);
    setAppliedAmount(filterAmount);
    setIsFilterOpen(false);
  };

  const handleResetFilter = () => {
    setFilterSearch('');
    setFilterAmount('');
    setFilterNonZeroOnly(false);
    setAppliedSearch('');
    setAppliedAmount('');
    setIsFilterOpen(false);
  };

  if (viewState === 'transfer') {
    return (
      <div className="min-h-screen w-full bg-[#F4F7FE] flex flex-col p-6 animate-fade-in text-xs font-semibold text-slate-700">
        <div className="flex items-center justify-between pb-6 border-b border-slate-200">
          <span className="text-[10px] text-rose-500 font-bold font-mono">(*) Harus diisi</span>
          <h2 className="text-sm font-bold text-slate-808 tracking-tight">Transfer Kas</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewState('list')}
              className="px-4 py-1.5 bg-white border border-slate-205 text-slate-705 hover:bg-slate-50 font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveAllTransfers}
              className="px-4 py-1.5 bg-[#4CAF50] hover:bg-[#43A047] text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              <span>Simpan</span>
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 items-start">
          <TransferKasForm
            txDate={txDate}
            setTxDate={setTxDate}
            debitAccId={debitAccId}
            setDebitAccId={setDebitAccId}
            creditAccId={creditAccId}
            setCreditAccId={setCreditAccId}
            catatan={catatan}
            setCatatan={setCatatan}
            jumlah={jumlah}
            setJumlah={setJumlah}
            noDokumen={noDokumen}
            setNoDokumen={setNoDokumen}
            kasBankAccounts={kasBankAccounts}
            onAddDraft={handleAddDraft}
          />

          <DraftJurnalList
            drafts={drafts}
            kasBankAccounts={kasBankAccounts}
            onDeleteDraft={handleDeleteDraft}
            onToggleCollapse={toggleDraftCollapse}
            onUpdateField={handleUpdateDraftField}
            formatIDR={formatIDR}
          />
        </div>
      </div>
    );
  }

  if (viewState === 'detail' && viewingAccountId !== null) {
    return (
      <RincianMutasiKasBank
        accountId={viewingAccountId}
        onBack={() => {
          setViewingAccountId(null);
          setViewState('list');
        }}
        initialDateFrom={resolveDates().date_from}
        initialDateTo={resolveDates().date_to}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">List Kas & Bank</h2>
      </div>

      <div className="no-print bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Filter button with funnel icon */}
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="px-4 py-1.5 border border-slate-205 text-slate-650 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
          >
            <Filter size={13} className="text-slate-400" />
            <span>Filter</span>
          </button>

          <div ref={pdfRef} className="relative">
            <button
              type="button"
              onClick={() => setShowPdfDropdown(!showPdfDropdown)}
              className="flex items-center gap-1 px-4 py-1.5 bg-white border border-slate-205 text-slate-650 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold"
            >
              <span>PDF</span>
              <ChevronDown size={13} />
            </button>
            {showPdfDropdown && (
              <div className="absolute left-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-32 text-left font-bold animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    window.print();
                    setShowPdfDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 text-left transition-colors cursor-pointer"
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownloadExcel}
            className="flex items-center gap-1 px-4 py-1.5 bg-white border border-slate-205 text-slate-650 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold"
          >
            <span>Excel</span>
          </button>

          {/* Date Picker Navigator with 1-month dropdown picker (Screenshot 1) */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-2xs relative">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-550 transition-colors cursor-pointer border-r border-slate-200"
            >
              <ChevronLeft size={14} />
            </button>
            
            <div
              onClick={() => setShowMonthPicker(!showMonthPicker)}
              className="px-5 py-1.5 text-xs font-bold text-slate-700 min-w-32 text-center select-none flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50"
            >
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span>{getMonthYearLabel(currentDate)}</span>
              <ChevronDown size={12} className="text-slate-450 shrink-0" />
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 text-slate-550 transition-colors cursor-pointer border-l border-slate-200"
            >
              <ChevronRight size={14} />
            </button>

            {/* 1-month Dropdown calendar picker */}
            {showMonthPicker && (
              <div className="absolute top-full left-0 mt-1 z-[999] bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-60 grid grid-cols-3 gap-1 animate-fade-in text-[10px]">
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
                    className="p-1 hover:bg-slate-100 rounded text-slate-505 cursor-pointer"
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
        </div>

        <button
          type="button"
          onClick={() => setViewState('transfer')}
          className="px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
        >
          <Plus size={13} />
          <span>Transfer Kas</span>
        </button>
      </div>

      <ListKasBankTable
        loading={loading}
        accounts={accounts}
        formatIDR={formatIDR}
        onSelectAccount={(accId) => {
          setViewingAccountId(accId);
          setViewState('detail');
        }}
      />

      <FilterKasBankModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filterSearch={filterSearch}
        setFilterSearch={setFilterSearch}
        filterAmount={filterAmount}
        setFilterAmount={setFilterAmount}
        filterNonZeroOnly={filterNonZeroOnly}
        setFilterNonZeroOnly={setFilterNonZeroOnly}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
      />
    </div>
  );
}
