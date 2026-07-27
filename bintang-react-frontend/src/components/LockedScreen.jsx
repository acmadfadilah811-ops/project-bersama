import { useState } from 'react';
import apiClient from '../api/apiClient';
import { Lock, Clock, Send, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LockedScreen({ statusTerkunci, onRefresh }) {
  const { logout } = useAuth();
  const [alasan, setAlasan] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { sesi_aktif, unlock_request } = statusTerkunci;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!alasan.trim()) {
      setError('Harap isi alasan Anda.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiClient.post('/hr/unlock-request/', { alasan });
      onRefresh(); // Refresh data to get updated unlock_request status
    } catch (err) {
      setError(err.response?.data?.detail || 'Terjadi kesalahan saat mengirim permohonan.');
    } finally {
      setLoading(false);
    }
  };

  if (!sesi_aktif) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center animate-fade-in">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
            <Clock size={40} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Absensi Belum Dibuka</h2>
          <p className="text-slate-500 mb-6 leading-relaxed text-sm">
            Manager atau Owner belum memulai sesi absensi untuk hari ini. Silakan tunggu informasi
            lebih lanjut atau hubungi atasan Anda.
          </p>
          <button
            onClick={onRefresh}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors w-full shadow-md"
          >
            Refresh Halaman
          </button>
          <button
            onClick={logout}
            className="mt-4 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Keluar Akun
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-6 text-center animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-100 flex flex-col items-center">
        {unlock_request?.status === 'pending' ? (
          <>
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Clock size={40} className="text-blue-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Menunggu Persetujuan</h2>
            <p className="text-slate-500 mb-6 leading-relaxed text-sm">
              Permohonan buka akses Anda sedang direview oleh Manager.
            </p>
            <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-4 mb-6 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Alasan Anda:
              </span>
              <p className="text-sm font-medium text-slate-700">{unlock_request.alasan}</p>
            </div>
            <button
              onClick={onRefresh}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors w-full shadow-md"
            >
              Cek Status
            </button>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <Lock size={40} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">Akun Terkunci</h2>
            <p className="text-slate-500 mb-6 leading-relaxed text-sm">
              Waktu absen telah melewati batas maksimal. Anda harus meminta izin kepada
              Manager/Owner untuk membuka kembali akses sistem.
            </p>

            {unlock_request?.status === 'rejected' && (
              <div className="mb-4 bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-100 flex items-start gap-2 text-left w-full">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span>
                  Permohonan sebelumnya ditolak. Anda dapat mencoba mengirim ulang alasan yang lebih
                  jelas.
                </span>
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 text-red-700 text-xs font-medium p-2 rounded w-full">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full flex flex-col items-stretch">
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                placeholder="Tuliskan alasan keterlambatan Anda..."
                className="w-full text-sm border-2 border-slate-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 min-h-[100px] resize-none mb-4 transition-all"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors w-full shadow-md flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Send size={16} />
                )}
                Kirim Permohonan
              </button>
            </form>
          </>
        )}
        <button
          onClick={logout}
          className="mt-6 text-xs font-bold text-slate-400 hover:text-slate-600"
        >
          Keluar Akun
        </button>
      </div>
    </div>
  );
}
