import { useState, useEffect } from 'react';
import { X, Activity, AlertCircle, Loader2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { notifyApiError } from '../../../utils/notify';

export default function AccountingLifecycleLogModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/accounting/lifecycle-logs/');
      const data = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setLogs(data);
    } catch (err) {
      const message = notifyApiError(err, 'Gagal memuat log riwayat akuntansi');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 relative flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Activity size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Log Start / Stop Akuntansi</h3>
              <p className="text-xs text-slate-500 font-medium">
                Riwayat status pengaktifan dan penghentian modul akuntansi internal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={28} className="animate-spin mb-3 text-indigo-500" />
              <p className="text-xs font-semibold">Memuat log riwayat...</p>
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              Belum ada catatan log Start/Stop akuntansi.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Diproses Oleh</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => {
                    const isStart = log.action === 'start';
                    return (
                      <tr key={log.id || log.created_at}>
                        <td className="px-4 py-3 text-slate-600">
                          {log.created_at ? new Date(log.created_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sky-600 font-medium">
                          {log.actor_email || log.actor_name || 'Sistem'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase tracking-wider ${
                              isStart
                                ? 'bg-sky-100 text-sky-700 border border-sky-200'
                                : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isStart ? 'START' : 'STOP'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
