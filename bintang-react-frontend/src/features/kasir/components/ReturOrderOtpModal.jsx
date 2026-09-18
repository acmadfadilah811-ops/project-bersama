import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, KeyRound, Loader2, RotateCcw, X, XCircle } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const POLL_MS = 4000;

/**
 * Konfirmasi retur untuk kasir -- sejak 2026-09-18 butuh persetujuan OTP
 * owner (lihat api/services/order_return_otp.py), pola identik dengan
 * VoidOrderOtpModal.jsx. Beda dari void: mengajukan retur berstatus
 * 'Tunda' TETAP bebas tanpa OTP (dibuat lewat form retur biasa) -- modal
 * ini KHUSUS untuk langkah KONFIRMASI (Tunda -> Dikonfirmasi) yang
 * memicu pemulihan stok + jurnal pembalik, jadi butuh `returId` (id
 * PengembalianOrder yang sudah ada, status Tunda) selain `order`.
 *
 * Owner/manager/admin TIDAK memakai modal ini -- mereka bisa langsung
 * PATCH /pengembalian/{id}/ status=Dikonfirmasi tanpa OTP.
 */
export default function ReturOrderOtpModal({ isOpen, onClose, order, returId, onConfirmed }) {
  const [step, setStep] = useState('alasan'); // 'alasan' | 'menunggu' | 'disetujui'
  const [alasan, setAlasan] = useState('');
  const [returnRequest, setReturnRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const cekPermintaanAktif = useCallback(async () => {
    if (!order) return;
    try {
      const res = await apiClient.get('/order-return-requests/', { params: { order: order.id } });
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      const terbaru = list[0];
      if (!terbaru) return;
      if (terbaru.status === 'pending' || (terbaru.status === 'disetujui' && !terbaru.kadaluarsa)) {
        setReturnRequest(terbaru);
        setStep('menunggu');
      } else if (terbaru.status === 'ditolak') {
        setReturnRequest(terbaru);
        setStep('alasan');
      }
    } catch {
      /* biarkan kasir mulai dari form alasan kalau gagal cek */
    }
  }, [order]);

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      return;
    }
    setStep('alasan');
    setAlasan('');
    setReturnRequest(null);
    setErrorMsg('');
    cekPermintaanAktif();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, order?.id]);

  useEffect(() => {
    stopPolling();
    if (step !== 'menunggu' || !order) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiClient.get('/order-return-requests/', { params: { order: order.id } });
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        const terbaru = list[0];
        if (!terbaru) return;
        setReturnRequest(terbaru);
        if (terbaru.status === 'ditolak') {
          setStep('alasan');
        } else if (terbaru.status === 'disetujui' && terbaru.kadaluarsa) {
          setErrorMsg('Kode OTP sudah kadaluarsa. Silakan ajukan permintaan baru.');
          setStep('alasan');
          setReturnRequest(null);
        }
      } catch {
        /* abaikan kegagalan poll sesaat, coba lagi di interval berikutnya */
      }
    }, POLL_MS);
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, order?.id]);

  useEffect(() => stopPolling, [stopPolling]);

  if (!isOpen || !order || !returId) return null;

  const handleAjukan = async (e) => {
    e.preventDefault();
    if (!alasan.trim()) {
      setErrorMsg('Alasan konfirmasi retur wajib diisi.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post(`/orders/${order.id}/minta-otp-retur/`, { alasan: alasan.trim() });
      setReturnRequest(res.data);
      setStep('menunggu');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Gagal mengirim permintaan OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleKonfirmasi = async () => {
    if (!returnRequest?.otp_code) return;
    setConfirming(true);
    setErrorMsg('');
    try {
      await apiClient.patch(`/pengembalian/${returId}/`, {
        status: 'Dikonfirmasi',
        return_request_id: returnRequest.id,
        otp_code: returnRequest.otp_code,
      });
      onConfirmed?.();
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Gagal mengonfirmasi retur.');
    } finally {
      setConfirming(false);
    }
  };

  const sudahDisetujui = returnRequest?.status === 'disetujui' && returnRequest?.otp_code;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
        <div className="bg-amber-600 px-6 py-4 text-white flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <RotateCcw size={20} />
            </div>
            <h3 className="font-extrabold text-base tracking-wide">Konfirmasi Retur (Perlu Persetujuan Owner)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-7 space-y-5 bg-white text-sm">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold">{errorMsg}</div>
          )}

          {step === 'alasan' && (
            <form onSubmit={handleAjukan} className="space-y-5">
              {returnRequest?.status === 'ditolak' && (
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold">
                  Permintaan sebelumnya ditolak owner
                  {returnRequest.alasan_tolak ? `: "${returnRequest.alasan_tolak}"` : '.'} Silakan ajukan ulang.
                </div>
              )}
              <p className="text-xs text-slate-500 font-semibold">
                Retur ini sudah tercatat status "Tunda". Mengonfirmasinya (stok otomatis ditambahkan
                kembali) butuh persetujuan owner terlebih dahulu.
              </p>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-2">Alasan Konfirmasi Retur</label>
                <input
                  type="text"
                  placeholder="Masukkan alasan konfirmasi retur..."
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  className="w-full border-b-2 border-amber-500 pb-2 text-sm font-bold text-slate-900 focus:outline-none bg-transparent"
                  required
                  autoFocus
                />
                <span className="text-xs text-slate-400 font-semibold block mt-1.5">
                  Permintaan akan dikirim ke owner untuk disetujui sebelum retur bisa dikonfirmasi.
                </span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Kirim Permintaan OTP ke Owner
              </button>
            </form>
          )}

          {step === 'menunggu' && !sudahDisetujui && (
            <div className="text-center py-6 space-y-3">
              <Clock size={32} className="mx-auto text-amber-500 animate-pulse" />
              <p className="text-sm font-bold text-slate-700">Menunggu persetujuan owner...</p>
              <p className="text-xs text-slate-500">
                Alasan: <span className="italic">"{returnRequest?.alasan}"</span>
              </p>
              <p className="text-[11px] text-slate-400">
                Kode OTP akan otomatis muncul di sini begitu owner menyetujui.
              </p>
            </div>
          )}

          {step === 'menunggu' && sudahDisetujui && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
              <p className="text-sm font-bold text-slate-700">Disetujui owner</p>
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
                <KeyRound size={18} className="text-emerald-600" />
                <span className="text-2xl font-black tracking-[0.3em] text-emerald-700">
                  {returnRequest.otp_code}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Kode berlaku 15 menit sejak disetujui.</p>
              <button
                type="button"
                disabled={confirming}
                onClick={handleKonfirmasi}
                className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {confirming ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                Konfirmasi Retur
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
