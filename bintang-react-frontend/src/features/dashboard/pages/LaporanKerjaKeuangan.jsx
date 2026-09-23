import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClipboardList, Download, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

const FILTER_OPTIONS = [
  { id: 'harian', label: 'Hari Ini' },
  { id: 'mingguan', label: 'Minggu Ini' },
  { id: 'bulanan', label: 'Bulan Ini' },
];

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

// Minggu dimulai Senin (konvensi Indonesia), bukan Minggu (default getDay()).
function rentangMinggu(base) {
  const day = (base.getDay() + 6) % 7; // Senin=0 ... Minggu=6
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
 * Laporan Kerja Harian Admin Finance & SPV Finance -- ringkasan data
 * keuangan NYATA (transaksi kas terverifikasi + pengadaan dibuat, lewat
 * /laporan-keuangan/ringkasan/) + form buat laporan target & kendala
 * operasional manual (/laporan-keuangan/target/). Instruksi user
 * 2026-09-24 -- pola sama dengan LaporanProduksiSpvPanel tapi lingkup
 * keuangan (tanpa divisi) dan palet warna netral/profesional (bukan grid
 * emerald/red/amber), sesuai permintaan user.
 *
 * Hierarki: Admin Finance cuma lihat & kelola laporannya sendiri. SPV
 * Finance melihat laporan sendiri + seluruh laporan Admin Finance
 * (pengawasan), tapi tidak bisa mengubah/menghapus milik orang lain --
 * tombol hapus disembunyikan untuk baris yang bukan miliknya sendiri.
 */
export default function LaporanKerjaKeuangan() {
  const { user } = useAuth();
  const [filterMode, setFilterMode] = useState('harian');
  const [range, setRange] = useState(() => hitungRentang('harian'));
  const [ringkasan, setRingkasan] = useState(null);
  const [daftar, setDaftar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [form, setForm] = useState({
    periode_tipe: 'harian', target_transaksi: '', kendala_operasional: '', catatan: '',
  });

  const handleFilterChange = (mode) => {
    setFilterMode(mode);
    setRange(hitungRentang(mode));
    setForm((f) => ({ ...f, periode_tipe: mode }));
  };

  const [dariISO, sampaiISO] = useMemo(() => [toISODate(range[0]), toISODate(range[1])], [range]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [resRingkasan, resDaftar] = await Promise.all([
        apiClient.get('/laporan-keuangan/ringkasan/', { params: { tanggal_dari: dariISO, tanggal_sampai: sampaiISO } }),
        apiClient.get('/laporan-keuangan/target/', { params: { tanggal_dari: dariISO, tanggal_sampai: sampaiISO } }),
      ]);
      setRingkasan(resRingkasan.data);
      setDaftar(Array.isArray(resDaftar.data) ? resDaftar.data : resDaftar.data?.results || []);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat Laporan Kerja Keuangan:', err);
      setError('Gagal memuat Laporan Kerja Keuangan.');
    } finally {
      setLoading(false);
    }
  }, [dariISO, sampaiISO]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/laporan-keuangan/target/', {
        periode_tipe: form.periode_tipe,
        tanggal_mulai: dariISO,
        tanggal_selesai: sampaiISO,
        target_transaksi: Number(form.target_transaksi) || 0,
        kendala_operasional: form.kendala_operasional,
        catatan: form.catatan,
      });
      setForm((f) => ({ ...f, target_transaksi: '', kendala_operasional: '', catatan: '' }));
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || Object.values(err.response?.data || {})[0] || 'Gagal menyimpan laporan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus laporan ini?')) return;
    try {
      await apiClient.delete(`/laporan-keuangan/target/${id}/`);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menghapus laporan.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiClient.get('/export/laporan-keuangan/', {
        params: { tanggal_dari: dariISO, tanggal_sampai: sampaiISO },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `laporan-kerja-keuangan-${dariISO}_${sampaiISO}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Gagal mengunduh ekspor.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-12 space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ClipboardList size={19} className="text-slate-500" />
          Laporan Kerja Harian
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Target &amp; kendala operasional kerja keuangan, dibandingkan dengan data transaksi kas dan pengadaan yang nyata.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">{dariISO} s/d {sampaiISO}</p>
          <div className="flex items-center gap-1.5">
            <div className="flex bg-slate-100 rounded-lg p-1">
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleFilterChange(opt.id)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors ${
                    filterMode === opt.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={fetchAll} className="p-1.5 text-slate-400 hover:text-slate-700" title="Segarkan">
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              <Download size={12} /> {exporting ? 'Menyiapkan…' : 'Ekspor'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 rounded-lg p-2 text-[11px]">{error}</div>}

        {/* Ringkasan data nyata -- netral, bukan grid warna-warni */}
        {ringkasan && (
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-slate-800">{ringkasan.jumlah_transaksi_diverifikasi}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Transaksi Diverifikasi</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-lg font-black text-slate-800">{ringkasan.jumlah_pengadaan_dibuat}</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Pengadaan Dibuat</p>
            </div>
          </div>
        )}

        {/* Form buat laporan target & kendala */}
        <form onSubmit={handleSubmit} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
          <p className="text-xs font-bold text-slate-700">Buat Laporan Target &amp; Kendala Operasional</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              required
              placeholder="Target transaksi/pengajuan diselesaikan"
              value={form.target_transaksi}
              onChange={(e) => setForm({ ...form, target_transaksi: e.target.value })}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="text-xs font-bold text-white bg-slate-800 rounded-lg px-3 py-1.5 hover:bg-slate-700 disabled:opacity-50"
            >
              {submitting ? 'Menyimpan…' : `Simpan untuk periode ${dariISO === sampaiISO ? dariISO : `${dariISO} s/d ${sampaiISO}`}`}
            </button>
          </div>
          <textarea
            rows={2}
            placeholder="Kendala operasional (opsional, mis. supplier terlambat konfirmasi, verifikasi tertunda)..."
            value={form.kendala_operasional}
            onChange={(e) => setForm({ ...form, kendala_operasional: e.target.value })}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
          />
          <textarea
            rows={2}
            placeholder="Catatan tambahan (opsional)..."
            value={form.catatan}
            onChange={(e) => setForm({ ...form, catatan: e.target.value })}
            className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
          />
        </form>

        {/* Daftar laporan */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase">
                <th className="py-2 pr-2">Periode</th>
                <th className="py-2 pr-2 text-right">Target</th>
                <th className="py-2 pr-2 text-right">Aktual</th>
                <th className="py-2 pr-2 text-right">Capaian</th>
                <th className="py-2 pr-2">Kendala</th>
                <th className="py-2 pr-2">Dibuat Oleh</th>
                <th className="py-2 pr-2 text-right">Aksi</th>
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
                    <td className="py-2 pr-2 text-slate-600">{row.tanggal_mulai} s/d {row.tanggal_selesai}</td>
                    <td className="py-2 pr-2 text-right text-slate-700">{row.target_transaksi}</td>
                    <td className="py-2 pr-2 text-right font-bold text-slate-900">{row.jumlah_transaksi_aktual}</td>
                    <td className="py-2 pr-2 text-right">
                      {row.capaian_persen === null ? (
                        <span className="text-slate-400">-</span>
                      ) : (
                        <span className={`font-bold ${row.capaian_persen >= 100 ? 'text-slate-800' : 'text-amber-600'}`}>
                          {row.capaian_persen}%
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 max-w-[220px] truncate text-slate-600" title={row.kendala_operasional}>
                      {row.kendala_operasional ? (
                        <span className="inline-flex items-center gap-1"><AlertTriangle size={11} className="text-amber-600 shrink-0" />{row.kendala_operasional}</span>
                      ) : '-'}
                    </td>
                    <td className="py-2 pr-2 text-slate-500">{row.dibuat_oleh_nama || '-'}</td>
                    <td className="py-2 pr-2 text-right">
                      {row.dibuat_oleh === user?.id && (
                        <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700" title="Hapus">
                          <Trash2 size={13} />
                        </button>
                      )}
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
