import { useEffect, useState } from 'react';
import { Search, ChevronRight, Move, Trash2, X } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [namaBrand, setNamaBrand] = useState('');
  const [komisi, setKomisi] = useState('');

  // Modal State - Edit
  const [editingBrand, setEditingBrand] = useState(null);
  const [editNamaBrand, setEditNamaBrand] = useState('');
  const [editKomisiBrand, setEditKomisiBrand] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchBrands = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/brands/');
      setBrands(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[BrandsPage] fetch error:', err);
      setError('Gagal memuat daftar brand.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrands();
  }, []);

  const canSave = namaBrand.trim() && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await apiClient.post('/brands/', {
        nama: namaBrand,
        komisi_persen: parseFloat(komisi) || 0,
        is_active: true,
      });
      setNamaBrand('');
      setKomisi('');
      await fetchBrands();
    } catch (err) {
      console.error('[BrandsPage] save error:', err);
      setError('Gagal menyimpan brand.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEdit = (brand) => {
    setEditingBrand(brand);
    setEditNamaBrand(brand.nama || '');
    setEditKomisiBrand(String(brand.komisi_persen ?? 0));
    setShowEditModal(true);
  };

  const handleCloseEdit = () => {
    setEditingBrand(null);
    setEditNamaBrand('');
    setEditKomisiBrand('');
    setShowEditModal(false);
  };

  const handleUpdate = async () => {
    if (!editingBrand || !editNamaBrand.trim() || saving) return;
    setSaving(true);
    try {
      await apiClient.put(`/brands/${editingBrand.id}/`, {
        nama: editNamaBrand,
        komisi_persen: parseFloat(editKomisiBrand) || 0,
        is_active: editingBrand.is_active ?? true,
      });
      handleCloseEdit();
      await fetchBrands();
    } catch (err) {
      console.error('[BrandsPage] update error:', err);
      setError('Gagal memperbarui brand.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingBrand || saving) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus brand "${editingBrand.nama}"?`)) return;
    setSaving(true);
    try {
      await apiClient.delete(`/brands/${editingBrand.id}/`);
      handleCloseEdit();
      await fetchBrands();
    } catch (err) {
      console.error('[BrandsPage] delete error:', err);
      setError('Gagal menghapus brand.');
    } finally {
      setSaving(false);
    }
  };

  const filteredBrands = brands.filter(brand =>
    brand.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
      <div className="pi-split-layout-reverse">
        {/* KIRI: Tambah Brand */}
        <div className="pi-category-card">
          <div className="pi-category-card-header" style={{ padding: '16px 20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Tambah Brand</h3>
            <button
              type="button"
              disabled={!canSave}
              onClick={handleSave}
              style={{ background: canSave ? '#16a34a' : '#e2e8f0', color: canSave ? '#fff' : '#94a3b8', border: 0, borderRadius: '4px', padding: '6px 16px', fontSize: '12px', fontWeight: 'bold', cursor: canSave ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Menyimpan...' : '✓ Simpan'}
            </button>
          </div>
          <div className="pi-category-card-body" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Nama Brand */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', paddingTop: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                  Nama Brand <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.4' }}>Nama brand produk Anda</span>
              </div>
              <div>
                <input 
                  type="text" 
                  className="pi-input-text w-full" 
                  value={namaBrand}
                  onChange={(e) => setNamaBrand(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Komisi */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', paddingTop: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Komisi</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.4' }}>
                  Komisi untuk karyawan (Pelayan/Kasir) dari penjualan produk
                </span>
              </div>
              <div>
                <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', background: '#ffffff' }}>
                  <input 
                    type="text" 
                    placeholder="Cukup hanya masukkan a"
                    value={komisi}
                    onChange={(e) => setKomisi(e.target.value)}
                    style={{ border: 0, outline: 0, padding: '8px 12px', fontSize: '13px', flex: 1, width: '100%', color: '#334155' }}
                  />
                  <div style={{ background: '#f8fafc', borderLeft: '1px solid #cbd5e1', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                    %
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KANAN: Daftar Merek */}
        <div className="pi-category-card">
          <div className="pi-category-card-header" style={{ padding: '16px 20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Daftar Merek</h3>
          </div>
          <div className="pi-category-card-body" style={{ padding: '20px' }}>
            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Cari brand..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 10px 6px 30px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
            
            {/* Brand List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredBrands.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  {loading ? 'Memuat...' : 'Tidak ada data'}
                </div>
              ) : (
                filteredBrands.map((brand) => (
                  <div
                    key={brand.id}
                    onClick={() => handleOpenEdit(brand)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', cursor: 'grab' }}>
                        <Move size={16} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                          {brand.nama} {brand.products_count !== undefined ? `(${brand.products_count})` : ''}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Komisi {brand.komisi_persen}%
                        </span>
                      </div>
                    </div>
                    <div style={{ color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                      <ChevronRight size={16} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Edit Brand */}
      {showEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.3)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '480px',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Edit</span>
              <button 
                type="button" 
                onClick={handleCloseEdit}
                style={{ background: 'none', border: 0, color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Nama */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nama</label>
                <input 
                  type="text" 
                  className="pi-input-text w-full"
                  value={editNamaBrand}
                  onChange={(e) => setEditNamaBrand(e.target.value)}
                />
              </div>

              {/* Komisi */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Komisi</label>
                <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', background: '#ffffff' }}>
                  <input 
                    type="number" 
                    value={editKomisiBrand}
                    onChange={(e) => setEditKomisiBrand(e.target.value)}
                    style={{ border: 0, outline: 0, padding: '8px 12px', fontSize: '13px', flex: 1, width: '100%', color: '#334155' }}
                  />
                  <div style={{ background: '#f8fafc', borderLeft: '1px solid #cbd5e1', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                    %
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc'
            }}>
              {/* Delete Button */}
              <button 
                type="button" 
                onClick={handleDelete}
                style={{
                  background: '#fff',
                  border: '1px solid #fee2e2',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fef2f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                <Trash2 size={16} />
              </button>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={handleCloseEdit}
                  style={{
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#64748b',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  onClick={handleUpdate}
                  disabled={!editNamaBrand.trim() || saving}
                  style={{
                    background: '#0284c7',
                    border: 0,
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#ffffff',
                    cursor: (!editNamaBrand.trim() || saving) ? 'not-allowed' : 'pointer',
                    opacity: (!editNamaBrand.trim() || saving) ? 0.7 : 1
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
