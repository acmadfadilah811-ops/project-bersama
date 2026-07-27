import { useState, useRef, useEffect } from 'react';
import { FileText, Check, Terminal, Lock, Unlock } from 'lucide-react';

export default function BrandyLicenseGate({ onApprove }) {
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const textContainerRef = useRef(null);

  // Monitor scroll untuk membuka persetujuan secara aman di latar belakang
  const handleScroll = () => {
    const container = textContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Beri toleransi 15px di ujung bawah scroll
    if (scrollHeight - scrollTop - clientHeight < 15) {
      setHasReadToBottom(true);
    }
  };

  // Deteksi otomatis jika teks lisensi tidak memerlukan scroll pada layar besar
  useEffect(() => {
    const container = textContainerRef.current;
    if (container) {
      const { scrollHeight, clientHeight } = container;
      if (scrollHeight <= clientHeight) {
        setHasReadToBottom(true);
      }
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasReadToBottom || !isChecked) return;

    setIsActivating(true);
    setTimeout(() => {
      onApprove();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-100 flex items-center justify-center p-4 font-mono select-none">
      {/* Clean high-end architectural grid patterns in light mode */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-40 pointer-events-none"></div>

      <div className="w-full max-w-xl bg-white border border-slate-350 border-slate-300 rounded-lg shadow-xl relative flex flex-col text-slate-800 animate-scale-up overflow-hidden">
        
        {/* System Bar Header (Classic System Console Look) */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Terminal size={13} className="text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Security License Manager v1.0
            </span>
          </div>
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
          </div>
        </div>

        <div className="p-6 md:p-8 flex flex-col">
          {/* Header Title Section */}
          <div className="border-b border-slate-200 pb-4 mb-4">
            <h1 className="text-sm font-black uppercase tracking-wider text-slate-900 mb-1">
              SYSTEM LICENSE AGREEMENT
            </h1>
            <p className="text-[11px] text-slate-500 font-sans leading-relaxed">
              Sistem Bintang Advertising dilisensikan dan diawasi secara sah oleh{' '}
              <strong className="text-slate-800 font-bold">Brandy (tumbuh bersama)</strong>.
            </p>
          </div>

          {/* System Specification Grid (Corporate Style) */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4 text-[10px] bg-slate-50 border border-slate-200 p-3 rounded font-mono">
            <div>
              <span className="text-slate-400 block text-[9px]">DEVELOPER ORGANISASI:</span>
              <span className="text-slate-700 font-bold">BRANDY (tumbuh bersama)</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px]">NAMA PRODUK:</span>
              <span className="text-slate-700 font-bold">Bintang Advertising Suite</span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-1">
              <span className="text-slate-400 block text-[9px]">STATUS LISENSI:</span>
              <span className="text-slate-700 font-bold">PENDING APPROVAL</span>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-1">
              <span className="text-slate-400 block text-[9px]">TIPE LISENSI:</span>
              <span className="text-slate-700 font-bold">Enterprise Dedicated</span>
            </div>
          </div>

          {/* EULA Monospace Scrollbox */}
          <div className="bg-white border border-slate-200 rounded p-4 mb-4 flex flex-col">
            <div className="flex items-center gap-2 text-slate-500 text-[9px] font-bold border-b border-slate-100 pb-2 mb-3">
              <FileText size={11} className="text-slate-400" />
              <span>DOKUMEN LISENSI PERANGKAT LUNAK</span>
            </div>

            <div
              ref={textContainerRef}
              onScroll={handleScroll}
              className="text-[11px] text-slate-655 text-slate-600 leading-relaxed space-y-4 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent select-text font-sans"
            >
              <p className="font-bold text-slate-800">
                Aplikasi ini dilisensikan, dikembangkan, dan dipelihara secara eksklusif oleh Brandy, sebuah organisasi pengembang aplikasi, website, dan engineering developer global yang berdedikasi untuk tumbuh bersama bisnis Anda.
              </p>
              
              <p>
                Dengan menggunakan aplikasi ini, Anda secara sah menyatakan tunduk pada ketentuan lisensi berikut:
              </p>

              <div className="space-y-3.5 pl-3 border-l border-slate-200">
                <p>
                  <strong className="text-slate-800 block font-bold mb-0.5">1. HAK CIPTA & LISENSI PENGGUNAAN</strong>
                  Semua hak atas kekayaan intelektual (IP), source code (baik kode frontend React maupun backend Django), aset desain, arsitektur database, dan algoritma sistem Bintang Advertising adalah milik eksklusif dari Developer (Brandy). Anda diberikan hak lisensi non-eksklusif dan terbatas hanya untuk mengoperasikan sistem ini untuk kebutuhan manajemen internal Bintang Advertising.
                </p>
                
                <p>
                  <strong className="text-slate-800 block font-bold mb-0.5">2. BATASAN PENGGUNAAN & KEAMANAN KODE</strong>
                  Anda secara tegas dilarang untuk menyalin, mendistribusikan ulang, menjual kembali, menyewakan, atau mentransfer bagian apa pun dari aplikasi ini kepada pihak ketiga tanpa izin tertulis dari Brandy. Dilarang melakukan reverse engineering atau mencoba membongkar kode sumber sistem.
                </p>

                <p>
                  <strong className="text-slate-800 block font-bold mb-0.5">3. PRIVASI & KEBIJAKAN DATA</strong>
                  Brandy menghormati privasi data Anda. Semua data transaksi konsumen, keuangan, absensi, dan data operasional Bintang Advertising disimpan secara aman di server lokal/cloud terenkripsi untuk kelancaran operasional internal Anda sesuai dengan UU PDP.
                </p>

                <p>
                  <strong className="text-slate-800 block font-bold mb-0.5">4. GARANSI & DUKUNGAN TEKNIS</strong>
                  Brandy berkomitmen penuh untuk memberikan dukungan pemeliharaan sistem, mitigasi bug, dan optimasi performa server secara berkelanjutan agar bisnis Anda terus tumbuh bersama kami.
                </p>
              </div>
            </div>
          </div>

          {/* Form and Agreement Gate */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Checkbox Persetujuan (Clean Light Corporate Look) */}
            <label 
              className={`flex items-start gap-3 p-3.5 rounded border transition-all select-none ${
                hasReadToBottom
                  ? 'bg-slate-50 border-slate-200 cursor-pointer hover:border-slate-350 hover:bg-slate-100/50'
                  : 'bg-slate-50/50 border-slate-150 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  disabled={!hasReadToBottom}
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isChecked
                      ? 'bg-slate-900 border-slate-900'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isChecked && <Check size={10} className="text-white font-black" />}
                </div>
              </div>
              <div className="flex flex-col font-sans">
                <span className="text-[11px] font-bold text-slate-800 leading-none">
                  Saya menyetujui Ketentuan Lisensi Developer
                </span>
                <span className="text-[9px] text-slate-450 text-slate-500 mt-1 font-mono leading-relaxed">
                  Menyatakan setuju secara penuh atas syarat, ketentuan, dan lisensi dari Brandy.
                </span>
              </div>
            </label>

            {/* Solid Light System Action Button */}
            <button
              type="submit"
              disabled={!hasReadToBottom || !isChecked || isActivating}
              className={`w-full py-3 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all border ${
                isActivating
                  ? 'bg-slate-900 text-white cursor-wait'
                  : hasReadToBottom && isChecked
                    ? 'bg-slate-900 hover:bg-slate-800 border-slate-900 text-white cursor-pointer active:scale-[0.99]'
                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isActivating ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Setujui & Lanjutkan</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer (Classic Light System Footer) */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex justify-between items-center text-[9px] text-slate-400 font-mono">
          <span>[SYSTEM OK] - SECURITY LOG ACTIVE</span>
          <span className="text-slate-550 text-slate-500 font-bold">tumbuh bersama</span>
        </div>

      </div>
    </div>
  );
}
