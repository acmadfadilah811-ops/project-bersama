import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../api/apiClient';
import {
  User,
  Lock,
  AlertTriangle,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import loginDashboardBg from '../../../assets/login_dashboard_bg.jpg';
import { semuaKriteriaTerpenuhi, formatSisaWaktu } from '../utils/kriteriaSandi';
import { pesanLoginGagal, detikKunciLogin, otpUnlockDitawarkan, cakupanKunci } from '../utils/pesanLogin';
import SandiChecklist from '../components/SandiChecklist';

// Sesi lupa-password disimpan sementara agar tidak hilang saat halaman dimuat ulang
// (OTP berlaku 15 menit dan kirim ulang baru boleh setelah 15 menit).
const KUNCI_SESI_LUPA = 'lupaSandiSesi';
const bacaSesiLupa = () => {
  try {
    const s = JSON.parse(sessionStorage.getItem(KUNCI_SESI_LUPA) || 'null');
    if (s && s.token && s.username && s.bolehKirimUlangPada > Date.now() - 1000) return s;
  } catch {
    /* sessionStorage tidak tersedia -> abaikan */
  }
  return null;
};
const simpanSesiLupa = (s) => {
  try {
    if (s) sessionStorage.setItem(KUNCI_SESI_LUPA, JSON.stringify(s));
    else sessionStorage.removeItem(KUNCI_SESI_LUPA);
  } catch {
    /* abaikan */
  }
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  // Toggle lihat/sembunyikan password -- sebelumnya tidak ada sama sekali,
  // cuma mengandalkan ikon mata bawaan browser (kadang tidak konsisten
  // munculnya, mis. baru muncul setelah field dikosongkan ulang). Kunci
  // object per-field, pola sama seperti showPw di Settings.jsx (Ganti
  // Password) yang sudah benar.
  const [showPw, setShowPw] = useState({});
  // Kuirk Chrome/Edge: field yang nilainya diisi autofill password manager
  // browser kadang tidak menggambar ulang teks aslinya walau atribut type
  // sudah berubah jadi "text" -- baru "muncul" setelah field diketik/
  // dihapus manual (keluhan user 2026-09-22, sama di HR/CRM). Ref per-field
  // + nudge fokus/kursor sesudah re-render memaksa browser gambar ulang.
  const pwInputRefs = useRef({});
  const nudgePasswordRedraw = (key) => {
    requestAnimationFrame(() => {
      const el = pwInputRefs.current[key];
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  // OTP Verification States
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');

  // Forgot Password States
  const [forgotPasswordMode, setForgotPasswordMode] = useState(''); // '', 'request', 'verify'
  const [forgotUsername, setForgotPasswordUsername] = useState('');
  const [forgotOtp, setForgotPasswordOtp] = useState('');
  const [forgotNewPassword, setForgotPasswordNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotPasswordConfirmPassword] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [bolehKirimUlangPada, setBolehKirimUlangPada] = useState(0); // epoch ms
  const [sisaDetik, setSisaDetik] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');
  const [kunciSampai, setKunciSampai] = useState(0); // epoch ms; 0 = tidak terkunci
  const [sisaKunci, setSisaKunci] = useState(0);
  const [cakupanKunciNow, setCakupanKunciNow] = useState(null); // 'akun' | 'ip' | null
  const [otpUnlock, setOtpUnlock] = useState(''); // kode OTP pembuka kunci (opsional)
  const [otpUnlockDikirim, setOtpUnlockDikirim] = useState(false);
  const [otpUnlockLoading, setOtpUnlockLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // AKS-06: IdleLogoutGuard mengalihkan ke sini dgn state.alasan='idle' saat
  // sesi ditutup otomatis (30 menit tanpa aktivitas). Tampilkan sekali saja --
  // history.replace mencegah pesan muncul lagi kalau user menekan Back.
  useEffect(() => {
    if (location.state?.alasan === 'idle') {
      setSuccessMsg('Sesi berakhir karena tidak ada aktivitas selama 30 menit. Silakan masuk kembali.');
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Pulihkan sesi lupa-password yang masih berjalan (mis. setelah halaman dimuat ulang).
  useEffect(() => {
    const sesi = bacaSesiLupa();
    if (sesi) {
      setForgotPasswordUsername(sesi.username);
      setForgotResetToken(sesi.token);
      setBolehKirimUlangPada(sesi.bolehKirimUlangPada);
      setForgotPasswordMode('verify');
    }
  }, []);

  // Hitung mundur masa kunci login.
  useEffect(() => {
    const hitung = () => {
      const sisa = Math.max(0, Math.ceil((kunciSampai - Date.now()) / 1000));
      setSisaKunci(sisa);
      if (sisa === 0 && kunciSampai) setKunciSampai(0);
    };
    hitung();
    if (!kunciSampai) return undefined;
    const id = setInterval(hitung, 1000);
    return () => clearInterval(id);
  }, [kunciSampai]);

  // Hitung mundur jeda kirim ulang OTP.
  useEffect(() => {
    const hitung = () =>
      setSisaDetik(Math.max(0, Math.ceil((bolehKirimUlangPada - Date.now()) / 1000)));
    hitung();
    if (!bolehKirimUlangPada) return undefined;
    const id = setInterval(hitung, 1000);
    return () => clearInterval(id);
  }, [bolehKirimUlangPada]);

  // Dipakai untuk permintaan pertama maupun kirim ulang. Server menegakkan jeda 15 menit.
  const kirimOtp = async ({ kirimUlang = false } = {}) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiClient.post('/auth/forgot-password/request/', {
        username: forgotUsername.trim(),
      });
      const token = res.data.reset_token;
      const bolehLagi = Date.now() + (res.data.resend_after || 900) * 1000;
      setForgotResetToken(token);
      setBolehKirimUlangPada(bolehLagi);
      simpanSesiLupa({ username: forgotUsername.trim(), token, bolehKirimUlangPada: bolehLagi });
      setForgotPasswordOtp('');
      setForgotPasswordMode('verify');
      if (kirimUlang) {
        setSuccessMsg('Kode OTP baru sudah dikirim. Kode sebelumnya tidak berlaku lagi.');
      }
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 429 && data?.retry_after) {
        const bolehLagi = Date.now() + data.retry_after * 1000;
        setBolehKirimUlangPada(bolehLagi);
        const sesi = bacaSesiLupa();
        if (sesi && sesi.username === forgotUsername.trim()) {
          // OTP sebelumnya masih berlaku: lanjut ke layar verifikasi.
          setForgotResetToken(sesi.token);
          setForgotPasswordMode('verify');
        } else {
          setError(`${data.detail} Coba lagi dalam ${formatSisaWaktu(data.retry_after)} menit.`);
        }
      } else {
        setError(data?.detail || 'Gagal mengirim kode OTP. Coba lagi nanti.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestForgotPassword = async (e) => {
    e.preventDefault();
    await kirimOtp();
  };

  const handleVerifyForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Password baru dan konfirmasi tidak cocok.');
      return;
    }
    if (!semuaKriteriaTerpenuhi(forgotNewPassword, forgotUsername)) {
      setError('Kata sandi baru belum memenuhi semua kriteria.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiClient.post('/auth/forgot-password/verify/', {
        username: forgotUsername.trim(),
        otp: forgotOtp,
        new_password: forgotNewPassword,
        reset_token: forgotResetToken,
      });
      simpanSesiLupa(null);
      setSuccessMsg(res.data.detail || 'Password berhasil diubah. Silakan login.');
      setForgotPasswordMode('');
      setForgotPasswordUsername('');
      setForgotPasswordOtp('');
      setForgotPasswordNewPassword('');
      setForgotPasswordConfirmPassword('');
      setForgotResetToken('');
      setBolehKirimUlangPada(0);
    } catch (err) {
      setError(err.response?.data?.detail || 'Kode OTP salah atau sandi terlalu lemah.');
    } finally {
      setLoading(false);
    }
  };

  const handleKirimOtpUnlock = async () => {
    setOtpUnlockLoading(true);
    try {
      await apiClient.post('/auth/login/unlock-otp/', { username });
      setOtpUnlockDikirim(true);
    } finally {
      setOtpUnlockLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = { username, password };
      if (otpUnlock) payload.otp = otpUnlock;
      const res = await apiClient.post('/auth/login/', payload);
      setKunciSampai(0);
      setCakupanKunciNow(null);
      setOtpUnlock('');
      setOtpUnlockDikirim(false);

      if (res.data?.detail === 'VERIFICATION_REQUIRED') {
        setVerificationRequired(true);
        setTempToken(res.data.temp_token);
        setMaskedEmail(res.data.email_masked);
        setLoading(false);
        return;
      }

      const { access, refresh, user: userData } = res.data;

      login(userData, access, refresh);

      if (userData?.role?.toLowerCase() === 'staff') {
        navigate('/staff-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const detikKunci = detikKunciLogin(err);
      if (detikKunci) setKunciSampai(Date.now() + detikKunci * 1000);
      setCakupanKunciNow(otpUnlockDitawarkan(err) ? cakupanKunci(err) : null);
      setError(pesanLoginGagal(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/verify-login/', { temp_token: tempToken, otp });
      const { access, refresh, user: userData } = res.data;

      login(userData, access, refresh);

      if (userData?.role?.toLowerCase() === 'staff') {
        navigate('/staff-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Kode OTP salah atau kedaluwarsa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Satu gambar penuh layar (bukan dipotong dua panel) — gambarnya sendiri
    // sudah didesain dengan ruang kosong di sisi kanan supaya form login
    // muat diletakkan di situ, jadi form cukup diposisikan di area kosong
    // itu, bukan gambarnya yang dipaksa pas ke kotak terpisah.
    <div
      className="min-h-screen w-full flex items-center justify-center lg:justify-end bg-cover bg-center bg-no-repeat font-sans p-6 sm:p-10 lg:pr-20 xl:pr-28"
      style={{ backgroundImage: `url(${loginDashboardBg})`, backgroundColor: '#f9f8fd' }}
    >
      {/* Form Container - di layar besar diletakkan di ruang kosong sisi
          kanan gambar (justify-end); di layar kecil tetap di tengah supaya
          tidak mepet ke tepi. */}
      <div className="relative z-10 w-full max-w-[400px] p-8 flex flex-col gap-6 bg-white/70 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none rounded-2xl">
        {/* Tampilan OTP Verification jika IP Berubah */}
        {verificationRequired ? (
          <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-5">
            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="w-14 h-14 bg-rose-50 text-rose-500 flex items-center justify-center rounded-full border border-rose-200">
                <ShieldAlert size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-wide">Verifikasi Keamanan</h2>
              <p className="text-sm text-slate-500">
                Deteksi IP baru. Kami telah mengirimkan kode OTP 6 digit ke email{' '}
                <span className="text-rose-500 font-semibold">{maskedEmail}</span>. Silakan masukkan
                kode untuk masuk.
              </p>
            </div>

            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm p-3 rounded-lg flex items-center justify-center gap-2">
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* OTP Input */}
            <div className="flex flex-col gap-1.5">
              <input
                type="text"
                id="otp"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full h-[52px] bg-slate-50 border border-slate-200 outline-none text-slate-800 text-center text-2xl font-bold tracking-[0.5em] placeholder-slate-300 focus:border-rose-500 focus:bg-white transition-all rounded-lg"
                placeholder="000000"
                required
                autoFocus
              />
            </div>

            {/* Tombol Verifikasi */}
            <div className="grid mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold h-[52px] transition-colors disabled:opacity-50 text-[16px] shadow-lg shadow-blue-950/20 rounded-lg cursor-pointer"
              >
                {loading ? 'Memverifikasi...' : 'VERIFIKASI OTP'}
              </button>
            </div>

            {/* Tombol Kembali ke Login Biasa */}
            <button
              type="button"
              onClick={() => {
                setVerificationRequired(false);
                setError('');
                setOtp('');
              }}
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 text-sm transition-colors mt-2 cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Login</span>
            </button>
          </form>
        ) : forgotPasswordMode === 'request' ? (
          <form
            onSubmit={handleRequestForgotPassword}
            className="w-full flex flex-col gap-5 animate-fade-in"
          >
            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-500 flex items-center justify-center rounded-full border border-indigo-200">
                <KeyRound size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-wide">Lupa Kata Sandi</h2>
              <p className="text-sm text-slate-500">
                Masukkan username Anda. Kode OTP pemulihan sandi akan dikirim ke email terdaftar
                Anda.
              </p>
            </div>

            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="flex h-[52px] shadow-sm rounded-lg overflow-hidden border border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all bg-slate-50">
              <div className="w-[52px] h-full bg-slate-100 flex items-center justify-center text-slate-400 border-r border-slate-200">
                <User size={20} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                value={forgotUsername}
                onChange={(e) => setForgotPasswordUsername(e.target.value)}
                className="flex-1 h-full bg-transparent px-4 outline-none text-slate-800 placeholder-slate-400 text-sm font-semibold"
                placeholder="Username"
                required
                autoFocus
              />
            </div>

            {/* Tombol Kirim */}
            <div className="grid mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold h-[52px] transition-colors disabled:opacity-50 text-[16px] shadow-lg shadow-blue-950/20 rounded-lg cursor-pointer"
              >
                {loading ? 'Mengirim OTP...' : 'KIRIM KODE OTP'}
              </button>
            </div>

            {/* Tombol Kembali ke Login Biasa */}
            <button
              type="button"
              onClick={() => {
                setForgotPasswordMode('');
                setError('');
              }}
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 text-sm transition-colors mt-2 cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Login</span>
            </button>
          </form>
        ) : forgotPasswordMode === 'verify' ? (
          <form
            onSubmit={handleVerifyForgotPassword}
            className="w-full flex flex-col gap-4 animate-fade-in"
          >
            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-500 flex items-center justify-center rounded-full border border-emerald-200">
                <ShieldAlert size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-wide">Ubah Kata Sandi</h2>
              <p className="text-sm text-slate-500">
                Jika akun <span className="text-indigo-500 font-semibold">{forgotUsername}</span>{' '}
                memiliki email terdaftar, kode OTP sudah dikirim ke sana (berlaku 15 menit).
                Masukkan OTP dan kata sandi baru Anda.
              </p>
            </div>

            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* OTP Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Kode OTP 6 Digit</label>
              <input
                type="text"
                maxLength={6}
                value={forgotOtp}
                onChange={(e) => setForgotPasswordOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full h-[45px] bg-slate-50 border border-slate-200 outline-none text-slate-800 text-center text-xl font-bold tracking-[0.5em] placeholder-slate-300 focus:border-indigo-500 rounded-lg"
                placeholder="000000"
                required
              />
            </div>

            {/* Password Baru */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Password Baru</label>
              <div className="relative">
                <input
                  ref={(el) => { pwInputRefs.current.baru = el; }}
                  type={showPw.baru ? 'text' : 'password'}
                  value={forgotNewPassword}
                  onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
                  className="w-full h-[45px] bg-slate-50 border border-slate-200 outline-none text-slate-800 px-3 pr-10 text-sm focus:border-indigo-500 rounded-lg"
                  placeholder="Password Baru"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setShowPw({ ...showPw, baru: !showPw.baru }); nudgePasswordRedraw('baru'); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw.baru ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Checklist kriteria: centang hijau / silang merah */}
              <SandiChecklist
                sandi={forgotNewPassword}
                konfirmasi={forgotConfirmPassword}
                username={forgotUsername}
              />
            </div>

            {/* Konfirmasi Password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <input
                  ref={(el) => { pwInputRefs.current.ulang = el; }}
                  type={showPw.ulang ? 'text' : 'password'}
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotPasswordConfirmPassword(e.target.value)}
                  className="w-full h-[45px] bg-slate-50 border border-slate-200 outline-none text-slate-800 px-3 pr-10 text-sm focus:border-indigo-500 rounded-lg"
                  placeholder="Konfirmasi Password"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setShowPw({ ...showPw, ulang: !showPw.ulang }); nudgePasswordRedraw('ulang'); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPw.ulang ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Tombol Submit */}
            <div className="grid mt-2">
              <button
                type="submit"
                disabled={
                  loading ||
                  forgotOtp.length !== 6 ||
                  !semuaKriteriaTerpenuhi(forgotNewPassword, forgotUsername) ||
                  forgotNewPassword !== forgotConfirmPassword
                }
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold h-[50px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[16px] shadow-lg shadow-blue-950/20 rounded-lg cursor-pointer"
              >
                {loading ? 'Mengubah Sandi...' : 'UBAH KATA SANDI'}
              </button>
            </div>

            {/* Kirim ulang OTP: jeda 15 menit (ditegakkan juga di server) */}
            <button
              type="button"
              onClick={() => kirimOtp({ kirimUlang: true })}
              disabled={loading || sisaDetik > 0}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
            >
              {sisaDetik > 0
                ? `Kirim ulang OTP tersedia dalam ${formatSisaWaktu(sisaDetik)}`
                : 'Kirim ulang kode OTP'}
            </button>

            {/* Tombol Kembali ke Request */}
            <button
              type="button"
              onClick={() => {
                setForgotPasswordMode('request');
                setError('');
                setSuccessMsg('');
              }}
              className="flex items-center justify-center gap-2 text-slate-400 hover:text-slate-700 text-sm transition-colors mt-2 cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Ganti Username</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            {/* Pesan Sukses */}
            {successMsg && (
              <div className="bg-emerald-600 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="flex h-[52px] shadow-sm rounded-lg overflow-hidden border border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all bg-slate-50">
              <div className="w-[52px] h-full bg-slate-100 flex items-center justify-center text-slate-400 border-r border-slate-200">
                <User size={20} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 h-full bg-transparent px-4 outline-none text-slate-800 placeholder-slate-400 text-sm font-semibold"
                placeholder="Username"
                required
                autoFocus
              />
            </div>

            {/* Password Input */}
            <div className="flex h-[52px] shadow-sm rounded-lg overflow-hidden border border-slate-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-all bg-slate-50">
              <div className="w-[52px] h-full bg-slate-100 flex items-center justify-center text-slate-400 border-r border-slate-200">
                <Lock size={20} strokeWidth={2.5} />
              </div>
              <input
                ref={(el) => { pwInputRefs.current.login = el; }}
                type={showPw.login ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 h-full bg-transparent px-4 outline-none text-slate-800 placeholder-slate-400 text-sm font-semibold tracking-wider"
                placeholder="Password"
                required
              />
              <button
                type="button"
                onClick={() => { setShowPw({ ...showPw, login: !showPw.login }); nudgePasswordRedraw('login'); }}
                className="w-[52px] h-full flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                tabIndex={-1}
              >
                {showPw.login ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Pemberitahuan login (di bawah kolom password): tetap tampil sampai percobaan berikutnya */}
            {(error || sisaKunci > 0) && (
              <div
                role="alert"
                className="-mt-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg flex items-start gap-2"
              >
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span>{error}</span>
                  {sisaKunci > 0 && (
                    <span className="font-bold">
                      Coba lagi dalam {formatSisaWaktu(sisaKunci)} menit.
                    </span>
                  )}
                  {cakupanKunciNow && (
                    <div className="mt-1 pt-2 border-t border-red-200 flex flex-col gap-1.5">
                      {!otpUnlockDikirim ? (
                        <>
                          <span className="text-xs text-red-600">
                            Tidak mau menunggu? Verifikasi lewat OTP yang dikirim ke email akun ini.
                          </span>
                          <button
                            type="button"
                            onClick={handleKirimOtpUnlock}
                            disabled={otpUnlockLoading || !username}
                            className="self-start text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
                          >
                            {otpUnlockLoading ? 'Mengirim OTP...' : 'Kirim OTP verifikasi login'}
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-emerald-700">
                            OTP terkirim (jika akun dan email cocok). Masukkan kodenya, lalu tekan Masuk lagi.
                          </span>
                          <input
                            type="text"
                            maxLength={6}
                            value={otpUnlock}
                            onChange={(e) => setOtpUnlock(e.target.value.replace(/\D/g, ''))}
                            placeholder="Kode OTP 6 digit"
                            className="w-full h-[40px] bg-white border border-red-200 outline-none text-slate-800 text-center text-lg font-bold tracking-[0.4em] rounded-lg focus:border-indigo-400"
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between mt-1">
              {/* Custom Checkbox Remember Me */}
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div
                  className={`w-[18px] h-[18px] border-2 border-slate-300 rounded flex items-center justify-center transition-colors group-hover:border-blue-400 ${remember ? 'bg-blue-500 border-blue-500' : 'bg-transparent'}`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  {remember && <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>}
                </div>
                <span className="text-[12px] font-bold text-slate-500 group-hover:text-slate-800 transition-colors">
                  Remember me
                </span>
              </label>

              {/* Forgot Password */}
              <button
                type="button"
                onClick={() => {
                  setForgotPasswordMode('request');
                  setError('');
                  setSuccessMsg('');
                }}
                className="flex items-center gap-1 group bg-transparent border-0 cursor-pointer text-left outline-none"
              >
                <span className="text-[12px] font-bold text-blue-600 group-hover:text-blue-700 transition-colors">
                  Lupa Password?
                </span>
              </button>
            </div>

            {/* Tombol LOG IN Merah Terang */}
            <div className="grid mt-4">
              <button
                type="submit"
                disabled={loading || (sisaKunci > 0 && otpUnlock.length !== 6)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold h-[52px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-[16px] shadow-lg shadow-blue-950/20 rounded-lg cursor-pointer"
              >
                {loading
                  ? 'Memuat...'
                  : sisaKunci > 0 && otpUnlock.length !== 6
                    ? 'AKUN DIKUNCI SEMENTARA'
                    : sisaKunci > 0
                      ? 'VERIFIKASI & MASUK'
                      : 'MASUK'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
