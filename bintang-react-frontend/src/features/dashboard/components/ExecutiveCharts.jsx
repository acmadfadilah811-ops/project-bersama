import { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Grafik SVG untuk Dashboard Eksekutif — tanpa dependensi eksternal.
 *
 * Palet & spesifikasi mark mengikuti panduan dataviz internal:
 * - Kategorikal slot 1 biru #2a78d6, slot 2 hijau #008300 (lolos validator:
 *   CVD ΔE 26.5 protan / 7.6 tritan pada permukaan putih). Karena tritan jatuh
 *   di pita 6–8, warna WAJIB didampingi secondary encoding — di sini berupa
 *   gap 2px antar segmen, legenda, label langsung, dan tampilan tabel.
 * - Status (good/warning/critical) memakai palet status terpisah dan SELALU
 *   disertai ikon + teks, supaya makna tidak bergantung pada warna saja.
 * - Bar maksimal 24px, ujung data membulat 4px, garis grid hairline solid.
 */

export const SERIES = {
  hpp: { color: '#2a78d6', label: 'HPP' },
  laba: { color: '#008300', label: 'Laba Kotor' },
};

const STATUS = {
  good: { color: '#0ca30c', icon: CheckCircle2, label: 'Stok sehat' },
  warning: { color: '#fab219', icon: AlertTriangle, label: 'Stok menipis' },
  critical: { color: '#d03b3b', icon: XCircle, label: 'Stok habis' },
};

const GRID = '#e8e8e6';
const GAP = 2; // gap permukaan antar segmen — pemisah, bukan garis tepi

const rupiah = (v) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(v) || 0);

export const ringkas = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (abs >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(n);
};

/**
 * Tick sumbu Y pada angka bulat (0 / 1 jt / 2 jt), bukan pecahan acak.
 *
 * Tick teratas HARUS >= nilai maksimum. Versi sebelumnya berhenti tepat di
 * bawah maks, sehingga batang tertinggi menembus atas area plot dan label
 * nilainya keluar dari viewBox — tidak terlihat sama sekali.
 */
function ticks(maks, jumlah = 4) {
  if (maks <= 0) return [0];
  const kasar = maks / jumlah;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  const langkah = [1, 2, 2.5, 5, 10].map((m) => m * pangkat).find((s) => s >= kasar) || pangkat * 10;
  const atas = Math.ceil(maks / langkah) * langkah;
  const hasil = [];
  for (let v = 0; v <= atas + langkah * 0.001; v += langkah) hasil.push(v);
  return hasil;
}

function Tooltip({ isi }) {
  if (!isi) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-20 rounded-lg bg-slate-900 px-3 py-2 text-xs shadow-lg"
      style={{ left: `${isi.x}%`, top: 0, transform: 'translate(-50%, -100%)' }}
    >
      <div className="font-bold text-white whitespace-nowrap">{isi.judul}</div>
      {isi.baris.map((b) => (
        <div key={b.label} className="mt-1 flex items-center gap-2 whitespace-nowrap">
          <span style={{ background: b.color, width: 10, height: 2, borderRadius: 1 }} />
          {/* Nilai memimpin, nama seri menyusul */}
          <strong className="text-white">{b.nilai}</strong>
          <span className="text-slate-400">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Kolom bertumpuk: HPP + Laba Kotor = Pendapatan.
 * Bulan rugi (laba kotor negatif) ditandai khusus — tumpukan tidak bisa
 * menggambarkan nilai negatif, jadi ditandai daripada digambar menyesatkan.
 */
export function TrenChart({ rows }) {
  const [hover, setHover] = useState(null);

  if (!rows.length) {
    return <p className="py-12 text-center text-sm text-slate-500">Belum ada transaksi pada periode ini.</p>;
  }

  const W = 760;
  const H = 300;
  const M = { atas: 26, kanan: 12, bawah: 34, kiri: 62 };
  const plotW = W - M.kiri - M.kanan;
  const plotH = H - M.atas - M.bawah;

  const maks = Math.max(...rows.map((r) => Math.max(r.pendapatan, r.hpp)), 1);
  const skalaTicks = ticks(maks);
  const atas = skalaTicks[skalaTicks.length - 1];
  const y = (v) => M.atas + plotH - (v / atas) * plotH;
  const bandW = plotW / rows.length;
  const barW = Math.min(24, bandW * 0.5);

  return (
    <div className="relative">
      <Tooltip isi={hover} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label="Tren bulanan pendapatan, HPP, dan laba kotor">
        {skalaTicks.map((t) => (
          <g key={t}>
            <line x1={M.kiri} x2={W - M.kanan} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={M.kiri - 10} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b7280">
              {t === 0 ? '0' : ringkas(t)}
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const cx = M.kiri + bandW * i + bandW / 2;
          const x = cx - barW / 2;
          const rugi = row.laba_kotor < 0;
          const aktif = hover?.i === i;
          // Segmen bawah selalu HPP, tapi dibatasi setinggi pendapatan. Saat
          // rugi, kelebihan HPP di atas pendapatan digambar merah (status
          // kritis) — biaya yang tidak tertutup omzet, bukan laba.
          const dasar = Math.min(row.hpp, row.pendapatan);
          const tinggiDasar = Math.max(0, (dasar / atas) * plotH);
          const tinggiLaba = rugi ? 0 : Math.max(0, (row.laba_kotor / atas) * plotH);
          const tinggiRugi = rugi ? Math.max(0, ((row.hpp - row.pendapatan) / atas) * plotH) : 0;
          const puncak = Math.max(row.pendapatan, row.hpp);

          return (
            <g key={row.periode}>
              {/* Segmen atas: laba kotor (hijau) atau kekurangan biaya (merah) */}
              {tinggiLaba > 0 && (
                <rect x={x} y={y(row.pendapatan)} width={barW} height={tinggiLaba} rx="4"
                  fill={SERIES.laba.color} opacity={aktif ? 1 : 0.92} />
              )}
              {tinggiRugi > 0 && (
                <rect x={x} y={y(row.hpp)} width={barW} height={tinggiRugi} rx="4"
                  fill={STATUS.critical.color} opacity={aktif ? 1 : 0.92} />
              )}
              {/* Segmen HPP di garis dasar; gap 2px yang memisahkan, bukan garis tepi */}
              {tinggiDasar > 0 && (() => {
                // Gap hanya dipasang bila segmennya cukup tinggi. Pada nilai
                // sangat kecil (~1px) gap 2px akan menelan segmennya sampai
                // hilang sama sekali — pemisah tidak boleh menghapus data.
                const gap = tinggiDasar > 6 ? GAP : 0;
                return (
                  <rect x={x} y={M.atas + plotH - tinggiDasar + gap}
                    width={barW} height={Math.max(1, tinggiDasar - gap)}
                    rx={tinggiLaba > 0 || tinggiRugi > 0 ? 0 : 4}
                    fill={SERIES.hpp.color} opacity={aktif ? 1 : 0.92} />
                );
              })()}

              {/* Label langsung: pendapatan di puncak — satu per kolom, bukan tiap segmen */}
              <text x={cx} y={y(puncak) - 8}
                textAnchor="middle" fontSize="11" fontWeight="700" fill="#0b0b0b">
                {ringkas(row.pendapatan)}
              </text>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="11" fill="#6b7280">
                {row.periode}
              </text>

              {/* Target hover selebar band, lebih besar dari mark-nya */}
              <rect x={M.kiri + bandW * i} y={M.atas} width={bandW} height={plotH}
                fill="transparent" tabIndex={0} style={{ outline: 'none' }}
                onMouseEnter={() => setHover({
                  i, x: ((M.kiri + bandW * i + bandW / 2) / W) * 100, judul: row.periode,
                  baris: [
                    { label: 'Pendapatan', nilai: rupiah(row.pendapatan), color: '#0b0b0b' },
                    { label: SERIES.hpp.label, nilai: rupiah(row.hpp), color: SERIES.hpp.color },
                    { label: SERIES.laba.label, nilai: rupiah(row.laba_kotor), color: SERIES.laba.color },
                  ],
                })}
                onFocus={() => setHover({
                  i, x: ((M.kiri + bandW * i + bandW / 2) / W) * 100, judul: row.periode,
                  baris: [
                    { label: 'Pendapatan', nilai: rupiah(row.pendapatan), color: '#0b0b0b' },
                    { label: SERIES.hpp.label, nilai: rupiah(row.hpp), color: SERIES.hpp.color },
                    { label: SERIES.laba.label, nilai: rupiah(row.laba_kotor), color: SERIES.laba.color },
                  ],
                })}
                onMouseLeave={() => setHover(null)}
                onBlur={() => setHover(null)} />
            </g>
          );
        })}
        <line x1={M.kiri} x2={W - M.kanan} y1={M.atas + plotH} y2={M.atas + plotH} stroke="#cbd5e1" strokeWidth="1" />
      </svg>
    </div>
  );
}

/** Bar horizontal, satu seri -> satu warna untuk semua bar (bukan ramp nilai). */
export function BarTerlaris({ rows }) {
  const [hover, setHover] = useState(null);
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">Belum ada penjualan POS pada periode ini.</p>;
  }
  const maks = Math.max(...rows.map((r) => r.nilai), 1);

  return (
    <div className="relative space-y-3">
      <Tooltip isi={hover} />
      {rows.map((row, i) => (
        <div key={row.nama}
          tabIndex={0}
          className="group cursor-default rounded outline-none focus:ring-2 focus:ring-blue-300"
          onMouseEnter={() => setHover({ i, x: 50, judul: row.nama, baris: [
            { label: 'Nilai', nilai: rupiah(row.nilai), color: SERIES.hpp.color },
            { label: 'Qty terjual', nilai: new Intl.NumberFormat('id-ID').format(row.qty), color: '#94a3b8' },
          ] })}
          onFocus={() => setHover({ i, x: 50, judul: row.nama, baris: [
            { label: 'Nilai', nilai: rupiah(row.nilai), color: SERIES.hpp.color },
            { label: 'Qty terjual', nilai: new Intl.NumberFormat('id-ID').format(row.qty), color: '#94a3b8' },
          ] })}
          onMouseLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
        >
          <div className="mb-1 flex justify-between text-xs">
            <span className="truncate pr-2 font-semibold text-slate-700">{row.nama}</span>
            <span className="shrink-0 font-bold text-slate-900">{ringkas(row.nilai)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-sm bg-slate-100">
            <div className="h-full rounded-r-[4px] transition-opacity group-hover:opacity-100"
              style={{ width: `${(row.nilai / maks) * 100}%`, background: SERIES.hpp.color, opacity: 0.92 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Komposisi stok — warna status SELALU berpasangan dengan ikon + teks. */
export function StokBar({ stok }) {
  const total = Math.max(stok.total_dilacak, 1);
  const bagian = [
    { key: 'good', nilai: stok.sehat },
    { key: 'warning', nilai: stok.menipis },
    { key: 'critical', nilai: stok.habis },
  ].filter((b) => b.nilai > 0);

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100" style={{ gap: `${GAP}px` }}>
        {bagian.map((b) => (
          <div key={b.key} style={{ width: `${(b.nilai / total) * 100}%`, background: STATUS[b.key].color }}
            title={`${STATUS[b.key].label}: ${b.nilai}`} />
        ))}
      </div>
      <dl className="mt-4 space-y-2.5 text-sm">
        {Object.entries(STATUS).map(([key, s]) => {
          const nilai = { good: stok.sehat, warning: stok.menipis, critical: stok.habis }[key];
          const Icon = s.icon;
          return (
            <div key={key} className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-slate-600">
                <Icon size={15} style={{ color: s.color }} /> {s.label}
              </dt>
              <dd className="font-bold text-slate-900">{nilai}</dd>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
          <dt className="text-slate-500">Produk dilacak</dt>
          <dd className="font-bold text-slate-700">{stok.total_dilacak}</dd>
        </div>
      </dl>
    </div>
  );
}

export { rupiah, STATUS };
