import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, X, AlertCircle, Package } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export default function ProductTerkaitTab({ product, onUpdated, storeName }) {
  const relatedDetails = Array.isArray(product.related_products_details) 
    ? product.related_products_details 
    : [];

  const relatedIds = Array.isArray(product.related_product_ids)
    ? product.related_product_ids
    : [];

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchInputRef = useRef(null);

  // Debounced search for products in the modal
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      setError(null);
      try {
        const res = await apiClient.get(`/products/?search=${encodeURIComponent(searchQuery)}`);
        const items = res.data.results || res.data || [];
        
        // Filter out current product & already related products from search results
        const filteredItems = items.filter(
          item => item.id !== product.id && !relatedIds.includes(item.id)
        );
        
        setSearchResults(filteredItems);
      } catch (err) {
        console.error('[TerkaitTab] Error searching products:', err);
        setError('Gagal mencari produk.');
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, relatedIds, product.id]);

  // Focus search input when modal opens
  useEffect(() => {
    if (isAddOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAddOpen]);

  const handleOpenAdd = () => {
    setSearchQuery('');
    setSearchResults([]);
    setError(null);
    setIsAddOpen(true);
  };

  const handleAddProduct = async (targetProduct) => {
    setSaveLoading(true);
    setError(null);

    const updatedIds = [...relatedIds, targetProduct.id];

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        related_product_ids: updatedIds
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
      // Remove from search results after adding
      setSearchResults(prev => prev.filter(item => item.id !== targetProduct.id));
    } catch (err) {
      console.error('[TerkaitTab] Error linking product:', err);
      setError('Gagal menambahkan produk terkait.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async (targetId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini dari daftar produk terkait?')) {
      return;
    }

    const updatedIds = relatedIds.filter(id => id !== targetId);

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        related_product_ids: updatedIds
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
    } catch (err) {
      console.error('[TerkaitTab] Error unlinking product:', err);
      alert('Gagal menghapus produk terkait.');
    }
  };

  const formatPrice = (val) => {
    return 'Rp. ' + (val || 0).toLocaleString('id-ID') + ',00';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Daftar Produk Terkait</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            {relatedDetails.length} Produk Terkait
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

      {/* Content Section */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {relatedDetails.length === 0 ? (
          /* Empty state - styled static without polar bear animation */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
            {/* Beautiful static illustration background */}
            <div
              style={{
                width: 140,
                height: 140,
                borderRadius: '50%',
                backgroundColor: '#f0f9ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
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
                <Package size={44} style={{ color: '#0284c7' }} />
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>Tidak ada produk</div>
          </div>
        ) : (
          /* Related products list table */
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px 18px', width: '80px' }}>Foto</th>
                  <th style={{ padding: '12px 18px' }}>Nama Produk</th>
                  <th style={{ padding: '12px 18px' }}>SKU / Barcode</th>
                  <th style={{ padding: '12px 18px' }}>Harga Jual</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {relatedDetails.map((item) => (
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
                    <td style={{ padding: '10px 18px' }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 6,
                          backgroundColor: '#f1f5f9',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        {item.foto_url ? (
                          <img
                            src={item.foto_url}
                            alt={item.nama}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Package size={20} style={{ color: '#94a3b8' }} />
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>
                      {item.nama}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.barcode && <span>Barcode: {item.barcode}</span>}
                        {!item.sku && !item.barcode && <span>-</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                      {formatPrice(item.harga_jual_toko)}
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
      </div>

      {/* ================= MODAL: CARI PRODUK TERKAIT ================= */}
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
          <div
            style={{
              width: '100%',
              maxWidth: 500,
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
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Cari Produk Terkait</h3>
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
              {error && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#b91c1c', fontSize: 13 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Search input field */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={18} style={{ position: 'absolute', left: 12, color: '#94a3b8' }} />
                <input
                  type="text"
                  ref={searchInputRef}
                  placeholder="Produk/SKU/Barcode"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.15s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#026da7'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ position: 'absolute', right: 12, background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 2 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Search results list */}
              <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {searchLoading ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>Mencari produk...</div>
                ) : searchQuery.trim() === '' ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Ketik kata kunci untuk mencari produk terkait.</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Tidak ada produk yang cocok.</div>
                ) : (
                  searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleAddProduct(item)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        transition: 'background-color 0.15s',
                        border: '1px solid #f1f5f9'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 4,
                            backgroundColor: '#f1f5f9',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          {item.fotos && item.fotos.length > 0 ? (
                            <img
                              src={item.fotos[0].foto}
                              alt={item.nama}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Package size={16} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{item.nama}</span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>
                            {item.sku ? `SKU: ${item.sku}` : item.barcode ? `Barcode: ${item.barcode}` : '-'}
                          </span>
                        </div>
                      </div>
                      <button
                        disabled={saveLoading}
                        style={{
                          backgroundColor: '#026da7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Pilih
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
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
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
