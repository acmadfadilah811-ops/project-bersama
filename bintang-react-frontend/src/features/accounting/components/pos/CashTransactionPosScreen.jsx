import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { notify, notifyApiError } from '../../../../utils/notify';
import ReturPenjualanDateModal from './ReturPenjualanDateModal';
import TipeTransaksiModal from './TipeTransaksiModal';

const today = () => new Date().toISOString().slice(0, 10);
const ago = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};
const fmtRp = (value) => Number(value || 0).toLocaleString('id-ID');
const statusLabel = { draft: 'Belum Terposting', selesai: 'Terposting', batal: 'Batal' };
const statusBadgeClass = (value) => {
  if (value === 'selesai') return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  if (value === 'batal') return 'bg-slate-100 text-slate-500 border border-slate-200';
  return 'bg-amber-50 text-amber-700 border border-amber-200';
};

// Post/Batal Post CashTransaction (Pendapatan/Pengeluaran): akun debit & kredit
// wajib dipilih dulu (disimpan lewat PATCH saat draft) sebelum Post diaktifkan.
// Sekali Terposting, akun terkunci — Batal Post membuat jurnal pembalik (M7),
// bukan mengedit/menghapus jurnal asli.
export default function CashTransactionPosScreen({ direction, title }) {
  const [rows, setRows] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState(ago(30));
  const [dateTo, setDateTo] = useState(today());
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [dateOpen, setDateOpen] = useState(false);
  const [tipeOpen, setTipeOpen] = useState(false);
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const dropdownRef = useRef(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/cash-transactions/', { params: { arah: direction } });
      setRows(res.data.results || res.data || []);
    } catch (err) {
      notifyApiError(err, 'Gagal memuat data transaksi.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    apiClient.get('/accounting/accounts/').then((res) => {
      setAccounts(res.data.results || res.data || []);
    }).catch(() => setAccounts([]));
  }, [direction]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => rows.filter((row) => {
    const date = String(row.waktu || '').slice(0, 10);
    if (date && (date < dateFrom || date > dateTo)) return false;
    if (filterStatus !== 'All' && statusLabel[row.status] !== filterStatus) return false;
    return true;
  }), [rows, dateFrom, dateTo, filterStatus]);

  const selectedRows = rows.filter((row) => selectedIds.includes(row.id));
  const visibleIds = filtered.map((row) => row.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const toggleRow = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleAllVisible = () => setSelectedIds((current) => allVisibleSelected
    ? current.filter((id) => !visibleIds.includes(id))
    : [...new Set([...current, ...visibleIds])]);

  const handleAccountChange = async (row, field, accountId) => {
    setSavingRowId(row.id);
    try {
      await apiClient.patch(`/cash-transactions/${row.id}/`, { [field]: accountId || null });
      await reload();
    } catch (err) {
      notifyApiError(err, 'Gagal menyimpan akun.');
    } finally {
      setSavingRowId(null);
    }
  };

  const handlePost = async () => {
    const eligible = selectedRows.filter((row) => row.status === 'draft' && row.akun_debit && row.akun_kredit);
    const skipped = selectedIds.length - eligible.length;
    if (!eligible.length) {
      notify({ type: 'info', title: 'Tidak ada data yang dapat diproses', message: 'Pilih transaksi draft yang sudah punya Akun Debit & Kredit.' });
      return;
    }
    setActionLoading(true);
    const results = await Promise.allSettled(eligible.map((row) => apiClient.post(`/cash-transactions/${row.id}/post/`)));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.find((r) => r.status === 'rejected');
    if (successCount) notify({ type: 'success', title: 'Post berhasil', message: `${successCount} transaksi terposting.${skipped ? ` ${skipped} dilewati (belum ada Akun Debit/Kredit).` : ''}` });
    if (failed) notifyApiError(failed.reason, 'Gagal memposting sebagian transaksi.');
    setSelectedIds([]);
    await reload();
    setActionLoading(false);
  };

  const handleBatalPost = async () => {
    const eligible = selectedRows.filter((row) => row.status === 'selesai');
    if (!eligible.length) {
      notify({ type: 'info', title: 'Tidak ada data yang dapat diproses', message: 'Pilih transaksi yang sudah Terposting.' });
      return;
    }
    if (!window.confirm(`Batalkan ${eligible.length} transaksi terposting?`)) return;
    setActionLoading(true);
    const results = await Promise.allSettled(eligible.map((row) => apiClient.post(`/cash-transactions/${row.id}/cancel/`)));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.find((r) => r.status === 'rejected');
    if (successCount) notify({ type: 'success', title: 'Batal Post berhasil', message: `${successCount} transaksi dibatalkan (jurnal pembalik dibuat).` });
    if (failed) notifyApiError(failed.reason, 'Gagal membatalkan sebagian transaksi.');
    setSelectedIds([]);
    await reload();
    setActionLoading(false);
  };

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-emerald-900 text-xs">Data {title} dari Kas</p>
          <p className="text-emerald-700 text-[11px] font-medium leading-relaxed">
            Pilih Akun Debit &amp; Kredit per transaksi sebelum Post — jurnal diposting sesuai pasangan akun yang dipilih.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={() => setTipeOpen(true)}
          className="px-4 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 rounded-lg shadow-2xs font-extrabold text-[10px] cursor-pointer transition-colors"
        >
          Tipe Transaksi
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" onClick={() => setDateOpen(true)} className="px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer">
          {dateLabel} {dateFrom} - {dateTo}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={handleBatalPost} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">Batal Post</button>
          <button type="button" disabled={!selectedIds.length || actionLoading} onClick={handlePost} className="px-4 py-1.5 font-bold rounded-lg text-[10px] border transition-all cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 bg-[#0088E8] text-white border-[#0088E8] hover:bg-[#0077CC]">{actionLoading ? 'Memproses...' : 'Post'}</button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-visible">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5 w-10 text-center"><input type="checkbox" aria-label="Pilih semua" checked={allVisibleSelected} onChange={toggleAllVisible} className="accent-[#0088E8] cursor-pointer" /></th>
                <th className="px-5 py-3.5 w-[30%]">Transaksi</th>
                <th className="px-5 py-3.5 text-right">Jumlah</th>
                <th className="px-5 py-3.5 w-[20%]">Akun Debit</th>
                <th className="px-5 py-3.5 w-[20%]">Akun Kredit</th>
                <th className="px-5 py-3.5 text-center relative">
                  <button type="button" onClick={() => setActiveHeaderDropdown(activeHeaderDropdown === 'status' ? null : 'status')} className="inline-flex items-center gap-1 cursor-pointer">Status <ChevronDown size={11} /></button>
                  {activeHeaderDropdown === 'status' && (
                    <div ref={dropdownRef} className="absolute right-3 top-10 z-20 bg-white border border-slate-200 rounded-lg shadow-xl py-1.5 w-40 text-left animate-fade-in">
                      {['All', 'Terposting', 'Belum Terposting', 'Batal'].map((item) => (
                        <button type="button" key={item} onClick={() => { setFilterStatus(item); setActiveHeaderDropdown(null); }} className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 cursor-pointer ${filterStatus === item ? 'text-[#0088E8] bg-[#E6F4FF]/50 font-bold' : 'text-slate-700'}`}>{item}</button>
                      ))}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400"><Loader2 className="inline animate-spin" size={16} /> Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-bold">No Data</td></tr>
              ) : filtered.map((row) => {
                const isDraft = row.status === 'draft';
                return (
                  <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-center"><input type="checkbox" aria-label={`Pilih ${row.nomor}`} checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} className="accent-[#0088E8] cursor-pointer" /></td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-800">{row.nomor}</span>
                        <div className="text-[10px] text-slate-400 font-bold">{row.tipe_transaksi_nama || '-'} | {row.staff_nama || '-'}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">IDR {fmtRp(row.jumlah)}</td>
                    <td className="px-5 py-3.5">
                      <select
                        value={row.akun_debit || ''}
                        disabled={!isDraft || savingRowId === row.id}
                        onChange={(e) => handleAccountChange(row, 'akun_debit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:border-[#0088E8] text-[11px] font-medium text-slate-650 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Pilih akun</option>
                        {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.code} {acc.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={row.akun_kredit || ''}
                        disabled={!isDraft || savingRowId === row.id}
                        onChange={(e) => handleAccountChange(row, 'akun_kredit', e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white outline-none focus:border-[#0088E8] text-[11px] font-medium text-slate-650 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Pilih akun</option>
                        {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.code} {acc.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${statusBadgeClass(row.status)}`}>{statusLabel[row.status]}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <span>Menampilkan {filtered.length} dari {rows.length} transaksi</span>
          {selectedIds.length > 0 && <span className="text-[#0088E8]">{selectedIds.length} dipilih</span>}
        </div>
      </div>

      <ReturPenjualanDateModal
        isOpen={dateOpen}
        onClose={() => setDateOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={(res) => { setDateFrom(res.from); setDateTo(res.to); setDateLabel(res.label); }}
      />

      <TipeTransaksiModal isOpen={tipeOpen} onClose={() => setTipeOpen(false)} direction={direction} />
    </div>
  );
}
