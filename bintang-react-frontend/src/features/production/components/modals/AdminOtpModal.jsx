import { ShieldCheck, Lock, Send, Copy, X } from 'lucide-react';

/** Modal admin — menampilkan kode OTP untuk dikirimkan ke staff */
export default function AdminOtpModal({ modal, orderMap, onSendOtp, onClose }) {
  if (!modal) return null;
  const { job, otpCode } = modal;

  const orderId = orderMap[job.order_item]?.orderId || '...';
  const jenisProduk = orderMap[job.order_item]?.jenisProduk || '...';

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-center animate-fade-in">
        <div className="bg-indigo-700 text-white py-4 px-4 flex flex-col items-center gap-2 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-indigo-200 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
          <ShieldCheck size={40} className="text-indigo-200" />
          <h2 className="font-bold text-sm">Otorisasi Kode OTP</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-600">
            Berikut adalah kode OTP untuk pekerjaan{' '}
            <strong className="text-slate-800">
              {jenisProduk} (#{orderId})
            </strong>{' '}
            yang ditugaskan ke{' '}
            <strong className="text-slate-800">{job.pic_nama || 'Operator'}</strong>.
          </p>

          <div className="bg-slate-100 border border-slate-300 rounded-lg py-4 px-6 inline-block mx-auto shadow-inner">
            <span className="font-mono text-4xl font-black text-slate-800 tracking-[0.2em]">
              {otpCode}
            </span>
          </div>

          <p className="text-[10px] text-slate-500 font-medium">
            Klik tombol di bawah untuk mengirimkan kode ini secara langsung ke papan pekerjaan
            staff.
          </p>

          <p className="text-[10px] text-red-500 font-bold flex items-center justify-center gap-1 mt-2 animate-pulse">
            <Lock size={10} /> Bersifat rahasia dan sekali pakai.
          </p>
        </div>

        {/* Bagian Bawah: Opsi Pengiriman OTP */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex gap-2.5">
          <button
            onClick={() => {
              navigator.clipboard.writeText(otpCode);
              alert('Kode OTP disalin ke clipboard!');
            }}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Copy size={14} /> Salin Kode
          </button>
          <button
            onClick={() => {
              onSendOtp(job.id);
              alert('Kode OTP berhasil dikirim ke papan pekerjaan staff!');
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
          >
            <Send size={14} /> Kirim OTP ke Staff
          </button>
        </div>
      </div>
    </div>
  );
}
