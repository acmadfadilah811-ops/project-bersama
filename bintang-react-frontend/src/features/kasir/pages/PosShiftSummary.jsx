import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, Clock, Scale, RefreshCw, Printer } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Ringkasan Shift v2 — rekonsiliasi kas per shift.
 * Sumber data: /ringkasan-shift/ (model RingkasanShift), yang dibuat otomatis
 * saat kasir menutup shift lewat endpoint /saldo-kas-harian/<id>/close/.
 */
export default function PosShiftSummary() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/ringkasan-shift/');
      const data = res.data.results || res.data || [];
      setShifts(data);
    } catch (err) {
      console.error('Error fetching shift summary:', err);
      setError('Gagal memuat ringkasan shift.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const formatCurrency = (val) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })
      .format(Number(val || 0));

  const fmtWaktu = (v) => (v ? new Date(v).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-');

  // Statistik diturunkan dari data nyata — tidak ada angka yang dikarang.
  const totalShift = shifts.length;
  const totalExpected = shifts.reduce((a, s) => a + Number(s.expected || 0), 0);
  const totalSelisih = shifts.reduce((a, s) => a + Number(s.selisih || 0), 0);
  const shiftPas = shifts.filter((s) => Number(s.selisih || 0) === 0).length;
  const akurasi = totalShift > 0 ? ((shiftPas / totalShift) * 100).toFixed(1) : null;

  const cards = [
    { icon: DollarSign, warna: 'indigo', label: 'Total Kas Seharusnya', nilai: formatCurrency(totalExpected) },
    { icon: Clock, warna: 'emerald', label: 'Total Shift Selesai', nilai: `${totalShift} Shift` },
    {
      icon: Scale,
      warna: totalSelisih === 0 ? 'emerald' : totalSelisih < 0 ? 'rose' : 'amber',
      label: 'Total Selisih', nilai: formatCurrency(totalSelisih),
    },
    {
      icon: TrendingUp, warna: 'purple', label: 'Shift Tanpa Selisih',
      nilai: akurasi === null ? '-' : `${akurasi} % (${shiftPas}/${totalShift})`,
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
      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
        <div>
          <h4 className="font-extrabold text-slate-800 text-lg">Ringkasan Shift v2</h4>
          <p className="text-xs text-slate-500 font-semibold font-mono uppercase tracking-wider">
            Rekonsiliasi Kas Kasir
          </p>
        </div>
        <button
          onClick={fetchShifts}
          className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors border border-slate-200 cursor-pointer"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Kartu statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className={`${warnaKelas[c.warna]} p-3 rounded-2xl`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{c.label}</span>
                <h5 className="font-extrabold text-slate-800 text-base mt-0.5 truncate">{c.nilai}</h5>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabel riwayat */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h5 className="font-extrabold text-slate-800 text-sm">Riwayat Rekonsiliasi Shift</h5>
          <span className="text-[9px] bg-slate-200 text-slate-600 font-black px-2 py-0.5 rounded">
            {totalShift} Data
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-xs text-rose-500 font-bold">{error}</p>
          </div>
        ) : shifts.length === 0 ? (
          <div className="py-16 text-center px-6">
            <p className="text-xs text-slate-500 font-bold">Belum ada shift yang ditutup.</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Ringkasan otomatis dibuat setiap kali kasir menutup shift di menu Shift.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3">Tanggal & Kasir</th>
                  <th className="px-6 py-3">Mulai</th>
                  <th className="px-6 py-3">Berakhir</th>
                  <th className="px-6 py-3 text-right">Kas Seharusnya</th>
                  <th className="px-6 py-3 text-right">Kas Aktual</th>
                  <th className="px-6 py-3 text-right">Selisih</th>
                  <th className="px-6 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {shifts.map((s) => {
                  const selisih = Number(s.selisih || 0);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{s.kasir_nama || '-'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{s.tanggal}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{fmtWaktu(s.mulai)}</td>
                      <td className="px-6 py-4 text-slate-500">{fmtWaktu(s.berakhir)}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(s.expected)}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(s.aktual)}</td>
                      <td className={`px-6 py-4 text-right font-black ${
                        selisih < 0 ? 'text-rose-600' : selisih > 0 ? 'text-emerald-600' : 'text-slate-500'
                      }`}>
                        {formatCurrency(selisih)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => window.print()}
                          className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                          title="Cetak ringkasan shift"
                        >
                          <Printer size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
