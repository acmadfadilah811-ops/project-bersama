import { useRef, useState } from 'react';
import { X, UploadCloud, FileText, Trash2 } from 'lucide-react';
import { parseCsvRows } from '../../../utils/csv';

const TEMPLATE_URL = '/templates/produk-pesanan-template.csv';
const MAX_ROWS = 500;

/** Aturan pratinjau: kolom `sku` atau `nama` wajib, `qty` harus angka > 0. */
const periksaBaris = (rows) => {
  const pesan = [];
  if (rows.length === 0) pesan.push('File tidak berisi baris data.');
  if (rows.length > MAX_ROWS) {
    pesan.push(`Maksimal ${MAX_ROWS} baris — file ini berisi ${rows.length} baris.`);
  }
  rows.forEach((row, i) => {
    if (!row.sku && !row.nama) pesan.push(`Baris ${i + 2}: kolom "sku" atau "nama" wajib diisi.`);
    if (row.qty && (isNaN(Number(row.qty)) || Number(row.qty) <= 0)) {
      pesan.push(`Baris ${i + 2}: kolom "qty" harus angka lebih dari 0.`);
    }
  });
  return pesan;
};

/**
 * Import produk ke Produk Pesanan lewat CSV — pola sama seperti CustomerImportModal
 * (pratinjau di browser dulu, baru kirim ke server; template + dropzone identik).
 *
 * CATATAN: backend untuk endpoint import item pesanan belum tersedia saat komponen ini
 * dibuat — UI sudah lengkap & siap pakai begitu endpoint-nya ada, tapi tombol proses
 * sengaja jujur menolak daripada berpura-pura sukses (B2/M6).
 */
export default function ImportOrderItemsModal({ orderId, onClose, onImported }) {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [issues, setIssues] = useState([]);

  const addFiles = async (list) => {
    if (!list?.length) return;
    setResult(null);
    const file = list[0];
    setFiles([file]);
    try {
      const rows = await parseCsvRows(file);
      setPreviewRows(rows);
      setIssues(periksaBaris(rows));
    } catch (err) {
      console.error('[ImportOrderItemsModal] parse csv error:', err);
      setPreviewRows([]);
      setIssues([`${file.name} — gagal dibaca. Pastikan berformat CSV (UTF-8).`]);
    }
  };

  const bersihkan = () => {
    setFiles([]);
    setResult(null);
    setPreviewRows([]);
    setIssues([]);
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'produk-pesanan-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleProcess = async () => {
    setResult({
      created: 0,
      errors: [{ message: 'Import produk pesanan belum terhubung ke backend — segera hadir.' }],
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Import</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-600">Import dari CSV (max. {MAX_ROWS} baris)</p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              Download Template
            </button>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-14 px-4 flex flex-col items-center justify-center gap-2 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
          >
            {files.length === 0 ? (
              <>
                <UploadCloud className="text-slate-300" size={40} />
                <span className="text-sm text-slate-500">
                  Drop file here or <span className="text-blue-600">click to upload</span>
                </span>
              </>
            ) : (
              <ul className="text-sm text-slate-600 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <FileText size={14} className="text-blue-500" /> {f.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          <button
            type="button"
            onClick={bersihkan}
            disabled={files.length === 0}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} /> Hapus file
          </button>

          {previewRows.length > 0 && (
            <div className="mt-4 border border-slate-100 rounded-lg overflow-hidden">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0">
                    <tr>
                      {Object.keys(previewRows[0]).map((k) => (
                        <th key={k} className="px-3 py-2">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewRows.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {Object.keys(previewRows[0]).map((k) => (
                          <td key={k} className="px-3 py-2 text-slate-700">{row[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewRows.length > 20 && (
                <p className="text-[11px] text-slate-400 px-3 py-1.5 bg-slate-50">+{previewRows.length - 20} baris lainnya</p>
              )}
            </div>
          )}

          {issues.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ul className="list-disc list-inside space-y-0.5">
                {issues.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          )}

          {result && (
            <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${result.errors.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              {result.created > 0 && <p className="font-semibold">{result.created} produk berhasil diimpor.</p>}
              {result.errors.length > 0 && (
                <ul className="mt-1.5 list-disc list-inside space-y-0.5 max-h-28 overflow-y-auto">
                  {result.errors.map((e, i) => <li key={i}>{e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-6 py-2 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={files.length === 0 || processing || issues.length > 0 || previewRows.length === 0}
            onClick={handleProcess}
            title={issues.length > 0 ? 'Perbaiki dulu masalah pada file CSV' : undefined}
            className={`text-sm font-semibold rounded-lg px-6 py-2 transition-colors ${
              files.length > 0 && !processing && issues.length === 0 && previewRows.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {processing ? 'Memproses...' : previewRows.length > 0 && issues.length === 0 ? `Proses ${previewRows.length} baris` : 'Proses'}
          </button>
        </div>
      </div>
    </div>
  );
}
