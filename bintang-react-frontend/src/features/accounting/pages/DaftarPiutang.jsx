import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, ChevronDown, Search, Calendar, Loader2 } from 'lucide-react';
import PiutangFilterModal from '../components/pos/PiutangFilterModal';
import PiutangDateModal from '../components/pos/PiutangDateModal';
import TambahJurnalDropdown from '../components/pos/TambahJurnalDropdown';
import PiutangActionDropdown from '../components/pos/PiutangActionDropdown';
import ExportPiutangModal from '../components/pos/ExportPiutangModal';
import PasanganJurnalModal from '../components/pos/PasanganJurnalModal';
import DetailPiutangSelesai from './DetailPiutangSelesai';
import { notify } from '../../../utils/notify';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';

export default function DaftarPiutang({ initialFilter }) {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getDaysAgoStr = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const [filterType, setFilterType] = useState(initialFilter || 'Semua Piutang');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  // Detail selection states
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [selectedJournalItem, setSelectedJournalItem] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua');

  // Date parameter filter
  const [dateFrom, setDateFrom] = useState(getDaysAgoStr(7));
  const [dateTo, setDateTo] = useState(getTodayStr());
  const [dateLabel, setDateLabel] = useState('7 Hari yang lalu');

  // Page Size dropdown states
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);

  // Backend state
  const [piutangData, setPiutangData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (initialFilter) {
      setFilterType(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (pageSizeRef.current && !pageSizeRef.current.contains(event.target)) {
        setIsPageSizeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPiutang = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchAllPages('/orders/');
      const formatted = data.map((item) => {
        const total = Number(item.total_harga || 0);
        const dp = Number(item.dp_dibayar || 0);
        const sisa = Math.max(0, Number(item.sisa_tagihan || 0));
        const orderDate = item.waktu ? item.waktu.split('T')[0] : '';
        return {
          id: item.id,
          date: orderDate,
          txNo: item.nomor || `ORD-${item.id}`,
          client: item.nama || item.nomor_wa || 'Pelanggan Umum',
          desc: `Order ${item.id}`,
          amount: total,
          remaining: sisa,
          paidAmount: dp,
          dueDate: item.jatuh_tempo || orderDate || '-',
          journalSourceIds: (item.activity_logs || [])
            .filter((activity) => activity.tindakan === 'PAYMENT')
            .map((activity) => activity.id),
          status: sisa === 0 ? 'Lunas' : (dp > 0 ? 'Sebagian' : 'Belum Bayar'),
          type: 'Piutang Dagang',
        };
      });
      setPiutangData(formatted);
    } catch (err) {
      console.error('Gagal memuat daftar piutang:', err);
      setLoadError(err.response?.data?.detail || err.message || 'Data piutang tidak dapat dimuat dari server.');
      notify({
        type: 'error',
        title: 'Gagal Memuat Data',
        message: 'Gagal memuat data piutang dari server.',
      });
      setPiutangData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPiutang();
  }, []);

  // Client-side filtering
  const filteredData = piutangData.filter((row) => {
    if (dateFrom && row.date < dateFrom) return false;
    if (dateTo && row.date > dateTo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matches = row.txNo.toLowerCase().includes(q) ||
                      row.client.toLowerCase().includes(q) ||
                      row.desc.toLowerCase().includes(q);
      if (!matches) return false;
    }

    if (statusFilter !== 'Semua' && row.status !== statusFilter) return false;

    return true;
  });
  const visibleData = filteredData.slice(0, pageSize);

  const totalRemaining = filteredData.reduce((acc, curr) => acc + (curr.remaining || 0), 0);
  const totalPaid = filteredData.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);

  const handleApplyFilterModal = (filterObj) => {
    if (filterObj.clientSearch) setSearchQuery(filterObj.clientSearch);
    if (filterObj.status) setStatusFilter(filterObj.status);
    setIsFilterModalOpen(false);
    notify({
      type: 'success',
      title: 'Filter Diterapkan',
      message: 'Kriteria pencarian piutang berhasil diperbarui.'
    });
  };

  const handleApplyDateModal = (dateObj) => {
    setDateFrom(dateObj.from);
    setDateTo(dateObj.to);
    setDateLabel(dateObj.label);
    setIsDateModalOpen(false);
  };

  if (selectedDetailItem) {
    return (
      <DetailPiutangSelesai
        selectedDetailItem={selectedDetailItem}
        onBack={() => setSelectedDetailItem(null)}
      />
    );
  }

  const formatIDR = (num) => {
    return (Number(num) || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Top Banner Notice */}
      <div className="bg-[#FFF8E6] border border-[#FFE599] rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="text-amber-500 shrink-0" size={16} />
          <span className="font-bold text-amber-900 text-xs">
            Halaman ini menampilkan data piutang usaha yang belum dan sudah dilunasi secara real-time dari backend.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExportOpen(true)}
          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
        >
          Export
        </button>
      </div>
      {loadError && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">{loadError}</p>}

      {/* Main Filter and Controls Header */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        
        {/* Left Filter & Search Inputs */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[300px]">
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="px-3.5 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
          >
            <span>Filter</span>
          </button>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari pemesan/no invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg outline-none focus:border-[#0088E8] text-xs font-semibold text-slate-800 bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 text-slate-700 bg-white rounded-lg outline-none font-bold text-xs cursor-pointer focus:border-[#0088E8]"
          >
            <option value="Semua">Semua Status</option>
            <option value="Belum Bayar">Belum Bayar</option>
            <option value="Sebagian">Sebagian</option>
            <option value="Lunas">Lunas</option>
          </select>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <TambahJurnalDropdown />
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="px-3.5 py-1.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs font-bold flex items-center gap-1.5"
          >
            <Calendar size={13} className="text-slate-400" />
            <span>{dateLabel} ({dateFrom} - {dateTo})</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible min-h-[350px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-xs gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#0088E8]" />
            <span>Memuat data piutang riil...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5 w-10">No</th>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5">Transaksi</th>
                  <th className="px-5 py-3.5">Pelanggan</th>
                  <th className="px-5 py-3.5 text-right">Nilai / Sisa</th>
                  <th className="px-5 py-3.5 text-center">Jatuh Tempo</th>
                  <th className="px-5 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {visibleData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-slate-400 font-bold">
                      Belum ada piutang terdeteksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  visibleData.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400">{idx + 1}</td>
                      <td className="px-5 py-3.5 text-slate-600">{row.date}</td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-[#0088E8]">{row.txNo}</span>
                          <div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                              row.status === 'Lunas' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {row.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-800 font-bold">{row.client}</td>
                      <td className="px-5 py-3.5 text-right font-bold">
                        <div>Rp {formatIDR(row.amount)}</div>
                        <div className="text-[10px] text-rose-600 font-bold">Sisa: Rp {formatIDR(row.remaining)}</div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-rose-600 font-bold">{row.dueDate}</td>
                      <td className="px-5 py-3.5 text-center">
                        <PiutangActionDropdown
                          txNo={row.txNo}
                          orderId={row.id}
                          onDetailClick={() => setSelectedDetailItem(row)}
                          onJournalClick={() => setSelectedJournalItem(row)}
                          isLunas={row.status === 'Lunas'}
                        />
                      </td>
                    </tr>
                  ))
                )}

                {/* Total Summary Row */}
                {filteredData.length > 0 && (
                  <tr className="bg-slate-50/50 font-bold text-slate-800 text-xs">
                    <td colSpan={4} className="px-5 py-3 text-right">Total Ringkasan:</td>
                    <td className="px-5 py-3 text-right text-rose-600 font-bold">
                      Belum dibayar: Rp {formatIDR(totalRemaining)}
                    </td>
                    <td colSpan={2} className="px-5 py-3 text-emerald-600 font-bold">
                      Dibayar: Rp {formatIDR(totalPaid)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info & pagination */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <div className="flex items-center gap-2 relative" ref={pageSizeRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
              className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md font-extrabold cursor-pointer"
            >
              <span>{pageSize} item</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
            {isPageSizeOpen && (
              <div className="absolute left-0 bottom-9 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-50 w-24 font-bold text-slate-700 animate-fade-in text-left">
                {[15, 25, 50, 100].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setPageSize(size);
                      setIsPageSizeOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                      pageSize === size ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
                    }`}
                  >
                    {size} item
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>Total {filteredData.length} entri piutang</div>
        </div>
      </div>

      {/* Modals */}
      <PiutangFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={handleApplyFilterModal}
      />

      <PiutangDateModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={handleApplyDateModal}
      />

      <ExportPiutangModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        rows={filteredData}
      />
      <PasanganJurnalModal
        isOpen={Boolean(selectedJournalItem)}
        onClose={() => setSelectedJournalItem(null)}
        txNo={selectedJournalItem?.txNo || ''}
        sourceIds={selectedJournalItem?.journalSourceIds || []}
      />
    </div>
  );
}
