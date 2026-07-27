import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import apiClient from '../../../../api/apiClient';

export default function AvailabilityModal({ open, onClose, product, onSuccess }) {
  const [tersediaOnline, setTersediaOnline] = useState(true);
  const [tanggalTersediaOnline, setTanggalTersediaOnline] = useState('');
  const [tidakTersediaOfflinePos, setTidakTersediaOfflinePos] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && product) {
      setTersediaOnline(product.tersedia_online !== false);
      setTanggalTersediaOnline(product.tanggal_tersedia_online || new Date().toISOString().split('T')[0]);
      setTidakTersediaOfflinePos(!!product.tidak_tersedia_offline_pos);
    }
  }, [open, product]);

  if (!open || !product) return null;

  const handleSave = async () => {
    setLoading(false);
    try {
      setLoading(true);
      await apiClient.patch(`/products/${product.id}/`, {
        tersedia_online: tersediaOnline,
        tanggal_tersedia_online: tersediaOnline ? tanggalTersediaOnline : null,
        tidak_tersedia_offline_pos: tidakTersediaOfflinePos,
      });
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err) {
      console.error('[AvailabilityModal] Error saving availability:', err);
      alert('Gagal menyimpan ketersediaan produk.');
    } finally {
      setLoading(false);
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
          maxWidth: 500,
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
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Ketersediaan Produk
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              style={{
                border: 'none',
                backgroundColor: '#22c55e',
                color: '#ffffff',
                padding: '6px 16px',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section 1: Tersedia Online */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              id="tersedia_online"
              checked={tersediaOnline}
              onChange={(e) => setTersediaOnline(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label
                htmlFor="tersedia_online"
                style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
              >
                Tersedia Online
              </label>
              <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Produk ini tersedia di kanal Online seperti Toko Online dan Online Order
              </span>

              {tersediaOnline && (
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: 11, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                    Tanggal tersedia Online
                  </label>
                  <input
                    type="date"
                    value={tanggalTersediaOnline}
                    onChange={(e) => setTanggalTersediaOnline(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      outline: 'none',
                      width: 200,
                      color: '#334155'
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Tidak tersedia Offline */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
            <input
              type="checkbox"
              id="tidak_tersedia_offline"
              checked={tidakTersediaOfflinePos}
              onChange={(e) => setTidakTersediaOfflinePos(e.target.checked)}
              style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label
                htmlFor="tidak_tersedia_offline"
                style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', cursor: 'pointer' }}
              >
                Tidak tersedia Offline (di POS)
              </label>
              <span style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Produk ini tidak tersedia di kasir Point Of Sale toko Anda
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
