import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

export default function LabaRugiMultiPeriode() {
  // --- STATE TANGGAL & QUARTER ---
  const [startYear, setStartYear] = useState('2026');
  const [endYear, setEndYear] = useState('2026');
  const [selectedQuarter, setSelectedQuarter] = useState('Q3'); // 'Q1' | 'Q2' | 'Q3' | 'Q4'

  // --- STATE YEAR PICKER POPUP ---
  const [activeYearPicker, setActiveYearPicker] = useState(null); // 'start' | 'end' | null
  const [pickerDecade, setPickerDecade] = useState(2020); // base decade start year
  const pickerRef = useRef(null);

  // --- STATE DATA & LOADING ---
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null); // [dataBulan1, dataBulan2, dataBulan3]

  // Format rupiah desimal ,00
  const formatRupiah = (val) => {
    const num = Number(val || 0);
    const parts = num.toFixed(2).split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${integerPart},${parts[1]}`;
  };

  // Close year picker on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setActiveYearPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper 3 nama bulan berdasarkan Quarter
  const getQuarterMonths = () => {
    const yr = startYear || dayjs().format('YYYY');
    if (selectedQuarter === 'Q1') {
      return [`Jan ${yr}`, `Feb ${yr}`, `Mar ${yr}`];
    } else if (selectedQuarter === 'Q2') {
      return [`Apr ${yr}`, `May ${yr}`, `Jun ${yr}`];
    } else if (selectedQuarter === 'Q3') {
      return [`Jul ${yr}`, `Aug ${yr}`, `Sep ${yr}`];
    } else {
      return [`Oct ${yr}`, `Nov ${yr}`, `Dec ${yr}`];
    }
  };

  const quarterMonths = getQuarterMonths();

  // Rentang tanggal 3 bulan pada quarter terpilih (tahun `startYear` — sama
  // dengan yang dipakai label kolom `quarterMonths` di atas).
  const getQuarterMonthRanges = () => {
    const yr = parseInt(startYear, 10) || dayjs().year();
    const quarterStartMonth = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 }[selectedQuarter];
    return [0, 1, 2].map((offset) => {
      const d = dayjs(new Date(yr, quarterStartMonth + offset, 1));
      return { from: d.startOf('month').format('YYYY-MM-DD'), to: d.endOf('month').format('YYYY-MM-DD') };
    });
  };

  // Fetch Report Data dari API — Laba Rugi per bulan, sama seperti Satu
  // Periode, dipanggil 3x (1x per kolom bulan quarter).
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const ranges = getQuarterMonthRanges();
      const results = await Promise.all(
        ranges.map((r) => apiClient.get('/accounting/reports/income-statement/', {
          params: { date_from: r.from, date_to: r.to },
        })),
      );
      setReportData(results.map((res) => res.data));
    } catch (err) {
      setReportData(null);
      notifyApiError(err, 'Gagal memuat data Laba Rugi Multi Periode');
    } finally {
      setLoading(false);
    }
  }, [startYear, selectedQuarter]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Gabungkan baris akun dari 3 bulan (union kode akun, default 0 kalau akun
  // itu tidak muncul di bulan tertentu).
  const mergeSection = (key) => {
    const map = new Map();
    (reportData || []).forEach((monthData, idx) => {
      (monthData?.[key] || []).forEach((row) => {
        if (!map.has(row.code)) map.set(row.code, { code: row.code, name: row.name, m1: 0, m2: 0, m3: 0 });
        map.get(row.code)[`m${idx + 1}`] = Number(row.amount);
      });
    });
    return Array.from(map.values());
  };

  // Total per bulan — dari perhitungan server (M6), bukan dijumlah ulang di sini.
  const getTotal = (key) => ({
    m1: Number(reportData?.[0]?.[key] || 0),
    m2: Number(reportData?.[1]?.[key] || 0),
    m3: Number(reportData?.[2]?.[key] || 0),
  });

  // Handler Pilih Tahun dari Popover Kalender
  const handleSelectYear = (yr) => {
    if (activeYearPicker === 'start') {
      setStartYear(String(yr));
    } else if (activeYearPicker === 'end') {
      setEndYear(String(yr));
    }
    setActiveYearPicker(null);
  };

  // Generate Array 12 Tahun untuk Grid Picker
  const yearGrid = Array.from({ length: 12 }, (_, i) => pickerDecade + i);

  // Baris akun per section, digabung dari 3 bulan (data asli, bukan mock).
  const rawPendapatan = mergeSection('pendapatan');
  const rawHpp = mergeSection('hpp');
  const rawOverhead = mergeSection('biaya_operasional');
  const rawBiayaLainnya = mergeSection('biaya_non_operasional');
  const rawPendapatanLain = mergeSection('pendapatan_non_operasional');

  // Total per bulan — dari perhitungan server (M6), bukan dijumlah ulang di sini.
  const subTotalPendapatan = getTotal('subtotal_pendapatan');
  const subTotalHpp = getTotal('subtotal_hpp');
  const subTotalLabaKotor = getTotal('total_laba_kotor');
  const subTotalOverhead = getTotal('total_biaya_operasional');
  const subTotalBiayaOp = subTotalOverhead;

  const totalPendapatanOp = {
    m1: subTotalLabaKotor.m1 - subTotalBiayaOp.m1,
    m2: subTotalLabaKotor.m2 - subTotalBiayaOp.m2,
    m3: subTotalLabaKotor.m3 - subTotalBiayaOp.m3,
  };

  const subTotalBiayaLainnya = getTotal('subtotal_biaya_non_operasional');
  const subTotalBiayaNonOp = subTotalBiayaLainnya;

  const subTotalPendapatanLain = getTotal('subtotal_pendapatan_non_operasional');
  const subTotalPendapatanNonOp = subTotalPendapatanLain;

  const totalPendapatanNonOp = getTotal('total_pendapatan_non_operasional');
  const totalLabaBersih = getTotal('laba_bersih');

  return (
    <div className="space-y-4 font-sans text-slate-800">
      {/* HEADER CONTROL TOOLBAR: FITUR KALENDER TAHUN & QUARTER TABS Q1 - Q4 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-20">
        <div className="flex flex-wrap items-center gap-3">
          {/* TWO DYNAMIC CALENDAR YEAR PICKERS: [ 📅 2026 ] - [ 📅 2026 ] */}
          <div className="flex items-center gap-2 relative" ref={pickerRef}>
            {/* TAHUN AWAL */}
            <button
              type="button"
              onClick={() => setActiveYearPicker(activeYearPicker === 'start' ? null : 'start')}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 hover:bg-white hover:border-[#0088E8] transition-all cursor-pointer shadow-2xs"
            >
              <Calendar size={14} className="text-slate-400" />
              <span>{startYear}</span>
            </button>

            <span className="text-slate-400 font-semibold">-</span>

            {/* TAHUN AKHIR */}
            <button
              type="button"
              onClick={() => setActiveYearPicker(activeYearPicker === 'end' ? null : 'end')}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 hover:bg-white hover:border-[#0088E8] transition-all cursor-pointer shadow-2xs"
            >
              <Calendar size={14} className="text-slate-400" />
              <span>{endYear}</span>
            </button>

            {/* POPOVER KALENDER TAHUN (YEAR PICKER POPUP) */}
            {activeYearPicker && (
              <div className="absolute top-full left-0 mt-2 z-[9999] w-64 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 animate-fade-in">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
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
                  {yearGrid.map((yr) => {
                    const isSelected =
                      (activeYearPicker === 'start' && String(yr) === startYear) ||
                      (activeYearPicker === 'end' && String(yr) === endYear);
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => handleSelectYear(yr)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#0088E8] text-white shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* QUARTER TABS Q1 - Q4 */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white text-xs font-bold shadow-2xs">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
              const isActive = selectedQuarter === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setSelectedQuarter(q)}
                  className={`px-4 py-1.5 transition-all cursor-pointer border-r border-slate-200 last:border-r-0 ${
                    isActive
                      ? 'bg-[#3B82F6] text-white font-bold'
                      : 'bg-white text-slate-700 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  {q}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 italic px-1">
        Dihitung dari jurnal terposting (Akuntansi) — bisa berbeda dari Laba Rugi di Laporan Penjualan yang
        dihitung dari transaksi penjualan. Keduanya sengaja terpisah untuk tujuan berbeda.
      </p>

      {/* CARD TABEL LAPORAN LABA RUGI MULTI PERIODE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative min-h-[500px]">
        {loading && (
          <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#0088E8] font-bold text-xs">
              <Loader2 size={20} className="animate-spin" />
              <span>Memuat data Multi Periode...</span>
            </div>
          </div>
        )}

        {/* CONTAINER TABEL DENGAN STICKY HEADER FIXED UNTUK DESKRIPSI & 3 BULAN QUARTER */}
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left border-collapse">
            {/* STICKY HEADER (TIDAK IKUT BERGESER SAAT SCROLL KE ATAS) */}
            <thead className="sticky top-0 z-10 bg-[#0099E6] text-white font-bold text-xs shadow-xs">
              <tr>
                <th className="py-3 px-6 w-1/2 min-w-[280px]">Deskripsi</th>
                <th className="py-3 px-6 text-right w-1/6">{quarterMonths[0]}</th>
                <th className="py-3 px-6 text-right w-1/6">{quarterMonths[1]}</th>
                <th className="py-3 px-6 text-right w-1/6">{quarterMonths[2]}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {/* SECTION 1: Pendapatan bersih operasional - Laba kotor */}
              <tr>
                <td colSpan={4} className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs">
                  Pendapatan bersih operasional - Laba kotor
                </td>
              </tr>

              {/* PENDAPATAN */}
              <tr>
                <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Pendapatan
                </td>
              </tr>
              {rawPendapatan.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8">
                    <span className="text-slate-700">
                      {item.code ? `${item.code} ${item.name}` : item.name}
                    </span>
                  </td>
                  <td className={`py-2 px-6 text-right ${item.m1 > 0 ? 'text-[#0088E8] font-bold' : 'text-slate-600'}`}>{formatRupiah(item.m1)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m2)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m3)}</td>
                </tr>
              ))}

              {/* SUBTOTAL PENDAPATAN */}
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Pendapatan</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatan.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatan.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatan.m3)}</td>
              </tr>

              {/* BIAYA POKOK PENJUALAN */}
              <tr>
                <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50 pt-4">
                  Biaya pokok penjualan
                </td>
              </tr>
              {rawHpp.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code ? `${item.code} ${item.name}` : item.name}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m1)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m2)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m3)}</td>
                </tr>
              ))}

              {/* SUBTOTAL BIAYA POKOK PENJUALAN */}
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya pokok penjualan</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalHpp.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalHpp.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalHpp.m3)}</td>
              </tr>

              {/* SUBTOTAL LABA KOTOR */}
              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Laba kotor</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalLabaKotor.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalLabaKotor.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalLabaKotor.m3)}</td>
              </tr>

              {/* SECTION 2: Pendapatan bersih operasional - Biaya Operasional */}
              <tr>
                <td colSpan={4} className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-t border-slate-200">
                  Pendapatan bersih operasional - Biaya Operasional
                </td>
              </tr>

              {/* OVERHEAD */}
              <tr>
                <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Overhead
                </td>
              </tr>
              {rawOverhead.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code} {item.name}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m1)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m2)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m3)}</td>
                </tr>
              ))}

              {/* SUBTOTAL OVERHEAD */}
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Overhead</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalOverhead.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalOverhead.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalOverhead.m3)}</td>
              </tr>

              {/* SUBTOTAL BIAYA OPERASIONAL */}
              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya Operasional</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaOp.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaOp.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaOp.m3)}</td>
              </tr>

              {/* TOTAL PENDAPATAN BERSIH OPERASIONAL (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <tr className="bg-slate-200/90 font-bold border-t border-dashed border-black">
                <td className="py-3 px-6">Total Pendapatan bersih operasional</td>
                <td className="py-3 px-6 text-right">{formatRupiah(totalPendapatanOp.m1)}</td>
                <td className="py-3 px-6 text-right">{formatRupiah(totalPendapatanOp.m2)}</td>
                <td className="py-3 px-6 text-right">{formatRupiah(totalPendapatanOp.m3)}</td>
              </tr>

              {/* SECTION 3: Total pendapatan non operasional - Biaya non operasional */}
              <tr>
                <td colSpan={4} className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-t border-slate-200">
                  Total pendapatan non operasional - Biaya non operasional
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Biaya lainnya
                </td>
              </tr>
              {rawBiayaLainnya.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code} {item.name}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m1)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m2)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m3)}</td>
                </tr>
              ))}

              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya lainnya</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaLainnya.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaLainnya.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaLainnya.m3)}</td>
              </tr>

              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya non operasional</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaNonOp.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaNonOp.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalBiayaNonOp.m3)}</td>
              </tr>

              {/* SECTION 4: Total pendapatan non operasional - Pendapatan non operasional */}
              <tr>
                <td colSpan={4} className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-t border-slate-200">
                  Total pendapatan non operasional - Pendapatan non operasional
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Pendapatan lain
                </td>
              </tr>
              {rawPendapatanLain.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code} {item.name}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m1)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m2)}</td>
                  <td className="py-2 px-6 text-right text-slate-600">{formatRupiah(item.m3)}</td>
                </tr>
              ))}

              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Pendapatan lain</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatanLain.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatanLain.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatanLain.m3)}</td>
              </tr>

              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Pendapatan non operasional</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatanNonOp.m1)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatanNonOp.m2)}</td>
                <td className="py-2.5 px-6 text-right">{formatRupiah(subTotalPendapatanNonOp.m3)}</td>
              </tr>

              {/* TOTAL PENDAPATAN NON OPERASIONAL (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <tr className="bg-slate-200/90 font-bold border-t border-dashed border-black">
                <td className="py-3 px-6">Total pendapatan non operasional</td>
                <td className="py-3 px-6 text-right">{formatRupiah(totalPendapatanNonOp.m1)}</td>
                <td className="py-3 px-6 text-right">{formatRupiah(totalPendapatanNonOp.m2)}</td>
                <td className="py-3 px-6 text-right">{formatRupiah(totalPendapatanNonOp.m3)}</td>
              </tr>

              {/* TOTAL LABA BERSIH (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <tr className="bg-slate-200/90 font-black border-t border-dashed border-black">
                <td className="py-3 px-6 text-slate-900">Total Laba bersih</td>
                <td className="py-3 px-6 text-right text-slate-900">{formatRupiah(totalLabaBersih.m1)}</td>
                <td className="py-3 px-6 text-right text-slate-900">{formatRupiah(totalLabaBersih.m2)}</td>
                <td className="py-3 px-6 text-right text-slate-900">{formatRupiah(totalLabaBersih.m3)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
