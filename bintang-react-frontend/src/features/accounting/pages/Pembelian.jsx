import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Filter, Loader2, Settings } from 'lucide-react';
import PembelianSettingsModal from '../components/pos/PembelianSettingsModal';
import PembelianSearchModal from '../components/pembelian/PembelianSearchModal';
import PembelianDateModal from '../components/pembelian/PembelianDateModal';
import PembelianDetail from '../../transaksi/components/PembelianDetail';
import HeaderFilterDropdown from '../components/HeaderFilterDropdown';
import useAccountingReturnList from '../hooks/useAccountingReturnList';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';

const today = () => new Date().toISOString().slice(0, 10);
const ago = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};
const fmtRp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const accountingStatus = (status) => (status === 'selesai' ? 'Terposting' : status === 'batal' ? 'Batal' : 'Belum Terposting');
const paymentLabel = { lunas: 'Dibayar', sebagian: 'Parsial', belum: 'Belum Bayar' };

const statusBadgeClass = (label) => {
  if (label === 'Terposting') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (label === 'Batal') return 'bg-slate-100 text-slate-500 border border-slate-200';
  return 'bg-amber-50 text-amber-700 border border-amber-200';
};
const paymentBadgeClass = (value) => {
  if (value === 'lunas') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (value === 'sebagian') return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-rose-50 text-rose-700 border border-rose-100';
};

// Retur Pembelian tidak pernah cocok di layar ini karena dokumen retur (is_retur)
// sudah dikeluarkan dari daftar dan dikelola di ReturPembelian.jsx.
const matchesPaymentFilter = (row, label) => {
  if (label === 'All') return true;
  if (label === 'Dibayar') return row.payment_status === 'lunas';
  if (label === 'Parsial') return row.payment_status === 'sebagian';
  if (label === 'Belum Dibayar' || label === 'Belum Bayar') return row.payment_status === 'belum';
  if (label === 'Retur Pembelian') return false;
  return true;
};

// Aksi Post/Batal Post/Selesai adalah aksi per-dokumen dengan prasyarat berbeda
// (lihat api/views/purchase_workflow.py) — bukan sekadar mengubah label status.
// Kelayakan bulk di bawah ini mengikuti guard yang sama persis di backend.
const canPost = (row) => row.status === 'draft' && row.receive_status === 'diterima';
const canBatalkan = (row) => row.status === 'draft' && row.receive_status !== 'diterima';
const canBayar = (row) => row.payment_status !== 'lunas';

export default function Pembelian() {
  const { rows, loading, reload } = useAccountingReturnList('/purchases/');
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(ago(30));
  const [dateTo, setDateTo] = useState(today());
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [filter, setFilter] = useState({ keyword: '', amount: '' });
  const [filterJumlah, setFilterJumlah] = useState('All');
  const [filterPembayaran, setFilterPembayaran] = useState('All');
  const [status, setStatus] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null); // { key, rect } | null

  const purchases = useMemo(() => rows.filter((row) => !row.is_retur), [rows]);

  const filtered = useMemo(() => purchases.filter((row) => {
    const date = String(row.tanggal || '').slice(0, 10);
    if (date && (date < dateFrom || date > dateTo)) return false;
    if (status !== 'All' && accountingStatus(row.status) !== status) return false;
    if (!matchesPaymentFilter(row, filterJumlah)) return false;
    if (!matchesPaymentFilter(row, filterPembayaran)) return false;
    const needle = filter.keyword.trim().toLowerCase();
    if (needle && !`${row.nomor || ''} ${row.supplier || ''}`.toLowerCase().includes(needle)) return false;
    if (filter.amount && Number(row.total || 0) !== Number(filter.amount)) return false;
    return true;
  }), [purchases, dateFrom, dateTo, filter, filterJumlah, filterPembayaran, status]);

  const selectedRows = purchases.filter((row) => selectedIds.includes(row.id));
  const visibleIds = filtered.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleRow = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleIds.includes(id))
    : [...new Set([...current, ...visibleIds])]);

  const runBulk = async (eligible, actionName, callRow, skipReason) => {
    const skipped = selectedRows.length - eligible.length;
    if (!eligible.length) {
      notify({ type: 'info', title: 'Tidak ada data yang dapat diproses', message: `Semua transaksi terpilih ${skipReason}.` });
      return;
    }
    setActionLoading(true);
    const results = await Promise.allSettled(eligible.map(callRow));
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.find((result) => result.status === 'rejected');
    if (successCount) {
      notify({
        type: 'success', title: `${actionName} berhasil`,
        message: `${successCount} transaksi berhasil diproses.${skipped ? ` ${skipped} dilewati karena ${skipReason}.` : ''}`,
      });
    }
    if (failed) notifyApiError(failed.reason, `Gagal menjalankan ${actionName.toLowerCase()} untuk sebagian transaksi.`);
    setSelectedIds([]);
    await reload();
    setActionLoading(false);
  };

  const handlePost = () => runBulk(
    selectedRows.filter(canPost), 'Post',
    (row) => apiClient.post(`/purchases/${row.id}/workflow/update-status/`, { status_pembelian: 'Selesai' }),
    'belum melalui langkah Diterima',
  );

  const handleBatalPost = () => {
    if (!window.confirm(`Batalkan ${selectedRows.filter(canBatalkan).length} pembelian terpilih?`)) return;
    runBulk(
      selectedRows.filter(canBatalkan), 'Batal Post',
      (row) => apiClient.post(`/purchases/${row.id}/workflow/update-status/`, { status_pembelian: 'Batal' }),
      'sudah diterima (wajib lewat proses Retur)',
    );
  };

  const handlePostPembayaran = () => runBulk(
    selectedRows.filter(canBayar), 'Post Pembayaran',
    (row) => apiClient.post(`/purchases/${row.id}/workflow/toggle-payment/`, { target_status: 'lunas' }),
    'sudah lunas',
  );

  const toggleHeaderDropdown = (key, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveHeaderDropdown((prev) => (prev?.key === key ? null : { key, rect }));
  };

  const headerFilterOptions = {
    jumlah: { options: ['All', 'Dibayar', 'Parsial', 'Belum Dibayar'], value: filterJumlah, setValue: setFilterJumlah },
    pembayaran: { options: ['All', 'Dibayar', 'Parsial', 'Retur Pembelian', 'Belum Bayar'], value: filterPembayaran, setValue: setFilterPembayaran },
    status: { options: ['All', 'Terposting', 'Belum Terposting', 'Batal'], value: status, setValue: setStatus },
  };

  const renderHeaderDropdown = (key, label, align = 'right') => (
    <th className={`px-5 py-3.5 ${align === 'right' ? 'text-right' : 'text-center'} relative`}>
      <button
        type="button"
        onClick={(e) => toggleHeaderDropdown(key, e)}
        className={`inline-flex items-center gap-1 cursor-pointer hover:text-slate-800 transition-colors ${align === 'right' ? 'ml-auto' : 'mx-auto'}`}
      >
        {label} <ChevronDown size={11} className="text-slate-400" />
      </button>
      {activeHeaderDropdown?.key === key && (
        <HeaderFilterDropdown
          anchorRect={activeHeaderDropdown.rect}
          options={headerFilterOptions[key].options}
          value={headerFilterOptions[key].value}
          onSelect={headerFilterOptions[key].setValue}
          onClose={() => setActiveHeaderDropdown(null)}
          align={align}
          width={160}
        />
      )}
    </th>
  );

  if (view === 'detail' && selectedId) {
    return <PembelianDetail docId={selectedId} onBack={() => { setView('list'); reload(); }} onSaved={reload} />;
  }

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0" size={16} />
        <div>
          <p className="font-bold text-amber-900">Pembelian Akuntansi</p>
          <p className="text-amber-700 text-[11px] font-medium">Aksi memproses lewat API pembelian nyata; syarat tiap aksi mengikuti alur penerimaan &amp; pembayaran dokumen.</p>
        </div>
      </div>
      <h2 className="text-base font-bold text-slate-900">Pembelian</h2>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFilterOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer"><Filter size={12} className="text-slate-400" /> Filter</button>
          <button type="button" onClick={() => setDateOpen(true)} className="px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">{dateLabel} {dateFrom} - {dateTo}</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={handlePostPembayaran} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Post Pembayaran</button>
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={handleBatalPost} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">Batal Post</button>
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={handlePost} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-[#0088E8] text-white border-[#0088E8] hover:bg-[#0077CC]">{actionLoading ? 'Memproses...' : 'Post'}</button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="p-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer"><Settings size={14} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-visible">
        <div className="overflow-x-auto overflow-y-visible"><table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold"><tr>
            <th className="px-5 py-3.5 w-10 text-center"><input type="checkbox" aria-label="Pilih semua pembelian" checked={allVisibleSelected} onChange={toggleAllVisible} className="accent-[#0088E8] cursor-pointer" /></th>
            <th className="px-5 py-3.5">Tanggal Beli</th>
            <th className="px-5 py-3.5">Transaksi</th>
            <th className="px-5 py-3.5">Supplier</th>
            {renderHeaderDropdown('jumlah', 'Jumlah', 'right')}
            {renderHeaderDropdown('pembayaran', 'Pembayaran', 'center')}
            {renderHeaderDropdown('status', 'Status', 'center')}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="inline animate-spin" size={16} /> Memuat data...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">No Data</td></tr>
            ) : filtered.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-5 py-3.5 text-center"><input type="checkbox" aria-label={`Pilih ${row.nomor}`} checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} className="accent-[#0088E8] cursor-pointer" /></td>
                <td className="px-5 py-3.5">{row.tanggal}</td>
                <td className="px-5 py-3.5"><button type="button" onClick={() => { setSelectedId(row.id); setView('detail'); }} className="font-mono font-bold text-[#0088E8] hover:underline cursor-pointer">{row.nomor}</button></td>
                <td className="px-5 py-3.5">{row.supplier || 'Supplier Umum'}</td>
                <td className="px-5 py-3.5 text-right font-bold">{fmtRp(row.total)}</td>
                <td className="px-5 py-3.5 text-center"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${paymentBadgeClass(row.payment_status)}`}>{paymentLabel[row.payment_status] || row.payment_status || '-'}</span></td>
                <td className="px-5 py-3.5 text-center"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusBadgeClass(accountingStatus(row.status))}`}>{accountingStatus(row.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="p-4 border-t border-slate-50 text-[11px] font-bold text-slate-500 bg-slate-50/30 flex justify-between">
          <span>Menampilkan {filtered.length} dari {purchases.length} pembelian</span>
          {selectedIds.length > 0 && <span className="text-[#0088E8]">{selectedIds.length} dipilih</span>}
        </div>
      </div>

      <PembelianSearchModal isOpen={filterOpen} onClose={() => setFilterOpen(false)} initialFilter={filter} onApply={(value) => { setFilter(value); setFilterOpen(false); }} />
      <PembelianDateModal isOpen={dateOpen} onClose={() => setDateOpen(false)} initialFrom={dateFrom} initialTo={dateTo} onApply={(value) => { setDateFrom(value.from); setDateTo(value.to); setDateLabel(value.label); setDateOpen(false); }} />
      <PembelianSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
