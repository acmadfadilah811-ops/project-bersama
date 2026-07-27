import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Settings,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  FileText,
  FileSpreadsheet,
  X,
  Loader2,
  Columns,
  Rows,
} from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export default function Neraca() {
  // --- STATE LAYOUT (VERSI DISAMPING [||] VS VERSI KEBAWAH [=]) ---
  const [layoutMode, setLayoutMode] = useState('side'); // 'side' (||) | 'stacked' (=)

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
    if (dateMode === 'Harian') {
      setCurrentDate((prev) => prev.subtract(1, 'day'));
    } else if (dateMode === 'Bulan') {
      setCurrentDate((prev) => prev.subtract(1, 'month'));
    } else if (dateMode === 'Tahun') {
      setCurrentDate((prev) => prev.subtract(1, 'year'));
    }
  };

  const handleNextDate = () => {
    if (dateMode === 'Harian') {
      setCurrentDate((prev) => prev.add(1, 'day'));
    } else if (dateMode === 'Bulan') {
      setCurrentDate((prev) => prev.add(1, 'month'));
    } else if (dateMode === 'Tahun') {
      setCurrentDate((prev) => prev.add(1, 'year'));
    }
  };

  const getDateDisplay = () => {
    if (dateMode === 'Harian') {
      return currentDate.format('DD-MM-YYYY');
    } else if (dateMode === 'Bulan') {
      return currentDate.format('MMMM YYYY');
    }
    return currentDate.format('YYYY');
  };

  // Fetch Data dari API
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        date: currentDate.format('YYYY-MM-DD'),
        period: currentDate.format('YYYY-MM'),
        year: currentDate.format('YYYY'),
        mode: dateMode,
      };
      await apiClient.get('/accounting/ledger/', { params });
    } catch (err) {
      console.error('Gagal memuat data Neraca:', err);
    } finally {
      setLoading(false);
    }
  }, [currentDate, dateMode]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Export handlers
  const handleExportPdf = () => window.print();
  const handleExportExcel = () => alert('Mengunduh Laporan Neraca (.xlsx)...');

  // RAW AKUN ASET (ASSETS)
  const rawAsetLancar = [
    { code: '11101', name: 'Kas', amount: 342500 },
    { code: '11102', name: 'Bank', amount: 0 },
    { code: '11103', name: 'Kas in register', amount: 0 },
    { code: '11104', name: 'Giro', amount: 0 },
    { code: '11200', name: 'Investasi jangka pendek dan surat berharga', amount: 0 },
    { code: '11300', name: 'Piutang dagang', amount: 25000 },
    { code: '11400', name: 'Persediaan barang dagang', amount: 0 },
    { code: '11500', name: 'Peralatan', amount: 0 },
    { code: '11600', name: 'Akumulasi penyusutan peralatan', amount: 0 },
    { code: '11700', name: 'Beban dibayar dimuka', amount: 0 },
    { code: '11750', name: 'PPN Masukan', amount: 0 },
  ];

  const rawAsetTidakLancar = [
    { code: '12000', name: 'Aset Tetap', amount: 0 },
    { code: '13000', name: 'Aset tak berwujud', amount: 0 },
    { code: '14000', name: 'Akumulasi penyusutan aset tetap', amount: 0 },
    { code: '15000', name: 'Akumulasi penyusutan aset tak berwujud', amount: 0 },
  ];

  // RAW AKUN KEWAJIBAN & MODAL (LIABILITIES & EQUITY)
  const rawKewajiban = [
    { code: '21000', name: 'Hutang dagang', amount: 0 },
    { code: '21002', name: 'Cash Example', amount: 0 },
    { code: '22000', name: 'Hutang bank', amount: 0 },
    { code: '23000', name: 'Pendapatan di terima dimuka', amount: 0 },
    { code: '23500', name: 'PPN Keluaran', amount: 0 },
  ];

  const rawModal = [
    { code: '31000', name: 'Modal', amount: 0 },
    { code: '32000', name: 'Prive', amount: 0 },
    { code: '33000', name: 'Laba rugi ditahan', amount: 0 },
    { code: '', name: 'Pendapatan periode ini', amount: 367500 },
  ];

  // Filter 0 jika disetting
  const filterAccounts = (list) => {
    if (!hideZeroAccounts) return list;
    return list.filter((item) => Number(item.amount) !== 0);
  };

  const listAsetLancar = filterAccounts(rawAsetLancar);
  const listAsetTidakLancar = filterAccounts(rawAsetTidakLancar);
  const listKewajiban = filterAccounts(rawKewajiban);
  const listModal = filterAccounts(rawModal);

  // Subtotal & Totals
  const subTotalAsetLancar = listAsetLancar.reduce((a, b) => a + b.amount, 0);
  const subTotalAsetTidakLancar = listAsetTidakLancar.reduce((a, b) => a + b.amount, 0);
  const totalAset = subTotalAsetLancar + subTotalAsetTidakLancar;

  const subTotalKewajiban = listKewajiban.reduce((a, b) => a + b.amount, 0);
  const subTotalModal = listModal.reduce((a, b) => a + b.amount, 0);
  const totalKewajibanModal = subTotalKewajiban + subTotalModal;

  const yearGrid = Array.from({ length: 12 }, (_, i) => pickerDecade + i);

  return (
    <div className="space-y-3 font-sans text-slate-800">
      {/* TOOLBAR HEADER BARIS ATAS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* KIRI: GEAR SETTINGS & LAYOUT TOGGLE BUTTONS [||] VS [=] */}
        <div className="flex items-center gap-2">
          {/* GEAR BUTTON */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-2xs"
              title="Pengaturan Laporan"
            >
              <Settings size={17} />
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

          {/* TWO LAYOUT TOGGLE BUTTONS: [ || ] (DISAMPING) VS [ = ] (KEBAWAH) */}
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
            {/* TOMBOL DISAMPING [||] */}
            <button
              type="button"
              onClick={() => setLayoutMode('side')}
              className={`px-3 py-1.5 transition-all cursor-pointer border-r border-slate-300 flex items-center gap-1 text-xs font-bold ${
                layoutMode === 'side'
                  ? 'bg-[#0088E8] text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="Versi di samping"
            >
              <Columns size={14} />
              <span>||</span>
            </button>

            {/* TOMBOL KEBAWAH [=] */}
            <button
              type="button"
              onClick={() => setLayoutMode('stacked')}
              className={`px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                layoutMode === 'stacked'
                  ? 'bg-[#0088E8] text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
              title="Versi ke bawah"
            >
              <Rows size={14} />
              <span>=</span>
            </button>
          </div>
        </div>

        {/* TENGAH: FITUR KALENDER (HARIAN | BULAN | TAHUN) DENGAN POPUP KALENDER INTERAKTIF */}
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
              className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[120px] justify-center select-none cursor-pointer hover:text-[#0088E8] transition-colors"
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

          {/* MODE SEGMENTED TABS (HARIAN / BULAN / TAHUN) */}
          <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
            {['Harian', 'Bulan', 'Tahun'].map((m) => {
              const isActive = dateMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setDateMode(m);
                    setIsCalendarOpen(false);
                  }}
                  className={`px-3.5 py-1.5 transition-all cursor-pointer border-r border-slate-300 last:border-r-0 ${
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

          {/* POPUP MODAL KALENDER INTERAKTIF SESUAI MODE */}
          {isCalendarOpen && (
            <div className="absolute top-full left-0 mt-2 z-[9999] bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-fade-in">
              {dateMode === 'Harian' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">Pilih Tanggal Harian</span>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(false)}
                      className="text-slate-400 hover:text-slate-600 rounded-full p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <input
                    type="date"
                    value={currentDate.format('YYYY-MM-DD')}
                    onChange={(e) => {
                      if (e.target.value) {
                        setCurrentDate(dayjs(e.target.value));
                        setIsCalendarOpen(false);
                      }
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#0088E8]"
                  />
                </div>
              )}

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

        {/* KANAN: EXPORT BUTTONS */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileText size={13} className="text-slate-600" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet size={13} className="text-slate-600" />
            <span>EXCEL</span>
          </button>
        </div>
      </div>

      {/* CARD BODY LAPORAN NERACA (COMPACT TANPA SPACE BOLEH SPACING BERLEBIHAN) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-4 relative min-h-[450px]">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
              <Loader2 size={20} className="animate-spin" />
              <span>Memuat data Neraca...</span>
            </div>
          </div>
        )}

        {/* RENDERING DUA VERSI TAMPILAN: VERSI DISAMPING [||] VS VERSI KEBAWAH [=] */}
        {layoutMode === 'side' ? (
          /* ================= VERSI DI SAMPING [||] (2 KOLOM HORIZONTAL COMPACT) ================= */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* KOLOM KIRI: ASET */}
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
                Aset
              </div>

              <div className="p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-600 mb-1">Aset Lancar</div>
                <div className="space-y-1 pl-4">
                  {listAsetLancar.map((item) => (
                    <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-700">
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* SUBTOTAL ASET LANCAR */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                  <span>SubTotal Aset Lancar</span>
                  <span>{formatRupiah(subTotalAsetLancar)}</span>
                </div>

                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Aset Tidak Lancar</div>
                  <div className="space-y-1 pl-4">
                    {listAsetTidakLancar.map((item) => (
                      <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-slate-700">
                          {item.code ? `${item.code} - ${item.name}` : item.name}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* SUBTOTAL ASET TIDAK LANCAR */}
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                    <span>SubTotal Aset Tidak Lancar</span>
                    <span>{formatRupiah(subTotalAsetTidakLancar)}</span>
                  </div>
                </div>

                {/* TOTAL ASET */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-2 border-t border-dashed border-black">
                  <span>Total Aset</span>
                  <span>{formatRupiah(totalAset)}</span>
                </div>
              </div>
            </div>

            {/* KOLOM KANAN: KEWAJIBAN DAN MODAL */}
            <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
              <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
                Kewajiban dan Modal
              </div>

              <div className="p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-600 mb-1">Kewajiban</div>
                <div className="space-y-1 pl-4">
                  {listKewajiban.map((item) => (
                    <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-700">
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* SUBTOTAL KEWAJIBAN */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                  <span>SubTotal Kewajiban</span>
                  <span>{formatRupiah(subTotalKewajiban)}</span>
                </div>

                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Modal</div>
                  <div className="space-y-1 pl-4">
                    {listModal.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-slate-700">
                          {item.code ? `${item.code} - ${item.name}` : item.name}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* SUBTOTAL MODAL */}
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                    <span>SubTotal Modal</span>
                    <span>{formatRupiah(subTotalModal)}</span>
                  </div>
                </div>

                {/* TOTAL KEWAJIBAN DAN MODAL */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-2 border-t border-dashed border-black">
                  <span>Total Kewajiban dan Modal</span>
                  <span>{formatRupiah(totalKewajibanModal)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= VERSI KE BAWAH [=] (1 KOLOM STACKED COMPACT RATAP TANPA SPASI BERLEBIHAN) ================= */
          <div className="space-y-0">
            {/* BOX 1: ASET */}
            <div className="border border-slate-200 rounded-t-lg overflow-hidden border-b-0">
              <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
                Aset
              </div>

              <div className="p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-600 mb-1">Aset Lancar</div>
                <div className="space-y-1 pl-6">
                  {listAsetLancar.map((item) => (
                    <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-700">
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                  <span>SubTotal Aset Lancar</span>
                  <span>{formatRupiah(subTotalAsetLancar)}</span>
                </div>

                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Aset Tidak Lancar</div>
                  <div className="space-y-1 pl-6">
                    {listAsetTidakLancar.map((item) => (
                      <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-slate-700">
                          {item.code ? `${item.code} - ${item.name}` : item.name}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                    <span>SubTotal Aset Tidak Lancar</span>
                    <span>{formatRupiah(subTotalAsetTidakLancar)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-2 border-t border-dashed border-black">
                  <span>Total Aset</span>
                  <span>{formatRupiah(totalAset)}</span>
                </div>
              </div>
            </div>

            {/* BOX 2: KEWAJIBAN DAN MODAL (MENEMPEL LANGSUNG DENGAN BOX ASET) */}
            <div className="border border-slate-200 rounded-b-lg overflow-hidden">
              <div className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs tracking-wide">
                Kewajiban dan Modal
              </div>

              <div className="p-3 space-y-1">
                <div className="text-xs font-semibold text-slate-600 mb-1">Kewajiban</div>
                <div className="space-y-1 pl-6">
                  {listKewajiban.map((item) => (
                    <div key={item.code} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-slate-700">
                        {item.code ? `${item.code} - ${item.name}` : item.name}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                  <span>SubTotal Kewajiban</span>
                  <span>{formatRupiah(subTotalKewajiban)}</span>
                </div>

                <div className="pt-2">
                  <div className="text-xs font-semibold text-slate-600 mb-1">Modal</div>
                  <div className="space-y-1 pl-6">
                    {listModal.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-slate-700">
                          {item.code ? `${item.code} - ${item.name}` : item.name}
                        </span>
                        <span className="font-semibold text-slate-800">
                          {formatRupiah(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 bg-slate-50 p-2 border-t border-slate-800 mt-1">
                    <span>SubTotal Modal</span>
                    <span>{formatRupiah(subTotalModal)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-900 bg-slate-200/90 p-2.5 mt-2 border-t border-dashed border-black">
                  <span>Total Kewajiban dan Modal</span>
                  <span>{formatRupiah(totalKewajibanModal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
