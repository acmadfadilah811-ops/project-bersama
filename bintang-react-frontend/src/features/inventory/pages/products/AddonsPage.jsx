import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, ArrowLeft } from 'lucide-react';
import DataTable from '../components/DataTable';
import apiClient from '../../../../api/apiClient';

const formatToIDR = (num) => {
  if (num === null || num === undefined) return 'IDR 0';
  const val = parseFloat(num);
  const formatted = new Intl.NumberFormat('id-ID').format(Math.floor(val));
  return `IDR ${formatted}`;
};

const parseIDR = (raw) => {
  if (!raw) return 0;
  let clean = String(raw).replace(/IDR/g, '').replace(/\s/g, '').replace(/\./g, '');
  const value = parseFloat(clean);
  return Number.isNaN(value) ? 0 : value;
};

export function AddonsPage({ onToggleCreate }) {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState('10');

  // Available products & categories for links
  const [availableProducts, setAvailableProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  // Form states
  const [namaAddon, setNamaAddon] = useState('');
  const [hargaAddon, setHargaAddon] = useState('IDR 0');
  const [linkedProductId, setLinkedProductId] = useState('');
  const [linkedVariantId, setLinkedVariantId] = useState('');
  const [qtyAddon, setQtyAddon] = useState('1.00');
  const [appliesToCategories, setAppliesToCategories] = useState([]);
  const [appliesToProducts, setAppliesToProducts] = useState([]);

  // Viewing detail state
  const [viewingAddon, setViewingAddon] = useState(null);
  const [isEditingDetail, setIsEditingDetail] = useState(false);

  const fetchAddons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/addons/');
      setAddons(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[AddonsPage] fetch error:', err);
      setError('Gagal memuat daftar add-on.');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await apiClient.get('/products/', { params: { page: 1, page_size: 1000 } });
      setAvailableProducts(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('Error fetching available products:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await apiClient.get('/categories/');
      setCategories(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchAddons();
    fetchProducts();
    fetchCategories();
  }, []);

  const handleSetIsCreating = (val) => {
    setIsCreating(val);
    if (onToggleCreate) {
      onToggleCreate(val);
    }
    if (val) {
      setNamaAddon('');
      setHargaAddon('IDR 0');
      setLinkedProductId('');
      setLinkedVariantId('');
      setQtyAddon('1.00');
      setAppliesToCategories([]);
      setAppliesToProducts([]);
    }
  };

  const handleViewDetail = (addon) => {
    setViewingAddon(addon);
    setNamaAddon(addon.nama || '');
    setHargaAddon(formatToIDR(addon.harga));
    setLinkedProductId(addon.linked_product || '');
    setLinkedVariantId(addon.linked_variant || '');
    setQtyAddon(parseFloat(addon.linked_qty || 1.00).toFixed(2));
    setAppliesToCategories(addon.applies_to_categories || []);
    setAppliesToProducts(addon.applies_to || []);
    setIsEditingDetail(false);
  };

  const canSave = namaAddon.trim() && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await apiClient.post('/addons/', {
        nama: namaAddon,
        harga: parseIDR(hargaAddon),
        linked_product: linkedProductId || null,
        linked_variant: linkedVariantId || null,
        linked_qty: parseFloat(qtyAddon) || 1.00,
        applies_to: appliesToProducts,
        applies_to_categories: appliesToCategories,
        is_active: true,
      });
      handleSetIsCreating(false);
      await fetchAddons();
    } catch (err) {
      console.error('[AddonsPage] save error:', err);
      setError('Gagal menyimpan add-on.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDetail = async () => {
    if (!namaAddon.trim() || saving) return;
    setSaving(true);
    try {
      const res = await apiClient.put(`/addons/${viewingAddon.id}/`, {
        nama: namaAddon,
        harga: parseIDR(hargaAddon),
        linked_product: linkedProductId || null,
        linked_variant: linkedVariantId || null,
        linked_qty: parseFloat(qtyAddon) || 1.00,
        applies_to: appliesToProducts,
        applies_to_categories: appliesToCategories,
        is_active: true
      });
      setViewingAddon(res.data);
      setIsEditingDetail(false);
      await fetchAddons();
    } catch (err) {
      console.error('[AddonsPage] update error:', err);
      setError('Gagal memperbarui add-on.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAddon = async () => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus add-on "${viewingAddon.nama}"?`)) return;
    setSaving(true);
    try {
      await apiClient.delete(`/addons/${viewingAddon.id}/`);
      setViewingAddon(null);
      await fetchAddons();
    } catch (err) {
      console.error('[AddonsPage] delete error:', err);
      setError('Gagal menghapus add-on.');
    } finally {
      setSaving(false);
    }
  };

  const filteredAddons = addons.filter(addon =>
    addon.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ----------------------------------------------------
  // RENDER DETAIL VIEW
  // ----------------------------------------------------
  if (viewingAddon) {
    const isEditing = isEditingDetail;
    return (
      <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <button 
            type="button" 
            onClick={() => setViewingAddon(null)} 
            style={{ background: 'none', border: 0, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={20} />
          </button>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>Katalog Produk / Rincian Produk Tambahan</h2>
        </div>

        <div className="pi-category-card" style={{ padding: '24px' }}>
          {/* Header Area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>
              {isEditing ? 'Ubah Add-On' : viewingAddon.nama}
            </h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button 
                type="button" 
                style={{ background: 'transparent', border: 0, color: '#0284c7', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => {
                  if (isEditing) {
                    setIsEditingDetail(false);
                  } else {
                    setViewingAddon(null);
                  }
                }}
              >
                Batal
              </button>
              <button 
                type="button" 
                style={{ background: '#0284c7', color: '#fff', border: 0, borderRadius: '6px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => {
                  if (isEditing) {
                    handleUpdateDetail();
                  } else {
                    setIsEditingDetail(true);
                  }
                }}
              >
                {isEditing ? 'Simpan' : 'Ubah'}
              </button>
            </div>
          </div>

          {/* Two-Column Form/Detail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
            {/* Left Column */}
            <div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Nama</label>
                    <input 
                      type="text" 
                      className="pi-input-text w-full" 
                      value={namaAddon} 
                      onChange={(e) => setNamaAddon(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>Harga</label>
                    <input 
                      type="text" 
                      className="pi-input-text w-full" 
                      value={hargaAddon} 
                      onChange={(e) => {
                        let clean = e.target.value.replace(/[^0-9]/g, '');
                        if (!clean) {
                          setHargaAddon('IDR 0');
                          return;
                        }
                        setHargaAddon(`IDR ${new Intl.NumberFormat('id-ID').format(parseInt(clean))}`);
                      }} 
                    />
                  </div>

                  {/* Hubungkan ke Produk */}
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Hubungkan ke Produk (Stok)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Produk</span>
                        <select 
                          className="pi-store-select w-full"
                          value={linkedProductId}
                          onChange={(e) => {
                            const pid = e.target.value;
                            setLinkedProductId(pid);
                            const prod = availableProducts.find(p => String(p.id) === String(pid));
                            if (prod?.variants?.length > 0) {
                              setLinkedVariantId(prod.variants[0].id);
                            } else {
                              setLinkedVariantId('');
                            }
                          }}
                        >
                          <option value="">Pilih Produk</option>
                          {availableProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.nama}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Varian</span>
                        <select 
                          className="pi-store-select w-full"
                          value={linkedVariantId}
                          onChange={(e) => setLinkedVariantId(e.target.value)}
                          disabled={!linkedProductId}
                        >
                          <option value="">Pilih Varian</option>
                          {availableProducts.find(p => String(p.id) === String(linkedProductId))?.variants?.map(v => (
                            <option key={v.id} value={v.id}>{v.nama_varian}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>Qty</span>
                      <input 
                        type="text" 
                        className="pi-input-text w-full" 
                        value={qtyAddon} 
                        onChange={(e) => setQtyAddon(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>
              ) : (
                // VIEW MODE - Left Column
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', display: 'block', marginBottom: '4px' }}>Nama</span>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{viewingAddon.nama}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', display: 'block', marginBottom: '4px' }}>Harga</span>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a' }}>{formatToIDR(viewingAddon.harga)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', display: 'block', marginBottom: '4px' }}>Hubungkan ke Produk (Stok)</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0284c7' }}>
                      {viewingAddon.linked_product ? (
                        `${parseFloat(viewingAddon.linked_qty || 1.00).toFixed(2)} x ${viewingAddon.linked_product_nama}${viewingAddon.linked_variant_nama ? ` (${viewingAddon.linked_variant_nama})` : ''}`
                      ) : (
                        'Tidak terhubung ke stok'
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Hapus Button */}
              <div style={{ marginTop: '32px' }}>
                <button
                  type="button"
                  onClick={handleDeleteAddon}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={16} /> Hapus
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Category Selection */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Berlaku untuk grup produk</label>
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', background: '#fff', maxHeight: '150px', overflowY: 'auto' }}>
                      {categories.map(cat => (
                        <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={appliesToCategories.includes(cat.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAppliesToCategories([...appliesToCategories, cat.id]);
                              } else {
                                setAppliesToCategories(appliesToCategories.filter(id => id !== cat.id));
                              }
                            }}
                          />
                          {cat.nama}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Product Selection */}
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>Berlaku untuk produk</label>
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', background: '#fff', maxHeight: '150px', overflowY: 'auto' }}>
                      {availableProducts.map(p => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={appliesToProducts.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAppliesToProducts([...appliesToProducts, p.id]);
                              } else {
                                setAppliesToProducts(appliesToProducts.filter(id => id !== p.id));
                              }
                            }}
                          />
                          {p.nama}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                // VIEW MODE - Right Column
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', display: 'block', marginBottom: '8px' }}>Berlaku untuk grup produk</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {viewingAddon.applies_to_category_names && viewingAddon.applies_to_category_names.length > 0 ? (
                        viewingAddon.applies_to_category_names.map((name, i) => (
                          <span key={i} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                            {name}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Semua grup produk</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b', display: 'block', marginBottom: '8px' }}>Berlaku untuk produk</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {viewingAddon.applies_to_names && viewingAddon.applies_to_names.length > 0 ? (
                        viewingAddon.applies_to_names.map((name, i) => (
                          <span key={i} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>
                            {name}
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Semua produk</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER CREATE VIEW
  // ----------------------------------------------------
  if (isCreating) {
    return (
      <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
        <div className="pi-category-card" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="pi-category-card-header" style={{ padding: '16px 24px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#1e293b', fontWeight: 'bold' }}>Tambah Add-On Produk</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button 
                type="button" 
                onClick={() => handleSetIsCreating(false)} 
                style={{ background: 'none', border: 0, color: '#0ea5e9', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={handleSave}
                style={{ background: canSave ? '#16a34a' : '#e2e8f0', color: canSave ? '#fff' : '#94a3b8', border: 0, borderRadius: '4px', padding: '6px 20px', fontSize: '12px', fontWeight: 'bold', cursor: canSave ? 'pointer' : 'not-allowed' }}
              >
                {saving ? 'Menyimpan...' : '✓ Simpan'}
              </button>
            </div>
          </div>
          <div className="pi-category-card-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Section 1: Nama & Harga */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Nama</label>
                <input 
                  type="text" 
                  className="pi-input-text w-full" 
                  value={namaAddon}
                  onChange={(e) => setNamaAddon(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>Harga</label>
                <input 
                  type="text" 
                  className="pi-input-text w-full" 
                  value={hargaAddon}
                  onChange={(e) => {
                    let clean = e.target.value.replace(/[^0-9]/g, '');
                    if (!clean) {
                      setHargaAddon('IDR 0');
                      return;
                    }
                    setHargaAddon(`IDR ${new Intl.NumberFormat('id-ID').format(parseInt(clean))}`);
                  }}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Section 2: Hubungkan ke Produk (Stok) */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>Hubungkan ke Produk (Stok)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Produk</label>
                  <select 
                    className="pi-store-select" 
                    value={linkedProductId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setLinkedProductId(pid);
                      const prod = availableProducts.find(p => String(p.id) === String(pid));
                      if (prod?.variants?.length > 0) {
                        setLinkedVariantId(prod.variants[0].id);
                      } else {
                        setLinkedVariantId('');
                      }
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">Pilih Produk</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.nama}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Varian</label>
                  <select 
                    className="pi-store-select" 
                    value={linkedVariantId}
                    onChange={(e) => setLinkedVariantId(e.target.value)}
                    disabled={!linkedProductId}
                    style={{ width: '100%' }}
                  >
                    <option value="">Pilih Varian</option>
                    {availableProducts.find(p => String(p.id) === String(linkedProductId))?.variants?.map(v => (
                      <option key={v.id} value={v.id}>{v.nama_varian}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Qty</label>
                <input 
                  type="text" 
                  className="pi-input-text w-full" 
                  value={qtyAddon}
                  onChange={(e) => setQtyAddon(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Section 3: Berlaku untuk produk */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>Berlaku untuk produk</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Berlaku untuk grup produk</label>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', background: '#fff', maxHeight: '120px', overflowY: 'auto' }}>
                  {categories.map(cat => (
                    <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={appliesToCategories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAppliesToCategories([...appliesToCategories, cat.id]);
                          } else {
                            setAppliesToCategories(appliesToCategories.filter(id => id !== cat.id));
                          }
                        }}
                      />
                      {cat.nama}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Berlaku untuk produk</label>
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px', background: '#fff', maxHeight: '120px', overflowY: 'auto' }}>
                  {availableProducts.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={appliesToProducts.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAppliesToProducts([...appliesToProducts, p.id]);
                          } else {
                            setAppliesToProducts(appliesToProducts.filter(id => id !== p.id));
                          }
                        }}
                      />
                      {p.nama}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#ffffff' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 16px 0' }}>Katalog Produk / Produk Tambahan</h2>
      
      {/* Search & Action bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
        <select 
          value={rowsPerPage} 
          onChange={(e) => setRowsPerPage(e.target.value)}
          style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 12px', fontSize: '13px', color: '#64748b', outline: 'none', background: '#ffffff', minWidth: '100px' }}
        >
          <option value="10">10 Baris</option>
          <option value="25">25 Baris</option>
          <option value="50">50 Baris</option>
        </select>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Cari" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 10px 8px 36px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <button 
          type="button" 
          onClick={() => handleSetIsCreating(true)}
          style={{ background: '#16a34a', color: '#ffffff', border: 0, borderRadius: '4px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <Plus size={14} /> Tambah
        </button>
      </div>

      {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '0 0 8px' }}>{error}</p>}
      <DataTable
        rows={filteredAddons}
        emptyText={loading ? 'Memuat...' : 'Tidak ada data'}
        columns={[
          { 
            key: 'nama', 
            label: 'Nama Produk',
            render: (row) => (
              <span 
                onClick={() => handleViewDetail(row)}
                style={{ color: '#0284c7', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {row.nama}
              </span>
            )
          },
          { key: 'harga', label: 'Harga', render: (row) => formatToIDR(row.harga) }
        ]}
      />

      {/* Pagination Footer */}
      <div className="pi-pagination-bar" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}></div>
        <div className="pi-pagination-controls">
          <span className="pi-pagination-info">Total {filteredAddons.length}</span>
          <button className="pi-pagination-nav-btn" disabled>&lt;</button>
          <span className="pi-pagination-active-page">1</span>
          <button className="pi-pagination-nav-btn" disabled>&gt;</button>
          <span className="pi-pagination-goto">
            Go to <input type="number" defaultValue={1} className="pi-pagination-input" min={1} />
          </span>
        </div>
      </div>
    </div>
  );
}
