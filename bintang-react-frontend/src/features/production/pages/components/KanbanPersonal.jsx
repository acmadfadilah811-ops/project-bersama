import { Play, CheckCircle2, Clock, FileText } from 'lucide-react';

export default function KanbanPersonal({ jobs, onSelectJob, onStart, onComplete }) {
  // Group jobs by status
  const columns = {
    todo: {
      title: 'Antrean Kerja (Todo)',
      color: 'border-amber-400 bg-amber-50/50',
      iconColor: 'text-amber-500',
      badgeColor: 'bg-amber-100 text-amber-800',
      items: jobs.filter((j) => j.status_pekerjaan === 'antrean'),
    },
    progress: {
      title: 'Sedang Dikerjakan (Progress)',
      color: 'border-indigo-400 bg-indigo-50/50',
      iconColor: 'text-indigo-500',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      items: jobs.filter((j) => j.status_pekerjaan === 'dikerjakan'),
    },
    done: {
      title: 'Selesai Hari Ini (Done)',
      color: 'border-emerald-400 bg-emerald-50/50',
      iconColor: 'text-emerald-500',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      items: jobs.filter((j) => j.status_pekerjaan === 'selesai'),
    },
    failed: {
      title: 'Gagal / Batal / Kendala',
      color: 'border-rose-400 bg-rose-50/50',
      iconColor: 'text-rose-500',
      badgeColor: 'bg-rose-100 text-rose-800',
      items: jobs.filter((j) => ['gagal', 'batal', 'kendala'].includes(j.status_pekerjaan)),
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-800">Kanban Personal</h2>
        <p className="text-[11px] text-slate-400">
          Kelola dan update status pekerjaan aktif Anda di bawah ini.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {Object.entries(columns).map(([colKey, col]) => (
          <div
            key={colKey}
            className="flex flex-col bg-slate-50 rounded-xl p-4 border border-slate-200/60 min-h-[400px]"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    colKey === 'todo' ? 'bg-amber-500' :
                    colKey === 'progress' ? 'bg-indigo-500' :
                    colKey === 'done' ? 'bg-emerald-500' :
                    'bg-rose-500'
                  }`}
                />
                <h3 className="text-xs font-bold text-slate-700">{col.title}</h3>
              </div>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.badgeColor}`}>
                {col.items.length}
              </span>
            </div>

            {/* Column Items */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
              {col.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-[10px] font-medium border border-dashed border-slate-200 rounded-lg">
                  <Clock size={16} className="text-slate-300 mb-1" />
                  Kosong
                </div>
              ) : (
                col.items.map((job) => {
                  const item = job.order_item_detail || {};
                  return (
                    <div
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className="bg-white border border-slate-200 hover:border-indigo-400 rounded-lg p-2.5 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Kiri: Tahap & ID */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase tracking-wider shrink-0">
                            {job.tahap_nama}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">#{job.id}</span>
                        </div>
                        
                        {/* Kanan: Qty & Biaya Desain */}
                        <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-500 font-bold">
                          <span>
                            Qty: <strong className="text-slate-700">{item.qty || 1}</strong>
                          </span>
                          {job.biaya_desain > 0 && (
                            <>
                              <span className="text-slate-350 text-slate-300">·</span>
                              <span className="text-emerald-600 font-extrabold">
                                Rp{job.biaya_desain.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Baris Tengah: Nama Pelanggan & Nama Produk */}
                      <div className="mt-1.5 flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[11px] font-black text-slate-800 truncate" title={job.pelanggan_nama || 'Umum'}>
                          {job.pelanggan_nama || 'Umum'}
                        </span>
                        <span className="text-[10px] text-slate-300 shrink-0">—</span>
                        <span className="text-[10px] font-semibold text-slate-500 truncate group-hover:text-indigo-600 transition-colors" title={item.jenis_produk || 'Produk'}>
                          {item.jenis_produk || 'Produk'}
                        </span>
                      </div>

                      {/* Quick Action Shortcuts inside Kanban Card */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectJob(job);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-500"
                        >
                          <FileText size={12} />
                          Buka Workspace
                        </button>

                        {colKey === 'todo' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStart(job.id);
                            }}
                            className="flex items-center gap-0.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-white text-[9px] font-extrabold shadow-sm"
                          >
                            <Play size={10} fill="white" />
                            Mulai
                          </button>
                        )}

                        {colKey === 'progress' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onComplete(job); // Pass whole job to open Forward modal directly
                            }}
                            className="flex items-center gap-0.5 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-extrabold shadow-sm"
                          >
                            <CheckCircle2 size={10} />
                            Selesai
                          </button>
                        )}

                        {colKey === 'failed' && (
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-2xs ${
                            job.status_pekerjaan === 'gagal' ? 'bg-rose-100 text-rose-700' :
                            job.status_pekerjaan === 'batal' ? 'bg-slate-100 text-slate-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {job.status_pekerjaan === 'gagal' ? 'Gagal' : job.status_pekerjaan === 'batal' ? 'Batal' : 'Kendala'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
