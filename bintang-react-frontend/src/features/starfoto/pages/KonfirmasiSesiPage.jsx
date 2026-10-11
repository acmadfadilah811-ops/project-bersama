import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import PosHeaderBar from '../../kasir/components/PosHeaderBar';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { todayISO } from '../../../utils/date';
import { LABEL_STATUS_PESANAN, formatJadwal, formatRupiah } from '../hooks/useStarfoto';

// Kasir StarFoto (2026-10-11): konfirmasi sesi (usulan tambahan + pilih file
// + catatan) lalu SPK Edit; pantau sesi berjalan & jadwal studio.

const daftar = (data) => (Array.isArray(data) ? data : data?.results || []);
const barisFileKosong = () => ({ nomor_file: '', peruntukan: '', catatan: '' });

function geserHari(iso, hari) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + hari);
  return d.toLocaleDateString('sv-SE');
}

function FormKonfirmasi({ pesanan, onSelesai }) {
  const [keputusan, setKeputusan] = useState({});
  const [files, setFiles] = useState([barisFileKosong()]);
  const [catatanFile, setCatatanFile] = useState('');
  const [deadline, setDeadline] = useState(geserHari(todayISO(), 3));
  const [jam, setJam] = useState('17:00');
  const [menyimpan, setMenyimpan] = useState(false);

  const usulan = pesanan.usulan.filter((u) => u.status === 'usulan');
  const putusan = (id) => keputusan[id] || { setuju: true, alasan: '' };
  const ubahFile = (i, kunci, nilai) => setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, [kunci]: nilai } : f)));
  const jumlahFile = files.filter((f) => f.nomor_file.trim()).length;
  const tambahanDisetujui = usulan.reduce((s, u) => s + (putusan(u.id).setuju ? Number(u.harga_satuan) * u.qty : 0), 0);

  const simpan = async () => {
    setMenyimpan(true);
    try {
      await apiClient.post(`/starfoto/pesanan/${pesanan.id}/konfirmasi/`, {
        usulan: usulan.map((u) => ({ id: u.id, ...putusan(u.id) })),
        pilihan_file: files.filter((f) => f.nomor_file.trim()),
        catatan_file: catatanFile,
        spk: { deadline, deadline_jam: jam || null },
      });
      notifySuccess('Sesi dikonfirmasi', 'SPK Edit sudah masuk antrean Editor.');
      onSelesai();
    } catch (err) {
      notifyApiError(err, 'Gagal mengonfirmasi sesi.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-400">Usulan tambahan dari fotografer</p>
        {usulan.length === 0 && <p className="text-slate-400">Tidak ada usulan.</p>}
        {usulan.map((u) => {
          const p = putusan(u.id);
          return (
            <div key={u.id} className="mb-2 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{u.nama} ×{u.qty}</p>
                  <p className="text-xs text-slate-500">oleh {u.diusulkan_oleh_nama || '-'}{u.catatan ? ` · ${u.catatan}` : ''}</p>
                </div>
                <span className="font-bold text-slate-700">{formatRupiah(Number(u.harga_satuan) * u.qty)}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {[[true, 'Setujui'], [false, 'Tolak']].map(([nilai, label]) => (
                  <button
                    key={label} type="button"
                    onClick={() => setKeputusan((prev) => ({ ...prev, [u.id]: { ...p, setuju: nilai } }))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${p.setuju === nilai ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {label}
                  </button>
                ))}
                {!p.setuju && (
                  <input
                    value={p.alasan} placeholder="Alasan ditolak"
                    onChange={(e) => setKeputusan((prev) => ({ ...prev, [u.id]: { ...p, alasan: e.target.value } }))}
                    className="flex-1 rounded-lg border border-slate-300 px-2 text-xs"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-slate-400">File dipilih pelanggan</p>
          <span className={`text-xs font-semibold ${jumlahFile > pesanan.jumlah_edit ? 'text-amber-700' : 'text-slate-500'}`}>
            {jumlahFile} file · jatah edit paket {pesanan.jumlah_edit}
          </span>
        </div>
        {files.map((f, i) => (
          <div key={i} className="mb-2 grid grid-cols-[90px_1fr_1fr_auto] gap-2">
            <input value={f.nomor_file} onChange={(e) => ubahFile(i, 'nomor_file', e.target.value)} placeholder="No. file" className="rounded-lg border border-slate-300 p-2" />
            <input value={f.peruntukan} onChange={(e) => ubahFile(i, 'peruntukan', e.target.value)} placeholder="Untuk (edit, cetak 8RP, pigura)" className="rounded-lg border border-slate-300 p-2" />
            <input value={f.catatan} onChange={(e) => ubahFile(i, 'catatan', e.target.value)} placeholder="Catatan untuk editor" className="rounded-lg border border-slate-300 p-2" />
            <button type="button" onClick={() => setFiles((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))} className="p-2 text-slate-400 hover:text-rose-600" aria-label="Hapus baris">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setFiles((prev) => [...prev, barisFileKosong()])} className="flex items-center gap-1 text-xs font-bold text-slate-600">
          <Plus size={14} /> Tambah file
        </button>
        {jumlahFile > pesanan.jumlah_edit && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            File melebihi jatah edit paket. Tambahkan addon edit lewat usulan tambahan sebelum konfirmasi bila pelanggan setuju.
          </p>
        )}
        <textarea
          value={catatanFile} onChange={(e) => setCatatanFile(e.target.value)} rows={2} placeholder="Catatan umum untuk editor"
          className="mt-2 w-full rounded-lg border border-slate-300 p-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-400">Deadline SPK Edit</span>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" />
        </label>
        <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-400">Jam</span>
          <input type="time" value={jam} onChange={(e) => setJam(e.target.value)} className="w-full rounded-lg border border-slate-300 p-2" />
        </label>
      </div>

      <div className="rounded-lg bg-slate-50 p-3">
        <div className="flex justify-between"><span className="text-slate-500">Sisa tagihan saat ini</span><span className="font-bold">{formatRupiah(pesanan.sisa_tagihan)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Tambahan disetujui</span><span className="font-bold">{formatRupiah(tambahanDisetujui)}</span></div>
        <p className="mt-1 text-xs text-slate-400">Penagihan dilakukan di Pesanan & Pelunasan setelah konfirmasi.</p>
      </div>

      <button
        type="button" onClick={simpan} disabled={menyimpan || !jumlahFile || !deadline}
        className="w-full rounded-xl bg-slate-800 py-2.5 font-bold text-white disabled:opacity-40"
      >
        {menyimpan ? 'Menyimpan...' : 'Konfirmasi & Kirim ke Editor'}
      </button>
    </div>
  );
}

export default function KonfirmasiSesiPage({ onToggleSidebar }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const kasirName = user?.nama_lengkap || user?.username || '-';
  const [tab, setTab] = useState('menunggu');
  const [pesanan, setPesanan] = useState([]);
  const [jadwal, setJadwal] = useState([]);
  const [dari, setDari] = useState(todayISO());
  const [dipilih, setDipilih] = useState(null);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [p, j] = await Promise.all([
        apiClient.get('/starfoto/pesanan/', { params: { status: 'menunggu_kasir,sesi', page_size: 200 } }),
        apiClient.get('/starfoto/jadwal/', { params: { dari, sampai: geserHari(dari, 6) } }),
      ]);
      setPesanan(daftar(p.data));
      setJadwal(daftar(j.data));
    } catch (err) {
      notifyApiError(err, 'Gagal memuat data sesi foto.');
    } finally {
      setMemuat(false);
    }
  }, [dari]);

  useEffect(() => { muat(); }, [muat]);

  const menunggu = pesanan.filter((p) => p.status === 'menunggu_kasir');
  const berjalan = pesanan.filter((p) => p.status === 'sesi');
  const tampil = tab === 'menunggu' ? menunggu : berjalan;
  const aktif = pesanan.find((p) => p.id === dipilih);

  const tombolTab = (id, label, jumlah) => (
    <button
      key={id} type="button" onClick={() => { setTab(id); setDipilih(null); }}
      className={`cursor-pointer rounded-full px-3 py-1 text-xs font-bold ${tab === id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {label}{jumlah != null ? ` (${jumlah})` : ''}
    </button>
  );

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-[#F8FAFC]">
      <PosHeaderBar accountName={kasirName} onToggleSidebar={onToggleSidebar} />
      <div className="flex shrink-0 items-center justify-between bg-[#0088FF] px-6 py-2.5 text-xs font-bold text-white shadow-sm">
        <span>Sesi Foto StarFoto</span>
        <button type="button" onClick={muat} className="inline-flex cursor-pointer items-center gap-1.5">
          <RefreshCw size={14} className={memuat ? 'animate-spin' : ''} /> Muat ulang
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <div className="flex flex-wrap gap-1.5">
          {tombolTab('menunggu', 'Menunggu Konfirmasi', menunggu.length)}
          {tombolTab('berjalan', 'Sedang Sesi', berjalan.length)}
          {tombolTab('jadwal', 'Jadwal 7 Hari')}
        </div>

        {tab === 'jadwal' ? (
          <div className="space-y-3">
            <input type="date" value={dari} onChange={(e) => setDari(e.target.value || todayISO())} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Jadwal</th><th className="px-4 py-3">Pelanggan</th><th className="px-4 py-3">Paket</th><th className="px-4 py-3">Lokasi</th><th className="px-4 py-3">Fotografer</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jadwal.map((s) => (
                    <tr key={s.id}>
                      <td className="whitespace-nowrap px-4 py-3">{formatJadwal(s.mulai)} · {s.durasi_menit}m</td>
                      <td className="px-4 py-3">{s.pelanggan}<div className="text-xs text-slate-400">{s.order_id}</div></td>
                      <td className="px-4 py-3">{s.paket} (sesi {s.urutan})</td>
                      <td className="px-4 py-3">{s.lokasi === 'outdoor' ? `Outdoor ${s.alamat || ''}` : 'Studio'}</td>
                      <td className="px-4 py-3">{s.fotografer_nama || <span className="text-amber-700">Belum diambil</span>}{s.asisten_nama ? ` + ${s.asisten_nama}` : ''}</td>
                      <td className="px-4 py-3 capitalize">{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!memuat && !jadwal.length && <p className="py-10 text-center text-sm text-slate-400">Tidak ada sesi pada 7 hari ini.</p>}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-2">
              {tampil.map((p) => (
                <button
                  key={p.id} type="button" onClick={() => setDipilih(p.id)}
                  className={`w-full rounded-xl border bg-white p-4 text-left ${dipilih === p.id ? 'border-slate-800' : 'border-slate-200 hover:border-slate-400'}`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-slate-800">{p.pelanggan}</span>
                    <span className="text-xs text-slate-400">{p.order}</span>
                  </div>
                  <p className="text-sm text-slate-500">{p.paket} · {p.jumlah_orang} orang{p.nomor_kantong ? ` · Kantong ${p.nomor_kantong}` : ''}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {p.sesi.map((s) => `${formatJadwal(s.mulai)} (${s.fotografer_nama || 'belum diambil'})`).join(' · ')}
                  </p>
                  {p.usulan.some((u) => u.status === 'usulan') && (
                    <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {p.usulan.filter((u) => u.status === 'usulan').length} usulan tambahan
                    </span>
                  )}
                </button>
              ))}
              {!memuat && !tampil.length && <p className="py-10 text-center text-sm text-slate-400">Tidak ada pesanan.</p>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              {!aktif && <p className="py-10 text-center text-sm text-slate-400">Pilih pesanan di kiri.</p>}
              {aktif && (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-bold text-slate-800">{aktif.pelanggan} · {aktif.paket}</p>
                    <p className="text-xs text-slate-500">{aktif.order} · {LABEL_STATUS_PESANAN[aktif.status]} · Total {formatRupiah(aktif.total_harga)}</p>
                  </div>
                  {aktif.status === 'menunggu_kasir' ? (
                    <FormKonfirmasi key={aktif.id} pesanan={aktif} onSelesai={() => { setDipilih(null); muat(); }} />
                  ) : (
                    <p className="text-sm text-slate-500">Sesi belum selesai. Konfirmasi tersedia setelah fotografer menekan Selesai.</p>
                  )}
                  <button type="button" onClick={() => navigate(`/kasir/pesanan?cari=${aktif.order}`)} className="text-xs font-bold text-slate-600 underline">
                    Buka di Pesanan & Pelunasan
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
