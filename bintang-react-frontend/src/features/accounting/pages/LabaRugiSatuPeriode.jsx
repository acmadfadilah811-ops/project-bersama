import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { downloadFile } from '../../../utils/downloadFile';
import { notifyApiError } from '../../../utils/notify';
import LabaRugiToolbar from '../components/LabaRugiToolbar';
import LabaRugiFilterModal from '../components/LabaRugiFilterModal';
import LabaRugiSatuPeriodeReport from '../components/LabaRugiSatuPeriodeReport';
import RincianMutasiAkun from './RincianMutasiAkun';

export default function LabaRugiSatuPeriode() {
  // --- STATE KONTROL TANGGAL ---
  const [dateMode, setDateMode] = useState('Bulan'); // 'Sesuaikan' | 'Bulan' | 'Tahun'
  const [preset, setPreset] = useState('Hari ini');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  // --- STATE MODAL FILTER TANGGAL (SS NO 2) ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempPreset, setTempPreset] = useState('Hari ini');
  const [tempStartDate, setTempStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [tempEndDate, setTempEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  // --- STATE PENGATURAN LAPORAN (GEAR MODAL) ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hideZeroAccounts, setHideZeroAccounts] = useState(false);

  // --- STATE DATA LAPORAN & LOADING ---
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // --- STATE DRILL-DOWN: klik nominal akun -> Rincian Mutasi Akun ---
  const [viewingAccountId, setViewingAccountId] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);

  useEffect(() => {
    apiClient
      .get('/accounting/accounts/', { params: { semua_akun: 'true' } })
      .then((res) => setAllAccounts((res.data || []).filter((a) => a.is_active !== false)))
      .catch(() => {});
  }, []);

  // Format Rupiah (contoh: 367.500,00)
  const formatRupiah = (val) => {
    const num = Number(val || 0);
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integerPart},${parts[1]}`;
  };

  // Navigasi Waktu (< / >) untuk Bulan & Tahun
  const handlePrevDate = () => {
    if (dateMode === 'Bulan') {
      setCurrentDate((prev) => {
        const nxt = prev.subtract(1, 'month');
        setStartDate(nxt.startOf('month').format('YYYY-MM-DD'));
        setEndDate(nxt.endOf('month').format('YYYY-MM-DD'));
        return nxt;
      });
    } else if (dateMode === 'Tahun') {
      setCurrentDate((prev) => {
        const nxt = prev.subtract(1, 'year');
        setStartDate(nxt.startOf('year').format('YYYY-MM-DD'));
        setEndDate(nxt.endOf('year').format('YYYY-MM-DD'));
        return nxt;
      });
    }
  };

  const handleNextDate = () => {
    if (dateMode === 'Bulan') {
      setCurrentDate((prev) => {
        const nxt = prev.add(1, 'month');
        setStartDate(nxt.startOf('month').format('YYYY-MM-DD'));
        setEndDate(nxt.endOf('month').format('YYYY-MM-DD'));
        return nxt;
      });
    } else if (dateMode === 'Tahun') {
      setCurrentDate((prev) => {
        const nxt = prev.add(1, 'year');
        setStartDate(nxt.startOf('year').format('YYYY-MM-DD'));
        setEndDate(nxt.endOf('year').format('YYYY-MM-DD'));
        return nxt;
      });
    }
  };

  // Switch Mode Tanggal (Sesuaikan / Bulan / Tahun)
  const handleModeChange = (mode) => {
    setDateMode(mode);
    if (mode === 'Bulan') {
      setStartDate(currentDate.startOf('month').format('YYYY-MM-DD'));
      setEndDate(currentDate.endOf('month').format('YYYY-MM-DD'));
    } else if (mode === 'Tahun') {
      setStartDate(currentDate.startOf('year').format('YYYY-MM-DD'));
      setEndDate(currentDate.endOf('year').format('YYYY-MM-DD'));
    }
  };

  // Format Teks Tombol Filter Tanggal (contoh: Hari ini 27 Jul 2026 - 27 Jul 2026)
  const getFilterButtonText = () => {
    const sFormatted = dayjs(startDate).format('DD MMM YYYY');
    const eFormatted = dayjs(endDate).format('DD MMM YYYY');
    if (dateMode === 'Bulan') {
      return `${currentDate.format('MMMM YYYY')}`;
    } else if (dateMode === 'Tahun') {
      return `${currentDate.format('YYYY')}`;
    }
    return `${preset} ${sFormatted} - ${eFormatted}`;
  };

  // Helper kalkulasi preset tanggal di modal
  const getDatesForPreset = (selectedPreset) => {
    const today = dayjs();
    let start = today;
    let end = today;

    if (selectedPreset === 'Hari ini') {
      start = today;
      end = today;
    } else if (selectedPreset === 'Kemarin') {
      start = today.subtract(1, 'day');
      end = today.subtract(1, 'day');
    } else if (selectedPreset === '7 Hari yang lalu') {
      start = today.subtract(6, 'day');
      end = today;
    } else if (selectedPreset === '30 Hari yang lalu') {
      start = today.subtract(29, 'day');
      end = today;
    } else if (selectedPreset === 'Bulan ini') {
      start = today.startOf('month');
      end = today.endOf('month');
    } else if (selectedPreset === 'Bulan lalu') {
      const prevMonth = today.subtract(1, 'month');
      start = prevMonth.startOf('month');
      end = prevMonth.endOf('month');
    }

    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    };
  };

  // Handler Buka Modal Filter
  const handleOpenFilterModal = () => {
    setTempPreset(preset);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsFilterModalOpen(true);
  };

  const handleSelectPreset = (p) => {
    setTempPreset(p);
    if (p !== 'Sesuaikan') {
      const { startDate: s, endDate: e } = getDatesForPreset(p);
      setTempStartDate(s);
      setTempEndDate(e);
    }
  };

  const handleResetFilterModal = () => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    setTempPreset('Hari ini');
    setTempStartDate(todayStr);
    setTempEndDate(todayStr);
  };

  const handleApplyFilterModal = () => {
    setPreset(tempPreset);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setDateMode('Sesuaikan');
    setIsFilterModalOpen(false);
  };

  // Fetch Report Data dari API — Laba Rugi dihitung dari accounting.JournalEntry
  // per klasifikasi COA (bukan dari transaksi penjualan mentah).
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/accounting/reports/income-statement/', {
        params: { date_from: startDate, date_to: endDate },
      });
      setReportData(res.data);
    } catch (err) {
      setReportData(null);
      notifyApiError(err, 'Gagal memuat data laporan laba rugi');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export handlers
  const handleExportPdf = () => window.print();
  const handleExportExcel = () => {
    downloadFile(`/accounting/reports/income-statement/export/?date_from=${startDate}&date_to=${endDate}`, 'laba-rugi.xlsx');
  };

  // Filter akun bernilai 0 jika disetting
  const filterAccounts = (list) => {
    if (!hideZeroAccounts) return list;
    return list.filter((item) => Number(item.amount) !== 0);
  };

  const listPendapatan = filterAccounts(reportData?.pendapatan || []);
  const listHpp = filterAccounts(reportData?.hpp || []);
  const listBiayaOp = filterAccounts(reportData?.biaya_operasional || []);
  const listPendapatanNonOp = filterAccounts(reportData?.pendapatan_non_operasional || []);
  const listBiayaNonOp = filterAccounts(reportData?.biaya_non_operasional || []);

  // Total — dari perhitungan server (M6: dihitung ulang server-side), bukan
  // dijumlah ulang di sini supaya selalu konsisten dengan backend.
  const subTotalPendapatan = Number(reportData?.subtotal_pendapatan || 0);
  const subTotalHpp = Number(reportData?.subtotal_hpp || 0);
  const totalLabaKotor = Number(reportData?.total_laba_kotor || 0);
  const totalBiayaOp = Number(reportData?.total_biaya_operasional || 0);
  const subTotalPendapatanNonOp = Number(reportData?.subtotal_pendapatan_non_operasional || 0);
  const subTotalBiayaNonOp = Number(reportData?.subtotal_biaya_non_operasional || 0);
  const totalPendapatanNonOp = Number(reportData?.total_pendapatan_non_operasional || 0);
  const labaBersih = Number(reportData?.laba_bersih || 0);

  // Klik nominal akun -> buka Rincian Mutasi Akun (drill-down), reuse
  // komponen yang sama dipakai Buku Besar/Biaya.
  if (viewingAccountId) {
    return (
      <RincianMutasiAkun
        accountId={viewingAccountId}
        onBack={() => setViewingAccountId(null)}
        accounts={allAccounts}
        setViewingAccountId={setViewingAccountId}
        initialDateFrom={startDate}
        initialDateTo={endDate}
      />
    );
  }

  return (
    <div className="space-y-4 font-sans text-slate-800">
      <LabaRugiToolbar
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        hideZeroAccounts={hideZeroAccounts}
        setHideZeroAccounts={setHideZeroAccounts}
        dateMode={dateMode}
        handleModeChange={handleModeChange}
        handlePrevDate={handlePrevDate}
        handleNextDate={handleNextDate}
        handleOpenFilterModal={handleOpenFilterModal}
        getFilterButtonText={getFilterButtonText}
        handleExportPdf={handleExportPdf}
        handleExportExcel={handleExportExcel}
      />

      <p className="text-[11px] text-slate-400 italic px-1">
        Dihitung dari jurnal terposting (Akuntansi) — bisa berbeda dari Laba Rugi di Laporan Penjualan yang
        dihitung dari transaksi penjualan. Keduanya sengaja terpisah untuk tujuan berbeda.
      </p>

      <LabaRugiSatuPeriodeReport
        loading={loading}
        listPendapatan={listPendapatan}
        listHpp={listHpp}
        listBiayaOp={listBiayaOp}
        listPendapatanNonOp={listPendapatanNonOp}
        listBiayaNonOp={listBiayaNonOp}
        subTotalPendapatan={subTotalPendapatan}
        subTotalHpp={subTotalHpp}
        totalLabaKotor={totalLabaKotor}
        totalBiayaOp={totalBiayaOp}
        subTotalPendapatanNonOp={subTotalPendapatanNonOp}
        subTotalBiayaNonOp={subTotalBiayaNonOp}
        totalPendapatanNonOp={totalPendapatanNonOp}
        labaBersih={labaBersih}
        formatRupiah={formatRupiah}
        onViewAccount={setViewingAccountId}
      />

      <LabaRugiFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        tempPreset={tempPreset}
        onSelectPreset={handleSelectPreset}
        tempStartDate={tempStartDate}
        setTempStartDate={setTempStartDate}
        setTempPresetToSesuaikan={() => setTempPreset('Sesuaikan')}
        tempEndDate={tempEndDate}
        setTempEndDate={setTempEndDate}
        onReset={handleResetFilterModal}
        onApply={handleApplyFilterModal}
      />
    </div>
  );
}
