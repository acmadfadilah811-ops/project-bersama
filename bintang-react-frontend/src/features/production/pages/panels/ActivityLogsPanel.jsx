import { Bell } from 'lucide-react';

export default function ActivityLogsPanel({ logs }) {
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-800">
          Log Aktivitas & Notifikasi Produksi
        </h2>
        <p className="text-[11px] text-slate-400">
          Riwayat aksi yang dilakukan dalam sesi kerja aktif Anda.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
            <Bell size={24} className="text-slate-300 mb-2" />
            <p className="font-semibold">Belum ada aktivitas tercatat.</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Aksi seperti klaim, mulai, atau forward job akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="relative border-l border-slate-200 ml-3 space-y-4 pb-2">
            {logs.map((log) => (
              <div key={log.id} className="relative pl-6">
                {/* Dot */}
                <div className="absolute -left-1.5 top-1.5 w-3 h-3 rounded-full bg-indigo-600 border-2 border-white" />

                <div>
                  <span className="text-[9px] font-bold text-slate-400">
                    {new Date(log.waktu).toLocaleTimeString()}
                  </span>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{log.keterangan}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
