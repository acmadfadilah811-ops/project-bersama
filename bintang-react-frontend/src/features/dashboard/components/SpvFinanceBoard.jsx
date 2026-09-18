import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Receipt, PieChart, AlertOctagon, RefreshCw } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const formatRupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

const AGING_LABEL = { '0-30': '0-30 hari', '31-60': '31-60 hari', '61-90': '61-90 hari', '90+': '> 90 hari' };
const AGING_ORDER = ['0-30', '31-60', '61-90', '90+'];

/**
 * Papan Kerja SPV Finance -- agregat HASIL yang sudah diverifikasi Admin
 * Finance (bukan antrean verifikasi individual, itu tugas Admin Finance).
 * Read-only kecuali eskalasi (murni informasi, tidak ada aksi tulis di sini).
 */
export default function SpvFinanceBoard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/finance/dashboard-spv-finance/');
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat dashboard SPV Finance:', err);
      setError('Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex items-center justify-center text-xs text-slate-400">
        Memuat Papan Kerja SPV Finance...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-xs text-red-600 flex items-center justify-between">
        {error}
        <button onClick={fetchData} className="font-bold text-red-700 hover:underline">Coba Lagi</button>
      </div>
    );
  }

  const kas = data?.ringkasan_kas_tervalidasi || {};
  const maxSelisihKasir = Math.max(...(data?.selisih_per_kasir || []).map((k) => Math.abs(k.total_selisih || 0)), 1);
  const maxPengeluaran = Math.max(...(data?.pengeluaran_per_tipe || []).map((p) => p.total || 0), 1);
  const maxAgingNominal = Math.max(...AGING_ORDER.map((k) => data?.piutang_aging?.[k]?.nominal || 0), 1);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={fetchData} className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-[11px]">
          <RefreshCw size={13} /> Segarkan
        </button>
      </div>

      {/* Ringkasan Kas Tervalidasi (bulan berjalan) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Shift Tervalidasi</p>
          <span className="text-xl font-black text-slate-800">{kas.jumlah_shift || 0}</span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total Sistem</p>
          <span className="text-sm font-black text-slate-800">{formatRupiah(kas.total_expected)}</span>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Total Fisik</p>
          <span className="text-sm font-black text-slate-800">{formatRupiah(kas.total_aktual)}</span>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-3 shadow-sm">
          <p className="text-[10px] font-bold text-amber-800 uppercase">Total Selisih</p>
          <span className="text-sm font-black text-amber-700">{formatRupiah(kas.total_selisih)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {/* Selisih per kasir */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <TrendingUp size={14} className="text-indigo-700" />
            <h2 className="text-xs font-bold text-slate-900">Selisih Kas per Kasir (bulan ini)</h2>
          </div>
          {(data?.selisih_per_kasir || []).length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-6">Belum ada shift tervalidasi bulan ini.</p>
          ) : (
            data.selisih_per_kasir.map((k) => (
              <div key={k.kasir__username} className="flex items-center gap-2">
                <div className="w-28 shrink-0 text-[11px] font-semibold text-slate-800 truncate">{k.kasir__username}</div>
                <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${Number(k.total_selisih) < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${(Math.abs(k.total_selisih) / maxSelisihKasir) * 100}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-[10px] text-right font-bold text-slate-700">
                  {formatRupiah(k.total_selisih)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pengeluaran per tipe */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Receipt size={14} className="text-indigo-700" />
            <h2 className="text-xs font-bold text-slate-900">Pengeluaran per Tipe (bulan ini)</h2>
          </div>
          {(data?.pengeluaran_per_tipe || []).length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-6">Belum ada pengeluaran tervalidasi bulan ini.</p>
          ) : (
            data.pengeluaran_per_tipe.map((p) => (
              <div key={p.tipe_transaksi__nama} className="flex items-center gap-2">
                <div className="w-28 shrink-0 text-[11px] font-semibold text-slate-800 truncate">
                  {p.tipe_transaksi__nama || '(Tanpa tipe)'}
                </div>
                <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded" style={{ width: `${(p.total / maxPengeluaran) * 100}%` }} />
                </div>
                <div className="w-28 shrink-0 text-[10px] text-right font-bold text-slate-700">{formatRupiah(p.total)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Umur Piutang */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <PieChart size={14} className="text-indigo-700" />
            <h2 className="text-xs font-bold text-slate-900">Umur Piutang</h2>
          </div>
          <span className="text-xs font-black text-slate-800">{formatRupiah(data?.piutang_total_sisa)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AGING_ORDER.map((key) => {
            const bucket = data?.piutang_aging?.[key] || { jumlah: 0, nominal: 0 };
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="w-20 shrink-0 text-[11px] font-semibold text-slate-700">{AGING_LABEL[key]}</div>
                <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                  <div
                    className={`h-full rounded ${key === '90+' ? 'bg-red-500' : key === '61-90' ? 'bg-amber-500' : 'bg-indigo-500'}`}
                    style={{ width: `${(bucket.nominal / maxAgingNominal) * 100}%` }}
                  />
                </div>
                <div className="w-32 shrink-0 text-[10px] text-right text-slate-600">
                  {bucket.jumlah} order &middot; <span className="font-bold">{formatRupiah(bucket.nominal)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Eskalasi */}
      <div className="bg-white rounded-lg border border-red-200 shadow-sm p-3 space-y-2">
        <div className="flex items-center gap-2 border-b border-red-100 pb-2">
          <AlertOctagon size={14} className="text-red-600" />
          <h2 className="text-xs font-bold text-slate-900">Eskalasi dari Admin Finance ({data?.eskalasi_count || 0})</h2>
        </div>
        {(data?.eskalasi || []).length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-6">Tidak ada shift yang dipertanyakan.</p>
        ) : (
          <div className="space-y-2">
            {data.eskalasi.map((e) => (
              <div key={e.id} className="border border-red-100 bg-red-50/40 rounded-lg p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{e.kasir_nama} &middot; {e.tanggal}</span>
                  <span className="text-xs font-bold text-red-700">{formatRupiah(e.selisih)}</span>
                </div>
                <p className="text-[11px] text-slate-600 italic mt-1">"{e.catatan_verifikasi}"</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Ditandai oleh {e.diverifikasi_oleh_nama} &middot; {e.diverifikasi_pada ? new Date(e.diverifikasi_pada).toLocaleString('id-ID') : '-'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
