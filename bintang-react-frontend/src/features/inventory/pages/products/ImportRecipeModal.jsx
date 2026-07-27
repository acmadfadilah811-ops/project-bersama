import { useState, useRef } from 'react';
import { X, UploadCloud, Trash2 } from 'lucide-react';
import { Button } from '../components/PageShell';
import apiClient from '../../../../api/apiClient';

export default function ImportRecipeModal({ open, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Hanya file .csv yang diperbolehkan.');
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Hanya file .csv yang diperbolehkan.');
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    window.open('/templates/resep-template.csv', '_blank');
  };

  const handleProcess = async () => {
    if (!file) {
      setError('Pilih berkas terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiClient.post('/products/import-recipes/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setSuccessMsg(res.data.message || 'Bahan/resep berhasil diimpor.');
      setFile(null);
      if (onSuccess) {
        onSuccess();
      }
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 2000);
    } catch (err) {
      console.error('[ImportRecipeModal] Error importing recipes:', err);
      setError(err.response?.data?.error || 'Gagal memproses file. Pastikan format CSV sesuai template.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Import Daftar Bahan / Resep
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Info & Template Button Row */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
            Import dari CSV (max. 500 baris)
          </span>
          <button
            onClick={handleDownloadTemplate}
            style={{
              padding: '8px 12px',
              fontSize: 12.5,
              fontWeight: 500,
              color: '#2563eb',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
            }}
          >
            Download Template
          </button>
        </div>

        {/* Upload Zone */}
        <div style={{ padding: 20 }}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            style={{
              border: `2px dashed ${isDragging ? '#2563eb' : '#cbd5e1'}`,
              borderRadius: 10,
              backgroundColor: isDragging ? '#f0f7ff' : '#f8fafc',
              padding: '32px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv"
              style={{ display: 'none' }}
            />
            <UploadCloud size={40} style={{ color: isDragging ? '#2563eb' : '#94a3b8' }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>
              Drop file here or click to upload
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Pilih berkas dari perangkat Anda
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                color: '#991b1b',
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 8,
                color: '#166534',
                fontSize: 12.5,
              }}
            >
              {successMsg}
            </div>
          )}

          {/* Selected File Details */}
          {file && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#334155', wordBreak: 'break-all' }}>
                  {file.name}
                </span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '16px 20px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
          }}
        >
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant="primary" onClick={handleProcess} disabled={loading || !file}>
            {loading ? 'Memproses...' : 'Memproses'}
          </Button>
        </div>
      </div>
    </div>
  );
}
