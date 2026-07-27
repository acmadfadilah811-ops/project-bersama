import { FolderTree, RefreshCw, Briefcase, FileText } from 'lucide-react';

export default function DivisionPanel({ divisions, staffList, globalJobs, tahapList, refresh }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-200 rounded-xl shadow-sm">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800">Manajemen Divisi & Tim Produksi</h2>
          <p className="text-[11px] text-slate-400">
            Pantau pembagian anggota staff dan antrean pesanan di setiap divisi kerja.
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer"
        >
          <RefreshCw size={12} />
          Segarkan Data
        </button>
      </div>

      {/* Grid List of Divisions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {divisions.map((div) => {
          // Filter staff in this division
          const members = staffList.filter((s) => s.divisi === div.id);

          // Calculate jobs and orders in this division
          const divTahapIds = (tahapList || []).filter((t) => t.divisi === div.id).map((t) => t.id);
          const activeJobsInDiv = (globalJobs || []).filter(
            (j) =>
              divTahapIds.includes(j.tahap) &&
              j.status_pekerjaan !== 'selesai' &&
              j.status_pekerjaan !== 'batal'
          );
          const uniqueOrdersInDiv = Array.from(
            new Set(
              activeJobsInDiv.map((j) => j.order_id || j.order_item_detail?.order).filter(Boolean)
            )
          );

          return (
            <div
              key={div.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 border border-indigo-100">
                    <FolderTree size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-800">{div.nama}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">
                      {div.keterangan || 'Tidak ada keterangan'}
                    </p>
                  </div>
                </div>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border border-slate-200 shrink-0">
                  {members.length} Anggota
                </span>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50/60 border border-slate-150 rounded-lg p-2.5 text-center">
                <div className="flex flex-col items-center justify-center">
                  <div className="flex items-center gap-1">
                    <Briefcase size={12} className="text-indigo-500" />
                    <span className="text-xs font-black text-slate-800">
                      {activeJobsInDiv.length}
                    </span>
                  </div>
                  <span className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                    SPK Aktif
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center border-l border-slate-200">
                  <div className="flex items-center gap-1">
                    <FileText size={12} className="text-amber-500" />
                    <span className="text-xs font-black text-slate-800">
                      {uniqueOrdersInDiv.length}
                    </span>
                  </div>
                  <span className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">
                    Order Aktif
                  </span>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-2">
                <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  Daftar Anggota Tim ({members.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {members.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic py-2 text-center">
                      Belum ada staff di divisi ini.
                    </p>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member.id}
                        className="flex justify-between items-center p-2 bg-slate-50/50 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">{member.username}</p>
                            <p className="text-[9px] font-medium text-slate-400">
                              {member.email || 'No Email'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          {member.nip ? (
                            <span className="bg-indigo-100 text-indigo-800 text-[9px] font-extrabold px-2 py-0.5 rounded-md tracking-wider uppercase">
                              {member.nip}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic">No NIP</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
