import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

// Log riwayat stok satu bahan baku (2026-09-26): siapa yang mengubah, kapan,
// berapa, stok awal -> akhir, dan keterangannya (restock, pemakaian resep,
// sinkron dari stok produk, void, dll).

const fmtWaktu = (iso) => new Date(iso).toLocaleString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const angka = (n) => Number(n || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });

export default function RiwayatBahanModal({ itemId, onClose }) {
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let batal = false;
    apiClient.get(`/inventory/${itemId}/`)
      .then((res) => { if (!batal) setData(res.data); })
      .catch(() => { if (!batal) setGalat('Riwayat bahan tidak dapat dimuat.'); });
    return () => { batal = true; };
  }, [itemId]);

  const riwayat = [...(data?.history || [])].sort((a, b) => new Date(b.waktu) - new Date(a.waktu));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div>
            <div className="text-sm font-bold text-slate-800">Riwayat Stok Bahan: {data?.nama || '…'}</div>
            <div className="text-xs text-slate-500">
              Stok sekarang {angka(data?.stok)} {data?.satuan}
              {data?.product ? ' · tertaut ke produk (stok mengikuti produk sumber)' : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto">
          {galat ? (
            <div className="p-6 text-sm text-red-600">{galat}</div>
          ) : !data ? (
            <div className="p-6 text-sm text-slate-500">Memuat…</div>
          ) : riwayat.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Belum ada riwayat perubahan stok.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-slate-500 bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2">Waktu</th>
                  <th className="px-4 py-2">Oleh</th>
                  <th className="px-4 py-2 text-right">Perubahan</th>
                  <th className="px-4 py-2 text-right">Stok awal → akhir</th>
                  <th className="px-4 py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-600">{fmtWaktu(h.waktu)}</td>
                    <td className="px-4 py-2 whitespace-nowrap font-semibold text-slate-700">{h.user_nama_lengkap || h.user_nama || 'Sistem'}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${h.delta > 0 ? 'text-emerald-700' : h.delta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {h.delta > 0 ? '+' : ''}{angka(h.delta)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600 whitespace-nowrap">{angka(h.stok_awal)} → {angka(h.stok_akhir)}</td>
                    <td className="px-4 py-2 text-slate-600">{h.keterangan || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
