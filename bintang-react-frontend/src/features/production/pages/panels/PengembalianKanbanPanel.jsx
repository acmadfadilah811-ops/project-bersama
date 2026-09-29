import { useCallback, useEffect, useState } from 'react';
import { Undo2, RefreshCw, Check, X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

/**
 * Kanban khusus Pengembalian Pekerjaan (PRD-05 UAT, 2026-09-29).
 *
 * arah='masuk'  : permintaan yang dialamatkan ke SAYA (staff PIC tahap
 *                 sebelumnya) -- saya sendiri memutuskan Terima / Tolak +
 *                 catatan, tanpa persetujuan Kordiv/SPV (revisi 2026-09-29).
 *                 Kordiv/SPV/manajemen ikut melihatnya sebagai cadangan.
 * arah='keluar' : permintaan yang saya ajukan, hanya dipantau.
 *
 * Terima  -> tahap sebelumnya dibuka lagi, alasan masuk ke catatan kerjanya.
 * Tolak   -> catatan WAJIB; SPK pengaju kembali ke antrean dan dilanjutkan.
 */
const KOLOM = [
  { id: 'menunggu', label: 'Menunggu Diterima' },
  { id: 'diterima', label: 'Diterima' },
  { id: 'ditolak', label: 'Ditolak' },
];

const POLL_MS = 30000;

const waktu = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// DRF mengirim ValidationError sebagai daftar ("catatan": ["..."]) dan
// Response biasa sebagai string -- samakan keduanya jadi satu teks.
const teks = (v) => (Array.isArray(v) ? v[0] : v);

function pesanError(err, cadangan) {
  const d = err.response?.data;
  return teks(d?.catatan) || teks(d?.error) || teks(d?.detail) || cadangan;
}

function Kartu({ item, bisaMemutuskan, onSelesai }) {
  const [catatan, setCatatan] = useState('');
  const [proses, setProses] = useState(false);
  const [error, setError] = useState('');

  const putuskan = async (aksi) => {
    if (aksi === 'tolak' && !catatan.trim()) {
      setError('Catatan wajib diisi untuk menolak.');
      return;
    }
    setProses(true);
    setError('');
    try {
      await apiClient.post(`/pengembalian-job/${item.id}/${aksi}/`, { catatan: catatan.trim() });
      onSelesai();
    } catch (err) {
      setError(pesanError(err, 'Gagal memproses keputusan.'));
    } finally {
      setProses(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-extrabold text-slate-800 truncate">{item.nama_produk || `Job #${item.job_id}`}</p>
          <p className="text-[10px] text-slate-400 font-semibold truncate">
            {item.nomor_sumber} &middot; {item.pelanggan_nama || 'Umum'}
          </p>
        </div>
        <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
          {item.tahap_asal} → {item.tahap_tujuan}
        </span>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-md px-2.5 py-2">
        <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">Alasan pengembalian</p>
        <p className="text-slate-700 font-medium whitespace-pre-wrap break-words">{item.alasan}</p>
        <p className="text-[10px] text-slate-400 mt-1">
          {item.diajukan_oleh} &middot; {waktu(item.diajukan_pada)}
        </p>
      </div>

      {item.status !== 'menunggu' && (
        <div className="border-t border-slate-100 pt-2">
          <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
            Catatan {item.status === 'diterima' ? 'penerima' : 'penolakan'}
          </p>
          <p className="text-slate-700 font-medium whitespace-pre-wrap break-words">
            {item.catatan_keputusan || '-'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            {item.diputuskan_oleh} &middot; {waktu(item.diputuskan_pada)}
          </p>
        </div>
      )}

      {item.status === 'menunggu' && bisaMemutuskan && (
        <div className="border-t border-slate-100 pt-2 space-y-2">
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            rows={2}
            placeholder="Catatan (wajib bila menolak)"
            className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={proses}
              onClick={() => putuskan('terima')}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
            >
              <Check size={12} /> Terima
            </button>
            <button
              type="button"
              disabled={proses}
              onClick={() => putuskan('tolak')}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md font-bold cursor-pointer disabled:opacity-50"
            >
              <X size={12} /> Tolak
            </button>
          </div>
        </div>
      )}
      {item.status === 'menunggu' && !bisaMemutuskan && (
        <p className="text-[10px] font-semibold text-slate-400 border-t border-slate-100 pt-2">
          Menunggu keputusan {item.penerima ? `staff ${item.penerima}` : `staff divisi ${item.divisi_tujuan}`}.
        </p>
      )}
    </div>
  );
}

export default function PengembalianKanbanPanel({ arahAwal = 'masuk' }) {
  const [arah, setArah] = useState(arahAwal);
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(true);
  const [error, setError] = useState('');

  const muat = useCallback(async (senyap = false) => {
    if (!senyap) setMemuat(true);
    try {
      const res = await apiClient.get('/pengembalian-job/', { params: { arah, status: 'semua' } });
      setDaftar(res.data || []);
      setError('');
    } catch (err) {
      setError(pesanError(err, 'Gagal memuat daftar pengembalian.'));
    } finally {
      setMemuat(false);
    }
  }, [arah]);

  useEffect(() => {
    muat();
    const id = setInterval(() => muat(true), POLL_MS);
    return () => clearInterval(id);
  }, [muat]);

  const bisaMemutuskan = arah === 'masuk';

  return (
    <div className="h-full flex flex-col space-y-3 pb-4 max-w-[1400px] mx-auto min-h-0">
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-sm">
        <div>
          <h1 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Undo2 size={13} className="text-slate-500" />
            Pengembalian SPK
          </h1>
          <p className="text-[10px] text-slate-500 font-medium">
            {bisaMemutuskan
              ? 'SPK yang dikembalikan tahap berikutnya ke Anda. Terima untuk membuka ulang, atau tolak dengan catatan. Tidak perlu persetujuan Kordiv/SPV.'
              : 'Pantau keputusan staff tujuan atas pengembalian yang Anda ajukan.'}
          </p>
        </div>
        <div className="ml-auto flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-[10.5px] font-extrabold">
          {[
            { id: 'masuk', label: 'Masuk ke saya' },
            { id: 'keluar', label: 'Yang saya ajukan' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setArah(t.id)}
              className={`px-2.5 py-1 rounded-md cursor-pointer ${
                arah === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => muat()}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          title="Muat ulang"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-semibold">{error}</div>}

      {memuat ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs">Memuat...</div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 flex gap-4 min-h-[300px] custom-scrollbar">
          {KOLOM.map((kol) => {
            const isi = daftar.filter((d) => d.status === kol.id);
            return (
              <div
                key={kol.id}
                className="flex-shrink-0 w-[300px] flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-white border-b border-slate-200">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">{kol.label}</span>
                  <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                    {isi.length}
                  </span>
                </div>
                <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar">
                  {isi.length === 0 ? (
                    <p className="text-center text-slate-400 text-[10px] py-8 italic">Tidak ada</p>
                  ) : (
                    isi.map((item) => (
                      <Kartu key={item.id} item={item} bisaMemutuskan={bisaMemutuskan} onSelesai={() => muat(true)} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
