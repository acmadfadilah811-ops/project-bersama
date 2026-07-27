import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter,
  FileText,
  X,
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

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function ArusKas() {
  // --- STATE KONTROL TANGGAL ---
  const [dateMode, setDateMode] = useState('Bulan'); // 'Sesuaikan' | 'Bulan' | 'Tahun'
  const [preset, setPreset] = useState('Hari ini');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [startDate, setStartDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  // --- STATE MODAL FILTER & KALENDER ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempPreset, setTempPreset] = useState('Hari ini');
  const [tempStartDate, setTempStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [tempEndDate, setTempEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerDecade, setPickerDecade] = useState(2020);
  const calendarRef = useRef(null);

  // --- STATE DATA & LOADING ---
  const [loading, setLoading] = useState(false);

  // Format Rupiah (contoh: 342.500,00)
  const formatRupiah = (val) => {
    const num = Number(val || 0);
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integerPart},${parts[1]}`;
  };

  // Outside click handler untuk calendar popover
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigasi Waktu (< / >)
  const handlePrevDate = () => {
    if (dateMode === 'Bulan') {
      setCurrentDate((prev) => prev.subtract(1, 'month'));
    } else if (dateMode === 'Tahun') {
      setCurrentDate((prev) => prev.subtract(1, 'year'));
    }
  };

  const handleNextDate = () => {
    if (dateMode === 'Bulan') {
      setCurrentDate((prev) => prev.add(1, 'month'));
    } else if (dateMode === 'Tahun') {
      setCurrentDate((prev) => prev.add(1, 'year'));
    }
  };

  // Format Teks Display Navigator
  const getDateDisplay = () => {
    if (dateMode === 'Bulan') {
      return currentDate.format('MMMM YYYY');
    } else if (dateMode === 'Tahun') {
      return currentDate.format('YYYY');
    }
    const sFormatted = dayjs(startDate).format('DD MMM YYYY');
    const eFormatted = dayjs(endDate).format('DD MMM YYYY');
    return `${preset} ${sFormatted} - ${eFormatted}`;
  };

  // Switch Mode Tanggal (Sesuaikan / Bulan / Tahun)
  const handleModeChange = (mode) => {
    setDateMode(mode);
    setIsCalendarOpen(false);
    if (mode === 'Bulan') {
      setStartDate(currentDate.startOf('month').format('YYYY-MM-DD'));
      setEndDate(currentDate.endOf('month').format('YYYY-MM-DD'));
    } else if (mode === 'Tahun') {
      setStartDate(currentDate.startOf('year').format('YYYY-MM-DD'));
      setEndDate(currentDate.endOf('year').format('YYYY-MM-DD'));
    }
  };

  // Modal Filter Preset Handlers
  const handleOpenFilterModal = () => {
    setTempPreset(preset);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsFilterModalOpen(true);
  };

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
        period: currentDate.format('YYYY-MM'),
      };
      await apiClient.get('/accounting/ledger/', { params });
    } catch (err) {
      console.error('Gagal memuat data Arus Kas:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, currentDate]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export PDF
  const handleExportPdf = () => window.print();

  // RAW DATA ARUS KAS
  const saldoKasAwal = 0;

  const rawAktivitasOperasional = [
    { name: 'Penerimaan dari pelanggan', amount: 342500, isBlue: true },
    { name: 'Penerimaan/penjualan aset lancar lainnya', amount: 0 },
    { name: 'Pembayaran ke pemasok', amount: 0 },
    { name: 'Biaya operasional', amount: 0 },
    { name: 'Pendapatan lain', amount: 0 },
    { name: 'Pengeluaran lain', amount: 0 },
  ];

  const rawAktivitasInvestasi = [
    { name: 'Pendapatan/pembelian aset tetap', amount: 0 },
    { name: 'Pendapatan/pembelian aset tidak berwujud', amount: 0 },
    { name: 'Aktivitas investasi lain', amount: 0 },
  ];

  const rawAktivitasPendanaan = [
    { name: 'Pembayaran/penerimaan pinjaman', amount: 0 },
    { name: 'Penambahan/pengambilan modal', amount: 0 },
  ];

  const subTotalOperasional = rawAktivitasOperasional.reduce((a, b) => a + b.amount, 0);
  const subTotalInvestasi = rawAktivitasInvestasi.reduce((a, b) => a + b.amount, 0);
  const subTotalPendanaan = rawAktivitasPendanaan.reduce((a, b) => a + b.amount, 0);

  const totalKenaikanKas = subTotalOperasional + subTotalInvestasi + subTotalPendanaan;
  const saldoKasAkhir = saldoKasAwal + totalKenaikanKas;

  const yearGrid = Array.from({ length: 12 }, (_, i) => pickerDecade + i);

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* TOOLBAR HEADER BARIS ATAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* TENGAH: FITUR KALENDER & PRESETS (SESUAIKAN | BULAN | TAHUN) */}
        <div className="flex items-center gap-2 relative" ref={calendarRef}>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            {dateMode !== 'Sesuaikan' && (
              <button
                type="button"
                onClick={handlePrevDate}
                className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
            )}

            {/* TOMBOL KALENDER POPUP */}
            <button
              type="button"
              onClick={() => {
                if (dateMode === 'Sesuaikan') {
                  handleOpenFilterModal();
                } else {
                  setIsCalendarOpen(!isCalendarOpen);
                }
              }}
              className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[130px] justify-center select-none cursor-pointer hover:text-[#0088E8] transition-colors"
            >
              <CalendarIcon size={13} className="text-slate-400 shrink-0" />
              <span>{getDateDisplay()}</span>
            </button>

            {dateMode !== 'Sesuaikan' && (
              <button
                type="button"
                onClick={handleNextDate}
                className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          {/* MODE SEGMENTED TABS (SESUAIKAN / BULAN / TAHUN) */}
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => handleModeChange('Sesuaikan')}
              className={`px-3.5 py-1.5 transition-all cursor-pointer border-r border-slate-300 ${
                dateMode === 'Sesuaikan'
                  ? 'bg-[#3B82F6] text-white font-bold'
                  : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              Sesuaikan
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('Bulan')}
              className={`px-3.5 py-1.5 transition-all cursor-pointer border-r border-slate-300 ${
                dateMode === 'Bulan'
                  ? 'bg-[#3B82F6] text-white font-bold'
                  : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              Bulan
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('Tahun')}
              className={`px-3.5 py-1.5 transition-all cursor-pointer ${
                dateMode === 'Tahun'
                  ? 'bg-[#3B82F6] text-white font-bold'
                  : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
              }`}
            >
              Tahun
            </button>
          </div>

          {/* POPUP MODAL KALENDER INTERAKTIF */}
          {isCalendarOpen && dateMode !== 'Sesuaikan' && (
            <div className="absolute top-full left-0 mt-2 z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-fade-in">
              {dateMode === 'Bulan' && (
                <div className="w-64 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentDate((prev) => prev.subtract(1, 'year'))}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-800">{currentDate.format('YYYY')}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentDate((prev) => prev.add(1, 'year'))}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {MONTH_NAMES.map((mName, idx) => {
                      const isCurrentMonth = currentDate.month() === idx;
                      return (
                        <button
                          key={mName}
                          type="button"
                          onClick={() => {
                            setCurrentDate((prev) => prev.month(idx));
                            setIsCalendarOpen(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                            isCurrentMonth
                              ? 'bg-[#0088E8] text-white shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {mName.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {dateMode === 'Tahun' && (
                <div className="w-64 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => setPickerDecade(pickerDecade - 10)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-800">
                      {pickerDecade} - {pickerDecade + 11}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPickerDecade(pickerDecade + 10)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {yearGrid.map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setCurrentDate(dayjs(`${yr}-01-01`));
                          setIsCalendarOpen(false);
                        }}
                        className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentDate.format('YYYY') === String(yr)
                            ? 'bg-[#0088E8] text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* KANAN: EXPORT PDF BUTTON */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileText size={13} className="text-slate-600" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* CARD BODY LAPORAN ARUS KAS (COMPACT RATAP TANPA SPASI BERLEBIHAN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative min-h-[450px]">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
              <Loader2 size={20} className="animate-spin" />
              <span>Memuat data Arus Kas...</span>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* SECTION 1: SALDO KAS AWAL */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
              Saldo kas awal
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-100 p-2.5 rounded-lg">
                <span>Total Saldo kas awal</span>
                <span>{formatRupiah(saldoKasAwal)}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: ARUS KAS */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
              Arus Kas
            </div>

            <div className="p-3 space-y-2 text-xs">
              {/* GROUP: AKTIVITAS OPERASIONAL */}
              <div>
                <div className="font-semibold text-slate-600 mb-1">Aktivitas operasional</div>
                <div className="space-y-1 pl-6">
                  {rawAktivitasOperasional.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-0.5">
                      <span className={item.isBlue ? 'text-[#0088E8] font-medium' : 'text-slate-700'}>
                        {item.name}
                      </span>
                      <span className={`font-semibold ${item.isBlue ? 'text-[#0088E8]' : 'text-slate-800'}`}>
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* SUBTOTAL AKTIVITAS OPERASIONAL */}
                <div className="flex items-center justify-between font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-2">
                  <span>SubTotal Aktivitas operasional</span>
                  <span>{formatRupiah(subTotalOperasional)}</span>
                </div>
              </div>

              {/* GROUP: AKTIVITAS INVESTASI */}
              <div className="pt-2">
                <div className="font-semibold text-slate-600 mb-1">Aktivitas Investasi</div>
                <div className="space-y-1 pl-6">
                  {rawAktivitasInvestasi.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-0.5">
                      <span className="text-slate-700">{item.name}</span>
                      <span className="font-semibold text-slate-800">{formatRupiah(item.amount)}</span>
                    </div>
                  ))}
                </div>

                {/* SUBTOTAL AKTIVITAS INVESTASI */}
                <div className="flex items-center justify-between font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-2">
                  <span>SubTotal Aktivitas Investasi</span>
                  <span>{formatRupiah(subTotalInvestasi)}</span>
                </div>
              </div>

              {/* GROUP: AKTIVITAS PENDANAAN */}
              <div className="pt-2">
                <div className="font-semibold text-slate-600 mb-1">Aktivitas Pendanaan</div>
                <div className="space-y-1 pl-6">
                  {rawAktivitasPendanaan.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-0.5">
                      <span className="text-slate-700">{item.name}</span>
                      <span className="font-semibold text-slate-800">{formatRupiah(item.amount)}</span>
                    </div>
                  ))}
                </div>

                {/* SUBTOTAL AKTIVITAS PENDANAAN */}
                <div className="flex items-center justify-between font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-2">
                  <span>SubTotal Aktivitas Pendanaan</span>
                  <span>{formatRupiah(subTotalPendanaan)}</span>
                </div>
              </div>

              {/* TOTAL KENAIKAN/PENURUNAN KAS (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <div className="flex items-center justify-between font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-3 border-t border-dashed border-black">
                <span>Total Kenaikan/penurunan kas</span>
                <span>{formatRupiah(totalKenaikanKas)}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: SALDO KAS AKHIR */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
              Saldo kas akhir
            </div>
            <div className="p-3">
              {/* TOTAL SALDO KAS AKHIR (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <div className="flex items-center justify-between font-black text-slate-900 bg-slate-200/90 p-2.5 border-t border-dashed border-black">
                <span>Total Saldo kas akhir</span>
                <span>{formatRupiah(saldoKasAkhir)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL FILTER TANGGAL PRESET (JIKA SESUAIKAN DITEKAN) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[440px] w-full p-6 flex flex-col gap-5 relative">
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
