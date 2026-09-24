import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { fetchAllPages } from '../../../utils/paginatedApi';

const rp = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const jam = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

const hariIni = () => new Date().toLocaleDateString('en-CA');
const geser = (hari) => {
  const d = new Date();
  d.setDate(d.getDate() + hari);
  return d.toLocaleDateString('en-CA');
};

const LABEL_STATUS = { menunggu: 'Menunggu verifikasi', diverifikasi: 'Diverifikasi', dipertanyakan: 'Dipertanyakan' };

const warnaSelisih = (n) => (Number(n) === 0 ? 'text-slate-700' : Number(n) > 0 ? 'text-emerald-700' : 'text-rose-700');

/**
 * Ringkasan Shift untuk Admin Finance: daftar shift kasir yang sudah ditutup
 * beserta kas awal, penjualan tunai, kas masuk/keluar, kas seharusnya vs
 * aktual, dan status verifikasi. Baca saja -- verifikasi setoran tetap lewat
 * Dashboard Finance (Antrean Setoran Kas Shift).
 */
export default function RingkasanShiftFinance() {
  const [dari, setDari] = useState(() => geser(-7));
  const [sampai, setSampai] = useState(hariIni);
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { tanggal_mulai: dari, tanggal_akhir: sampai };
      if (cari.trim()) params.query = cari.trim();
      if (status) params.status_verifikasi = status;
      setRows(await fetchAllPages('/ringkasan-shift/', { params }));
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Gagal memuat ringkasan shift.');
    } finally {
      setLoading(false);
    }
  }, [dari, sampai, cari, status]);

  useEffect(() => {
    muat();
  }, [muat]);

  const totalSelisih = rows.reduce((acc, r) => acc + Number(r.selisih || 0), 0);
  const totalAktual = rows.reduce((acc, r) => acc + Number(r.aktual || 0), 0);

  return (
    <div className="p-6 space-y-5 text-slate-700">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Ringkasan Shift</h1>
        <p className="text-xs text-slate-500 mt-1">
          Rekap kas tiap shift kasir. Verifikasi setoran dilakukan di Dashboard Finance.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <label className="text-[11px] font-semibold text-slate-500">
          Dari
          <input type="date" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)}
            className="block mt-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700" />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Sampai
          <input type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)}
            className="block mt-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700" />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Kasir
          <input type="text" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama kasir"
            className="block mt-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 w-48" />
        </label>
        <label className="text-[11px] font-semibold text-slate-500">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="block mt-1 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700">
            <option value="">Semua</option>
            {Object.entries(LABEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" onClick={muat}
          className="inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
          <RefreshCw size={13} /> Muat ulang
        </button>
        <div className="ml-auto text-right text-[11px] text-slate-500">
          <div>{rows.length} shift</div>
          <div>Total aktual <b className="text-slate-800">{rp(totalAktual)}</b></div>
          <div>Total selisih <b className={warnaSelisih(totalSelisih)}>{rp(totalSelisih)}</b></div>
        </div>
      </div>

      {error && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['Tanggal', 'Kasir', 'Jam', 'Kas Awal', 'Penjualan Tunai', 'Kas Masuk', 'Kas Keluar', 'Seharusnya', 'Aktual', 'Selisih', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 font-bold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">Memuat...</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-400">Tidak ada ringkasan shift pada rentang ini.</td></tr>
            )}
            {!loading && rows.map((r) => (
              <tr key={r.id} onClick={() => setDetail(r)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-3 whitespace-nowrap">{r.tanggal}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{r.kasir_nama}</td>
                <td className="px-4 py-3 whitespace-nowrap">{jam(r.mulai)} - {jam(r.berakhir)}</td>
                <td className="px-4 py-3">{rp(r.kas_awal)}</td>
                <td className="px-4 py-3">{rp(r.penjualan_tunai)}</td>
                <td className="px-4 py-3">{rp(r.kas_masuk)}</td>
                <td className="px-4 py-3">{rp(r.kas_keluar)}</td>
                <td className="px-4 py-3">{rp(r.expected)}</td>
                <td className="px-4 py-3">{rp(r.aktual)}</td>
                <td className={`px-4 py-3 font-bold ${warnaSelisih(r.selisih)}`}>{rp(r.selisih)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{LABEL_STATUS[r.status_verifikasi] || r.status_verifikasi || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-900/40" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-white h-full overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Shift {detail.kasir_nama}</h2>
                <p className="text-[11px] text-slate-500">{detail.tanggal} - {jam(detail.mulai)} sampai {jam(detail.berakhir)}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={16} /></button>
            </div>

            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
              {[
                ['Kas awal', detail.kas_awal], ['Penjualan tunai', detail.penjualan_tunai],
                ['Kas masuk', detail.kas_masuk], ['Kas keluar', detail.kas_keluar],
                ['Seharusnya di laci', detail.expected], ['Aktual dihitung kasir', detail.aktual],
              ].map(([label, nilai]) => (
                <div key={label} className="flex justify-between px-4 py-2.5"><span>{label}</span><b>{rp(nilai)}</b></div>
              ))}
              <div className="flex justify-between px-4 py-2.5">
                <span>Selisih</span><b className={warnaSelisih(detail.selisih)}>{rp(detail.selisih)}</b>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-bold text-slate-500 mb-2">Per metode pembayaran</h3>
              {(detail.rincian_metode || []).length === 0 ? (
                <p className="text-xs text-slate-400">Rincian tidak tersedia untuk shift ini.</p>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                  {detail.rincian_metode.map((m) => (
                    <div key={`${m.metode}-${m.tipe}`} className="flex justify-between px-4 py-2.5">
                      <span>{m.metode} <span className="text-slate-400">({m.tipe})</span></span>
                      <b>{rp(m.total)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs space-y-1">
              <div>Status: <b>{LABEL_STATUS[detail.status_verifikasi] || detail.status_verifikasi || '-'}</b>
                {detail.diverifikasi_oleh_nama ? ` oleh ${detail.diverifikasi_oleh_nama}` : ''}</div>
              {detail.catatan_verifikasi && <div>Catatan verifikasi: {detail.catatan_verifikasi}</div>}
              {detail.keterangan && <div>Keterangan kasir: {detail.keterangan}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
