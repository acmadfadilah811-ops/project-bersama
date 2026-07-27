import { useState, useEffect } from 'react';
import { Plus, ChevronsUpDown } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { fmtDate, fmtDiskon } from '../format';
import TambahKuponForm from './TambahKuponForm';
import DetailKuponDiskon from './DetailKuponDiskon';

/** Tab "Kupon Diskon". */
export default function KuponDiskonTab() {
  const [view, setView] = useState('list');
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/discount-coupons/');
      setRows(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[VoucherDiskon] fetch coupons error:', err);
      setError('Gagal memuat daftar kupon diskon.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  if (view === 'detail') {
    return (
      <DetailKuponDiskon
        row={selected}
        onCancel={() => {
          setView('list');
          setSelected(null);
        }}
        onEdit={(row) => {
          setEditing(row);
          setView('edit');
        }}
        onSaved={fetchRows}
      />
    );
  }

  if (view === 'create' || view === 'edit') {
    return (
      <TambahKuponForm
        initial={editing}
        onCancel={() => {
          setView('list');
          setEditing(null);
        }}
        onSaved={() => {
          setView('list');
          setEditing(null);
          fetchRows();
        }}
      />
    );
  }

  const cols = [
    { key: 'kode', label: 'Kode' },
    { key: 'judul', label: 'Judul' },
    { key: null, label: 'Diskon' },
    { key: 'tanggal_aktif', label: 'Mulai' },
    { key: null, label: 'Berakhir' },
    { key: null, label: 'Kadaluarsa' },
    { key: null, label: 'Penggunaan' },
  ];

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const va = String(a[sortKey] || '');
        const vb = String(b[sortKey] || '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      })
    : rows;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-slate-50">
        <div>
          <h2 className="text-slate-800 font-extrabold text-base">Daftar Kupon Diskon</h2>
          <p className="text-slate-400 text-xs mt-0.5 font-medium">{rows.length} Item</p>
        </div>
        <button
          type="button"
          onClick={() => setView('create')}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-bold text-white rounded-xl px-4.5 py-2.5 cursor-pointer transition-all active:scale-[0.98] shadow-md shadow-blue-500/10"
        >
          <Plus size={14} /> Tambah
        </button>
      </div>

      {error && <p className="px-6 pt-3 text-xs text-rose-600 font-semibold">{error}</p>}

      <div className="px-6 py-4 overflow-x-auto">
        <div className="border border-slate-100 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {cols.map((c) => (
                  <th
                    key={c.label}
                    onClick={() => c.key && (setSortKey(c.key), setSortDir((d) => (sortKey === c.key && d === 'asc' ? 'desc' : 'asc')))}
                    className={`px-4 py-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase whitespace-nowrap ${c.key ? 'cursor-pointer select-none' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.key && <ChevronsUpDown size={12} className={sortKey === c.key ? 'text-blue-500' : 'text-slate-300'} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-bold text-slate-400">{loading ? 'Memuat...' : 'No Data'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => {
                      setSelected(row);
                      setView('detail');
                    }}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 text-sm font-bold text-blue-600 whitespace-nowrap">{row.kode}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{row.judul}</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-slate-800">{fmtDiskon(row)}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{fmtDate(row.tanggal_aktif)}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{row.tanpa_kadaluarsa ? '-' : fmtDate(row.tanggal_kadaluarsa)}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500">{row.tanpa_kadaluarsa ? 'Tanpa Kadaluarsa' : 'Ya'}</td>
                    <td className="px-4 py-3.5 text-sm font-medium text-slate-500">
                      {row.unlimited_usage ? `${row.penggunaan_count} (Tidak Terbatas)` : `${row.penggunaan_count} / ${row.batas_penggunaan ?? '-'}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
