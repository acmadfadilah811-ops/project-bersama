import { useState } from 'react';
import {
  FileSpreadsheet,
  X,
  RefreshCw,
  FolderOpen,
  ChevronRight,
  MessageCircle,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { parsePreviousNotes } from '../jobConstants';
import KomplainModal from '../../../orders/components/KomplainModal';

const getKonsepDesain = (detail) => {
  if (!detail) return null;
  try {
    const arr = typeof detail === 'string' ? JSON.parse(detail) : detail;
    if (Array.isArray(arr)) {
      const found = arr.find(d => d && (d.key === 'Konsep Desain' || d.key === 'konsep_desain'));
      if (found && found.value) {
        return found.value;
      }
    }
  } catch (e) {
    console.error("Error parsing detail:", e);
  }
  return null;
};

export default function WorkspaceReviewModal({ workspaceJob, onRevisi, onClose }) {
  const [isKomplainOpen, setIsKomplainOpen] = useState(false);
  if (!workspaceJob) return null;

  const { job, orderItemData } = workspaceJob;
  const { previous } = parsePreviousNotes(job?.catatan_staff);
  const separators = previous.filter(
    (r) => typeof r.keterangan === 'string' && r.keterangan.startsWith('--- Dari Divisi:')
  );

  // Parse current staff notes (the excel rows)
  const currentStaffNotes = Array.isArray(job?.catatan_staff) ? job.catatan_staff : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden w-full h-full animate-fade-in">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/20 p-1.5 rounded-lg">
            <FileSpreadsheet className="text-emerald-400" size={18} />
          </div>
          <div>
            <h2 className="font-extrabold text-sm leading-tight">Review Detail Pekerjaan</h2>
            <p className="text-[10px] text-slate-300">
              ID:{' '}
              <span className="font-mono bg-slate-700 px-1 rounded">
                #{orderItemData?.orderId || '-'}
              </span>
              &nbsp;|&nbsp;Tahap: {job?.tahap_nama || '-'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white bg-slate-700 p-1 rounded-lg transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-3">
        {/* Info Detail Pesanan & Pelanggan */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Detail Pelanggan & Produk
              </h3>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-sm font-extrabold text-slate-800">
                  {orderItemData?.customerName || 'Memuat...'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  #{orderItemData?.orderId || '-'}
                </span>
              </div>
              <p className="text-[11px] font-bold text-indigo-700 mt-0.5">
                Produk: {orderItemData?.jenisProduk || '-'} (Qty: {orderItemData?.qty || 1})
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {orderItemData?.nomorWa && (
                <a
                  href={`https://wa.me/${orderItemData.nomorWa.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 transition-colors shadow-sm"
                >
                  <MessageCircle size={12} className="shrink-0" />
                  Hubungi via WA ({orderItemData.nomorWa})
                </a>
              )}
              {orderItemData?.orderId && (
                <button
                  type="button"
                  onClick={() => setIsKomplainOpen(true)}
                  className="inline-flex items-center gap-1 font-bold text-[10px] text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md border border-rose-200 transition-colors shadow-sm cursor-pointer"
                >
                  <AlertTriangle size={12} className="shrink-0" />
                  Catat Komplain
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px]">
            {/* Keterangan CS / Konsep Desain */}
            <div>
              <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-0.5">
                {orderItemData?.keteranganDetail?.startsWith('Konsep Desain:') ? 'Konsep Desain' : 'Keterangan Khusus dari CS (Finishing)'}
              </span>
              {(() => {
                const konsep = getKonsepDesain(orderItemData?.keterangan);
                if (konsep) {
                  return (
                    <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-lg p-2.5 space-y-1.5 text-xs text-indigo-950 font-medium">
                      <div className="grid grid-cols-3 gap-2 border-b border-indigo-100/30 pb-1.5">
                        <div>
                          <span className="block text-[8px] uppercase text-indigo-500 font-black">Tulisan yang Dimuat</span>
                          <span className="font-extrabold">{konsep.tulisan || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase text-indigo-500 font-black">Warna Dominan</span>
                          <span className="font-extrabold">{konsep.warna_dominan || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase text-indigo-500 font-black">Logo / Foto</span>
                          <span className="font-extrabold">{konsep.logo_foto || '-'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[8px] uppercase text-indigo-500 font-black">Bentuk / Layout</span>
                          <span className="font-bold">{konsep.bentuk || '-'}</span>
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase text-indigo-500 font-black">Request Tambahan</span>
                          <span className="font-bold">{konsep.request_tambahan || '-'}</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 min-h-[30px] text-slate-700 whitespace-pre-line leading-relaxed">
                    {orderItemData?.keteranganDetail || (
                      <span className="text-slate-400 italic">Tidak ada keterangan khusus</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Catatan Pelanggan */}
            <div>
              <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-0.5">
                Catatan Tambahan Pelanggan
              </span>
              <div className="bg-slate-50 border border-slate-200 rounded p-2 min-h-[30px] text-slate-600 italic whitespace-pre-line leading-relaxed">
                {orderItemData?.catatanPelanggan || (
                  <span className="text-slate-400">Tidak ada catatan pelanggan</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Warisan divisi sebelumnya */}
        {previous.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-amber-500 text-white px-3 py-1.5 flex items-center gap-2">
              <FolderOpen size={14} />
              <span className="text-xs font-bold">Catatan Divisi Sebelumnya</span>
            </div>
            <div className="p-2 space-y-2">
              {separators.map((sep, si) => {
                const sepIdxInPrev = previous.indexOf(sep);
                const nextSepIdx = previous.findIndex(
                  (r, i) =>
                    i > sepIdxInPrev &&
                    typeof r.keterangan === 'string' &&
                    r.keterangan.startsWith('--- Dari Divisi:')
                );
                const rows = previous.slice(
                  sepIdxInPrev + 1,
                  nextSepIdx === -1 ? undefined : nextSepIdx
                );
                const divisiLabel = sep.keterangan
                  .replace('--- Dari Divisi:', '')
                  .replace('---', '')
                  .trim();
                const staffLabel = sep.catatan?.replace('Oleh:', '').trim() || '-';
                return (
                  <div
                    key={si}
                    className="bg-white rounded border border-amber-200 overflow-hidden"
                  >
                    <div className="bg-amber-100 px-2 py-1 flex items-center gap-1.5">
                      <ChevronRight size={10} className="text-amber-600" />
                      <span className="text-[11px] font-bold text-amber-800">{divisiLabel}</span>
                      <span className="text-[9px] text-amber-600 ml-auto">oleh: {staffLabel}</span>
                    </div>
                    {rows.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] text-left">
                          <thead className="bg-amber-50 border-b border-amber-100">
                            <tr>
                              <th className="px-2 py-1 text-amber-700 font-bold">Keterangan</th>
                              <th className="px-2 py-1 text-amber-700 font-bold w-12 text-center">
                                Jml
                              </th>
                              <th className="px-2 py-1 text-amber-700 font-bold w-12">Satuan</th>
                              <th className="px-2 py-1 text-amber-700 font-bold">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-50">
                            {rows.map((row, ri) => (
                              <tr key={ri} className="hover:bg-amber-50/50">
                                <td className="px-2 py-0.5 text-slate-700">
                                  {row.keterangan || '-'}
                                </td>
                                <td className="px-2 py-0.5 text-center text-slate-600">
                                  {row.jumlah || '-'}
                                </td>
                                <td className="px-2 py-0.5 text-slate-600">{row.satuan || '-'}</td>
                                <td className="px-2 py-0.5 text-slate-500 italic">
                                  {row.catatan || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Catatan Kerja Staff Saat Ini (Tabel) */}
        <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
          <div className="bg-slate-700 text-white px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-bold">Catatan Kerja Staf</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="px-2.5 py-1.5 w-6 text-slate-500">#</th>
                  <th className="px-2.5 py-1.5 text-slate-700 font-bold">Keterangan / Item</th>
                  <th className="px-2.5 py-1.5 text-slate-700 font-bold w-20">Jumlah</th>
                  <th className="px-2.5 py-1.5 text-slate-700 font-bold w-20">Satuan</th>
                  <th className="px-2.5 py-1.5 text-slate-700 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currentStaffNotes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-3 text-slate-400 italic">
                      Tidak ada catatan kerja diinput
                    </td>
                  </tr>
                ) : (
                  currentStaffNotes.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-2.5 py-1 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-2.5 py-1 text-slate-800 font-medium">
                        {row.keterangan || '-'}
                      </td>
                      <td className="px-2.5 py-1 text-slate-600">{row.jumlah || '-'}</td>
                      <td className="px-2.5 py-1 text-slate-600">{row.satuan || '-'}</td>
                      <td className="px-2.5 py-1 text-slate-500 italic">{row.catatan || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lampiran Output & Harga */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-0.5">
              Drive Output Link
            </span>
            {job?.gdrive_output_link ? (
              <a
                href={job.gdrive_output_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Buka Link Output <ExternalLink size={10} />
              </a>
            ) : (
              <span className="text-[11px] text-slate-400 italic">Belum ada link output</span>
            )}
          </div>
          <div>
            <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-0.5">
              Harga Cetak Terakhir
            </span>
            <span className="text-xs font-extrabold text-slate-800">
              Rp {orderItemData?.hargaJual?.toLocaleString('id-ID') || '0'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-slate-200 p-3 flex justify-between gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => onRevisi(job)}
          className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
        >
          <RefreshCw size={14} />
          Revisi Pekerjaan
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
        >
          Tutup
        </button>
      </div>
      <KomplainModal
        isOpen={isKomplainOpen}
        onClose={() => setIsKomplainOpen(false)}
        order={{
          id: orderItemData?.orderId,
          nama: orderItemData?.customerName || 'Pelanggan',
          nomor_wa: orderItemData?.nomorWa || '',
        }}
        defaultFotoBukti={job?.gdrive_output_link}
        onSuccess={() => setIsKomplainOpen(false)}
      />
    </div>
  );
}
