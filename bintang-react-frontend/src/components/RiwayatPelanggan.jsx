import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import apiClient from '../api/apiClient';

// Riwayat pembelian pelanggan di form transaksi (2026-10-19), dicari dari nomor WA.
// ringkas=true: satu baris ringkasan + tombol buka rincian.
const rupiah = (n) => `Rp${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const tanggal = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

export default function RiwayatPelanggan({ nomorWa, ringkas = false }) {
  const [data, setData] = useState(null);
  const [buka, setBuka] = useState(!ringkas);
  const nomor = (nomorWa || '').replace(/\D/g, '');

  useEffect(() => {
    if (nomor.length < 8) {
      setData(null);
      return undefined;
    }
    let batal = false;
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get('/customers/riwayat/', { params: { nomor_wa: nomor } });
        if (!batal) setData(res.data);
      } catch {
        if (!batal) setData(null);
      }
    }, 400);
    return () => { batal = true; clearTimeout(t); };
  }, [nomor]);

  if (!data) return null;
  const r = data.ringkasan || {};
  const terakhir = data.pesanan?.[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-bold text-slate-800">
          <History size={14} className="text-slate-500" /> Riwayat Pembelian
          {data.pelanggan?.customer_group_nama && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{data.pelanggan.customer_group_nama}</span>
          )}
        </p>
        {ringkas && r.total_transaksi > 0 && (
          <button type="button" onClick={() => setBuka(!buka)} className="text-[11px] font-semibold text-slate-500 underline">
            {buka ? 'Tutup' : 'Lihat rincian'}
          </button>
        )}
      </div>
      {r.total_transaksi ? (
        <p className="mt-1">
          {r.total_transaksi} transaksi · total {rupiah(r.nominal_transaksi)}
          {r.hutang > 0 && <span className="font-semibold text-rose-600"> · belum lunas {rupiah(r.hutang)}</span>}
          {terakhir && ` · terakhir ${tanggal(terakhir.tanggal)}`}
        </p>
      ) : (
        <p className="mt-1 text-slate-400">{data.pelanggan?.terdaftar ? 'Pelanggan terdaftar, belum ada transaksi.' : 'Pelanggan baru, belum ada transaksi.'}</p>
      )}
      {data.pelanggan?.catatan && <p className="mt-1 italic text-slate-500">Catatan: {data.pelanggan.catatan}</p>}

      {buka && r.total_transaksi > 0 && (
        <div className="mt-2 space-y-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-400">
                <th className="py-1 font-semibold">Tanggal</th>
                <th className="py-1 font-semibold">No.</th>
                <th className="py-1 text-right font-semibold">Total</th>
                <th className="py-1 text-right font-semibold">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {data.pesanan.map((p) => (
                <tr key={`${p.sumber}-${p.no_pesanan}`} className="border-b border-slate-100">
                  <td className="py-1">{tanggal(p.tanggal)}</td>
                  <td className="py-1 font-mono text-[10px]">{p.no_pesanan}</td>
                  <td className="py-1 text-right">{rupiah(p.total)}</td>
                  <td className={`py-1 text-right ${p.sisa > 0 ? 'font-semibold text-rose-600' : ''}`}>{rupiah(p.sisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.item?.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-slate-500">Barang yang pernah dibeli</p>
              <ul className="space-y-0.5">
                {data.item.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{it.nama} ×{it.qty}</span>
                    <span className="shrink-0 text-slate-400">{tanggal(it.tanggal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
