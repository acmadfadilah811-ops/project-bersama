import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import loginBg from '../../../assets/login_bg.jpg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);

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
  const [forgotMaskedEmail, setForgotPasswordMaskedEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRequestForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await apiClient.post('/auth/forgot-password/request/', {
        username: forgotUsername,
      });
      setForgotPasswordMaskedEmail(res.data.email_masked);
      setForgotPasswordMode('verify');
    } catch (err) {
      setError(
        err.response?.data?.detail || 'Username tidak ditemukan atau belum didaftarkan email.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyForgotPassword = async (e) => {
    e.preventDefault();
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Password baru dan konfirmasi tidak cocok.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/forgot-password/verify/', {
        username: forgotUsername,
        otp: forgotOtp,
        new_password: forgotNewPassword,
      });
      setSuccessMsg(res.data.detail || 'Password berhasil diubah. Silakan login.');
      setForgotPasswordMode('');
      setForgotPasswordUsername('');
      setForgotPasswordOtp('');
      setForgotPasswordNewPassword('');
      setForgotPasswordConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Kode OTP salah atau sandi terlalu lemah.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.post('/auth/login/', { username, password });

      if (res.data?.detail === 'VERIFICATION_REQUIRED') {
        setVerificationRequired(true);
        setTempToken(res.data.temp_token);
        setMaskedEmail(res.data.email_masked);
        setLoading(false);
        return;
      }

      const { access, refresh, user: userData } = res.data;

      localStorage.setItem('access_token', access);
      login(userData, access, refresh);

      if (userData?.role?.toLowerCase() === 'staff') {
        navigate('/staff-dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Username atau password salah.');
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

      localStorage.setItem('access_token', access);
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
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-900 font-sans">
      {/* Background Image (Gambar Gedung Perusahaan - Lokal) - Sesuai gambar asli tanpa digelapkan */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{
          backgroundImage: `url(${loginBg})`,
        }}
      ></div>

      {/* Efek Gradasi Cahaya Menyala di belakang form - Warna gradient cyan & violet yang modern */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[380px] bg-gradient-to-tr from-cyan-400/20 to-violet-500/20 blur-[100px] z-0 rounded-full pointer-events-none"></div>

      {/* Form Container (Card Transparan) */}
      <div className="relative z-10 w-full max-w-[440px] p-8 flex flex-col gap-6 bg-transparent rounded-2xl mt-4">
        {/* Tampilan OTP Verification jika IP Berubah */}
        {verificationRequired ? (
          <form onSubmit={handleVerifyOtp} className="w-full flex flex-col gap-5">
            <div className="flex flex-col items-center text-center gap-2 mb-2">
              <div className="w-14 h-14 bg-rose-500/20 text-rose-400 flex items-center justify-center rounded-full border border-rose-500/30">
                <ShieldAlert size={36} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">Verifikasi Keamanan</h2>
              <p className="text-sm text-gray-200">
                Deteksi IP baru. Kami telah mengirimkan kode OTP 6 digit ke email{' '}
                <span className="text-rose-400 font-semibold">{maskedEmail}</span>. Silakan masukkan
                kode untuk masuk.
              </p>
            </div>

            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600/90 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
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
                className="w-full h-[52px] bg-white/15 border border-white/25 outline-none text-white text-center text-2xl font-bold tracking-[0.5em] placeholder-white/40 focus:border-rose-500 focus:bg-white/25 transition-all rounded-lg"
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
                className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold h-[52px] transition-colors disabled:opacity-50 text-[16px] shadow-lg shadow-red-950/20 rounded-lg cursor-pointer"
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
              className="flex items-center justify-center gap-2 text-gray-300 hover:text-white text-sm transition-colors mt-2 cursor-pointer"
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
              <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 flex items-center justify-center rounded-full border border-indigo-500/30">
                <KeyRound size={36} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">Lupa Kata Sandi</h2>
              <p className="text-sm text-gray-200">
                Masukkan username Anda. Kode OTP pemulihan sandi akan dikirim ke email terdaftar
                Anda.
              </p>
            </div>

            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600/90 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="flex h-[52px] shadow-md rounded-lg overflow-hidden border border-white/20 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400 transition-all bg-white/10">
              <div className="w-[52px] h-full bg-white/10 flex items-center justify-center text-white/80 border-r border-white/15">
                <User size={20} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                value={forgotUsername}
                onChange={(e) => setForgotPasswordUsername(e.target.value)}
                className="flex-1 h-full bg-transparent px-4 outline-none text-white placeholder-white/60 text-sm font-semibold"
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
                className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold h-[52px] transition-colors disabled:opacity-50 text-[16px] shadow-lg shadow-red-950/20 rounded-lg cursor-pointer"
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
              className="flex items-center justify-center gap-2 text-gray-300 hover:text-white text-sm transition-colors mt-2 cursor-pointer"
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
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 flex items-center justify-center rounded-full border border-emerald-500/30">
                <ShieldAlert size={36} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">Ubah Kata Sandi</h2>
              <p className="text-sm text-gray-200">
                Kode OTP telah dikirim ke{' '}
                <span className="text-indigo-400 font-semibold">{forgotMaskedEmail}</span>. Masukkan
                OTP dan kata sandi baru Anda.
              </p>
            </div>

            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600/90 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* OTP Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">Kode OTP 6 Digit</label>
              <input
                type="text"
                maxLength={6}
                value={forgotOtp}
                onChange={(e) => setForgotPasswordOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full h-[45px] bg-white/15 border border-white/20 outline-none text-white text-center text-xl font-bold tracking-[0.5em] placeholder-white/40 focus:border-indigo-500 rounded-lg"
                placeholder="000000"
                required
              />
            </div>

            {/* Password Baru */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">
                Password Baru (Min. 8 Karakter)
              </label>
              <input
                type="password"
                value={forgotNewPassword}
                onChange={(e) => setForgotPasswordNewPassword(e.target.value)}
                className="w-full h-[45px] bg-white/15 border border-white/20 outline-none text-white px-3 text-sm focus:border-indigo-500 rounded-lg"
                placeholder="Password Baru"
                required
              />
            </div>

            {/* Konfirmasi Password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-300">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={forgotConfirmPassword}
                onChange={(e) => setForgotPasswordConfirmPassword(e.target.value)}
                className="w-full h-[45px] bg-white/15 border border-white/20 outline-none text-white px-3 text-sm focus:border-indigo-500 rounded-lg"
                placeholder="Konfirmasi Password"
                required
              />
            </div>

            {/* Tombol Submit */}
            <div className="grid mt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold h-[50px] transition-colors disabled:opacity-50 text-[16px] shadow-lg shadow-red-950/20 rounded-lg cursor-pointer"
              >
                {loading ? 'Mengubah Sandi...' : 'UBAH KATA SANDI'}
              </button>
            </div>

            {/* Tombol Kembali ke Request */}
            <button
              type="button"
              onClick={() => {
                setForgotPasswordMode('request');
                setError('');
              }}
              className="flex items-center justify-center gap-2 text-gray-300 hover:text-white text-sm transition-colors mt-2 cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Ganti Username</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
            {/* Pesan Error */}
            {error && (
              <div className="bg-red-600/90 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Pesan Sukses */}
            {successMsg && (
              <div className="bg-emerald-600/90 text-white text-sm p-3 rounded-lg flex items-center justify-center gap-2 shadow-lg">
                <CheckCircle2 size={18} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="flex h-[52px] shadow-md rounded-lg overflow-hidden border border-white/20 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400 transition-all bg-white/10">
              <div className="w-[52px] h-full bg-white/10 flex items-center justify-center text-white/80 border-r border-white/15">
                <User size={20} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 h-full bg-transparent px-4 outline-none text-white placeholder-white/60 text-sm font-semibold"
                placeholder="Username"
                required
                autoFocus
              />
            </div>

            {/* Password Input */}
            <div className="flex h-[52px] shadow-md rounded-lg overflow-hidden border border-white/20 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400 transition-all bg-white/10">
              <div className="w-[52px] h-full bg-white/10 flex items-center justify-center text-white/80 border-r border-white/15">
                <Lock size={20} strokeWidth={2.5} />
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 h-full bg-transparent px-4 outline-none text-white placeholder-white/60 text-sm font-semibold tracking-wider"
                placeholder="Password"
                required
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-white mt-1">
              {/* Custom Checkbox Remember Me */}
              <label className="flex items-center gap-2 cursor-pointer group select-none">
                <div
                  className={`w-[18px] h-[18px] border-2 border-white/40 rounded flex items-center justify-center transition-colors group-hover:border-white ${remember ? 'bg-cyan-500 border-cyan-500' : 'bg-transparent'}`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  {remember && <div className="w-1.5 h-1.5 bg-white rounded-sm"></div>}
                </div>
                <span className="text-[12px] font-bold text-gray-200 group-hover:text-white transition-colors">
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
                <span className="text-[12px] font-bold text-cyan-200/80 group-hover:text-white transition-colors">
                  Lupa Password?
                </span>
              </button>
            </div>

            {/* Tombol LOG IN Merah Terang */}
            <div className="grid mt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-bold h-[52px] transition-colors disabled:opacity-50 text-[16px] shadow-lg shadow-red-950/20 rounded-lg cursor-pointer"
              >
                {loading ? 'Memuat...' : 'MASUK'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
