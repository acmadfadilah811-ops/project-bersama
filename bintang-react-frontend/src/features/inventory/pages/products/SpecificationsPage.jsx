import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import DataTable from '../components/DataTable';
import apiClient from '../../../../api/apiClient';

export function SpecificationsPage() {
  const [specifications, setSpecifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [namaSpesifikasi, setNamaSpesifikasi] = useState('');

  const fetchSpecifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/specifications/');
      setSpecifications(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[SpecificationsPage] fetch error:', err);
      setError('Gagal memuat daftar spesifikasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpecifications();
  }, []);

  const canSave = namaSpesifikasi.trim() && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await apiClient.post('/specifications/', { nama: namaSpesifikasi });
      setNamaSpesifikasi('');
      await fetchSpecifications();
    } catch (err) {
      console.error('[SpecificationsPage] save error:', err);
      setError('Gagal menyimpan spesifikasi.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSpecs = specifications.filter(spec =>
    spec.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
      <div className="pi-split-layout-reverse">
        {/* KIRI: Tambah Spesifikasi */}
        <div className="pi-category-card">
          <div className="pi-category-card-header" style={{ padding: '16px 20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Tambah Spesifikasi</h3>
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
            {/* Nama */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', paddingTop: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                  Nama <span style={{ color: '#ef4444' }}>*</span>
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.4' }}>Nama Spesifikasi Produk</span>
              </div>
              <div>
                <input 
                  type="text" 
                  className="pi-input-text w-full" 
                  value={namaSpesifikasi}
                  onChange={(e) => setNamaSpesifikasi(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* KANAN: Daftar Spesifikasi */}
        <div className="pi-category-card">
          <div className="pi-category-card-header" style={{ padding: '16px 20px' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>Daftar Spesifikasi</h3>
          </div>
          <div className="pi-category-card-body" style={{ padding: '20px' }}>
            {/* Search Bar */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input 
                type="text" 
                placeholder="Cari spesifikasi..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 10px 6px 30px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
            <DataTable
              rows={filteredSpecs}
              emptyText={loading ? 'Memuat...' : 'Tidak ada data'}
              columns={[
                { key: 'nama', label: 'Nama Spesifikasi' }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
