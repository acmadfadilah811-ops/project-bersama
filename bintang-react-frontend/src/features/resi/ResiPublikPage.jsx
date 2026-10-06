import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Star } from 'lucide-react';
import apiClient from '../../api/apiClient';

// Struk online + survei kepuasan (2026-10-06), padanan e-receipt Olsera.
// Dibuka pelanggan dari tautan di resi/invoice WhatsApp -- tanpa login.

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const waktu = (iso) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

const LABEL_STATUS = {
  lunas: { teks: 'Lunas', kelas: 'bg-slate-800 text-white' },
  belum_lunas: { teks: 'Belum Lunas', kelas: 'bg-amber-100 text-amber-800' },
  batal: { teks: 'Dibatalkan', kelas: 'bg-slate-200 text-slate-600' },
};

function Baris({ label, nilai, tebal }) {
  return (
    <div className={`flex justify-between text-sm ${tebal ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{nilai}</span>
    </div>
  );
}

function PilihBintang({ nilai, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5 cursor-pointer" aria-label={`${n} bintang`}>
          <Star size={26} className={n <= nilai ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
        </button>
      ))}
    </div>
  );
}

function FormSurvei({ token, aspek, onSelesai }) {
  const [nilai, setNilai] = useState({});
  const [catatan, setCatatan] = useState('');
  const [kirim, setKirim] = useState(false);
  const [galat, setGalat] = useState('');
  const lengkap = aspek.every((a) => nilai[a.id]);

  const simpan = async () => {
    setKirim(true);
    setGalat('');
    try {
      await apiClient.post(`/resi/${encodeURIComponent(token)}/survei/`, { nilai, catatan });
      onSelesai();
    } catch (err) {
      setGalat(err.response?.data?.error || 'Gagal mengirim penilaian. Coba lagi.');
    } finally {
      setKirim(false);
    }
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <h2 className="text-base font-bold text-slate-900">Bagaimana pengalaman Anda?</h2>
      <p className="text-xs text-slate-500 mt-1">Penilaian Anda membantu kami melayani lebih baik.</p>
      <div className="mt-4 space-y-3">
        {aspek.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-700">{a.nama}</span>
            <PilihBintang nilai={nilai[a.id] || 0} onChange={(n) => setNilai((v) => ({ ...v, [a.id]: n }))} />
          </div>
        ))}
      </div>
      <textarea
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="Saran atau komentar (opsional)"
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
      {galat && <p className="mt-2 text-sm text-red-600">{galat}</p>}
      <button
        type="button"
        disabled={!lengkap || kirim}
        onClick={simpan}
        className="mt-3 w-full rounded-lg bg-slate-800 py-3 text-sm font-bold text-white disabled:opacity-40 cursor-pointer"
      >
        {kirim ? 'Mengirim...' : lengkap ? 'Kirim Penilaian' : 'Beri bintang untuk semua aspek'}
      </button>
    </div>
  );
}

export default function ResiPublikPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');
  const [terkirim, setTerkirim] = useState(false);

  useEffect(() => {
    apiClient
      .get(`/resi/${encodeURIComponent(token)}/`)
      .then((res) => setData(res.data))
      .catch(() => setGalat('Struk tidak ditemukan atau tautan tidak valid.'));
  }, [token]);

  if (galat) return <div className="min-h-screen flex items-center justify-center p-6 text-sm text-slate-600 bg-slate-50">{galat}</div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500 bg-slate-50">Memuat struk...</div>;

  const st = LABEL_STATUS[data.status] || LABEL_STATUS.lunas;
  const survei = data.survei || {};

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="text-center">
          {data.toko?.logo_url && <img src={data.toko.logo_url} alt="" className="mx-auto mb-2 h-14 object-contain" />}
          <h1 className="text-lg font-bold text-slate-900">{data.toko?.nama}</h1>
          <p className="text-xs text-slate-500 whitespace-pre-line">{data.toko?.alamat}</p>
          {data.toko?.telepon && <p className="text-xs text-slate-500">Telp {data.toko.telepon}</p>}
        </div>

        <div className="mt-5 flex items-center justify-between border-y border-slate-100 py-3">
          <div>
            <p className="text-[11px] text-slate-500">{data.jenis === 'order' ? 'No. Pesanan' : 'No. Resi'}</p>
            <p className="text-sm font-bold text-slate-900">{data.nomor}</p>
            <p className="text-[11px] text-slate-500">{waktu(data.waktu)}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.kelas}`}>{st.teks}</span>
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-600">
          {data.pelanggan?.nama && <p>Pelanggan: <b className="text-slate-800">{data.pelanggan.nama}</b></p>}
          {data.status_pesanan && <p>Status pesanan: <b className="text-slate-800">{data.status_pesanan}</b></p>}
          {data.dilayani_oleh && <p>Dilayani oleh: {data.dilayani_oleh}</p>}
          {data.kasir && <p>Kasir: {data.kasir}</p>}
        </div>

        <div className="mt-4 space-y-3">
          {data.items.map((it, i) => (
            <div key={i} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold text-slate-800">{it.nama}</span>
                <span className="text-slate-800">{rupiah(it.subtotal)}</span>
              </div>
              <p className="text-xs text-slate-500">{it.qty}{it.satuan ? ` ${it.satuan}` : ''} × {rupiah(it.harga)}</p>
              {it.catatan && <p className="text-xs text-slate-400">{it.catatan}</p>}
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
          <Baris label="Subtotal" nilai={rupiah(data.subtotal)} />
          {data.diskon > 0 && <Baris label="Diskon" nilai={`- ${rupiah(data.diskon)}`} />}
          {data.pajak > 0 && <Baris label="Pajak" nilai={rupiah(data.pajak)} />}
          <Baris label="Total" nilai={rupiah(data.total)} tebal />
          <Baris label="Dibayar" nilai={rupiah(data.dibayar)} />
          {data.kembalian > 0 && <Baris label="Kembalian" nilai={rupiah(data.kembalian)} />}
          {data.sisa_tagihan > 0 && <Baris label="Sisa Tagihan" nilai={rupiah(data.sisa_tagihan)} tebal />}
        </div>

        {data.pembayaran?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold uppercase text-slate-500">Riwayat Pembayaran</p>
            {data.pembayaran.map((p, i) => (
              <div key={i} className="mt-1 flex justify-between text-xs text-slate-600">
                <span>{waktu(p.waktu)} · {p.metode}{p.dp ? ' (DP)' : ''}</span>
                <span>{rupiah(p.jumlah)}</span>
              </div>
            ))}
          </div>
        )}

        {terkirim || survei.sudah_diisi ? (
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <CheckCircle2 size={18} className="text-slate-800 shrink-0" />
            Terima kasih, penilaian Anda sudah kami terima.
          </div>
        ) : survei.bisa_diisi && survei.aspek?.length > 0 ? (
          <FormSurvei token={token} aspek={survei.aspek} onSelesai={() => setTerkirim(true)} />
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-400">{data.toko?.catatan_kaki}</p>
      </div>
    </div>
  );
}
