import { useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { rupiah, ringkas, SERIES, STATUS } from './ExecutiveCharts';

/**
 * Grafik SVG/HTML untuk AI Business Analyst — memakai ULANG palet & pola yang
 * sudah divalidasi di ExecutiveCharts.jsx (biru #2a78d6 / hijau #008300 untuk
 * kategorikal, palet status good/warning/critical untuk kesehatan stok).
 * Tidak ada hue baru yang diperkenalkan di file ini.
 */

const angka = (v) => new Intl.NumberFormat('id-ID').format(Number(v) || 0);

const KELAS_BADGE = {
  A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  B: 'bg-amber-50 text-amber-700 border-amber-200',
  C: 'bg-slate-100 text-slate-600 border-slate-200',
};

/** Daftar ABC/Pareto per kategori — bar horizontal + badge kelas + kumulatif. */
export function AbcList({ rows }) {
  const [hover, setHover] = useState(null);
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">Belum ada penjualan pada periode ini.</p>;
  }
  const maks = Math.max(...rows.map((r) => r.nilai), 1);

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={row.kategori} className="group">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <span className={`shrink-0 rounded border px-1.5 py-0.5 font-black ${KELAS_BADGE[row.kelas]}`}>
                {row.kelas}
              </span>
              <span className="truncate font-semibold text-slate-700">{row.kategori}</span>
            </span>
            <span className="shrink-0 font-bold text-slate-900">
              {ringkas(row.nilai)} <span className="font-normal text-slate-400">({row.persen}%)</span>
            </span>
          </div>
          <div
            className="h-3 w-full overflow-hidden rounded-sm bg-slate-100"
            tabIndex={0}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
          >
            <div
              className="h-full rounded-r-[4px]"
              style={{ width: `${(row.nilai / maks) * 100}%`, background: SERIES.hpp.color, opacity: hover === i ? 1 : 0.9 }}
            />
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">Kumulatif {row.kumulatif}%</p>
        </div>
      ))}
    </div>
  );
}

/** Tabel top/bottom produk — dipakai untuk dua arah (terlaris & terlemah). */
export function ProdukTable({ rows, kosongTeks }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-slate-500">{kosongTeks}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th scope="col" className="py-2 text-left font-semibold">Produk</th>
            <th scope="col" className="py-2 text-left font-semibold">Kategori</th>
            <th scope="col" className="py-2 text-right font-semibold">Qty</th>
            <th scope="col" className="py-2 text-right font-semibold">Nilai</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.nama}-${i}`} className="border-b border-slate-50">
              <td className="py-2 font-semibold text-slate-800">{r.nama}</td>
              <td className="py-2 text-slate-500">{r.kategori}</td>
              <td className="py-2 text-right text-slate-600">{angka(r.qty)}</td>
              <td className="py-2 text-right font-bold text-slate-900">{rupiah(r.nilai)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Perbandingan dua kanal (POS vs Pesanan) — dua seri, legenda wajib. */
export function ChannelCompare({ channel }) {
  const kanal = [
    { key: 'pos', label: 'POS (Kasir)', color: SERIES.hpp.color, data: channel.pos },
    { key: 'order', label: 'Pesanan', color: SERIES.laba.color, data: channel.order },
  ];
  const maks = Math.max(kanal[0].data.nilai, kanal[1].data.nilai, 1);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        {kanal.map((k) => (
          <span key={k.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span style={{ background: k.color, width: 12, height: 12, borderRadius: 3 }} />
            {k.label}
          </span>
        ))}
      </div>
      <div className="space-y-4">
        {kanal.map((k) => (
          <div key={k.key}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-slate-700">{k.label}</span>
              <span className="font-bold text-slate-900">{rupiah(k.data.nilai)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-sm bg-slate-100">
              <div className="h-full rounded-r-[4px]" style={{ width: `${(k.data.nilai / maks) * 100}%`, background: k.color, opacity: 0.9 }} />
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {angka(k.data.transaksi)} transaksi · rata-rata {rupiah(k.data.aov)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ranking margin per kategori — bar tunggal (magnitude), warna konsisten dgn laba kotor. */
export function MarginList({ rows }) {
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">Belum ada data margin pada periode ini.</p>;
  }
  const maks = Math.max(...rows.map((r) => Math.abs(r.margin)), 1);

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const rugi = row.margin < 0;
        return (
          <div key={row.kategori}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-slate-700">{row.kategori}</span>
              <span className={`shrink-0 font-bold ${rugi ? 'text-rose-600' : 'text-slate-900'}`}>
                {rupiah(row.margin)}
                {row.margin_persen !== null && <span className="ml-1 font-normal text-slate-400">({row.margin_persen}%)</span>}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-sm bg-slate-100">
              <div
                className="h-full rounded-r-[4px]"
                style={{ width: `${(Math.abs(row.margin) / maks) * 100}%`, background: rugi ? STATUS.critical.color : SERIES.laba.color, opacity: 0.9 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Kesehatan stok per kategori — mengulang pola StokBar (ikon + teks, bukan warna saja). */
export function StokKategoriTable({ rows, ambangHari }) {
  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-slate-500">Belum ada produk yang dilacak stoknya.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            <th scope="col" className="py-2 text-left font-semibold">Kategori</th>
            <th scope="col" className="py-2 text-right font-semibold">Nilai Persediaan</th>
            <th scope="col" className="py-2 text-right font-semibold">
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} style={{ color: STATUS.good.color }} /> Sehat</span>
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              <span className="inline-flex items-center gap-1"><AlertTriangle size={12} style={{ color: STATUS.warning.color }} /> Menipis</span>
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              <span className="inline-flex items-center gap-1"><XCircle size={12} style={{ color: STATUS.critical.color }} /> Habis</span>
            </th>
            <th scope="col" className="py-2 text-right font-semibold">
              Lambat &gt;{ambangHari} hari
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kategori} className="border-b border-slate-50">
              <td className="py-2 font-semibold text-slate-800">{r.kategori}</td>
              <td className="py-2 text-right text-slate-600">{rupiah(r.nilai_persediaan)}</td>
              <td className="py-2 text-right text-slate-600">{angka(r.sehat)}</td>
              <td className="py-2 text-right text-slate-600">{angka(r.menipis)}</td>
              <td className="py-2 text-right text-slate-600">{angka(r.habis)}</td>
              <td className="py-2 text-right">
                {r.jumlah_stok_lambat > 0 ? (
                  <span className="font-bold text-amber-600">{angka(r.jumlah_stok_lambat)} produk · {rupiah(r.nilai_stok_lambat)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
