import { Loader2 } from 'lucide-react';

export default function ListKasBankTable({ loading, accounts, formatIDR, onSelectAccount }) {
  return (
    // print-area: dipakai window.print() (tombol Download PDF) -- tanpa class
    // ini halaman tercetak KOSONG (lihat @media print di index.css: body *
    // di-hidden global, cuma .print-area yang di-opt-in balik jadi visible).
    <div className="print-area bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs font-semibold text-slate-700">
      {loading && accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 size={32} className="animate-spin mb-3 text-[#0088E8]" />
          <p className="text-xs font-bold">Memuat data Kas & Bank...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 font-bold text-xs bg-slate-50/10">
          Tidak ada data Kas & Bank yang cocok.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Nomor Akun</th>
                <th className="px-5 py-3">Nama Akun</th>
                <th className="px-5 py-3">Klasifikasi</th>
                <th className="px-5 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50/20 transition-colors">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {acc.code}
                  </td>
                  <td className="px-5 py-3 text-slate-800 font-bold">
                    {acc.name}
                  </td>
                  <td className="px-5 py-3 text-slate-550">
                    {acc.klasifikasi || 'Kas & Bank'}
                  </td>
                  <td
                    className="px-5 py-3 text-right text-sky-600 font-extrabold whitespace-nowrap hover:underline cursor-pointer"
                    onClick={() => onSelectAccount && onSelectAccount(acc.id)}
                  >
                    {formatIDR(acc.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
