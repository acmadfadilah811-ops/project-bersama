import { useState, useEffect, useCallback } from 'react';
import { Filter, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';

const INVOICE_TYPE_OPTIONS = [
  'Penjualan',
  'Pembayaran penjualan',
  'Retur penjualan',
  'Pembayaran retur penjualan',
  'Pembelian',
  'Pembayaran pembelian',
  'Retur pembelian',
  'Pembayaran retur pembelian',
  'Pemasukan',
  'Pengeluaran',
  'Stok opname',
  'Stok masuk',
  'Stok keluar',
  'Produk inventori',
  'Transfer modal',
  'Jurnal umum',
];

const PRESET_OPTIONS = [
  'Hari ini',
  'Kemarin',
  '7 Hari yang lalu',
  '30 Hari yang lalu',
  'Bulan ini',
  'Bulan lalu',
  'Sesuaikan',
];

export default function Invoice() {
  // --- STATE FILTER & PILIHAN ---
  const [selectedType, setSelectedType] = useState('Penjualan');

  // --- STATE TANGGAL ---
  const [preset, setPreset] = useState('Hari ini');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));

  // Temp state untuk Modal Filter
  const [tempPreset, setTempPreset] = useState('Hari ini');
  const [tempStartDate, setTempStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [tempEndDate, setTempEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // --- STATE TABEL & PAGINASI ---
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [gotoPageInput, setGotoPageInput] = useState('1');

  // Total Halaman
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Format Angka Rupiah
  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    return `Rp ${Number(val).toLocaleString('id-ID')}`;
  };

  // Helper kalkulasi tanggal berdasarkan Preset
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

  // Handler Pilih Preset di Modal
  const handleSelectPreset = (p) => {
    setTempPreset(p);
    if (p !== 'Sesuaikan') {
      const { startDate: s, endDate: e } = getDatesForPreset(p);
      setTempStartDate(s);
      setTempEndDate(e);
    }
  };

  // Handler Buka Modal Filter
  const handleOpenFilterModal = () => {
    setTempPreset(preset);
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsFilterModalOpen(true);
  };

  // Handler Reset Filter
  const handleResetFilter = () => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    setTempPreset('Hari ini');
    setTempStartDate(todayStr);
    setTempEndDate(todayStr);
  };

  // Handler Terapkan Filter
  const handleApplyFilter = () => {
    setPreset(tempPreset);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  // Format Teks Button Filter Tanggal
  const getFilterButtonText = () => {
    const startFormatted = dayjs(startDate).format('DD MMM YYYY');
    const endFormatted = dayjs(endDate).format('DD MMM YYYY');
    return `${preset} ${startFormatted} - ${endFormatted}`;
  };

  // Fetch Data dari API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        type: selectedType,
        start_date: startDate,
        end_date: endDate,
        page: currentPage,
        page_size: pageSize,
      };
      const res = await apiClient.get('/accounting/journal-entries/', { params });
      const results = res.data?.results || res.data || [];
      const count = res.data?.count ?? results.length;

      setData(results);
      setTotalItems(count);
    } catch (err) {
      console.error('Gagal memuat data invoice:', err);
      setData([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [selectedType, startDate, endDate, currentPage, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler Paginasi
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      setGotoPageInput(String(newPage));
    }
  };

  const handleGotoSubmit = (e) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(gotoPageInput, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        setCurrentPage(pageNum);
      } else {
        setGotoPageInput(String(currentPage));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* CARD UTAMA INVOICE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* HEADER TOOLBAR FILTER */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* DROPDOWN KIRI: KATEGORI / TRANSAKSI INVOICE */}
          <div className="w-full sm:w-64">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none transition-all cursor-pointer"
            >
              {INVOICE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          {/* TOMBOL RIGHT: FILTER TANGGAL */}
          <button
            type="button"
            onClick={handleOpenFilterModal}
            className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Filter size={13} className="text-slate-500" />
            <span>{getFilterButtonText()}</span>
          </button>
        </div>

        {/* TABEL DATA INVOICE */}
        <div className="overflow-x-auto min-h-[360px] flex flex-col justify-between">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-700 font-bold text-xs">
                <th className="py-3.5 px-6">Tanggal</th>
                <th className="py-3.5 px-6">No. Invoice</th>
                <th className="py-3.5 px-6">Transaksi</th>
                <th className="py-3.5 px-6 text-right">Nilai Debit</th>
                <th className="py-3.5 px-6 text-right">Nilai Kredit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-[#0088E8]" />
                      <span className="text-xs">Memuat data invoice...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <span className="text-sm font-semibold text-slate-400">No Data</span>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6">
                      {row.tanggal || row.created_at ? dayjs(row.tanggal || row.created_at).format('DD-MM-YYYY') : '-'}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-800">
                      {row.no_invoice || row.entry_number || row.invoice_number || '-'}
                    </td>
                    <td className="py-3.5 px-6">{row.transaksi || row.description || selectedType}</td>
                    <td className="py-3.5 px-6 text-right font-medium">
                      {formatCurrency(row.nilai_debit ?? row.debit ?? 0)}
                    </td>
                    <td className="py-3.5 px-6 text-right font-medium">
                      {formatCurrency(row.nilai_kredit ?? row.kredit ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* FOOTER PAGINASI */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-semibold bg-white mt-auto">
            {/* KIRI: ITEM PER PAGE */}
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 font-medium text-xs outline-none cursor-pointer"
              >
                <option value={10}>10 item</option>
                <option value={15}>15 item</option>
                <option value={25}>25 item</option>
                <option value={50}>50 item</option>
                <option value={100}>100 item</option>
              </select>
            </div>

            {/* KANAN: TOTAL ITEM & KONTROL HALAMAN */}
            <div className="flex items-center gap-4">
              <span>Total {totalItems}</span>

              {/* NAVIGASI NOMOR HALAMAN */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="w-7 h-7 rounded-full bg-[#0088E8] text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                  {currentPage}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* GO TO INPUT */}
              <div className="flex items-center gap-2">
                <span>Go to</span>
                <input
                  type="text"
                  value={gotoPageInput}
                  onChange={(e) => setGotoPageInput(e.target.value)}
                  onKeyDown={handleGotoSubmit}
                  className="w-10 h-7 border border-slate-200 rounded-md text-center text-xs font-bold text-slate-800 outline-none focus:border-[#0088E8]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL POPUP FILTER TANGGAL (SESUAI SS NO 2) */}
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
                onClick={handleResetFilter}
                className="w-full py-2.5 rounded-lg bg-[#FF6B6B] hover:bg-rose-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleApplyFilter}
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
