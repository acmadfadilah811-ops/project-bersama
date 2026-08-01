import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Filter, Loader2, Settings } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notify, notifyApiError } from '../../../utils/notify';
import ReturPenjualanFilterModal from '../components/pos/ReturPenjualanFilterModal';
import ReturPenjualanDateModal from '../components/pos/ReturPenjualanDateModal';
import ReturPenjualanSettingsDrawer from '../components/pos/ReturPenjualanSettingsDrawer';
import ReturPenjualanDetail from '../components/return/ReturPenjualanDetail';
import HeaderFilterDropdown from '../components/HeaderFilterDropdown';
import useAccountingReturnList from '../hooks/useAccountingReturnList';

const today = () => new Date().toISOString().slice(0, 10);
const ago = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};
const fmtDate = (value) => value
  ? new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  : '-';
const fmtRp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const returnNo = (row) => `SR-${String(row.id).padStart(8, '0')}`;
const accountingStatus = (value) => value === 'Dikonfirmasi' ? 'Terposting' : 'Belum Terposting';

export default function ReturPenjualan() {
  const { rows, loading, reload } = useAccountingReturnList('/pengembalian/');
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(ago(30));
  const [dateTo, setDateTo] = useState(today());
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [filter, setFilter] = useState({ searchVal: '', totalOrder: '' });
  const [status, setStatus] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statusAnchor, setStatusAnchor] = useState(null);

  const filtered = useMemo(() => rows.filter((row) => {
    const date = String(row.tanggal_pengembalian || '').slice(0, 10);
    if (date && (date < dateFrom || date > dateTo)) return false;
    if (status !== 'All' && accountingStatus(row.status) !== status) return false;
    const needle = filter.searchVal.trim().toLowerCase();
    if (needle && !`${returnNo(row)} ${row.order || ''} ${row.order_nama || ''} ${row.catatan || ''}`.toLowerCase().includes(needle)) return false;
    if (filter.totalOrder && Number(row.nominal_refund || 0) !== Number(filter.totalOrder)) return false;
    return true;
  }), [rows, dateFrom, dateTo, filter, status]);

  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const visibleIds = filtered.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const toggleRow = (id) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : [...new Set([...current, ...visibleIds])]);
  };

  const updateStatusBulk = async (nextStatus, actionName) => {
    const eligible = selectedRows.filter((row) => nextStatus === 'Dikonfirmasi'
      ? ['Draft', 'Tunda'].includes(row.status)
      : row.status === 'Dikonfirmasi');
    if (!eligible.length) {
      notify({ type: 'info', title: 'Tidak ada data yang dapat diproses', message: `Pilih return dengan status yang sesuai untuk ${actionName}.` });
      return;
    }
    if (nextStatus === 'Tunda' && !window.confirm(`Batalkan post ${eligible.length} return penjualan?`)) return;

    setActionLoading(true);
    const results = await Promise.allSettled(eligible.map((row) => apiClient.patch(`/pengembalian/${row.id}/`, { status: nextStatus })));
    const successCount = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.find((result) => result.status === 'rejected');
    if (successCount) notify({ type: 'success', title: `${actionName} berhasil`, message: `${successCount} return penjualan berhasil diproses.` });
    if (failed) notifyApiError(failed.reason, `Gagal menjalankan ${actionName.toLowerCase()} return penjualan.`);
    setSelectedIds([]);
    await reload();
    setActionLoading(false);
  };

  if (view === 'detail' && selected) {
    return <ReturPenjualanDetail orderId={selected.order} returnId={selected.id} onBack={() => setView('list')} onSaved={reload} />;
  }

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3">
        <AlertTriangle className="text-amber-500 shrink-0" size={16} />
        <div><p className="font-bold text-amber-900">Return Penjualan Akuntansi</p><p className="text-amber-700 text-[11px] font-medium">Data return berasal dari transaksi pengembalian pesanan, tetapi dikelola dari layar Akuntansi ini.</p></div>
      </div>
      <h2 className="text-base font-bold text-slate-900">Retur Penjualan</h2>
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setFilterOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer"><Filter size={12} className="text-slate-400" /> Filter</button>
          <button type="button" onClick={() => setDateOpen(true)} className="px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">{dateLabel} {dateFrom} - {dateTo}</button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={() => updateStatusBulk('Tunda', 'Batal Post')} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">Batal Post</button>
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={() => updateStatusBulk('Dikonfirmasi', 'Post')} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-[#0088E8] text-white border-[#0088E8] hover:bg-[#0077CC]">{actionLoading ? 'Memproses...' : 'Post'}</button>
          <button type="button" onClick={() => setSettingsOpen(true)} className="p-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer"><Settings size={14} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-visible">
        <div className="overflow-x-auto overflow-y-visible"><table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold"><tr>
            <th className="px-5 py-3.5 w-10 text-center"><input type="checkbox" aria-label="Pilih semua return penjualan" checked={allVisibleSelected} onChange={toggleAllVisible} className="accent-[#0088E8] cursor-pointer" /></th>
            <th className="px-5 py-3.5">Tanggal</th><th className="px-5 py-3.5">No. Pengembalian</th><th className="px-5 py-3.5">No. Pesanan</th><th className="px-5 py-3.5">Pelanggan</th><th className="px-5 py-3.5 text-right">Jumlah</th>
            <th className="px-5 py-3.5 text-center relative"><button type="button" onClick={(e) => setStatusAnchor(statusAnchor ? null : e.currentTarget.getBoundingClientRect())} className="inline-flex items-center gap-1 cursor-pointer">Status <ChevronDown size={11} /></button>{statusAnchor && <HeaderFilterDropdown anchorRect={statusAnchor} options={['All', 'Terposting', 'Belum Terposting']} value={status} onSelect={setStatus} onClose={() => setStatusAnchor(null)} align="center" width={140} />}</th>
          </tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="inline animate-spin" size={16} /> Memuat data...</td></tr> : filtered.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">No Data</td></tr> : filtered.map((row) => <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
            <td className="px-5 py-3.5 text-center"><input type="checkbox" aria-label={`Pilih ${returnNo(row)}`} checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} className="accent-[#0088E8] cursor-pointer" /></td>
            <td className="px-5 py-3.5">{fmtDate(row.tanggal_pengembalian)}</td><td className="px-5 py-3.5"><button type="button" onClick={() => { setSelected(row); setView('detail'); }} className="font-mono font-bold text-[#0088E8] hover:underline cursor-pointer">{returnNo(row)}</button></td><td className="px-5 py-3.5"><button type="button" onClick={() => { setSelected(row); setView('detail'); }} className="font-mono text-slate-600 hover:text-[#0088E8] cursor-pointer">ORD-{row.order}</button></td><td className="px-5 py-3.5">{row.order_nama || 'Pelanggan Umum'}</td><td className="px-5 py-3.5 text-right font-bold">{fmtRp(row.nominal_refund)}</td><td className="px-5 py-3.5 text-center"><span className="px-2 py-0.5 rounded border bg-slate-50 text-slate-600">{accountingStatus(row.status)}</span></td>
          </tr>)}</tbody>
        </table></div>
        <div className="p-4 border-t border-slate-50 text-[11px] font-bold text-slate-500 bg-slate-50/30 flex justify-between"><span>Menampilkan {filtered.length} dari {rows.length} return penjualan</span>{selectedIds.length > 0 && <span className="text-[#0088E8]">{selectedIds.length} dipilih</span>}</div>
      </div>
      <ReturPenjualanFilterModal isOpen={filterOpen} onClose={() => setFilterOpen(false)} onApply={setFilter} />
      <ReturPenjualanDateModal isOpen={dateOpen} onClose={() => setDateOpen(false)} initialFrom={dateFrom} initialTo={dateTo} onApply={(value) => { setDateFrom(value.from); setDateTo(value.to); setDateLabel(value.label); }} />
      <ReturPenjualanSettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
