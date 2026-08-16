import { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  TrendingUp,
  RefreshCw,
  Calendar,
  Receipt,
  Coins,
  Menu,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Rekap Harian Kasir — tab Pemasukan & Pengeluaran.
 * Sumber data: /pos/sales/rekap-harian/?tanggal=YYYY-MM-DD
 * Menggabungkan penjualan POS (per metode bayar) + Pendapatan/Pengeluaran lain
 * (CashTransaction). Angka modal/HPP dihitung server dari satuan DASAR, jadi
 * aman untuk item yang memakai UOM maupun stok FIFO.
 */
export default function PosRekapHarian({ onToggleSidebar }) {
  const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD lokal
  const [tanggal, setTanggal] = useState(todayStr);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRekap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/pos/sales/rekap-harian/', { params: { tanggal } });
      setData(res.data);
    } catch (err) {
      console.error('Error fetching rekap harian:', err);
      setError(err.response?.data?.error || 'Gagal memuat rekap harian.');
    } finally {
      setLoading(false);
    }
  }, [tanggal]);

  useEffect(() => {
    fetchRekap();
  }, [fetchRekap]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
      .format(Number(val || 0));

  const fmtJam = (v) =>
    v ? new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

  const r = data?.ringkasan || {};
  const penjualanPerMetode = data?.penjualan_per_metode || [];
  const pendapatanLain = data?.pendapatan_lain || [];
  const pengeluaran = data?.pengeluaran || [];

  const cards = [
    {
      icon: ArrowDownCircle, warna: 'emerald', label: 'Total Pemasukan',
      nilai: formatCurrency(r.total_pemasukan),
    },
    {
      icon: ArrowUpCircle, warna: 'rose', label: 'Total Pengeluaran',
      nilai: formatCurrency(r.total_pengeluaran),
    },
    {
      icon: Wallet, warna: Number(r.arus_kas_bersih || 0) < 0 ? 'rose' : 'indigo',
      label: 'Arus Kas Bersih', nilai: formatCurrency(r.arus_kas_bersih),
    },
    {
      icon: TrendingUp, warna: 'purple', label: 'Laba Kotor (Penjualan - Modal)',
      nilai: formatCurrency(r.laba_kotor),
    },
  ];

  const warnaKelas = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer -ml-1"
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h4 className="font-extrabold text-slate-800 text-lg">Rekap Harian</h4>
            <p className="text-xs text-slate-500 font-semibold font-mono uppercase tracking-wider">
              Pemasukan &amp; Pengeluaran Kas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={tanggal}
              max={todayStr()}
              onChange={(e) => setTanggal(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
            />
          </div>
          <button
            onClick={fetchRekap}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors border border-slate-200 cursor-pointer"
            title="Muat ulang"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="py-16 text-center">
          <p className="text-xs text-rose-500 font-bold">{error}</p>
        </div>
      ) : (
        <>
          {/* Kartu statistik */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                  <div className={`${warnaKelas[c.warna]} p-3 rounded-2xl shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{c.label}</span>
                    <h5 className="font-extrabold text-slate-800 text-base mt-0.5 truncate">
                      {loading ? '…' : c.nilai}
                    </h5>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Baris info penjualan */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Receipt size={15} className="text-slate-400" />
              <span className="text-slate-500 font-semibold">Jumlah Transaksi:</span>
              <span className="font-black text-slate-800">{loading ? '…' : (r.jumlah_transaksi ?? 0)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Coins size={15} className="text-slate-400" />
              <span className="text-slate-500 font-semibold">Total Penjualan:</span>
              <span className="font-black text-slate-800">{formatCurrency(r.total_penjualan)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Modal (HPP):</span>
              <span className="font-black text-slate-800">{formatCurrency(r.total_modal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── Pemasukan ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex items-center gap-2">
                <ArrowDownCircle size={16} className="text-emerald-600" />
                <h5 className="font-extrabold text-slate-800 text-sm">Pemasukan</h5>
              </div>
              <div className="divide-y divide-slate-100">
                {/* Penjualan per metode */}
                <div className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  Penjualan POS
                </div>
                {penjualanPerMetode.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400">Belum ada penjualan.</div>
                ) : (
                  penjualanPerMetode.map((m) => (
                    <div key={m.metode} className="px-4 py-3 flex justify-between items-center text-xs">
                      <span className="font-semibold text-slate-600">{m.metode}</span>
                      <span className="font-black text-emerald-600">{formatCurrency(m.jumlah)}</span>
                    </div>
                  ))
                )}
                {/* Pendapatan lain */}
                <div className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  Pendapatan Lain
                </div>
                {pendapatanLain.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-400">Tidak ada pendapatan lain.</div>
                ) : (
                  pendapatanLain.map((t) => (
                    <div key={t.id} className="px-4 py-3 flex justify-between items-center text-xs gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-700 truncate">{t.tipe}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t.nomor} · {fmtJam(t.waktu)}{t.catatan ? ` · ${t.catatan}` : ''}
                        </div>
                      </div>
                      <span className="font-black text-emerald-600 shrink-0">{formatCurrency(t.jumlah)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Pengeluaran ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-rose-50/50 flex items-center gap-2">
                <ArrowUpCircle size={16} className="text-rose-600" />
                <h5 className="font-extrabold text-slate-800 text-sm">Pengeluaran</h5>
              </div>
              <div className="divide-y divide-slate-100">
                {pengeluaran.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-slate-400">
                    Tidak ada pengeluaran pada tanggal ini.
                  </div>
                ) : (
                  pengeluaran.map((t) => (
                    <div key={t.id} className="px-4 py-3 flex justify-between items-center text-xs gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-700 truncate">{t.tipe}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t.nomor} · {fmtJam(t.waktu)}{t.catatan ? ` · ${t.catatan}` : ''}
                          {t.staff ? ` · ${t.staff}` : ''}
                        </div>
                      </div>
                      <span className="font-black text-rose-600 shrink-0">{formatCurrency(t.jumlah)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center">
            Pendapatan &amp; pengeluaran di luar penjualan dicatat di menu Pendapatan/Pengeluaran.
            Modal (HPP) dihitung dari satuan dasar sehingga akurat untuk item UOM &amp; stok FIFO.
          </p>
        </>
      )}
    </div>
  );
}
