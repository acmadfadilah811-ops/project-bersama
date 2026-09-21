const rupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

const STATUS = {
  belum: { teks: 'Belum diposting', gaya: 'bg-slate-100 text-slate-700' },
  sudah: { teks: 'Sudah diposting', gaya: 'bg-emerald-100 text-emerald-800' },
  berbeda: { teks: 'Berbeda dari HR (perlu koreksi)', gaya: 'bg-amber-100 text-amber-800' },
};

export default function PratinjauJurnalGaji({ pratinjau }) {
  const st = STATUS[pratinjau.status_posting];
  const r = pratinjau.ringkasan;
  const aktif = pratinjau.posting_aktif;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${st.gaya}`}>{st.teks}</span>
        {aktif && (
          <span className="text-xs text-slate-500">
            v{aktif.versi} &middot; {aktif.journal_entry_number}
            {aktif.payment_journal_entry_number ? ` · dibayar (${aktif.payment_journal_entry_number})` : ' · belum dibayar'}
          </span>
        )}
        <span className="text-xs text-slate-500 ml-auto">{r.jumlah_slip} slip final</span>
      </div>

      {pratinjau.masalah.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
          <p className="text-xs font-bold text-red-800">Belum bisa diposting:</p>
          {pratinjau.masalah.map((m) => (
            <p key={m} className="text-xs text-red-700">&bull; {m}</p>
          ))}
        </div>
      )}
      {pratinjau.peringatan.map((m) => (
        <p key={m} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">{m}</p>
      ))}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 text-left">
              <th className="px-3 py-2">Akun</th>
              <th className="px-3 py-2 text-right">Debit</th>
              <th className="px-3 py-2 text-right">Kredit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pratinjau.lines.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-400">Tidak ada baris jurnal.</td></tr>
            ) : (
              pratinjau.lines.map((l) => (
                <tr key={`${l.kode}-${l.keterangan}`}>
                  <td className="px-3 py-2">
                    <span className="font-mono text-indigo-700">{l.kode}</span> {l.nama}
                  </td>
                  <td className="px-3 py-2 text-right">{Number(l.debit) ? rupiah(l.debit) : ''}</td>
                  <td className="px-3 py-2 text-right">{Number(l.kredit) ? rupiah(l.kredit) : ''}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{rupiah(r.total_debit)}</td>
              <td className="px-3 py-2 text-right">{rupiah(r.total_kredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
