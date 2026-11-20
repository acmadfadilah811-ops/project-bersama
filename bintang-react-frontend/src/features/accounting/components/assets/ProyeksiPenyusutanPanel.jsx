import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchProyeksiPenyusutan } from '../../services/assets';
import { notifyApiError } from '../../../../utils/notify';

/** Estimasi beban penyusutan ke depan per bulan & per aset (tanpa menjurnal), 2026-11-10. */
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const PILIHAN = [6, 12, 24, 36];

export default function ProyeksiPenyusutanPanel() {
  const [bulan, setBulan] = useState(12);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let batal = false;
    setLoading(true);
    fetchProyeksiPenyusutan(bulan)
      .then((res) => { if (!batal) setData(res); })
      .catch((error) => notifyApiError(error, 'Gagal memuat proyeksi penyusutan'))
      .finally(() => { if (!batal) setLoading(false); });
    return () => { batal = true; };
  }, [bulan]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-slate-500">Proyeksi</span>
        {PILIHAN.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setBulan(n)}
            className={`px-3 py-1.5 rounded-lg font-bold ${bulan === n ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            {n} bulan
          </button>
        ))}
        <p className="ml-auto text-[11px] font-medium text-slate-400">Garis lurus, dari aset tetap aktif yang punya umur manfaat. Hanya estimasi, tidak menjurnal.</p>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Menghitung...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex-1 px-4 py-3"><p className="text-slate-500">Total {bulan} bulan ke depan</p><p className="mt-1 text-lg font-bold text-slate-900">{money.format(data.total)}</p></div>
              <span className="h-1.5" style={{ background: '#1890FF' }} />
            </div>
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex-1 px-4 py-3"><p className="text-slate-500">Rata-rata per bulan</p><p className="mt-1 text-lg font-bold text-slate-900">{money.format(Number(data.total) / bulan)}</p></div>
              <span className="h-1.5" style={{ background: '#3ED0A8' }} />
            </div>
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex-1 px-4 py-3">
                <p className="text-slate-500">Bulan lalu belum diposting</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{money.format(data.belum_diposting)}</p>
                {Number(data.belum_diposting) > 0 && <p className="text-[10px] font-medium text-slate-400">Tersusul otomatis saat posting penyusutan berikutnya.</p>}
              </div>
              <span className="h-1.5" style={{ background: '#F5D90A' }} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-[#F8FAFC]">Aset</th>
                  <th className="px-4 py-3 text-right">Nilai Buku Kini</th>
                  {data.label.map((l) => <th key={l} className="px-4 py-3 text-right">{l}</th>)}
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Nilai Buku Akhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.aset.length === 0 ? (
                  <tr><td colSpan={data.label.length + 4} className="px-4 py-14 text-center text-slate-400 font-bold">Belum ada aset yang disusutkan.</td></tr>
                ) : data.aset.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 sticky left-0 bg-white"><span className="font-bold text-[#0088E8]">{a.asset_code}</span> <span className="text-slate-600">{a.name}</span></td>
                    <td className="px-4 py-2.5 text-right">{money.format(a.nilai_buku)}</td>
                    {a.per_bulan.map((v, i) => <td key={i} className={`px-4 py-2.5 text-right ${Number(v) ? '' : 'text-slate-300'}`}>{money.format(v)}</td>)}
                    <td className="px-4 py-2.5 text-right font-bold">{money.format(a.total)}</td>
                    <td className="px-4 py-2.5 text-right">{money.format(a.nilai_buku_akhir)}</td>
                  </tr>
                ))}
              </tbody>
              {data.aset.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 font-bold text-slate-900">
                  <tr>
                    <td className="px-4 py-3 sticky left-0 bg-white">Total beban penyusutan</td>
                    <td />
                    {data.total_per_bulan.map((v, i) => <td key={i} className="px-4 py-3 text-right">{money.format(v)}</td>)}
                    <td className="px-4 py-3 text-right">{money.format(data.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
