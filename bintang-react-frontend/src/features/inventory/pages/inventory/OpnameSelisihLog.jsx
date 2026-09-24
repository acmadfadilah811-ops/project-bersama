import { useEffect, useState } from 'react';
import apiClient from '../../../../api/apiClient';

const rp = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);

const qty = (value) => {
  const n = Number(value) || 0;
  return n > 0 ? `+${n}` : String(n);
};

const kotak = { background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' };
const kepala = { padding: '14px 20px', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 'bold', color: '#1e293b' };
const sel = { padding: '10px 16px', fontSize: '13px', borderBottom: '1px solid #f1f5f9' };
const warna = (n) => (n === 0 ? '#475569' : n > 0 ? '#16a34a' : '#dc2626');

const formatWaktu = (iso) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

/**
 * Ringkasan selisih per produk memakai HARGA BELI (2026-09-24). Angka datang dari
 * server (`ringkasan_selisih`): produk di beberapa rak sudah dijumlah, dan setelah
 * dokumen diposting harga belinya adalah snapshot saat posting.
 */
export function OpnameRingkasanSelisih({ doc }) {
  const ring = doc.ringkasan_selisih || { baris: [], total_surplus: 0, total_defisit: 0, total_selisih: 0 };
  const posted = doc.status === 'selesai';
  const dijurnalBeda = posted && (
    Math.round(Number(doc.nilai_jurnal_surplus)) !== Math.round(Number(doc.nilai_surplus))
    || Math.round(Number(doc.nilai_jurnal_defisit)) !== Math.round(Number(doc.nilai_defisit))
  );
  const barisSelisih = (ring.baris || []).filter((b) => Number(b.selisih) !== 0);

  return (
    <div style={kotak}>
      <div style={kepala}>Ringkasan Selisih (harga beli)</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
        {[
          ['Selisih Lebih', ring.total_surplus, '#16a34a'],
          ['Selisih Kurang', ring.total_defisit, '#dc2626'],
          ['Selisih Bersih', ring.total_selisih, warna(Number(ring.total_selisih))],
        ].map(([label, nilai, color]) => (
          <div key={label} style={{ flex: '1 1 160px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color }}>{rp(nilai)}</div>
          </div>
        ))}
      </div>

      {barisSelisih.length === 0 ? (
        <div style={{ ...sel, color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Tidak ada selisih stok.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', fontSize: '12px', color: '#475569' }}>
                {['Produk', 'Qty Sistem', 'Qty Aktual', 'Selisih', 'Harga Beli', 'Nilai Selisih'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontWeight: 'bold' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {barisSelisih.map((b) => (
                <tr key={`${b.product}-${b.variant || 0}`}>
                  <td style={sel}>{b.nama}</td>
                  <td style={sel}>{Number(b.stok_sistem)}</td>
                  <td style={sel}>{Number(b.stok_aktual)}</td>
                  <td style={{ ...sel, fontWeight: 'bold', color: warna(Number(b.selisih)) }}>{qty(b.selisih)}</td>
                  <td style={sel}>{rp(b.harga_beli)}</td>
                  <td style={{ ...sel, fontWeight: 'bold', color: warna(Number(b.nilai_selisih)) }}>{rp(b.nilai_selisih)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ padding: '12px 20px', fontSize: '12px', color: '#64748b', display: 'grid', gap: '4px' }}>
        <div>Diinput oleh <b>{doc.dibuat_oleh_nama || '-'}</b></div>
        {posted && (
          <>
            <div>Diposting oleh <b>{doc.diposting_oleh_nama || '-'}</b> pada {formatWaktu(doc.waktu_diposting)}</div>
            <div>
              Dijurnal ke Persediaan/Penyesuaian Barang: lebih {rp(doc.nilai_jurnal_surplus)}, kurang {rp(doc.nilai_jurnal_defisit)}
              {dijurnalBeda && ' (memakai biaya lapisan FIFO, berbeda dari harga beli rata-rata di atas)'}
            </div>
          </>
        )}
        {!posted && doc.status === 'draft' && <div>Belum diposting; jurnal dibuat saat dokumen diposting.</div>}
      </div>
    </div>
  );
}

/** Riwayat siapa mengerjakan apa pada dokumen opname. `refreshKey` memicu muat ulang. */
export function OpnameRiwayat({ docId, refreshKey }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let batal = false;
    apiClient.get(`/stock-opname-documents/${docId}/logs/`)
      .then((res) => { if (!batal) setLogs(res.data || []); })
      .catch(() => { if (!batal) setLogs([]); });
    return () => { batal = true; };
  }, [docId, refreshKey]);

  return (
    <div style={kotak}>
      <div style={kepala}>Riwayat Dokumen</div>
      {logs.length === 0 ? (
        <div style={{ ...sel, color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Belum ada riwayat.</div>
      ) : (
        logs.map((log) => (
          <div key={log.id} style={{ ...sel, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', minWidth: '150px' }}>{formatWaktu(log.waktu)}</span>
            <span style={{ fontWeight: 'bold', color: '#334155', minWidth: '90px' }}>{log.user_nama}</span>
            <span style={{ color: '#475569', flex: 1 }}>{log.keterangan}</span>
          </div>
        ))
      )}
    </div>
  );
}
