import { Calendar } from 'lucide-react';

/**
 * Form "Tambah Stok Masuk" — layar viewState === 'create'.
 * Props: tanggal, setTanggal, catatan, setCatatan,
 *        onBatal (fn), onLanjut (fn)
 */
export function StockInCreateForm({ tanggal, setTanggal, catatan, setCatatan, onBatal, onLanjut }) {
  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
      <div className="pi-category-card" style={{ maxWidth: '1200px', margin: '0 auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>Tambah Stok Masuk</span>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Tanggal */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Tanggal</label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} />
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '8px 12px 8px 38px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    color: '#334155',
                    height: '36px'
                  }}
                />
              </div>
            </div>

            {/* Catatan */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Catatan <span style={{ color: '#94a3b8', fontWeight: '400' }}>(opsional)</span></label>
              <input
                type="text"
                placeholder="Masukkan catatan"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#334155',
                  height: '36px'
                }}
              />
            </div>

          </div>

          {/* Actions Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
            <button
              onClick={onBatal}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#475569',
                cursor: 'pointer',
                height: '36px'
              }}
            >
              Batal
            </button>
            <button
              onClick={onLanjut}
              style={{
                background: '#0ea5e9',
                border: 0,
                borderRadius: '4px',
                padding: '8px 24px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#ffffff',
                cursor: 'pointer',
                height: '36px'
              }}
            >
              Lanjut tambah stok masuk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
