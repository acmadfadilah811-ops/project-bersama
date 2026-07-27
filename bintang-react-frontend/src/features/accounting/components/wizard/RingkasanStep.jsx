import { useState } from 'react';

const PREVIEW_DESCRIPTION = 'Nilai barang dagang ketika pertama menggunakan akunting module';

export default function RingkasanStep({ startDate, setStartDate, useStockAsCapital, submitting, onMulai }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const previewRows = useStockAsCapital
    ? [
        { code: '11400', name: 'Persediaan barang dagang' },
        { code: '31000', name: 'Modal' },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Pengaturan Akuntansi & Modal Awal</h3>
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-slate-500 text-right">Tanggal Mulai</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold focus:bg-white focus:border-[#0088E8] outline-none"
          />
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Nomor Akun</th>
              <th className="px-4 py-3">Nama Akun</th>
              <th className="px-4 py-3">Deskripsi</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {previewRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              previewRows.map((row) => (
                <tr key={row.code}>
                  <td className="px-4 py-3 text-slate-600">{startDate}</td>
                  <td className="px-4 py-3 text-slate-600">{row.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.name}</td>
                  <td className="px-4 py-3 text-slate-500">{PREVIEW_DESCRIPTION}</td>
                  <td className="px-4 py-3 text-right text-rose-500 font-semibold">IDR 0</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
        {!confirmOpen ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition-all cursor-pointer"
          >
            Mulai
          </button>
        ) : (
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-700">
              Apakah Anda yakin untuk memulai akuntansi sekarang?
            </span>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Tidak
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={onMulai}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Memproses...' : 'Ya'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
