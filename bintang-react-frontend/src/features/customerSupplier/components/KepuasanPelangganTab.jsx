import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquareText, Plus, Smile, Star, Users } from 'lucide-react';
import apiClient from '../../../api/apiClient';

// Tab Kepuasan Pelanggan: rekap survei dari struk online (2026-10-06).
// Pelanggan mengisi lewat tautan struk di resi/invoice WhatsApp.
// Grafik digambar dengan SVG sendiri (tanpa library chart), palet netral +
// aksen kuning untuk bintang.

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tglPendek = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()} ${BULAN[d.getMonth()]}`;
};
const waktu = (iso) =>
  new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const isoHari = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESET = [
  { id: '7', label: '7 hari', hari: 7 },
  { id: '30', label: '30 hari', hari: 30 },
  { id: '90', label: '90 hari', hari: 90 },
  { id: 'semua', label: 'Semua', hari: null },
];

export function BintangNilai({ nilai, ukuran = 16 }) {
  const persen = Math.max(0, Math.min(100, (Number(nilai || 0) / 5) * 100));
  const baris = (kelas) => [1, 2, 3, 4, 5].map((n) => <Star key={n} size={ukuran} className={kelas} />);
  return (
    <span className="relative inline-flex">
      <span className="flex gap-0.5">{baris('text-slate-200 fill-slate-200')}</span>
      <span className="absolute inset-0 flex gap-0.5 overflow-hidden" style={{ width: `${persen}%` }}>
        {baris('shrink-0 text-amber-400 fill-amber-400')}
      </span>
    </span>
  );
}

function Kartu({ judul, keterangan, children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${className}`}>
      {judul && <h3 className="text-sm font-bold text-slate-800">{judul}</h3>}
      {keterangan && <p className="mt-0.5 text-xs text-slate-500">{keterangan}</p>}
      {children}
    </div>
  );
}

function KpiKartu({ ikon: Ikon, label, children, sub }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Ikon size={15} />
        </span>
        {label}
      </div>
      <div className="mt-3">{children}</div>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function CincinCsat({ persen }) {
  const r = 30;
  const keliling = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 76 76" className="h-[76px] w-[76px] -rotate-90">
      <circle cx="38" cy="38" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
      <circle
        cx="38" cy="38" r={r} fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(persen / 100) * keliling} ${keliling}`}
        style={{ transition: 'stroke-dasharray .6s ease' }}
      />
    </svg>
  );
}

// Garis halus (Catmull-Rom -> Bezier) untuk tren.
function jalurHalus(titik) {
  if (titik.length < 2) return '';
  let d = `M${titik[0][0]},${titik[0][1]}`;
  for (let i = 0; i < titik.length - 1; i += 1) {
    const p0 = titik[i - 1] || titik[i];
    const p1 = titik[i];
    const p2 = titik[i + 1];
    const p3 = titik[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function GrafikTren({ data }) {
  const [aktif, setAktif] = useState(null);
  const W = 640;
  const H = 230;
  const pad = { l: 34, r: 14, t: 16, b: 30 };
  const lebar = W - pad.l - pad.r;
  const tinggi = H - pad.t - pad.b;
  const n = data.length;
  const x = (i) => pad.l + (n === 1 ? lebar / 2 : (i / (n - 1)) * lebar);
  const y = (v) => pad.t + tinggi - (v / 5) * tinggi;
  const maksJumlah = Math.max(1, ...data.map((d) => d.jumlah));
  const lebarBatang = Math.max(4, Math.min(22, (lebar / Math.max(n, 1)) * 0.5));
  const titik = data.map((d, i) => [x(i), y(d.rata_rata)]);
  const garis = n > 1 ? jalurHalus(titik) : '';
  const area = n > 1 ? `${garis} L${titik[n - 1][0]},${pad.t + tinggi} L${titik[0][0]},${pad.t + tinggi} Z` : '';
  const langkahLabel = Math.max(1, Math.ceil(n / 7));

  if (!n) return <p className="py-16 text-center text-sm text-slate-400">Belum ada data pada periode ini.</p>;

  return (
    <div className="relative" onMouseLeave={() => setAktif(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <defs>
          <linearGradient id="trenArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#f1f5f9" />
            <text x={pad.l - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const t = (d.jumlah / maksJumlah) * tinggi * 0.35;
          return (
            <rect
              key={d.tanggal} x={x(i) - lebarBatang / 2} y={pad.t + tinggi - t} width={lebarBatang} height={t} rx="3"
              fill={aktif === i ? '#cbd5e1' : '#e2e8f0'}
            />
          );
        })}
        {area && <path d={area} fill="url(#trenArea)" />}
        {garis && <path d={garis} fill="none" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />}
        {titik.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={aktif === i ? 5.5 : 3.5} fill="#fff" stroke="#1e293b" strokeWidth="2" />
        ))}
        {aktif !== null && <line x1={x(aktif)} x2={x(aktif)} y1={pad.t} y2={pad.t + tinggi} stroke="#94a3b8" strokeDasharray="3 3" />}
        {data.map((d, i) =>
          i % langkahLabel === 0 || i === n - 1 ? (
            <text key={d.tanggal} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">{tglPendek(d.tanggal)}</text>
          ) : null,
        )}
        {data.map((d, i) => {
          const sel = n === 1 ? lebar : lebar / (n - 1);
          return (
            <rect key={d.tanggal} x={x(i) - sel / 2} y={pad.t} width={sel} height={tinggi} fill="transparent" onMouseEnter={() => setAktif(i)} />
          );
        })}
      </svg>
      {aktif !== null && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(aktif) / W) * 100}%` }}
        >
          <p className="font-semibold">{tglPendek(data[aktif].tanggal)}</p>
          <p>Rata-rata {data[aktif].rata_rata.toFixed(2)}</p>
          <p className="text-slate-300">{data[aktif].jumlah} tanggapan</p>
        </div>
      )}
    </div>
  );
}

export function SebaranBintang({ sebaran }) {
  const total = sebaran.reduce((s, b) => s + b.jumlah, 0);
  return (
    <div className="mt-4 space-y-3">
      {sebaran.map((b) => {
        const persen = total ? (b.jumlah / total) * 100 : 0;
        return (
          <div key={b.bintang} className="flex items-center gap-3 text-sm">
            <span className="flex w-9 shrink-0 items-center gap-1 font-semibold text-slate-700">
              {b.bintang}
              <Star size={13} className="fill-amber-400 text-amber-400" />
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${persen}%`, transition: 'width .6s ease' }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-slate-500">
              {Math.round(persen)}% <span className="text-slate-400">({b.jumlah})</span>
            </span>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-slate-400">Dihitung dari semua nilai per aspek ({total} nilai).</p>
    </div>
  );
}

export function RadarAspek({ data }) {
  const n = data.length;
  const S = 300;
  const c = S / 2;
  const R = 92;
  const sudut = (i) => -Math.PI / 2 + (i / n) * 2 * Math.PI;
  const titik = (i, v) => [c + Math.cos(sudut(i)) * (R * v) / 5, c + Math.sin(sudut(i)) * (R * v) / 5];
  const poligon = (v) => data.map((_, i) => titik(i, typeof v === 'function' ? v(i) : v).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto h-auto w-full max-w-[300px]">
      {[1, 2, 3, 4, 5].map((v) => (
        <polygon key={v} points={poligon(v)} fill={v === 5 ? '#f8fafc' : 'none'} stroke="#e2e8f0" />
      ))}
      {data.map((_, i) => {
        const [ex, ey] = titik(i, 5);
        return <line key={i} x1={c} y1={c} x2={ex} y2={ey} stroke="#e2e8f0" />;
      })}
      <polygon points={poligon((i) => data[i].rata_rata)} fill="#1e293b" fillOpacity="0.15" stroke="#1e293b" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [px, py] = titik(i, d.rata_rata);
        return <circle key={d.aspek} cx={px} cy={py} r="3.5" fill="#1e293b" />;
      })}
      {data.map((d, i) => {
        const [lx, ly] = titik(i, 6.4);
        const cos = Math.cos(sudut(i));
        const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
        const kata = d.aspek.split(' ');
        const baris = kata.length > 2 ? [kata.slice(0, 2).join(' '), kata.slice(2).join(' ')] : [d.aspek];
        return (
          <text key={d.aspek} x={lx} y={ly} textAnchor={anchor} fontSize="10.5" fill="#475569">
            {baris.map((b, j) => (
              <tspan key={j} x={lx} dy={j === 0 ? (baris.length > 1 ? -2 : 4) : 12}>{b}</tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

export function PeringkatAspek({ data }) {
  const urut = [...data].sort((a, b) => b.rata_rata - a.rata_rata);
  return (
    <div className="space-y-4">
      {urut.map((a) => (
        <div key={a.aspek}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-slate-700">{a.aspek}</span>
            <span className="font-bold text-slate-900">{a.rata_rata.toFixed(2)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-slate-800" style={{ width: `${(a.rata_rata / 5) * 100}%`, transition: 'width .6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function KelolaAspek() {
  const [aspek, setAspek] = useState([]);
  const [baru, setBaru] = useState('');
  const [galat, setGalat] = useState('');

  const muat = useCallback(() => {
    apiClient.get('/aspek-survei/').then((r) => setAspek(Array.isArray(r.data) ? r.data : r.data.results || []));
  }, []);
  useEffect(muat, [muat]);

  const jalankan = async (aksi) => {
    setGalat('');
    try {
      await aksi();
      muat();
    } catch (err) {
      const d = err.response?.data;
      setGalat(d?.error || d?.nama?.[0] || 'Gagal menyimpan aspek.');
    }
  };

  const tambah = () =>
    baru.trim() &&
    jalankan(async () => {
      await apiClient.post('/aspek-survei/', { nama: baru.trim(), urutan: aspek.length + 1, aktif: true });
      setBaru('');
    });

  return (
    <Kartu judul="Aspek Penilaian" keterangan="Aspek aktif tampil di struk online. Aspek yang sudah dinilai tidak bisa dihapus, cukup dinonaktifkan.">
      <div className="mt-3 divide-y divide-slate-100">
        {aspek.map((a) => (
          <div key={a.id} className="flex items-center justify-between py-2 text-sm">
            <span className={a.aktif ? 'text-slate-800' : 'text-slate-400 line-through'}>{a.nama}</span>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                className="cursor-pointer text-slate-600 hover:text-slate-900"
                onClick={() => jalankan(() => apiClient.patch(`/aspek-survei/${a.id}/`, { aktif: !a.aktif }))}
              >
                {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button
                type="button"
                className="cursor-pointer text-red-600 hover:text-red-700"
                onClick={() => window.confirm(`Hapus aspek "${a.nama}"?`) && jalankan(() => apiClient.delete(`/aspek-survei/${a.id}/`))}
              >
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={baru}
          onChange={(e) => setBaru(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tambah()}
          placeholder="Aspek baru, mis. Kebersihan Toko"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <button type="button" onClick={tambah} className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-slate-800 px-3 text-sm font-semibold text-white">
          <Plus size={16} /> Tambah
        </button>
      </div>
      {galat && <p className="mt-2 text-xs text-red-600">{galat}</p>}
    </Kartu>
  );
}

const SARING_TANGGAPAN = [
  { id: 'semua', label: 'Semua', cocok: () => true },
  { id: 'puas', label: 'Puas (≥ 4)', cocok: (t) => t.rata_rata >= 4 },
  { id: 'perhatian', label: 'Perlu perhatian (< 4)', cocok: (t) => t.rata_rata < 4 },
  { id: 'saran', label: 'Ada saran', cocok: (t) => Boolean(t.catatan) },
];

function DaftarTanggapan({ tanggapan }) {
  const [saring, setSaring] = useState('semua');
  const tampil = tanggapan.filter(SARING_TANGGAPAN.find((s) => s.id === saring).cocok);
  return (
    <Kartu>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-800">Tanggapan Pelanggan</h3>
        <div className="flex flex-wrap gap-1.5">
          {SARING_TANGGAPAN.map((s) => (
            <button
              key={s.id} type="button" onClick={() => setSaring(s.id)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ${saring === s.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {tampil.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                  {(t.pelanggan || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{t.pelanggan || 'Pelanggan umum'}</p>
                  <p className="text-xs text-slate-400">
                    {t.transaksi} · {t.jenis === 'pos' ? 'Kasir' : 'Pesanan'} · {waktu(t.waktu)}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <BintangNilai nilai={t.rata_rata} ukuran={13} />
                <p className="text-xs font-bold text-slate-700">{t.rata_rata.toFixed(2)}</p>
              </div>
            </div>
            {t.catatan && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">“{t.catatan}”</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {t.nilai.map((n) => (
                <span key={n.aspek} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
                  {n.aspek} <b className="text-slate-800">{n.nilai}</b>
                </span>
              ))}
            </div>
          </div>
        ))}
        {!tampil.length && <p className="py-8 text-center text-sm text-slate-400 md:col-span-2">Tidak ada tanggapan.</p>}
      </div>
    </Kartu>
  );
}

export default function KepuasanPelangganTab() {
  const [preset, setPreset] = useState('30');
  const [mulai, setMulai] = useState(() => isoHari(new Date(Date.now() - 29 * 864e5)));
  const [selesai, setSelesai] = useState(() => isoHari(new Date()));
  const [data, setData] = useState(null);
  const [memuat, setMemuat] = useState(false);

  const pilihPreset = (p) => {
    setPreset(p.id);
    setMulai(p.hari ? isoHari(new Date(Date.now() - (p.hari - 1) * 864e5)) : '');
    setSelesai(p.hari ? isoHari(new Date()) : '');
  };

  useEffect(() => {
    setMemuat(true);
    apiClient
      .get('/survei-kepuasan/', { params: { mulai: mulai || undefined, selesai: selesai || undefined } })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setMemuat(false));
  }, [mulai, selesai]);

  const d = useMemo(
    () => ({ jumlah: 0, rata_rata: 0, csat: 0, jumlah_catatan: 0, per_aspek: [], tren: [], sebaran: [], tanggapan: [], ...(data || {}) }),
    [data],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {PRESET.map((p) => (
            <button
              key={p.id} type="button" onClick={() => pilihPreset(p)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold ${preset === p.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          {memuat && <span className="pb-2 text-xs text-slate-400">Memuat...</span>}
          <input
            type="date" value={mulai} onChange={(e) => { setPreset(''); setMulai(e.target.value); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <span className="pb-1.5 text-slate-400">–</span>
          <input
            type="date" value={selesai} onChange={(e) => { setPreset(''); setSelesai(e.target.value); }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiKartu ikon={Star} label="Rata-rata Penilaian">
          <div className="flex items-end gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{d.rata_rata.toFixed(2)}</span>
            <span className="pb-1 text-sm text-slate-400">/ 5</span>
          </div>
          <div className="mt-1"><BintangNilai nilai={d.rata_rata} /></div>
        </KpiKartu>
        <KpiKartu ikon={Smile} label="CSAT (Puas)">
          <div className="flex items-center gap-4">
            <div className="relative">
              <CincinCsat persen={d.csat} />
              <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900">{Math.round(d.csat)}%</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">Tanggapan dengan rata-rata 4 bintang ke atas.</p>
          </div>
        </KpiKartu>
        <KpiKartu ikon={Users} label="Jumlah Tanggapan" sub="Satu tanggapan per transaksi">
          <span className="text-3xl font-extrabold text-slate-900">{d.jumlah}</span>
        </KpiKartu>
        <KpiKartu ikon={MessageSquareText} label="Memberi Saran" sub={d.jumlah ? `${Math.round((d.jumlah_catatan / d.jumlah) * 100)}% dari tanggapan` : 'Belum ada tanggapan'}>
          <span className="text-3xl font-extrabold text-slate-900">{d.jumlah_catatan}</span>
        </KpiKartu>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu judul="Tren Kepuasan" keterangan="Garis = rata-rata harian (skala 1–5), batang = jumlah tanggapan." className="lg:col-span-2">
          <div className="mt-3"><GrafikTren data={d.tren} /></div>
        </Kartu>
        <Kartu judul="Sebaran Bintang">
          <SebaranBintang sebaran={d.sebaran.length ? d.sebaran : [5, 4, 3, 2, 1].map((b) => ({ bintang: b, jumlah: 0 }))} />
        </Kartu>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Kartu judul="Nilai per Aspek" keterangan="Aspek terkuat di atas; aspek terbawah jadi prioritas perbaikan." className="lg:col-span-2">
          {d.per_aspek.length ? (
            <div className="mt-4 grid items-center gap-6 md:grid-cols-2">
              {d.per_aspek.length >= 3 ? <RadarAspek data={d.per_aspek} /> : null}
              <div className={d.per_aspek.length >= 3 ? '' : 'md:col-span-2'}><PeringkatAspek data={d.per_aspek} /></div>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">Belum ada penilaian pada periode ini.</p>
          )}
        </Kartu>
        <KelolaAspek />
      </div>

      <DaftarTanggapan tanggapan={d.tanggapan} />
    </div>
  );
}
