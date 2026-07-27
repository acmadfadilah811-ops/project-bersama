import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  X,
  Save,
  Loader2,
  FolderOpen,
  ChevronRight,
  MessageCircle,
  AlertTriangle,
} from 'lucide-react';
import { parsePreviousNotes } from '../jobConstants';
import apiClient from '../../../../api/apiClient';
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

const defaultRow = () => ({ keterangan: '', jumlah: '', satuan: '', catatan: '' });
const defaultMaterial = () => ({ item_id: '', item_nama: '', satuan: '', qty: '', catatan: '' });

/**
 * WorkspaceModal — Layar kerja produksi lengkap:
 * catatan Excel + pemakaian bahan inventori + link drive
 */
export default function WorkspaceModal({
  workspaceJob,
  saving,
  onSubmit,
  onRequestOtp,
  onVerifySuccess,
  onClose,
}) {
  const [isKomplainOpen, setIsKomplainOpen] = useState(false);
  const [tableRows, setTableRows] = useState(() => {
    const existing = workspaceJob?.job?.catatan_staff;
    return Array.isArray(existing) && existing.length > 0 ? existing : [defaultRow()];
  });
  const [materialUsage, setMaterialUsage] = useState([defaultMaterial()]);
  const [inventoryItems, setInventoryItems] = useState([]);
  useEffect(() => {
    apiClient
      .get('/inventory/')
      .then((res) => setInventoryItems(res.data))
      .catch(() => {});
  }, []);

  // ── Row helpers ──
  const addRow = () => setTableRows((r) => [...r, defaultRow()]);
  const removeRow = (i) => setTableRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) =>
    setTableRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));

  const addMaterial = () => {
    setMaterialUsage((m) => [...m, defaultMaterial()]);
  };
  const removeMaterial = (i) => setMaterialUsage((m) => m.filter((_, idx) => idx !== i));
  const updateMaterial = (i, field, val) =>
    setMaterialUsage((m) => m.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  const selectInventoryItem = (i, itemId) => {
    const found = inventoryItems.find((it) => it.id === itemId);
    if (found) {
      let suggestedQty = '';
      let autoNote = '';
      const isRoll = found.satuan?.toLowerCase() === 'm²' || found.satuan?.toLowerCase() === 'm2' || found.kategori?.toLowerCase() === 'bahan cetak';
      if (isRoll && workspaceJob?.orderItemData) {
        const p = parseFloat(workspaceJob.orderItemData.panjang) || 0;
        const l = parseFloat(workspaceJob.orderItemData.lebar) || 0;
        const q = parseFloat(workspaceJob.orderItemData.qty) || 1;
        if (p > 0 && l > 0) {
          suggestedQty = String(p * l * q);
          autoNote = `Konversi UoM: ${p}x${l}m x ${q} pcs`;
        }
      }
      setMaterialUsage((m) =>
        m.map((row, idx) =>
          idx === i
            ? { 
                ...row, 
                item_id: found.id, 
                item_nama: found.nama, 
                satuan: found.satuan,
                qty: suggestedQty || row.qty || '1',
                catatan: autoNote || row.catatan || ''
              }
            : row
        )
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    onSubmit({
      jobId: workspaceJob.job.id,
      tableRows,
      materialUsage,
      driveLink: form.driveLink?.value?.trim() || '',
      hargaJualBaru: form.hargaJualBaru?.value || '',
      hargaLama: workspaceJob.orderItemData?.hargaJual,
      orderItemId: workspaceJob.orderItemData?.orderItemId,
      statusPekerjaan: form.statusPekerjaan?.value || workspaceJob.job.status_pekerjaan,
      fromStart: workspaceJob.fromStart,
    });
  };

  if (!workspaceJob) return null;
  const { previous } = parsePreviousNotes(workspaceJob.job?.catatan_staff);
  const separators = previous.filter(
    (r) => typeof r.keterangan === 'string' && r.keterangan.startsWith('--- Dari Divisi:')
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col overflow-hidden w-full h-full animate-fade-in">
      {/* Header */}
      <div className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/20 p-1.5 rounded-lg">
            <FileSpreadsheet className="text-emerald-400" size={18} />
          </div>
          <div>
            <h2 className="font-extrabold text-sm leading-tight">Layar Kerja Produksi</h2>
            <p className="text-[10px] text-slate-300">
              ID:{' '}
              <span className="font-mono bg-slate-700 px-1 rounded">
                #{workspaceJob.orderItemData?.orderId || '-'}
              </span>
              &nbsp;|&nbsp;Tahap: {workspaceJob.job?.tahap_nama || '-'}
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

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
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
                    {workspaceJob.orderItemData?.customerName || 'Memuat...'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    #{workspaceJob.orderItemData?.orderId || '-'}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-indigo-700 mt-0.5">
                  Produk: {workspaceJob.orderItemData?.jenisProduk || '-'} (Qty:{' '}
                  {workspaceJob.orderItemData?.qty || 1})
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* WhatsApp Link */}
                {workspaceJob.orderItemData?.nomorWa && (
                  <a
                    href={`https://wa.me/${workspaceJob.orderItemData.nomorWa.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md border border-emerald-200 transition-colors shadow-sm cursor-pointer"
                  >
                    <MessageCircle size={12} className="shrink-0" />
                    Hubungi via WA ({workspaceJob.orderItemData.nomorWa})
                  </a>
                )}
                {/* Button Catat Komplain */}
                {workspaceJob.orderItemData?.orderId && (
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
              {/* Keterangan CS (Finishing) / Konsep Desain */}
              <div>
                <span className="block font-bold text-slate-500 uppercase text-[9px] tracking-wider mb-0.5">
                  {workspaceJob.orderItemData?.keteranganDetail?.startsWith('Konsep Desain:') ? 'Konsep Desain' : 'Keterangan Khusus dari CS (Finishing)'}
                </span>
                {(() => {
                  const konsep = getKonsepDesain(workspaceJob.orderItemData?.keterangan);
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
                      {workspaceJob.orderItemData?.keteranganDetail || (
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
                  {workspaceJob.orderItemData?.catatanPelanggan || (
                    <span className="text-slate-400">Tidak ada catatan pelanggan</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Warisan divisi sebelumnya */}
          {previous.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg shadow-sm overflow-hidden mb-4">
              <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2">
                <FolderOpen size={16} />
                <span className="text-sm font-bold">Catatan Divisi Sebelumnya</span>
                <span className="ml-auto text-[10px] bg-amber-600 px-2 py-0.5 rounded-full">
                  {separators.length} divisi
                </span>
              </div>
              <div className="p-3 space-y-3">
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
                      <div className="bg-amber-100 px-3 py-1.5 flex items-center gap-2">
                        <ChevronRight size={12} className="text-amber-600" />
                        <span className="text-xs font-bold text-amber-800">{divisiLabel}</span>
                        <span className="text-[10px] text-amber-600 ml-auto">
                          oleh: {staffLabel}
                        </span>
                      </div>
                      {rows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-amber-50 border-b border-amber-100">
                              <tr>
                                <th className="px-3 py-1.5 text-amber-700 font-bold">Keterangan</th>
                                <th className="px-3 py-1.5 text-amber-700 font-bold w-16 text-center">
                                  Jml
                                </th>
                                <th className="px-3 py-1.5 text-amber-700 font-bold w-16">
                                  Satuan
                                </th>
                                <th className="px-3 py-1.5 text-amber-700 font-bold">Catatan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50">
                              {rows.map((row, ri) => (
                                <tr key={ri} className="hover:bg-amber-50/50">
                                  <td className="px-3 py-1 text-slate-700">
                                    {row.keterangan || '-'}
                                  </td>
                                  <td className="px-3 py-1 text-center text-slate-600">
                                    {row.jumlah || '-'}
                                  </td>
                                  <td className="px-3 py-1 text-slate-600">{row.satuan || '-'}</td>
                                  <td className="px-3 py-1 text-slate-500 italic">
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

          {/* Catatan Kerja Staff (Excel) */}
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-slate-700 text-white px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-bold">Catatan Kerja Staf (Excel)</span>
              <button
                type="button"
                onClick={addRow}
                className="text-[10px] bg-emerald-500 hover:bg-emerald-400 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
              >
                + Tambah Baris
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 border-b border-slate-300">
                  <tr>
                    <th className="px-3 py-2 w-8 text-slate-500">#</th>
                    <th className="px-3 py-2 text-slate-700 font-bold">Keterangan / Item</th>
                    <th className="px-3 py-2 text-slate-700 font-bold w-24">Jumlah</th>
                    <th className="px-3 py-2 text-slate-700 font-bold w-24">Satuan</th>
                    <th className="px-3 py-2 text-slate-700 font-bold">Catatan</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tableRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-2 py-1">
                        <input
                          value={row.keterangan || ''}
                          onChange={(e) => updateRow(i, 'keterangan', e.target.value)}
                          className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 outline-none"
                          placeholder="Deskripsi item..."
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.jumlah || ''}
                          onChange={(e) => updateRow(i, 'jumlah', e.target.value)}
                          className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 outline-none text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.satuan || ''}
                          onChange={(e) => updateRow(i, 'satuan', e.target.value)}
                          className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 outline-none"
                          placeholder="pcs, m..."
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.catatan || ''}
                          onChange={(e) => updateRow(i, 'catatan', e.target.value)}
                          className="w-full border-0 bg-transparent focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5 outline-none"
                          placeholder="Catatan..."
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-red-400 hover:text-red-600 font-bold text-base leading-none"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pemakaian Bahan Inventori */}
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-amber-600 text-white px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-bold">
                Pemakaian Bahan Inventori (Otomatis Potong Stok)
              </span>
              <button
                type="button"
                onClick={addMaterial}
                className="text-[10px] bg-amber-500 hover:bg-amber-400 px-2 py-0.5 rounded font-bold transition-colors shadow-sm cursor-pointer"
              >
                + Bahan
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-amber-50 border-b border-amber-200">
                  <tr>
                    <th className="px-3 py-2 w-8 text-amber-700">#</th>
                    <th className="px-3 py-2 text-amber-900 font-bold w-64">
                      Pilih Bahan Inventori
                    </th>
                    <th className="px-3 py-2 text-amber-900 font-bold w-24">Qty Terpakai</th>
                    <th className="px-3 py-2 text-amber-900 font-bold w-20">Satuan</th>
                    <th className="px-3 py-2 text-amber-900 font-bold">Keterangan / Tujuan</th>
                    <th className="px-3 py-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {materialUsage.map((row, i) => (
                    <tr key={i} className="hover:bg-amber-50/50">
                      <td className="px-3 py-1.5 text-amber-600 font-mono">{i + 1}</td>
                      <td className="px-2 py-1">
                        <select
                          value={row.item_id}
                          onChange={(e) => selectInventoryItem(i, e.target.value)}
                          className="w-full border border-amber-200 bg-white focus:ring-2 focus:ring-amber-500 rounded px-2 py-1 outline-none text-xs"
                        >
                          <option value="">-- Pilih Bahan --</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.nama} (Stok: {inv.stok} {inv.satuan})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.qty}
                          onChange={(e) => updateMaterial(i, 'qty', e.target.value)}
                          className="w-full border border-amber-200 focus:ring-2 focus:ring-amber-500 rounded px-2 py-1 outline-none text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.satuan}
                          readOnly
                          className="w-full border-0 bg-transparent text-slate-500 font-medium px-1 outline-none"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          value={row.catatan}
                          onChange={(e) => updateMaterial(i, 'catatan', e.target.value)}
                          className="w-full border border-amber-200 focus:ring-2 focus:ring-amber-500 rounded px-2 py-1 outline-none"
                          placeholder="Catatan pemakaian..."
                        />
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeMaterial(i)}
                          className="text-red-400 hover:text-red-600 font-bold text-base leading-none"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status, Drive Link & Harga */}
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-3 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Status Pekerjaan</label>
                <select
                  name="statusPekerjaan"
                  defaultValue={workspaceJob.job?.status_pekerjaan || 'antrean'}
                  className="w-full px-2 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none bg-white text-xs"
                >
                  <option value="antrean">Antrean (Queue)</option>
                  <option value="dikerjakan">Dikerjakan (In Progress)</option>
                  <option value="gagal">Gagal (Failed)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">Drive Output Link</label>
                <input
                  type="url"
                  name="driveLink"
                  defaultValue={workspaceJob.job?.gdrive_output_link || ''}
                  placeholder="https://drive..."
                  className="w-full px-2 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-0.5">
                  Ubah Harga Akhir (Opsional)
                </label>
                <input
                  type="number"
                  name="hargaJualBaru"
                  defaultValue={workspaceJob.orderItemData?.hargaJual || ''}
                  className="w-full px-2 py-1 border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-xs"
                />
              </div>
            </div>
          </div>
          {/* Selesaikan Pekerjaan */}
          {workspaceJob.job?.status_pekerjaan === 'dikerjakan' && (
            <div className="bg-white border border-slate-300 rounded-lg shadow-sm p-3.5 border-indigo-100 bg-indigo-50/10">
              <h3 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                Teruskan / Selesaikan Pekerjaan
              </h3>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-500 leading-normal max-w-md">
                  Pekerjaan ini telah siap untuk diselesaikan atau diteruskan ke divisi berikutnya. Tidak memerlukan verifikasi kode OTP dari Admin.
                </p>
                <button
                  type="button"
                  onClick={() => onVerifySuccess(workspaceJob.job)}
                  className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  Selesaikan & Teruskan Pekerjaan &rarr;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 p-3 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            Tutup
          </button>
          <button
            type="submit"
            disabled={saving}
            className={`px-5 py-2 text-xs font-bold text-white rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              workspaceJob.fromStart
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-100 shadow-sm'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-100 shadow-sm'
            }`}
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : workspaceJob.fromStart ? (
              '▶ Mulai Kerjakan Pekerjaan'
            ) : (
              <>
                <Save size={14} /> Simpan Data
              </>
            )}
          </button>
        </div>
      </form>
      <KomplainModal
        isOpen={isKomplainOpen}
        onClose={() => setIsKomplainOpen(false)}
        order={{
          id: workspaceJob.orderItemData?.orderId,
          nama: workspaceJob.orderItemData?.customerName,
          nomor_wa: workspaceJob.orderItemData?.nomorWa,
        }}
        defaultFotoBukti={workspaceJob.job?.gdrive_output_link}
        onSuccess={() => {
          setIsKomplainOpen(false);
        }}
      />
    </div>
  );
}
