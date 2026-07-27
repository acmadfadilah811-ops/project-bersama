import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  FileText,
  X,
  Loader2,
} from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function PerubahanModal() {
  // --- STATE KONTROL TANGGAL ---
  const [dateMode, setDateMode] = useState('Bulan'); // 'Bulan' | 'Tahun'
  const [currentDate, setCurrentDate] = useState(dayjs());

  // --- STATE POPUP KALENDER INTERAKTIF ---
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [pickerDecade, setPickerDecade] = useState(2020);
  const calendarRef = useRef(null);

  // --- STATE DATA & LOADING ---
  const [loading, setLoading] = useState(false);

  // Format Rupiah (contoh: 367.500,00)
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

  // Navigasi Tanggal (< / >)
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

  const getDateDisplay = () => {
    if (dateMode === 'Bulan') {
      return currentDate.format('MMMM YYYY');
    }
    return currentDate.format('YYYY');
  };

  // Fetch Data dari API
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        period: currentDate.format('YYYY-MM'),
        year: currentDate.format('YYYY'),
        mode: dateMode,
      };
      await apiClient.get('/accounting/ledger/', { params });
    } catch (err) {
      console.error('Gagal memuat data Perubahan Modal:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, dateMode]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export PDF
  const handleExportPdf = () => window.print();

  // RAW DATA PERUBAHAN MODAL
  const modalAwal = 0;
  const totalLaba = 367500;
  const investasiKurunWaktu = 0;
  const penarikan = 0;

  const totalPenambahanModal = totalLaba + investasiKurunWaktu - penarikan;
  const modalAkhirPeriode = modalAwal + totalPenambahanModal;

  const yearGrid = Array.from({ length: 12 }, (_, i) => pickerDecade + i);

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* TOOLBAR HEADER BARIS ATAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* KIRI / TENGAH: CONTROL KALENDER (BULAN | TAHUN) DENGAN POPUP KALENDER INTERAKTIF */}
        <div className="flex items-center gap-2 relative" ref={calendarRef}>
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevDate}
              className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            {/* TOMBOL POPUP KALENDER INTERAKTIF */}
            <button
              type="button"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[130px] justify-center select-none cursor-pointer hover:text-[#0088E8] transition-colors"
              title="Buka Kalender"
            >
              <CalendarIcon size={13} className="text-slate-400 shrink-0" />
              <span>{getDateDisplay()}</span>
            </button>

            <button
              type="button"
              onClick={handleNextDate}
              className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* MODE SEGMENTED TABS (BULAN / TAHUN) */}
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
            {['Bulan', 'Tahun'].map((m) => {
              const isActive = dateMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setDateMode(m);
                    setIsCalendarOpen(false);
                  }}
                  className={`px-5 py-1.5 transition-all cursor-pointer border-r border-slate-300 last:border-r-0 ${
                    isActive
                      ? 'bg-[#3B82F6] text-white font-bold'
                      : 'bg-white text-slate-800 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>

          {/* POPUP MODAL KALENDER INTERAKTIF */}
          {isCalendarOpen && (
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

      {/* CARD BODY LAPORAN PERUBAHAN MODAL (PERSIS TANGKAPAN LAYAR) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative min-h-[400px]">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
              <Loader2 size={20} className="animate-spin" />
              <span>Memuat data Perubahan Modal...</span>
            </div>
          </div>
        )}

        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* HEADER BAR (GRUP & JUMLAH) */}
          <div className="bg-[#E0F2FE] text-slate-900 px-4 py-2.5 font-bold text-xs flex justify-between items-center border-b border-slate-200">
            <span>Grup</span>
            <span>Jumlah</span>
          </div>

          <div className="p-4 space-y-3 text-xs">
            {/* BARIS MODAL AWAL */}
            <div className="flex items-center justify-between py-1">
              <span className="font-semibold text-slate-700">Modal awal</span>
              <span className="font-semibold text-slate-800">{modalAwal}</span>
            </div>

            {/* GROUP: PENAMBAHAN MODAL */}
            <div className="pt-2">
              <div className="font-semibold text-slate-600 mb-2">Penambahan Modal</div>
              <div className="space-y-2 pl-6">
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-700">Total Laba</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(totalLaba)}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-700">Investasi kurun waktu</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(investasiKurunWaktu)}</span>
                </div>
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-slate-700">Penarikan</span>
                  <span className="font-semibold text-slate-800">{formatRupiah(penarikan)}</span>
                </div>
              </div>
            </div>

            {/* BARIS TOTAL PENAMBAHAN MODAL */}
            <div className="flex items-center justify-between font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border-t border-slate-200 mt-3">
              <span>Total penambahan Modal</span>
              <span>{formatRupiah(totalPenambahanModal)}</span>
            </div>

            {/* BARIS MODAL AKHIR PERIODE */}
            <div className="flex items-center justify-between font-extrabold text-slate-900 bg-slate-100 p-3 rounded-lg border-t border-slate-300 mt-2">
              <span>Modal akhir periode</span>
              <span>{formatRupiah(modalAkhirPeriode)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
