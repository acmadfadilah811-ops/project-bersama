import { useRef } from 'react';
import { Plus, Paperclip, Trash2 } from 'lucide-react';

export default function OrderLogSection({
  order,
  metadata,
  onSave,
  onCancelOrder,
  readOnly
}) {
  const fileInputRef = useRef(null);

  // Format DateTime to: 17-Jul-2026 18:41:38
  const formatDateTime = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const date = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${date}-${month}-${year} ${hours}:${minutes}:${seconds}`;
  };

  // Tampilkan "nama <email>" dari log. Nama & email berasal dari akun pencatat,
  // bukan dari user yang sedang membuka layar — log adalah jejak SIAPA yang
  // mengubah, jadi tak boleh jatuh ke identitas pembaca (apalagi alamat
  // hardcoded, seperti versi sebelumnya). Bila akun pencatat sudah dihapus,
  // backend mengirim null dan kita tampilkan penanda yang jujur.
  const formatAktor = (log) => {
    if (!log) return 'Tidak diketahui';
    const nama = log.user_nama;
    const email = log.user_email;
    if (nama && email) return `${nama} (${email})`;
    return nama || email || 'Akun telah dihapus';
  };

  const getCreateLog = () =>
    order.activity_logs?.find(
      (log) => log.tindakan === 'CREATE_ORDER'
        || log.keterangan?.includes('dibuat')
        || log.keterangan?.includes('Created'),
    );

  const getCreator = () => formatAktor(getCreateLog());

  const getUpdater = () => formatAktor(order.activity_logs?.[0]);

  const getLastUpdateTime = () => {
    if (order.activity_logs && order.activity_logs.length > 0) {
      return order.activity_logs[0].waktu;
    }
    return order.waktu;
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const currentAttachments = metadata.attachments || [];
      const newFiles = Array.from(e.target.files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        uploadedAt: new Date().toISOString(),
      }));

      await onSave({
        metadata: {
          ...metadata,
          attachments: [...currentAttachments, ...newFiles],
        },
      });

      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async (id) => {
    const currentAttachments = metadata.attachments || [];
    const updated = currentAttachments.filter((f) => f.id !== id);

    await onSave({
      metadata: {
        ...metadata,
        attachments: updated,
      },
    });
  };

  const attachments = metadata.attachments || [];

  return (
    <div className="space-y-4 text-slate-700">
      {/* File Lampiran */}
      {!(readOnly && attachments.length === 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
            <span className="text-xs font-bold text-slate-800">File Lampiran</span>
            {!readOnly && (
              <button
                type="button"
                onClick={handleTriggerUpload}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer transition-colors"
              >
                <Plus size={12} /> Tambah
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
            />
          </div>

          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 animate-fade-in"
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <Paperclip size={13} className="text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-700 truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">({file.size})</span>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(file.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400">Tidak ada lampiran</div>
          )}
        </div>
      )}

      {/* Batalkan Orderan */}
      {order.status_global !== 'batal' && (
        <div className="text-center py-2">
          <button
            type="button"
            onClick={onCancelOrder}
            className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
          >
            🗑️ Batalkan orderan
          </button>
        </div>
      )}

      {/* Log Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
        <div className="border-b border-slate-100 pb-2.5 mb-3">
          <span className="text-xs font-bold text-slate-800">Log</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-start py-1 border-b border-slate-50">
            <span className="text-slate-400 font-medium">Terakhir Diperbarui</span>
            <span className="text-slate-700 font-semibold text-right">
              {getUpdater()}, {formatDateTime(getLastUpdateTime())}
            </span>
          </div>
          <div className="flex justify-between items-start py-1 border-b border-slate-50">
            <span className="text-slate-400 font-medium">Waktu Pembuatan</span>
            <span className="text-slate-700 font-semibold text-right">
              {getCreator()}, {formatDateTime(order.waktu)}
            </span>
          </div>

          {/* Show full activity log entries if any */}
          {order.activity_logs && order.activity_logs.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 block mb-2">RIWAYAT AKTIVITAS:</span>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {order.activity_logs.map((log) => (
                  <div key={log.id} className="text-[10px] bg-slate-50 rounded-lg p-2 border border-slate-100 flex justify-between gap-3">
                    <div className="text-slate-600">
                      <span className="font-bold text-slate-700">{formatAktor(log)}</span>: {log.keterangan}
                    </div>
                    <span className="text-slate-400 font-mono shrink-0">{log.waktu_formatted}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
