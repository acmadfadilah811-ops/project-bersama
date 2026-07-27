import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  FileText,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';

const PRESET_OPTIONS = [
  'Hari ini',
  'Kemarin',
  '7 Hari yang lalu',
  '30 Hari yang lalu',
  'Bulan ini',
  'Bulan lalu',
  'Sesuaikan',
];

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

  // Fetch Report Data dari API
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        start_date: startDate,
        end_date: endDate,
      };
      await apiClient.get('/accounting/ledger/', { params });
    } catch (err) {
      console.error('Gagal memuat data laporan laba rugi:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export handlers
  const handleExportPdf = () => window.print();
  const handleExportExcel = () => alert('Mengunduh Laporan Laba Rugi (.xlsx)...');

  // RAW AKUN UNTUK LAPORAN
  const rawPendapatan = [
    { code: '40000', name: 'Penjualan', amount: 367500 },
    { code: '41000', name: 'Penjualan antar cabang', amount: 0 },
    { code: '42000', name: 'Layanan biaya penjualan', amount: 0 },
    { code: '44000', name: 'Pengiriman penjualan', amount: 0, isLink: true },
    { code: '46100', name: 'Potongan penjualan', amount: 0 },
    { code: '46200', name: 'Loyalitas penjualan', amount: 0 },
    { code: '46300', name: 'Return penjualan', amount: 0 },
  ];

  const rawHpp = [
    { code: '', name: 'Persediaan awal', amount: 0 },
    { code: '50000', name: 'Pembelian', amount: 0 },
    { code: '50100', name: 'Pembelian antar cabang', amount: 0 },
    { code: '50300', name: 'Biaya pengiriman', amount: 0 },
    { code: '50400', name: 'Return pembelian', amount: 0, isLink: true },
    { code: '50500', name: 'Potongan pembelian', amount: 0 },
    { code: '', name: 'Persediaan akhir', amount: 0 },
  ];

  const rawBiayaOperasional = [
    { code: '60100', name: 'Biaya gaji', amount: 0 },
    { code: '60200', name: 'Biaya air listrik telephone', amount: 0 },
    { code: '60300', name: 'Biaya perlengkapan', amount: 0 },
    { code: '60400', name: 'Biaya penyusutan', amount: 0 },
    { code: '60500', name: 'Biaya transfer', amount: 0 },
  ];

  const rawPendapatanNonOp = [
    { code: '70000', name: 'Pendapatan lain lain', amount: 0 },
    { code: '70001', name: 'Pembulatan', amount: 0 },
    { code: '70002', name: 'Code Uniq Penjualan', amount: 0 },
    { code: '70003', name: 'Layanan Penjualan', amount: 0 },
    { code: '70009', name: 'Bank Example', amount: 0 },
  ];

  const rawBiayaNonOp = [
    { code: '80000', name: 'Pengeluaran lain lain', amount: 0 },
    { code: '81000', name: 'Penyesuaian Barang', amount: 0 },
  ];

  // Filter akun bernilai 0 jika disetting
  const filterAccounts = (list) => {
    if (!hideZeroAccounts) return list;
    return list.filter((item) => Number(item.amount) !== 0);
  };

  const listPendapatan = filterAccounts(rawPendapatan);
  const listHpp = filterAccounts(rawHpp);
  const listBiayaOp = filterAccounts(rawBiayaOperasional);
  const listPendapatanNonOp = filterAccounts(rawPendapatanNonOp);
  const listBiayaNonOp = filterAccounts(rawBiayaNonOp);

  // Kalkulasi
  const subTotalPendapatan = listPendapatan.reduce((acc, curr) => acc + curr.amount, 0);
  const subTotalHpp = listHpp.reduce((acc, curr) => acc + curr.amount, 0);
  const totalLabaKotor = subTotalPendapatan - subTotalHpp;

  const totalBiayaOp = listBiayaOp.reduce((acc, curr) => acc + curr.amount, 0);

  const subTotalPendapatanNonOp = listPendapatanNonOp.reduce((acc, curr) => acc + curr.amount, 0);
  const subTotalBiayaNonOp = listBiayaNonOp.reduce((acc, curr) => acc + curr.amount, 0);
  const totalPendapatanNonOp = subTotalPendapatanNonOp - subTotalBiayaNonOp;

  const labaBersih = totalLabaKotor - totalBiayaOp + totalPendapatanNonOp;

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* TOOLBAR BARIS ATAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* KIRI: GEAR SETTINGS BUTTON */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
            title="Pengaturan Laporan"
          >
            <Settings size={18} />
          </button>

          {/* POPUP PENGATURAN LAPORAN */}
          {isSettingsOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-fade-in">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800">Pengaturan Laporan</h4>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                >
                  <X size={14} />
                </button>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideZeroAccounts}
                  onChange={(e) => setHideZeroAccounts(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8] cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-700">
                  Sembunyikan Akun Bernilai Nol
                </span>
              </label>
            </div>
          )}
        </div>

        {/* TENGAH: CONTROL KALENDER PERSIS SESUAI SS NO 1 */}
        <div className="flex flex-col items-center gap-0 w-full sm:w-auto">
          {/* BARIS ATAS: TOMBOL FILTER CORONG TEKS HARI INI */}
          <div className="flex items-center w-full justify-center">
            {dateMode !== 'Sesuaikan' && (
              <button
                type="button"
                onClick={handlePrevDate}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenFilterModal}
              className="flex items-center justify-center gap-2 px-6 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 font-bold text-xs rounded-t-lg transition-all cursor-pointer select-none"
            >
              <Filter size={13} className="text-slate-700 fill-slate-700" />
              <span>{getFilterButtonText()}</span>
            </button>

            {dateMode !== 'Sesuaikan' && (
              <button
                type="button"
                onClick={handleNextDate}
                className="px-2 py-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            )}
          </div>

          {/* BARIS BAWAH: SEGMENTED TABS (SESUAIKAN | BULAN | TAHUN) */}
          <div className="flex items-center border border-slate-300 rounded-b-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => handleModeChange('Sesuaikan')}
              className={`px-5 py-2 transition-all cursor-pointer border-r border-slate-300 ${
                dateMode === 'Sesuaikan'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              Sesuaikan
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('Bulan')}
              className={`px-5 py-2 transition-all cursor-pointer border-r border-slate-300 ${
                dateMode === 'Bulan'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              Bulan
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('Tahun')}
              className={`px-5 py-2 transition-all cursor-pointer ${
                dateMode === 'Tahun'
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              Tahun
            </button>
          </div>
        </div>

        {/* KANAN: TOMBOL EXPORT PDF & EXCEL */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileText size={14} className="text-slate-600" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet size={14} className="text-slate-600" />
            <span>EXCEL</span>
          </button>
        </div>
      </div>

      {/* CARD BODY LAPORAN LABA RUGI SATU PERIODE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 relative min-h-[500px]">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
              <Loader2 size={20} className="animate-spin" />
              <span>Memuat data Laba Rugi...</span>
            </div>
          </div>
        )}

        {/* SECTION 1: PENDAPATAN BERSIH OPERASIONAL */}
        <div className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
          {/* HEADER BAR SECTION 1 (CYAN BLUE) */}
          <div className="bg-[#0099E6] text-white px-4 py-2.5 font-bold text-xs tracking-wide">
            Pendapatan bersih operasional
          </div>

          {/* SUB-HEADER: LABA KOTOR */}
          <div className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-b border-slate-200">
            Laba kotor
          </div>

          {/* GROUP: PENDAPATAN */}
          <div className="p-4 space-y-2">
            <div className="text-xs font-semibold text-slate-600 mb-2">Pendapatan</div>

            <div className="space-y-1.5 pl-6">
              {listPendapatan.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs py-0.5">
                  <span
                    className={
                      item.isLink
                        ? 'text-[#0088E8] font-semibold hover:underline cursor-pointer'
                        : 'text-slate-700'
                    }
                  >
                    {item.code ? `${item.code} - ${item.name}` : item.name}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatRupiah(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* SUBTOTAL PENDAPATAN */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-3">
              <span>SubTotal Pendapatan</span>
              <span>{formatRupiah(subTotalPendapatan)}</span>
            </div>

            {/* GROUP: BIAYA POKOK PENJUALAN */}
            <div className="pt-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Biaya pokok penjualan
              </div>

              <div className="space-y-1.5 pl-6">
                {listHpp.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                    <span
                      className={
                        item.isLink
                          ? 'text-[#0088E8] font-semibold hover:underline cursor-pointer'
                          : 'text-slate-700'
                      }
                    >
                      {item.code ? `${item.code} - ${item.name}` : item.name}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(item.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* SUBTOTAL BIAYA POKOK PENJUALAN */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-3">
                <span>SubTotal Biaya pokok penjualan</span>
                <span>{formatRupiah(subTotalHpp)}</span>
              </div>
            </div>

            {/* TOTAL LABA KOTOR (GARIS HITAM DASHED MENEMPEL DI ATAS BARIS TOTAL) */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-3 mt-4 border-t border-dashed border-black">
              <span>Total Laba kotor</span>
              <span>{formatRupiah(totalLabaKotor)}</span>
            </div>

            {/* SUB-HEADER: BIAYA OPERASIONAL */}
            <div className="pt-4">
              <div className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs rounded-lg mb-3">
                Biaya Operasional
              </div>

              <div className="space-y-1.5 pl-6">
                {listBiayaOp.map((item) => (
                  <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-700">
                      {item.code} - {item.name}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(item.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* TOTAL BIAYA OPERASIONAL (GARIS HITAM DASHED MENEMPEL DI ATAS BARIS TOTAL) */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-3 mt-4 border-t border-dashed border-black">
                <span>Total Biaya Operasional</span>
                <span>{formatRupiah(totalBiayaOp)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: TOTAL PENDAPATAN NON OPERASIONAL */}
        <div className="mb-6 border border-slate-200 rounded-lg overflow-hidden">
          {/* HEADER BAR SECTION 2 */}
          <div className="bg-[#0099E6] text-white px-4 py-2.5 font-bold text-xs tracking-wide">
            Total pendapatan non operasional
          </div>

          <div className="p-4 space-y-3">
            <div className="text-xs font-semibold text-slate-600 mb-2">
              Pendapatan non operasional
            </div>

            <div className="space-y-1.5 pl-6">
              {listPendapatanNonOp.map((item) => (
                <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-slate-700">
                    {item.code} - {item.name}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatRupiah(item.amount)}
                  </span>
                </div>
              ))}
            </div>

            {/* SUBTOTAL PENDAPATAN NON OPERASIONAL */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-2">
              <span>SubTotal Pendapatan non operasional</span>
              <span>{formatRupiah(subTotalPendapatanNonOp)}</span>
            </div>

            <div className="pt-3">
              <div className="text-xs font-semibold text-slate-600 mb-2">
                Biaya non operasional
              </div>

              <div className="space-y-1.5 pl-6">
                {listBiayaNonOp.map((item) => (
                  <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-slate-700">
                      {item.code} - {item.name}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(item.amount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* SUBTOTAL BIAYA NON OPERASIONAL */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2.5 border-t border-slate-800 mt-2">
                <span>SubTotal Biaya non operasional</span>
                <span>{formatRupiah(subTotalBiayaNonOp)}</span>
              </div>
            </div>

            {/* TOTAL PENDAPATAN NON OPERASIONAL (GARIS HITAM DASHED MENEMPEL DI ATAS BARIS TOTAL) */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-3 mt-4 border-t border-dashed border-black">
              <span>Total pendapatan non operasional</span>
              <span>{formatRupiah(totalPendapatanNonOp)}</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: LABA BERSIH */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* HEADER BAR SECTION 3 */}
          <div className="bg-[#0099E6] text-white px-4 py-2.5 font-bold text-xs tracking-wide">
            Laba bersih
          </div>

          <div className="p-4">
            {/* LABA BERSIH (GARIS HITAM DASHED MENEMPEL DI ATAS BARIS TOTAL) */}
            <div className="flex items-center justify-between text-xs font-black text-slate-900 bg-slate-200/90 p-3 border-t border-dashed border-black">
              <span>Laba bersih</span>
              <span>{formatRupiah(labaBersih)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL POPUP FILTER TANGGAL (PERSIS SANGAT DETAIL SESUAI SS NO 2) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[440px] w-full p-6 flex flex-col gap-5 relative">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Filter</h3>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* PRESET OPTIONS LIST (VERTIKAL & TERPUSAT) */}
            <div className="flex flex-col items-center gap-3 py-1 border-y border-slate-100">
              {PRESET_OPTIONS.map((option) => {
                const isActive = tempPreset === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleSelectPreset(option)}
                    className={`text-xs transition-colors cursor-pointer font-bold ${
                      isActive ? 'text-[#0088E8]' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {/* INPUT TANGGAL DARI & SAMPAI */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-500">Dari</label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => {
                    setTempStartDate(e.target.value);
                    setTempPreset('Sesuaikan');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#0088E8] transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-500">Sampai</label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => {
                    setTempEndDate(e.target.value);
                    setTempPreset('Sesuaikan');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#0088E8] transition-all"
                />
              </div>
            </div>

            {/* TOMBOL ACTION: RESET & TERAPKAN */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetFilterModal}
                className="w-full py-2.5 rounded-lg bg-[#FF6B6B] hover:bg-rose-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilterModal}
                className="w-full py-2.5 rounded-lg bg-[#0088E8] hover:bg-sky-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
