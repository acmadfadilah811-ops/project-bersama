import { useState, useEffect, useRef, useMemo } from 'react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import { downloadFile } from '../../../utils/downloadFile';
import { useAuth } from '../../../context/AuthContext';
import PasanganJurnalModal from '../components/PasanganJurnalModal';
import HapusTransaksiModal from '../components/HapusTransaksiModal';
import RincianMutasiAkunTable from '../components/RincianMutasiAkunTable';
import RincianMutasiAkunFilterBar from '../components/RincianMutasiAkunFilterBar';
import RincianMutasiAkunHeader from '../components/RincianMutasiAkunHeader';

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
  // Bila dibuka dari laporan, pertahankan tepat rentang laporan tersebut agar
  // saldo awal + mutasi menjelaskan nominal yang diklik. Tanpa rentang awal,
  // perilaku lama tetap menggunakan mode Bulan.
  const [dateMode, setDateMode] = useState(initialDateFrom || initialDateTo ? 'Sesuaikan' : 'Bulan');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026
  const [currentYear, setCurrentYear] = useState(2026);
  const [customDateFrom] = useState(initialDateFrom || '2026-07-01');
  const [customDateTo] = useState(initialDateTo || '2026-07-31');
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

  // Aksi per baris: Pasangan Jurnal & Hapus (reuse modal yang sudah dipakai Kas & Bank)
  const [activeActionRowId, setActiveActionRowId] = useState(null);
  const [selectedEntryNumber, setSelectedEntryNumber] = useState(null);
  const [isPasanganOpen, setIsPasanganOpen] = useState(false);
  const [isHapusOpen, setIsHapusOpen] = useState(false);

  const filterRef = useRef(null);
  const exportRef = useRef(null);
  const outletRef = useRef(null);
  const accountRef = useRef(null);
  const periodRef = useRef(null);
  const actionDropdownRef = useRef(null);

  const filterOptions = [
    'Semua',
    'No. Transaksi',
    'Tgl Transaksi',
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
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(e.target)) setActiveActionRowId(null);
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
    if (dateMode === 'Bulan') {
      const period = getPeriodString(currentDate);
      return { date_from: `${period}-01`, date_to: getPeriodEndString(currentDate) };
    }
    if (dateMode === 'Tahun') {
      return { date_from: `${currentYear}-01-01`, date_to: `${currentYear}-12-31` };
    }
    return { date_from: customDateFrom, date_to: customDateTo };
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
        case 'Tgl Transaksi':
          return formatDateLabel(row.date).toLowerCase().includes(query);
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
      <RincianMutasiAkunHeader
        activeUserLabel={activeUserLabel}
        outletRef={outletRef} showOutletDropdown={showOutletDropdown} setShowOutletDropdown={setShowOutletDropdown}
        accountRef={accountRef} showAccountDropdown={showAccountDropdown} setShowAccountDropdown={setShowAccountDropdown}
        account={account} accounts={accounts} accountId={accountId} setViewingAccountId={setViewingAccountId}
        onBack={onBack}
      />

      {/* 2. Filter Navigation and Export Actions Row (Screenshot 2) */}
      <RincianMutasiAkunFilterBar
        dateMode={dateMode} setDateMode={setDateMode}
        periodRef={periodRef} showPeriodDropdown={showPeriodDropdown} setShowPeriodDropdown={setShowPeriodDropdown}
        currentDate={currentDate} setCurrentDate={setCurrentDate} currentYear={currentYear}
        customDateFrom={customDateFrom} customDateTo={customDateTo}
        handlePrevPeriod={handlePrevPeriod} handleNextPeriod={handleNextPeriod}
        getMonthYearLabel={getMonthYearLabel} formatDateLabel={formatDateLabel}
        showMonthPicker={showMonthPicker} setShowMonthPicker={setShowMonthPicker}
        filterRef={filterRef} selectedFilter={selectedFilter} setSelectedFilter={setSelectedFilter}
        showFilterDropdown={showFilterDropdown} setShowFilterDropdown={setShowFilterDropdown}
        filterOptions={filterOptions}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        exportRef={exportRef} showExportDropdown={showExportDropdown} setShowExportDropdown={setShowExportDropdown}
        handleExport={handleExport}
      />

      {/* 3. Detailed Mutations Table */}
      <RincianMutasiAkunTable
        loading={loading}
        filteredRows={filteredRows}
        saldoAwal={saldoAwal}
        formatIDR={formatIDR}
        formatDateLabel={formatDateLabel}
        activeActionRowId={activeActionRowId}
        setActiveActionRowId={setActiveActionRowId}
        actionDropdownRef={actionDropdownRef}
        onOpenPasangan={(entryNo) => {
          setSelectedEntryNumber(entryNo);
          setIsPasanganOpen(true);
        }}
        onOpenHapus={(entryNo) => {
          setSelectedEntryNumber(entryNo);
          setIsHapusOpen(true);
        }}
      />

      {/* Modals: Pasangan Jurnal & Hapus Transaksi (reuse yang sudah dipakai Kas & Bank) */}
      <PasanganJurnalModal
        isOpen={isPasanganOpen}
        onClose={() => {
          setIsPasanganOpen(false);
          setSelectedEntryNumber(null);
        }}
        entryNumber={selectedEntryNumber}
      />
      <HapusTransaksiModal
        isOpen={isHapusOpen}
        onClose={() => {
          setIsHapusOpen(false);
          setSelectedEntryNumber(null);
        }}
        entryNumber={selectedEntryNumber}
        onDeleted={fetchMutationDetails}
      />

    </div>
  );
}
