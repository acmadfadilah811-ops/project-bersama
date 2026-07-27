import { useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import { Button } from '../components/PageShell';

const stickyColStyle = {
  padding: 8,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  position: 'sticky',
  left: 0,
  background: '#ffffff',
  zIndex: 1,
};

const inputBorder = {
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
  boxSizing: 'border-box',
};

export function PriceInput({ value, placeholder, onChange, style }) {
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = () => {
    if (isFocused) {
      if (!value || value === 'Rp. 0,00' || value === '0') {
        return 'Rp. 0';
      }
      return value;
    } else {
      if (!value || value === 'Rp. 0' || value === '0') {
        return '';
      }
      return value;
    }
  };

  const handleChange = (e) => {
    let inputVal = e.target.value;
    let raw = inputVal.replace(/^Rp\.\s*/i, '').trim();
    let digits = raw.replace(/\D/g, '');
    let prevDigits = (value || '').replace(/\D/g, '');
    
    if ((prevDigits === '0' || prevDigits === '') && digits.length > 1) {
      if (digits.startsWith('0')) {
        digits = digits.substring(1);
      }
    }
    
    if (digits === '') {
      onChange('Rp. 0');
    } else {
      let formatted = 'Rp. ' + parseInt(digits, 10).toLocaleString('id-ID');
      onChange(formatted);
    }
  };

  return (
    <input
      type="text"
      placeholder={placeholder}
      value={displayValue()}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onChange={handleChange}
      style={{
        ...inputBorder,
        ...style
      }}
    />
  );
}

const RP_PLACEHOLDER = 'Rp. 0,00';

export default function VariantModal({
  open,
  onClose,
  variantTypes,
  onUpdateTypeName,
  onAddTypeValue,
  onRemoveTypeValue,
  onAddType,
  onRemoveType,
  variantRows,
  onUpdateRow,
  onRemoveRow,
  trackInventory,
  onTrackInventoryChange,
  storeName,
}) {
  const [addingIdx, setAddingIdx] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  if (!open) return null;

  const openAddSlot = (idx) => {
    setAddingIdx(idx);
    setDraftValue('');
  };
  const commitDraft = (idx, keepOpen = false) => {
    const trimmed = draftValue.trim();
    if (trimmed) onAddTypeValue(idx, trimmed);
    setDraftValue('');
    if (!keepOpen) setAddingIdx(null);
  };
  const cancelDraft = () => {
    setAddingIdx(null);
    setDraftValue('');
  };

  const colSpan = trackInventory ? 12 : 10;

  return (
    <div
      role="presentation"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15, 23, 42, 0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Varian Produk"
        style={{ background: '#ffffff', borderRadius: 12, width: 'min(1152px, 92vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(15,23,42,0.25)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Varian Produk</h2>
          <button type="button" className="pi-icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 8px 10px', textAlign: 'left', width: '22%', borderBottom: '1px solid #e2e8f0' }}>Tipe Varian</th>
                  <th style={{ padding: '8px 8px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Variant</th>
                  <th style={{ padding: '8px 8px 10px', width: 60, borderBottom: '1px solid #e2e8f0' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {variantTypes.map((t, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      <input
                        type="text"
                        placeholder="e.g. warna, material, ukuran, atau kombinasi"
                        value={t.name}
                        onChange={(e) => onUpdateTypeName(idx, e.target.value)}
                        style={{ ...inputBorder, width: '100%' }}
                      />
                    </td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                        {t.values.map((v) => (
                          <span
                            key={v}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              background: '#dbeafe', color: '#1d4ed8', borderRadius: 6,
                              padding: '4px 8px', fontSize: 12, fontWeight: 600,
                            }}
                          >
                            {v}
                            <X size={12} style={{ cursor: 'pointer' }} onClick={() => onRemoveTypeValue(idx, v)} />
                          </span>
                        ))}
                        {addingIdx === idx ? (
                          <input
                            type="text"
                            autoFocus
                            placeholder="Ketik nilai"
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitDraft(idx, true);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelDraft();
                              }
                            }}
                            onBlur={() => commitDraft(idx)}
                            style={{ ...inputBorder, width: 120 }}
                          />
                        ) : (
                          <button type="button" className="pi-btn pi-btn-secondary" style={{ minHeight: 32, padding: '0 12px' }} onClick={() => openAddSlot(idx)}>
                            <Plus size={13} /> Tambah Variant
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 8, textAlign: 'center', verticalAlign: 'top' }}>
                      {variantTypes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveType(idx)}
                          style={{
                            width: 32, height: 32, borderRadius: '50%', border: 0,
                            background: '#ef4444', color: '#fff', display: 'inline-flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="pi-btn-link" style={{ background: 'none', border: 0, color: '#2563eb', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: 0 }} onClick={onAddType}>
            <Plus size={14} /> Tipe Variant
          </button>

          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              margin: '18px 0', paddingBottom: 14, borderBottom: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: '#334155' }}>Lacak Inventori</span>
            <label className="pi-switch">
              <input type="checkbox" checked={trackInventory} onChange={(e) => onTrackInventoryChange(e.target.checked)} />
              <span className="pi-slider">
                <span className="pi-slider-text">{trackInventory ? 'Ya' : 'Tidak'}</span>
              </span>
            </label>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1300 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ padding: 10, textAlign: 'left', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 2 }}>Variant</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Alternatif</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Barcode</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>SKU</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Harga Beli</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Harga Pasar</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Harga Jual Online</th>
                  <th style={{ padding: 10, textAlign: 'left' }}>Harga Jual di Toko</th>
                  {trackInventory && (
                    <>
                      <th style={{ padding: 10, textAlign: 'left' }}>Qty Stok</th>
                      <th style={{ padding: 10, textAlign: 'left' }}>Rak</th>
                    </>
                  )}
                  <th style={{ padding: 10, textAlign: 'left' }}>Berat (gr)</th>
                  <th style={{ padding: 10, width: 50 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {variantRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>
                      No Data
                    </td>
                  </tr>
                ) : (
                  variantRows.map((row) => (
                    <tr key={row.label} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={stickyColStyle}>{row.label}</td>
                      <td style={{ padding: 8 }}>
                        <input type="text" placeholder="Alternatif" value={row.nama_alternatif} onChange={(e) => onUpdateRow(row.label, 'nama_alternatif', e.target.value)} style={{ ...inputBorder, width: 150 }} />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input type="text" placeholder="Barcode" value={row.barcode} onChange={(e) => onUpdateRow(row.label, 'barcode', e.target.value)} style={{ ...inputBorder, width: 140 }} />
                      </td>
                      <td style={{ padding: 8 }}>
                        <input type="text" placeholder="SKU" value={row.sku} onChange={(e) => onUpdateRow(row.label, 'sku', e.target.value)} style={{ ...inputBorder, width: 130 }} />
                      </td>
                      <td style={{ padding: 8 }}>
                        <PriceInput placeholder={RP_PLACEHOLDER} value={row.harga_beli} onChange={(val) => onUpdateRow(row.label, 'harga_beli', val)} style={{ width: 130 }} />
                      </td>
                      <td style={{ padding: 8 }}>
                        <PriceInput placeholder={RP_PLACEHOLDER} value={row.harga_pasar} onChange={(val) => onUpdateRow(row.label, 'harga_pasar', val)} style={{ width: 130 }} />
                      </td>
                      <td style={{ padding: 8 }}>
                        <PriceInput placeholder={RP_PLACEHOLDER} value={row.harga_jual_online} onChange={(val) => onUpdateRow(row.label, 'harga_jual_online', val)} style={{ width: 130 }} />
                      </td>
                      <td style={{ padding: 8 }}>
                        <PriceInput placeholder={RP_PLACEHOLDER} value={row.harga_jual_toko} onChange={(val) => onUpdateRow(row.label, 'harga_jual_toko', val)} style={{ width: 130 }} />
                      </td>
                      {trackInventory && (
                        <>
                          <td style={{ padding: 8 }}>
                            <input type="text" value={row.qty_stok} onChange={(e) => onUpdateRow(row.label, 'qty_stok', e.target.value)} style={{ ...inputBorder, width: 100 }} />
                          </td>
                          <td style={{ padding: 8 }}>
                            <input type="text" placeholder="Rak" value={row.rack} onChange={(e) => onUpdateRow(row.label, 'rack', e.target.value)} style={{ ...inputBorder, width: 120 }} />
                          </td>
                        </>
                      )}
                      <td style={{ padding: 8 }}>
                        <input type="text" value={row.berat} onChange={(e) => onUpdateRow(row.label, 'berat', e.target.value)} style={{ ...inputBorder, width: 90 }} />
                      </td>
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button type="button" className="pi-icon-button" onClick={() => onRemoveRow(row.label)} style={{ color: '#ef4444' }}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 22px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Simpan di:</span>
            <select className="pi-store-select" disabled>
              <option>{storeName}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" onClick={onClose}>Batal</Button>
            <Button variant="primary" onClick={onClose}>Konfirmasi</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
