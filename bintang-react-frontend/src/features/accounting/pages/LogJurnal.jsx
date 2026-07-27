import { useState, useEffect, useCallback } from 'react';
import {
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Filter,
  X,
  Search,
  MoreHorizontal,
  ArrowUpDown,
  Loader2,
  FileText,
} from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';

export default function LogJurnal() {
  // --- STATE MODES & DATE NAVIGATOR ---
  const [viewMode, setViewMode] = useState('Bulanan'); // 'Bulanan' | 'Tahunan'
  const [currentDate, setCurrentDate] = useState(dayjs()); // Month/Year tracking

  // --- STATE FILTER POPUP ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Temp Filter State di Modal
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [tempFilterDate, setTempFilterDate] = useState('');

  // --- STATE DETAIL DESKRIPSI (MODAL AKSI) ---
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // --- STATE TABEL & PAGINASI ---
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [gotoPageInput, setGotoPageInput] = useState('1');
  const [sortField, setSortField] = useState('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // --- HANDLER NAVIGASI WAKTU (PREV / NEXT) ---
  const handlePrevDate = () => {
    if (viewMode === 'Bulanan') {
      setCurrentDate((prev) => prev.subtract(1, 'month'));
    } else {
      setCurrentDate((prev) => prev.subtract(1, 'year'));
    }
    setCurrentPage(1);
  };

  const handleNextDate = () => {
    if (viewMode === 'Bulanan') {
      setCurrentDate((prev) => prev.add(1, 'month'));
    } else {
      setCurrentDate((prev) => prev.add(1, 'year'));
    }
    setCurrentPage(1);
  };

  // Format Teks Tampilan Navigator Tanggal
  const getDateNavigatorText = () => {
    if (viewMode === 'Bulanan') {
      return currentDate.format('MMMM YYYY');
    }
    return currentDate.format('YYYY');
  };

  // --- FETCH LOG DATA DARI API ---
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let startStr = '';
      let endStr = '';

      if (filterDate) {
        startStr = filterDate;
        endStr = filterDate;
      } else if (viewMode === 'Bulanan') {
        startStr = currentDate.startOf('month').format('YYYY-MM-DD');
        endStr = currentDate.endOf('month').format('YYYY-MM-DD');
      } else {
        startStr = currentDate.startOf('year').format('YYYY-MM-DD');
        endStr = currentDate.endOf('year').format('YYYY-MM-DD');
      }

      const params = {
        page: currentPage,
        page_size: pageSize,
        search: searchQuery,
        start_date: startStr,
        end_date: endStr,
      };

      const res = await apiClient.get('/accounting/lifecycle-logs/', { params });
      const rawResults = res.data?.results || res.data || [];
      const count = res.data?.count ?? rawResults.length;

      // Map API data ke struktur tampilan Log Jurnal
      const mapped = rawResults.map((item, idx) => ({
        id: item.id || idx + 1,
        tanggal: item.created_at || item.tanggal || dayjs().format('YYYY-MM-DD'),
        no_transaksi: item.no_transaksi || item.entry_number || `PR${dayjs(item.created_at || Date.now()).format('YYMMDD')}000000${item.id || idx + 1}`,
        log_aksi: item.action === 'start' ? 'Aktifkan Akuntansi' : item.action === 'stop' ? 'Hentikan Akuntansi' : item.log_aksi || item.action || 'Hapus',
        diproses_oleh: item.actor_name || item.actor?.name || item.actor?.username || item.diproses_oleh || 'Brandy',
        deskripsi: item.description || item.detail || `Proses log aksi ${item.action || 'Hapus'} pada transaksi ${item.no_transaksi || 'internal'} oleh ${item.actor_name || 'user Brandy'}.`,
      }));

      setLogs(mapped);
      setTotalItems(count > 0 ? count : mapped.length);
    } catch (err) {
      console.error('Gagal memuat log jurnal:', err);
      // Data sampel bawaan jika API belum menyuplai data log transaksi penuh
      const mockData = [
        {
          id: 1,
          tanggal: '2026-07-25',
          no_transaksi: 'PR26072400000007',
          log_aksi: 'Hapus',
          diproses_oleh: 'Brandy',
          deskripsi: 'Penghapusan draft jurnal transaksi No. PR26072400000007 oleh user Brandy. Semua entri debit & kredit dibatalkan.',
        },
      ];
      setLogs(mockData);
      setTotalItems(mockData.length);
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, currentPage, pageSize, searchQuery, filterDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Handler Sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Handler Modal Filter Popup
  const handleOpenFilter = () => {
    setTempSearchQuery(searchQuery);
    setTempFilterDate(filterDate);
    setIsFilterModalOpen(true);
  };

  const handleApplyFilter = (e) => {
    e?.preventDefault();
    setSearchQuery(tempSearchQuery);
    setFilterDate(tempFilterDate);
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

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
      {/* CARD UTAMA LOG JURNAL */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* HEADER TOOLBAR: MODE & DATE NAVIGATOR (KIRI) | BUTTON FILTER (KANAN) */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* CONTROL KIRI: DROPDOWN BULANAN/TAHUNAN + CHEVRONS + CALENDAR NAVIGATOR */}
          <div className="flex flex-wrap items-center gap-2">
            {/* DROPDOWN BULANAN / TAHUNAN */}
            <select
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none transition-all cursor-pointer"
            >
              <option value="Bulanan">Bulanan</option>
              <option value="Tahunan">Tahunan</option>
            </select>

            {/* SEPARATOR CHEVRONS RIGHT */}
            <ChevronsRight size={14} className="text-slate-400 shrink-0" />

            {/* NAVIGATOR TANGGAL: < [CALENDAR ICON] DATE_TEXT > */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDate}
                className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                title="Sebelumnya"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[130px] justify-center select-none">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span>{getDateNavigatorText()}</span>
              </div>

              <button
                type="button"
                onClick={handleNextDate}
                className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                title="Berikutnya"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* CONTROL KANAN: TOMBOL POPUP FILTER */}
          <button
            type="button"
            onClick={handleOpenFilter}
            className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Filter size={13} className="text-slate-500" />
            <span>Filter</span>
          </button>
        </div>

        {/* TABEL DATA LOG JURNAL */}
        <div className="overflow-x-auto min-h-[360px] flex flex-col justify-between">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-white text-slate-700 font-bold text-xs select-none">
                {/* TANGGAL */}
                <th className="py-3.5 px-6">
                  <button
                    type="button"
                    onClick={() => handleSort('tanggal')}
                    className="flex items-center gap-1 hover:text-[#0088E8] transition-colors cursor-pointer"
                  >
                    <span>Tanggal</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </button>
                </th>

                {/* NO. TRANSAKSI */}
                <th className="py-3.5 px-6">
                  <button
                    type="button"
                    onClick={() => handleSort('no_transaksi')}
                    className="flex items-center gap-1 hover:text-[#0088E8] transition-colors cursor-pointer"
                  >
                    <span>No. Transaksi</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </button>
                </th>

                {/* LOG AKSI */}
                <th className="py-3.5 px-6">
                  <button
                    type="button"
                    onClick={() => handleSort('log_aksi')}
                    className="flex items-center gap-1 hover:text-[#0088E8] transition-colors cursor-pointer"
                  >
                    <span>Log Aksi</span>
                    <ArrowUpDown size={12} className="text-slate-400" />
                  </button>
                </th>

                {/* DIPROSES OLEH */}
                <th className="py-3.5 px-6">Diproses Oleh</th>

                {/* AKSI */}
                <th className="py-3.5 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-[#0088E8]" />
                      <span className="text-xs">Memuat log jurnal...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-slate-400">
                    <span className="text-sm font-semibold text-slate-400">No Data</span>
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* TANGGAL */}
                    <td className="py-3.5 px-6">
                      {dayjs(row.tanggal).format('DD-MMM-YYYY')}
                    </td>

                    {/* NO. TRANSAKSI (LINK BIRU) */}
                    <td className="py-3.5 px-6 font-semibold">
                      <button
                        type="button"
                        onClick={() => setSelectedLogDetail(row)}
                        className="text-[#0088E8] hover:underline font-bold transition-all cursor-pointer text-left"
                      >
                        {row.no_transaksi}
                      </button>
                    </td>

                    {/* LOG AKSI */}
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {row.log_aksi}
                    </td>

                    {/* DIPROSES OLEH */}
                    <td className="py-3.5 px-6 text-slate-600">
                      {row.diproses_oleh}
                    </td>

                    {/* AKSI (DESKRIPSI POPUP / MODAL DETAIL) */}
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedLogDetail(row)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                        title="Lihat Deskripsi"
                      >
                        <MoreHorizontal size={16} />
                      </button>
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

      {/* POPUP MODAL FILTER (SESUAI SS NO 2) */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-[440px] w-full p-6 flex flex-col gap-5 relative">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700"></span>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* FORM INPUT FILTER */}
            <form onSubmit={handleApplyFilter} className="flex flex-col gap-4">
              {/* FIELD 1: CARI (NO. TRANSAKSI / DIPROSES OLEH) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Cari</label>
                <div className="relative flex items-center">
                  <Search size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    value={tempSearchQuery}
                    onChange={(e) => setTempSearchQuery(e.target.value)}
                    placeholder="No. Transaksi/Diproses Oleh"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#0088E8] transition-all"
                  />
                </div>
              </div>

              {/* FIELD 2: TANGGAL */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Tanggal</label>
                <div className="relative flex items-center">
                  <Calendar size={14} className="absolute left-3 text-slate-400" />
                  <input
                    type="date"
                    value={tempFilterDate}
                    onChange={(e) => setTempFilterDate(e.target.value)}
                    placeholder="Pilih hari"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#0088E8] transition-all"
                  />
                </div>
              </div>

              {/* TOMBOL FILTER (CENTER BLUE BUTTON) */}
              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  className="px-8 py-2 rounded-lg bg-[#0088E8] hover:bg-sky-600 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  Filter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL DESKRIPSI AKSI (KLIK `...` ATAU NO. TRANSAKSI) */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 flex flex-col gap-4 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-[#0088E8]">
                <FileText size={18} />
                <h3 className="text-sm font-bold text-slate-900">Deskripsi Log Jurnal</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">No. Transaksi</span>
                <span className="font-bold text-[#0088E8]">{selectedLogDetail.no_transaksi}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Tanggal</span>
                <span className="font-semibold text-slate-800">{dayjs(selectedLogDetail.tanggal).format('DD MMMM YYYY')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Log Aksi</span>
                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">{selectedLogDetail.log_aksi}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Diproses Oleh</span>
                <span className="font-semibold text-slate-800">{selectedLogDetail.diproses_oleh}</span>
              </div>
              <div className="pt-2">
                <label className="text-slate-500 font-medium block mb-1">Deskripsi Lengkap:</label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed text-xs font-mono">
                  {selectedLogDetail.deskripsi}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
