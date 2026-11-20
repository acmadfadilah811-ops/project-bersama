import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { fetchPenyusutanFiskal } from '../../services/assets';
import { notifyApiError } from '../../../../utils/notify';

/**
 * Penyusutan versi pajak per tahun (UU PPh Pasal 11, PMK 72/2023) dibanding penyusutan
 * komersial yang dijurnal -- selisihnya = koreksi fiskal untuk SPT. Tidak menjurnal (2026-11-10).
 */
const money = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

function Kartu({ judul, nilai, warna, catatan }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex-1 px-4 py-3">
        <p className="text-slate-500">{judul}</p>
        <p className="mt-1 text-lg font-bold text-slate-900">{money.format(nilai || 0)}</p>
        {catatan && <p className="text-[10px] font-medium text-slate-400">{catatan}</p>}
      </div>
      <span className="h-1.5" style={{ background: warna }} />
    </div>
  );
}

export default function PenyusutanPajakPanel() {
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let batal = false;
    setLoading(true);
    fetchPenyusutanFiskal(tahun)
      .then((res) => { if (!batal) setData(res); })
      .catch((error) => notifyApiError(error, 'Gagal memuat penyusutan pajak'))
      .finally(() => { if (!batal) setLoading(false); });
    return () => { batal = true; };
  }, [tahun]);

  const koreksi = Number(data?.total?.koreksi || 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
        <span className="text-slate-500">Tahun pajak</span>
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200">
          <button type="button" onClick={() => setTahun(tahun - 1)} className="px-2 py-1.5 hover:bg-slate-50" aria-label="Tahun sebelumnya"><ChevronLeft size={14} /></button>
          <span className="border-x border-slate-100 px-3 font-bold text-slate-800">{tahun}</span>
          <button type="button" onClick={() => setTahun(tahun + 1)} className="px-2 py-1.5 hover:bg-slate-50" aria-label="Tahun berikutnya"><ChevronRight size={14} /></button>
        </div>
        <p className="ml-auto text-[11px] font-medium text-slate-400">
          Kelompok harta & tarif UU PPh Pasal 11 / PMK 72/2023, mulai bulan perolehan. Hanya perhitungan, tidak dijurnal.
        </p>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-xl border border-slate-200 text-slate-400 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Menghitung...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kartu judul={`Penyusutan pajak ${tahun}`} nilai={data.total.penyusutan_fiskal} warna="#1890FF" />
            <Kartu judul={`Penyusutan komersial (buku) ${tahun}`} nilai={data.total.penyusutan_komersial} warna="#3ED0A8" catatan="Dari jurnal penyusutan yang sudah diposting." />
            <Kartu
              judul="Koreksi fiskal"
              nilai={Math.abs(koreksi)}
              warna={koreksi >= 0 ? '#7B2FD0' : '#F5D90A'}
              catatan={koreksi > 0 ? 'Koreksi positif: tambahkan ke laba fiskal.' : koreksi < 0 ? 'Koreksi negatif: kurangkan dari laba fiskal.' : 'Tidak ada selisih.'}
            />
          </div>

          {data.belum_diatur.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-800">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {data.belum_diatur.length} aset belum diatur kelompok pajaknya dan tidak dihitung:{' '}
                {data.belum_diatur.slice(0, 8).map((a) => a.asset_code).join(', ')}{data.belum_diatur.length > 8 ? ', ...' : ''}.
                Atur lewat tombol Ubah pada Daftar Aset.
              </span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
              <thead className="bg-[#F8FAFC] text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Aset</th>
                  <th className="px-4 py-3">Kelompok / Metode</th>
                  <th className="px-4 py-3">Perolehan</th>
                  <th className="px-4 py-3 text-right">Harga Perolehan</th>
                  <th className="px-4 py-3 text-right">Sisa Buku Pajak Awal</th>
                  <th className="px-4 py-3 text-right">Penyusutan Pajak</th>
                  <th className="px-4 py-3 text-right">Sisa Buku Pajak Akhir</th>
                  <th className="px-4 py-3 text-right">Penyusutan Buku</th>
                  <th className="px-4 py-3 text-right">Koreksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.aset.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-14 text-center text-slate-400 font-bold">Belum ada aset dengan kelompok pajak pada tahun ini.</td></tr>
                ) : data.aset.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5"><span className="font-bold text-[#0088E8]">{a.asset_code}</span> <span className="text-slate-600">{a.name}</span></td>
                    <td className="px-4 py-2.5 text-slate-600">{a.kelompok}<div className="text-[10px] text-slate-400">{a.metode}</div></td>
                    <td className="px-4 py-2.5 text-slate-600">{a.acquisition_date}</td>
                    <td className="px-4 py-2.5 text-right">{money.format(a.acquisition_cost)}</td>
                    <td className="px-4 py-2.5 text-right">{money.format(a.nilai_sisa_awal)}</td>
                    <td className="px-4 py-2.5 text-right font-bold">{money.format(a.penyusutan_fiskal)}</td>
                    <td className="px-4 py-2.5 text-right">{money.format(a.nilai_sisa_akhir)}</td>
                    <td className="px-4 py-2.5 text-right">{money.format(a.penyusutan_komersial)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${Number(a.koreksi) ? 'text-slate-900' : 'text-slate-300'}`}>{money.format(a.koreksi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
