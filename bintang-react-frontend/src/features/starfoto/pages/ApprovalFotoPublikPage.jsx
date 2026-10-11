import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, PencilLine, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

// Halaman publik approval hasil edit (2026-10-11): pelanggan membuka tautan WA
// tanpa login, menyetujui atau meminta revisi per foto.

const pesanGalat = (err, cadangan) => err?.response?.data?.error || cadangan;

export default function ApprovalFotoPublikPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [keputusan, setKeputusan] = useState({});
  const [besar, setBesar] = useState(null);
  const [mengirim, setMengirim] = useState(false);
  const [pesanKirim, setPesanKirim] = useState('');

  useEffect(() => {
    apiClient.get(`/approval-foto/${token}/`)
      .then((res) => setData(res.data))
      .catch((err) => setGalat(pesanGalat(err, 'Tautan tidak ditemukan.')));
  }, [token]);

  const urlFoto = (id) => `${apiClient.defaults.baseURL}/approval-foto/${token}/foto/${id}/`;
  const atur = (id, nilai) => setKeputusan((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...nilai } }));
  const semuaDiputus = data?.foto?.length && data.foto.every((f) => keputusan[f.id]?.setuju !== undefined);
  const adaRevisi = data?.foto?.some((f) => keputusan[f.id]?.setuju === false);
  const revisiTanpaCatatan = data?.foto?.some((f) => keputusan[f.id]?.setuju === false && !keputusan[f.id]?.catatan?.trim());

  const kirim = async () => {
    setMengirim(true);
    setPesanKirim('');
    try {
      const res = await apiClient.post(`/approval-foto/${token}/`, {
        keputusan: data.foto.map((f) => ({ id: f.id, setuju: keputusan[f.id].setuju, catatan: keputusan[f.id].catatan || '' })),
      });
      setData(res.data);
    } catch (err) {
      setPesanKirim(pesanGalat(err, 'Gagal mengirim. Coba lagi.'));
    } finally {
      setMengirim(false);
    }
  };

  if (galat) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-slate-600">{galat}</div>;
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">Memuat...</div>;

  const selesai = data.status !== 'menunggu';
  const judulStatus = {
    disetujui: 'Terima kasih! Hasil edit disetujui dan segera kami cetak.',
    revisi: 'Permintaan revisi terkirim. Kami kabari lagi setelah diperbaiki.',
    usang: 'Tautan ini sudah diperbarui. Buka tautan terbaru dari WhatsApp kami.',
  }[data.status];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0088FF] px-5 py-5 text-white">
        <p className="text-sm font-semibold text-blue-100">{data.toko?.nama || 'StarFoto'}</p>
        <h1 className="text-xl font-bold">Hasil Edit Foto</h1>
        <p className="text-sm text-blue-100">Kak {data.pelanggan} · {data.paket}</p>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4 pb-32">
        {selesai ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={40} />
            <p className="font-semibold text-slate-700">{judulStatus}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            Ketuk foto untuk memperbesar. Pilih <b>Setuju</b> atau <b>Revisi</b> untuk setiap foto.
            {' '}Sisa revisi: <b>{data.sisa_revisi}x</b>. Foto ini pratinjau ber-watermark; file asli dikirim setelah selesai.
          </p>
        )}

        {!selesai && data.foto.map((f, i) => {
          const k = keputusan[f.id] || {};
          return (
            <div key={f.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <button type="button" onClick={() => setBesar(f.id)} className="block w-full bg-slate-100">
                <img src={urlFoto(f.id)} alt={`Foto ${i + 1}`} loading="lazy" className="max-h-[60vh] w-full object-contain" />
              </button>
              <div className="space-y-3 p-4">
                <p className="text-sm font-semibold text-slate-700">Foto {i + 1}{f.nomor_file ? ` · File ${f.nomor_file}` : ''}{f.peruntukan ? ` · ${f.peruntukan}` : ''}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button" onClick={() => atur(f.id, { setuju: true })}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold ${k.setuju === true ? 'bg-emerald-600 text-white' : 'border border-slate-300 text-slate-700'}`}
                  >
                    <CheckCircle2 size={16} /> Setuju
                  </button>
                  <button
                    type="button" onClick={() => atur(f.id, { setuju: false })} disabled={data.sisa_revisi <= 0}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold disabled:opacity-40 ${k.setuju === false ? 'bg-amber-500 text-white' : 'border border-slate-300 text-slate-700'}`}
                  >
                    <PencilLine size={16} /> Revisi
                  </button>
                </div>
                {k.setuju === false && (
                  <textarea
                    value={k.catatan || ''} onChange={(e) => atur(f.id, { catatan: e.target.value })} rows={2}
                    placeholder="Bagian yang ingin diperbaiki, mis. kulit lebih cerah"
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                  />
                )}
              </div>
            </div>
          );
        })}
      </main>

      {!selesai && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4">
          <div className="mx-auto max-w-xl space-y-2">
            {pesanKirim && <p className="text-center text-sm text-rose-600">{pesanKirim}</p>}
            {revisiTanpaCatatan && <p className="text-center text-xs text-amber-700">Tulis catatan untuk foto yang ingin direvisi.</p>}
            <button
              type="button" onClick={kirim} disabled={!semuaDiputus || revisiTanpaCatatan || mengirim}
              className="w-full rounded-xl bg-[#0088FF] py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {mengirim ? 'Mengirim...' : adaRevisi ? 'Kirim Permintaan Revisi' : 'Setujui Semua & Lanjut Cetak'}
            </button>
          </div>
        </div>
      )}

      {besar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2" onClick={() => setBesar(null)}>
          <button type="button" className="absolute right-4 top-4 text-white" aria-label="Tutup"><X size={28} /></button>
          <img src={urlFoto(besar)} alt="Pratinjau" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  );
}
