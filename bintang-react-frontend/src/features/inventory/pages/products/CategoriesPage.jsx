import { useEffect, useState } from 'react';
import { Plus, Search, ChevronRight, GripVertical, Trash2, X, UploadCloud } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State - Create
  const [namaGrup, setNamaGrup] = useState('');
  const [klasifikasi, setKlasifikasi] = useState('');
  const [nonAktifkan, setNonAktifkan] = useState(false);
  const [tidakMunculPos, setTidakMunculPos] = useState(false);
  const [tidakMunculNavWeb, setTidakMunculNavWeb] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  // Modal State - Edit
  const [editingCategory, setEditingCategory] = useState(null);
  const [editNama, setEditNama] = useState('');
  const [editKlasifikasi, setEditKlasifikasi] = useState('');
  const [editNonAktifkan, setEditNonAktifkan] = useState(false);
  const [editTidakPos, setEditTidakPos] = useState(false);
  const [editTidakNavWeb, setEditTidakNavWeb] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [isChangingKlasifikasi, setIsChangingKlasifikasi] = useState(false);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleEditPhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditPhotoFile(file);
    setEditPhotoPreview(URL.createObjectURL(file));
  };

  const fetchCategories = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/product-categories/');
      setCategories(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[CategoriesPage] fetch error:', err);
      setError('Gagal memuat daftar kategori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSave = async () => {
    if (!namaGrup.trim() || !klasifikasi || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('nama', namaGrup);
      fd.append('klasifikasi', klasifikasi);
      fd.append('is_active', String(!nonAktifkan));
      fd.append('tampil_pos', String(!tidakMunculPos));
      fd.append('tampil_nav_web', String(!tidakMunculNavWeb));
      if (selectedPhoto) fd.append('foto', selectedPhoto);

      await apiClient.post('/product-categories/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNamaGrup('');
      setKlasifikasi('');
      setNonAktifkan(false);
      setTidakMunculPos(false);
      setTidakMunculNavWeb(false);
      setSelectedPhoto(null);
      setPhotoPreviewUrl(null);
      await fetchCategories();
    } catch (err) {
      console.error('[CategoriesPage] save error:', err);
      setError('Gagal menyimpan kategori.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setEditNama(cat.nama || '');
    setEditKlasifikasi(cat.klasifikasi || '');
    setEditNonAktifkan(!cat.is_active);
    setEditTidakPos(!cat.tampil_pos);
    setEditTidakNavWeb(!cat.tampil_nav_web);
    setEditPhotoFile(null);
    setEditPhotoPreview(cat.foto || null);
    setIsChangingKlasifikasi(false);
  };

  const handleUpdate = async () => {
    if (!editNama.trim() || !editKlasifikasi || saving) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('nama', editNama);
      fd.append('klasifikasi', editKlasifikasi);
      fd.append('is_active', String(!editNonAktifkan));
      fd.append('tampil_pos', String(!editTidakPos));
      fd.append('tampil_nav_web', String(!editTidakNavWeb));
      if (editPhotoFile) {
        fd.append('foto', editPhotoFile);
      }

      await apiClient.put(`/product-categories/${editingCategory.id}/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setEditingCategory(null);
      await fetchCategories();
    } catch (err) {
      console.error('[CategoriesPage] update error:', err);
      setError('Gagal memperbarui kategori.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus kategori "${editingCategory.nama}"?`)) return;
    setSaving(true);
    try {
      await apiClient.delete(`/product-categories/${editingCategory.id}/`);
      setEditingCategory(null);
      await fetchCategories();
    } catch (err) {
      console.error('[CategoriesPage] delete error:', err);
      setError('Gagal menghapus kategori.');
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canSave = namaGrup.trim() && klasifikasi && !saving;

  const renderPhotoUploadField = (previewUrl, onChangeHandler) => {
    return (
      <label 
        className="photo-upload-placeholder"
        style={{
          cursor: 'pointer',
          width: '120px',
          height: '120px',
          borderRadius: '8px',
          border: '2px dashed #cbd5e1',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#64748b',
          overflow: 'hidden',
          position: 'relative',
          transition: 'border-color 0.15s, background-color 0.15s'
        }}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <>
            <UploadCloud size={28} style={{ color: '#94a3b8' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textAlign: 'center', padding: '0 8px' }}>
              Upload Image
            </span>
          </>
        )}
        <input type="file" accept="image/*" onChange={onChangeHandler} style={{ display: 'none' }} />
      </label>
    );
  };

  return (
    <div className="pi-category-layout">
      <style>{`
        .pi-category-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
        }
        @media (max-width: 1024px) {
          .pi-category-layout {
            grid-template-columns: 1fr;
          }
        }
        .pi-category-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
          overflow: hidden;
        }
        .pi-category-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
        }
        .pi-category-card-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
        }
        .pi-category-card-body {
          padding: 20px;
        }

        /* Category list item card styling */
        .category-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          padding: 12px 16px;
          margin-bottom: 10px;
          transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
          cursor: pointer;
        }
        .category-item-row:hover {
          border-color: #cbd5e1;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        }
        .category-item-row:active {
          transform: scale(0.99);
        }
        .category-item-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .category-drag-handle {
          color: #94a3b8;
          display: flex;
          align-items: center;
          cursor: grab;
        }
        .category-item-name {
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
        }
        .category-item-count {
          color: #64748b;
          font-size: 13px;
          margin-left: 4px;
        }
        
        .photo-upload-placeholder:hover {
          border-color: #0284c7 !important;
          background-color: #f0f9ff !important;
        }

        /* Switch Styles matching Olsera */
        .pi-switch-container {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
        }
        .pi-switch-label {
          color: #94a3b8;
          text-transform: uppercase;
          transition: color 0.15s;
        }
        .pi-switch-label.active {
          color: #0284c7;
        }
        .pi-simple-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 22px;
        }
        .pi-simple-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .pi-simple-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: .2s;
          border-radius: 22px;
        }
        .pi-simple-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        input:checked + .pi-simple-slider {
          background-color: #0284c7;
        }
        input:checked + .pi-simple-slider:before {
          transform: translateX(22px);
        }

        /* Edit Modal Layout */
        .edit-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .edit-modal-container {
          background: #fff;
          border-radius: 16px;
          width: 100%;
          max-width: 460px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }
        .edit-modal-header {
          padding: 16px 24px;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .edit-modal-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
        .edit-modal-close-btn {
          background: none;
          border: 0;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.15s, color 0.15s;
        }
        .edit-modal-close-btn:hover {
          background-color: #f1f5f9;
          color: #475569;
        }
        .edit-modal-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .edit-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #f1f5f9;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
        }
      `}</style>

      {/* KIRI: Tambah Group/Kategori */}
      <div className="pi-category-card">
        <div className="pi-category-card-header">
          <h3>Tambah Group/Kategori</h3>
          <button
            type="button"
            className="pi-btn"
            disabled={!canSave}
            onClick={handleSave}
            style={{
              background: canSave ? '#16a34a' : '#e2e8f0',
              color: canSave ? '#fff' : '#94a3b8',
              border: '0',
              cursor: canSave ? 'pointer' : 'not-allowed',
              padding: '6px 16px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'background-color 0.15s'
            }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
        <div className="pi-category-card-body">
          <div className="pi-form-rows" style={{ gap: '20px' }}>
            {/* Nama Grup */}
            <div className="pi-create-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Nama Grup <span style={{ color: '#ef4444' }}>*</span></span>
                <span className="pi-row-desc">Grup/kategori produk Anda, untuk memudahkan pelanggan mencari produk anda</span>
              </div>
              <div className="pi-row-input">
                <input 
                  type="text" 
                  className="pi-input-text w-full" 
                  placeholder="Masukkan" 
                  value={namaGrup} 
                  onChange={(e) => setNamaGrup(e.target.value)} 
                />
              </div>
            </div>

            {/* Klasifikasi */}
            <div className="pi-create-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Klasifikasi <span style={{ color: '#ef4444' }}>*</span></span>
                <span className="pi-row-desc">Memilih klasifikasi produk yang benar akan memudahkan pelanggan mencari produk Anda</span>
              </div>
              <div className="pi-row-input">
                <select 
                  className="pi-store-select" 
                  style={{ width: '100%' }}
                  value={klasifikasi}
                  onChange={(e) => setKlasifikasi(e.target.value)}
                >
                  <option value="">Pilih salah satu</option>
                  <option value="Jasa Cetak / Printing">Jasa Cetak / Printing</option>
                  <option value="Advertising & Banner">Advertising & Banner</option>
                  <option value="Merchandise / Souvenir">Merchandise / Souvenir</option>
                </select>
              </div>
            </div>

            {/* Product Group Photo */}
            <div className="pi-create-row" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Product Group Photo <span style={{ color: '#ef4444' }}>*</span></span>
              </div>
              <div className="pi-row-input">
                {renderPhotoUploadField(photoPreviewUrl, handlePhotoChange)}
              </div>
            </div>

            {/* Non Aktifkan */}
            <div className="pi-create-row" style={{ paddingBottom: '12px' }}>
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Non Aktifkan</span>
                <span className="pi-row-desc">Item yang dinon-aktifkan tidak akan muncul di website Anda</span>
              </div>
              <div className="pi-row-input">
                <div className="pi-switch-container">
                  <span className={`pi-switch-label ${!nonAktifkan ? 'active' : ''}`}>no</span>
                  <label className="pi-simple-switch">
                    <input 
                      type="checkbox" 
                      checked={nonAktifkan} 
                      onChange={(e) => setNonAktifkan(e.target.checked)} 
                    />
                    <span className="pi-simple-slider"></span>
                  </label>
                  <span className={`pi-switch-label ${nonAktifkan ? 'active' : ''}`}>yes</span>
                </div>
              </div>
            </div>

            {/* Tidak muncul di Point Of Sale */}
            <div className="pi-create-row" style={{ paddingBottom: '12px' }}>
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Tidak muncul di Point Of Sale</span>
              </div>
              <div className="pi-row-input">
                <div className="pi-switch-container">
                  <span className={`pi-switch-label ${!tidakMunculPos ? 'active' : ''}`}>no</span>
                  <label className="pi-simple-switch">
                    <input 
                      type="checkbox" 
                      checked={tidakMunculPos} 
                      onChange={(e) => setTidakMunculPos(e.target.checked)} 
                    />
                    <span className="pi-simple-slider"></span>
                  </label>
                  <span className={`pi-switch-label ${tidakMunculPos ? 'active' : ''}`}>yes</span>
                </div>
              </div>
            </div>

            {/* Submenu tidak muncul di Menu/Navigasi website */}
            <div className="pi-create-row">
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Submenu tidak muncul di Menu/Navigasi website</span>
              </div>
              <div className="pi-row-input">
                <div className="pi-switch-container">
                  <span className={`pi-switch-label ${!tidakMunculNavWeb ? 'active' : ''}`}>no</span>
                  <label className="pi-simple-switch">
                    <input 
                      type="checkbox" 
                      checked={tidakMunculNavWeb} 
                      onChange={(e) => setTidakMunculNavWeb(e.target.checked)} 
                    />
                    <span className="pi-simple-slider"></span>
                  </label>
                  <span className={`pi-switch-label ${tidakMunculNavWeb ? 'active' : ''}`}>yes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KANAN: Daftar Grup */}
      <div className="pi-category-card">
        <div className="pi-category-card-header">
          <h3>Daftar Grup</h3>
        </div>
        <div className="pi-category-card-body" style={{ padding: '16px' }}>
          <div className="pi-search-container" style={{ position: 'relative', marginBottom: '16px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              className="pi-input-text w-full" 
              placeholder="Cari Kategori" 
              style={{ width: '100%', paddingLeft: '36px', boxSizing: 'border-box' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>{error}</p>}
          
          <div style={{ marginTop: '12px' }}>
            {loading && <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Memuat...</p>}
            {!loading && filteredCategories.length === 0 && (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Tidak ada data</p>
            )}
            {!loading && filteredCategories.map((cat) => (
              <div 
                key={cat.id} 
                className="category-item-row"
                onClick={() => openEditModal(cat)}
              >
                <div className="category-item-left">
                  <div className="category-drag-handle">
                    <GripVertical size={16} />
                  </div>
                  <span className="category-item-name">
                    {cat.nama} <span className="category-item-count">({cat.products_count || 0})</span>
                  </span>
                </div>
                <div className="category-item-right">
                  <ChevronRight size={18} style={{ color: '#0284c7' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EDIT MODAL POPUP */}
      {editingCategory && (
        <div className="edit-modal-backdrop" onClick={() => setEditingCategory(null)}>
          <div className="edit-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>Edit</h3>
              <button type="button" className="edit-modal-close-btn" onClick={() => setEditingCategory(null)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="edit-modal-body">
              {/* Product Group Image */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Product Group Image</div>
                {renderPhotoUploadField(editPhotoPreview, handleEditPhotoChange)}
              </div>

              {/* Nama Input */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Nama</label>
                <input 
                  type="text" 
                  className="pi-input-text w-full"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={editNama} 
                  onChange={(e) => setEditNama(e.target.value)} 
                />
              </div>

              {/* Klasifikasi */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
                  <span>Klasifikasi:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{editKlasifikasi || 'Others'}</span>
                  <button 
                    type="button" 
                    onClick={() => setIsChangingKlasifikasi(!isChangingKlasifikasi)}
                    style={{ background: 'none', border: 0, color: '#0284c7', fontWeight: 600, cursor: 'pointer', fontSize: 13, padding: 0 }}
                  >
                    Ubah
                  </button>
                </div>
                {isChangingKlasifikasi && (
                  <select 
                    value={editKlasifikasi} 
                    onChange={(e) => { setEditKlasifikasi(e.target.value); setIsChangingKlasifikasi(false); }}
                    style={{ marginTop: 6, width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                  >
                    <option value="Others">Others</option>
                    <option value="Jasa Cetak / Printing">Jasa Cetak / Printing</option>
                    <option value="Advertising & Banner">Advertising & Banner</option>
                    <option value="Merchandise / Souvenir">Merchandise / Souvenir</option>
                  </select>
                )}
              </div>

              {/* Switches */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                {/* Non Aktifkan */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>Non Aktifkan</span>
                  <div className="pi-switch-container">
                    <span className={`pi-switch-label ${!editNonAktifkan ? 'active' : ''}`}>no</span>
                    <label className="pi-simple-switch">
                      <input 
                        type="checkbox" 
                        checked={editNonAktifkan} 
                        onChange={(e) => setEditNonAktifkan(e.target.checked)} 
                      />
                      <span className="pi-simple-slider"></span>
                    </label>
                    <span className={`pi-switch-label ${editNonAktifkan ? 'active' : ''}`}>yes</span>
                  </div>
                </div>

                {/* Tidak muncul di Point Of Sale */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>Tidak muncul di Point Of Sale</span>
                  <div className="pi-switch-container">
                    <span className={`pi-switch-label ${!editTidakPos ? 'active' : ''}`}>no</span>
                    <label className="pi-simple-switch">
                      <input 
                        type="checkbox" 
                        checked={editTidakPos} 
                        onChange={(e) => setEditTidakPos(e.target.checked)} 
                      />
                      <span className="pi-simple-slider"></span>
                    </label>
                    <span className={`pi-switch-label ${editTidakPos ? 'active' : ''}`}>yes</span>
                  </div>
                </div>

                {/* Submenu tidak muncul di Menu/Navigasi Website */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#475569' }}>Submenu tidak muncul di Menu/Navigasi Website</span>
                  <div className="pi-switch-container">
                    <span className={`pi-switch-label ${!editTidakNavWeb ? 'active' : ''}`}>no</span>
                    <label className="pi-simple-switch">
                      <input 
                        type="checkbox" 
                        checked={editTidakNavWeb} 
                        onChange={(e) => setEditTidakNavWeb(e.target.checked)} 
                      />
                      <span className="pi-simple-slider"></span>
                    </label>
                    <span className={`pi-switch-label ${editTidakNavWeb ? 'active' : ''}`}>yes</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="edit-modal-footer">
              <button 
                type="button" 
                onClick={handleDelete}
                style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Trash2 size={16} />
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  type="button" 
                  onClick={() => setEditingCategory(null)}
                  style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#334155', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Batal
                </button>
                <button 
                  type="button" 
                  onClick={handleUpdate}
                  style={{ background: '#0284c7', border: 0, color: '#fff', borderRadius: 8, padding: '8px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
