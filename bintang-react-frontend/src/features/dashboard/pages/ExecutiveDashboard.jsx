import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Download, Info, RefreshCw, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { BarTerlaris, SERIES, STATUS, StokBar, TrenChart, rupiah } from '../components/ExecutiveCharts';

/**
 * Dashboard eksekutif — ringkasan lintas periode untuk owner/manager.
 *
 * Semua angka di sini berasal dari data nyata. Metrik yang butuh buku besar
 * (laba bersih, kas, rasio lancar) sengaja tidak ditampilkan sebagai angka,
 * melainkan didaftar di panel "Belum tersedia" beserta alasannya — lihat
 * api/executive_dashboard.py.
 */

const PERIODE = [
  { id: 'mtd', label: 'Bulan ini' },
  { id: 'qtd', label: 'Kuartal ini' },
  { id: 'ytd', label: 'Tahun ini' },
  { id: '12m', label: '12 bulan' },
];

const money = rupiah;
const angka = (v) => new Intl.NumberFormat('id-ID').format(Number(v) || 0);

function Delta({ value }) {
  // null = tidak ada periode pembanding. Menampilkan "0%" akan menyesatkan.
  if (value === null || value === undefined) {
    return <span className="text-xs text-slate-400">Tanpa pembanding</span>;
  }
  const naik = value >= 0;
  const Icon = naik ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${naik ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon size={13} />{naik ? '+' : ''}{value}%
    </span>
  );
}

function KpiCard({ item }) {
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">
        {item.format === 'angka' ? angka(item.value) : money(item.value)}
      </p>
      <div className="mt-2"><Delta value={item.delta} /></div>
    </article>
  );
}

/** Legenda — kanal identitas yang tidak boleh bergantung pada warna saja. */
function Legend({ adaRugi }) {
  return (
    <div className="flex items-center gap-4">
      {Object.values(SERIES).map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
          <span style={{ background: s.color, width: 12, height: 12, borderRadius: 3 }} />
          {s.label}
        </span>
      ))}
      {/* Hanya muncul bila ada bulan rugi — warna status selalu berteks. */}
      {adaRugi && (
        <span className="flex items-center gap-1.5 text-xs text-slate-600">
          <span style={{ background: STATUS.critical.color, width: 12, height: 12, borderRadius: 3 }} />
          Biaya melebihi omzet
        </span>
      )}
    </div>
  );
}

function TabelTren({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Tren bulanan pendapatan, HPP, dan laba kotor</caption>
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th scope="col" className="py-2 text-left font-semibold">Periode</th>
            <th scope="col" className="py-2 text-right font-semibold">Pendapatan</th>
            <th scope="col" className="py-2 text-right font-semibold">HPP</th>
            <th scope="col" className="py-2 text-right font-semibold">Laba Kotor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.periode} className="border-b border-slate-50">
              <td className="py-2 font-semibold text-slate-800">{r.periode}</td>
              <td className="py-2 text-right text-slate-600">{money(r.pendapatan)}</td>
              <td className="py-2 text-right text-slate-600">{money(r.hpp)}</td>
              <td className="py-2 text-right font-bold text-slate-900">{money(r.laba_kotor)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="4" className="py-8 text-center text-slate-500">Belum ada data.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const [period, setPeriod] = useState('ytd');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [tabel, setTabel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.get('/executive-dashboard/', { params: { period } });
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 403
        ? 'Dashboard ini hanya untuk owner dan manager.'
        : (err.response?.data?.error || 'Gagal memuat dashboard.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiClient.get('/executive-dashboard/export/', {
        params: { period }, responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `dashboard-eksekutif-${period}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Gagal mengunduh ekspor.');
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return <div className="max-w-7xl mx-auto px-4 py-10"><div className="bg-rose-50 text-rose-700 rounded-xl p-4 text-sm">{error}</div></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4 pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Dashboard Eksekutif</h1>
          <p className="text-xs text-slate-500 mt-1">
            {data.periode.label} · dibanding {data.periode.pembanding}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {PERIODE.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  period === p.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Segarkan
          </button>
          <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-slate-300">
            <Download size={14} /> {exporting ? 'Menyiapkan…' : 'Ekspor XLSX'}
          </button>
        </div>
      </header>

      {error && <div className="bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">{error}</div>}

      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {data.kpi.map((item) => <KpiCard key={item.key} item={item} />)}
      </section>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900">Tren Bulanan</h2>
              <p className="text-xs text-slate-500">HPP dan laba kotor menyusun total pendapatan</p>
            </div>
            <div className="flex items-center gap-4">
              <Legend adaRugi={data.tren.some((r) => r.laba_kotor < 0)} />
              <button
                type="button"
                onClick={() => setTabel((v) => !v)}
                aria-pressed={tabel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <Table2 size={13} /> {tabel ? 'Grafik' : 'Tabel'}
              </button>
            </div>
          </div>
          {tabel ? <TabelTren rows={data.tren} /> : <TrenChart rows={data.tren} />}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-4">Kesehatan Stok</h2>
          <StokBar stok={data.stok} />
          {data.stok.habis > 0 && (
            <div className="mt-4 flex gap-2 bg-rose-50 text-rose-700 rounded-lg p-3 text-xs">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{data.stok.habis} produk habis stok dan {data.stok.menipis} di bawah stok minimum.</span>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Produk Terlaris</h2>
          <p className="text-xs text-slate-500 mb-4">Berdasarkan nilai penjualan POS</p>
          <BarTerlaris rows={data.produk_terlaris} />
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 mb-2">Produksi</h2>
          <p className="text-sm text-slate-600">
            <strong className="text-slate-900">{angka(data.produksi.selesai)}</strong> dari {angka(data.produksi.total)} dokumen selesai
          </p>

          <h2 className="font-bold text-slate-900 mt-6 mb-2 flex items-center gap-1.5">
            <Info size={15} className="text-slate-400" /> Belum tersedia
          </h2>
          <ul className="space-y-2 text-xs text-slate-500">
            {data.unavailable.map((u) => (
              <li key={u.label}>
                <strong className="text-slate-700">{u.label}</strong> — {u.reason}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
