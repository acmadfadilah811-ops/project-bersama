import React, { useRef, useState } from 'react';
import { X, UploadCloud, FileText, Trash2 } from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { parseCsvRows } from '../../../utils/csv';

const TEMPLATE_URL = '/templates/supplier-template.csv';
const MAX_ROWS = 500;

export default function SupplierImportModal({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [issues, setIssues] = useState([]);

  const validateRows = (rows, fileName, isMulti) => {
    const prefix = isMulti ? `${fileName} — ` : '';
    const errors = [];
    if (rows.length === 0) {
      errors.push(`${prefix}File tidak berisi data.`);
    }
    if (rows.length > MAX_ROWS) {
      errors.push(`${prefix}Maksimal ${MAX_ROWS} baris. File ini berisi ${rows.length} baris.`);
    }
    rows.forEach((row, i) => {
      const name = row.name || row.nama || row['Nama Pelanggan'];
      if (!name) {
        errors.push(`${prefix}Baris ${i + 2}: nama supplier wajib diisi.`);
      }
    });
    return errors;
  };

  const handleAddFiles = async (fileList) => {
    if (!fileList?.length) return;
    setResult(null);
    const newFiles = [...files, ...Array.from(fileList)];
    setFiles(newFiles);

    const allRows = [];
    const allIssues = [];

    for (const f of newFiles) {
      try {
        const parsed = await parseCsvRows(f);
        allIssues.push(...validateRows(parsed, f.name, newFiles.length > 1));
        allRows.push(...parsed);
      } catch (err) {
        console.error('[SupplierImportModal] Parse error:', err);
        allIssues.push(`${f.name} — Gagal dibaca. Pastikan format CSV UTF-8.`);
      }
    }
    setPreviewRows(allRows);
    setIssues(allIssues);
  };

  const handleClear = () => {
    setFiles([]);
    setResult(null);
    setPreviewRows([]);
    setIssues([]);
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = TEMPLATE_URL;
    link.download = 'supplier-template.csv';
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
      for (const f of files) {
        const formData = new FormData();
        formData.append('file', f);
        const res = await apiClient.post('/suppliers/import-csv/', formData, {
          headers: { 'Content-Type': undefined },
        });
        created += res.data.created || 0;
        if (res.data.errors) {
          res.data.errors.forEach(e => errors.push({ ...e, file: f.name }));
        }
      }
      setResult({ created, errors });
      if (created > 0 && onImported) {
        onImported();
      }
    } catch (err) {
      console.error('[SupplierImportModal] Process error:', err);
      errors.push({ message: err.response?.data?.error || 'Gagal memproses impor CSV.' });
      setResult({ created, errors });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(15, 23, 42, 0.4)',
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        width: '100%',
        maxWidth: '700px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          borderBottom: '1px solid #f1f5f9'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
            Perbarui Status (CSV)
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 0, color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>Import dari CSV (max. 500 baris)</span>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 16px',
                height: '34px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              Download Template
            </button>
          </div>

          {/* Drag & Drop Area */}
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleAddFiles(e.dataTransfer.files);
            }}
            style={{
              border: '2px dashed #e2e8f0',
              borderRadius: '8px',
              padding: '40px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'center'
            }}
          >
            {files.length === 0 ? (
              <>
                <UploadCloud size={32} style={{ color: '#cbd5e1' }} />
                <span style={{ fontSize: '13px', color: '#64748b' }}>Drop files here to upload</span>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#334155' }}>
                    <FileText size={14} style={{ color: '#0ea5e9' }} />
                    <span>{f.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleAddFiles(e.target.files)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              disabled={files.length === 0}
              onClick={handleClear}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0 12px',
                height: '32px',
                fontSize: '12px',
                fontWeight: 'bold',
                color: files.length === 0 ? '#94a3b8' : '#e11d48',
                cursor: files.length === 0 ? 'not-allowed' : 'pointer',
                opacity: files.length === 0 ? 0.5 : 1
              }}
            >
              Hapus semua file
            </button>
          </div>

          {/* Table Preview */}
          {files.length > 0 && previewRows.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                <span style={{ fontWeight: 'bold', color: '#475569' }}>Pratinjau data ({previewRows.length} baris)</span>
                <span style={{ fontWeight: 'bold', color: issues.length > 0 ? '#e11d48' : '#16a34a' }}>
                  {issues.length > 0 ? `${issues.length} masalah — perbaiki dulu` : 'Siap diimpor'}
                </span>
              </div>

              <div style={{
                maxHeight: '200px',
                overflowX: 'auto',
                overflowY: 'auto',
                border: '1px solid #cbd5e1',
                borderRadius: '8px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 'bold' }}>Nama Pelanggan</th>
                      <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 'bold' }}>Alamat</th>
                      <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 'bold' }}>Telpon</th>
                      <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 'bold' }}>Email</th>
                      <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 'bold' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => {
                      const name = row.name || row.nama || row['Nama Pelanggan'] || '-';
                      const addr = row.address || row.alamat || row['Alamat'] || '-';
                      const telp = row.phone || row.telpon || row['Telpon'] || '-';
                      const email = row.email || row['Email'] || '-';
                      const status = row.status || row['Status'] || '-';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#1e293b' }}>{name}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{addr}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{telp}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{email}</td>
                          <td style={{ padding: '8px 12px', color: '#475569' }}>{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {issues.length > 0 && (
                <div style={{
                  marginTop: '10px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  maxHeight: '80px',
                  overflowY: 'auto'
                }}>
                  {issues.map((msg, i) => (
                    <div key={i} style={{ color: '#e11d48', fontSize: '11px', lineHeight: 1.5 }}>• {msg}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result && (
            <div style={{
              padding: '12px',
              borderRadius: '6px',
              background: result.errors.length > 0 ? '#fffbeb' : '#ecfdf5',
              border: result.errors.length > 0 ? '1px solid #fde68a' : '1px solid #a7f3d0',
              fontSize: '13px',
              color: result.errors.length > 0 ? '#b45309' : '#047857'
            }}>
              <p style={{ fontWeight: 'bold', margin: 0 }}>{result.created} supplier berhasil diimpor.</p>
              {result.errors.length > 0 && (
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px', maxHeight: '100px', overflowY: 'auto' }}>
                  {result.errors.map((e, idx) => (
                    <li key={idx} style={{ fontSize: '12px' }}>
                      {e.file ? `${e.file} — ` : ''}Baris {e.row || '-'}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          background: '#f8fafc',
          borderBottomLeftRadius: '12px',
          borderBottomRightRadius: '12px'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '0 24px',
              height: '38px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            Batal
          </button>
          
          <button
            type="button"
            disabled={files.length === 0 || processing || issues.length > 0}
            onClick={handleProcess}
            style={{
              background: (files.length === 0 || processing || issues.length > 0) ? '#cbd5e1' : '#0ea5e9',
              border: 0,
              borderRadius: '6px',
              padding: '0 24px',
              height: '38px',
              fontSize: '13px',
              fontWeight: 'bold',
              color: (files.length === 0 || processing || issues.length > 0) ? '#94a3b8' : '#ffffff',
              cursor: (files.length === 0 || processing || issues.length > 0) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {processing ? 'Memproses...' : 'Proses'}
          </button>
        </div>

      </div>
    </div>
  );
}
