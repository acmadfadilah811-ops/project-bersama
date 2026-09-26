import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, XCircle } from 'lucide-react';
import { notifyApiError, notifySuccess } from '../../../../utils/notify';
import {
  ambilAkunKasPengajuan, ambilPengajuanGaji, bayarPengajuanGaji,
  otorisasiPengajuanGaji, tolakPengajuanGaji, verifikasiPengajuanGaji,
} from '../../services/payroll';

// Persetujuan pencairan gaji 5 tahap. Aturan & peran diperiksa ulang di backend;
// tombol di sini hanya mengikuti `aksi` yang dikirim server.
const TAHAP = [
  { kunci: 'diajukan', label: 'Diajukan HR' },
  { kunci: 'diverifikasi', label: 'Verifikasi SPV Finance' },
  { kunci: 'diotorisasi', label: 'Otorisasi Owner/Manager' },
  { kunci: 'dibayar', label: 'Dibayar' },
];
const URUTAN = { menunggu_verifikasi: 1, menunggu_otorisasi: 2, siap_dibayar: 3, dibayar: 4 };

const rp = (x) => `Rp ${Math.round(Number(x || 0)).toLocaleString('id-ID')}`;
const waktu = (iso) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

function Tahapan({ status }) {
  const selesai = URUTAN[status] ?? 0;
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
      {TAHAP.map((t, i) => {
        const beres = status === 'dibayar' ? true : i < selesai;
        return (
          <li key={t.kunci} className={`flex items-center gap-1 ${beres ? 'text-slate-900' : 'text-slate-400'}`}>
            {beres ? <CheckCircle2 size={14} /> : <Circle size={14} />} {t.label}
          </li>
        );
      })}
    </ol>
  );
}

function FormBayar({ pengajuan, onSelesai, onBatal }) {
  const [akun, setAkun] = useState([]);
  const [akunKas, setAkunKas] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [bukti, setBukti] = useState(null);
  const [proses, setProses] = useState(false);

  useEffect(() => {
    ambilAkunKasPengajuan().then(setAkun).catch((e) => notifyApiError(e, 'Gagal memuat akun Kas & Bank.'));
  }, []);

  const kirim = async () => {
    setProses(true);
    try {
      await bayarPengajuanGaji(pengajuan.id, { akunKas, tanggal, bukti });
      notifySuccess('Pembayaran dicatat', 'Jurnal pembayaran dibuat dan slip di HR ditandai Dibayar.');
      onSelesai();
    } catch (e) {
      notifyApiError(e, 'Gagal mencatat pembayaran.');
    } finally {
      setProses(false);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <p className="text-xs text-slate-600">
        Transfer {rp(pengajuan.total_bersih)} ke karyawan, lalu catat di sini. Jurnal: Dr Hutang gaji, Cr Kas/Bank.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select value={akunKas} onChange={(e) => setAkunKas(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">Pilih akun Kas / Bank...</option>
          {akun.map((a) => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
        </select>
        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setBukti(e.target.files?.[0] || null)} className="text-xs" />
      </div>
      <p className="text-[11px] text-slate-500">Bukti transfer wajib (PDF/JPG/PNG, maks 10 MB).</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onBatal} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded">Batal</button>
        <button type="button" disabled={!akunKas || !bukti || proses} onClick={kirim}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded disabled:opacity-40">
          {proses ? 'Menyimpan...' : 'Catat Pembayaran'}
        </button>
      </div>
    </div>
  );
}

function KartuPengajuan({ p, onUbah }) {
  const [formBayar, setFormBayar] = useState(false);
  const [proses, setProses] = useState(false);
  const masalah = (p.cek || []).filter((c) => c.level === 'masalah');
  const peringatan = (p.cek || []).filter((c) => c.level === 'peringatan');
  const r = p.ringkasan || {};

  const jalankan = async (fn, pesan, konfirmasi) => {
    if (konfirmasi && !window.confirm(konfirmasi)) return;
    setProses(true);
    try {
      await fn();
      notifySuccess('Berhasil', pesan);
      onUbah();
    } catch (e) {
      notifyApiError(e, 'Aksi gagal.');
    } finally {
      setProses(false);
    }
  };

  const tolak = () => {
    const alasan = window.prompt('Alasan penolakan (wajib, akan dikirim ke HR):');
    if (alasan === null) return;
    jalankan(() => tolakPengajuanGaji(p.id, alasan), 'Pengajuan ditolak dan HR diberi tahu.');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Gaji {p.periode}</div>
          <div className="text-xs text-slate-500">{p.status_label}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-slate-900">{rp(p.total_bersih)}</div>
          <div className="text-[11px] text-slate-500">{r.jumlah_slip ?? '-'} slip · gaji kotor {rp(r.total_gross)}</div>
        </div>
      </div>

      <div className="mt-3"><Tahapan status={p.status} /></div>

      {(masalah.length > 0 || peringatan.length > 0) && (
        <ul className="mt-3 space-y-1">
          {masalah.map((c, i) => (
            <li key={`m${i}`} className="flex gap-1.5 text-xs text-red-700"><XCircle size={14} className="shrink-0 mt-0.5" />{c.pesan}</li>
          ))}
          {peringatan.map((c, i) => (
            <li key={`p${i}`} className="flex gap-1.5 text-xs text-amber-700"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{c.pesan}</li>
          ))}
        </ul>
      )}

      {p.status === 'ditolak' && (
        <p className="mt-3 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded p-2">
          Ditolak {p.ditolak_oleh}: {p.alasan_tolak}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {p.aksi?.verifikasi && (
          <button type="button" disabled={proses || masalah.length > 0}
            onClick={() => jalankan(() => verifikasiPengajuanGaji(p.id), 'Diverifikasi. Jurnal pengakuan dibuat; menunggu otorisasi.',
              'Setujui dan buat jurnal pengakuan gaji (Biaya gaji, Hutang gaji, Hutang BPJS)?')}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded disabled:opacity-40">
            Setujui (Verifikasi)
          </button>
        )}
        {p.aksi?.otorisasi && (
          <button type="button" disabled={proses}
            onClick={() => jalankan(() => otorisasiPengajuanGaji(p.id), 'Pencairan diotorisasi; siap dibayar.',
              `Otorisasi pencairan ${rp(p.total_bersih)}?`)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded disabled:opacity-40">
            Otorisasi Pencairan
          </button>
        )}
        {p.aksi?.bayar && !formBayar && (
          <button type="button" onClick={() => setFormBayar(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded">
            Catat Pembayaran
          </button>
        )}
        {p.aksi?.tolak && (
          <button type="button" disabled={proses} onClick={tolak}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40">
            Tolak
          </button>
        )}
        {p.aksi?.verifikasi && masalah.length > 0 && (
          <span className="text-xs text-red-700 self-center">Selesaikan masalah di atas sebelum menyetujui.</span>
        )}
      </div>

      {formBayar && <FormBayar pengajuan={p} onSelesai={() => { setFormBayar(false); onUbah(); }} onBatal={() => setFormBayar(false)} />}

      <details className="mt-3">
        <summary className="text-xs text-slate-500 cursor-pointer">Jejak persetujuan</summary>
        <ul className="mt-2 space-y-1">
          {(p.log || []).map((l, i) => (
            <li key={i} className="text-xs text-slate-600">
              <span className="text-slate-400">{waktu(l.pada)}</span> · {l.aksi}{l.oleh ? ` oleh ${l.oleh}` : ''}{l.catatan ? ` — ${l.catatan}` : ''}
            </li>
          ))}
          {p.jurnal_pengakuan && <li className="text-xs text-slate-600">Jurnal pengakuan: {p.jurnal_pengakuan}</li>}
          {p.jurnal_pembayaran && <li className="text-xs text-slate-600">Jurnal pembayaran: {p.jurnal_pembayaran}</li>}
          {p.bukti_transfer && <li className="text-xs"><a href={p.bukti_transfer} target="_blank" rel="noopener noreferrer" className="text-slate-900 underline">Lihat bukti transfer</a></li>}
          {p.sinkron_hr && <li className="text-xs text-slate-600">HR: {p.sinkron_hr}</li>}
        </ul>
      </details>
    </div>
  );
}

export default function PersetujuanGaji() {
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setDaftar(await ambilPengajuanGaji());
    } catch (e) {
      notifyApiError(e, 'Gagal memuat pengajuan gaji.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const terbuka = daftar.filter((p) => ['menunggu_verifikasi', 'menunggu_otorisasi', 'siap_dibayar'].includes(p.status));
  const riwayat = daftar.filter((p) => !terbuka.includes(p)).slice(0, 5);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Persetujuan Pencairan Gaji</h2>
        <p className="text-xs text-slate-500">
          HR mengajukan → SPV Finance verifikasi → Owner/Manager otorisasi → Finance bayar dengan bukti transfer.
        </p>
      </div>
      {memuat && <p className="text-sm text-slate-400">Memuat...</p>}
      {!memuat && terbuka.length === 0 && (
        <p className="text-sm text-slate-500 border border-dashed border-slate-300 rounded-lg p-4">
          Tidak ada pengajuan yang menunggu. Pengajuan muncul otomatis saat semua slip gaji sebulan dikonfirmasi di HR.
        </p>
      )}
      {terbuka.map((p) => <KartuPengajuan key={p.id} p={p} onUbah={muat} />)}
      {riwayat.length > 0 && (
        <details>
          <summary className="text-xs text-slate-500 cursor-pointer">Riwayat pengajuan ({riwayat.length})</summary>
          <div className="mt-2 space-y-2">{riwayat.map((p) => <KartuPengajuan key={p.id} p={p} onUbah={muat} />)}</div>
        </details>
      )}
    </section>
  );
}
