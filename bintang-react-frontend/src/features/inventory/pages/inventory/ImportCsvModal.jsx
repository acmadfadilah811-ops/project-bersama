import { useState, useEffect } from 'react';
import { X, CloudUpload, Check, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

/**
 * Modal import CSV bersama untuk dokumen stok (Stok Masuk, Stok Keluar).
 *
 * Tata letaknya mengikuti Olsera: teks datanya ada DI DALAM kotak, tombol Hapus
 * & Proses tepat di bawah kotak.
 *
 * Isi CSV diperiksa di browser SEBELUM apa pun dikirim ke server, supaya dokumen
 * draft sampah tidak terlanjur dibuat. Aturan dasarnya sengaja dibuat mengikuti
 * backend: produk dicocokkan lewat sku ATAU nama, qty wajib angka > 0, dan batas
 * baris harus sama dengan plafon backend supaya user tidak ditolak server setelah
 * pratinjau terlanjur menyatakan aman. Aturan khusus per layar lewat `validateExtra`.
 */
export function ImportCsvModal({
  open,
  onClose,
  title,
  templateHref,
  columns,
  maxRows,
  footnote,
  validateExtra,
  onProcess,
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [issues, setIssues] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  // Modal ditutup = mulai bersih saat dibuka lagi.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setRows([]);
      setIssues([]);
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  const buangFile = () => {
    setFile(null);
    setRows([]);
    setIssues([]);
    setResult(null);
  };

  const parse = async (f) => {
    try {
      const text = await f.text();
      const wb = XLSX.read(text, { type: 'string', raw: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map((row) => {
        const lower = {};
        Object.keys(row).forEach((k) => {
          lower[String(k).trim().toLowerCase()] = String(row[k] ?? '').trim();
        });
        return lower;
      });

      const found = [];
      if (parsed.length === 0) found.push('File tidak berisi baris data.');
      if (parsed.length > maxRows) {
        found.push(`Maksimal ${maxRows} baris — file ini berisi ${parsed.length} baris.`);
      }
      parsed.forEach((row, i) => {
        const baris = i + 2; // baris 1 = header
        if (!row.sku && !row.product) {
          found.push(`Baris ${baris}: kolom "product" atau "sku" wajib diisi.`);
        }
        const qty = Number(String(row.qty ?? '').replace(',', '.'));
        if (!row.qty || Number.isNaN(qty)) {
          found.push(`Baris ${baris}: qty "${row.qty || ''}" bukan angka.`);
        } else if (qty <= 0) {
          found.push(`Baris ${baris}: qty harus lebih besar dari 0.`);
        }
      });

      if (validateExtra) found.push(...validateExtra(parsed));

      setRows(parsed);
      setIssues(found);
    } catch (err) {
      console.error('[ImportCsvModal] parse csv preview error:', err);
      setRows([]);
      setIssues(['Gagal membaca file. Pastikan berformat CSV (UTF-8).']);
    }
  };

  const handleProcess = async () => {
    if (!file || processing || issues.length > 0 || rows.length === 0) return;
    setProcessing(true);
    setResult(null);
    try {
      const res = await onProcess(file);
      const dibuat = res?.createdCount || 0;
      setResult({ errors: res?.errors || [], createdCount: dibuat });
      setFile(null);
      setRows([]);
      setIssues([]);
      if (dibuat > 0) {
        onSuccess?.(res.document);
        onClose();
      }
    } catch (err) {
      console.error('[ImportCsvModal] import error:', err);
      setResult({
        errors: [err.response?.data?.error || 'Gagal mengimpor file CSV.'],
        createdCount: 0,
      });
    } finally {
      setProcessing(false);
    }
  };

  const pesanServer = result?.errors || [];
  const bermasalah = issues.length > 0 || pesanServer.length > 0;
  const belumSiap = processing || rows.length === 0 || issues.length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      {/* 860px, bukan 680px — kolom pratinjau terjepit di lebar lama. */}
      <div style={{ background: '#ffffff', borderRadius: '8px', width: '90%', maxWidth: '860px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 0, padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', gap: '24px' }}>
          <div style={{ width: '160px', display: 'flex', flexDirection: 'column' }}>
            <a
              href={templateHref}
              download
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: '#334155', fontWeight: 'bold', textDecoration: 'none', textAlign: 'center', cursor: 'pointer', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
            >
              Download Template
            </a>
          </div>

          <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid #e2e8f0', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
              Import dari CSV (max. {maxRows} baris)
            </span>

            {/* Satu kotak memuat file + status + pratinjau datanya sekaligus.
                overflow:hidden aman — tidak ada dropdown di dalam kotak. */}
            <div style={{ width: '100%', minHeight: '240px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxSizing: 'border-box' }}>
              {!file ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', padding: '16px' }}>
                  <CloudUpload size={32} style={{ color: '#94a3b8' }} />
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Pilih atau seret file ke sini</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const f = e.target.files[0] || null;
                      buangFile();
                      setFile(f);
                      if (f) parse(f);
                    }}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
                  />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                    <FileText size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>
                      {`${(file.size / 1024).toFixed(1)} KB`}
                    </span>
                    <button
                      type="button"
                      onClick={buangFile}
                      title="Buang file"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#f1f5f9', color: '#64748b', border: 0, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', flexShrink: 0, background: bermasalah ? '#fef2f2' : '#f0fdf4', borderBottom: `1px solid ${bermasalah ? '#fecaca' : '#bbf7d0'}`, color: bermasalah ? '#b91c1c' : '#15803d' }}>
                    {bermasalah ? <X size={15} style={{ flexShrink: 0 }} /> : <Check size={15} style={{ flexShrink: 0 }} />}
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      {bermasalah
                        ? `${issues.length + pesanServer.length} masalah — perbaiki dulu`
                        : `${rows.length} baris siap diimpor`}
                    </span>
                  </div>

                  {bermasalah && (
                    <div style={{ maxHeight: '84px', overflowY: 'auto', padding: '8px 12px', background: '#fff1f2', borderBottom: '1px solid #fecaca', flexShrink: 0 }}>
                      {[...issues, ...pesanServer].map((msg, i) => (
                        <div key={i} style={{ fontSize: '11px', color: '#b91c1c', lineHeight: '1.5' }}>• {msg}</div>
                      ))}
                    </div>
                  )}

                  {rows.length > 0 && (
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: '#ffffff' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', position: 'sticky', top: 0, background: '#f8fafc' }}>#</th>
                            {columns.map((col) => (
                              <th key={col.key} style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f8fafc' }}>
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '5px 8px', color: '#94a3b8' }}>{i + 1}</td>
                              {columns.map((col) => (
                                <td key={col.key} style={{ padding: '5px 8px', color: '#334155', whiteSpace: 'nowrap' }}>
                                  {row[col.key] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Aksi tepat di bawah kotak, mengikuti Olsera. flexShrink: 0 wajib —
                tanpa itu tombol tergencet saat nama file panjang. */}
            {file && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={buangFile}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', flexShrink: 0, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  Hapus
                </button>
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={belumSiap}
                  title={issues.length > 0 ? 'Perbaiki dulu masalah pada file CSV' : undefined}
                  style={{ background: belumSiap ? '#99f6e4' : '#0d9488', border: 0, borderRadius: '4px', padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', color: '#ffffff', cursor: belumSiap ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                >
                  {processing
                    ? 'Memproses...'
                    : rows.length > 0 && issues.length === 0
                      ? `Proses ${rows.length} baris`
                      : 'Proses'}
                </button>
              </div>
            )}

            {footnote && (
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{footnote}</div>
            )}

            {result && result.createdCount > 0 && (
              <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 'bold', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '8px 12px', marginTop: '8px' }}>
                {result.createdCount} baris berhasil ditambahkan!
              </div>
            )}
          </div>
        </div>

        {/* Aksi utama (Hapus/Proses) ada di bawah kotak, mengikuti Olsera —
            footer cukup untuk menutup modal. */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            onClick={onClose}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
