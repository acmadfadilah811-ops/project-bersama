import { useState, useEffect, useCallback } from 'react';
import { Wallet, Receipt, FileWarning, Check, HelpCircle, RefreshCw } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const formatRupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

/**
 * Papan Kerja Admin Finance -- antrean verifikasi setoran kas shift kasir
 * & pengajuan pengeluaran/kas kecil, plus daftar piutang jatuh tempo.
 *
 * PENTING (lihat api/views/finance_dashboard.py & Aturan Engineering M2):
 * tombol Setujui/Verifikasi di sini TIDAK memposting jurnal akuntansi apa
 * pun -- murni penanda "sudah dicek Admin Finance". Posting jurnal tetap
 * eksklusif Owner/Manager lewat menu terpisah.
 */
export default function AdminFinanceBoard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [pertanyakanId, setPertanyakanId] = useState(null);
  const [pertanyakanCatatan, setPertanyakanCatatan] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/finance/dashboard-admin-finance/');
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat dashboard Admin Finance:', err);
      setError('Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const verifikasiShift = async (id) => {
    setActionLoading(`shift-${id}`);
    try {
      await apiClient.post(`/ringkasan-shift/${id}/verifikasi/`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal verifikasi.');
    } finally {
      setActionLoading(null);
    }
  };

  const pertanyakanShift = async (id) => {
    if (!pertanyakanCatatan.trim()) return;
    setActionLoading(`shift-${id}`);
    try {
      await apiClient.post(`/ringkasan-shift/${id}/pertanyakan/`, { catatan: pertanyakanCatatan.trim() });
      setPertanyakanId(null);
      setPertanyakanCatatan('');
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menandai dipertanyakan.');
    } finally {
      setActionLoading(null);
    }
  };

  const verifikasiPengeluaran = async (id) => {
    setActionLoading(`cash-${id}`);
    try {
      await apiClient.post(`/cash-transactions/${id}/verifikasi-admin-finance/`);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal verifikasi.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex items-center justify-center text-xs text-slate-400">
        Memuat Papan Kerja Admin Finance...
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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Setoran Kas Menunggu</p>
            <span className="text-xl font-black text-slate-800">{data?.antrean_shift_count || 0}</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <Wallet size={16} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-amber-800 uppercase">Pengeluaran Menunggu</p>
            <span className="text-xl font-black text-amber-600">{data?.antrean_pengeluaran_count || 0}</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
            <Receipt size={16} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Piutang Belum Lunas</p>
            <span className="text-xl font-black text-slate-800">{data?.piutang_count || 0}</span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <FileWarning size={16} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {/* Antrean Setoran Kas */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-900">Antrean Setoran Kas Shift</h2>
            <button onClick={fetchData} className="text-slate-400 hover:text-slate-700"><RefreshCw size={13} /></button>
          </div>
          <div className="p-2 space-y-2 max-h-[420px] overflow-y-auto">
            {(data?.antrean_shift || []).length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-8">Tidak ada setoran kas menunggu verifikasi.</p>
            ) : (
              data.antrean_shift.map((s) => (
                <div key={s.id} className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{s.kasir_nama}</span>
                    <span className="text-[10px] text-slate-400">{s.tanggal}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-600">
                    <div>Sistem: <span className="font-bold text-slate-800">{formatRupiah(s.expected)}</span></div>
                    <div>Fisik: <span className="font-bold text-slate-800">{formatRupiah(s.aktual)}</span></div>
                    <div>
                      Selisih:{' '}
                      <span className={`font-bold ${Number(s.selisih) !== 0 ? 'text-amber-700' : 'text-emerald-600'}`}>
                        {formatRupiah(s.selisih)}
                      </span>
                    </div>
                  </div>
                  {s.keterangan && <p className="text-[10px] text-slate-500 italic">"{s.keterangan}"</p>}
                  {pertanyakanId === s.id ? (
                    <div className="space-y-1.5 bg-red-50/40 p-2 rounded border border-red-100">
                      <textarea
                        rows={2}
                        value={pertanyakanCatatan}
                        onChange={(e) => setPertanyakanCatatan(e.target.value)}
                        placeholder="Alasan dipertanyakan (wajib)..."
                        className="w-full text-[11px] p-1.5 rounded border border-red-200 focus:outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => { setPertanyakanId(null); setPertanyakanCatatan(''); }}
                          className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded"
                        >
                          Batal
                        </button>
                        <button
                          disabled={actionLoading === `shift-${s.id}` || !pertanyakanCatatan.trim()}
                          onClick={() => pertanyakanShift(s.id)}
                          className="px-2 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded"
                        >
                          Kirim
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        disabled={actionLoading === `shift-${s.id}`}
                        onClick={() => setPertanyakanId(s.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <HelpCircle size={12} /> Pertanyakan
                      </button>
                      <button
                        disabled={actionLoading === `shift-${s.id}`}
                        onClick={() => verifikasiShift(s.id)}
                        className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1"
                      >
                        <Check size={12} /> Verifikasi
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Antrean Pengeluaran */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold text-slate-900">Antrean Pengeluaran / Kas Kecil</h2>
          </div>
          <div className="p-2 space-y-2 max-h-[420px] overflow-y-auto">
            {(data?.antrean_pengeluaran || []).length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-8">Tidak ada pengeluaran menunggu verifikasi.</p>
            ) : (
              data.antrean_pengeluaran.map((t) => (
                <div key={t.id} className="border border-slate-200 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-700">{t.nomor}</span>
                    <span className="text-xs font-bold text-slate-800">{formatRupiah(t.jumlah)}</span>
                  </div>
                  <p className="text-[11px] text-slate-700">{t.tipe_nama} &middot; {t.staff_nama}</p>
                  {t.catatan && <p className="text-[10px] text-slate-500 italic">"{t.catatan}"</p>}
                  <div className="flex justify-end pt-1 border-t border-slate-100">
                    <button
                      disabled={actionLoading === `cash-${t.id}`}
                      onClick={() => verifikasiPengeluaran(t.id)}
                      className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1"
                    >
                      <Check size={12} /> Verifikasi
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Piutang */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-900">Piutang Belum Lunas ({data?.piutang_count || 0})</h2>
        </div>
        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-semibold text-slate-500 uppercase">
                <th className="py-2 px-2.5">Order</th>
                <th className="py-2 px-2.5">Pelanggan</th>
                <th className="py-2 px-2.5 text-right">Total</th>
                <th className="py-2 px-2.5 text-right">Sisa Tagihan</th>
                <th className="py-2 px-2.5">Tanggal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.piutang || []).length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400 text-[11px]">Tidak ada piutang.</td></tr>
              ) : (
                data.piutang.map((o) => (
                  <tr key={o.order_id} className="hover:bg-slate-50/80">
                    <td className="py-2 px-2.5 font-mono font-bold text-indigo-700">{o.order_id}</td>
                    <td className="py-2 px-2.5">{o.nama}</td>
                    <td className="py-2 px-2.5 text-right text-slate-600">{formatRupiah(o.total_harga)}</td>
                    <td className="py-2 px-2.5 text-right font-bold text-amber-700">{formatRupiah(o.sisa_tagihan)}</td>
                    <td className="py-2 px-2.5 text-slate-500">{new Date(o.waktu).toLocaleDateString('id-ID')}</td>
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
