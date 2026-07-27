import { useRef, useState } from 'react';
import { X, FileText, Trash2 } from 'lucide-react';

/**
 * Modal "Import Pembelian" — unggah CSV (maks. 500 baris).
 * Mengikuti tampilan referensi: dropzone besar, tombol unduh template,
 * "Hapus semua file", footer Batal / Proses.
 */
export default function ImportPembelianModal({ onClose, onProcess, onDownloadTemplate }) {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);

  const addFiles = (list) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">Import Pembelian</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1 hover:bg-slate-50 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-600">Import dari CSV (max. 500 baris)</p>
            <button
              type="button"
              onClick={onDownloadTemplate}
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
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-16 px-4 flex flex-col items-center justify-center gap-2 text-center hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-pointer"
          >
            {files.length === 0 ? (
              <span className="text-sm text-slate-400">Drop files here to upload</span>
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
            onClick={() => setFiles([])}
            disabled={files.length === 0}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={15} /> Hapus semua file
          </button>
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
          <button
            type="button"
            disabled={files.length === 0}
            onClick={() => onProcess?.(files)}
            className={`text-sm font-semibold rounded-lg px-6 py-2 transition-colors ${
              files.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-sm'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Proses
          </button>
        </div>
      </div>
    </div>
  );
}
