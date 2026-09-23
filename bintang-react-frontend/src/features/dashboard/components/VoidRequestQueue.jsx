import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Check, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

/**
 * Antrean persetujuan void request POS -- dipakai Owner/Manager/SPV/SPV
 * Finance (semua role di ROLE_FINAL_APPROVER, lihat
 * api/views/pos_void_requests.py). Diekstrak dari KordivSpvTeamBoard.jsx
 * 2026-09-23: tahap Kordiv dihapus dari alur void (instruksi user "void
 * request langsung ke SPV Finance saja"), jadi komponen ini sekarang cuma
 * 1 tahap -- dipakai di KordivSpvTeamBoard (untuk role spv) dan
 * SpvFinanceBoard (untuk role spv_finance).
 *
 * Ikut menarik status 'menunggu_spv' (bukan cuma 'pending') supaya
 * permintaan lama dari sebelum tahap Kordiv dihapus tidak nyangkut tanpa
 * pernah terlihat siapa pun.
 */
export default function VoidRequestQueue() {
  const [voidQueue, setVoidQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [voidActionLoading, setVoidActionLoading] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/pos-void-requests/', {
        params: { status: 'pending,menunggu_spv' },
      });
      setVoidQueue(Array.isArray(res.data) ? res.data : res.data?.results || []);
      setError(null);
    } catch (err) {
      console.error('Gagal memuat antrean void request:', err);
      setError('Gagal memuat antrean void request.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleApprove = async (req) => {
    setVoidActionLoading(req.id);
    try {
      const res = await apiClient.post(`/pos-void-requests/${req.id}/setujui/`);
      if (res.data.otp_code) {
        alert(`Disetujui. Kode OTP: ${res.data.otp_code} (berlaku 15 menit, otomatis terisi di layar kasir).`);
      }
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menyetujui permintaan void.');
    } finally {
      setVoidActionLoading(null);
    }
  };

  const submitReject = async (req) => {
    if (!rejectReason.trim()) return;
    setVoidActionLoading(req.id);
    try {
      await apiClient.post(`/pos-void-requests/${req.id}/tolak/`, {
        alasan_tolak: rejectReason.trim(),
      });
      setRejectingId(null);
      setRejectReason('');
      await fetchQueue();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal menolak permintaan void.');
    } finally {
      setVoidActionLoading(null);
    }
  };

  if (loading && voidQueue.length === 0 && !error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 flex items-center justify-center text-xs text-slate-400">
        Memuat antrean void request...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-xs text-red-600 flex items-center justify-between">
        {error}
        <button onClick={fetchQueue} className="font-bold text-red-700 hover:underline">Coba Lagi</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
      <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-amber-700" />
          <div>
            <h2 className="text-xs font-bold text-slate-900">Antrean Void Request</h2>
            <p className="text-[10px] text-slate-500">Persetujuan pembatalan transaksi POS</p>
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
                      onClick={() => submitReject(req)}
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
                    onClick={() => handleApprove(req)}
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
  );
}
