import { useRef, useState } from 'react';
import { X, UploadCloud, FileText, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { parseCsvRows } from '../../../utils/csv';
import CustomerImportPreview from './CustomerImportPreview';

const TEMPLATE_URL = '/templates/pelanggan-template.csv';
// Harus sama dengan MAX_IMPORT_ROWS di backend (customer_views.py) supaya user
// tidak ditolak server setelah pratinjau terlanjur menyatakan aman.
const MAX_ROWS = 500;

/** Aturannya sengaja meniru backend: kolom `name` wajib, maksimal 500 baris. */
const periksaBaris = (rows, namaFile, banyakFile) => {
  const asal = banyakFile ? `${namaFile} — ` : '';
  const pesan = [];
  if (rows.length === 0) pesan.push(`${asal}file tidak berisi baris data.`);
  if (rows.length > MAX_ROWS) {
    pesan.push(`${asal}maksimal ${MAX_ROWS} baris — file ini berisi ${rows.length} baris.`);
  }
  rows.forEach((row, i) => {
    if (!row.name) pesan.push(`${asal}baris ${i + 2}: kolom "name" wajib diisi.`);
  });
  return pesan;
};

export default function CustomerImportModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  // Isi CSV dibaca di browser dulu supaya user melihat datanya sebelum diproses.
  const [previewRows, setPreviewRows] = useState([]);
  const [issues, setIssues] = useState([]);

  const addFiles = async (list) => {
    if (!list?.length) return;
    setResult(null);
    const berikutnya = [...files, ...Array.from(list)];
    setFiles(berikutnya);

    const semuaBaris = [];
    const semuaMasalah = [];
    for (const f of berikutnya) {
      try {
        const rows = await parseCsvRows(f);
        // Batas 500 dicek PER file — backend memproses tiap file terpisah.
        semuaMasalah.push(...periksaBaris(rows, f.name, berikutnya.length > 1));
        semuaBaris.push(...rows);
      } catch (err) {
        console.error('[CustomerImportModal] parse csv error:', err);
        semuaMasalah.push(`${f.name} — gagal dibaca. Pastikan berformat CSV (UTF-8).`);
      }
    }
    setPreviewRows(semuaBaris);
    setIssues(semuaMasalah);
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
    link.download = 'pelanggan-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleProcess = async () => {
    if (!files.length || processing) return;
    setProcessing(true);
    setResult(null);
    let created = 0;
    const errors = [];
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post('/customers/import-csv/', formData, {
          headers: { 'Content-Type': undefined },
        });
        created += res.data.created || 0;
        (res.data.errors || []).forEach((e) => errors.push({ ...e, file: file.name }));
      }
      setResult({ created, errors });
      if (created > 0) onImported?.();
    } catch (err) {
      console.error('[CustomerImportModal] import error:', err);
      setResult({ created, errors: [{ message: err.response?.data?.error || 'Gagal memproses file import.' }] });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Import</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-600">Import dari CSV (max. 500 baris)</p>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer"
            >
              Download Template
            </button>
          </div>

          {/* Dropzone */}
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
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />

          <button
            type="button"
            onClick={bersihkan}
            disabled={files.length === 0}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} /> Hapus semua file
          </button>

          {/* Pratinjau isi CSV — ditampilkan SEBELUM dikirim ke server, seperti Olsera */}
          {files.length > 0 && <CustomerImportPreview rows={previewRows} issues={issues} />}

          {result && (
            <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${result.errors.length ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <p className="font-semibold">{result.created} pelanggan berhasil diimpor.</p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 list-disc list-inside space-y-0.5 max-h-28 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e.file ? `${e.file} — ` : ''}Baris {e.row ?? '-'}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-6 py-2 hover:bg-slate-50 cursor-pointer"
          >
            Batal
          </button>
          {/* CSV bermasalah ditolak di sini, sebelum apa pun dikirim ke server. */}
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
            {processing
              ? 'Memproses...'
              : previewRows.length > 0 && issues.length === 0
                ? `Proses ${previewRows.length} baris`
                : 'Proses'}
          </button>
        </div>
      </div>
    </div>
  );
}
