import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ExternalLink, HelpCircle, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  KATALOG_LAYANAN,
  URUTAN_MODUL,
  bolehUntukPeran,
  cariLayanan,
  halamanUntukPeran,
} from './katalogLayanan';

// Pusat Bantuan (2026-10-05): daftar layanan + tata cara sesuai peran,
// tanpa AI (jawaban selalu sama dengan katalog). Isi di katalogLayanan.js.
const HALAMAN_TANPA_BANTUAN = ['/login', '/public'];

function KartuDetail({ layanan, peran, onKembali, onBuka }) {
  const halaman = halamanUntukPeran(layanan, peran);
  return (
    <div className="flex flex-col min-h-0">
      <button
        type="button"
        onClick={onKembali}
        className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 cursor-pointer self-start"
      >
        <ArrowLeft size={14} /> Kembali
      </button>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{layanan.modul}</p>
      <h4 className="text-sm font-bold text-slate-900 mt-0.5">{layanan.judul}</h4>
      <p className="text-xs text-slate-600 mt-1">{layanan.ringkas}</p>

      <p className="text-[11px] font-bold text-slate-500 uppercase mt-3 mb-1">Tata cara</p>
      <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-800">
        {layanan.langkah.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>

      {layanan.catatan && (
        <p className="mt-3 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-2">
          {layanan.catatan}
        </p>
      )}

      {(halaman || layanan.halamanLuar) && (
        <div className="mt-3">
          {halaman ? (
            <button
              type="button"
              onClick={() => onBuka(halaman)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-md px-3 py-1.5 cursor-pointer"
            >
              Buka halaman <ChevronRight size={13} />
            </button>
          ) : (
            <a
              href={layanan.halamanLuar}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-md px-3 py-1.5"
            >
              Buka aplikasi <ExternalLink size={12} />
            </a>
          )}
          <span className="ml-2 font-mono text-[10px] text-slate-400">{halaman || layanan.halamanLuar}</span>
        </div>
      )}

      {layanan.endpoint.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-slate-500 uppercase mt-3 mb-1">Endpoint</p>
          <ul className="space-y-0.5">
            {layanan.endpoint.map((e) => (
              <li key={e} className="font-mono text-[10.5px] text-slate-700 break-all">{e}</li>
            ))}
          </ul>
        </>
      )}

      {layanan.uat.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-slate-500 uppercase mt-3 mb-1">Skenario UAT</p>
          <div className="flex flex-wrap gap-1">
            {layanan.uat.map((u) => (
              <span key={u} className="text-[10px] font-semibold text-slate-600 border border-slate-300 rounded px-1.5 py-0.5">
                {u}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BarisLayanan({ layanan, onPilih }) {
  return (
    <button
      type="button"
      onClick={() => onPilih(layanan)}
      className="w-full text-left flex items-start justify-between gap-2 px-2.5 py-2 rounded-md hover:bg-slate-50 cursor-pointer"
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800">{layanan.judul}</span>
        <span className="block text-[11px] text-slate-500 truncate">{layanan.ringkas}</span>
      </span>
      <ChevronRight size={14} className="text-slate-400 shrink-0 mt-0.5" />
    </button>
  );
}

export default function PusatBantuan() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [terbuka, setTerbuka] = useState(false);
  const [kata, setKata] = useState('');
  const [dipilih, setDipilih] = useState(null);

  const peran = user?.role?.toLowerCase() || '';

  const milikPeran = useMemo(
    () => KATALOG_LAYANAN.filter((l) => bolehUntukPeran(l, peran)),
    [peran],
  );

  const hasil = useMemo(() => cariLayanan(milikPeran, kata), [milikPeran, kata]);

  const terkaitHalaman = useMemo(() => {
    const p = location.pathname;
    return milikPeran.filter((l) => {
      const h = halamanUntukPeran(l, peran);
      return h && h !== '/login' && (p === h || p.startsWith(`${h}/`));
    });
  }, [milikPeran, peran, location.pathname]);

  if (!user || HALAMAN_TANPA_BANTUAN.some((h) => location.pathname.startsWith(h))) return null;

  const perModul = URUTAN_MODUL.map((m) => [m, hasil.filter((l) => l.modul === m)]).filter(([, d]) => d.length);

  const buka = (halaman) => {
    setTerbuka(false);
    navigate(halaman);
  };

  return (
    <>
      {terbuka && (
        <div className="fixed bottom-16 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] h-[70vh] max-h-[620px] bg-white border border-slate-200 rounded-xl shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pusat Bantuan</h3>
              <p className="text-[11px] text-slate-500">Tata cara sesuai peran Anda ({peran || '-'})</p>
            </div>
            <button
              type="button"
              onClick={() => setTerbuka(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Tutup"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {dipilih ? (
              <KartuDetail layanan={dipilih} peran={peran} onKembali={() => setDipilih(null)} onBuka={buka} />
            ) : (
              <>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={kata}
                    onChange={(e) => setKata(e.target.value)}
                    placeholder="Cari: stok opname, void, AKS-03 ..."
                    className="w-full h-9 rounded-md border border-slate-300 pl-8 pr-2.5 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                  />
                </div>

                {!kata && terkaitHalaman.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">Terkait halaman ini</p>
                    {terkaitHalaman.map((l) => (
                      <BarisLayanan key={l.id} layanan={l} onPilih={setDipilih} />
                    ))}
                  </div>
                )}

                {perModul.length === 0 ? (
                  <p className="text-xs text-slate-500 px-1">
                    Tidak ada layanan yang cocok untuk peran Anda. Coba kata lain, atau tanyakan ke admin.
                  </p>
                ) : (
                  perModul.map(([modul, daftar]) => (
                    <div key={modul} className="mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">{modul}</p>
                      {daftar.map((l) => (
                        <BarisLayanan key={l.id} layanan={l} onPilih={setDipilih} />
                      ))}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setTerbuka((t) => !t)}
        className="fixed bottom-4 right-4 z-[60] flex items-center gap-1.5 h-10 pl-3 pr-3.5 rounded-full bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-lg cursor-pointer"
        title="Pusat Bantuan"
      >
        <HelpCircle size={16} /> Bantuan
      </button>
    </>
  );
}
