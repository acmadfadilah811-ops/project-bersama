import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react';
import { ringkas, rupiah, ticks } from './ExecutiveCharts';

/**
 * Komponen bersama dashboard Operasional & Ringkasan (2026-11-10), gaya prototipe
 * dashboard: rentang Harian/Mingguan/Bulanan/Tahunan yang bisa digeser, kartu
 * dengan garis aksen warna, dan grafik penjualan vs periode sebelumnya.
 */

export const MODE_RENTANG = [
  { id: 'harian', label: 'Harian' },
  { id: 'mingguan', label: 'Mingguan' },
  { id: 'bulanan', label: 'Bulanan' },
  { id: 'tahunan', label: 'Tahunan' },
];

// Warna garis aksen di bawah kartu (palet kartu laporan prototipe); isi kartu tetap netral.
export const AKSEN = {
  hijau: '#3ED0A8',
  kuning: '#F5D90A',
  biru: '#1890FF',
  biruMuda: '#6CB8F0',
  ungu: '#7B2FD0',
  merah: '#E5333F',
  indigo: '#4F46E5',
  slate: '#94A3B8',
};

/** Mode rentang diingat per halaman di browser ini; geseran selalu mulai dari periode berjalan. */
export function useRentang(kunci, bawaan = 'harian') {
  const [mode, setModeState] = useState(() => {
    try {
      const v = window.localStorage.getItem(kunci);
      return MODE_RENTANG.some((m) => m.id === v) ? v : bawaan;
    } catch {
      return bawaan;
    }
  });
  const [geser, setGeser] = useState(0);
  const setMode = (v) => {
    setModeState(v);
    setGeser(0);
    try { window.localStorage.setItem(kunci, v); } catch { /* penyimpanan diblokir: abaikan */ }
  };
  return { mode, geser, setMode, setGeser };
}

export function PilihRentang({ mode, geser, label, bisaMaju, onMode, onGeser, memuat }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {MODE_RENTANG.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
              mode === m.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex h-[38px] items-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => onGeser(geser - 1)}
          className="flex h-full items-center px-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
          aria-label="Periode sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>
        <span className={`min-w-[150px] border-x border-slate-100 px-3 text-center text-xs font-bold text-slate-700 ${memuat ? 'opacity-50' : ''}`}>
          {geser === 0 && mode === 'harian' ? `Hari ini · ${label || ''}` : (label || '…')}
        </span>
        <button
          type="button"
          onClick={() => onGeser(geser + 1)}
          disabled={!bisaMaju}
          className="flex h-full items-center px-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label="Periode berikutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      {geser !== 0 && (
        <button
          type="button"
          onClick={() => onGeser(0)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
        >
          Kembali ke periode ini
        </button>
      )}
    </div>
  );
}

/** Persen naik/turun. null = tidak ada pembanding: tidak ditampilkan (bukan "0%" yang menyesatkan). */
export function DeltaPil({ value, teks = 'vs periode lalu' }) {
  if (value === null || value === undefined) {
    return <span className="text-[11px] font-medium text-slate-400">Belum ada pembanding</span>;
  }
  const naik = value >= 0;
  const Icon = naik ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold ${naik ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
        <Icon size={12} />{naik ? '+' : ''}{String(value).replace('.', ',')}%
      </span>
      {teks}
    </span>
  );
}

/** Kartu angka dengan garis aksen warna tebal di bawah (seperti kartu laporan prototipe). */
export function KartuAksen({ label, nilai, warna = AKSEN.biru, ikon: Ikon, delta, catatan, besar = false, className = '' }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex-1 px-4 pb-4 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] font-semibold text-slate-600">{label}</p>
          {Ikon && <Ikon size={16} className="mt-0.5 shrink-0 text-slate-400" />}
        </div>
        <p className={`mt-1.5 font-bold tracking-tight text-slate-900 tabular-nums ${besar ? 'text-2xl' : 'text-lg'}`}>{nilai}</p>
        {delta !== undefined && <div className="mt-2"><DeltaPil value={delta} /></div>}
        {catatan && <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">{catatan}</div>}
      </div>
      <span className="block h-1.5 shrink-0" style={{ background: warna }} aria-hidden="true" />
    </article>
  );
}

/** Kartu pembungkus panel biasa (judul + isi); garis aksen bawah opsional. */
export function PanelAksen({ judul, subjudul, warna, kanan, className = '', children }) {
  return (
    <section className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {warna && <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: warna }} aria-hidden="true" />}
      {(judul || kanan) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {judul && <h2 className="font-bold text-slate-900">{judul}</h2>}
            {subjudul && <p className="mt-0.5 text-xs text-slate-500">{subjudul}</p>}
          </div>
          {kanan}
        </div>
      )}
      {children}
    </section>
  );
}

// ── Grafik ───────────────────────────────────────────────────────────────

/** Kurva monoton (Fritsch–Carlson): halus tanpa melewati titik data / turun di bawah nol. */
function jalurHalus(titik) {
  const n = titik.length;
  if (!n) return '';
  if (n === 1) return `M${titik[0].x},${titik[0].y}`;
  const dx = []; const m = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = titik[i + 1].x - titik[i].x;
    m[i] = (titik[i + 1].y - titik[i].y) / (dx[i] || 1);
  }
  const t = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i += 1) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i += 1) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); t[i] = tau * a * m[i]; t[i + 1] = tau * b * m[i]; }
  }
  let d = `M${titik[0].x},${titik[0].y}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i] / 3;
    d += ` C${titik[i].x + h},${titik[i].y + t[i] * h} ${titik[i + 1].x - h},${titik[i + 1].y - t[i + 1] * h} ${titik[i + 1].x},${titik[i + 1].y}`;
  }
  return d;
}

/** Potong deret jadi segmen bersambung (nilai null = celah, mis. jam yang belum lewat). */
function segmen(nilai, sx, sy) {
  const hasil = []; let aktif = [];
  nilai.forEach((v, i) => {
    if (v === null || v === undefined) { if (aktif.length) hasil.push(aktif); aktif = []; return; }
    aktif.push({ x: sx(i), y: sy(v), i });
  });
  if (aktif.length) hasil.push(aktif);
  return hasil;
}

function useLebar() {
  const ref = useRef(null);
  const [lebar, setLebar] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setLebar(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setLebar(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, lebar];
}

/**
 * Grafik area penjualan periode berjalan (garis tebal + gradasi) vs periode sebelumnya
 * (garis putus-putus abu-abu), dengan garis bantu & tooltip saat kursor diarahkan.
 */
export function GrafikPeriode({ seri, warna = AKSEN.biru, tinggi = 280, format = rupiah, labelSekarang = 'Periode ini', labelSebelumnya = 'Periode sebelumnya' }) {
  const [ref, lebar] = useLebar();
  const [aktif, setAktif] = useState(null);
  const idGradasi = useMemo(() => `gradasi-${Math.random().toString(36).slice(2, 9)}`, []);
  useEffect(() => setAktif(null), [seri]);

  const label = seri?.label || [];
  const sekarang = seri?.sekarang || [];
  const sebelumnya = seri?.sebelumnya || [];
  const n = label.length;
  const maks = Math.max(0, ...sekarang.filter((v) => v != null), ...sebelumnya.filter((v) => v != null));
  const tick = ticks(maks || 1, 4);
  const atas = tick[tick.length - 1] || 1;
  const kosong = maks === 0;

  const kiri = 56; const kanan = 16; const pTop = 14; const pBawah = 30;
  const w = Math.max(lebar, 280);
  const lebarPlot = w - kiri - kanan;
  const tinggiPlot = tinggi - pTop - pBawah;
  const sx = (i) => kiri + (n <= 1 ? lebarPlot / 2 : (i / (n - 1)) * lebarPlot);
  const sy = (v) => pTop + tinggiPlot - (v / atas) * tinggiPlot;
  const dasar = pTop + tinggiPlot;

  const segSekarang = segmen(sekarang, sx, sy);
  const segLalu = segmen(sebelumnya, sx, sy);
  const langkahLabel = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(lebarPlot / 64))));

  const geserKursor = (e) => {
    if (!n) return;
    const kotak = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - kotak.left;
    const i = Math.round(((x - kiri) / (lebarPlot || 1)) * (n - 1));
    setAktif(Math.max(0, Math.min(n - 1, i)));
  };

  const vNow = aktif != null ? sekarang[aktif] : null;
  const vPrev = aktif != null ? sebelumnya[aktif] : null;
  const selisih = vNow != null && vPrev ? Math.round(((vNow - vPrev) / Math.abs(vPrev)) * 1000) / 10 : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-4 text-[11px] font-semibold text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-slate-300" /> {labelSebelumnya}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-4 rounded-full" style={{ background: warna }} /> {labelSekarang}
        </span>
      </div>
      <div ref={ref} className="relative w-full" style={{ height: tinggi }}>
        {lebar > 0 && (
          <svg
            width={w}
            height={tinggi}
            className="block touch-none select-none"
            onMouseMove={geserKursor}
            onMouseLeave={() => setAktif(null)}
            onTouchStart={(e) => geserKursor(e.touches[0] ? { currentTarget: e.currentTarget, clientX: e.touches[0].clientX } : e)}
            role="img"
            aria-label={`Grafik ${labelSekarang.toLowerCase()} dibanding ${labelSebelumnya.toLowerCase()}`}
          >
            <defs>
              <linearGradient id={idGradasi} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={warna} stopOpacity="0.22" />
                <stop offset="70%" stopColor={warna} stopOpacity="0.04" />
                <stop offset="100%" stopColor={warna} stopOpacity="0" />
              </linearGradient>
            </defs>

            {tick.map((v) => (
              <g key={v}>
                <line x1={kiri} x2={w - kanan} y1={sy(v)} y2={sy(v)} stroke={v === 0 ? '#E2E8F0' : '#F1F5F9'} strokeWidth="1" />
                <text x={kiri - 10} y={sy(v)} dy="0.32em" textAnchor="end" className="fill-slate-400" style={{ fontSize: 11 }}>
                  {v === 0 ? '0' : ringkas(v)}
                </text>
              </g>
            ))}

            {/* Label terakhir hanya dipaksa tampil bila tidak menempel ke label sebelumnya. */}
            {label.map((l, i) => (i % langkahLabel === 0 || (i === n - 1 && (n - 1) % langkahLabel > langkahLabel * 0.6)) && (
              <text key={l + i} x={sx(i)} y={tinggi - 8} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>{l}</text>
            ))}

            {segLalu.map((s) => (
              <path key={`p${s[0].i}`} d={jalurHalus(s)} fill="none" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
            ))}
            {segSekarang.map((s) => (
              <g key={`n${s[0].i}`}>
                <path d={`${jalurHalus(s)} L${s[s.length - 1].x},${dasar} L${s[0].x},${dasar} Z`} fill={`url(#${idGradasi})`} />
                <path d={jalurHalus(s)} fill="none" stroke={warna} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))}
            {/* Titik ujung = posisi "sekarang" */}
            {segSekarang.length > 0 && aktif == null && (() => {
              const s = segSekarang[segSekarang.length - 1]; const u = s[s.length - 1];
              return (
                <g>
                  <circle cx={u.x} cy={u.y} r="7" fill={warna} opacity="0.15" />
                  <circle cx={u.x} cy={u.y} r="3.5" fill="#fff" stroke={warna} strokeWidth="2" />
                </g>
              );
            })()}

            {aktif != null && (
              <g pointerEvents="none">
                <line x1={sx(aktif)} x2={sx(aktif)} y1={pTop} y2={dasar} stroke="#94A3B8" strokeWidth="1" strokeDasharray="3 3" />
                {vPrev != null && <circle cx={sx(aktif)} cy={sy(vPrev)} r="3.5" fill="#fff" stroke="#94A3B8" strokeWidth="2" />}
                {vNow != null && <circle cx={sx(aktif)} cy={sy(vNow)} r="4.5" fill="#fff" stroke={warna} strokeWidth="2.5" />}
              </g>
            )}
          </svg>
        )}

        {kosong && lebar > 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
            <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-500">
              Belum ada penjualan pada periode ini
            </span>
          </div>
        )}

        {aktif != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs shadow-lg"
            style={{
              left: Math.min(Math.max(sx(aktif) + 12, 8), w - 196),
            }}
          >
            <p className="font-bold text-slate-900">{label[aktif]}</p>
            <div className="mt-1.5 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block h-[3px] w-3 rounded-full" style={{ background: warna }} />{labelSekarang}
              </span>
              <strong className="tabular-nums text-slate-900">{vNow != null ? format(vNow) : '–'}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block w-3 border-t-2 border-dashed border-slate-300" />{labelSebelumnya}
              </span>
              <strong className="tabular-nums text-slate-600">{vPrev != null ? format(vPrev) : '–'}</strong>
            </div>
            {selisih != null && (
              <p className={`mt-1.5 border-t border-slate-100 pt-1.5 font-bold ${selisih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {selisih >= 0 ? '+' : ''}{String(selisih).replace('.', ',')}% dibanding periode lalu
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Judul grafik sesuai mode: per jam / per hari / per bulan. */
export function judulSeri(mode) {
  return { harian: 'per jam', mingguan: 'per hari', bulanan: 'per tanggal', tahunan: 'per bulan' }[mode] || '';
}
