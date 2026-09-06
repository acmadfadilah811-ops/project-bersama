import { useMemo } from 'react';
import { Inbox, UserCheck, Ruler, Clipboard, AlertCircle, Layers, ClipboardList } from 'lucide-react';
import DeadlineBadge from '../../components/DeadlineBadge';

/** Antrean Global Divisi -- job unassigned yang bisa diklaim staff di
 * divisinya. Filter & paginasi server sungguhan (fitur redesign kanban
 * 2026-09-07): sebelumnya menarik SELURUH antrean tanpa halaman, dan
 * filter tahap murni client-side di atas data yang sudah lengkap -- begitu
 * dipaginasi, filter client-side jadi salah (cuma menyaring 1 halaman yang
 * kebetulan sedang dimuat). Sekarang page & filter tahap sama-sama dikirim
 * ke server (lihat ProductionApp.jsx & useProductionData.js).
 *
 * Perbaikan istilah (temuan user 2026-09-07): panel ini sebelumnya
 * menyebut "mesin" ("Antrean Stasiun Kerja / Mesin"), padahal yang
 * ditampilkan/disaring adalah data ORDER per TAHAP PRODUKSI (field
 * TahapProses, mis. Edit/Cetak/Laminasi) -- bukan mesin fisik. */
export default function ClaimPool({
  claimPool, claimPoolCount = 0, onClaimMany, loading,
  tahapOptions = [], tahapFilter = '', onTahapFilterChange,
  page = 1, pageSize = 30, onPageChange, onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(claimPoolCount / pageSize));

  // Kelompokkan per order/transaksi (nomor_sumber + sumber) — sebelumnya
  // tiap job (= tiap item pesanan) dirender sebagai kartu lepas satu-satu,
  // jadi satu order dengan 2+ produk terlihat seperti beberapa pesanan
  // berbeda yang tidak berkaitan di Antrean Divisi (bug ditemukan
  // 2026-08-13). `sumber`+`nomor_sumber` sudah tersedia di JobBoardSerializer
  // (lihat api/models.py JobBoard.sumber/nomor_sumber), dipakai apa adanya.
  const grouped = useMemo(() => {
    const map = new Map();
    claimPool.forEach((job) => {
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
  }, [claimPool]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold">Memuat antrean global divisi...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-xl shadow-2xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4 text-indigo-500" />
            Claim Pool (Antrean Tahap Produksi)
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pilih tahap produksi untuk memfilter antrean, lalu klaim tugas untuk mulai bekerja.
          </p>
        </div>
        <span className="bg-indigo-55 text-indigo-700 text-[10.5px] font-extrabold px-3 py-1 rounded-full border border-indigo-150 self-start sm:self-auto shrink-0 shadow-3xs">
          {claimPoolCount} Total Antrean
        </span>
      </div>

      {/* FILTER BAR TAHAP PRODUKSI */}
      {tahapOptions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
          <button
            onClick={() => onTahapFilterChange('')}
            className={`px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition-all cursor-pointer ${
              tahapFilter === ''
                ? 'bg-[#714B67] text-white border-[#714B67] shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Tahap
          </button>
          {tahapOptions.map((tahap) => (
            <button
              key={tahap.id}
              onClick={() => onTahapFilterChange(tahap.nama)}
              className={`px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold border transition-all cursor-pointer whitespace-nowrap ${
                tahapFilter === tahap.nama
                  ? 'bg-[#714B67] text-white border-[#714B67] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tahap.nama}
            </button>
          ))}
        </div>
      )}

      {/* Grid Hasil Filter — dikelompokkan per order/transaksi */}
      {claimPool.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Inbox size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-700">
            {tahapFilter ? 'Antrean Kosong' : 'Antrean Bersih!'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 text-center max-w-xs">
            {tahapFilter
              ? `Tidak ada antrean pekerjaan pada tahap "${tahapFilter}".`
              : 'Saat ini tidak ada pekerjaan unassigned untuk divisi Anda.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {grouped.map((grup) => (
            <div
              key={grup.key}
              className="bg-white border border-slate-200 hover:border-indigo-300 rounded-lg shadow-3xs hover:shadow-md transition-all overflow-hidden flex flex-col self-start"
            >
              {/* Group Header — identitas order/transaksi asal */}
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                      grup.sumber === 'pos' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {grup.sumber === 'pos' ? 'POS' : 'Order'}
                  </span>
                  <span className="text-[11px] font-extrabold text-slate-800 truncate">{grup.nomorSumber}</span>
                  {grup.pelangganNama && (
                    <span className="text-[10px] text-slate-500 font-semibold truncate">&middot; {grup.pelangganNama}</span>
                  )}
                </div>
                {grup.jobs.length > 1 && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 shrink-0">
                    <Layers size={10} /> {grup.jobs.length}
                  </span>
                )}
              </div>

              {/* Item-item dalam order/transaksi ini — kompak (1-3 baris per
                  item), sebelumnya tiap item bisa 5-6 baris penuh (label
                  "Ukuran:"/"Bahan:" eksplisit, kotak catatan besar, dst)
                  sehingga order dengan banyak item bikin kartu jadi sangat
                  panjang & boros tempat (temuan user 2026-09-07). */}
              <div className="divide-y divide-slate-100">
                {grup.jobs.map((job) => {
                  const item = job.order_item_detail || {};
                  const formatUkuran =
                    parseFloat(item.panjang) > 0 && parseFloat(item.lebar) > 0
                      ? `${parseFloat(item.panjang)}x${parseFloat(item.lebar)}m`
                      : null;

                  return (
                    <div key={job.id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="text-[8px] bg-slate-200 text-slate-700 font-extrabold px-1 py-0.5 rounded uppercase tracking-wider shrink-0">
                            {job.tahap_nama}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800 truncate" title={item.jenis_produk || 'Produk'}>
                            {item.jenis_produk || 'Produk'}
                          </span>
                        </div>
                        <span className="text-[9.5px] font-black text-slate-500 shrink-0">
                          {item.qty || 1}x
                        </span>
                      </div>

                      {/* Baris ringkasan: ukuran/bahan/biaya desain digabung
                          satu baris kecil, deadline & ID di kanan. */}
                      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1 text-[9.5px] text-slate-500">
                        {formatUkuran && (
                          <span className="flex items-center gap-0.5">
                            <Ruler size={9} className="text-slate-400" /> {formatUkuran}
                          </span>
                        )}
                        {item.bahan && (
                          <span className="flex items-center gap-0.5 truncate max-w-[110px]" title={item.bahan}>
                            <Clipboard size={9} className="text-slate-400" /> {item.bahan}
                          </span>
                        )}
                        {job.biaya_desain > 0 && (
                          <span className="text-emerald-600 font-bold">Rp{job.biaya_desain.toLocaleString()}</span>
                        )}
                        <DeadlineBadge deadline={job.deadline} />
                        <span className="ml-auto text-slate-300 font-mono shrink-0">#{job.id}</span>
                      </div>

                      {/* Catatan CS — dipotong 1 baris, judul lengkap di tooltip. */}
                      {item.keterangan_detail && (
                        <div
                          className="flex items-start gap-1 mt-1 px-1.5 py-1 bg-amber-50 text-amber-800 rounded text-[9.5px] font-semibold truncate"
                          title={item.keterangan_detail}
                        >
                          <AlertCircle size={10} className="text-amber-500 shrink-0 mt-px" />
                          <span className="truncate">{item.keterangan_detail}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Klaim seluruh item dalam order/transaksi ini sekaligus —
                  sebelumnya klaim per-item, jadi order dengan 2+ item (mis.
                  qty 2 dengan finishing beda per unit) butuh 2x klik klaim
                  padahal itu tetap satu pekerjaan/satu order yang sama (bug
                  ditemukan 2026-08-13). */}
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => onClaimMany(grup.jobs.map((j) => j.id))}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-sm hover:shadow-md transition-all cursor-pointer border-none"
                >
                  <UserCheck size={13} />
                  {grup.jobs.length > 1 ? `Klaim Semua (${grup.jobs.length} Item)` : 'Klaim Pekerjaan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginasi */}
      {claimPoolCount > 0 && (
        <div className="flex items-center justify-between gap-3 bg-white px-4 py-2.5 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-500">
          <div className="flex items-center gap-2">
            <span>{claimPoolCount} antrean</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer text-slate-700"
            >
              <option value={15}>15/hal</option>
              <option value={30}>30/hal</option>
              <option value={60}>60/hal</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1 cursor-pointer text-slate-700"
            >
              &lt;
            </button>
            <span>{page} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2.5 py-1 cursor-pointer text-slate-700"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
