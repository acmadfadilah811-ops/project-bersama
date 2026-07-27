import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export default function ProductLogModal({ open, onClose, product }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && product) {
      fetchLogs();
    }
  }, [open, product]);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/products/${product.id}/activity-log/`);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[ProductLogModal] Error fetching logs:', err);
      setError('Gagal memuat log produk.');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !product) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const date = String(d.getDate()).padStart(2, '0');
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${date}-${month}-${year} ${hours}:${minutes}`;
    } catch (e) {
      return dateStr;
    }
  };

  return createPortal(
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
          maxWidth: 650,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 16,
          maxHeight: '80vh',
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
          <h3 style={{ fontSize: 15.5, fontWeight: 600, color: '#0f172a', margin: 0, textAlign: 'center', flex: 1 }}>
            Product log
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
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

        {/* Body / Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 13.5 }}>
              Memuat data log...
            </div>
          ) : error ? (
            <div style={{ color: '#ef4444', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '80px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>No Data</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: '#475569', width: '30%' }}>Tanggal</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: '#475569', width: '25%' }}>Diproses Oleh</th>
                  <th style={{ padding: '12px 18px', fontWeight: 600, color: '#475569', width: '45%' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 18px', color: '#334155' }}>{formatDate(log.tanggal)}</td>
                    <td style={{ padding: '12px 18px', color: '#334155', fontWeight: 500 }}>{log.user}</td>
                    <td style={{ padding: '12px 18px', color: '#334155', lineHeight: 1.4 }}>{log.aksi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
