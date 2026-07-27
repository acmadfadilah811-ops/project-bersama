import { useState, useEffect } from 'react';
import { Plus, Trash2, X, AlertCircle, Sliders, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export default function ProductSpesifikasiTab({ product, onUpdated, storeName }) {
  // Specifications values are passed in product.specifications as an array of objects
  const productSpecs = Array.isArray(product.specifications) ? product.specifications : [];

  // Local state
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Specifications types fetched from backend
  const [globalSpecs, setGlobalSpecs] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(false);

  // Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState('');
  const [formValue, setFormValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Fetch available specifications on mount
  useEffect(() => {
    fetchGlobalSpecifications();
  }, []);

  const fetchGlobalSpecifications = async () => {
    setLoadingSpecs(true);
    try {
      const res = await apiClient.get('/specifications/');
      const data = res.data.results || res.data || [];
      
      // If empty, seed standard options to make the app instantly usable
      if (data.length === 0) {
        const defaultNames = ['Ukuran', 'Warna', 'Bahan', 'Gramasi', 'Dimensi'];
        const seeded = [];
        for (const name of defaultNames) {
          try {
            const seedRes = await apiClient.post('/specifications/', { nama: name });
            seeded.push(seedRes.data);
          } catch (e) {
            console.error('Error seeding specification:', name, e);
          }
        }
        setGlobalSpecs(seeded);
      } else {
        setGlobalSpecs(data);
      }
    } catch (err) {
      console.error('[SpesifikasiTab] Error fetching global specifications:', err);
    } finally {
      setLoadingSpecs(false);
    }
  };

  // Pagination calculations
  const totalRowsCount = productSpecs.length;
  const totalPages = Math.ceil(totalRowsCount / rowsPerPage) || 1;
  const paginatedSpecs = productSpecs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleOpenAdd = () => {
    setSelectedSpecId('');
    setFormValue('');
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedSpecId) {
      setFormError('Silakan pilih tipe spesifikasi.');
      return;
    }
    if (!formValue.trim()) {
      setFormError('Nilai spesifikasi wajib diisi.');
      return;
    }

    // Check if this specification type is already added for this product
    const isDuplicate = productSpecs.some(
      s => s.specification === parseInt(selectedSpecId, 10)
    );
    if (isDuplicate) {
      setFormError('Tipe spesifikasi ini sudah ditambahkan.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      await apiClient.post('/product-spec-values/', {
        product: product.id,
        specification: parseInt(selectedSpecId, 10),
        value: formValue.trim()
      });

      // Refetch product data to refresh view
      const freshProduct = await apiClient.get(`/products/${product.id}/`);
      if (onUpdated) {
        onUpdated(freshProduct.data);
      }
      setIsAddOpen(false);
    } catch (err) {
      console.error('[SpesifikasiTab] Error saving product specification value:', err);
      setFormError('Gagal menyimpan spesifikasi ke server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (specValueId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus spesifikasi ini?')) {
      return;
    }

    try {
      await apiClient.delete(`/product-spec-values/${specValueId}/`);
      // Refetch product data to refresh view
      const freshProduct = await apiClient.get(`/products/${product.id}/`);
      if (onUpdated) {
        onUpdated(freshProduct.data);
      }
    } catch (err) {
      console.error('[SpesifikasiTab] Error deleting specification:', err);
      alert('Gagal menghapus spesifikasi.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Daftar Spesifikasi Produk</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            {productSpecs.length} Spesifikasi Produk
          </p>
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
                <Sliders size={44} style={{ color: '#0284c7' }} />
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>Tidak ada spesifikasi</div>
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px 18px' }}>Tipe Spesifikasi</th>
                  <th style={{ padding: '12px 18px' }}>Nilai Spesifikasi</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSpecs.map((item) => (
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
                      {item.specification_nama}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#475569' }}>
                      {item.value}
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

      {/* ================= MODAL: TAMBAH SPESIFIKASI ================= */}
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
                Tambah Spesifikasi
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

              {/* Tipe Spesifikasi Selection */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Tipe Spesifikasi</label>
                <select
                  value={selectedSpecId}
                  onChange={(e) => setSelectedSpecId(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none',
                    backgroundColor: '#fff'
                  }}
                >
                  <option value="">Pilih salah satu</option>
                  {globalSpecs.map(spec => (
                    <option key={spec.id} value={spec.id}>
                      {spec.nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nilai Spesifikasi input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Nilai Spesifikasi</label>
                <input
                  type="text"
                  placeholder="Masukkan angka contoh: 1234"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
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
