import { useState, useEffect, useCallback, useMemo } from 'react';
import { FileBarChart2, Download, AlertTriangle } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const FILTER_OPTIONS = [
  { id: 'harian', label: 'Hari Ini' },
  { id: 'mingguan', label: 'Minggu Ini' },
  { id: 'bulanan', label: 'Bulan Ini' },
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function rentangMinggu(base) {
  const day = (base.getDay() + 6) % 7;
  const mulai = new Date(base);
  mulai.setDate(base.getDate() - day);
  const selesai = new Date(mulai);
  selesai.setDate(mulai.getDate() + 6);
  return [mulai, selesai];
}

function hitungRentang(mode) {
  const now = new Date();
  if (mode === 'harian') return [now, now];
  if (mode === 'mingguan') return rentangMinggu(now);
  if (mode === 'bulanan') {
    const mulai = new Date(now.getFullYear(), now.getMonth(), 1);
    const selesai = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [mulai, selesai];
  }
  return [now, now];
}

/**
 * Section "Laporan Produksi" di Dashboard Eksekutif -- Owner/Manager
 * memantau laporan target & kendala operasional yang dibuat SPV (lintas
 * divisi, tidak dibatasi), plus ekspor Excel. Instruksi user 2026-09-23.
 * Sumber data sama persis dengan LaporanProduksiSpvPanel.jsx (SPV) --
 * lihat api/views/laporan_produksi.py, angka aktual selalu dihitung ulang
 * dari JobBoard, bukan hasil ketik manual.
 */
export default function LaporanProduksiOwnerSection() {
  const [filterMode, setFilterMode] = useState('bulanan');
  const [range, setRange] = useState(() => hitungRentang('bulanan'));
  const [divisiList, setDivisiList] = useState([]);
  const [divisiFilter, setDivisiFilter] = useState('');
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [dariISO, sampaiISO] = useMemo(() => [toISODate(range[0]), toISODate(range[1])], [range]);

  const handleFilterChange = (mode) => {
    setFilterMode(mode);
    setRange(hitungRentang(mode));
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const params = { tanggal_dari: dariISO, tanggal_sampai: sampaiISO };
      if (divisiFilter) params.divisi = divisiFilter;
      const [resDivisi, resDaftar] = await Promise.all([
        apiClient.get('/divisi/'),
        apiClient.get('/laporan-produksi/target/', { params }),
      ]);
      setDivisiList(Array.isArray(resDivisi.data) ? resDivisi.data : resDivisi.data?.results || []);
      setDaftar(Array.isArray(resDaftar.data) ? resDaftar.data : resDaftar.data?.results || []);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat Laporan Produksi:', err);
      setError('Gagal memuat Laporan Produksi.');
    } finally {
      setLoading(false);
    }
  }, [dariISO, sampaiISO, divisiFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { tanggal_dari: dariISO, tanggal_sampai: sampaiISO };
      if (divisiFilter) params.divisi = divisiFilter;
      const res = await apiClient.get('/export/laporan-produksi/', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `laporan-produksi-${dariISO}_${sampaiISO}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal mengunduh ekspor.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <FileBarChart2 size={16} className="text-indigo-700" />
          <div>
            <h2 className="font-bold text-slate-900">Laporan Produksi</h2>
            <p className="text-xs text-slate-500">Target &amp; kendala operasional dari SPV, {dariISO} s/d {sampaiISO}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleFilterChange(opt.id)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                  filterMode === opt.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={divisiFilter}
            onChange={(e) => setDivisiFilter(e.target.value)}
            className="text-[11px] border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
          >
            <option value="">Semua Divisi</option>
            {divisiList.map((d) => (
              <option key={d.id} value={d.id}>{d.nama}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Download size={12} /> {exporting ? 'Menyiapkan…' : 'Ekspor'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 rounded-lg p-2 text-xs mb-3">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
              <th className="py-2 pr-2">Divisi</th>
              <th className="py-2 pr-2">Periode</th>
              <th className="py-2 pr-2 text-right">Target</th>
              <th className="py-2 pr-2 text-right">Aktual</th>
              <th className="py-2 pr-2 text-right">Capaian</th>
              <th className="py-2 pr-2">Kendala Operasional</th>
              <th className="py-2 pr-2">SPV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Memuat…</td></tr>
            ) : daftar.length === 0 ? (
              <tr><td colSpan={7} className="py-6 text-center text-slate-400">Belum ada laporan untuk periode ini.</td></tr>
            ) : (
              daftar.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-2 font-medium text-slate-800">{row.divisi_nama}</td>
                  <td className="py-2 pr-2 text-slate-600">{row.tanggal_mulai} s/d {row.tanggal_selesai}</td>
                  <td className="py-2 pr-2 text-right text-slate-700">{row.target_selesai}</td>
                  <td className="py-2 pr-2 text-right font-bold text-slate-900">{row.jumlah_selesai_aktual}</td>
                  <td className="py-2 pr-2 text-right">
                    {row.capaian_persen === null ? (
                      <span className="text-slate-400">-</span>
                    ) : (
                      <span className={`font-bold ${row.capaian_persen >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {row.capaian_persen}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 max-w-[260px] truncate text-slate-600" title={row.kendala_operasional}>
                    {row.kendala_operasional ? (
                      <span className="inline-flex items-center gap-1"><AlertTriangle size={11} className="text-amber-600 shrink-0" />{row.kendala_operasional}</span>
                    ) : '-'}
                  </td>
                  <td className="py-2 pr-2 text-slate-500">{row.dibuat_oleh_nama || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
