import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import PosHeaderBar from '../components/PosHeaderBar';
import { useAuth } from '../../../context/AuthContext';
import { fetchAllPages } from '../../../utils/paginatedApi';
import { todayISO } from '../../../utils/date';

// Riwayat Void (2026-10-08): gabungan permintaan void transaksi kasir
// (/pos-void-requests/) dan pesanan (/order-void-requests/). Kasir melihat
// permintaan miliknya sendiri; Owner/Manager melihat semua (dibatasi backend).

const STATUS = {
  pending: { label: 'Menunggu Persetujuan', kelas: 'bg-amber-50 text-amber-700 border-amber-200' },
  menunggu_spv: { label: 'Menunggu SPV', kelas: 'bg-amber-50 text-amber-700 border-amber-200' },
  // Disetujui = OTP sudah keluar, transaksi BELUM di-void sampai kasir
  // memasukkan OTP (berlaku 15 menit). Lewat batas = kedaluwarsa.
  disetujui: { label: 'Disetujui, OTP belum dipakai', kelas: 'bg-sky-50 text-sky-700 border-sky-200' },
  kedaluwarsa: { label: 'OTP Kedaluwarsa (tidak di-void)', kelas: 'bg-slate-100 text-slate-500 border-slate-200' },
  digunakan: { label: 'Sudah Di-void', kelas: 'bg-slate-800 text-white border-slate-800' },
  ditolak: { label: 'Ditolak', kelas: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const SARING = [
  { id: 'semua', label: 'Semua' },
  { id: 'proses', label: 'Menunggu', cocok: ['pending', 'menunggu_spv', 'disetujui'] },
  { id: 'digunakan', label: 'Sudah Di-void', cocok: ['digunakan'] },
  { id: 'ditolak', label: 'Ditolak', cocok: ['ditolak'] },
];

const rupiah = (n) => (n == null ? '-' : `Rp ${Number(n).toLocaleString('id-ID')}`);
const waktu = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

function geserHari(iso, hari) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + hari);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RiwayatVoid({ onToggleSidebar }) {
  const { user } = useAuth();
  const kasirName = user?.nama_lengkap || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || '-';
  const [baris, setBaris] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [saring, setSaring] = useState('semua');
  const [cari, setCari] = useState('');
  const [dari, setDari] = useState(geserHari(todayISO(), -29));
  const [sampai, setSampai] = useState(todayISO());

  const muat = async () => {
    setMemuat(true);
    setGalat('');
    try {
      const [pos, order] = await Promise.all([
        fetchAllPages('/pos-void-requests/'),
        fetchAllPages('/order-void-requests/'),
      ]);
      setBaris([
        ...pos.map((r) => ({ ...r, jenis: 'Kasir', nomor: r.sale_nomor, total: r.sale_total, pelanggan: '' })),
        ...order.map((r) => ({ ...r, jenis: 'Pesanan', nomor: r.order, total: r.order_total, pelanggan: r.order_nama || '' })),
      ].sort((a, b) => new Date(b.dibuat_pada) - new Date(a.dibuat_pada)));
    } catch {
      setGalat('Gagal memuat riwayat void.');
    } finally {
      setMemuat(false);
    }
  };

  useEffect(() => { muat(); }, []);

  const tampil = useMemo(() => {
    const aturan = SARING.find((s) => s.id === saring);
    const q = cari.trim().toLowerCase();
    return baris.filter((r) => {
      const tgl = r.dibuat_pada ? new Date(r.dibuat_pada).toLocaleDateString('sv-SE') : '';
      if (dari && tgl < dari) return false;
      if (sampai && tgl > sampai) return false;
      if (aturan?.cocok && !aturan.cocok.includes(r.status)) return false;
      if (saring === 'proses' && r.status === 'disetujui' && r.kadaluarsa) return false;
      if (q && ![r.nomor, r.pelanggan, r.alasan, r.diminta_oleh_nama].some((v) => String(v || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [baris, saring, cari, dari, sampai]);

  const ringkas = useMemo(() => {
    const divoid = tampil.filter((r) => r.status === 'digunakan');
    return {
      jumlah: tampil.length,
      divoid: divoid.length,
      nilai: divoid.reduce((s, r) => s + Number(r.total || 0), 0),
      ditolak: tampil.filter((r) => r.status === 'ditolak').length,
    };
  }, [tampil]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] overflow-hidden">
      <PosHeaderBar accountName={kasirName} onToggleSidebar={onToggleSidebar} />
      <div className="bg-[#0088FF] px-6 py-2.5 text-white flex items-center justify-between shadow-sm shrink-0 font-bold text-xs">
        <span>Riwayat Void</span>
        <button type="button" onClick={muat} className="inline-flex items-center gap-1.5 cursor-pointer">
          <RefreshCw size={14} className={memuat ? 'animate-spin' : ''} /> Muat ulang
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Permintaan', ringkas.jumlah],
            ['Sudah Di-void', ringkas.divoid],
            ['Nilai Di-void', rupiah(ringkas.nilai)],
            ['Ditolak', ringkas.ditolak],
          ].map(([label, nilai]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{nilai}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-1.5">
            {SARING.map((s) => (
              <button
                key={s.id} type="button" onClick={() => setSaring(s.id)}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold ${saring === s.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            –
            <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="relative ml-auto min-w-[220px] flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nomor, pelanggan, alasan..."
              className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>

        {galat && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{galat}</div>}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Waktu Diminta</th>
                <th className="px-4 py-3">Transaksi</th>
                <th className="px-4 py-3 text-right">Nilai</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Diproses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tampil.map((r) => {
                const kunciStatus = r.status === 'disetujui' && r.kadaluarsa ? 'kedaluwarsa' : r.status;
                const st = STATUS[kunciStatus] || { label: r.status, kelas: 'bg-slate-100 text-slate-600 border-slate-200' };
                return (
                  <tr key={`${r.jenis}-${r.id}`} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {waktu(r.dibuat_pada)}
                      <div className="text-xs text-slate-400">oleh {r.diminta_oleh_nama || '-'}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-slate-800">{r.nomor}</span>
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{r.jenis}</span>
                      {r.pelanggan && <div className="text-xs text-slate-400">{r.pelanggan}</div>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-slate-800">{rupiah(r.total)}</td>
                    <td className="px-4 py-3 max-w-xs text-slate-700">
                      {r.alasan || '-'}
                      {r.status === 'ditolak' && r.alasan_tolak && (
                        <div className="mt-1 text-xs text-rose-600">Alasan ditolak: {r.alasan_tolak}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${st.kelas}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {r.disetujui_oleh_nama ? <div>Oleh {r.disetujui_oleh_nama}</div> : null}
                      {r.disetujui_pada && <div>{waktu(r.disetujui_pada)}</div>}
                      {r.digunakan_pada && <div>Di-void {waktu(r.digunakan_pada)}</div>}
                      {!r.disetujui_oleh_nama && !r.disetujui_pada && '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!memuat && !tampil.length && <p className="py-10 text-center text-sm text-slate-400">Belum ada riwayat void pada periode ini.</p>}
          {memuat && <p className="py-10 text-center text-sm text-slate-400">Memuat...</p>}
        </div>
      </div>
    </div>
  );
}
