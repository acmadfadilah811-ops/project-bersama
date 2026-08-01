import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import ReturPenjualanDateModal from '../components/pos/ReturPenjualanDateModal';

const today = () => new Date().toISOString().slice(0, 10);
const ago = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};
const fmtRp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// Biaya MDR sudah diposting nyata saat Settlement (accounting/services/settlement.py,
// akun PaymentMethod.mdr_debit_account). Layar ini membaca ulang baris jurnal
// yang kena akun MDR tsb — bukan menghitung ulang, satu sumber kebenaran.
export default function BiayaMdr() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(ago(30));
  const [dateTo, setDateTo] = useState(today());
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      apiClient.get('/accounting/payment-methods/'),
      apiClient.get('/accounting/journal-entries/', { params: { date_from: dateFrom, date_to: dateTo, source_type: 'settlement' } }),
    ]).then(([pmRes, jeRes]) => {
      if (!active) return;
      const methods = pmRes.data.results || pmRes.data || [];
      const mdrAccountIds = new Set(methods.filter((m) => m.mdr_percent > 0 && m.mdr_debit_account).map((m) => m.mdr_debit_account));
      const methodByAccount = new Map(methods.map((m) => [m.mdr_debit_account, m]));
      const entries = jeRes.data.results || jeRes.data || [];
      const mdrRows = [];
      entries.forEach((entry) => {
        (entry.lines || []).forEach((line) => {
          if (mdrAccountIds.has(line.account) && Number(line.debit) > 0) {
            const method = methodByAccount.get(line.account);
            mdrRows.push({
              id: line.id, tanggal: entry.date, transaksi: entry.entry_number,
              metode: method?.name || line.account_name, persen: method?.mdr_percent || 0,
              nominal: line.debit,
            });
          }
        });
      });
      setRows(mdrRows);
    }).catch((err) => { if (active) { notifyApiError(err, 'Gagal memuat data biaya MDR.'); setRows([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dateFrom, dateTo]);

  const totalMdr = rows.reduce((sum, row) => sum + Number(row.nominal || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-emerald-900 text-xs">Data Biaya MDR dari Settlement</p>
          <p className="text-emerald-700 text-[11px] font-medium leading-relaxed">
            Biaya MDR diposting otomatis saat batch Settlement diproses. Layar ini tampilan saja (read-only).
          </p>
        </div>
      </div>

      <h2 className="text-base font-bold text-slate-900">Biaya MDR (Merchant Discount Rate)</h2>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" onClick={() => setDateOpen(true)} className="px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer">
          {dateLabel} {dateFrom} - {dateTo}
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Transaksi</th>
                <th className="px-5 py-3.5">Metode Pembayaran</th>
                <th className="px-5 py-3.5 text-right">Rate MDR</th>
                <th className="px-5 py-3.5 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400"><Loader2 className="inline animate-spin" size={16} /> Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400 font-bold">No Data</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3">{row.tanggal}</td>
                  <td className="px-5 py-3 font-mono">{row.transaksi}</td>
                  <td className="px-5 py-3">{row.metode}</td>
                  <td className="px-5 py-3 text-right font-mono">{Number(row.persen).toLocaleString('id-ID')}%</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-rose-700">{fmtRp(row.nominal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <span>Total {rows.length} baris</span>
          <span className="text-rose-700">Total Biaya MDR {fmtRp(totalMdr)}</span>
        </div>
      </div>

      <ReturPenjualanDateModal
        isOpen={dateOpen}
        onClose={() => setDateOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={(res) => { setDateFrom(res.from); setDateTo(res.to); setDateLabel(res.label); }}
      />
    </div>
  );
}
