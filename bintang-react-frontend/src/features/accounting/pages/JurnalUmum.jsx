import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Calendar, Loader2, Search, Trash2, MoreHorizontal, Download, UploadCloud, X, Plus, FileText, Check } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError, notifySuccess, notify } from '../../../utils/notify';
import { downloadFile } from '../../../utils/downloadFile';
import NumericInput from '../../../components/NumericInput';

export default function JurnalUmum({ onToggleSidebar }) {

  // Navigation / View state: 'list', 'create-form' (single), 'create-multi-form' (multi)
  const [viewState, setViewState] = useState('list');
  const [formSubMode, setFormSubMode] = useState('advance'); // 'advance' or 'basic'

  useEffect(() => {
    const isForm = viewState === 'create-form' || viewState === 'create-multi-form';
    if (onToggleSidebar) {
      onToggleSidebar(isForm);
    }
    return () => {
      if (onToggleSidebar) {
        onToggleSidebar(false);
      }
    };
  }, [viewState, onToggleSidebar]);

  // Date range states
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hari ini');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Table list states
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded group rows
  const [expandedGroups, setExpandedGroups] = useState({});

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTambahJurnalDropdownOpen, setIsTambahJurnalDropdownOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Form states (Form Jurnal Tunggal / Multi)
  const [namaJurnalList, setNamaJurnalList] = useState([]);
  const [namaJurnal, setNamaJurnal] = useState('');
  const [tanggalJurnal, setTanggalJurnal] = useState(new Date().toISOString().split('T')[0]);
  const [accounts, setAccounts] = useState([]);
  const [akunDebit, setAkunDebit] = useState('');
  const [akunKredit, setAkunKredit] = useState('');
  const [catatan, setCatatan] = useState('');
  const [jumlah, setJumlah] = useState(0);
  const [noDokumen, setNoDokumen] = useState('');
  const [departemenList, setDepartemenList] = useState([]);
  const [departemen, setDepartemen] = useState('');
  const [savingJurnal, setSavingJurnal] = useState(false);

  // Inline forms state (Screenshot 2)
  const [isInlineJournalOpen, setIsInlineJournalOpen] = useState(false);
  const [inlineJournalName, setInlineJournalName] = useState('');
  const [isInlineDeptOpen, setIsInlineDeptOpen] = useState(false);
  const [inlineDeptName, setInlineDeptName] = useState('');

  // Draft items list (Draf Jurnal panel on the right - single form)
  const [draftItems, setDraftItems] = useState([]);

  // Multi Jurnal lines (Screenshot 1 & 3)
  const [multiLines, setMultiLines] = useState([]);
  const [selectedAccountForRincian, setSelectedAccountForRincian] = useState('');
  const [isRincianJurnalOpen, setIsRincianJurnalOpen] = useState(false);
  const [rincianType, setRincianType] = useState('debit'); // 'debit' or 'kredit'
  const [rincianJumlah, setRincianJumlah] = useState(0);
  const [rincianCatatan, setRincianCatatan] = useState('');
  const [rincianNoDokumen, setRincianNoDokumen] = useState('');

  // Modals for adding templates & departments (Fallback/Backup)
  const [isAddTemplateOpen, setIsAddTemplateOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // Bulk Delete and Row actions states
  const [activeMenuEntryId, setActiveMenuEntryId] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingEntryNumber, setDeletingEntryNumber] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Import states
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const dropdownRef = useRef(null);
  const exportDropdownRef = useRef(null);
  const rowMenuRef = useRef(null);

  // Fetch entries from backend
  const fetchEntries = () => {
    setLoading(true);
    apiClient
      .get('/accounting/journal-entries/', {
        params: { date_from: dateFrom, date_to: dateTo, search: searchQuery },
      })
      .then((res) => {
        setEntries(res.data || []);
        const initialExpanded = {};
        (res.data || []).forEach((e) => {
          initialExpanded[e.id] = true;
        });
        setExpandedGroups(initialExpanded);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat Jurnal Umum'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (viewState === 'list') {
      fetchEntries();
    }
  }, [viewState, dateFrom, dateTo, searchQuery]);

  // Load COA accounts when entering creation form
  useEffect(() => {
    if (viewState === 'create-form' || viewState === 'create-multi-form') {
      apiClient
        .get('/accounting/accounts/', { params: { semua_akun: 'true' } })
        .then((res) => {
          let coa = res.data || [];
          // Ensure "81000 - Penyesuaian barang" exists in list for demonstration/usage
          if (!coa.some((a) => String(a.code) === '81000')) {
            coa.push({
              id: 99999,
              code: '81000',
              name: 'Penyesuaian barang',
              normal_balance: 'debit',
              is_active: true
            });
          }
          setAccounts(coa);
        })
        .catch(() => {});

      setNamaJurnalList([
        { id: 1, name: 'Akumulasi penyusutan' },
        { id: 2, name: 'Kas Masuk' },
        { id: 3, name: 'Kas Keluar' },
        { id: 4, name: 'Penyesuaian Akhir Bulan' },
      ]);
      setDepartemenList([
        { id: 1, name: 'Divisi Offset' },
        { id: 2, name: 'Divisi Digital Printing' },
        { id: 3, name: 'Divisi Desain' },
      ]);
    }
  }, [viewState]);

  // Click outside listener for dropdown buttons
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsTambahJurnalDropdownOpen(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setIsExportDropdownOpen(false);
      }
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target)) {
        setActiveMenuEntryId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleApplyDateRange = (label, fromDate, toDate) => {
    setDateRangeLabel(label);
    setDateFrom(fromDate);
    setDateTo(toDate);
    setIsFilterModalOpen(false);
  };

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDownloadTemplate = () => {
    downloadFile('/accounting/journal-entries/import/template/', 'template_jurnal_umum.csv');
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleUploadImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    const formData = new FormData();
    formData.append('file', importFile);
    try {
      const previewRes = await apiClient.post('/accounting/journal-entries/import/preview/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const commitRes = await apiClient.post('/accounting/journal-entries/import/commit/', {
        entries: previewRes.data.entries,
      });
      notifySuccess('Berhasil', `Berhasil mengimpor ${commitRes.data.success} jurnal.`);
      setIsImportOpen(false);
      setImportFile(null);
      fetchEntries();
    } catch (err) {
      notifyApiError(err, 'Gagal mengimpor Jurnal Umum');
    } finally {
      setImportLoading(false);
    }
  };

  // Save functionality for both single draft and multi form
  const handleSaveJurnal = async () => {
    setSavingJurnal(true);

    try {
      if (viewState === 'create-multi-form') {
        // Multi journal saving logic
        if (multiLines.length < 2) {
          notify({ type: 'warning', title: 'Peringatan', message: 'Jurnal minimal harus memiliki 2 baris.' });
          setSavingJurnal(false);
          return;
        }

        const totalDebit = multiLines.reduce((acc, l) => acc + l.debit, 0);
        const totalKredit = multiLines.reduce((acc, l) => acc + l.kredit, 0);

        if (totalDebit !== totalKredit) {
          notify({ type: 'warning', title: 'Peringatan', message: `Jurnal tidak balance: Debit (${formatIDR(totalDebit)}) != Kredit (${formatIDR(totalKredit)}).` });
          setSavingJurnal(false);
          return;
        }

        const body = {
          date: tanggalJurnal,
          description: namaJurnal || 'Jurnal Umum Multi',
          lines: multiLines.map((l) => ({
            account: l.account_id,
            debit: l.debit,
            kredit: l.kredit,
            description: l.description,
            external_document_no: l.external_document_no
          }))
        };

        if (departemen) {
          // Find matching department object
          const deptObj = departemenList.find((d) => d.name === departemen);
          if (deptObj) {
            body.department = deptObj.id;
          }
        }

        await apiClient.post('/accounting/journal-entries/', body);
        notifySuccess('Berhasil', 'Multi Jurnal berhasil disimpan.');
        setMultiLines([]);
      } else {
        // Single Jurnal saving logic
        const itemsToSave = draftItems.length > 0 ? draftItems : [
          {
            mode: formSubMode,
            namaJurnal,
            tanggal: tanggalJurnal,
            akunDebit,
            akunKredit,
            departemen,
            catatan,
            jumlah,
            noDokumen
          }
        ];

        for (const item of itemsToSave) {
          if (!item.catatan.trim() || item.jumlah <= 0) continue;
          const body = {
            date: item.tanggal,
            description: item.catatan.trim(),
            external_no: item.noDokumen.trim() || undefined,
            lines: [],
          };

          if (item.mode === 'advance') {
            if (!item.akunDebit || !item.akunKredit) continue;
            body.lines.push(
              { account: parseInt(item.akunDebit, 10), debit: item.jumlah, kredit: 0 },
              { account: parseInt(item.akunKredit, 10), debit: 0, kredit: item.jumlah }
            );
          } else {
            body.lines.push(
              { account: accounts[0]?.id || 1, debit: item.jumlah, kredit: 0 },
              { account: accounts[1]?.id || 2, debit: 0, kredit: item.jumlah }
            );
          }
          await apiClient.post('/accounting/journal-entries/', body);
        }

        notifySuccess('Berhasil', 'Seluruh entri jurnal berhasil disimpan.');
        setDraftItems([]);
        setAkunDebit('');
        setAkunKredit('');
        setCatatan('');
        setJumlah(0);
        setNoDokumen('');
      }

      setViewState('list');
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan Jurnal');
    } finally {
      setSavingJurnal(false);
    }
  };

  const handleAddDraftItem = () => {
    const newItem = {
      id: Date.now(),
      mode: formSubMode,
      namaJurnal: namaJurnal || '',
      tanggal: tanggalJurnal || new Date().toISOString().split('T')[0],
      akunDebit: akunDebit || '',
      akunKredit: akunKredit || '',
      departemen: departemen || '',
      catatan: catatan || '',
      jumlah: jumlah || 0,
      noDokumen: noDokumen || '',
      isExpanded: true
    };
    setDraftItems((prev) => [...prev, newItem]);
    setCatatan('');
    setJumlah(0);
    setNoDokumen('');
  };

  const handleUpdateDraftField = (itemId, field, value) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const handleDeleteDraftItem = (itemId) => {
    setDraftItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleToggleDraftExpand = (itemId) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, isExpanded: !item.isExpanded } : item))
    );
  };

  // Inline creation handlers
  const handleSaveInlineJournal = () => {
    if (!inlineJournalName.trim()) return;
    setNamaJurnalList((prev) => [...prev, { id: prev.length + 1, name: inlineJournalName.trim() }]);
    setNamaJurnal(inlineJournalName.trim());
    setInlineJournalName('');
    setIsInlineJournalOpen(false);
  };

  const handleSaveInlineDept = () => {
    if (!inlineDeptName.trim()) return;
    setDepartemenList((prev) => [...prev, { id: prev.length + 1, name: inlineDeptName.trim() }]);
    setDepartemen(inlineDeptName.trim());
    setInlineDeptName('');
    setIsInlineDeptOpen(false);
  };

  const handleAddJournalTemplateName = () => {
    if (!newTemplateName.trim()) return;
    setNamaJurnalList((prev) => [...prev, { id: prev.length + 1, name: newTemplateName.trim() }]);
    setNamaJurnal(newTemplateName.trim());
    setNewTemplateName('');
    setIsAddTemplateOpen(false);
  };

  const handleAddDeptName = () => {
    if (!newDeptName.trim()) return;
    setDepartemenList((prev) => [...prev, { id: prev.length + 1, name: newDeptName.trim() }]);
    setDepartemen(newDeptName.trim());
    setNewDeptName('');
    setIsAddDeptOpen(false);
  };

  // Selection of Nama Akun triggers Rincian Jurnal Popup
  const handleSelectAccountForMulti = (e) => {
    const accountId = e.target.value;
    if (!accountId) return;
    const acc = accounts.find((a) => String(a.id) === String(accountId));
    if (acc) {
      setSelectedAccountForRincian(acc);
      setRincianJumlah(0);
      setRincianCatatan('');
      setRincianNoDokumen('');
      setRincianType('debit');
      setIsRincianJurnalOpen(true);
    }
  };

  const handleAddMultiLine = () => {
    if (!rincianCatatan.trim() || rincianJumlah <= 0 || !selectedAccountForRincian) return;

    const newLine = {
      id: Date.now(),
      account_id: selectedAccountForRincian.id,
      account_code: selectedAccountForRincian.code,
      account_name: selectedAccountForRincian.name,
      description: rincianCatatan.trim(),
      external_document_no: rincianNoDokumen.trim(),
      debit: rincianType === 'debit' ? rincianJumlah : 0,
      kredit: rincianType === 'kredit' ? rincianJumlah : 0
    };

    setMultiLines((prev) => [...prev, newLine]);
    setIsRincianJurnalOpen(false);
    setSelectedAccountForRincian('');
  };

  const handleDeleteMultiLine = (id) => {
    setMultiLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Bulk / Row delete implementation
  const triggerDeleteConfirm = (entryNo) => {
    setDeletingEntryNumber(entryNo);
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteReason.trim()) return;
    setIsDeleting(true);
    try {
      const entriesToKill = deletingEntryNumber ? [deletingEntryNumber] : selectedForDelete;
      for (const entryNo of entriesToKill) {
        await apiClient.delete(`/accounting/journal-entries/${entryNo}/`, {
          data: { reason: deleteReason.trim() }
        });
      }
      notifySuccess('Berhasil', 'Transaksi jurnal berhasil dihapus.');
      setIsDeleteModalOpen(false);
      setSelectedForDelete([]);
      fetchEntries();
    } catch (err) {
      notifyApiError(err, 'Gagal menghapus transaksi');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectForDelete = (entryNo) => {
    setSelectedForDelete((prev) =>
      prev.includes(entryNo)
        ? prev.filter((id) => id !== entryNo)
        : [...prev, entryNo]
    );
  };

  const isAllSelectedForDelete = entries.length > 0 && selectedForDelete.length === entries.length;

  const handleToggleSelectAllForDelete = () => {
    if (isAllSelectedForDelete) {
      setSelectedForDelete([]);
    } else {
      setSelectedForDelete(entries.map((e) => e.entry_number));
    }
  };

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return `IDR ${num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatIDRNoPrefix = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 animate-fade-in pb-16 relative">
      {/* 1. LIST VIEW */}
      {viewState === 'list' && (
        <>
          <div className="flex flex-wrap gap-4 items-center justify-between pb-1">
            <h2 className="text-base font-bold text-slate-900">Jurnal Umum</h2>
          </div>

          {/* Filters & Actions Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Date Navigator Button */}
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 bg-white text-xs font-bold text-slate-700 cursor-pointer shadow-2xs transition-colors"
              >
                <Calendar size={13} className="text-slate-400" />
                <span>{dateRangeLabel} ({formatDateLabel(dateFrom)} - {formatDateLabel(dateTo)})</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="px-4 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Import
                </button>

                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsTambahJurnalDropdownOpen(!isTambahJurnalDropdownOpen)}
                    className="flex items-center gap-1 px-4 py-1.5 bg-[#73C240] hover:bg-[#64B031] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>Tambah Jurnal</span>
                    <ChevronDown size={13} />
                  </button>
                  {isTambahJurnalDropdownOpen && (
                    <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-44 text-left text-xs font-bold animate-fade-in">
                      <button
                        type="button"
                        onClick={() => {
                          setViewState('create-form');
                          setIsTambahJurnalDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        Form Jurnal Tunggal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setViewState('create-multi-form');
                          setMultiLines([]);
                          setIsTambahJurnalDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        Form Multi Jurnal
                      </button>
                    </div>
                  )}
                </div>

                <div ref={exportDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                    className="flex items-center gap-1 px-4 py-1.5 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                  >
                    <span>Export Excel</span>
                    <ChevronDown size={13} />
                  </button>
                  {isExportDropdownOpen && (
                    <div className="absolute right-0 mt-1 z-[99] bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 w-44 text-left text-xs font-bold animate-fade-in">
                      <button
                        type="button"
                        onClick={() => {
                          downloadFile(`/accounting/journal-entries/export/?date_from=${dateFrom}&date_to=${dateTo}`, 'jurnal-umum.xlsx');
                          setIsExportDropdownOpen(false);
                        }}
                        className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        Jurnal Umum
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs p-0.5">
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(true)}
                  className={`px-4 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    dateRangeLabel === 'Sesuaikan' ? 'bg-[#0088E8] text-white shadow-2xs' : 'text-slate-650 hover:bg-slate-100'
                  }`}
                >
                  Sesuaikan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = now.getMonth();
                    const pad = (n) => String(n).padStart(2, '0');
                    const first = `${y}-${pad(m + 1)}-01`;
                    const last = `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`;
                    handleApplyDateRange('Bulan ini', first, last);
                  }}
                  className={`px-4 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    dateRangeLabel === 'Bulan ini' ? 'bg-[#0088E8] text-white shadow-2xs' : 'text-slate-650 hover:bg-slate-100'
                  }`}
                >
                  Bulan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date().getFullYear();
                    const first = `${y}-01-01`;
                    const last = `${y}-12-31`;
                    handleApplyDateRange('Tahun ini', first, last);
                  }}
                  className={`px-4 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    dateRangeLabel === 'Tahun ini' ? 'bg-[#0088E8] text-white shadow-2xs' : 'text-slate-650 hover:bg-slate-100'
                  }`}
                >
                  Tahun
                </button>
              </div>

              <div className="relative w-64">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={13} />
                </span>
                <input
                  type="text"
                  placeholder="Cari No. Transaksi"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg text-xs bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* Table Area */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0088E8] text-white font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">▼</th>
                    <th className="px-5 py-3">Akun</th>
                    <th className="px-5 py-3 text-right">Debit</th>
                    <th className="px-5 py-3 text-right">Kredit</th>
                    <th className="px-5 py-3 text-center w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="font-semibold text-slate-700">
                  {loading && entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-slate-400 font-bold">
                        <div className="flex flex-col items-center justify-center">
                          <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
                          <p className="text-xs">Memuat Jurnal...</p>
                        </div>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-20 text-slate-400 font-bold text-xs">
                        Tidak ada entri jurnal dalam rentang tanggal terpilih.
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => {
                      const isExpanded = expandedGroups[entry.id] !== false;
                      const isSelected = selectedForDelete.includes(entry.entry_number);
                      const subTotalDebit = (entry.lines || []).reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
                      const subTotalKredit = (entry.lines || []).reduce((acc, l) => acc + (Number(l.kredit) || 0), 0);

                      return (
                        <Fragment key={entry.id}>
                          <tr className="bg-slate-50/70 font-bold text-slate-800 border-t border-slate-200">
                            <td className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => toggleGroup(entry.id)}>
                              <span className="text-[#0088E8] font-bold text-[13px]">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </td>
                            <td className="px-5 py-3" colSpan={3}>
                              <span className="text-slate-850 font-bold">
                                {entry.description} | {entry.entry_number} ({formatDateLabel(entry.date)})
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center relative">
                              {isSelected ? (
                                <button
                                  type="button"
                                  onClick={() => toggleSelectForDelete(entry.entry_number)}
                                  className="w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs mx-auto"
                                  title="Batalkan Pilihan Hapus"
                                >
                                  <X size={13} />
                                </button>
                              ) : (
                                <div className="relative inline-block text-left" ref={activeMenuEntryId === entry.id ? rowMenuRef : null}>
                                  <button
                                    type="button"
                                    onClick={() => setActiveMenuEntryId(activeMenuEntryId === entry.id ? null : entry.id)}
                                    className="w-7 h-7 rounded-full bg-[#0088E8] hover:bg-[#0077CC] text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs mx-auto"
                                    title="Menu Transaksi"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>

                                  {activeMenuEntryId === entry.id && (
                                    <div className="absolute right-0 mt-1 z-[999] bg-white rounded-lg border border-slate-200 shadow-xl py-1.5 w-32 text-left text-xs font-bold animate-fade-in">
                                      <button
                                        type="button"
                                        className="w-full px-4 py-2 text-slate-400 hover:text-slate-400 bg-slate-50/50 transition-colors text-left flex items-center justify-between cursor-not-allowed group relative"
                                      >
                                        <span>Ubah</span>
                                        <span className="text-slate-400 opacity-80 transition-transform">🚫</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          toggleSelectForDelete(entry.entry_number);
                                          setActiveMenuEntryId(null);
                                        }}
                                        className="w-full px-4 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                                      >
                                        Hapus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          downloadFile(`/accounting/journal-entries/${entry.entry_number}/export/`, `jurnal-${entry.entry_number}.xlsx`);
                                          setActiveMenuEntryId(null);
                                        }}
                                        className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                                      >
                                        Cetak PDF
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Inner Journal Lines */}
                          {isExpanded && (entry.lines || []).map((line, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-2.5"></td>
                              <td className="px-5 py-2.5">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800">{line.account_code} - {line.account_name}</p>
                                  <p className="text-[10px] text-slate-450 font-semibold">
                                    {line.description || entry.description}
                                  </p>
                                  {line.external_document_no && (
                                    <p className="text-[9px] text-[#0088E8] font-bold">
                                      #{line.external_document_no}
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                                {formatIDR(line.debit)}
                              </td>
                              <td className="px-5 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                                {formatIDR(line.kredit)}
                              </td>
                              <td className="px-5 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => triggerDeleteConfirm(entry.entry_number)}
                                  className="w-6 h-6 rounded-full bg-[#EF5350] hover:bg-[#E53935] text-white flex items-center justify-center cursor-pointer transition-colors shadow-2xs mx-auto"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          ))}

                          {/* SubTotal Row */}
                          {isExpanded && (
                            <tr className="bg-slate-50/30 font-bold text-slate-800">
                              <td className="px-4 py-2.5"></td>
                              <td className="px-5 py-2.5 text-slate-700 font-extrabold pl-4">
                                SubTotal {entry.description}
                              </td>
                              <td className="px-5 py-2.5 text-right text-slate-800 font-extrabold whitespace-nowrap">
                                {formatIDRNoPrefix(subTotalDebit)}
                              </td>
                              <td className="px-5 py-2.5 text-right text-slate-800 font-extrabold whitespace-nowrap">
                                {formatIDRNoPrefix(subTotalKredit)}
                              </td>
                              <td className="px-5 py-2.5"></td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bulk Selection Fixed Action Bar at Bottom of Screen */}
          {selectedForDelete.length > 0 && (
            <div className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-50 flex items-center justify-between px-8 shadow-2xl animate-slide-up">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-650 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAllSelectedForDelete}
                  onChange={handleToggleSelectAllForDelete}
                  className="rounded border-slate-350 text-[#0088E8] focus:ring-[#0088E8] w-4 h-4 cursor-pointer"
                />
                <span>Hapus semua transaksi di halaman ini</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedForDelete([])}
                  className="px-6 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeletingEntryNumber('');
                    setDeleteReason('');
                    setIsDeleteModalOpen(true);
                  }}
                  className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Hapus Data ({selectedForDelete.length})
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. CREATION FORM VIEW (SINGLE JURNAL TUNGGAL) */}
      {viewState === 'create-form' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative min-h-[550px] flex flex-col animate-fade-in">
          {/* Legend * */}
          <span className="absolute left-6 top-6 text-slate-400 font-semibold text-[10px]">
            <span className="text-rose-500">*</span> Harus diisi
          </span>

          <h2 className="text-base font-extrabold text-slate-800 text-center mb-6 pt-1">
            Jurnal
          </h2>

          <div className="absolute right-6 top-6 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewState('list')}
              className="px-4 py-1.5 border border-slate-205 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveJurnal}
              disabled={savingJurnal}
              className="px-4 py-1.5 bg-[#73C240] hover:bg-[#64B031] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
            >
              {savingJurnal && <Loader2 size={12} className="animate-spin" />}
              <span>Simpan</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4 flex-1">
            {/* Form Left Pane */}
            <div className="lg:col-span-1 space-y-4 pr-0 lg:pr-6 border-r-0 lg:border-r border-slate-100 flex flex-col justify-between">
              <div>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-105 rounded-lg text-center text-[10px] font-extrabold text-slate-500 mb-5">
                  <button
                    type="button"
                    onClick={() => setFormSubMode('advance')}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      formSubMode === 'advance' ? 'bg-white text-slate-700 shadow-2xs' : 'hover:bg-slate-200/50'
                    }`}
                  >
                    Advance Form
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormSubMode('basic')}
                    className={`py-1.5 rounded-md transition-all cursor-pointer ${
                      formSubMode === 'basic' ? 'bg-white text-slate-700 shadow-2xs' : 'hover:bg-slate-200/50'
                    }`}
                  >
                    Basic Form
                  </button>
                </div>

                {/* Nama Jurnal */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-500">
                    Nama Jurnal <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={namaJurnal}
                      onChange={(e) => setNamaJurnal(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                    >
                      <option value="">Pilih Nama Jurnal</option>
                      {namaJurnalList.map((j) => (
                        <option key={j.id} value={j.name}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsInlineJournalOpen(!isInlineJournalOpen)}
                      className="p-2 rounded-lg bg-[#0088E8] text-white cursor-pointer hover:bg-[#0077CC] flex items-center justify-center shrink-0 shadow-2xs"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Inline Journal Name Creation */}
                {isInlineJournalOpen && (
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 mt-2 space-y-2 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-500">Nama Jurnal Baru</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Jurnal"
                        value={inlineJournalName}
                        onChange={(e) => setInlineJournalName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-205 text-xs bg-white outline-none font-semibold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setIsInlineJournalOpen(false)}
                        className="p-1.5 rounded-lg border border-slate-250 bg-white text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInlineJournal}
                        className="p-1.5 rounded-lg bg-[#73C240] text-white hover:bg-[#64B031] cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Tanggal */}
                <div className="space-y-1 mt-3">
                  <label className="block text-[11px] font-bold text-slate-500">
                    Tanggal <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={tanggalJurnal}
                    onChange={(e) => setTanggalJurnal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                  />
                </div>

                {/* Advance Form Debit/Credit Columns selection (Main Form) */}
                {formSubMode === 'advance' && (
                  <>
                    <div className="space-y-1 mt-3">
                      <label className="block text-[11px] font-bold text-slate-500">
                        Akun Debit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={akunDebit}
                        onChange={(e) => setAkunDebit(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                      >
                        <option value="">Pilih Akun Debit</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 mt-3">
                      <label className="block text-[11px] font-bold text-slate-500">
                        Akun Kredit <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={akunKredit}
                        onChange={(e) => setAkunKredit(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-850 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                      >
                        <option value="">Pilih Akun Kredit</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Departemen */}
                <div className="space-y-1 mt-3">
                  <label className="block text-[11px] font-bold text-slate-500">Departemen</label>
                  <div className="flex gap-2">
                    <select
                      value={departemen}
                      onChange={(e) => setDepartemen(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                    >
                      <option value="">Pilih Departemen</option>
                      {departemenList.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsInlineDeptOpen(!isInlineDeptOpen)}
                      className="p-2 rounded-lg bg-[#0088E8] text-white cursor-pointer hover:bg-[#0077CC] flex items-center justify-center shrink-0 shadow-2xs"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Inline Departemen Name Creation */}
                {isInlineDeptOpen && (
                  <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 mt-2 space-y-2 animate-fade-in">
                    <label className="block text-[10px] font-bold text-slate-500">Departemen Baru</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Departemen"
                        value={inlineDeptName}
                        onChange={(e) => setInlineDeptName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-205 text-xs bg-white outline-none font-semibold text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => setIsInlineDeptOpen(false)}
                        className="p-1.5 rounded-lg border border-slate-250 bg-white text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInlineDept}
                        className="p-1.5 rounded-lg bg-[#73C240] text-white hover:bg-[#64B031] cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Catatan */}
                <div className="space-y-1 mt-3">
                  <label className="block text-[11px] font-bold text-slate-500">
                    Catatan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    placeholder="Masukkan memo/catatan transaksi..."
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none resize-y"
                  />
                </div>

                {/* Jumlah & No. Dokumen */}
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500">
                      Jumlah <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex border border-slate-205 rounded-lg bg-slate-50 focus-within:bg-white focus-within:border-[#0088E8] overflow-hidden px-3 py-2">
                      <span className="text-xs font-bold text-slate-400 mr-2">IDR</span>
                      <NumericInput
                        value={jumlah}
                        onChange={(val) => setJumlah(val)}
                        min={0}
                        className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none border-none p-0 focus:ring-0 text-left"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-500">No. Dokumen</label>
                    <input
                      type="text"
                      placeholder="Masukkan No. Dokumen"
                      value={noDokumen}
                      onChange={(e) => setNoDokumen(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Tambah Lainnya button (Always Clickable) */}
              <div className="pt-8">
                <button
                  type="button"
                  onClick={handleAddDraftItem}
                  className="w-full py-2 border border-[#0088E8] bg-white hover:bg-blue-50/50 text-[#0088E8] font-bold text-xs rounded-lg transition-colors cursor-pointer text-center shadow-2xs"
                >
                  + Tambah Lainnya
                </button>
              </div>
            </div>

            {/* Draf Jurnal Right Panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <h4 className="text-xs font-bold text-slate-800">Draf Jurnal</h4>
                <button
                  type="button"
                  disabled={draftItems.length === 0}
                  className={`px-4 py-1.5 border font-bold text-xs rounded-lg flex items-center gap-1.5 ${
                    draftItems.length === 0
                      ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs'
                  }`}
                >
                  <FileText size={13} />
                  <span>Cetak jurnal ({draftItems.length})</span>
                </button>
              </div>

              {/* Draft List Container */}
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {draftItems.map((item) => (
                  <div key={item.id} className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs animate-fade-in">
                    {/* Header bar of draft item */}
                    <div className="bg-slate-50/80 px-4 py-3 flex items-center justify-between border-b border-slate-100">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-450 block">
                          ( {item.tanggal} )
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">
                          IDR {item.jumlah.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 p-0.5 bg-slate-150 rounded-lg text-[9px] font-extrabold text-slate-500 w-32 mr-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateDraftField(item.id, 'mode', 'advance')}
                            className={`flex-1 py-0.5 rounded-md transition-all cursor-pointer ${
                              item.mode === 'advance' ? 'bg-white text-slate-700 shadow-2xs' : 'hover:bg-slate-200/50'
                            }`}
                          >
                            Advance
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateDraftField(item.id, 'mode', 'basic')}
                            className={`flex-1 py-0.5 rounded-md transition-all cursor-pointer ${
                              item.mode === 'basic' ? 'bg-white text-slate-700 shadow-2xs' : 'hover:bg-slate-200/50'
                            }`}
                          >
                            Basic
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDraftItem(item.id)}
                          className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-550 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDraftExpand(item.id)}
                          className="w-7 h-7 rounded-lg bg-slate-105 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors shadow-2xs"
                        >
                          <span className="text-xs font-bold select-none">
                            {item.isExpanded ? '▲' : '▼'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable nested forms */}
                    {item.isExpanded && (
                      <div className="p-4 bg-white">
                        {item.mode === 'advance' ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500">Nama Jurnal *</label>
                              <select
                                value={item.namaJurnal}
                                onChange={(e) => handleUpdateDraftField(item.id, 'namaJurnal', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                              >
                                <option value="">Pilih Nama Jurnal</option>
                                {namaJurnalList.map((j) => (
                                  <option key={j.id} value={j.name}>{j.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500">Tanggal *</label>
                              <input
                                type="date"
                                value={item.tanggal}
                                onChange={(e) => handleUpdateDraftField(item.id, 'tanggal', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500">Akun Debit *</label>
                              <select
                                value={item.akunDebit}
                                onChange={(e) => handleUpdateDraftField(item.id, 'akunDebit', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                              >
                                <option value="">Pilih Akun Debit</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500">Akun Kredit *</label>
                              <select
                                value={item.akunKredit}
                                onChange={(e) => handleUpdateDraftField(item.id, 'akunKredit', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                              >
                                <option value="">Pilih Akun Kredit</option>
                                {accounts.map((a) => (
                                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500">Departemen</label>
                              <select
                                value={item.departemen}
                                onChange={(e) => handleUpdateDraftField(item.id, 'departemen', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                              >
                                <option value="">Pilih Departemen</option>
                                {departemenList.map((d) => (
                                  <option key={d.id} value={d.name}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500">Jumlah *</label>
                              <div className="flex border border-slate-200 rounded-lg bg-slate-50 focus-within:bg-white overflow-hidden px-2 py-1">
                                <span className="text-[10px] font-bold text-slate-400 mr-2 flex items-center">IDR</span>
                                <NumericInput
                                  value={item.jumlah}
                                  onChange={(val) => handleUpdateDraftField(item.id, 'jumlah', val)}
                                  className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none border-none p-0 focus:ring-0"
                                />
                              </div>
                            </div>
                            <div className="space-y-1 col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500">Catatan *</label>
                              <textarea
                                value={item.catatan}
                                onChange={(e) => handleUpdateDraftField(item.id, 'catatan', e.target.value)}
                                rows={2}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none resize-y"
                              />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <label className="block text-[10px] font-bold text-slate-500">No. Dokumen</label>
                              <input
                                type="text"
                                value={item.noDokumen}
                                onChange={(e) => handleUpdateDraftField(item.id, 'noDokumen', e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="border border-slate-100 rounded-lg overflow-hidden">
                              <table className="w-full text-left text-[10px] border-collapse bg-slate-50/20">
                                <thead>
                                  <tr className="text-slate-450 font-bold border-b border-slate-100">
                                    <th className="px-3 py-1.5">Nama Jurnal</th>
                                    <th className="px-3 py-1.5">Tanggal</th>
                                    <th className="px-3 py-1.5">Akun Debit</th>
                                    <th className="px-3 py-1.5">Akun Kredit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="font-semibold text-slate-700">
                                    <td className="px-3 py-1.5">{item.namaJurnal || '-'}</td>
                                    <td className="px-3 py-1.5">{item.tanggal}</td>
                                    <td className="px-3 py-1.5">-</td>
                                    <td className="px-3 py-1.5">-</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500">Departemen</label>
                                <select
                                  value={item.departemen}
                                  onChange={(e) => handleUpdateDraftField(item.id, 'departemen', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                                >
                                  <option value="">Pilih Departemen</option>
                                  {departemenList.map((d) => (
                                    <option key={d.id} value={d.name}>{d.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500">Jumlah *</label>
                                <div className="flex border border-slate-200 rounded-lg bg-slate-50 focus-within:bg-white overflow-hidden px-2 py-1">
                                  <span className="text-[10px] font-bold text-slate-400 mr-2 flex items-center">IDR</span>
                                  <NumericInput
                                    value={item.jumlah}
                                    onChange={(val) => handleUpdateDraftField(item.id, 'jumlah', val)}
                                    className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none border-none p-0 focus:ring-0"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1 col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500">Catatan *</label>
                                <textarea
                                  value={item.catatan}
                                  onChange={(e) => handleUpdateDraftField(item.id, 'catatan', e.target.value)}
                                  rows={2}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none resize-y"
                                />
                              </div>
                              <div className="space-y-1 col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500">No. Dokumen</label>
                                <input
                                  type="text"
                                  value={item.noDokumen}
                                  onChange={(e) => handleUpdateDraftField(item.id, 'noDokumen', e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 8. CREATION FORM VIEW (FORM MULTI JURNAL - Screenshot 1 & 2) */}
      {viewState === 'create-multi-form' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative min-h-[550px] flex flex-col animate-fade-in">
          {/* Legend * */}
          <span className="absolute left-6 top-6 text-slate-400 font-semibold text-[10px]">
            <span className="text-rose-500">*</span> Harus diisi
          </span>

          <h2 className="text-base font-extrabold text-slate-850 text-left mb-6 pt-1 border-b border-slate-100 pb-3">
            Form Multi Jurnal
          </h2>

          {/* Top Right Print Draft Counter */}
          <div className="absolute right-6 top-6 flex items-center gap-3">
            <button
              type="button"
              disabled={multiLines.length === 0}
              className={`px-4 py-1.5 border font-bold text-xs rounded-lg flex items-center gap-1.5 ${
                multiLines.length === 0
                  ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs'
              }`}
            >
              <FileText size={13} />
              <span>Cetak jurnal ({multiLines.length})</span>
            </button>
          </div>

          {/* Multi Journal Input Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
            
            {/* Left Fields Column */}
            <div className="space-y-4">
              {/* Nama Jurnal */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">
                  Nama Jurnal <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={namaJurnal}
                    onChange={(e) => setNamaJurnal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                  >
                    <option value="">Pilih Nama Jurnal</option>
                    {namaJurnalList.map((j) => (
                      <option key={j.id} value={j.name}>
                        {j.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsInlineJournalOpen(!isInlineJournalOpen)}
                    className="p-2 rounded-lg bg-[#0088E8] text-white cursor-pointer hover:bg-[#0077CC] flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Inline journal name popup creation under input (as shown in Screenshot 2) */}
              {isInlineJournalOpen && (
                <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 space-y-2 animate-fade-in">
                  <label className="block text-[10px] font-bold text-slate-550">Nama Jurnal Baru</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Jurnal"
                      value={inlineJournalName}
                      onChange={(e) => setInlineJournalName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-205 text-xs bg-white outline-none font-semibold text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setIsInlineJournalOpen(false)}
                      className="p-1.5 rounded-lg border border-slate-250 bg-white text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInlineJournal}
                      className="p-1.5 rounded-lg bg-[#73C240] text-white hover:bg-[#64B031] cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Tanggal */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">
                  Tanggal <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggalJurnal}
                  onChange={(e) => setTanggalJurnal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                />
              </div>

              {/* Mata Uang */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-500">Mata Uang</label>
                <button
                  type="button"
                  className="px-4 py-1.5 border border-[#0088E8] bg-blue-50/20 text-[#0088E8] text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-2xs select-none"
                >
                  <span className="w-2 h-2 rounded-full bg-[#0088E8]" />
                  <span>IDR</span>
                </button>
              </div>
            </div>

            {/* Right Fields Column */}
            <div className="space-y-4">
              {/* Departemen */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">Departemen</label>
                <div className="flex gap-2">
                  <select
                    value={departemen}
                    onChange={(e) => setDepartemen(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                  >
                    <option value="">Pilih Departemen</option>
                    {departemenList.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsInlineDeptOpen(!isInlineDeptOpen)}
                    className="p-2 rounded-lg bg-[#0088E8] text-white cursor-pointer hover:bg-[#0077CC] flex items-center justify-center shrink-0 shadow-2xs"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Inline departemen name creation under input (as shown in Screenshot 2) */}
              {isInlineDeptOpen && (
                <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 space-y-2 animate-fade-in">
                  <label className="block text-[10px] font-bold text-slate-555">Departemen Baru</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Departemen"
                      value={inlineDeptName}
                      onChange={(e) => setInlineDeptName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-205 text-xs bg-white outline-none font-semibold text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setIsInlineDeptOpen(false)}
                      className="p-1.5 rounded-lg border border-slate-250 bg-white text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInlineDept}
                      className="p-1.5 rounded-lg bg-[#73C240] text-white hover:bg-[#64B031] cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Nama Akun Selection (Dropdown up to 81000 - Penyesuaian Barang) */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-500">
                  Nama Akun <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedAccountForRincian ? selectedAccountForRincian.id : ''}
                  onChange={handleSelectAccountForMulti}
                  className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 text-slate-805 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
                >
                  <option value="">Pilih Akun</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Dynamic Lines Table Area (Center) */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-2xs mt-8 overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Nama Akun</th>
                    <th className="px-5 py-3">Deskripsi</th>
                    <th className="px-5 py-3">No. Dokumen</th>
                    <th className="px-5 py-3 text-right">Nilai Debit ↕</th>
                    <th className="px-5 py-3 text-right">Nilai Kredit ↕</th>
                    <th className="px-5 py-3 text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {multiLines.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-16 text-slate-400 font-semibold text-xs bg-slate-50/10">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    multiLines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-5 py-3 text-slate-800 font-bold">
                          {line.account_code} - {line.account_name}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{line.description}</td>
                        <td className="px-5 py-3 text-slate-500">{line.external_document_no || '-'}</td>
                        <td className="px-5 py-3 text-right text-slate-800 font-bold">
                          {line.debit > 0 ? formatIDR(line.debit) : '-'}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-800 font-bold">
                          {line.kredit > 0 ? formatIDR(line.kredit) : '-'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteMultiLine(line.id)}
                            className="w-6 h-6 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer mx-auto transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Bottom Navigation Actions */}
          <div className="flex gap-4 items-center justify-center mt-8 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewState('list')}
              className="flex-1 max-w-[45%] py-2 border border-slate-205 hover:bg-slate-50 text-slate-650 font-bold text-xs rounded-lg cursor-pointer text-center transition-colors shadow-2xs"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveJurnal}
              disabled={savingJurnal || multiLines.length === 0}
              className="flex-1 max-w-[45%] py-2 bg-[#73C240] hover:bg-[#64B031] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg cursor-pointer text-center transition-colors shadow-2xs"
            >
              {savingJurnal ? (
                <div className="flex items-center justify-center gap-1.5">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Menyimpan...</span>
                </div>
              ) : (
                'Simpan'
              )}
            </button>
          </div>

        </div>
      )}

      {/* 3. DATE RANGE FILTER MODAL */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 relative flex flex-col">
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold text-slate-800 mb-4 text-center">Filter</h3>
            
            <div className="space-y-2 mb-6">
              {[
                { label: 'Hari ini', days: 0 },
                { label: 'Kemarin', days: 1 },
                { label: '7 Hari yang lalu', days: 7 },
                { label: '30 Hari yang lalu', days: 30 },
              ].map((range) => (
                <button
                  key={range.label}
                  type="button"
                  onClick={() => {
                    const to = new Date().toISOString().split('T')[0];
                    const from = new Date(Date.now() - range.days * 24 * 3600 * 1000).toISOString().split('T')[0];
                    handleApplyDateRange(range.label, from, to);
                  }}
                  className="w-full py-2 hover:bg-slate-50 text-sky-600 font-bold text-xs text-center border-b border-slate-100 last:border-b-0 cursor-pointer"
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500">Dari</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-805 text-xs font-semibold outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500">Sampai</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-805 text-xs font-semibold outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleApplyDateRange('Hari ini', new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0])}
                className="flex-1 py-2 bg-[#EF5350] hover:bg-[#E53935] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs text-center"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => handleApplyDateRange('Sesuaikan', dateFrom, dateTo)}
                className="flex-1 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs text-center"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. IMPORT MODAL */}
      {isImportOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-md w-full p-6 relative flex flex-col">
            <button
              type="button"
              onClick={() => setIsImportOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-605 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-sm font-extrabold text-slate-800 mb-4 text-center">
              Import Jurnal Umum
            </h3>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="w-full py-2 mb-4 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-2xs text-center flex items-center justify-center gap-1.5"
            >
              <Download size={14} className="text-slate-400" />
              <span>Download Template</span>
            </button>

            <div className="border-2 border-dashed border-slate-205 rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center bg-slate-50/30 hover:bg-slate-50 transition-colors relative mb-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-12 h-12 rounded-full bg-slate-105 flex items-center justify-center mb-3">
                <UploadCloud size={24} className="text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-500 mb-1">
                {importFile ? importFile.name : (
                  <>
                    Drop file here or <span className="text-[#0088E8] hover:underline cursor-pointer">click to upload</span>
                  </>
                )}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mb-6 text-center">
              Import dari CSV (max. 500 baris)
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="flex-1 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUploadImport}
                disabled={!importFile || importLoading}
                className="flex-1 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {importLoading && <Loader2 size={12} className="animate-spin" />}
                <span>Memproses</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADD TEMPLATE NAME MODAL (Fallback) */}
      {isAddTemplateOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-105 max-w-sm w-full p-6 relative flex flex-col">
            <button
              type="button"
              onClick={() => setIsAddTemplateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold text-slate-800 mb-4 text-left">
              Tambah nama jurnal
            </h3>
            
            <div className="space-y-1 mb-5">
              <label className="block text-[10px] font-bold text-slate-550">
                Nama Jurnal Baru
              </label>
              <input
                type="text"
                placeholder="Jurnal"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-205 text-xs bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-slate-800 font-semibold"
              />
            </div>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setIsAddTemplateOpen(false)}
                className="px-6 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-605 font-bold text-xs rounded-lg cursor-pointer shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddJournalTemplateName}
                className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. ADD DEPARTEMENT NAME MODAL (Fallback) */}
      {isAddDeptOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-105 max-w-sm w-full p-6 relative flex flex-col">
            <button
              type="button"
              onClick={() => setIsAddDeptOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-650 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={16} />
            </button>
            <h3 className="text-sm font-bold text-slate-800 mb-4 text-left">
              Tambah departemen
            </h3>
            
            <div className="space-y-1 mb-5">
              <label className="block text-[10px] font-bold text-slate-550">
                Nama Departemen Baru
              </label>
              <input
                type="text"
                placeholder="Departemen"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-205 text-xs bg-slate-50 focus:bg-white focus:border-[#0088E8] outline-none text-slate-805 font-semibold"
              />
            </div>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setIsAddDeptOpen(false)}
                className="px-6 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-605 font-bold text-xs rounded-lg cursor-pointer shadow-2xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAddDeptName}
                className="px-6 py-2 bg-[#0088E8] hover:bg-[#0077CC] text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. CUSTOM TRANSACTION DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 relative flex flex-col">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={16} />
            </button>
            
            <h3 className="text-sm font-bold text-slate-800 mb-4 text-center">
              {deletingEntryNumber ? `Hapus ${deletingEntryNumber}` : `Hapus ${selectedForDelete.length} Transaksi Terpilih`}
            </h3>

            <div className="space-y-1 mb-4 text-left">
              <label className="block text-[11px] font-bold text-slate-550">
                Catatan Penghapusan <span className="text-rose-500">*</span>
              </label>
              <textarea
                placeholder="Masukkan alasan atau catatan penghapusan transaksi..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg border border-slate-205 text-xs bg-slate-50 focus:bg-white focus:border-[#EF5350] outline-none text-slate-800 font-semibold resize-y"
              />
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-semibold">
                <span className="text-rose-500">*</span> Harus diisi
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-6 py-2 border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  disabled={!deleteReason.trim() || isDeleting}
                  className="px-6 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs flex items-center gap-1 disabled:opacity-50"
                >
                  {isDeleting && <Loader2 size={12} className="animate-spin" />}
                  <span>Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. RINCIAN JURNAL POPUP MODAL (As shown in Screenshot 3) */}
      {isRincianJurnalOpen && selectedAccountForRincian && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 relative flex flex-col animate-scale-up">
            
            {/* Header: Title on Left, buttons on Right */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <h3 className="text-sm font-extrabold text-slate-800">
                Rincian Jurnal
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRincianJurnalOpen(false);
                    setSelectedAccountForRincian('');
                  }}
                  className="px-5 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleAddMultiLine}
                  disabled={!rincianCatatan.trim() || rincianJumlah <= 0}
                  className="px-5 py-1.5 bg-[#73C240] hover:bg-[#64B031] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  Selanjutnya
                </button>
              </div>
            </div>

            {/* Modal Form inputs */}
            <div className="space-y-4 text-left">
              {/* Account read-only field */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-450">Akun</label>
                <input
                  type="text"
                  readOnly
                  value={`${selectedAccountForRincian.code} - ${selectedAccountForRincian.name}`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold outline-none cursor-default select-none"
                />
              </div>

              {/* Type toggle buttons: Debit vs Kredit */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-450">
                  Tipe <span className="text-rose-500">*</span>
                </label>
                <div className="flex border border-slate-205 rounded-lg overflow-hidden bg-slate-50 p-0.5 font-bold text-xs">
                  <button
                    type="button"
                    onClick={() => setRincianType('debit')}
                    className={`flex-1 py-2 rounded-md transition-all cursor-pointer text-center ${
                      rincianType === 'debit'
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Debit
                  </button>
                  <button
                    type="button"
                    onClick={() => setRincianType('kredit')}
                    className={`flex-1 py-2 rounded-md transition-all cursor-pointer text-center ${
                      rincianType === 'kredit'
                        ? 'bg-[#0088E8] text-white shadow-2xs'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Kredit
                  </button>
                </div>
              </div>

              {/* Amount value */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-450">
                  Jumlah <span className="text-rose-500">*</span>
                </label>
                <div className="flex border border-slate-205 rounded-lg bg-slate-50 focus-within:bg-white overflow-hidden px-3 py-2">
                  <span className="text-xs font-bold text-slate-400 mr-2 flex items-center">IDR</span>
                  <NumericInput
                    value={rincianJumlah}
                    onChange={(val) => setRincianJumlah(val)}
                    min={0}
                    className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none border-none p-0 focus:ring-0"
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Description resizable Catatan */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-450">
                  Catatan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  placeholder="Masukkan deskripsi baris jurnal..."
                  value={rincianCatatan}
                  onChange={(e) => setRincianCatatan(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 focus:bg-white text-xs text-slate-800 font-semibold outline-none resize-y"
                />
              </div>

              {/* Reference Document */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-450">No. Dokumen</label>
                <input
                  type="text"
                  placeholder="No. Dokumen"
                  value={rincianNoDokumen}
                  onChange={(e) => setRincianNoDokumen(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-205 bg-slate-50 focus:bg-white text-xs text-slate-800 font-semibold outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
