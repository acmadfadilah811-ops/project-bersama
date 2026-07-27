import { useRef, useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, AlertTriangle, CheckCircle, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';

const STATUS_LEGEND = [
  ['P', 'Tunda'],
  ['A', 'Dikonfirmasi'],
  ['S', 'Dikirim'],
  ['T', 'Terkirim'],
  ['Z', 'Selesai'],
  ['X', 'Batal'],
];

export default function ImportStatusModal({ onClose, onSuccess }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const [validatedOk, setValidatedOk] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const pickFile = async (f) => {
    if (!f) return;
    setFile(f);
    setValidationErrors([]);
    setValidatedOk(false);
    setGeneralError('');
    await validateFile(f);
  };

  const validateFile = async (f) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', f);

    try {
      const res = await apiClient.post('/orders/import-status-csv/?dry_run=true', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data?.success) {
        setValidatedOk(true);
      }
    } catch (err) {
      if (err.response && err.response.data) {
        const data = err.response.data;
        if (data.errors && Array.isArray(data.errors)) {
          setValidationErrors(data.errors);
        } else if (data.error) {
          setGeneralError(data.error);
        } else {
          setGeneralError('Gagal memvalidasi berkas CSV.');
        }
      } else {
        setGeneralError('Koneksi ke server gagal.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!file || !validatedOk) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/orders/import-status-csv/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      if (res.data?.success) {
        onSuccess?.(res.data.message || 'Status pesanan berhasil diperbarui.');
        onClose();
      }
    } catch (err) {
      setGeneralError(err.response?.data?.error || 'Gagal memproses impor status.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setValidationErrors([]);
    setValidatedOk(false);
    setGeneralError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    window.open('/templates/status-pesanan-template.csv', '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <FileSpreadsheet className="text-blue-500" size={20} />
            Perbarui Status (CSV)
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded-full p-1.5 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
            {/* Kiri: Legenda dan Template */}
            <div className="space-y-4 border-r border-slate-100 pr-6">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 border border-blue-200 text-blue-600 rounded-lg py-2.5 text-xs font-bold hover:bg-blue-50/50 transition-colors cursor-pointer"
              >
                Download Template
              </button>
              
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Legenda Status
                </p>
                <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 border border-slate-100">
                  {STATUS_LEGEND.map(([code, label]) => (
                    <div key={code} className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 bg-white border border-slate-200 w-6 h-6 flex items-center justify-center rounded-md shadow-sm">
                        {code}
                      </span>
                      <span className="text-slate-500 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Sistem akan memvalidasi data CSV Anda sebelum mengimpor. Pastikan ID pesanan sesuai.
              </p>
            </div>

            {/* Kanan: Upload dan Preview */}
            <div className="space-y-4 min-w-0">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Berkas CSV status (maks. 500 baris)
              </p>

              {!file ? (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files?.[0]);
                  }}
                  className="w-full border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl py-12 px-4 flex flex-col items-center justify-center gap-3 hover:bg-blue-50/10 transition-all cursor-pointer text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    <UploadCloud className="text-slate-400 group-hover:text-blue-500 transition-colors" size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Letakkan berkas CSV di sini
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      atau <span className="text-blue-600 font-semibold">klik untuk mencari</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="text-blue-600" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={loading}
                    className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />

              {/* Status Alert */}
              {loading && (
                <div className="text-sm text-slate-500 flex items-center gap-2 py-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Sedang memproses dan memvalidasi file...</span>
                </div>
              )}

              {generalError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-3 text-xs text-rose-700 animate-fade-in">
                  <AlertTriangle className="shrink-0 text-rose-500" size={16} />
                  <span>{generalError}</span>
                </div>
              )}

              {validatedOk && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-xs text-emerald-700 animate-fade-in">
                  <CheckCircle className="shrink-0 text-emerald-500" size={16} />
                  <div>
                    <p className="font-bold">Validasi Berhasil!</p>
                    <p className="mt-0.5">Semua baris dalam berkas CSV valid dan siap diimpor.</p>
                  </div>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-3 text-xs text-rose-700">
                    <AlertTriangle className="shrink-0 text-rose-500" size={16} />
                    <div>
                      <p className="font-bold">
                        Ooops! Ada kesalahan pada {validationErrors.length} baris.
                      </p>
                      <p className="mt-0.5">
                        Perbaiki sebentar berkas CSV Anda lalu unggah kembali.
                      </p>
                    </div>
                  </div>

                  {/* Tabel Error */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-48">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="px-4 py-2 w-16">Baris</th>
                            <th className="px-4 py-2 w-36">No. Pesanan</th>
                            <th className="px-4 py-2 w-32">Tanggal Kirim</th>
                            <th className="px-4 py-2">Keterangan Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600 bg-white">
                          {validationErrors.map((err, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2 font-semibold text-slate-400">
                                {err.row}
                              </td>
                              <td className="px-4 py-2 font-mono text-slate-700 font-medium">
                                {err.order_id}
                              </td>
                              <td className="px-4 py-2">
                                {err.tanggal_kirim || '-'}
                              </td>
                              <td className="px-4 py-2 text-rose-600 font-medium">
                                {err.message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-sm font-semibold text-slate-600 border border-slate-200 bg-white rounded-lg px-5 py-2 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!file || !validatedOk || loading}
            onClick={handleProcess}
            className={`text-sm font-semibold rounded-lg px-6 py-2 transition-colors ${
              file && validatedOk && !loading
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
