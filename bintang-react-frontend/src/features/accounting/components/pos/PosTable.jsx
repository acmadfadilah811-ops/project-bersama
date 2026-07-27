export default function PosTable({ data, formatIDR }) {
  const formatDateLabel = (dStr) => {
    const d = new Date(dStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-xs font-semibold text-slate-700">
      {data.length === 0 ? (
        <div className="text-center py-20 text-slate-400 font-bold text-xs bg-slate-50/10">
          No Data
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 w-12">#</th>
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-5 py-3">No. Referensi POS</th>
                <th className="px-5 py-3">Deskripsi</th>
                <th className="px-5 py-3 text-right">Nilai Total</th>
                <th className="px-5 py-3 text-center">Status Jurnal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {data.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                  <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                  <td className="px-5 py-3 text-slate-550">
                    {formatDateLabel(row.date)}
                  </td>
                  <td className="px-5 py-3 text-slate-800 font-bold">
                    {row.refNo}
                  </td>
                  <td className="px-5 py-3">
                    {row.description}
                  </td>
                  <td className="px-5 py-3 text-right font-extrabold text-slate-800">
                    {formatIDR(row.amount)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {row.status}
                    </span>
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
