import { ShieldCheck, ListOrdered, User, Key } from 'lucide-react';
import { STATUS_BADGE } from './jobConstants';

/**
 * ManagerTable — Tabel master admin untuk owner/manager.
 * Menampilkan semua job + tombol OTP dan Edit.
 */
export default function ManagerTable({ jobs, orderMap, staffList, onEdit }) {
  return (
    <div className="space-y-3 flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Summary Box */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="bg-indigo-700 rounded-md text-white shadow-sm overflow-hidden p-3 flex justify-between items-center border border-indigo-800">
          <div>
            <h3 className="text-2xl font-black leading-none">{jobs.length}</h3>
            <p className="text-[10px] font-bold mt-1 uppercase tracking-wider opacity-90">
              Total Order Berjalan
            </p>
          </div>
          <ListOrdered size={28} className="opacity-30 shrink-0" />
        </div>
        <div className="bg-slate-700 rounded-md text-white shadow-sm overflow-hidden p-3 flex justify-between items-center border border-slate-800">
          <div>
            <h3 className="text-2xl font-black leading-none">{staffList.length}</h3>
            <p className="text-[10px] font-bold mt-1 uppercase tracking-wider opacity-90">
              Total Operator / Staff
            </p>
          </div>
          <User size={28} className="opacity-30 shrink-0" />
        </div>
      </div>

      {/* Tabel Master Admin */}
      <div className="bg-white border border-slate-300 rounded-md shadow-md overflow-hidden flex flex-col flex-1 min-h-[250px]">
        <div className="bg-slate-800 text-white px-3 py-2 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-xs font-bold">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>MASTER ADMIN PANEL: KONTROL DAN VERIFIKASI ORDER</span>
          </div>
          <span className="text-[9px] font-bold text-slate-300 border border-slate-600 px-2 py-0.5 rounded">
            Core Production Engine
          </span>
        </div>

        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-[11px] whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-300 sticky top-0 z-10 font-bold">
              <tr>
                <th className="py-2 px-3 border-r border-slate-200">ID Order</th>
                <th className="py-2 px-3 border-r border-slate-200">Nama Klien</th>
                <th className="py-2 px-3 border-r border-slate-200">Produk Terkait</th>
                <th className="py-2 px-3 border-r border-slate-200">Tahap Divisi Saat Ini</th>
                <th className="py-2 px-3 border-r border-slate-200">Operator PIC</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center">Status Internal</th>
                <th className="py-2 px-3 border-r border-slate-200 text-center">Notifikasi WA</th>
                <th className="py-2 px-3 text-center bg-indigo-50 font-bold">Kontrol Pekerjaan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-slate-400 italic bg-slate-50/50">
                    Tidak ada orderan aktif di sistem.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const order = orderMap[job.order_item];
                  const badge = STATUS_BADGE[job.status_pekerjaan] || {
                    label: job.status_pekerjaan,
                    cls: 'bg-slate-100 text-slate-600',
                  };
                  return (
                    <tr key={job.id} className={`hover:bg-blue-50/40 transition-colors ${
                      ['selesai', 'batal', 'gagal'].includes(job.status_pekerjaan) ? 'opacity-60' : ''
                    }`}>
                      <td className="py-2 px-3 border-r border-slate-200 font-mono font-bold text-slate-800">
                        #{order?.orderId || '...'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-medium capitalize truncate max-w-[150px]">
                        {order?.customerName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 font-bold text-indigo-700 truncate max-w-[150px]">
                        {order?.jenisProduk}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-600 font-semibold">
                        {job.tahap_nama || '-'}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 capitalize font-medium">
                        <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[9px]">
                          {job.pic_nama || 'Belum Ada'}
                        </span>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center">
                        <div className="flex flex-col items-center gap-1 justify-center">
                          <span
                            className={`px-2 py-0.5 text-[9px] font-bold rounded border uppercase ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 text-center">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-50 border border-slate-200 text-slate-550 text-slate-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                          Ready for WA Logic
                        </span>
                      </td>
                      <td className="py-1 px-3 text-center bg-indigo-50/30">
                        <div className="flex gap-2 justify-center items-center">
                          {['selesai', 'batal', 'gagal'].includes(job.status_pekerjaan) ? (
                            <span className="text-[9px] text-slate-400 font-semibold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded select-none">
                              Terkunci
                            </span>
                          ) : (
                            <button
                              onClick={() => onEdit(job)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] px-3 py-1.5 rounded shadow-sm transition-all"
                            >
                              Edit / Teruskan Job
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
