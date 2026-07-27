import { X, Lock, Send, RefreshCw } from 'lucide-react';

/** Modal staff — input OTP yang diberikan oleh admin */
export default function StaffOtpModal({ modal, orderMap, onSubmit, onRequestOtp, onClose }) {
  if (!modal) return null;
  const { job } = modal;

  const handleSubmit = (e) => {
    e.preventDefault();
    const inputOtp = e.target.otp.value.trim();
    if (!job.otp_sent || !job.otp_code) {
      alert(
        'Admin belum mengirimkan kode OTP untuk job ini. Silakan klik "Minta OTP" terlebih dahulu.'
      );
      return;
    }
    if (inputOtp === job.otp_code) {
      onSubmit(job); // OTP valid → buka ForwardModal
    } else {
      alert('Kode OTP tidak valid! Silakan masukkan kode 6 digit yang dikirimkan oleh Admin.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-amber-400" />
            <h2 className="font-bold text-xs">Verifikasi Tahap Akhir</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-center">
          <p className="text-xs text-slate-600 mb-2">
            Pekerjaan <strong>#{orderMap[job.order_item]?.orderId}</strong> hampir selesai. Minta
            kode 6 digit dari Admin untuk meneruskan job ini.
          </p>

          {/* Bagian Status OTP */}
          {job.otp_sent && job.otp_code ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 my-2">
              <span className="text-[10px] text-emerald-700 font-bold block mb-1">
                OTP DISETUJUI ADMIN:
              </span>
              <span className="font-mono text-2xl font-black text-emerald-800 tracking-[0.2em]">
                {job.otp_code}
              </span>
              <p className="text-[9px] text-emerald-600 mt-1">
                Gunakan kode di atas pada kolom verifikasi di bawah.
              </p>
            </div>
          ) : job.otp_requested ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 my-2 text-xs text-amber-700 font-semibold flex flex-col items-center gap-1.5 animate-pulse">
              <RefreshCw size={16} className="animate-spin text-amber-500" />
              <span>Permohonan OTP sedang menunggu respon Admin...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onRequestOtp(job.id)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Send size={12} /> Minta OTP dari Admin
            </button>
          )}

          <form onSubmit={handleSubmit} className="p-1 space-y-4 pt-4 border-t border-slate-100">
            <input
              type="text"
              name="otp"
              maxLength={6}
              required
              placeholder="Masukkan 6 Digit OTP"
              className="w-full text-center font-mono text-xl font-bold tracking-[0.2em] py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs shadow-md"
            >
              Verifikasi Kode Akses
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
