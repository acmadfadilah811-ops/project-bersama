import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Settings } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import ReturPenjualanDateModal from '../components/pos/ReturPenjualanDateModal';
import KomisiPenjualanSettingsDrawer from '../components/pos/KomisiPenjualanSettingsDrawer';

const today = () => new Date().toISOString().slice(0, 10);
const ago = (days) => {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
};
const fmtRp = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// Komisi brand sudah dihitung backend (Brand.komisi_persen x nilai jual per
// baris) lewat laporan "item-brand" — dibaca ulang di sini, bukan dihitung
// ulang di frontend (satu sumber kebenaran, lihat report_views.py).
export default function KomisiPenjualan() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(ago(30));
  const [dateTo, setDateTo] = useState(today());
  const [dateLabel, setDateLabel] = useState('30 Hari yang lalu');
  const [dateOpen, setDateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiClient.get('/reports/item-brand/', { params: { start: dateFrom, end: dateTo } })
      .then((res) => { if (active) setRows((res.data?.rows || []).filter((row) => row.komisi_nilai > 0)); })
      .catch((err) => { if (active) { notifyApiError(err, 'Gagal memuat data komisi penjualan.'); setRows([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dateFrom, dateTo]);

  const totalKomisi = rows.reduce((sum, row) => sum + Number(row.komisi_nilai || 0), 0);

  return (
    <div className="space-y-4 animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-start gap-3 shadow-2xs">
        <AlertTriangle className="text-emerald-600 shrink-0 mt-0.5" size={16} />
        <div className="space-y-1">
          <p className="font-bold text-emerald-900 text-xs">Data Komisi Penjualan (Brand)</p>
          <p className="text-emerald-700 text-[11px] font-medium leading-relaxed">
            Dihitung otomatis dari rate komisi Brand x nilai jual per baris pesanan. Layar ini tampilan saja (read-only).
          </p>
        </div>
      </div>

      <h2 className="text-base font-bold text-slate-900">Komisi Penjualan</h2>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button type="button" onClick={() => setDateOpen(true)} className="px-3 py-1.5 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg shadow-2xs transition-colors cursor-pointer">
          {dateLabel} {dateFrom} - {dateTo}
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)} className="p-1.5 border border-slate-200 text-slate-400 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors shadow-2xs">
          <Settings size={14} />
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-bold">
              <tr>
                <th className="px-5 py-3.5">Transaksi</th>
                <th className="px-5 py-3.5">Staff</th>
                <th className="px-5 py-3.5">Tanggal</th>
                <th className="px-5 py-3.5">Brand</th>
                <th className="px-5 py-3.5 text-right">Nominal Transaksi</th>
                <th className="px-5 py-3.5 text-right">Rate</th>
                <th className="px-5 py-3.5 text-right">Komisi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400"><Loader2 className="inline animate-spin" size={16} /> Memuat data...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400 font-bold">No Data</td></tr>
              ) : rows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3">{row.no_pesanan}</td>
                  <td className="px-5 py-3">{row.dilayani_oleh || row.sales_oleh || '-'}</td>
                  <td className="px-5 py-3">{row.waktu}</td>
                  <td className="px-5 py-3">{row.brand}</td>
                  <td className="px-5 py-3 text-right font-mono">{fmtRp(row.jumlah)}</td>
                  <td className="px-5 py-3 text-right font-mono">{Number(row.komisi_persen || 0).toLocaleString('id-ID')}%</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-emerald-700">{fmtRp(row.komisi_nilai)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/30">
          <span>Total {rows.length} baris</span>
          <span className="text-emerald-700">Total Komisi {fmtRp(totalKomisi)}</span>
        </div>
      </div>

      <ReturPenjualanDateModal
        isOpen={dateOpen}
        onClose={() => setDateOpen(false)}
        initialFrom={dateFrom}
        initialTo={dateTo}
        onApply={(res) => { setDateFrom(res.from); setDateTo(res.to); setDateLabel(res.label); }}
      />

      <KomisiPenjualanSettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
