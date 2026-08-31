import { useCallback, useEffect, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import ExecutiveNav from '../components/ExecutiveNav';
import { AbcList, ChannelCompare, MarginList, ProdukTable, StokKategoriTable } from '../components/AiAnalystCharts';

const PERIODE = [
  { id: 'mtd', label: 'Bulan ini' },
  { id: 'qtd', label: 'Kuartal ini' },
  { id: 'ytd', label: 'Tahun ini' },
  { id: '12m', label: '12 bulan' },
];

/** Urutan tab domain analisis — kunci HARUS cocok dengan `modul` di respons backend. */
const DOMAIN = [
  { key: 'penjualan_produk', label: 'Penjualan & Produk' },
  { key: 'profitabilitas', label: 'Profitabilitas' },
  { key: 'stok', label: 'Stok' },
  { key: 'pelanggan', label: 'Pelanggan' },
  { key: 'keuangan', label: 'Keuangan' },
  { key: 'produksi', label: 'Produksi' },
  { key: 'anomali', label: 'Anomali' },
  { key: 'resep_bom', label: 'Resep & Bahan' },
  { key: 'varian', label: 'Varian Produk' },
  { key: 'tingkatan_harga', label: 'Tingkatan Harga' },
];

/** Placeholder jujur untuk domain yang belum dibangun — tidak pernah mengarang data. */
function BelumTersedia({ alasan }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-600">
      <Info size={18} className="shrink-0 mt-0.5 text-slate-400" />
      <div>
        <p className="font-bold text-slate-800">Modul ini belum dibangun</p>
        <p className="mt-1">{alasan}</p>
      </div>
    </div>
  );
}

function PenjualanProduk({ data }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">Analisis ABC/Pareto per Kategori</h3>
          <p className="text-xs text-slate-500 mb-4">Kelas A = kontributor omzet 80% pertama, B = s/d 95%, C = sisanya</p>
          <AbcList rows={data.abc_kategori} />
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4">Kanal Penjualan</h3>
          <ChannelCompare channel={data.channel} />
        </section>
      </div>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">Produk Terlaris</h3>
          <p className="text-xs text-slate-500 mb-3">Top 20 berdasarkan nilai penjualan POS</p>
          <ProdukTable rows={data.top_produk} kosongTeks="Belum ada penjualan POS pada periode ini." />
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-900">Produk Paling Lemah</h3>
          <p className="text-xs text-slate-500 mb-3">Terendah di antara produk yang TERJUAL pada periode ini — bukan yang tidak pernah laku (lihat tab Stok)</p>
          <ProdukTable rows={data.bottom_produk} kosongTeks="Belum ada penjualan POS pada periode ini." />
        </section>
      </div>
      <p className="text-xs text-slate-400 italic">{data.catatan}</p>
    </div>
  );
}

function Profitabilitas({ data }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">Margin Kotor per Kategori</h3>
      <p className="text-xs text-slate-500 mb-4">Pendapatan dikurangi HPP nyata (FIFO), bukan taksiran persentase tetap</p>
      <MarginList rows={data.margin_kategori} />
    </section>
  );
}

function Stok({ data }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">Kesehatan Stok per Kategori</h3>
      <p className="text-xs text-slate-500 mb-4">
        "Lambat" = ada stok tapi tidak ada penjualan dalam {data.ambang_hari_lambat} hari terakhir (termasuk yang belum pernah terjual)
      </p>
      <StokKategoriTable rows={data.kategori} ambangHari={data.ambang_hari_lambat} />
    </section>
  );
}

export default function AiBusinessAnalyst() {
  const [period, setPeriod] = useState('ytd');
  const [tab, setTab] = useState('penjualan_produk');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.get('/ai-business-analyst/', { params: { period } });
      setData(res.data);
    } catch (err) {
      setError(err.response?.status === 403
        ? 'Halaman ini hanya untuk owner dan manager.'
        : (err.response?.data?.error || 'Gagal memuat AI Business Analyst.'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6 w-full max-w-7xl mx-auto px-4 pb-10">
        <ExecutiveNav />
        <div className="flex h-[60vh] items-center justify-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-6 w-full max-w-7xl mx-auto px-4 pb-10">
        <ExecutiveNav />
        <div className="bg-rose-50 text-rose-700 rounded-xl p-4 text-sm">{error}</div>
      </div>
    );
  }

  const modul = data.modul[tab];

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-4 pb-10">
      <ExecutiveNav />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">AI Business Analyst</h1>
          <p className="text-xs text-slate-500 mt-1">{data.periode.label}</p>
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
        </div>
      </header>

      {error && <div className="bg-rose-50 text-rose-700 rounded-xl p-3 text-sm">{error}</div>}

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
        {DOMAIN.map((d) => {
          const tersedia = data.modul[d.key]?.tersedia !== false;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setTab(d.key)}
              className={`shrink-0 px-3 py-2 text-xs font-bold border-b-2 transition-colors ${
                tab === d.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {d.label}
              {!tersedia && <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-slate-300" title="Belum tersedia" />}
            </button>
          );
        })}
      </div>

      <div>
        {!modul.tersedia && <BelumTersedia alasan={modul.alasan} />}
        {modul.tersedia && tab === 'penjualan_produk' && <PenjualanProduk data={modul} />}
        {modul.tersedia && tab === 'profitabilitas' && <Profitabilitas data={modul} />}
        {modul.tersedia && tab === 'stok' && <Stok data={modul} />}
      </div>
    </div>
  );
}
