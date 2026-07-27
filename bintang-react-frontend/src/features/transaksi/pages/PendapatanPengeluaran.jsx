import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Minus,
  Plus,
  UploadCloud,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
  Trash2,
} from 'lucide-react';
import { Dropdown, DateRangePicker, TButton } from '../components/TransactionScaffold';
import { useTransaksiCrumb } from '../components/TransaksiContext';
import { useAuth } from '../../../context/AuthContext';
import TambahTransaksiModal from '../components/TambahTransaksiModal';
import TambahTipeTransaksiForm from '../components/TambahTipeTransaksiForm';
import ImportTipeTransaksiModal from '../components/ImportTipeTransaksiModal';
import apiClient from '../../../api/apiClient';

const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');

const tipeBadge = (tipe) => (
  <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${
    tipe === 'pendapatan'
      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
      : 'bg-rose-50 text-rose-600 border-rose-100'
  }`}>
    {tipe === 'pendapatan' ? 'Pendapatan' : 'Pengeluaran'}
  </span>
);

/** Tabel sederhana dengan dukungan render kolom + baris "No Data". */
function SimpleTable({ columns, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((c) => (
              <th key={c.key} className="px-4 py-3.5 text-left font-semibold text-slate-600 whitespace-nowrap">
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.sortable !== false && <ChevronsUpDown size={13} className="text-slate-400" />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-slate-400">No Data</td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id || i} className="border-b border-slate-100 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function MiniPagination({ page, totalPages, onPage }) {
  return (
    <div className="flex items-center gap-5 px-1 py-4 text-sm text-slate-500">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-slate-600 font-semibold">{page} / {totalPages}</span>
        <button
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

const inDateRange = (waktu, filter) => {
  if (!filter || filter.preset === 'all' || !filter.start || !filter.end) return true;
  const d = new Date(waktu);
  if (isNaN(d.getTime())) return true;
  const s = new Date(filter.start); s.setHours(0, 0, 0, 0);
  const e = new Date(filter.end); e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
};

export default function PendapatanPengeluaran() {
  const { user } = useAuth();
  const { setSubtitle } = useTransaksiCrumb();
  const [activeTab, setActiveTab] = useState('transaksi');
  const [modal, setModal] = useState(null); // null | 'pengeluaran' | 'pendapatan'

  const [transaksiData, setTransaksiData] = useState([]);
  const [tipeData, setTipeData] = useState([]);

  // Toolbar tab "Transaksi"
  const [rowsPerPage, setRowsPerPage] = useState('10 Baris');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState({ preset: 'all', start: null, end: null });

  // Tab "Tipe Transaksi"
  const [tipeView, setTipeView] = useState('list');
  const [tipeRows, setTipeRows] = useState('10 Baris');
  const [tipeSearch, setTipeSearch] = useState('');
  const [tipePage, setTipePage] = useState(1);
  const [showImportTipe, setShowImportTipe] = useState(false);

  const fetchTransaksi = useCallback(async () => {
    try {
      const res = await apiClient.get('/cash-transactions/');
      setTransaksiData(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchTipe = useCallback(async () => {
    try {
      const res = await apiClient.get('/cash-transaction-types/');
      setTipeData(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => { fetchTransaksi(); fetchTipe(); }, [fetchTransaksi, fetchTipe]);

  useEffect(() => {
    if (activeTab === 'tipe') {
      setSubtitle(tipeView === 'create' ? 'Buat Tipe Transaksi' : 'Tipe Transaksi');
    } else {
      setSubtitle('Transaksi');
    }
  }, [activeTab, tipeView, setSubtitle]);

  // --- handlers ---
  const handleSaveTransaksi = async ({ tipe_transaksi, staff, jumlah, waktu, catatan, files }) => {
    try {
      const fd = new FormData();
      fd.append('tipe_transaksi', tipe_transaksi);
      fd.append('staff', staff);
      fd.append('jumlah', jumlah);
      fd.append('waktu', waktu);
      fd.append('catatan', catatan || '');
      (files || []).forEach((f) => fd.append('lampiran', f));
      await apiClient.post('/cash-transactions/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setModal(null);
      fetchTransaksi();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan transaksi.');
    }
  };

  const handleDeleteTransaksi = async (id) => {
    if (!window.confirm('Hapus transaksi ini?')) return;
    try {
      await apiClient.delete(`/cash-transactions/${id}/`);
      fetchTransaksi();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus transaksi.');
    }
  };

  const handleSaveTipe = async ({ nama, tipe }) => {
    try {
      await apiClient.post('/cash-transaction-types/', { nama, tipe: tipe.toLowerCase() });
      setTipeView('list');
      fetchTipe();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyimpan tipe transaksi.');
    }
  };

  const handleDeleteTipe = async (id) => {
    if (!window.confirm('Hapus tipe transaksi ini?')) return;
    try {
      await apiClient.delete(`/cash-transaction-types/${id}/`);
      fetchTipe();
    } catch (err) {
      alert(err.response?.data?.error || 'Tipe tidak bisa dihapus (mungkin sudah dipakai transaksi).');
    }
  };

  const handleImportTipe = async (files) => {
    if (!files?.length) return;
    try {
      const fd = new FormData();
      fd.append('file', files[0]);
      const res = await apiClient.post('/cash-transaction-types/import-csv/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowImportTipe(false);
      fetchTipe();
      const errs = res.data?.errors || [];
      if (errs.length) alert(`Import selesai dengan catatan:\n${errs.join('\n')}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memproses import.');
    }
  };

  const toISODate = (d) => {
    const dt = new Date(d);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    return dt.toISOString().slice(0, 10);
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (dateFilter?.preset !== 'all' && dateFilter?.start && dateFilter?.end) {
        params.append('start', toISODate(dateFilter.start));
        params.append('end', toISODate(dateFilter.end));
      }
      const res = await apiClient.get(`/export/cash-transactions/?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pendapatan-pengeluaran-${toISODate(new Date())}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal mengunduh file Excel.');
    }
  };

  const handleDownloadTemplate = () => {
    const csv = 'Name,Type\nListrik Toko,Pengeluaran\nTips,Pendapatan\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template-tipe-transaksi.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- columns ---
  const transaksiColumns = useMemo(() => [
    { key: 'no', label: 'No. Transaksi', render: (r) => <span className="font-mono font-bold text-slate-800">{r.nomor}</span> },
    { key: 'tanggal', label: 'Tanggal', render: (r) => fmtDate(r.waktu) },
    { key: 'staff', label: 'Staff', render: (r) => r.staff_nama || '-' },
    { key: 'waktu', label: 'Waktu', render: (r) => fmtTime(r.waktu) },
    {
      key: 'jumlah', label: 'Jumlah',
      render: (r) => (
        <span className={`font-bold font-mono ${r.arah === 'pendapatan' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {r.arah === 'pendapatan' ? '+' : '-'} {fmtRp(r.jumlah)}
        </span>
      ),
    },
    { key: 'catatan', label: 'Catatan', render: (r) => <span className="text-slate-500">{r.catatan || '-'}</span> },
    { key: 'tipe', label: 'Tipe Transaksi', render: (r) => <span className="inline-flex items-center gap-2">{r.tipe_transaksi_nama} {tipeBadge(r.arah)}</span> },
    {
      key: 'aksi', label: 'Aksi', sortable: false,
      render: (r) => (
        <button onClick={() => handleDeleteTransaksi(r.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer">
          <Trash2 size={14} />
        </button>
      ),
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  const tipeColumns = useMemo(() => [
    { key: 'nama', label: 'Nama', render: (r) => <span className="font-semibold text-slate-700">{r.nama}</span> },
    { key: 'tipe', label: 'Tipe Transaksi', render: (r) => tipeBadge(r.tipe) },
    {
      key: 'aksi', label: 'Aksi', sortable: false,
      render: (r) => (
        <button onClick={() => handleDeleteTipe(r.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded-full cursor-pointer">
          <Trash2 size={14} />
        </button>
      ),
    },
  ], []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- filtering + pagination ---
  const filteredTransaksi = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transaksiData.filter((r) => {
      if (!inDateRange(r.waktu, dateFilter)) return false;
      if (!q) return true;
      return `${r.nomor} ${r.staff_nama || ''} ${r.tipe_transaksi_nama || ''} ${r.catatan || ''}`.toLowerCase().includes(q);
    });
  }, [transaksiData, search, dateFilter]);

  const filteredTipe = useMemo(() => {
    const q = tipeSearch.trim().toLowerCase();
    return tipeData.filter((r) => (!q ? true : `${r.nama} ${r.tipe}`.toLowerCase().includes(q)));
  }, [tipeData, tipeSearch]);

  const txLimit = parseInt(rowsPerPage) || 10;
  const txTotalPages = Math.max(1, Math.ceil(filteredTransaksi.length / txLimit));
  const txPageRows = filteredTransaksi.slice((page - 1) * txLimit, page * txLimit);

  const tipeLimit = parseInt(tipeRows) || 10;
  const tipeTotalPages = Math.max(1, Math.ceil(filteredTipe.length / tipeLimit));
  const tipePageRows = filteredTipe.slice((tipePage - 1) * tipeLimit, tipePage * tipeLimit);

  const tabs = [
    { id: 'transaksi', label: 'Transaksi' },
    { id: 'tipe', label: 'Tipe Transaksi' },
  ];

  if (activeTab === 'tipe' && tipeView === 'create') {
    return (
      <div className="flex flex-col flex-1 bg-white p-6">
        <TambahTipeTransaksiForm onCancel={() => setTipeView('list')} onSave={handleSaveTipe} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-semibold whitespace-nowrap text-center transition-colors cursor-pointer ${
                isActive ? 'text-blue-600 bg-blue-50/70' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/40'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'transaksi' ? (
        <div className="flex flex-col flex-1 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-slate-800 font-bold text-[15px]">Transaksi</h2>
              <p className="text-slate-400 text-xs mt-0.5">{filteredTransaksi.length} Transaksi</p>
            </div>
            <div className="flex items-center gap-2">
              <TButton variant="danger" onClick={() => setModal('pengeluaran')}>
                <Minus size={16} /> Pengeluaran
              </TButton>
              <TButton variant="success" onClick={() => setModal('pendapatan')}>
                <Plus size={16} /> Pendapatan
              </TButton>
              <TButton variant="primary" onClick={handleExportExcel}>
                <FileSpreadsheet size={16} /> Export Excel
              </TButton>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 py-4">
            <Dropdown
              options={['10 Baris', '25 Baris', '50 Baris', '100 Baris']}
              value={rowsPerPage}
              onChange={(v) => { setRowsPerPage(v); setPage(1); }}
              minW="min-w-[120px]"
            />
            <div className="flex items-center gap-3">
              <label className="w-56 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Cari"
                  className="bg-transparent outline-none w-full placeholder:text-slate-400"
                />
              </label>
              <DateRangePicker value={dateFilter} onChange={(v) => { setDateFilter(v); setPage(1); }} />
            </div>
          </div>

          <SimpleTable columns={transaksiColumns} rows={txPageRows} />
          <MiniPagination page={page} totalPages={txTotalPages} onPage={setPage} />
        </div>
      ) : (
        <div className="flex flex-col flex-1 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-slate-800 font-bold text-[15px]">Tipe Transaksi</h2>
              <p className="text-slate-400 text-xs mt-0.5">{filteredTipe.length} Tipe</p>
            </div>
            <div className="flex items-center gap-2">
              <TButton variant="primary" onClick={() => setShowImportTipe(true)}>
                <UploadCloud size={16} /> Import
              </TButton>
              <TButton variant="primary" onClick={() => setTipeView('create')}>
                <Plus size={16} /> Tambah
              </TButton>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 py-4">
            <Dropdown
              options={['10 Baris', '25 Baris', '50 Baris', '100 Baris']}
              value={tipeRows}
              onChange={(v) => { setTipeRows(v); setTipePage(1); }}
              minW="min-w-[120px]"
            />
            <label className="w-56 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
              <Search size={16} className="text-slate-400" />
              <input
                value={tipeSearch}
                onChange={(e) => { setTipeSearch(e.target.value); setTipePage(1); }}
                placeholder="Cari"
                className="bg-transparent outline-none w-full placeholder:text-slate-400"
              />
            </label>
          </div>

          <SimpleTable columns={tipeColumns} rows={tipePageRows} />
          <MiniPagination page={tipePage} totalPages={tipeTotalPages} onPage={setTipePage} />
        </div>
      )}

      {modal && (
        <TambahTransaksiModal
          mode={modal}
          currentUserId={user?.id || ''}
          onClose={() => setModal(null)}
          onSave={handleSaveTransaksi}
        />
      )}
      {showImportTipe && (
        <ImportTipeTransaksiModal
          onClose={() => setShowImportTipe(false)}
          onProcess={handleImportTipe}
          onDownloadTemplate={handleDownloadTemplate}
        />
      )}
    </div>
  );
}
