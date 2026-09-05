import { useState, useRef } from 'react';
import { X, UploadCloud, Trash2, CheckCircle2, ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../components/PageShell';
import apiClient from '../../../../api/apiClient';

export default function ImportProductModal({ open, onClose, onSuccess, title = 'Import Produk' }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  // Data pratinjau dari backend (dry-run) — bila ada, tampilkan tabel dulu.
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // Langkah wajib setelah import sukses: produk baru belum punya lapisan
  // biaya FIFO sampai di-sync (ditemukan lewat audit produksi 2026-09-05 -
  // 1578 produk hasil import sebelumnya kelewat sync, HPP-nya jadi tidak
  // akurat). Modal ini SENGAJA tidak bisa ditutup lewat X/backdrop sampai
  // sync dijalankan, supaya langkah ini tidak lagi kelewat.
  const [needsSync, setNeedsSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  if (!open) return null;

  const resetAll = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await apiClient.post('/stock-fifo/sync/');
      setSyncResult(res.data);
    } catch (err) {
      console.error('[ImportProductModal] Error sync stok:', err);
      setSyncError(err.response?.data?.error || 'Gagal menyinkronkan stok. Coba lagi.');
    } finally {
      setSyncing(false);
    }
  };

  const handleFinish = () => {
    setNeedsSync(false);
    setSyncResult(null);
    setSyncError(null);
    setSuccessMsg(null);
    onClose();
  };

  const acceptFile = (f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Hanya file .csv yang diperbolehkan.');
      return;
    }
    setFile(f);
    setError(null);
    setPreview(null);
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) acceptFile(e.dataTransfer.files[0]);
  };
  const handleFileSelect = (e) => {
    if (e.target.files?.length) acceptFile(e.target.files[0]);
  };
  const triggerFileSelect = () => fileInputRef.current?.click();
  const handleRemoveFile = () => resetAll();

  const handleDownloadTemplate = () => window.open('/templates/produk-template.csv', '_blank');
  const handleDownloadClassification = () => window.open('/templates/product_classification_list__.xlsx', '_blank');

  // Langkah 1 — minta pratinjau ke backend (tidak menyimpan apa pun).
  const handlePreview = async () => {
    if (!file) {
      setError('Pilih berkas terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('preview', '1');
    try {
      const res = await apiClient.post('/products/import-products/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err) {
      console.error('[ImportProductModal] Error preview:', err);
      setError(err.response?.data?.error || 'Gagal membaca file. Pastikan format CSV sesuai template.');
    } finally {
      setLoading(false);
    }
  };

  // Langkah 2 — konfirmasi & impor sungguhan.
  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post('/products/import-products/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccessMsg(res.data.message || 'Produk berhasil diimpor.');
      setPreview(null);
      setFile(null);
      if (onSuccess) onSuccess();
      setNeedsSync(true);
    } catch (err) {
      console.error('[ImportProductModal] Error importing products:', err);
      setError(err.response?.data?.error || 'Gagal memproses file. Pastikan format CSV sesuai template.');
    } finally {
      setLoading(false);
    }
  };

  const showPreview = !!preview && !successMsg;
  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' };
  const td = { padding: '8px 10px', fontSize: 12.5, color: '#334155', whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: '100%', maxWidth: showPreview ? 860 : 540, background: '#ffffff', borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column', margin: 16, maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            {needsSync ? 'Sinkronkan Stok Produk' : showPreview ? 'Pratinjau Data Import' : title}
          </h3>
          {/* Sengaja disembunyikan selama needsSync && belum ada syncResult -
              lihat catatan di deklarasi needsSync di atas. */}
          {!(needsSync && !syncResult) && (
            <button onClick={needsSync ? handleFinish : onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6, display: 'flex' }}>
              <X size={18} />
            </button>
          )}
        </div>

        {needsSync ? (
          /* ─────────── LANGKAH WAJIB: SYNC STOK PRODUK ─────────── */
          <div style={{ padding: 20 }}>
            <div style={{ padding: '10px 12px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#166534', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={16} /> {successMsg}
            </div>

            {!syncResult ? (
              <div style={{ padding: '14px 16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Langkah wajib berikutnya</div>
                    <p style={{ fontSize: 12, color: '#92400e', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Produk yang baru diimpor belum punya lapisan biaya (dasar perhitungan modal).
                      Tanpa sinkronisasi, harga pokok penjualan (HPP) produk ini bisa salah saat terjual.
                      Klik tombol di bawah untuk menyinkronkan sekarang.
                    </p>
                  </div>
                </div>
                {syncError && (
                  <div style={{ marginTop: 10, padding: '8px 10px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 12 }}>{syncError}</div>
                )}
              </div>
            ) : (
              <div style={{ padding: '14px 16px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Sinkronisasi selesai</div>
                  <p style={{ fontSize: 12, color: '#166534', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                    {syncResult.lapisan_dibuat} lapisan saldo awal dibuat. Produk siap dipakai untuk transaksi.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : showPreview ? (
          /* ─────────── LANGKAH PRATINJAU ─────────── */
          <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {/* Ringkasan */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Produk', val: preview.total_produk, color: '#0f172a', bg: '#f1f5f9' },
                { label: 'Akan Dibuat', val: preview.akan_dibuat, color: '#166534', bg: '#f0fdf4' },
                { label: 'Akan Diperbarui', val: preview.akan_diperbarui, color: '#92400e', bg: '#fffbeb' },
                { label: 'Total Baris CSV', val: preview.total_baris, color: '#475569', bg: '#f8fafc' },
              ].map((s) => (
                <div key={s.label} style={{ flex: '1 1 120px', padding: '10px 12px', background: s.bg, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginTop: 2 }}>{s.val ?? 0}</div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ marginBottom: 12, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 12.5 }}>{error}</div>
            )}

            {/* Tabel data */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'auto', maxHeight: 360 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                  <tr>
                    <th style={th}>Nama Produk</th>
                    <th style={th}>Kategori</th>
                    <th style={th}>Brand</th>
                    <th style={th}>Satuan</th>
                    <th style={{ ...th, textAlign: 'right' }}>Harga Beli</th>
                    <th style={{ ...th, textAlign: 'right' }}>Harga Jual</th>
                    <th style={{ ...th, textAlign: 'right' }}>Stok</th>
                    <th style={{ ...th, textAlign: 'center' }}>Varian</th>
                    <th style={{ ...th, textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview.rows || []).map((r, i) => (
                    <tr key={`${r.nama}-${i}`}>
                      <td style={{ ...td, fontWeight: 600, color: '#0f172a', whiteSpace: 'normal' }}>{r.nama}</td>
                      <td style={td}>{r.kategori || '—'}</td>
                      <td style={td}>{r.brand || '—'}</td>
                      <td style={td}>{r.satuan}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{Number(r.harga_beli || 0).toLocaleString('id-ID')}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{Number(r.harga_jual || 0).toLocaleString('id-ID')}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{r.stok}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{r.jumlah_varian > 0 ? r.jumlah_varian : '—'}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: r.status === 'Baru' ? '#166534' : '#92400e', background: r.status === 'Baru' ? '#dcfce7' : '#fef3c7' }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
              Periksa data di atas. Klik <b>Import Sekarang</b> untuk menyimpan, atau <b>Ganti Berkas</b> untuk memilih file lain.
              Produk berstatus <b>Perbarui</b> akan menimpa data lama dengan nama yang sama.
            </p>
          </div>
        ) : (
          /* ─────────── LANGKAH UNGGAH ─────────── */
          <>
            <div style={{ padding: '16px 20px', display: 'flex', gap: 12, borderBottom: '1px solid #f1f5f9' }}>
              <button onClick={handleDownloadTemplate} style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#2563eb', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, cursor: 'pointer' }}>
                Download Template
              </button>
              <button onClick={handleDownloadClassification} style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#475569', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer' }}>
                Daftar Klasifikasi Product
              </button>
            </div>

            <div style={{ padding: 20 }}>
              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={triggerFileSelect}
                style={{ border: `2px dashed ${isDragging ? '#2563eb' : '#cbd5e1'}`, borderRadius: 10, backgroundColor: isDragging ? '#f0f7ff' : '#f8fafc', padding: '32px 16px', textAlign: 'center', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv" style={{ display: 'none' }} />
                <UploadCloud size={40} style={{ color: isDragging ? '#2563eb' : '#94a3b8' }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>Drop file here or click to upload</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Import dari CSV (max. 500 baris)</div>
              </div>

              {error && (
                <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 12.5 }}>{error}</div>
              )}

              {file && (
                <div style={{ marginTop: 16, padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#334155', wordBreak: 'break-all' }}>{file.name}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 6, borderRadius: 6, display: 'flex' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc', flexShrink: 0 }}>
          {needsSync ? (
            <>
              <div />
              {!syncResult ? (
                <Button variant="primary" onClick={handleSync} disabled={syncing}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Menyinkronkan...' : 'Sync Stok Produk Sekarang'}
                  </span>
                </Button>
              ) : (
                <Button variant="primary" onClick={handleFinish}>Selesai</Button>
              )}
            </>
          ) : showPreview ? (
            <>
              <Button variant="secondary" onClick={resetAll} disabled={loading}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><ArrowLeft size={15} /> Ganti Berkas</span>
              </Button>
              <Button variant="primary" onClick={handleConfirm} disabled={loading || !preview.total_produk}>
                {loading ? 'Mengimpor...' : `Import Sekarang (${preview.total_produk} produk)`}
              </Button>
            </>
          ) : (
            <>
              <div />
              <div style={{ display: 'flex', gap: 12 }}>
                <Button variant="secondary" onClick={onClose} disabled={loading}>Batal</Button>
                <Button variant="primary" onClick={handlePreview} disabled={loading || !file}>
                  {loading ? 'Membaca...' : 'Pratinjau Data'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
