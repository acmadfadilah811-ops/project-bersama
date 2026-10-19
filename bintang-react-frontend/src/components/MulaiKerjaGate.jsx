import { useState } from 'react';
import { Clock, Play, RefreshCw } from 'lucide-react';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';

// Suara sambutan ("selamat pagi") saat Mulai Kerja berhasil, sama seperti di dashboard karyawan.
function putarSuaraMulai() {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const dasar = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    new Audio(`${dasar}audio/checkin.mp3`).play().catch(() => {});
  } catch {
    // suara bersifat tambahan; abaikan bila gagal
  }
}

// Gerbang Mulai Kerja untuk SPV & Kordiv (2026-10-18): menu lain terkunci sampai
// tombol Mulai Kerja ditekan. Mulai Kerja butuh absen masuk di HR lebih dulu.
export default function MulaiKerjaGate({ statusAbsenHr, permintaanAkses, onSelesai, onMuatUlang }) {
  const { user, logout } = useAuth();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState('');
  const [formAkses, setFormAkses] = useState(false);
  const [alasan, setAlasan] = useState('');
  const disetujui = permintaanAkses?.status === 'approved';
  const menunggu = permintaanAkses?.status === 'pending';
  // Izin akses yang disetujui membebaskan syarat absen masuk di HR hari ini.
  const belumAbsenHr = (statusAbsenHr === 'belum' || statusAbsenHr === 'pulang') && !disetujui;

  const kirimAkses = async () => {
    if (!alasan.trim()) {
      setGalat('Alasan wajib diisi.');
      return;
    }
    setProses(true);
    setGalat('');
    try {
      await apiClient.post('/hr/unlock-request/', { alasan: alasan.trim(), jenis: 'tanpa_absen_hr' });
      setFormAkses(false);
      setAlasan('');
      onMuatUlang();
    } catch (err) {
      setGalat(err.response?.data?.detail || 'Gagal mengirim permintaan. Coba lagi.');
    } finally {
      setProses(false);
    }
  };

  const mulai = async () => {
    setProses(true);
    setGalat('');
    try {
      await apiClient.post('/hr/absensi/clock-in/', { catatan: '' });
      putarSuaraMulai();
      onSelesai();
    } catch (err) {
      setGalat(err.response?.data?.detail || 'Gagal memulai kerja. Coba lagi.');
    } finally {
      setProses(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <Clock size={26} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Mulai Kerja</h1>
        <p className="mt-1 text-sm text-slate-500">
          Halo {user?.nama_lengkap || user?.username}. Tekan Mulai Kerja untuk membuka menu hari ini.
        </p>

        {belumAbsenHr && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {statusAbsenHr === 'pulang'
              ? 'Anda sudah absen pulang di HR hari ini.'
              : 'Absen masuk dulu di aplikasi HR (HP atau web HR), lalu muat ulang status.'}
          </p>
        )}
        {disetujui && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Permintaan akses disetujui. Anda boleh Mulai Kerja tanpa absen di HR hari ini.
          </p>
        )}
        {menunggu && (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-left text-sm text-slate-700">
            Permintaan akses menunggu persetujuan Manager/Owner.
            <span className="mt-1 block text-xs italic text-slate-500">&ldquo;{permintaanAkses.alasan}&rdquo;</span>
          </p>
        )}
        {permintaanAkses?.status === 'rejected' && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Permintaan akses ditolak. Absen di HR dulu, atau hubungi Manager/Owner.
          </p>
        )}
        {galat && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{galat}</p>}

        <button
          type="button"
          onClick={mulai}
          disabled={proses || belumAbsenHr}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play size={16} /> {proses ? 'Memproses…' : 'Mulai Kerja'}
        </button>
        {belumAbsenHr && !menunggu && (
          formAkses ? (
            <div className="mt-3 space-y-2 text-left">
              <textarea
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                rows={3}
                placeholder="Alasan, mis. HP tertinggal di rumah"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={kirimAkses}
                  disabled={proses}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  Kirim Permintaan
                </button>
                <button
                  type="button"
                  onClick={() => { setFormAkses(false); setGalat(''); }}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFormAkses(true)}
              className="mt-3 w-full rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Tidak bisa absen di HP? Minta akses
            </button>
          )
        )}
        <button
          type="button"
          onClick={onMuatUlang}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={14} /> Muat ulang status
        </button>
        <button type="button" onClick={logout} className="mt-4 text-xs font-semibold text-slate-400 hover:text-slate-600">
          Keluar akun
        </button>
      </div>
    </div>
  );
}
