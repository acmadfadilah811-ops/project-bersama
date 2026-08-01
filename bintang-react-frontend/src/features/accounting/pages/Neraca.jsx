import { useState, useEffect, useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { downloadFile } from '../../../utils/downloadFile';
import { notifyApiError } from '../../../utils/notify';
import NeracaToolbar from '../components/NeracaToolbar';
import NeracaReport from '../components/NeracaReport';
import RincianMutasiAkun from './RincianMutasiAkun';

export default function Neraca() {
  // --- STATE LAYOUT (VERSI DISAMPING [||] VS VERSI KEBAWAH [=]) ---
  const [layoutMode, setLayoutMode] = useState('side');

  // --- STATE KONTROL TANGGAL ---
  const [dateMode, setDateMode] = useState('Bulan'); // 'Harian' | 'Bulan' | 'Tahun'
  const [currentDate, setCurrentDate] = useState(dayjs());

  // --- STATE POPUP KALENDER INTERAKTIF ---
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerDecade, setPickerDecade] = useState(2020);
  const calendarRef = useRef(null);

  // --- STATE PENGATURAN LAPORAN (GEAR MODAL) ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hideZeroAccounts, setHideZeroAccounts] = useState(false);

  // --- STATE DATA & LOADING ---
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Drill-down: nominal akun Neraca membuka rincian mutasi jurnal yang sama
  // seperti Laba Rugi Satu Periode.
  const [viewingAccountId, setViewingAccountId] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);

  useEffect(() => {
    apiClient
      .get('/accounting/accounts/', { params: { semua_akun: 'true' } })
      .then((res) => setAllAccounts((res.data || []).filter((account) => account.is_active !== false)))
      .catch(() => {});
  }, []);

  // Format Rupiah (contoh: 367.500,00)
  const formatRupiah = (val) => {
    const num = Number(val || 0);
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integerPart},${parts[1]}`;
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevDate = () => {
    if (dateMode === 'Harian') setCurrentDate((prev) => prev.subtract(1, 'day'));
    else if (dateMode === 'Bulan') setCurrentDate((prev) => prev.subtract(1, 'month'));
    else if (dateMode === 'Tahun') setCurrentDate((prev) => prev.subtract(1, 'year'));
  };

  const handleNextDate = () => {
    if (dateMode === 'Harian') setCurrentDate((prev) => prev.add(1, 'day'));
    else if (dateMode === 'Bulan') setCurrentDate((prev) => prev.add(1, 'month'));
    else if (dateMode === 'Tahun') setCurrentDate((prev) => prev.add(1, 'year'));
  };

  const getDateDisplay = () => {
    if (dateMode === 'Harian') return currentDate.format('DD-MM-YYYY');
    if (dateMode === 'Bulan') return currentDate.format('MMMM YYYY');
    return currentDate.format('YYYY');
  };

  // Rentang periode untuk "Pendapatan periode ini" — Neraca sendiri selalu
  // saldo kumulatif per date_to (akhir periode terpilih).
  const getPeriodRange = useCallback(() => {
    if (dateMode === 'Harian') {
      const d = currentDate.format('YYYY-MM-DD');
      return { from: d, to: d };
    }
    if (dateMode === 'Bulan') {
      return { from: currentDate.startOf('month').format('YYYY-MM-DD'), to: currentDate.endOf('month').format('YYYY-MM-DD') };
    }
    return { from: currentDate.startOf('year').format('YYYY-MM-DD'), to: currentDate.endOf('year').format('YYYY-MM-DD') };
  }, [dateMode, currentDate]);

  // Fetch Report Data dari API — Neraca dihitung dari accounting.JournalEntry
  // per klasifikasi COA, saldo kumulatif sampai akhir periode terpilih.
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = getPeriodRange();
      const res = await apiClient.get('/accounting/reports/balance-sheet/', {
        params: { date_from: from, date_to: to },
      });
      setReportData(res.data);
    } catch (err) {
      setReportData(null);
      notifyApiError(err, 'Gagal memuat data Neraca');
    } finally {
      setLoading(false);
    }
  }, [getPeriodRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export handlers
  const handleExportPdf = () => window.print();
  const handleExportExcel = () => {
    const { from, to } = getPeriodRange();
    downloadFile(`/accounting/reports/balance-sheet/export/?date_from=${from}&date_to=${to}`, 'neraca.xlsx');
  };

  // Filter 0 jika disetting, lalu format Rupiah untuk tampilan
  const prepareList = (list) => {
    const filtered = hideZeroAccounts ? list.filter((item) => Number(item.amount) !== 0) : list;
    return filtered.map((item) => ({ ...item, formatted: formatRupiah(item.amount) }));
  };

  const listAsetLancar = prepareList(reportData?.aset_lancar || []);
  const listAsetTidakLancar = prepareList(reportData?.aset_tidak_lancar || []);
  const listKewajiban = prepareList(reportData?.kewajiban || []);
  const listModal = prepareList(reportData?.modal || []);

  // Total — dari perhitungan server (M6), bukan dijumlah ulang di sini.
  const subTotalAsetLancar = formatRupiah(reportData?.subtotal_aset_lancar || 0);
  const subTotalAsetTidakLancar = formatRupiah(reportData?.subtotal_aset_tidak_lancar || 0);
  const totalAset = formatRupiah(reportData?.total_aset || 0);
  const subTotalKewajiban = formatRupiah(reportData?.subtotal_kewajiban || 0);
  const subTotalModal = formatRupiah(reportData?.subtotal_modal || 0);
  const totalKewajibanModal = formatRupiah(reportData?.total_kewajiban_modal || 0);

  const yearGrid = Array.from({ length: 12 }, (_, i) => pickerDecade + i);

  if (viewingAccountId) {
    const { from, to } = getPeriodRange();
    return (
      <RincianMutasiAkun
        accountId={viewingAccountId}
        onBack={() => setViewingAccountId(null)}
        accounts={allAccounts}
        setViewingAccountId={setViewingAccountId}
        initialDateFrom={from}
        initialDateTo={to}
      />
    );
  }

  return (
    <div className="space-y-3 font-sans text-slate-800">
      <NeracaToolbar
        layoutMode={layoutMode} setLayoutMode={setLayoutMode}
        isSettingsOpen={isSettingsOpen} setIsSettingsOpen={setIsSettingsOpen}
        hideZeroAccounts={hideZeroAccounts} setHideZeroAccounts={setHideZeroAccounts}
        dateMode={dateMode} setDateMode={setDateMode}
        calendarRef={calendarRef} isCalendarOpen={isCalendarOpen} setIsCalendarOpen={setIsCalendarOpen}
        handlePrevDate={handlePrevDate} handleNextDate={handleNextDate} getDateDisplay={getDateDisplay}
        currentDate={currentDate} setCurrentDate={setCurrentDate}
        pickerDecade={pickerDecade} setPickerDecade={setPickerDecade} yearGrid={yearGrid}
        handleExportPdf={handleExportPdf} handleExportExcel={handleExportExcel}
      />

      <p className="text-[11px] text-slate-400 italic px-1">
        Dihitung dari jurnal terposting (Akuntansi), saldo kumulatif sampai akhir periode terpilih.
      </p>

      <NeracaReport
        loading={loading}
        layoutMode={layoutMode}
        listAsetLancar={listAsetLancar}
        listAsetTidakLancar={listAsetTidakLancar}
        listKewajiban={listKewajiban}
        listModal={listModal}
        subTotalAsetLancar={subTotalAsetLancar}
        subTotalAsetTidakLancar={subTotalAsetTidakLancar}
        totalAset={totalAset}
        subTotalKewajiban={subTotalKewajiban}
        subTotalModal={subTotalModal}
        totalKewajibanModal={totalKewajibanModal}
        onViewAccount={setViewingAccountId}
      />
    </div>
  );
}
