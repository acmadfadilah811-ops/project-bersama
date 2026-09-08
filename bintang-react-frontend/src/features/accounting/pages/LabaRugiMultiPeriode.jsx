import { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';

// Batasi rentang tahun -- Tahun Awal/Tahun Akhir jauh (mis. 2020-2029) berarti
// 10 request paralel ke /accounting/reports/income-statement/ sekaligus.
// 8 kolom (8 tahun quarter yang sama) sudah cukup lebar untuk dibaca di tabel.
const MAX_YEAR_SPAN = 8;

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
  const [reportData, setReportData] = useState(null); // 1 entry per kolom (bulan atau tahun)

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

  // Kolom laporan -- kalau Tahun Awal == Tahun Akhir, tampil rincian 3 bulan
  // kuartal terpilih (perilaku lama). Kalau beda, tiap kolom jadi 1 TAHUN
  // (total 3 bulan kuartal itu di tahun tsb) supaya bisa dibandingkan
  // antar-tahun -- ini yang bikin Tahun Akhir sebelumnya dekoratif (state
  // tersimpan tapi tidak pernah dibaca), sekarang beneran dipakai.
  const getColumns = () => {
    const sYr = parseInt(startYear, 10) || dayjs().year();
    const eYr = parseInt(endYear, 10) || sYr;
    const yFrom = Math.min(sYr, eYr);
    const yToRaw = Math.max(sYr, eYr);
    const yTo = Math.min(yToRaw, yFrom + MAX_YEAR_SPAN - 1);
    const quarterStartMonth = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 }[selectedQuarter];

    if (yFrom === yTo) {
      return {
        capped: false,
        columns: [0, 1, 2].map((offset) => {
          const d = dayjs(new Date(yFrom, quarterStartMonth + offset, 1));
          return {
            label: d.format('MMM YYYY'),
            from: d.startOf('month').format('YYYY-MM-DD'),
            to: d.endOf('month').format('YYYY-MM-DD'),
          };
        }),
      };
    }

    const columns = [];
    for (let y = yFrom; y <= yTo; y++) {
      const start = dayjs(new Date(y, quarterStartMonth, 1)).startOf('month');
      const end = dayjs(new Date(y, quarterStartMonth + 2, 1)).endOf('month');
      columns.push({
        label: `${selectedQuarter} ${y}`,
        from: start.format('YYYY-MM-DD'),
        to: end.format('YYYY-MM-DD'),
      });
    }
    return { capped: yToRaw > yTo, columns };
  };

  const { columns, capped } = getColumns();

  // Fetch Report Data dari API — Laba Rugi per kolom (bulan atau tahun),
  // 1 request per kolom, dijalankan paralel.
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        columns.map((r) => apiClient.get('/accounting/reports/income-statement/', {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startYear, endYear, selectedQuarter]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  useEffect(() => {
    if (capped) {
      notify({
        type: 'info',
        title: 'Rentang Tahun Dibatasi',
        message: `Maksimal ${MAX_YEAR_SPAN} tahun sekaligus supaya tidak terlalu banyak permintaan ke server.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capped, startYear, endYear, selectedQuarter]);

  // Gabungkan baris akun dari semua kolom (union kode akun, default 0 kalau
  // akun itu tidak muncul di kolom tertentu).
  const mergeSection = (key) => {
    const map = new Map();
    (reportData || []).forEach((periodData, idx) => {
      (periodData?.[key] || []).forEach((row) => {
        if (!map.has(row.code)) {
          map.set(row.code, { code: row.code, name: row.name, values: columns.map(() => 0) });
        }
        map.get(row.code).values[idx] = Number(row.amount);
      });
    });
    return Array.from(map.values());
  };

  // Total per kolom — dari perhitungan server (M6), bukan dijumlah ulang di sini.
  const getTotal = (key) => columns.map((_, idx) => Number(reportData?.[idx]?.[key] || 0));

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

  // Baris akun per section, digabung dari semua kolom (data asli, bukan mock).
  const rawPendapatan = mergeSection('pendapatan');
  const rawHpp = mergeSection('hpp');
  const rawOverhead = mergeSection('biaya_operasional');
  const rawBiayaLainnya = mergeSection('biaya_non_operasional');
  const rawPendapatanLain = mergeSection('pendapatan_non_operasional');

  // Total per kolom — dari perhitungan server (M6), bukan dijumlah ulang di sini.
  const subTotalPendapatan = getTotal('subtotal_pendapatan');
  const subTotalHpp = getTotal('subtotal_hpp');
  const subTotalLabaKotor = getTotal('total_laba_kotor');
  const subTotalOverhead = getTotal('total_biaya_operasional');
  const subTotalBiayaOp = subTotalOverhead;

  const totalPendapatanOp = columns.map((_, idx) => subTotalLabaKotor[idx] - subTotalBiayaOp[idx]);

  const subTotalBiayaLainnya = getTotal('subtotal_biaya_non_operasional');
  const subTotalBiayaNonOp = subTotalBiayaLainnya;

  const subTotalPendapatanLain = getTotal('subtotal_pendapatan_non_operasional');
  const subTotalPendapatanNonOp = subTotalPendapatanLain;

  const totalPendapatanNonOp = getTotal('total_pendapatan_non_operasional');
  const totalLabaBersih = getTotal('laba_bersih');

  const colWidth = `${50 / Math.max(1, columns.length)}%`;

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
        {startYear !== endYear && (
          <> Tahun Awal ≠ Tahun Akhir: tiap kolom menampilkan total kuartal {selectedQuarter} per tahun (bukan rincian bulanan).</>
        )}
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

        {/* CONTAINER TABEL DENGAN STICKY HEADER FIXED UNTUK DESKRIPSI & KOLOM PERIODE */}
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left border-collapse">
            {/* STICKY HEADER (TIDAK IKUT BERGESER SAAT SCROLL KE ATAS) */}
            <thead className="sticky top-0 z-10 bg-[#0099E6] text-white font-bold text-xs shadow-xs">
              <tr>
                <th className="py-3 px-6 w-1/2 min-w-[280px]">Deskripsi</th>
                {columns.map((c, idx) => (
                  <th key={idx} className="py-3 px-6 text-right" style={{ width: colWidth }}>{c.label}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {/* SECTION 1: Pendapatan bersih operasional - Laba kotor */}
              <tr>
                <td colSpan={1 + columns.length} className="bg-[#0099E6] text-white px-4 py-2 font-bold text-xs">
                  Pendapatan bersih operasional - Laba kotor
                </td>
              </tr>

              {/* PENDAPATAN */}
              <tr>
                <td colSpan={1 + columns.length} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
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
                  {item.values.map((v, idx) => (
                    <td key={idx} className={`py-2 px-6 text-right ${idx === 0 && v > 0 ? 'text-[#0088E8] font-bold' : 'text-slate-600'}`}>{formatRupiah(v)}</td>
                  ))}
                </tr>
              ))}

              {/* SUBTOTAL PENDAPATAN */}
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Pendapatan</td>
                {subTotalPendapatan.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* BIAYA POKOK PENJUALAN */}
              <tr>
                <td colSpan={1 + columns.length} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50 pt-4">
                  Biaya pokok penjualan
                </td>
              </tr>
              {rawHpp.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code ? `${item.code} ${item.name}` : item.name}</td>
                  {item.values.map((v, i) => (
                    <td key={i} className="py-2 px-6 text-right text-slate-600">{formatRupiah(v)}</td>
                  ))}
                </tr>
              ))}

              {/* SUBTOTAL BIAYA POKOK PENJUALAN */}
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya pokok penjualan</td>
                {subTotalHpp.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* SUBTOTAL LABA KOTOR */}
              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Laba kotor</td>
                {subTotalLabaKotor.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* SECTION 2: Pendapatan bersih operasional - Biaya Operasional */}
              <tr>
                <td colSpan={1 + columns.length} className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-t border-slate-200">
                  Pendapatan bersih operasional - Biaya Operasional
                </td>
              </tr>

              {/* OVERHEAD */}
              <tr>
                <td colSpan={1 + columns.length} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Overhead
                </td>
              </tr>
              {rawOverhead.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code} {item.name}</td>
                  {item.values.map((v, idx) => (
                    <td key={idx} className="py-2 px-6 text-right text-slate-600">{formatRupiah(v)}</td>
                  ))}
                </tr>
              ))}

              {/* SUBTOTAL OVERHEAD */}
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Overhead</td>
                {subTotalOverhead.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* SUBTOTAL BIAYA OPERASIONAL */}
              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya Operasional</td>
                {subTotalBiayaOp.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* TOTAL PENDAPATAN BERSIH OPERASIONAL (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <tr className="bg-slate-200/90 font-bold border-t border-dashed border-black">
                <td className="py-3 px-6">Total Pendapatan bersih operasional</td>
                {totalPendapatanOp.map((v, idx) => (
                  <td key={idx} className="py-3 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* SECTION 3: Total pendapatan non operasional - Biaya non operasional */}
              <tr>
                <td colSpan={1 + columns.length} className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-t border-slate-200">
                  Total pendapatan non operasional - Biaya non operasional
                </td>
              </tr>
              <tr>
                <td colSpan={1 + columns.length} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Biaya lainnya
                </td>
              </tr>
              {rawBiayaLainnya.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code} {item.name}</td>
                  {item.values.map((v, idx) => (
                    <td key={idx} className="py-2 px-6 text-right text-slate-600">{formatRupiah(v)}</td>
                  ))}
                </tr>
              ))}

              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya lainnya</td>
                {subTotalBiayaLainnya.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Biaya non operasional</td>
                {subTotalBiayaNonOp.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* SECTION 4: Total pendapatan non operasional - Pendapatan non operasional */}
              <tr>
                <td colSpan={1 + columns.length} className="bg-[#E0F2FE] text-slate-900 px-4 py-2 font-bold text-xs border-t border-slate-200">
                  Total pendapatan non operasional - Pendapatan non operasional
                </td>
              </tr>
              <tr>
                <td colSpan={1 + columns.length} className="px-6 py-2 text-xs font-semibold text-slate-600 bg-slate-50/50">
                  Pendapatan lain
                </td>
              </tr>
              {rawPendapatanLain.map((item) => (
                <tr key={item.code} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-2 px-8 text-slate-700">{item.code} {item.name}</td>
                  {item.values.map((v, idx) => (
                    <td key={idx} className="py-2 px-6 text-right text-slate-600">{formatRupiah(v)}</td>
                  ))}
                </tr>
              ))}

              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Pendapatan lain</td>
                {subTotalPendapatanLain.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              <tr className="bg-slate-100 font-bold border-t border-slate-800">
                <td className="py-2.5 px-6">SubTotal Pendapatan non operasional</td>
                {subTotalPendapatanNonOp.map((v, idx) => (
                  <td key={idx} className="py-2.5 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* TOTAL PENDAPATAN NON OPERASIONAL (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <tr className="bg-slate-200/90 font-bold border-t border-dashed border-black">
                <td className="py-3 px-6">Total pendapatan non operasional</td>
                {totalPendapatanNonOp.map((v, idx) => (
                  <td key={idx} className="py-3 px-6 text-right">{formatRupiah(v)}</td>
                ))}
              </tr>

              {/* TOTAL LABA BERSIH (GARIS HITAM DASHED MENEMPEL DI ATAS) */}
              <tr className="bg-slate-200/90 font-black border-t border-dashed border-black">
                <td className="py-3 px-6 text-slate-900">Total Laba bersih</td>
                {totalLabaBersih.map((v, idx) => (
                  <td key={idx} className="py-3 px-6 text-right text-slate-900">{formatRupiah(v)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
