const rupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

export default function RiwayatPostingGaji({ riwayat }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-slate-800">Riwayat Posting</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 text-left">
              <th className="px-3 py-2">Periode</th>
              <th className="px-3 py-2">Versi</th>
              <th className="px-3 py-2 text-right">Gaji bersih</th>
              <th className="px-3 py-2">Jurnal</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Pembayaran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {riwayat.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-400">Belum ada posting gaji.</td></tr>
            ) : (
              riwayat.map((r) => (
                <tr key={r.id} className={r.status === 'dibalik' ? 'text-slate-400 line-through' : ''}>
                  <td className="px-3 py-2">{r.tahun}-{String(r.bulan).padStart(2, '0')}</td>
                  <td className="px-3 py-2">v{r.versi}</td>
                  <td className="px-3 py-2 text-right">{rupiah(r.total_net)}</td>
                  <td className="px-3 py-2 font-mono">{r.journal_entry_number}</td>
                  <td className="px-3 py-2">{r.status === 'aktif' ? 'Aktif' : 'Dibalik'}</td>
                  <td className="px-3 py-2 font-mono">{r.payment_journal_entry_number || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
