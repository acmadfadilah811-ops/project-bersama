import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Info } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import {
  BintangNilai, CincinCsat, GrafikTren, PeringkatAspek, SebaranBintang,
} from '../../customerSupplier/components/KepuasanPelangganTab';

// Ringkasan survei kepuasan (struk online) di Dashboard Owner/Manager,
// mengikuti periode dashboard. Rincian lengkap di Pelanggan & Supplier >
// Kepuasan Pelanggan.

function Kartu({ judul, keterangan, className = '', children }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="font-bold text-slate-900">{judul}</h3>
      {keterangan && <p className="text-xs text-slate-500">{keterangan}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function KepuasanPelangganSection({ mulai, akhir }) {
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    setGagal(false);
    apiClient
      .get('/survei-kepuasan/', { params: { mulai, selesai: akhir } })
      .then((r) => setData(r.data))
      .catch(() => setGagal(true));
  }, [mulai, akhir]);

  const saranTerbaru = (data?.tanggapan || []).filter((t) => t.catatan).slice(0, 3);

  return (
    <>
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-lg font-black text-slate-900">Kepuasan Pelanggan</h2>
        <Link to="/customer-supplier/satisfaction" className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900">
          Lihat rincian <ChevronRight size={14} />
        </Link>
      </div>
      {gagal || !data ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
          <Info size={14} className="shrink-0" /> {gagal ? 'Data survei kepuasan tidak tersedia saat ini.' : 'Memuat...'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Kartu judul="Skor Kepuasan" keterangan={`${data.jumlah} tanggapan pada periode ini`}>
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <CincinCsat persen={data.csat} />
                <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-900">
                  {Math.round(data.csat)}%
                </span>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">
                  {Number(data.rata_rata).toFixed(2)} <span className="text-sm font-normal text-slate-400">/ 5</span>
                </p>
                <BintangNilai nilai={data.rata_rata} />
                <p className="mt-1 text-xs text-slate-500">CSAT = tanggapan rata-rata ≥ 4 bintang</p>
              </div>
            </div>
            <div className="mt-2 border-t border-slate-100 pt-1">
              <SebaranBintang sebaran={data.sebaran} />
            </div>
          </Kartu>

          <Kartu judul="Tren Kepuasan" keterangan="Rata-rata harian (garis) dan jumlah tanggapan (batang)" className="lg:col-span-2">
            <GrafikTren data={data.tren} />
          </Kartu>

          <Kartu judul="Nilai per Aspek" keterangan="Aspek terbawah = prioritas perbaikan" className="lg:col-span-2">
            {data.per_aspek.length
              ? <PeringkatAspek data={data.per_aspek} />
              : <p className="py-8 text-center text-sm text-slate-400">Belum ada penilaian pada periode ini.</p>}
          </Kartu>

          <Kartu judul="Saran Terbaru">
            {saranTerbaru.length ? (
              <ul className="space-y-3">
                {saranTerbaru.map((t) => (
                  <li key={t.id} className="rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-slate-700">{t.pelanggan || 'Pelanggan umum'}</span>
                      <BintangNilai nilai={t.rata_rata} ukuran={12} />
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-700">“{t.catatan}”</p>
                  </li>
                ))}
              </ul>
            ) : <p className="py-8 text-center text-sm text-slate-400">Belum ada saran tertulis.</p>}
          </Kartu>
        </div>
      )}
    </>
  );
}
