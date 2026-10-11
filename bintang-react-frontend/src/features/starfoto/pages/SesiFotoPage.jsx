import { useCallback, useEffect, useState } from 'react';
import { Camera, CheckCircle2, Clock, MapPin, Play, Plus, RefreshCw, Users } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { notifyApiError, notifySuccess } from '../../../utils/notify';
import { uiConfirm } from '../../../utils/dialog';
import UsulanTambahanModal from '../components/UsulanTambahanModal';
import { formatJadwal, formatRupiah } from '../hooks/useStarfoto';

// Halaman HP fotografer/asisten StarFoto (2026-10-11): Antrean Sesi (klaim
// global) + Sesi Saya (mulai, usulkan tambahan, selesai).

const hariIni = () => new Date().toLocaleDateString('sv-SE');
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
      <p className="flex items-center gap-1.5">
        <MapPin size={14} /> {sesi.lokasi === 'outdoor' ? `Outdoor${sesi.alamat ? ` — ${sesi.alamat}` : ''}` : 'Studio'}
      </p>
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
  const [antrean, setAntrean] = useState([]);
  const [sesiSaya, setSesiSaya] = useState([]);
  const [pesanan, setPesanan] = useState({});
  const [memuat, setMemuat] = useState(false);
  const [usulanUntuk, setUsulanUntuk] = useState(null);
  const [proses, setProses] = useState(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [a, s, p] = await Promise.all([
        apiClient.get('/starfoto/antrean-sesi/'),
        apiClient.get('/starfoto/sesi-saya/', { params: { tanggal } }),
        apiClient.get('/starfoto/pesanan/', { params: { status: 'sesi,menunggu_kasir', page_size: 100 } }),
      ]);
      setAntrean(daftar(a.data));
      setSesiSaya(daftar(s.data));
      setPesanan(Object.fromEntries(daftar(p.data).map((x) => [x.id, x])));
    } catch (err) {
      notifyApiError(err, 'Gagal memuat sesi foto.');
    } finally {
      setMemuat(false);
    }
  }, [tanggal]);

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
    <div className="mx-auto max-w-2xl space-y-3 pb-6">
      <div className="flex items-center justify-end md:justify-between">
        {/* Di HP judul sudah tampil di header atas. */}
        <h1 className="hidden items-center gap-2 text-lg font-bold text-slate-800 md:flex"><Camera size={20} /> Sesi Foto</h1>
        <button type="button" onClick={muat} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Muat ulang">
          <RefreshCw size={18} className={memuat ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="flex gap-2">{tombolTab('saya', 'Sesi Saya', sesiSaya.length)}{tombolTab('antrean', 'Antrean', antrean.length)}</div>

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
          <input
            type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value || hariIni())}
            className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm"
          />
          {sesiSaya.map((sesi) => {
            const detail = pesanan[sesi.pesanan_id];
            const usulan = detail?.usulan || [];
            const saya = sesi.fotografer === user?.id ? 'Fotografer' : 'Asisten';
            const bisaUsul = detail && ['sesi', 'menunggu_kasir'].includes(detail.status);
            return (
              <div key={sesi.id} className="rounded-2xl border border-slate-200 bg-white p-4">
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

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {sesi.status === 'terjadwal' && (
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
            );
          })}
          {!memuat && !sesiSaya.length && (
            <p className="py-10 text-center text-sm text-slate-400">Belum ada sesi Anda pada tanggal ini. Cek tab Antrean untuk mengambil sesi.</p>
          )}
        </div>
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
