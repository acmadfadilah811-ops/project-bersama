import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Check,
  X,
  UserPlus,
  Search,
  Users,
  RefreshCw,
  Building2,
  Printer,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';

const STATUS_BADGE = {
  antrean: 'bg-slate-100 text-slate-700 border-slate-200',
  dikerjakan: 'bg-blue-50 text-blue-700 border-blue-200',
  selesai: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  kendala: 'bg-amber-50 text-amber-800 border-amber-300',
  gagal: 'bg-red-50 text-red-700 border-red-200',
  batal: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_LABEL = {
  antrean: 'Antrean',
  dikerjakan: 'Dikerjakan',
  selesai: 'Selesai',
  kendala: 'Kendala',
  gagal: 'Gagal',
  batal: 'Dibatalkan',
};

function formatDeadline(tanggal) {
  if (!tanggal) return '-';
  const d = new Date(tanggal);
  const today = new Date();
  const isPast = d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  return { label, isPast };
}

/**
 * Papan Kerja tim untuk Kordiv & SPV -- diselipkan di StaffDashboard.jsx
 * (bukan halaman terpisah) karena keduanya sudah berbagi dashboard itu.
 * Kordiv memproses void request tahap 1 (setujui-kordiv/tolak-kordiv),
 * SPV tahap 2/final (setujui/tolak, sama seperti Owner Dashboard.jsx --
 * lihat catatan di sana soal 2 tahap ini). Kedua role melihat & menugaskan
 * job tim lewat /api/jobs/ + /api/jobs/{id}/assign-staff/.
 */
export default function KordivSpvTeamBoard({ role }) {
  const [ringkasan, setRingkasan] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [voidQueue, setVoidQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tahapFilter, setTahapFilter] = useState('Semua');
  const [search, setSearch] = useState('');
  const [voidActionLoading, setVoidActionLoading] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [assignMenuJobId, setAssignMenuJobId] = useState(null);
  const [assignLoading, setAssignLoading] = useState(null);
  const [error, setError] = useState(null);

  const voidStatus = role === 'kordiv' ? 'pending' : 'menunggu_spv';

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [resRingkasan, resJobs, resVoid] = await Promise.all([
        apiClient.get('/jobs/ringkasan-tim/'),
        apiClient.get('/jobs/', { params: { status_pekerjaan: 'antrean,dikerjakan,kendala,selesai' } }),
        apiClient.get('/pos-void-requests/', { params: { status: voidStatus } }),
      ]);
      setRingkasan(resRingkasan.data);
      setJobs(Array.isArray(resJobs.data) ? resJobs.data : resJobs.data?.results || []);
      setVoidQueue(Array.isArray(resVoid.data) ? resVoid.data : resVoid.data?.results || []);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat Papan Kerja tim:', err);
      setError('Gagal memuat data tim.');
    } finally {
      setLoading(false);
    }
  }, [voidStatus]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const tahapOptions = useMemo(() => {
    const set = new Set(jobs.map((j) => j.tahap_nama).filter(Boolean));
    return ['Semua', ...Array.from(set)];
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      const matchTahap = tahapFilter === 'Semua' || j.tahap_nama === tahapFilter;
      if (!matchTahap) return false;
      if (!q) return true;
      const haystack = `${j.nomor_sumber || ''} ${j.nama_produk || ''} ${j.pic_nama || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [jobs, tahapFilter, search]);

  const handleAssign = async (jobId, staffId) => {
    setAssignLoading(jobId);
    try {
      await apiClient.post(`/jobs/${jobId}/assign-staff/`, { staff_id: staffId });
      setAssignMenuJobId(null);
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menugaskan staff.');
    } finally {
      setAssignLoading(null);
    }
  };

  const voidApproveAction = role === 'kordiv' ? 'setujui-kordiv' : 'setujui';
  const voidRejectAction = role === 'kordiv' ? 'tolak-kordiv' : 'tolak';

  const handleVoidApprove = async (req) => {
    setVoidActionLoading(req.id);
    try {
      const res = await apiClient.post(`/pos-void-requests/${req.id}/${voidApproveAction}/`);
      if (role !== 'kordiv' && res.data.otp_code) {
        alert(`Disetujui. Kode OTP: ${res.data.otp_code} (berlaku 15 menit, otomatis terisi di layar kasir).`);
      }
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyetujui permintaan void.');
    } finally {
      setVoidActionLoading(null);
    }
  };

  const submitVoidReject = async (req) => {
    if (!rejectReason.trim()) return;
    setVoidActionLoading(req.id);
    try {
      await apiClient.post(`/pos-void-requests/${req.id}/${voidRejectAction}/`, {
        alasan_tolak: rejectReason.trim(),
      });
      setRejectingId(null);
      setRejectReason('');
      await fetchAll();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menolak permintaan void.');
    } finally {
      setVoidActionLoading(null);
    }
  };

  if (loading && !ringkasan) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex items-center justify-center text-xs text-slate-400">
        Memuat Papan Kerja Tim...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-xs text-red-600 flex items-center justify-between">
        {error}
        <button onClick={fetchAll} className="font-bold text-red-700 hover:underline">Coba Lagi</button>
      </div>
    );
  }

  const statusCounts = ringkasan?.job_per_status || {};

  return (
    <div className="space-y-3">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Dalam Antrean</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-800 font-mono">{statusCounts.antrean || 0}</span>
              <span className="text-[10px] text-slate-500">SPK</span>
            </div>
            {ringkasan?.job_belum_dialokasikan > 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5">{ringkasan.job_belum_dialokasikan} belum dialokasikan</p>
            )}
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
            <Clock size={16} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-indigo-700 uppercase">Sedang Dikerjakan</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-indigo-600 font-mono">{statusCounts.dikerjakan || 0}</span>
              <span className="text-[10px] text-indigo-500">SPK</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Activity size={16} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase">Selesai Hari Ini</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-emerald-600 font-mono">{ringkasan?.selesai_hari_ini || 0}</span>
              <span className="text-[10px] text-emerald-600">SPK</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-3 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-amber-800 uppercase">Kendala</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-600 font-mono">{statusCounts.kendala || 0}</span>
              <span className="text-[10px] text-amber-700">Perlu Tindakan</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
            <AlertTriangle size={16} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Antrean Void Request */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-amber-700" />
              <div>
                <h2 className="text-xs font-bold text-slate-900">
                  {role === 'kordiv' ? 'Antrean Void Request (Tahap 1)' : 'Antrean Void Request (Final)'}
                </h2>
                <p className="text-[10px] text-slate-500">
                  {role === 'kordiv' ? 'Persetujuan awal sebelum diteruskan ke SPV/Owner' : 'Sudah disetujui Kordiv, menunggu keputusan Anda'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
              {voidQueue.length} Permintaan
            </span>
          </div>
          <div className="p-2 space-y-2 max-h-[480px] overflow-y-auto">
            {voidQueue.length === 0 ? (
              <p className="text-[11px] text-slate-400 text-center py-8">Tidak ada void request menunggu persetujuan.</p>
            ) : (
              voidQueue.map((req) => (
                <div key={req.id} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-indigo-700">{req.sale_nomor}</span>
                      <p className="text-[11px] text-slate-700 mt-0.5">
                        Pemohon: <strong>{req.diminta_oleh_nama || '-'}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 text-[11px] border border-slate-100 text-slate-600 italic">
                    "{req.alasan}"
                  </div>
                  {rejectingId === req.id ? (
                    <div className="space-y-1.5 bg-red-50/40 p-2 rounded border border-red-100">
                      <textarea
                        rows={2}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Alasan penolakan (wajib)..."
                        className="w-full text-[11px] p-1.5 rounded border border-red-200 focus:outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => { setRejectingId(null); setRejectReason(''); }}
                          className="px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100 rounded"
                        >
                          Batal
                        </button>
                        <button
                          disabled={voidActionLoading === req.id || !rejectReason.trim()}
                          onClick={() => submitVoidReject(req)}
                          className="px-2 py-1 text-[10px] font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded"
                        >
                          Kirim Penolakan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        disabled={voidActionLoading === req.id}
                        onClick={() => setRejectingId(req.id)}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
                      >
                        <X size={12} /> Tolak
                      </button>
                      <button
                        disabled={voidActionLoading === req.id}
                        onClick={() => handleVoidApprove(req)}
                        className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1"
                      >
                        <Check size={12} /> Setujui
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Distribusi Job */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900">Distribusi Job Tim ({filteredJobs.length})</h2>
              <button onClick={fetchAll} className="text-slate-400 hover:text-slate-700" title="Segarkan">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {tahapOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTahapFilter(t)}
                    className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      tahapFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-48 shrink-0">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari SPK/Produk/Staff..."
                  className="w-full text-xs pl-7 pr-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-semibold text-slate-500 uppercase">
                  <th className="py-2 px-2.5">SPK</th>
                  <th className="py-2 px-2.5">Produk</th>
                  <th className="py-2 px-2.5">Tahap</th>
                  <th className="py-2 px-2.5">Staff</th>
                  <th className="py-2 px-2.5">Deadline</th>
                  <th className="py-2 px-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-[11px]">
                      Tidak ada job yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => {
                    const dl = formatDeadline(job.deadline);
                    return (
                      <tr key={job.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-2.5 font-mono font-bold text-indigo-700 align-top">{job.nomor_sumber || job.id}</td>
                        <td className="py-2 px-2.5 align-top max-w-[160px] truncate" title={job.nama_produk}>{job.nama_produk}</td>
                        <td className="py-2 px-2.5 align-top">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {job.tahap_nama || '-'}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 align-top relative">
                          {job.pic_nama ? (
                            <span className="text-[11px] font-medium text-slate-800">{job.pic_nama}</span>
                          ) : (
                            <>
                              <button
                                onClick={() => setAssignMenuJobId(assignMenuJobId === job.id ? null : job.id)}
                                className="px-2 py-1 text-[10px] font-semibold rounded-md border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1"
                              >
                                <UserPlus size={11} /> Assign
                              </button>
                              {assignMenuJobId === job.id && (
                                <div className="absolute left-0 mt-1 w-44 rounded-lg bg-white shadow-lg border border-slate-200 z-30 py-1 text-xs">
                                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase">Pilih Staff</div>
                                  {(ringkasan?.beban_staff || []).length === 0 ? (
                                    <p className="px-2 py-1.5 text-[11px] text-slate-400">Tidak ada staff bawahan.</p>
                                  ) : (
                                    ringkasan.beban_staff.map((s) => (
                                      <button
                                        key={s.staff_id}
                                        disabled={assignLoading === job.id}
                                        onClick={() => handleAssign(job.id, s.staff_id)}
                                        className="w-full text-left px-2 py-1.5 hover:bg-indigo-50 text-slate-700 font-medium disabled:opacity-50"
                                      >
                                        {s.nama}
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-2 px-2.5 align-top">
                          {typeof dl === 'object' ? (
                            <span className={`text-[11px] font-medium ${dl.isPast ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                              {dl.label}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">{dl}</span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-right align-top">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${STATUS_BADGE[job.status_pekerjaan] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {STATUS_LABEL[job.status_pekerjaan] || job.status_pekerjaan}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Perbandingan Antar Divisi -- khusus SPV (mengawasi lintas Kordiv/
          divisi sekaligus), tidak relevan untuk Kordiv yang cuma 1 divisi. */}
      {role === 'spv' && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Building2 size={14} className="text-indigo-700" />
            <h2 className="text-xs font-bold text-slate-900">Perbandingan Antar Divisi</h2>
          </div>
          {(ringkasan?.beban_divisi || []).length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-4">Belum ada job di divisi bawahan Anda.</p>
          ) : (
            <div className="space-y-2">
              {(() => {
                const maxAktif = Math.max(...ringkasan.beban_divisi.map((d) => d.job_aktif), 1);
                return ringkasan.beban_divisi.map((d) => (
                  <div key={d.divisi_id} className="flex items-center gap-3">
                    <div className="w-40 shrink-0 text-[11px] font-semibold text-slate-800 truncate" title={d.nama}>
                      {d.nama}
                    </div>
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden relative">
                      <div
                        className={`h-full rounded ${d.kendala > 0 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${(d.job_aktif / maxAktif) * 100}%` }}
                      />
                    </div>
                    <div className="w-40 shrink-0 text-[10px] text-slate-500 text-right">
                      <span className="font-bold text-slate-800">{d.job_aktif}</span> aktif
                      {' · '}
                      <span className="font-bold text-emerald-600">{d.selesai_hari_ini}</span> selesai hari ini
                      {d.kendala > 0 && (
                        <>
                          {' · '}
                          <span className="font-bold text-amber-700">{d.kendala}</span> kendala
                        </>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Beban Kerja Staff */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Users size={14} className="text-indigo-700" />
          <h2 className="text-xs font-bold text-slate-900">Beban Kerja Staff Tim</h2>
        </div>
        {(ringkasan?.beban_staff || []).length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-4">Belum ada staff bawahan.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {ringkasan.beban_staff.map((s) => (
              <div key={s.staff_id} className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">{s.nama}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    {s.job_aktif} Aktif
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Minggu ini: {s.selesai_minggu_ini}/{s.total_minggu_ini}</span>
                    <span className="font-bold">
                      {s.persen_selesai_minggu_ini === null ? '-' : `${s.persen_selesai_minggu_ini}%`}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${s.persen_selesai_minggu_ini || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pemakaian Mesin -- dipindah dari RingkasanTim.jsx lama (halaman
          landing SPV/Kordiv) supaya tidak hilang saat halaman itu diganti
          memakai komponen ini. */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <Printer size={14} className="text-indigo-700" />
          <h2 className="text-xs font-bold text-slate-900">Pemakaian Mesin oleh Tim</h2>
        </div>
        {(ringkasan?.pemakaian_mesin || []).length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-4">Belum ada catatan pemakaian mesin dari tim Anda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-semibold text-slate-500 uppercase">
                  <th className="py-2 px-2.5">Mesin</th>
                  <th className="py-2 px-2.5 text-center">Jumlah Pemakaian</th>
                  <th className="py-2 px-2.5 text-center">Total Lembar Color</th>
                  <th className="py-2 px-2.5 text-center">Total Lembar Mono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ringkasan.pemakaian_mesin.map((row) => (
                  <tr key={row.mesin__nama || 'tanpa-mesin'}>
                    <td className="py-2 px-2.5 font-medium text-slate-700">{row.mesin__nama || '(Tanpa nama mesin)'}</td>
                    <td className="py-2 px-2.5 text-center text-slate-600">{row.jumlah_pemakaian}</td>
                    <td className="py-2 px-2.5 text-center text-slate-600">{row.total_lembar_color ?? 0}</td>
                    <td className="py-2 px-2.5 text-center text-slate-600">{row.total_lembar_mono ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
