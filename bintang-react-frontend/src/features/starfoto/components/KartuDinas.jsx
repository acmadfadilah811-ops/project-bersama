import { Image as Gambar, Navigation } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';
import { formatRupiah } from '../hooks/useStarfoto';

// Kartu satu catatan dinas luar (2026-10-11): jam & lokasi mulai/selesai,
// tautan peta, foto selfie (jalur terlindung), durasi, uang transport.

export const jamMenit = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-');
const linkPeta = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

// Foto dinas ada di jalur terlindung (butuh login) -> diambil sebagai blob.
async function bukaFoto(url) {
  const tab = window.open('', '_blank');
  try {
    const res = await apiClient.get(url, { responseType: 'blob' });
    tab.location.href = URL.createObjectURL(res.data);
  } catch (err) {
    tab.close();
    notifyApiError(err, 'Foto tidak dapat dibuka.');
  }
}

export default function KartuDinas({ d }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800">{d.staff_nama}</p>
          <p className="text-slate-500">{d.sesi_info ? `Sesi ${d.sesi_info.pelanggan} (${d.sesi_info.order_id})` : d.tujuan}</p>
          {d.alamat && <p className="text-xs text-slate-400">{d.alamat}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${d.status === 'berjalan' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
          {d.status === 'berjalan' ? 'Berjalan' : `${d.durasi_menit} menit`}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        {[['Mulai', d.mulai_pada, d.mulai_lat, d.mulai_lng, d.mulai_foto], ['Selesai', d.selesai_pada, d.selesai_lat, d.selesai_lng, d.selesai_foto]].map(([label, waktu, lat, lng, foto]) => (
          <div key={label} className="rounded-lg bg-slate-50 p-2">
            <p className="font-semibold">{label} {waktu ? `${new Date(waktu).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${jamMenit(waktu)}` : '-'}</p>
            {lat && (
              <div className="mt-1 flex gap-3">
                <a href={linkPeta(lat, lng)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-bold text-[#0088FF]"><Navigation size={12} /> Peta</a>
                {foto && <button type="button" onClick={() => bukaFoto(foto)} className="flex items-center gap-1 font-bold text-[#0088FF]"><Gambar size={12} /> Foto</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {Number(d.uang_transport) > 0 && <p className="mt-2 text-xs text-slate-500">Uang transport {formatRupiah(d.uang_transport)}</p>}
    </div>
  );
}
