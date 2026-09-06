import { Play, CheckCircle2, Clock, FileText, Layers, Calendar } from 'lucide-react';
import DeadlineBadge from '../../components/DeadlineBadge';

const todayStr = () => new Date().toISOString().slice(0, 10);

const formatRentangTanggal = (dari, sampai) => {
  const hariIni = todayStr();
  if (dari === hariIni && sampai === hariIni) return 'Hari Ini';
  if (dari === sampai) return dari;
  return `${dari} s/d ${sampai}`;
};

// Kelompokkan job per order/transaksi asal (sumber + nomor_sumber) — dipakai
// bareng di tiap kolom kanban supaya 1 order dengan beberapa item (yang tadi
// sudah diklaim jadi satu lewat ClaimPool) tidak balik terpisah jadi kartu
// lepas-lepas satu-satu di sini (bug ditemukan 2026-08-14, padanan grouping
// yang sudah dipakai di ClaimPool.jsx). Kalau item-item order yang sama
// kebetulan beda status_pekerjaan (mis. satu sudah dikerjakan, satu masih
// antrean), masing-masing tetap muncul di kolom statusnya sendiri — grouping
// ini hanya menyatukan yang sekolom saja.
function groupByOrder(items) {
  const map = new Map();
  items.forEach((job) => {
    const key = `${job.sumber || 'order'}-${job.nomor_sumber || job.id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        sumber: job.sumber,
        nomorSumber: job.nomor_sumber,
        pelangganNama: job.pelanggan_nama,
        jobs: [],
      });
    }
    map.get(key).jobs.push(job);
  });
  return [...map.values()];
}

/** Kanban Personal -- redesign navigasi 2026-09-07: sebelumnya 4 kolom
 * (Antrean/Progress/Selesai/Gagal-Batal-Kendala) dirender berdampingan
 * sekaligus, sekarang kategori jadi sub-menu di sidebar kiri
 * (ProductionApp.jsx) dan panel ini cuma me-render SATU kategori aktif
 * (prop `category`) penuh lebar -- lebih rapi & tetap aman kalau isi satu
 * kategori banyak (tidak berebut ruang dengan 3 kolom lain). */
export default function KanbanPersonal({
  category = 'todo',
  activeJobs = [], doneJobs = [], doneJobsCount = 0,
  donePage = 1, donePageSize = 20, doneDateFrom, doneDateTo,
  onDonePageChange, onDoneDateFromChange, onDoneDateToChange,
  onSelectJob, onStart, onComplete,
}) {
  const rentangLabel = formatRentangTanggal(doneDateFrom || todayStr(), doneDateTo || todayStr());
  const doneTotalPages = Math.max(1, Math.ceil(doneJobsCount / donePageSize));

  // "Selesai" sudah difilter tanggal dari server (lihat useProductionData.js
  // fetchMyDoneJobs), tidak perlu disaring status lagi di sini. Kategori
  // lain tetap dari activeJobs (status antrean/dikerjakan/gagal/batal/
  // kendala, tanpa batas tanggal -- kerja aktif secara alami kecil).
  const columns = {
    todo: {
      title: 'Antrean Kerja (Todo)',
      badgeColor: 'bg-amber-100 text-amber-800',
      dot: 'bg-amber-500',
      items: activeJobs.filter((j) => j.status_pekerjaan === 'antrean'),
    },
    progress: {
      title: 'Sedang Dikerjakan (Progress)',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      dot: 'bg-indigo-500',
      items: activeJobs.filter((j) => j.status_pekerjaan === 'dikerjakan'),
    },
    done: {
      title: `Selesai (${rentangLabel})`,
      badgeColor: 'bg-emerald-100 text-emerald-800',
      dot: 'bg-emerald-500',
      items: doneJobs,
      count: doneJobsCount,
    },
    failed: {
      title: 'Gagal / Batal / Kendala',
      badgeColor: 'bg-rose-100 text-rose-800',
      dot: 'bg-rose-500',
      items: activeJobs.filter((j) => ['gagal', 'batal', 'kendala'].includes(j.status_pekerjaan)),
    },
  };

  const colKey = columns[category] ? category : 'todo';
  const col = columns[colKey];
  const groupedItems = groupByOrder(col.items);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Kanban Personal</h2>
          <p className="text-[11px] text-slate-400">
            Kelola dan update status pekerjaan aktif Anda di bawah ini.
          </p>
        </div>
        {/* Rentang tanggal cuma relevan untuk kategori Selesai -- default
            hari ini, bisa diperlebar untuk menelusuri riwayat lebih lama. */}
        {colKey === 'done' && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 shrink-0">Selesai:</span>
            <input
              type="date"
              value={doneDateFrom || todayStr()}
              onChange={(e) => onDoneDateFromChange(e.target.value)}
              className="text-[11px] font-bold text-slate-600 outline-none"
            />
            <span className="text-slate-300 text-[10px]">–</span>
            <input
              type="date"
              value={doneDateTo || todayStr()}
              onChange={(e) => onDoneDateToChange(e.target.value)}
              className="text-[11px] font-bold text-slate-600 outline-none"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col bg-slate-50 rounded-xl p-4 border border-slate-200/60 min-h-[500px]">
        {/* Header Kategori */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${col.dot}`} />
            <h3 className="text-xs font-bold text-slate-700">{col.title}</h3>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${col.badgeColor}`}>
            {col.count ?? col.items.length}
          </span>
        </div>

        {/* Item — dikelompokkan per order/transaksi, grid supaya penuh lebar
            tidak jadi satu kolom sempit memanjang. */}
        {groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-[11px] font-medium border border-dashed border-slate-200 rounded-lg">
            <Clock size={20} className="text-slate-300 mb-1.5" />
            Kosong
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {groupedItems.map((grup) => (
              <div
                key={grup.key}
                className="bg-white border border-slate-200 hover:border-indigo-300 rounded-lg shadow-xs hover:shadow-sm transition-all overflow-hidden self-start"
              >
                {/* Group Header — identitas order/transaksi asal, cuma
                    tampil kalau order ini punya lebih dari 1 item supaya
                    pekerjaan tunggal tidak kelihatan berbeda dari sebelumnya. */}
                {grup.jobs.length > 1 && (
                  <div className="px-2.5 py-1.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                          grup.sumber === 'pos' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {grup.sumber === 'pos' ? 'POS' : 'Order'}
                      </span>
                      <span className="text-[10.5px] font-extrabold text-slate-800 truncate">{grup.nomorSumber}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 shrink-0">
                      <Layers size={10} /> {grup.jobs.length} item
                    </span>
                  </div>
                )}

                <div className={grup.jobs.length > 1 ? 'divide-y divide-slate-100' : ''}>
                  {grup.jobs.map((job) => {
                    const item = job.order_item_detail || {};
                    return (
                      <div
                        key={job.id}
                        onClick={() => onSelectJob(job)}
                        className="p-2.5 cursor-pointer group"
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
                        <div className="mt-1.5"><DeadlineBadge deadline={job.deadline} /></div>

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
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginasi -- cuma kategori Selesai (kategori lain ukurannya alami kecil). */}
        {colKey === 'done' && doneJobsCount > 0 && (
          <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-200 text-[11px] font-bold text-slate-500">
            <button
              type="button"
              disabled={donePage <= 1}
              onClick={() => onDonePageChange(Math.max(1, donePage - 1))}
              className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md px-2.5 py-1 cursor-pointer"
            >
              &lt;
            </button>
            <span>{donePage} / {doneTotalPages}</span>
            <button
              type="button"
              disabled={donePage >= doneTotalPages}
              onClick={() => onDonePageChange(Math.min(doneTotalPages, donePage + 1))}
              className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-md px-2.5 py-1 cursor-pointer"
            >
              &gt;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
