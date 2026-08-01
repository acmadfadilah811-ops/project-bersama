import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronsRight, ChevronLeft, ChevronRight, Calendar, Filter } from 'lucide-react';
import dayjs from 'dayjs';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import LogJurnalFilterModal from '../components/LogJurnalFilterModal';
import LogJurnalDescriptionModal from '../components/LogJurnalDescriptionModal';
import LogJurnalLinesModal from '../components/LogJurnalLinesModal';
import LogJurnalTable from '../components/LogJurnalTable';

export default function LogJurnal() {
  // --- STATE MODES & DATE NAVIGATOR ---
  const [viewMode, setViewMode] = useState('Bulanan'); // 'Bulanan' | 'Tahunan'
  const [currentDate, setCurrentDate] = useState(dayjs());

  // --- STATE FILTER POPUP ---
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [tempSearchQuery, setTempSearchQuery] = useState('');
  const [tempFilterDate, setTempFilterDate] = useState('');

  // --- STATE POPUP DESKRIPSI & RINCIAN BARIS ---
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);
  const [viewingEntryNumber, setViewingEntryNumber] = useState(null);

  // --- STATE DROPDOWN AKSI (titik 3) ---
  const [activeActionRowId, setActiveActionRowId] = useState(null);
  const actionDropdownRef = useRef(null);

  // --- STATE TABEL & PAGINASI ---
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [gotoPageInput, setGotoPageInput] = useState('1');

  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  const handlePrevDate = () => {
    setCurrentDate((prev) => prev.subtract(1, viewMode === 'Bulanan' ? 'month' : 'year'));
    setCurrentPage(1);
  };

  const handleNextDate = () => {
    setCurrentDate((prev) => prev.add(1, viewMode === 'Bulanan' ? 'month' : 'year'));
    setCurrentPage(1);
  };

  const getDateNavigatorText = () => currentDate.format(viewMode === 'Bulanan' ? 'MMMM YYYY' : 'YYYY');

  useEffect(() => {
    function handleClickOutside(event) {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target)) {
        setActiveActionRowId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- FETCH LOG DATA DARI API (Log Jurnal asli — JournalAuditLog) ---
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let startStr;
      let endStr;
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

      const res = await apiClient.get('/accounting/journal-audit-logs/', {
        params: {
          page: currentPage,
          page_size: pageSize,
          search: searchQuery || undefined,
          date_from: startStr,
          date_to: endStr,
        },
      });
      const rawResults = res.data?.results || res.data || [];
      const count = res.data?.count ?? rawResults.length;

      const mapped = rawResults.map((item) => ({
        id: item.id,
        tanggal: item.created_at,
        no_transaksi: item.entry_number,
        log_aksi: item.action_label,
        diproses_oleh: item.actor_name,
        deskripsi: item.note,
      }));

      setLogs(mapped);
      setTotalItems(count);
    } catch (err) {
      setLogs([]);
      setTotalItems(0);
      notifyApiError(err, 'Gagal memuat log jurnal');
    } finally {
      setLoading(false);
    }
  }, [currentDate, viewMode, currentPage, pageSize, searchQuery, filterDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={viewMode}
              onChange={(e) => { setViewMode(e.target.value); setCurrentPage(1); }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none transition-all cursor-pointer"
            >
              <option value="Bulanan">Bulanan</option>
              <option value="Tahunan">Tahunan</option>
            </select>

            <ChevronsRight size={14} className="text-slate-400 shrink-0" />

            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button type="button" onClick={handlePrevDate} className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
                <ChevronLeft size={15} />
              </button>
              <div className="flex items-center gap-2 px-3 text-xs font-bold text-slate-800 min-w-[130px] justify-center select-none">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span>{getDateNavigatorText()}</span>
              </div>
              <button type="button" onClick={handleNextDate} className="p-1 rounded-md hover:bg-white text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenFilter}
            className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer shrink-0"
          >
            <Filter size={13} className="text-slate-500" />
            <span>Filter</span>
          </button>
        </div>

        <LogJurnalTable
          logs={logs}
          loading={loading}
          pageSize={pageSize}
          setPageSize={setPageSize}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          totalItems={totalItems}
          totalPages={totalPages}
          gotoPageInput={gotoPageInput}
          setGotoPageInput={setGotoPageInput}
          onPageChange={handlePageChange}
          onGotoSubmit={handleGotoSubmit}
          activeActionRowId={activeActionRowId}
          setActiveActionRowId={setActiveActionRowId}
          actionDropdownRef={actionDropdownRef}
          onViewEntry={setViewingEntryNumber}
          onViewDescription={setSelectedLogDetail}
        />
      </div>

      <LogJurnalFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onSubmit={handleApplyFilter}
        tempSearchQuery={tempSearchQuery}
        setTempSearchQuery={setTempSearchQuery}
        tempFilterDate={tempFilterDate}
        setTempFilterDate={setTempFilterDate}
      />

      <LogJurnalDescriptionModal log={selectedLogDetail} onClose={() => setSelectedLogDetail(null)} />

      {viewingEntryNumber && (
        <LogJurnalLinesModal entryNumber={viewingEntryNumber} onClose={() => setViewingEntryNumber(null)} />
      )}
    </div>
  );
}
