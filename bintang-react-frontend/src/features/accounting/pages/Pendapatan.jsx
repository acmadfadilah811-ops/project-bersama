import { useState, useRef, useEffect } from 'react';
import { Filter, AlertTriangle, ChevronDown } from 'lucide-react';
import PendapatanFilterModal from '../components/pos/PendapatanFilterModal';
import TipeTransaksiModal from '../components/pos/TipeTransaksiModal';
import ReturPenjualanDateModal from '../components/pos/ReturPenjualanDateModal';
import { notify } from '../../../utils/notify';

export default function Pendapatan() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isTipeOpen, setIsTipeOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState('2026-06-26');
  const [dateTo, setDateTo] = useState('2026-07-26');
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');

  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null); // 'status' | null
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Terposting' | 'Belum Terposting'
  const dropdownRef = useRef(null);

  // Rows state
  const [rows, setRows] = useState([
    { id: 1, date: '16-Jul-2026', txNo: 'I-OL260716000001 (16-Jul-2026)', type: 'Dhitch', user: 'Brandy', amount: 6767987, debitAcc: '11101 Kas', creditAcc: '', status: 'Belum Terposting' },
    { id: 2, date: '17-Jul-2026', txNo: 'I-OL260717000002 (17-Jul-2026)', type: 'Dhitch', user: 'Brandy', amount: 0, debitAcc: '11101 Kas', creditAcc: '', status: 'Belum Terposting' }
  ]);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const accountsList = [
    '11101 Kas',
    '11102 Bank',
    '11103 Kas in register',
    '11104 Giro',
    '11200 Investasi jangka pendek dan surat berharga',
    '11300 Piutang dagang',
    '11400 Persediaan barang dagang',
    '11500 Peralatan',
    '11600 Akumulasi penyusutan peralatan',
    '11700 Beban dibayar dimuka',
    '11750 PPN Masukan',
    '12000 Aset Tetap',
    '13000 Aset tak berwujud',
    '14000 Akumulasi penyusutan aset tetap',
    '15000 Akumulasi penyusutan aset tak berwujud',
    '23000 Pendapatan di terima dimuka',
    '23500 PPN Keluaran',
    '31000 Modal',
    '32000 Prive',
    '33000 Laba rugi ditahan',
    '40000 Penjualan',
    '41000 Penjualan antar cabang',
    '42000 Layanan biaya penjualan',
    '44000 Pengiriman penjualan',
    '46100 Potongan penjualan',
    '46200 Loyalitas penjualan',
    '46300 Return penjualan',
    '50000 Pembelian',
    '50100 Pembelian antar cabang',
    '50300 Biaya pengiriman',
    '50400 Return pembelian',
    '50500 Potongan pembelian',
    '51000 Harga pokok penjualan',
    '60100 Biaya gaji',
    '60200 Biaya air listrik telephone',
    '60300 Biaya perlengkapan',
    '60400 Biaya penyusutan',
    '60500 Biaya transfer',
    '70000 Pendapatan lain lain',
    '70001 Pembulatan',
    '70002 Code Uniq Penjualan',
    '70003 Layanan Penjualan',
    '70009 Bank Example',
    '80000 Pengeluaran lain lain',
    '81000 Penyesuaian Barang'
  ];

  const handleSelectRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const visibleIds = filteredRows.map((r) => r.id);
    const allSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const handlePost = () => {
    setRows((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, status: 'Terposting' } : r))
    );
    setSelectedIds([]);
    notify({
      type: 'success',
      title: 'Sukses Posting',
      message: 'Transaksi pendapatan terpilih berhasil diposting.'
    });
  };

  const handleCancelPost = () => {
    setRows((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, status: 'Belum Terposting' } : r))
    );
    setSelectedIds([]);
    notify({
      type: 'success',
      title: 'Batal Posting',
      message: 'Posting transaksi pendapatan terpilih berhasil dibatalkan.'
    });
  };

  // Filter rows
  const filteredRows = rows.filter((r) => {
    if (filterStatus !== 'All' && r.status !== filterStatus) return false;
    return true;
  });

  const checkedItems = rows.filter((r) => selectedIds.includes(r.id));
  const hasBelumPosted = checkedItems.length > 0 && checkedItems.some((r) => r.status === 'Belum Terposting');
  const hasPosted = checkedItems.length > 0 && checkedItems.some((r) => r.status === 'Terposting');

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 text-xs">
            Sistem Belum Terhubung ke POS Pendapatan
          </p>
          <p className="text-amber-700 text-[11px] font-medium leading-relaxed">
            Penyelarasan jurnal transaksi kasir POS belum aktif secara terpadu. 
            Tampilan di bawah ini memprioritaskan keselarasan UI (fokus antarmuka).
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Data Pendapatan</h2>
        
        {/* Tipe Transaksi trigger button top-right */}
        <button
          type="button"
          onClick={() => setIsTipeOpen(true)}
          className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[10px] cursor-pointer transition-colors"
        >
          Tipe Transaksi
        </button>
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        
        {/* Left Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Filter size={12} className="text-slate-400" />
            <span>Filter</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDateOpen(true)}
            className="px-3 py-1.5 border border-slate-205 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {dateLabel} {dateFrom.split('-').reverse().join('-')} - {dateTo.split('-').reverse().join('-')}
          </button>
        </div>

        {/* Right Actions - Batal Post and Post */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancelPost}
            disabled={!hasPosted}
            className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs border ${
              hasPosted
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            Batal Post
          </button>

          <button
            type="button"
            onClick={handlePost}
            disabled={!hasBelumPosted}
            className={`px-4 py-1.5 font-bold rounded-lg text-[10px] transition-all shadow-2xs border ${
              hasBelumPosted
                ? 'bg-[#0088E8] text-white border-[#0088E8] hover:bg-[#0077CC] cursor-pointer'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            Post
          </button>
        </div>

      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every((r) => selectedIds.includes(r.id))}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8]/30 cursor-pointer"
                  />
                </th>
                <th className="px-5 py-3.5 w-[35%]">Transaksi</th>
                <th className="px-5 py-3.5 text-right w-[15%]">
                  <div className="flex items-center justify-end gap-1 select-none">
                    <span>Jumlah</span>
                    <span className="text-slate-350 text-[10px]">↕</span>
                  </div>
                </th>
                <th className="px-5 py-3.5 w-[20%]">Akun Debit</th>
                <th className="px-5 py-3.5 w-[20%]">Akun Kredit</th>
                <th className="px-5 py-3.5 text-center relative min-w-[140px] w-[10%]">
                  <div
                    onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'status' ? null : 'status')}
                    className="flex items-center justify-center gap-1 cursor-pointer select-none hover:text-slate-700 transition-colors"
                  >
                    <span>Status</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </div>
                  {activeHeaderDropdown === 'status' && (
                    <div ref={dropdownRef} className="absolute left-1/2 -translate-x-1/2 top-11 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 z-40 w-36 font-semibold animate-fade-in text-left">
                      {['All', 'Terposting', 'Belum Terposting'].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => {
                            setFilterStatus(opt);
                            setActiveHeaderDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 transition-colors cursor-pointer ${
                            filterStatus === opt ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-bold">
                    No Data
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                    {/* Checkbox */}
                    <td className="px-5 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => handleSelectRow(row.id)}
                        className="rounded border-slate-300 text-[#0088E8] focus:ring-[#0088E8]/30 cursor-pointer"
                      />
                    </td>
                    {/* Transaksi Info */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800 break-all leading-normal">
                          {row.txNo}
                        </span>
                        <div className="text-[10px] text-slate-400 font-bold">
                          {row.type} | {row.user}
                        </div>
                      </div>
                    </td>
                    {/* Jumlah */}
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">
                      IDR {row.amount.toLocaleString('id-ID')}
                    </td>
                    {/* Akun Debit */}
                    <td className="px-5 py-3.5">
                      <select
                        value={row.debitAcc}
                        onChange={(e) => {
                          const updatedVal = e.target.value;
                          setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, debitAcc: updatedVal } : r));
                        }}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:border-[#0088E8] text-[11px] font-medium text-slate-650 cursor-pointer"
                      >
                        {accountsList.map((acc) => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </td>
                    {/* Akun Kredit */}
                    <td className="px-5 py-3.5">
                      <select
                        value={row.creditAcc}
                        onChange={(e) => {
                          const updatedVal = e.target.value;
                          setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, creditAcc: updatedVal } : r));
                        }}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:border-[#0088E8] text-[11px] font-medium text-slate-650 cursor-pointer"
                      >
                        <option value="">Pilih</option>
                        {accountsList.map((acc) => (
                          <option key={acc} value={acc}>{acc}</option>
                        ))}
                      </select>
                    </td>
                    {/* Status Badge */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                        row.status === 'Terposting'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info & pagination */}
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white hover:bg-slate-50 rounded-md transition-colors shadow-2xs">
              <span>15 item</span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <span>Total {filteredRows.length}</span>
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

      {/* Filter Modal */}
      <PendapatanFilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(filter) => console.log('Filter applied', filter)}
      />

      {/* Date Modal */}
      <ReturPenjualanDateModal
        isOpen={isDateOpen}
        onClose={() => setIsDateOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={(res) => {
          setDateFrom(res.from);
          setDateTo(res.to);
          setDateLabel(res.label);
        }}
      />

      {/* Tipe Transaksi Modal */}
      <TipeTransaksiModal
        isOpen={isTipeOpen}
        onClose={() => setIsTipeOpen(false)}
      />

    </div>
  );
}
