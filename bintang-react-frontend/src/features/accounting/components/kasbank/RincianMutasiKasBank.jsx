import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notifyApiError } from '../../../../utils/notify';
import { downloadFile } from '../../../../utils/downloadFile';
import PasanganJurnalModal from '../../components/PasanganJurnalModal';
import HapusTransaksiModal from '../../components/HapusTransaksiModal';

// Import sub-components
import MutasiFilterRow from './MutasiFilterRow';
import MutasiTable from './MutasiTable';

export default function RincianMutasiKasBank({
  accountId,
  onBack,
  initialDateFrom,
  initialDateTo
}) {
  const [account, setAccount] = useState(null);
  const [rows, setRows] = useState([]);
  const [saldoAwal, setSaldoAwal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Period States
  const [currentDate, setCurrentDate] = useState(new Date(2026, 6, 1)); // Default July 2026
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Filter & Search States
  const [selectedFilter, setSelectedFilter] = useState('Semua');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states
  const [showPdfDropdown, setShowPdfDropdown] = useState(false);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);
  const [activeActionRowId, setActiveActionRowId] = useState(null);

  // Modals state
  const [selectedEntryNumber, setSelectedEntryNumber] = useState(null);
  const [isPasanganOpen, setIsPasanganOpen] = useState(false);
  const [isHapusOpen, setIsHapusOpen] = useState(false);

  const filterRef = useRef(null);
  const pdfRef = useRef(null);
  const excelRef = useRef(null);
  const actionDropdownRef = useRef(null);

  const filterOptions = [
    'Semua',
    'No. Transaksi',
    'Tgl Transaksi',
    'Nama Tipe Transaksi',
    'Departemen',
    'Pelanggan',
    'Supplier',
    'No. Dokumen',
    'Deskripsi',
    'Mata Uang',
  ];

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

  const fetchMutationDetails = () => {
    setLoading(true);
    const period = getPeriodString(currentDate);
    const date_from = `${period}-01`;
    const date_to = getPeriodEndString(currentDate);

    apiClient
      .get(`/accounting/ledger/${accountId}/`, {
        params: { date_from, date_to },
      })
      .then((res) => {
        setAccount(res.data?.account || null);
        setSaldoAwal(res.data?.saldo_awal || 0);
        setRows(res.data?.rows || []);
      })
      .catch((err) => notifyApiError(err, 'Gagal memuat rincian mutasi kas bank'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMutationDetails();
  }, [currentDate, accountId]);

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

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExport = (format) => {
    const period = getPeriodString(currentDate);
    const date_from = `${period}-01`;
    const date_to = getPeriodEndString(currentDate);
    if (format === 'excel') {
      downloadFile(
        `/accounting/ledger/${accountId}/export/?date_from=${date_from}&date_to=${date_to}`,
        `mutasi-${account?.code || accountId}.xlsx`,
      );
    } else {
      window.print();
    }
  };

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim() || selectedFilter === 'Semua') return rows;
    const query = searchQuery.toLowerCase();

    return rows.filter((row) => {
      switch (selectedFilter) {
        case 'No. Transaksi':
          return (row.entry_number || '').toLowerCase().includes(query);
        case 'Tgl Transaksi':
          return formatDateLabel(row.date).toLowerCase().includes(query);
        case 'Nama Tipe Transaksi':
          return (row.description || '').toLowerCase().includes(query);
        case 'Departemen':
          return (row.department_name || '').toLowerCase().includes(query);
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
        default:
          return true;
      }
    });
  }, [rows, selectedFilter, searchQuery]);

  return (
    <div className="space-y-4 animate-fade-in pb-12 text-xs font-semibold text-slate-700">
      
      {/* Upper header */}
      <div className="flex flex-wrap gap-4 items-center justify-between pb-1">
        <h2 className="text-sm font-bold text-slate-900">
          {account ? `${account.code} - ${account.name}` : 'Rincian Mutasi'}
        </h2>

        {/* Back green border button */}
        <button
          type="button"
          onClick={onBack}
          className="no-print flex items-center gap-1 px-4 py-1.5 border border-[#73C240] bg-white hover:bg-slate-50 text-[#73C240] font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-2xs"
        >
          <ChevronLeft size={13} />
          <span>Kembali</span>
        </button>
      </div>

      <MutasiFilterRow
        currentDate={currentDate}
        showMonthPicker={showMonthPicker}
        setShowMonthPicker={setShowMonthPicker}
        getMonthYearLabel={getMonthYearLabel}
        handlePrevMonth={handlePrevMonth}
        handleNextMonth={handleNextMonth}
        setCurrentDate={setCurrentDate}
        selectedFilter={selectedFilter}
        setSelectedFilter={setSelectedFilter}
        showFilterDropdown={showFilterDropdown}
        setShowFilterDropdown={setShowFilterDropdown}
        filterOptions={filterOptions}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleExport={handleExport}
        pdfRef={pdfRef}
        excelRef={excelRef}
        filterRef={filterRef}
      />

      <MutasiTable
        loading={loading}
        filteredRows={filteredRows}
        saldoAwal={saldoAwal}
        formatIDR={formatIDR}
        formatDateLabel={formatDateLabel}
        account={account}
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

      {/* Modals for matching entries & transaction deletion */}
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
