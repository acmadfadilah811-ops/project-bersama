import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, MessageCircle, Plus, RefreshCw, Send, ThumbsUp, Trash2, X } from 'lucide-react';
import PosHeaderBar from '../../kasir/components/PosHeaderBar';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { uiConfirm } from '../../../utils/dialog';
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
  // Paket tanpa jatah edit langsung ke Cetak; kasir boleh mengubah.
  const [tanpaEdit, setTanpaEdit] = useState(Number(pesanan.jumlah_edit || 0) === 0);

  const usulan = pesanan.usulan.filter((u) => u.status === 'usulan');
  // Belum diputuskan = setuju null; kasir wajib memilih Setujui/Tolak (2026-10-14).
  const putusan = (id) => keputusan[id] || { setuju: null, alasan: '' };
  const belumDiputus = usulan.filter((u) => putusan(u.id).setuju === null).length;
  const ubahFile = (i, kunci, nilai) => setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, [kunci]: nilai } : f)));
  const jumlahFile = files.filter((f) => f.nomor_file.trim()).length;
  const tambahanDisetujui = usulan.reduce((s, u) => s + (putusan(u.id).setuju === true ? Number(u.harga_satuan) * u.qty : 0), 0);
  const alasanBlokir = [
    belumDiputus ? `pilih Setujui/Tolak untuk ${belumDiputus} usulan tambahan` : '',
    !jumlahFile ? 'isi minimal 1 No. file yang dipilih pelanggan' : '',
    !deadline ? 'isi deadline SPK' : '',
  ].filter(Boolean);

  const simpan = async () => {
    setMenyimpan(true);
    try {
      await apiClient.post(`/starfoto/pesanan/${pesanan.id}/konfirmasi/`, {
        usulan: usulan.map((u) => ({ id: u.id, ...putusan(u.id) })),
        pilihan_file: files.filter((f) => f.nomor_file.trim()),
        catatan_file: catatanFile,
        tanpa_edit: tanpaEdit,
        spk: { deadline, deadline_jam: jam || null },
      });
      notifySuccess('Sesi dikonfirmasi', tanpaEdit ? 'SPK Cetak sudah masuk antrean Operator.' : 'SPK Edit sudah masuk antrean Editor.');
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
                {[[true, 'Setujui', Check], [false, 'Tolak', X]].map(([nilai, label, Ikon]) => (
                  <button
                    key={label} type="button" aria-pressed={p.setuju === nilai}
                    onClick={() => setKeputusan((prev) => ({ ...prev, [u.id]: { ...p, setuju: nilai } }))}
                    className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                      p.setuju === nilai ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Ikon size={13} /> {label}
                  </button>
                ))}
                {p.setuju === null && <span className="self-center text-xs text-amber-700">Belum diputuskan</span>}
                {p.setuju === false && (
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

      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={tanpaEdit} onChange={(e) => setTanpaEdit(e.target.checked)} />
        Langsung cetak (tanpa edit &amp; approval pelanggan)
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1"><span className="text-xs font-bold uppercase text-slate-400">Deadline SPK {tanpaEdit ? 'Cetak' : 'Edit'}</span>
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

      {alasanBlokir.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Sebelum konfirmasi: {alasanBlokir.join('; ')}.</p>
      )}
      <button
        type="button" onClick={simpan} disabled={menyimpan || alasanBlokir.length > 0}
        className="w-full rounded-xl bg-slate-800 py-2.5 font-bold text-white disabled:opacity-40"
      >
        {menyimpan ? 'Menyimpan...' : tanpaEdit ? 'Konfirmasi & Kirim ke Cetak' : 'Konfirmasi & Kirim ke Editor'}
      </button>
    </div>
  );
}

const nomorWa = (nomor) => String(nomor || '').replace(/\D/g, '').replace(/^0/, '62');
const sejak = (iso) => {
  if (!iso) return '-';
  const jam = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  return jam < 1 ? 'kurang dari 1 jam' : jam < 24 ? `${jam} jam` : `${Math.floor(jam / 24)} hari`;
};
const LABEL_APPROVAL = { menunggu: 'Menunggu pelanggan', revisi: 'Revisi di editor' };

function KartuApproval({ p, tertunda, onBerubah }) {
  const [proses, setProses] = useState('');
  const fotoBerjalan = p.pratinjau.filter((f) => f.putaran === p.approval_putaran);
  const jalankan = async (kunci, fn, sukses) => {
    setProses(kunci);
    try {
      await fn();
      notifySuccess(...sukses);
      onBerubah();
    } catch (err) {
      notifyApiError(err, 'Aksi gagal.');
    } finally {
      setProses('');
    }
  };
  const setujui = async () => {
    if (!(await uiConfirm(`Setujui ${fotoBerjalan.length} hasil edit atas nama ${p.pelanggan}? SPK Cetak langsung terbit.`))) return;
    jalankan('setuju', () => apiClient.post(`/starfoto/pesanan/${p.id}/approval/`, {
      keputusan: fotoBerjalan.map((f) => ({ id: f.id, setuju: true })),
    }), ['Disetujui', 'SPK Cetak diterbitkan.']);
  };
  return (
    <div className={`rounded-xl border bg-white p-4 ${tertunda ? 'border-amber-300' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800">{p.pelanggan} · {p.paket}</p>
          <p className="text-xs text-slate-500">{p.order}{p.nomor_kantong ? ` · Kantong ${p.nomor_kantong}` : ''} · putaran {p.approval_putaran}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tertunda ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
          {LABEL_APPROVAL[p.approval_status] || p.approval_status}{p.approval_status === 'menunggu' ? ` · ${sejak(p.approval_dikirim_pada)}` : ''}
        </span>
      </div>
      {tertunda && <p className="mt-2 text-xs font-semibold text-amber-800">Belum direspons pelanggan — mohon follow up atau putuskan.</p>}
      {p.approval_status === 'menunggu' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={proses === 'ulang'} onClick={() => jalankan('ulang', () => apiClient.post(`/starfoto/pesanan/${p.id}/kirim-ulang-link/`), ['Terkirim', 'Tautan persetujuan dikirim ulang.'])}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50">
            <Send size={13} /> Kirim ulang tautan
          </button>
          <a href={`https://wa.me/${nomorWa(p.nomor_wa)}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700">
            <MessageCircle size={13} /> Hubungi WA
          </a>
          <button type="button" disabled={proses === 'setuju'} onClick={setujui}
            className="flex items-center gap-1.5 rounded-lg bg-[#0088FF] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
            <ThumbsUp size={13} /> Setujui atas nama pelanggan
          </button>
        </div>
      )}
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
  const [approval, setApproval] = useState([]);
  const [tertundaIds, setTertundaIds] = useState(new Set());

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [p, j, a, t] = await Promise.all([
        apiClient.get('/starfoto/pesanan/', { params: { status: 'menunggu_kasir,sesi', page_size: 200 } }),
        apiClient.get('/starfoto/jadwal/', { params: { dari, sampai: geserHari(dari, 6) } }),
        apiClient.get('/starfoto/pesanan/', { params: { status: 'dikonfirmasi', approval: 'menunggu,revisi', page_size: 200 } }),
        apiClient.get('/starfoto/approval-tertunda/'),
      ]);
      setPesanan(daftar(p.data));
      setJadwal(daftar(j.data));
      setApproval(daftar(a.data));
      setTertundaIds(new Set(daftar(t.data).map((x) => x.id)));
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
          {tombolTab('approval', 'Approval Edit', approval.length)}
          {tombolTab('jadwal', 'Jadwal 7 Hari')}
        </div>

        {tab === 'approval' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Hasil edit yang menunggu persetujuan pelanggan atau sedang direvisi editor. Kartu kuning = belum direspons melewati batas waktu.</p>
            {[...approval].sort((x, y) => Number(tertundaIds.has(y.id)) - Number(tertundaIds.has(x.id))).map((p) => (
              <KartuApproval key={p.id} p={p} tertunda={tertundaIds.has(p.id)} onBerubah={muat} />
            ))}
            {!memuat && !approval.length && <p className="py-10 text-center text-sm text-slate-400">Tidak ada approval yang berjalan.</p>}
          </div>
        ) : tab === 'jadwal' ? (
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
                    <div className="space-y-2 text-sm text-slate-500">
                      <p>Sesi belum selesai. Konfirmasi tersedia setelah fotografer menekan Selesai.</p>
                      {aktif.usulan.some((u) => u.status === 'usulan') && (
                        <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                          Usulan tambahan ({aktif.usulan.filter((u) => u.status === 'usulan').map((u) => `${u.nama} ×${u.qty}`).join(', ')})
                          disetujui/ditolak di sini setelah sesi selesai, bersamaan dengan konfirmasi file.
                        </p>
                      )}
                    </div>
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
