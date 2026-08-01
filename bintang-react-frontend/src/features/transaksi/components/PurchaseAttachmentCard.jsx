import { useRef, useState } from 'react';
import { Paperclip, Plus } from 'lucide-react';

const formatSize = (size) => {
  const bytes = Number(size) || 0;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function PurchaseAttachmentCard({ attachments = [], canUpload, onUpload }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (event) => {
    const [file] = Array.from(event.target.files || []);
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
        <span className="text-xs font-bold text-slate-800">File Lampiran</span>
        {canUpload && (
          <>
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 disabled:opacity-50 cursor-pointer transition-colors"
            >
              <Plus size={12} /> {uploading ? 'Mengunggah...' : 'Tambah'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.doc,.docx"
              onChange={handleChange}
              className="hidden"
            />
          </>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.file_url || attachment.file}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Paperclip size={13} className="shrink-0 text-slate-400" />
              <span className="truncate font-semibold text-slate-700">{attachment.nama || 'Lampiran pembelian'}</span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-400">{formatSize(attachment.ukuran)}</span>
            </a>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-xs text-slate-400">Tidak ada lampiran</div>
      )}
    </div>
  );
}
