/**
 * Halaman cetak "Buku Besar - Detail Rincian" (window.print(), lihat index.css
 * ".print-area" convention -- pola sama dengan OrderInvoicePrint.jsx). Layout
 * kolom (Tanggal, Akun, Transaksi, Deskripsi, Debit, Kredit) meniru contoh PDF
 * asli Olsera yang diberikan user. Kolom "Transaksi" di sana berisi label tipe
 * transaksi dari sistem POS Olsera (mis. "Pembayaran penjualan") yang belum ada
 * padanannya di sistem ini (integrasi POS -> Jurnal belum dibangun, lihat
 * PLANNING_AKUNTANSI_INTERNAL.md) -- jadi di sini dipakai No. Dokumen Eksternal
 * (atau No. Jurnal kalau kosong), bukan label yang dipalsukan.
 */
export default function BukuBesarDetailPrint({ data, businessName, dateFromLabel, dateToLabel }) {
  if (!data) return null;

  const formatIDR = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="print-area hidden print:block bg-white p-8 text-black font-sans text-[10px] min-h-screen">
      <div className="text-center mb-6">
        <h1 className="text-base font-bold">{businessName || 'StarPhoto & Advertising'}</h1>
        <h2 className="text-sm font-semibold mt-0.5">Buku besar</h2>
        <p className="text-[10px] text-slate-600 mt-0.5">
          {dateFromLabel} &mdash; {dateToLabel}
        </p>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y-2 border-slate-900 uppercase tracking-wide">
            <th className="text-left py-1.5 pr-2 w-20">Tanggal</th>
            <th className="text-left py-1.5 pr-2 w-40">Akun</th>
            <th className="text-left py-1.5 pr-2 w-32">Transaksi</th>
            <th className="text-left py-1.5 pr-2">Deskripsi</th>
            <th className="text-right py-1.5 pl-2 w-24">Debit</th>
            <th className="text-right py-1.5 pl-2 w-24">Kredit</th>
          </tr>
        </thead>
        <tbody>
          {data.accounts.flatMap((acc) =>
            acc.rows.map((row, idx) => (
              <tr key={`${acc.account.id}-${idx}`} className="border-b border-slate-200 align-top">
                <td className="py-1 pr-2">{formatDate(row.date)}</td>
                <td className="py-1 pr-2">{acc.account.code} {acc.account.name}</td>
                <td className="py-1 pr-2">{row.external_document_no || row.entry_number}</td>
                <td className="py-1 pr-2">{row.description}</td>
                <td className="py-1 pl-2 text-right">{row.debit > 0 ? formatIDR(row.debit) : '0'}</td>
                <td className="py-1 pl-2 text-right">{row.kredit > 0 ? formatIDR(row.kredit) : '0'}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>

      {data.accounts.length === 0 && (
        <p className="text-center text-slate-500 mt-8">Tidak ada transaksi pada rentang tanggal ini.</p>
      )}
    </div>
  );
}
