import { useState } from 'react';
import { Plus, Trash2, Search, X, AlertCircle, Barcode, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export default function ProductSeriTab({ product, onUpdated, storeName }) {
  // Serial numbers are stored in product.serial_numbers as an array of objects
  const serials = Array.isArray(product.serial_numbers) ? product.serial_numbers : [];

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formVariant, setFormVariant] = useState('');
  const [formNoSeri, setFormNoSeri] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Filter serials by search query
  const filteredSerials = serials.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    const noSeriMatch = (item.no_seri || '').toLowerCase().includes(query);
    const variantMatch = (item.variant || '').toLowerCase().includes(query);
    const noPesananMatch = (item.no_pesanan || '').toLowerCase().includes(query);
    return noSeriMatch || variantMatch || noPesananMatch;
  });

  // Pagination calculations
  const totalRowsCount = filteredSerials.length;
  const totalPages = Math.ceil(totalRowsCount / rowsPerPage) || 1;
  const paginatedSerials = filteredSerials.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Get list of variants for dropdown
  const variantOptions = product.variants && product.variants.length > 0
    ? ['All', ...product.variants.map(v => v.nama_varian)]
    : ['All'];

  const handleOpenAdd = () => {
    setFormVariant(variantOptions[0] || 'All');
    setFormNoSeri('');
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formNoSeri.trim()) {
      setFormError('Nomor seri wajib diisi.');
      return;
    }

    // Check for duplicates in current list
    const isDuplicate = serials.some(
      s => s.no_seri.trim().toLowerCase() === formNoSeri.trim().toLowerCase()
    );
    if (isDuplicate) {
      setFormError('Nomor seri sudah terdaftar.');
      return;
    }

    setSaving(true);
    setFormError(null);

    const newSerial = {
      id: 'seri-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      variant: formVariant,
      no_seri: formNoSeri.trim(),
      no_pesanan: '', // default empty order
      terdaftar: true // default registered status (renders as "Ya")
    };

    const updatedSerials = [...serials, newSerial];

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        serial_numbers: updatedSerials
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
      setIsAddOpen(false);
    } catch (err) {
      console.error('[SeriTab] Error saving serial number:', err);
      setFormError('Gagal menyimpan nomor seri ke server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serialId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus nomor seri ini?')) {
      return;
    }

    const updatedSerials = serials.filter(s => s.id !== serialId);

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        serial_numbers: updatedSerials
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
    } catch (err) {
      console.error('[SeriTab] Error deleting serial number:', err);
      alert('Gagal menghapus nomor seri.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Daftar Serial</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            {serials.length} Seri
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Search bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 220 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Cari nomor seri..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
                transition: 'border-color 0.15s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#026da7'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: 10, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={handleOpenAdd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#026da7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={14} /> Tambah
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {/* Rows per page selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
            <span>Tampilkan</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                outline: 'none'
              }}
            >
              <option value={5}>5 Baris</option>
              <option value={10}>10 Baris</option>
              <option value={20}>20 Baris</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {totalRowsCount === 0 ? (
          /* Empty state - styled static without polar bear animation */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                backgroundColor: '#f0f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  backgroundColor: '#e0f2fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Barcode size={44} style={{ color: '#0284c7' }} />
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>Tidak ada serial</div>
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px 18px' }}>No. Seri</th>
                  <th style={{ padding: '12px 18px' }}>Variant</th>
                  <th style={{ padding: '12px 18px' }}>No. Pesanan</th>
                  <th style={{ padding: '12px 18px' }}>Terdaftar</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSerials.map((item) => (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      color: '#334155',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>
                      {item.no_seri}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748b' }}>
                      {item.variant === 'All' ? 'Semua Varian' : item.variant}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748b' }}>
                      {item.no_pesanan || '-'}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#334155' }}>
                      {item.terdaftar === false ? 'Tidak' : 'Ya'}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: 6,
                          borderRadius: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 18px', gap: 8, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                backgroundColor: '#fff',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 6,
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                backgroundColor: '#fff',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              <ChevronRight size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b', marginLeft: 8 }}>
              <span>Go to</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 1 && val <= totalPages) {
                    setCurrentPage(val);
                  }
                }}
                style={{
                  width: 45,
                  padding: '4px 6px',
                  border: '1px solid #cbd5e1',
                  borderRadius: 4,
                  textAlign: 'center',
                  outline: 'none',
                  fontSize: 12,
                  fontWeight: 600
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: TAMBAH SERIAL ================= */}
      {isAddOpen && (
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
            zIndex: 1000
          }}
        >
          <form
            onSubmit={handleSave}
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              margin: 16
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>
                Tambah Serial
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {formError && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#b91c1c', fontSize: 13 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Variant selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Variant</label>
                <select
                  value={formVariant}
                  onChange={(e) => setFormVariant(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none',
                    backgroundColor: '#fff'
                  }}
                >
                  {variantOptions.map(opt => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'All' : opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* No. Seri input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>No. Seri</label>
                <input
                  type="text"
                  placeholder="Masukkan angka contoh: 1234"
                  value={formNoSeri}
                  onChange={(e) => setFormNoSeri(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none',
                    transition: 'border-color 0.15s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#026da7'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#026da7',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                {saving ? 'Menyimpan...' : 'Tambah'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
