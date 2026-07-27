import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Search, X, ChevronDown, ChevronRight, Edit2, Upload, AlertCircle } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import ImportRecipeModal from './ImportRecipeModal';

export default function ProductBahanResepTab({ product, onUpdated, storeName }) {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination / Filter states
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedVariants, setExpandedVariants] = useState({});

  // Modals state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form states for ADD modal
  const [selectedVariantName, setSelectedVariantName] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [materialResults, setMaterialResults] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addQty, setAddQty] = useState('1.0');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // Form states for EDIT modal
  const [editingItem, setEditingItem] = useState(null);
  const [editQty, setEditQty] = useState('1.0');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  const materialSearchRef = useRef(null);

  // Fetch recipe / BOM data for this product
  const fetchBoms = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/bom/?product_name=${encodeURIComponent(product.nama)}`);
      setBoms(res.data.results || res.data || []);
      setError(null);
    } catch (err) {
      console.error('[BahanResepTab] Error fetching recipes:', err);
      setError('Gagal memuat daftar bahan / resep dari server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoms();
  }, [product.nama]);

  // Debounced material/inventory item search for ADD modal
  useEffect(() => {
    if (materialSearch.trim().length === 0) {
      setMaterialResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await apiClient.get(`/inventory/?search=${encodeURIComponent(materialSearch)}`);
        const items = res.data.results || res.data || [];
        setMaterialResults(items);
      } catch (err) {
        console.error('[BahanResepTab] Error searching inventory:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [materialSearch]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (materialSearchRef.current && !materialSearchRef.current.contains(e.target)) {
        setMaterialDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helpers to structure data
  // Get all unique rows (variants or product main if no variants)
  const rows = product.has_variant && product.variants && product.variants.length > 0
    ? product.variants.map(v => v.nama_varian)
    : ['Utama'];

  // Total items/variants count
  const totalRowsCount = rows.length;

  // Pagination logic
  const totalPages = Math.ceil(totalRowsCount / rowsPerPage);
  const paginatedRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const toggleExpand = (rowName) => {
    setExpandedVariants(prev => ({
      ...prev,
      [rowName]: !prev[rowName]
    }));
  };

  // Get matching BOM for a row
  const getBomForRow = (rowName) => {
    const variantName = rowName === 'Utama' ? null : rowName;
    return boms.find(bom => {
      const matchName = bom.product_material === variantName || 
                        (!bom.product_material && !variantName);
      return matchName;
    });
  };

  const handleOpenAdd = (rowName = '') => {
    setSelectedVariantName(rowName === 'Utama' ? 'Utama' : rowName || rows[0] || 'Utama');
    setMaterialSearch('');
    setSelectedMaterial(null);
    setMaterialResults([]);
    setAddQty('1.0');
    setAddError(null);
    setIsAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaterial) {
      setAddError('Silakan cari dan pilih bahan terlebih dahulu.');
      return;
    }
    const parsedQty = parseFloat(addQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setAddError('Jumlah bahan harus lebih besar dari 0.');
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      // 1. Resolve or create BOM object
      const vName = selectedVariantName === 'Utama' ? null : selectedVariantName;
      const bomRes = await apiClient.post('/bom/get-or-create-for-product/', {
        product_name: product.nama,
        material: vName
      });
      const bomId = bomRes.data.id;

      // 2. Add BOM Item
      await apiClient.post('/bom-items/', {
        bom: bomId,
        inventory_item: selectedMaterial.id,
        qty_required_per_unit: parsedQty
      });

      // 3. Refresh and close modal
      await fetchBoms();
      setIsAddOpen(false);
      // Auto-expand that variant row to show new ingredient
      setExpandedVariants(prev => ({ ...prev, [selectedVariantName]: true }));
    } catch (err) {
      console.error('[BahanResepTab] Error adding item:', err);
      setAddError(err.response?.data?.error || 'Gagal menyimpan bahan ke resep.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setEditQty(item.qty_required_per_unit.toString());
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const parsedQty = parseFloat(editQty);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setEditError('Jumlah bahan harus lebih besar dari 0.');
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      await apiClient.patch(`/bom-items/${editingItem.id}/`, {
        qty_required_per_unit: parsedQty
      });
      await fetchBoms();
      setIsEditOpen(false);
    } catch (err) {
      console.error('[BahanResepTab] Error editing item:', err);
      setEditError(err.response?.data?.error || 'Gagal mengubah jumlah bahan.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus bahan ini dari resep?')) {
      return;
    }
    try {
      await apiClient.delete(`/bom-items/${itemId}/`);
      await fetchBoms();
    } catch (err) {
      console.error('[BahanResepTab] Error deleting item:', err);
      alert('Gagal menghapus bahan dari resep.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Daftar Bahan/Resep</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            {totalRowsCount} Item Varian / Resep Terdaftar
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setIsImportOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#fff',
              color: '#026da7',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={() => handleOpenAdd()}
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

      {/* Main content table card */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        {/* Filter bar */}
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

        {/* Rows List */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Memuat data resep...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>
        ) : paginatedRows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Belum ada data varian atau bahan yang ditambahkan.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {paginatedRows.map((rowName, idx) => {
              const isExpanded = !!expandedVariants[rowName];
              const bom = getBomForRow(rowName);
              const items = bom?.items || [];
              const itemsCount = items.length;

              return (
                <div
                  key={rowName}
                  style={{
                    borderBottom: idx === paginatedRows.length - 1 ? 'none' : '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {/* Variant Row Header */}
                  <div
                    onClick={() => toggleExpand(rowName)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      backgroundColor: isExpanded ? '#f0f9ff' : '#transparent',
                      transition: 'background-color 0.2s',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isExpanded ? (
                        <ChevronDown size={18} style={{ color: '#026da7' }} />
                      ) : (
                        <ChevronRight size={18} style={{ color: '#64748b' }} />
                      )}
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {rowName === 'Utama' ? product.nama : rowName}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          fontSize: 12,
                          backgroundColor: itemsCount > 0 ? '#e0f2fe' : '#f1f5f9',
                          color: itemsCount > 0 ? '#0369a1' : '#475569',
                          padding: '3px 8px',
                          borderRadius: 999,
                          fontWeight: 500
                        }}
                      >
                        {itemsCount} bahan baku
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAdd(rowName);
                        }}
                        style={{
                          border: '1px solid #026da7',
                          color: '#026da7',
                          background: 'transparent',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        + Tambah Bahan
                      </button>
                    </div>
                  </div>

                  {/* Expanded ingredient list */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: '0 18px 18px 46px',
                        backgroundColor: '#fafafa',
                        borderBottom: '1px solid #f1f5f9'
                      }}
                    >
                      {itemsCount === 0 ? (
                        <div style={{ padding: '16px 0', fontSize: 12.5, color: '#94a3b8', fontStyle: 'italic' }}>
                          Belum ada bahan baku ditambahkan untuk varian ini. Klik tombol "+ Tambah Bahan" di atas.
                        </div>
                      ) : (
                        <div style={{ width: '100%', overflowX: 'auto', marginTop: 8 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>
                                <th style={{ padding: '8px 0', width: '60%' }}>Nama Bahan Baku</th>
                                <th style={{ padding: '8px 0', width: '20%' }}>Qty Formula</th>
                                <th style={{ padding: '8px 0', width: '10%' }}>Satuan</th>
                                <th style={{ padding: '8px 0', textAlign: 'right', width: '10%' }}>Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                                  <td style={{ padding: '10px 0', fontWeight: 500 }}>
                                    {item.inventory_item_nama}
                                  </td>
                                  <td style={{ padding: '10px 0', fontWeight: 600, color: '#0f172a' }}>
                                    {item.qty_required_per_unit}
                                  </td>
                                  <td style={{ padding: '10px 0', color: '#64748b' }}>
                                    {item.inventory_item_satuan}
                                  </td>
                                  <td style={{ padding: '10px 0', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                      <button
                                        onClick={() => handleOpenEdit(item)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#0284c7',
                                          cursor: 'pointer',
                                          padding: 4,
                                          borderRadius: 4,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        title="Ubah"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#ef4444',
                                          cursor: 'pointer',
                                          padding: 4,
                                          borderRadius: 4,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                        title="Hapus"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '12px 18px', gap: 8, borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{
                padding: '6px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                backgroundColor: '#fff',
                fontSize: 12,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              Sebelumnya
            </button>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{
                padding: '6px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: 4,
                backgroundColor: '#fff',
                fontSize: 12,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>

      {/* ================= MODAL: TAMBAH BAHAN ================= */}
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
            onSubmit={handleAddSubmit}
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
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Tambah Bahan atau Resep</h3>
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
              {addError && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#b91c1c', fontSize: 13 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{addError}</span>
                </div>
              )}

              {/* Terapkan ke Varian */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Terapkan ke varian</label>
                <select
                  value={selectedVariantName}
                  onChange={(e) => setSelectedVariantName(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none',
                    backgroundColor: '#fff'
                  }}
                >
                  {rows.map(row => (
                    <option key={row} value={row}>
                      {row === 'Utama' ? product.nama : row}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bahan / Inventory Item Search Autocomplete */}
              <div ref={materialSearchRef} style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Produk Bahan Baku</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Cari produk bahan baku..."
                    value={selectedMaterial ? selectedMaterial.nama : materialSearch}
                    onChange={(e) => {
                      setSelectedMaterial(null);
                      setMaterialSearch(e.target.value);
                      setMaterialDropdownOpen(true);
                    }}
                    onFocus={() => setMaterialDropdownOpen(true)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none'
                    }}
                  />
                  {selectedMaterial && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMaterial(null);
                        setMaterialSearch('');
                      }}
                      style={{
                        position: 'absolute',
                        right: 12,
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 2,
                        display: 'flex'
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown results */}
                {materialDropdownOpen && (materialSearch.trim() !== '' || searchLoading) && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      maxHeight: 200,
                      overflowY: 'auto',
                      zIndex: 1010
                    }}
                  >
                    {searchLoading ? (
                      <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#64748b' }}>Mencari...</div>
                    ) : materialResults.length === 0 ? (
                      <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#94a3b8' }}>Tidak ada bahan ditemukan.</div>
                    ) : (
                      materialResults.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedMaterial(item);
                            setMaterialDropdownOpen(false);
                            setMaterialSearch('');
                          }}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            fontSize: 13,
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                          <div style={{ fontWeight: 600, color: '#334155' }}>{item.nama}</div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Kategori: {item.kategori} | Stok: {item.stok} {item.satuan}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Quantity and unit row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Jumlah (Qty)</label>
                  <input
                    type="number"
                    step="any"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Unit Pengukuran (UOM)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={selectedMaterial ? selectedMaterial.satuan : '-'}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 13.5,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                disabled={addLoading}
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
                disabled={addLoading}
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
                {addLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL: UBAH BAHAN ================= */}
      {isEditOpen && editingItem && (
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
            onSubmit={handleEditSubmit}
            style={{
              width: '100%',
              maxWidth: 450,
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
            <div style={{ display: 'flex', alignItems: 'center', justifycontent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Ubah Bahan Baku</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {editError && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#b91c1c', fontSize: 13 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{editError}</span>
                </div>
              )}

              {/* Bahan info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>Nama Bahan Baku</label>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                  {editingItem.inventory_item_nama}
                </div>
              </div>

              {/* Qty and Uom */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Jumlah (Qty)</label>
                  <input
                    type="number"
                    step="any"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Unit Pengukuran (UOM)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={editingItem.inventory_item_satuan}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: 6,
                      fontSize: 13.5,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                disabled={editLoading}
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
                disabled={editLoading}
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
                {editLoading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Modal */}
      <ImportRecipeModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          fetchBoms();
        }}
      />
    </div>
  );
}
