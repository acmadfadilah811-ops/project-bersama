import { useCallback, useEffect, useState } from 'react';
import { Button, PageHeader } from '../components/PageShell';
import apiClient from '../../../../api/apiClient';

const MODES = [
  { id: 'auto', label: 'Kurangi stok otomatis', desc: 'Stok berkurang otomatis setiap transaksi POS terjadi. (Default)' },
  { id: 'manual', label: 'Kurangi stok manual', desc: 'POS tidak mengubah stok. Stok hanya berubah lewat dokumen stok (masuk/keluar/opname).' },
  { id: 'off', label: 'Tanpa pelacakan stok', desc: 'POS tidak melacak stok sama sekali. Pemblokiran penjualan saat stok kosong juga dimatikan.' },
];

export function PosStockModePage() {
  const [mode, setMode] = useState('auto');
  const [awal, setAwal] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pesan, setPesan] = useState(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/business-settings/');
      const nilai = res.data?.pos_stock_mode || 'auto';
      setMode(nilai);
      setAwal(nilai);
    } catch (err) {
      console.error('[PosStockModePage] gagal memuat:', err);
      setPesan({ tipe: 'error', teks: 'Gagal memuat pengaturan mode stok.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const simpan = async () => {
    setSaving(true);
    setPesan(null);
    try {
      await apiClient.patch('/business-settings/', { pos_stock_mode: mode });
      setAwal(mode);
      setPesan({ tipe: 'ok', teks: 'Mode stok POS berhasil disimpan.' });
    } catch (err) {
      console.error('[PosStockModePage] gagal menyimpan:', err);
      setPesan({ tipe: 'error', teks: 'Gagal menyimpan mode stok POS.' });
    } finally {
      setSaving(false);
    }
  };

  const berubah = mode !== awal;

  return (
    <>
      <PageHeader
        title="Mode Stok POS"
        description="Atur bagaimana stok diperlakukan saat transaksi di Point of Sale (POS)."
        actions={
          <Button variant="success" onClick={simpan} disabled={saving || loading || !berubah}>
            {saving ? 'Menyimpan...' : berubah ? 'Simpan' : 'Tersimpan'}
          </Button>
        }
      />

      {pesan && (
        <div
          style={{
            margin: '8px 0 16px', padding: '12px 14px', borderRadius: 8, fontSize: 13,
            background: pesan.tipe === 'ok' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${pesan.tipe === 'ok' ? '#a7f3d0' : '#fecaca'}`,
            color: pesan.tipe === 'ok' ? '#065f46' : '#991b1b',
          }}
        >
          {pesan.teks}
        </div>
      )}

      {loading ? (
        <p className="pi-muted" style={{ padding: '12px 0' }}>Memuat pengaturan...</p>
      ) : (
        <>
          <div className="pi-settings-grid">
            {MODES.map((m) => (
              <label key={m.id} className="pi-checkbox-line">
                <input
                  type="radio"
                  name="pos-stock-mode"
                  value={m.id}
                  checked={mode === m.id}
                  onChange={() => setMode(m.id)}
                />
                <span>
                  <strong>{m.label}</strong>
                  <br />
                  <span className="pi-muted">{m.desc}</span>
                </span>
              </label>
            ))}
          </div>

          <div
            style={{
              marginTop: 20, padding: '14px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.6,
              background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>Catatan</strong>
            Pengaturan ini ditegakkan di server, jadi berlaku untuk semua perangkat kasir.
            Pada mode <strong>manual</strong> dan <strong>tanpa pelacakan</strong>, pembatalan
            transaksi (void) juga tidak akan mengembalikan stok — konsisten dengan penjualannya.
          </div>
        </>
      )}
    </>
  );
}
