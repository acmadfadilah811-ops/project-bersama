import { Search } from 'lucide-react';

/**
 * Modal "Terima dari Pembelian" — placeholder, fitur belum aktif.
 * Prop: open (bool), onClose (fn), searchPembelian (string), setSearchPembelian (fn)
 */
export function PembelianModal({ open, onClose, searchPembelian, setSearchPembelian }) {
  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#ffffff', borderRadius: '8px', width: '90%', maxWidth: '800px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Terima dari Pembelian</h3>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 0, padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}
          >
            Batal
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Cari No. Pembelian/Nama Supplier"
              value={searchPembelian}
              onChange={(e) => setSearchPembelian(e.target.value)}
              style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '10px 12px 10px 36px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>No. Pembelian</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Nama Supplier</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Jumlah</th>
                  <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Tgl. Beli</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                    No Data
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '13px' }}>
          <div style={{ color: '#64748b' }}>Total 0</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button disabled style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', background: '#ffffff', cursor: 'not-allowed', color: '#cbd5e1' }}>&lt;</button>
            <span style={{ background: '#3b82f6', color: '#ffffff', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</span>
            <button disabled style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', background: '#ffffff', cursor: 'not-allowed', color: '#cbd5e1' }}>&gt;</button>
            <span style={{ color: '#64748b', marginLeft: '8px' }}>
              Go to <input type="number" defaultValue="1" style={{ width: '40px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px', textAlign: 'center', fontSize: '12px' }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
