import { useState } from 'react';
import { X } from 'lucide-react';

export default function PosLogModal({ isOpen, onClose, title, type = 'transaction', logs = [] }) {
  const [shortenDesc, setShortenDesc] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in text-xs font-semibold text-slate-700">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-[720px] max-h-[520px] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#F8FAFC]">
          <h3 className="text-xs font-bold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Checkbox option for transaction log (Screenshot 1) */}
          {type === 'transaction' && (
            <div className="flex items-center gap-1.5 pb-2 text-[10px] text-slate-500">
              <input
                type="checkbox"
                id="shortenDescCheck"
                checked={shortenDesc}
                onChange={(e) => setShortenDesc(e.target.checked)}
                className="rounded border-slate-300 cursor-pointer"
              />
              <label htmlFor="shortenDescCheck" className="cursor-pointer font-bold select-none">
                Singkatkan penjelasan
              </label>
            </div>
          )}

          {/* Table display */}
          <div className="border border-slate-100 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-slate-450 font-bold border-b border-slate-100">
                {type === 'transaction' ? (
                  <tr>
                    <th className="px-4 py-2.5">Tanggal</th>
                    <th className="px-4 py-2.5">Diproses Oleh</th>
                    <th className="px-4 py-2.5">Aksi</th>
                    <th className="px-4 py-2.5">Sumber</th>
                    <th className="px-4 py-2.5">Deskripsi</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-4 py-2.5">Tanggal</th>
                    <th className="px-4 py-2.5">Diproses Oleh</th>
                    <th className="px-4 py-2.5">Aksi</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={type === 'transaction' ? 5 : 3} className="px-4 py-10 text-center text-slate-400 font-bold">
                      Belum ada riwayat aktivitas yang tercatat.
                    </td>
                  </tr>
                ) : (
                  logs.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                        {row.timestamp}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {row.user}
                      </td>
                      <td className="px-4 py-2.5">
                        {type === 'transaction' ? (
                          <span className="text-slate-800 font-bold">
                            {row.action}
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                            row.action === 'ENABLE'
                              ? 'bg-sky-50/50 text-[#0088E8] border-sky-200'
                              : 'bg-rose-50/50 text-rose-600 border-rose-200'
                          }`}>
                            {row.action}
                          </span>
                        )}
                      </td>
                      {type === 'transaction' && (
                        <>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                            {row.source || 'DINE IN'}
                          </td>
                          <td className="px-4 py-2.5 text-sky-655 font-bold">
                            {shortenDesc ? (row.description || '').substring(0, 10) + '...' : (row.description || '')}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

      </div>
    </div>
  );
}
