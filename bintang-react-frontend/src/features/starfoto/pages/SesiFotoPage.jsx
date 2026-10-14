import { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock, MapPin, Navigation, Play, Plus, RefreshCw, Users } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { uiConfirm } from '../../../utils/dialog';
import UsulanTambahanModal from '../components/UsulanTambahanModal';
import DinasLuarModal from '../components/DinasLuarModal';
import KartuDinas, { jamMenit } from '../components/KartuDinas';
import { formatJadwal, formatRupiah, usePengaturanStarfoto } from '../hooks/useStarfoto';

// Halaman HP fotografer/asisten StarFoto (2026-10-11): Antrean Sesi (klaim
// global) + Sesi Saya (mulai, usulkan tambahan, selesai).

const hariIni = () => new Date().toLocaleDateString('sv-SE');
const hariDari = (iso) => new Date(iso).toLocaleDateString('sv-SE');

// "Hari ini" / "Besok" / "Rab, 14 Okt" untuk pengelompokan Sesi Saya.
function labelHari(hari) {
  const besok = new Date();
  besok.setDate(besok.getDate() + 1);
  if (hari === hariIni()) return 'Hari ini';
  if (hari === besok.toLocaleDateString('sv-SE')) return 'Besok';
  return new Date(`${hari}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}
const daftar = (data) => (Array.isArray(data) ? data : data?.results || []);

const STATUS_SESI = {
  terjadwal: 'bg-slate-100 text-slate-600',
  berlangsung: 'bg-amber-100 text-amber-800',
  selesai: 'bg-emerald-100 text-emerald-700',
  batal: 'bg-rose-100 text-rose-700',
};

function InfoSesi({ sesi }) {
  return (
    <div className="space-y-1 text-sm text-slate-600">
      <p className="flex items-center gap-1.5"><Clock size={14} /> {formatJadwal(sesi.mulai)} · {sesi.durasi_menit} menit</p>
      {sesi.lokasi === 'outdoor' ? (
        <p className="flex flex-wrap items-center gap-1.5">
          <MapPin size={14} />
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-800">Outdoor · Dinas Luar</span>
          <span className="font-semibold text-slate-800">{sesi.alamat || 'Alamat belum diisi — tanyakan ke kasir'}</span>
          {sesi.alamat && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sesi.alamat)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-blue-600 underline"
            >
              Buka di Maps
            </a>
          )}
        </p>
      ) : (
        <p className="flex items-center gap-1.5"><MapPin size={14} /> Studio</p>
      )}
      <p className="flex items-center gap-1.5">
        <Users size={14} /> {sesi.jumlah_orang} orang
        {sesi.nomor_kantong ? ` · Kantong ${sesi.nomor_kantong}` : ''}
        {sesi.background ? ` · BG ${sesi.background}` : ''}
      </p>
    </div>
  );
}

export default function SesiFotoPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('saya');
  const [tanggal, setTanggal] = useState(hariIni());
  // 'mendatang' = hari ini + jadwal ke depan; 'tanggal' = satu tanggal pilihan.
  const [modeSaya, setModeSaya] = useState('mendatang');
  const [antrean, setAntrean] = useState([]);
  const [sesiSaya, setSesiSaya] = useState([]);
  const [pesanan, setPesanan] = useState({});
  const [memuat, setMemuat] = useState(false);
  const [usulanUntuk, setUsulanUntuk] = useState(null);
  const [proses, setProses] = useState(null);
  const [dinasAktif, setDinasAktif] = useState(null);
  const [dinasList, setDinasList] = useState([]);
  const [dinasModal, setDinasModal] = useState(null);
  const { pengaturan } = usePengaturanStarfoto();
  const atasan = ['spv', 'kordiv'].includes(user?.role);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      // allSettled: staff yang berangkat langsung ke lokasi outdoor belum absen
      // kantor -> Antrean (butuh absen) boleh gagal, Sesi Saya & dinas tetap tampil.
      const [a, s, p, d, r] = await Promise.allSettled([
        apiClient.get('/starfoto/antrean-sesi/'),
        apiClient.get('/starfoto/sesi-saya/', { params: modeSaya === 'mendatang' ? { mendatang: 1 } : { tanggal } }),
        apiClient.get('/starfoto/pesanan/', { params: { status: 'sesi,menunggu_kasir', page_size: 100 } }),
        apiClient.get('/starfoto/dinas-luar/aktif/'),
        apiClient.get('/starfoto/dinas-luar/'),
      ]);
      const isi = (h) => (h.status === 'fulfilled' ? daftar(h.value.data) : []);
      setAntrean(isi(a));
      setSesiSaya(isi(s));
      setPesanan(Object.fromEntries(isi(p).map((x) => [x.id, x])));
      setDinasAktif(d.status === 'fulfilled' ? d.value.data?.aktif || null : null);
      setDinasList(isi(r));
      if (s.status === 'rejected') notifyApiError(s.reason, 'Gagal memuat sesi foto.');
    } catch (err) {
      notifyApiError(err, 'Gagal memuat sesi foto.');
    } finally {
      setMemuat(false);
    }
  }, [tanggal, modeSaya]);

  useEffect(() => { muat(); }, [muat]);

  const aksi = async (kunci, fn, sukses) => {
    setProses(kunci);
    try {
      await fn();
      if (sukses) notifySuccess(sukses[0], sukses[1]);
      await muat();
    } catch (err) {
      notifyApiError(err, 'Aksi gagal.');
    } finally {
      setProses(null);
    }
  };

  const ambil = (row) => aksi(
    `ambil-${row.pesanan_id}-${row.peran}`,
    () => apiClient.post(`/starfoto/antrean-sesi/${row.pesanan_id}/klaim/`, { peran: row.peran }),
    ['Sesi diambil', `Anda menjadi ${row.peran} untuk ${row.pelanggan}.`],
  );

  const selesai = async (sesi) => {
    if (!(await uiConfirm('Selesaikan sesi foto ini? Pesanan akan dikirim ke kasir untuk pilih file & konfirmasi.'))) return;
    aksi(`selesai-${sesi.id}`, () => apiClient.post(`/starfoto/sesi/${sesi.id}/selesai/`), ['Sesi selesai', 'Pesanan dikirim ke kasir.']);
  };

  const tombolTab = (id, label, jumlah) => (
    <button
      type="button" onClick={() => setTab(id)}
      className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${tab === id ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
    >
      {label}{jumlah ? ` (${jumlah})` : ''}
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-3 pb-24 md:pb-6">
      <div className="flex items-center justify-end md:justify-between">
        {/* Di HP judul sudah tampil di header atas. */}
        <h1 className="hidden items-center gap-2 text-lg font-bold text-slate-800 md:flex"><Camera size={20} /> Sesi Foto</h1>
        <button type="button" onClick={muat} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Muat ulang">
          <RefreshCw size={18} className={memuat ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex gap-2">
        {tombolTab('saya', 'Sesi Saya', sesiSaya.length)}
        {tombolTab('antrean', 'Antrean', antrean.length)}
        {tombolTab('dinas', atasan ? 'Dinas Tim' : 'Dinas')}
      </div>

      {dinasAktif && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <div>
            <p className="font-bold text-amber-900">Sedang dinas sejak {jamMenit(dinasAktif.mulai_pada)}</p>
            <p className="text-amber-800">{dinasAktif.tujuan}</p>
          </div>
          <button
            type="button" onClick={() => setDinasModal({ mode: 'selesai', dinasId: dinasAktif.id })}
            className="shrink-0 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white"
          >
            Selesai Dinas
          </button>
        </div>
      )}

      {tab === 'dinas' && (
        <div className="space-y-3">
          {!atasan && pengaturan?.dinas_luar_non_sesi && !dinasAktif && (
            <button
              type="button" onClick={() => setDinasModal({ mode: 'mulai', nonSesi: true })}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0088FF] py-3 text-sm font-bold text-white"
            >
              <Navigation size={16} /> Mulai Dinas Lain (di luar sesi)
            </button>
          )}
          <p className="text-xs text-slate-400">Riwayat 7 hari terakhir{atasan ? ' — tim Anda' : ''}.</p>
          {dinasList.map((dn) => <KartuDinas key={dn.id} d={dn} />)}
          {!memuat && !dinasList.length && <p className="py-10 text-center text-sm text-slate-400">Belum ada dinas luar.</p>}
        </div>
      )}

      {tab === 'antrean' && (
        <div className="space-y-3">
          {antrean.map((row) => (
            <div key={`${row.pesanan_id}-${row.peran}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-800">{row.pelanggan}</p>
                  <p className="text-sm text-slate-500">{row.paket}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold capitalize text-slate-600">{row.peran}</span>
              </div>
              <InfoSesi sesi={row} />
              <button
                type="button" onClick={() => ambil(row)} disabled={proses === `ambil-${row.pesanan_id}-${row.peran}`}
                className="mt-3 w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Ambil sebagai {row.peran}
              </button>
            </div>
          ))}
          {!memuat && !antrean.length && <p className="py-10 text-center text-sm text-slate-400">Tidak ada sesi yang menunggu diambil.</p>}
        </div>
      )}

      {tab === 'saya' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button" onClick={() => setModeSaya('mendatang')}
              className={`shrink-0 rounded-xl px-3 text-sm font-bold ${modeSaya === 'mendatang' ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-600'}`}
            >
              Mendatang
            </button>
            <input
              type="date" value={tanggal}
              onChange={(e) => { setTanggal(e.target.value || hariIni()); setModeSaya('tanggal'); }}
              className={`w-full rounded-xl border bg-white p-2.5 text-sm ${modeSaya === 'tanggal' ? 'border-slate-800' : 'border-slate-300 text-slate-400'}`}
            />
          </div>
          {sesiSaya.map((sesi, i) => {
            const detail = pesanan[sesi.pesanan_id];
            const usulan = detail?.usulan || [];
            const saya = sesi.fotografer === user?.id ? 'Fotografer' : 'Asisten';
            const hari = hariDari(sesi.mulai);
            // Sesi hari lain hanya ditampilkan sebagai jadwal; Mulai & usulan pada hari sesi.
            const hariH = hari === hariIni() || sesi.status === 'berlangsung';
            const bisaUsul = hariH && detail && ['sesi', 'menunggu_kasir'].includes(detail.status);
            const judulHari = modeSaya === 'mendatang' && (i === 0 || hariDari(sesiSaya[i - 1].mulai) !== hari);
            return (
              <div key={sesi.id} className="space-y-2">
              {judulHari && (
                <p className="px-1 pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{labelHari(hari)}</p>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{sesi.pelanggan}</p>
                    <p className="text-sm text-slate-500">{sesi.paket} · Sesi {sesi.urutan} · {saya}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_SESI[sesi.status] || ''}`}>{sesi.status}</span>
                </div>
                <InfoSesi sesi={sesi} />
                {sesi.asisten_nama && saya === 'Fotografer' && <p className="mt-1 text-xs text-slate-400">Asisten: {sesi.asisten_nama}</p>}

                {usulan.length > 0 && (
                  <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="text-xs font-bold uppercase text-slate-400">Usulan tambahan</p>
                    {usulan.map((u) => (
                      <div key={u.id} className="flex justify-between gap-2">
                        <span className="text-slate-700">{u.nama} ×{u.qty}</span>
                        <span className="text-xs text-slate-500">{u.status === 'usulan' ? 'Menunggu kasir' : u.status} · {formatRupiah(Number(u.harga_satuan) * u.qty)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!hariH && sesi.status === 'terjadwal' && (
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                    Jadwal sesi: {labelHari(hari)}. Tombol Mulai Sesi muncul pada hari sesi.
                  </p>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {hariH && sesi.status === 'terjadwal' && sesi.lokasi === 'outdoor' && !sesi.dinas_saya && (
                    <button
                      type="button" onClick={() => setDinasModal({ mode: 'mulai', sesi })}
                      className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#0088FF] py-3 text-sm font-bold text-white"
                    >
                      <Navigation size={16} /> Mulai Dinas (GPS + selfie)
                    </button>
                  )}
                  {hariH && sesi.status === 'terjadwal' && (sesi.lokasi !== 'outdoor' || sesi.dinas_saya) && (
                    <button
                      type="button" disabled={proses === `mulai-${sesi.id}`}
                      onClick={() => aksi(`mulai-${sesi.id}`, () => apiClient.post(`/starfoto/sesi/${sesi.id}/mulai/`), ['Sesi dimulai', 'Selamat bekerja!'])}
                      className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <Play size={16} /> Mulai Sesi
                    </button>
                  )}
                  {bisaUsul && (
                    <button
                      type="button" onClick={() => setUsulanUntuk(sesi)}
                      className={`flex items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 text-sm font-bold text-slate-700 ${sesi.status === 'berlangsung' ? '' : 'col-span-2'}`}
                    >
                      <Plus size={16} /> Usulkan Tambahan
                    </button>
                  )}
                  {sesi.status === 'berlangsung' && (
                    <button
                      type="button" onClick={() => selesai(sesi)} disabled={proses === `selesai-${sesi.id}`}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 size={16} /> Selesai
                    </button>
                  )}
                </div>
              </div>
              </div>
            );
          })}
          {!memuat && !sesiSaya.length && (
            <p className="py-10 text-center text-sm text-slate-400">
              {modeSaya === 'mendatang' ? 'Belum ada sesi Anda hari ini maupun ke depan.' : 'Belum ada sesi Anda pada tanggal ini.'} Cek tab Antrean untuk mengambil sesi.
            </p>
          )}
        </div>
      )}

      {dinasModal && (
        <DinasLuarModal
          mode={dinasModal.mode}
          sesi={dinasModal.sesi}
          dinasId={dinasModal.dinasId}
          nonSesi={dinasModal.nonSesi}
          onClose={() => setDinasModal(null)}
          onSaved={muat}
        />
      )}

      {usulanUntuk && (
        <UsulanTambahanModal
          pesananId={usulanUntuk.pesanan_id}
          paketProductId={usulanUntuk.paket_product}
          onClose={() => setUsulanUntuk(null)}
          onSaved={muat}
        />
      )}
    </div>
  );
}
