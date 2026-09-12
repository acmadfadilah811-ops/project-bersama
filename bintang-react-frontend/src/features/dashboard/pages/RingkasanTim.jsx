import { useState, useEffect } from 'react';
import { Users, CheckCircle2, XCircle, Clock, AlertTriangle, Ban, Printer } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const STATUS_META = {
  antrean: { label: 'Antrean', icon: Clock, accent: 'text-slate-500 bg-slate-50' },
  dikerjakan: { label: 'Dikerjakan', icon: Clock, accent: 'text-blue-600 bg-blue-50' },
  selesai: { label: 'Selesai', icon: CheckCircle2, accent: 'text-emerald-600 bg-emerald-50' },
  gagal: { label: 'Gagal', icon: XCircle, accent: 'text-rose-600 bg-rose-50' },
  kendala: { label: 'Kendala', icon: AlertTriangle, accent: 'text-amber-600 bg-amber-50' },
  batal: { label: 'Batal', icon: Ban, accent: 'text-slate-400 bg-slate-50' },
};

export default function RingkasanTim() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    apiClient
      .get('/jobs/ringkasan-tim/')
      .then((res) => {
        if (mounted) setData(res.data);
      })
      .catch((err) => {
        if (mounted) {
          setError(
            err.response?.data?.error || 'Gagal memuat ringkasan tim.'
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          Memuat ringkasan tim...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-12">
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
          <AlertTriangle size={16} /> {error}
        </div>
      </div>
    );
  }

  const jobPerStatus = data?.job_per_status || {};
  const statusKeys = Object.keys(STATUS_META).filter((k) => jobPerStatus[k] !== undefined);
  const pemakaianMesin = data?.pemakaian_mesin || [];

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-12 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Users size={22} className="text-indigo-600" /> Ringkasan Tim
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Kinerja seluruh bawahan di cabang organisasi Anda ({data?.jumlah_anggota_tim ?? 0} anggota tim).
        </p>
      </div>

      {/* Kartu jumlah job per status */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusKeys.length === 0 && (
          <div className="col-span-full text-sm text-slate-400 bg-white rounded-xl border border-slate-150 p-6 text-center">
            Belum ada data pekerjaan dari tim Anda.
          </div>
        )}
        {statusKeys.map((key) => {
          const meta = STATUS_META[key];
          const Icon = meta.icon;
          return (
            <div
              key={key}
              className="bg-white rounded-xl border border-slate-150 shadow-sm p-4 flex flex-col gap-2"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.accent}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{jobPerStatus[key]}</p>
                <p className="text-xs text-slate-500">{meta.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Laporan pemakaian mesin */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <Printer size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Pemakaian Mesin oleh Tim</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-150">
                <th className="px-6 py-3">Mesin</th>
                <th className="px-6 py-3 text-center">Jumlah Pemakaian</th>
                <th className="px-6 py-3 text-center">Total Lembar Color</th>
                <th className="px-6 py-3 text-center">Total Lembar Mono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pemakaianMesin.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-sm text-slate-400">
                    Belum ada catatan pemakaian mesin dari tim Anda.
                  </td>
                </tr>
              ) : (
                pemakaianMesin.map((row) => (
                  <tr key={row.mesin__nama || 'tanpa-mesin'}>
                    <td className="px-6 py-3 font-medium text-slate-700">{row.mesin__nama || '(Tanpa nama mesin)'}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.jumlah_pemakaian}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.total_lembar_color ?? 0}</td>
                    <td className="px-6 py-3 text-center text-slate-600">{row.total_lembar_mono ?? 0}</td>
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
