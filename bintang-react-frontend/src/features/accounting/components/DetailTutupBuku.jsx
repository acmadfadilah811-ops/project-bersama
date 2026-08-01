import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { notifyApiError } from '../../../utils/notify';
import { fetchAccountingPeriodDetail } from '../services/periods';

const formatDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '-');

const formatAmount = (value) => Number(value || 0).toLocaleString('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function DetailTutupBuku({ period, onBack }) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchAccountingPeriodDetail(period.id);
        if (active) setLines(result);
      } catch (error) {
        if (active) {
          setLines([]);
          notifyApiError(error, 'Gagal memuat detail tutup buku');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [period.id]);

  return (
    <section className="fixed inset-0 z-[100] overflow-y-auto bg-slate-50 p-4 text-xs text-slate-700 md:p-8">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold hover:bg-slate-100">
            <ArrowLeft size={15} /> Kembali
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900">Detail Tutup Buku</h1>
            <p className="mt-0.5 text-slate-500">{formatDate(period.start_date)} s/d {formatDate(period.end_date)}</p>
          </div>
        </header>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-400"><Loader2 className="animate-spin text-[#0088E8]" size={28} />Memuat detail tutup buku...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-500"><tr>
                  <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">No. Transaksi</th><th className="px-4 py-3">Nomor Akun</th><th className="px-4 py-3">Nama Akun</th><th className="px-4 py-3">Deskripsi</th><th className="px-4 py-3 text-right">Nilai Debit</th><th className="px-4 py-3 text-right">Nilai Kredit</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.length === 0 ? <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400">Tidak ada jurnal yang telah diposting pada periode ini.</td></tr> : lines.map((line, index) => (
                    <tr key={`${line.entry_number}-${line.account_code}-${index}`} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3">{formatDate(line.date)}</td><td className="px-4 py-3 font-bold text-[#0088E8]">{line.entry_number}</td><td className="px-4 py-3">{line.account_code}</td><td className="px-4 py-3">{line.account_name}</td><td className="px-4 py-3">{line.description || '-'}</td><td className="px-4 py-3 text-right">{formatAmount(line.debit)}</td><td className="px-4 py-3 text-right">{formatAmount(line.kredit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
