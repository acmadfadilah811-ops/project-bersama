import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, ChevronDown, Search, Calendar } from 'lucide-react';
import PiutangFilterModal from '../components/pos/PiutangFilterModal';
import PiutangDateModal from '../components/pos/PiutangDateModal';
import TambahJurnalDropdown from '../components/pos/TambahJurnalDropdown';
import PiutangActionDropdown from '../components/pos/PiutangActionDropdown';
import ExportPiutangModal from '../components/pos/ExportPiutangModal';
import DetailPiutangSelesai from './DetailPiutangSelesai';
import { notify } from '../../../utils/notify';

export default function DaftarPiutang({ initialFilter }) {
  const [filterType, setFilterType] = useState(initialFilter || 'Semua Piutang');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  
  // Detail selection states
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Belum Bayar'); // 'Belum Bayar' | 'Sebagian' | 'Lunas'
  
  // Date parameter filter (pojok kanan)
  const [dateFrom, setDateFrom] = useState('2026-07-20');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [dateLabel, setDateLabel] = useState('7 Hari yang lalu');

  // Page Size dropdown states
  const [pageSize, setPageSize] = useState(15);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);
  const pageSizeRef = useRef(null);

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

  // Static mock data matching Screenshot 1
  const allRows = [
    {
      id: 1,
      date: '24 Jul 2026',
      txNo: 'EFC826072400000001',
      client: 'Bintang POS',
      desc: 'Penjualan dari POS',
      amount: 75000.00,
      remaining: 0.00,
      paidAmount: 75000.00,
      dueDate: '24 Jul. 2026',
      status: 'Lunas',
      type: 'Piutang Dagang'
    },
    {
      id: 2,
      date: '24 Jul 2026',
      txNo: 'EFC826072400000002',
      client: 'Gm h',
      desc: 'Penjualan ke gm h',
      amount: 70000.00,
      remaining: 0.00,
      paidAmount: 70000.00,
      dueDate: '24 Jul. 2026',
      status: 'Lunas',
      type: 'Piutang Dagang'
    },
    {
      id: 3,
      date: '24 Jul 2026',
      txNo: 'EFC826072400000003',
      client: 'BAYU',
      desc: 'Penjualan ke BAYU',
      amount: 75000.00,
      remaining: 0.00,
      paidAmount: 75000.00,
      dueDate: '24 Jul. 2026',
      status: 'Lunas',
      type: 'Piutang Dagang'
    },
    {
      id: 4,
      date: '24 Jul 2026',
      txNo: 'EFC826072400000004',
      client: 'AGUS',
      desc: 'Penjualan ke AGUS',
      amount: 35000.00,
      remaining: 0.00,
      paidAmount: 35000.00,
      dueDate: '24 Jul. 2026',
      status: 'Lunas',
      type: 'Piutang Dagang'
    },
    {
      id: 5,
      date: '24 Jul 2026',
      txNo: 'EFC826072400000005',
      client: 'KEVIN',
      desc: 'Penjualan ke KEVIN',
      amount: 62500.00,
      remaining: 0.00,
      paidAmount: 62500.00,
      dueDate: '24 Jul. 2026',
      status: 'Lunas',
      type: 'Piutang Dagang'
    },
    {
      id: 6,
      date: '24 Jul 2026',
      txNo: '32HB26072400000001',
      client: 'BAYU',
      desc: 'Penjualan ke BAYU',
      amount: 25000.00,
      remaining: 25000.00,
      paidAmount: 0.00,
      dueDate: '24 Jul. 2026',
      status: 'Belum Bayar',
      type: 'Piutang Dagang'
    },
    {
      id: 7,
      date: '24 Jul 2026',
      txNo: '32HB26072400000002',
      client: 'AGUS',
      desc: 'Penjualan ke AGUS',
      amount: 50000.00,
      remaining: 20000.00,
      paidAmount: 30000.00,
      dueDate: '24 Jul. 2026',
      status: 'Sebagian',
      type: 'Piutang Dagang'
    }
  ];

  // Apply filters
  const filteredData = allRows.filter((item) => {

    // 2. Status pill filter
    if (statusFilter === 'Belum Bayar' && item.status !== 'Belum Bayar') return false;
    if (statusFilter === 'Sebagian' && item.status !== 'Sebagian') return false;
    if (statusFilter === 'Lunas' && item.status !== 'Lunas') return false;

    // 3. Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      return (
        item.txNo.toLowerCase().includes(q) ||
        item.client.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
      );
    }

    return true;
  });

  const handleExport = () => {
    notify({
      type: 'success',
      title: 'Export Berhasil',
      message: 'Data piutang berhasil diexport ke format XLSX.'
    });
  };

  const handleApplyFilterModal = (filterParams) => {
    console.log('Applied advanced filter parameters:', filterParams);
    notify({
      type: 'success',
      title: 'Filter Diterapkan',
      message: `Pencarian piutang disaring berdasarkan kriteria kustom.`
    });
  };

  const handleApplyDateModal = (res) => {
    setDateFrom(res.from);
    setDateTo(res.to);
    setDateLabel(res.label);
    notify({
      type: 'success',
      title: 'Rentang Tanggal Disetel',
      message: `Rentang piutang disaring berdasarkan rentang tanggal: ${res.label}`
    });
  };

  // Totals calculations
  const totalRemaining = filteredData.reduce((sum, item) => sum + item.remaining, 0);
  const totalPaid = filteredData.reduce((sum, item) => sum + item.paidAmount, 0);

  if (selectedDetailItem) {
    return (
      <DetailPiutangSelesai
        selectedDetailItem={selectedDetailItem}
        onBack={() => setSelectedDetailItem(null)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Belum Terhubung ke Modul Piutang
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Data transaksi piutang pelanggan belum disinkronkan secara real-time. 
            Tampilan di bawah ini memprioritaskan tata letak visual UI sesuai dengan kebutuhan pengguna.
          </p>
        </div>
      </div>

      {/* Header Title & Top-Right Action Buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">{filterType}</h2>
        
        <div className="flex items-center gap-2">
          {/* Tambah Jurnal Dropdown */}
          <TambahJurnalDropdown />

          {/* Export Button */}
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[10px] uppercase cursor-pointer transition-colors"
          >
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar matching Screenshot 1 */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[#F8FAFC]/50 p-1.5 border border-slate-100 rounded-xl">
        
        {/* Left Side: Filter button + Search input + Status Pills with Big Blue Dots */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Advanced Filter Button */}
          <button
            type="button"
            onClick={() => setIsFilterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-white hover:bg-slate-50 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          {/* Search box input */}
          <div className="relative flex items-center bg-white rounded-lg shadow-2xs">
            <Search className="absolute left-3 text-slate-400" size={12} />
            <input
              type="text"
              placeholder="Transaksi/Pelanggan/Deskrip"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-205 rounded-lg outline-none hover:bg-slate-105/50 focus:bg-white text-xs font-semibold text-slate-700 w-52 transition-all"
            />
          </div>

          {/* Status Checkbox Pills with Large Blue Dot Indicators */}
          <div className="flex items-center gap-1.5">
            {['Belum Bayar', 'Sebagian', 'Lunas'].map((pill) => {
              const active = statusFilter === pill;
              return (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setStatusFilter(pill)}
                  className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg font-extrabold transition-all cursor-pointer text-[10px] uppercase tracking-wide ${
                    active
                      ? 'border-[#0088E8] text-[#0088E8] bg-[#E6F4FF]/45 shadow-3xs'
                      : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex items-center justify-center w-3.5 h-3.5 rounded-full border shrink-0 transition-all ${
                    active ? 'border-[#0088E8] bg-[#E6F4FF]' : 'border-slate-300 bg-white'
                  }`}>
                    {active && (
                      <span className="bg-[#0088E8] w-2 h-2 rounded-full animate-scale-up" />
                    )}
                  </span>
                  <span>{pill}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Date Range button triggers PiutangDateModal */}
        <div>
          <button
            type="button"
            onClick={() => setIsDateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-650 rounded-lg shadow-2xs font-extrabold transition-all cursor-pointer"
          >
            <Calendar size={12} className="text-slate-400" />
            <span>
              {dateLabel} {dateLabel !== 'Semua Data' && `${dateFrom.split('-').reverse().join('-')} - ${dateTo.split('-').reverse().join('-')}`}
            </span>
          </button>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[260px] pb-10">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5 w-[15%]">Tanggal</th>
                <th className="px-5 py-3.5 w-[25%]">Transaksi</th>
                <th className="px-5 py-3.5 w-[30%]">Pelanggan | Deskripsi</th>
                <th className="px-5 py-3.5 text-right w-[15%]">Jumlah</th>
                <th className="px-5 py-3.5 text-center w-[10%]">Jatuh Tempo</th>
                <th className="px-5 py-3.5 text-center w-[5%]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-bold">
                    No Data
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Tanggal */}
                    <td className="px-5 py-3.5 text-slate-600 font-medium">
                      {row.date}
                    </td>
                    
                    {/* Transaksi */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-800 break-all leading-normal font-mono">
                          {row.txNo}
                        </span>
                        <div>
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[9px] font-bold border border-amber-100">
                            {row.status === 'Belum Bayar' ? 'Belum dibayar' : row.status}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Pelanggan | Deskripsi */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800">{row.client}</span>
                        <div className="text-[10px] text-slate-400 font-bold">
                          {row.desc}
                        </div>
                      </div>
                    </td>

                    {/* Jumlah */}
                    <td className="px-5 py-3.5 text-right space-y-0.5">
                      <div className="font-mono font-bold text-slate-800">
                        {row.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-[#0088E8] font-bold">
                        Sisa : {row.remaining.toLocaleString('id-ID')}
                      </div>
                    </td>

                    {/* Jatuh Tempo */}
                    <td className="px-5 py-3.5 text-center font-bold text-rose-600">
                      {row.dueDate}
                    </td>

                    {/* Action Dropdown component */}
                    <td className="px-5 py-3.5 text-center">
                      <PiutangActionDropdown
                        txNo={row.txNo}
                        onDetailClick={() => setSelectedDetailItem(row)}
                        isLunas={row.status === 'Lunas'}
                      />
                    </td>
                  </tr>
                ))
              )}

              {/* Total Summary Row matching Screenshot 1 */}
              {filteredData.length > 0 && (
                <tr className="bg-slate-50/20 font-bold text-slate-800 text-[11px]">
                  <td colSpan={3} className="px-5 py-3">
                    Total
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500 font-bold">
                    Belum dibayar : {totalRemaining.toLocaleString('id-ID')}
                  </td>
                  <td colSpan={2} className="px-5 py-3 text-right text-slate-500 font-bold">
                    Dibayar : {totalPaid.toLocaleString('id-ID')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          
          <div className="flex items-center gap-2 relative" ref={pageSizeRef}>
            <button
              type="button"
              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
              className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md transition-colors shadow-2xs cursor-pointer font-extrabold"
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
                      notify({
                        type: 'info',
                        title: 'Page Size Disetel',
                        message: `Menampilkan maksimal ${size} data per halaman.`
                      });
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

          <div className="flex items-center gap-4">
            <span>Total {filteredData.length}</span>
            <div className="flex items-center gap-1.5">
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &lt;
              </button>
              <span className="w-6 h-6 flex items-center justify-center rounded bg-[#0088E8] text-white">
                1
              </span>
              <button disabled className="w-6 h-6 flex items-center justify-center rounded border border-slate-200 bg-white text-slate-400 cursor-not-allowed">
                &gt;
              </button>
            </div>
            
            <div className="flex items-center gap-1.5">
              <span>Go to</span>
              <input
                type="text"
                defaultValue="1"
                disabled
                className="w-8 py-0.5 text-center border border-slate-200 rounded bg-slate-50 text-slate-400 outline-none"
              />
            </div>
          </div>

        </div>

      </div>

      {/* Advanced Filter Modal */}
      <PiutangFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        onApply={handleApplyFilterModal}
      />

      {/* Date Filter Preset Modal */}
      <PiutangDateModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onApply={handleApplyDateModal}
      />

      {/* Export Piutang Modal */}
      <ExportPiutangModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

    </div>
  );
}
