import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, FileWarning, RefreshCw } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { uiConfirm } from '../../../utils/dialog';

// Nota Human Error (2026-09-28): tanggungan 50% pesanan pengganti (reorder)
// yang dibebankan ke staff pembuat kesalahan. Staff melihat nota miliknya;
// owner/manager/admin/finance melihat semua untuk ditinjau akhir bulan.
const rupiah = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const bulanIni = () => new Date().toISOString().slice(0, 7);
const tanggal = (iso) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

const WARNA_STATUS = {
  lunas: 'bg-slate-100 text-slate-700 border-slate-200',
  menunggu_potong: 'bg-amber-50 text-amber-800 border-amber-200',
  sudah_dipotong: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function NotaHumanError() {
  const [bulan, setBulan] = useState(bulanIni());
  const [statusFilter, setStatusFilter] = useState('');
  const [staffId, setStaffId] = useState('');
  const [data, setData] = useState(null);
  const [daftarStaff, setDaftarStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const muat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (bulan) params.bulan = bulan;
      if (statusFilter) params.status = statusFilter;
      if (staffId) params.staff_id = staffId;
      const res = await apiClient.get('/nota-human-error/', { params });
      setData(res.data);
    } catch {
      setError('Gagal memuat nota human error.');
    } finally {
      setLoading(false);
    }
  }, [bulan, statusFilter, staffId]);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    if (!data?.peninjau || daftarStaff.length) return;
    apiClient.get('/pos/sales/staff-list/')
      .then((res) => setDaftarStaff(Array.isArray(res.data) ? res.data : []))
      .catch(() => setDaftarStaff([]));
  }, [data?.peninjau, daftarStaff.length]);

  const tandaiDipotong = async (baris) => {
    const ok = await uiConfirm(
      `Tandai tanggungan ${rupiah(baris.nominal)} milik ${baris.staff_nama} sudah dipotong di slip gaji?`,
      { title: 'Tandai Sudah Dipotong', confirmText: 'Ya, sudah dipotong' },
    );
    if (!ok) return;
    try {
      await apiClient.post(`/nota-human-error/${baris.id}/tandai-dipotong/`);
      muat();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menandai nota.');
    }
  };

  const ring = data?.ringkasan;
  const peninjau = !!data?.peninjau;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileWarning size={18} className="text-slate-500" /> Nota Human Error
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Tanggungan 50% pesanan pengganti (reorder) akibat kesalahan kerja. Pelanggan tetap membayar nota awalnya;
            nota di sini tidak dikirim ke pelanggan. {peninjau
              ? 'Tinjau per staff tiap akhir bulan; tanggungan potong gaji dimasukkan HR sebagai potongan "Potongan Reorder" di slip gaji.'
              : 'Tanggungan potong gaji akan dipotong di slip gaji akhir bulan.'}
          </p>
        </div>
        <button onClick={muat} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <RefreshCw size={13} /> Muat Ulang
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Bulan</label>
          <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Semua</option>
            <option value="menunggu_potong">Menunggu potong gaji</option>
            <option value="sudah_dipotong">Sudah dipotong gaji</option>
            <option value="lunas">Lunas (tunai)</option>
          </select>
        </div>
        {peninjau && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Staff</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[180px]">
              <option value="">Semua staff</option>
              {daftarStaff.map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
          </div>
        )}
      </div>

      {ring && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['Total tanggungan', ring.total, `${ring.jumlah} nota`],
            ['Menunggu potong gaji', ring.menunggu_potong_gaji, 'Belum dipotong'],
            ['Sudah dipotong gaji', ring.sudah_dipotong_gaji, 'Lewat slip gaji'],
            ['Lunas tunai', ring.lunas_tunai, 'Dibayar di kasir'],
          ].map(([judul, nilai, ket]) => (
            <div key={judul} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-[11px] font-semibold text-slate-500">{judul}</div>
              <div className="text-lg font-bold text-slate-800 mt-1">{rupiah(nilai)}</div>
              <div className="text-[11px] text-slate-400">{ket}</div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-2">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-semibold">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              {peninjau && <th className="px-4 py-3">Staff</th>}
              <th className="px-4 py-3">Pesanan</th>
              <th className="px-4 py-3">Pelanggan & Item</th>
              <th className="px-4 py-3">Alasan</th>
              <th className="px-4 py-3 text-right">Tanggungan</th>
              <th className="px-4 py-3">Cara Bayar / Status</th>
              {peninjau && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Memuat...</td></tr>
            ) : !data?.hasil?.length ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Tidak ada nota human error pada periode ini.</td></tr>
            ) : (
              data.hasil.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap">{tanggal(b.dibuat)}</td>
                  {peninjau && <td className="px-4 py-3 font-semibold text-slate-800">{b.staff_nama}</td>}
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{b.order_id}</div>
                    <div className="text-[10px] text-slate-400">Nota awal: {b.order_asal_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{b.pelanggan}</div>
                    <div className="text-[10px] text-slate-500">{b.item.join(', ')}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[260px] text-slate-600">{b.alasan}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{rupiah(b.nominal)}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-600">{b.metode_label}</div>
                    <span className={`inline-block mt-1 text-[10px] font-semibold border rounded px-1.5 py-0.5 ${WARNA_STATUS[b.status] || ''}`}>
                      {b.status_label}
                    </span>
                    {b.ditandai_dipotong_oleh_nama && (
                      <div className="text-[10px] text-slate-400 mt-1">oleh {b.ditandai_dipotong_oleh_nama}, {tanggal(b.ditandai_dipotong_pada)}</div>
                    )}
                  </td>
                  {peninjau && (
                    <td className="px-4 py-3">
                      {b.status === 'menunggu_potong' && (
                        <button onClick={() => tandaiDipotong(b)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                          <CheckCircle2 size={12} /> Tandai dipotong
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
