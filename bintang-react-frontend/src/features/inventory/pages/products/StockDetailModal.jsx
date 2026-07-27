import { useState, useEffect } from 'react';
import { X, Building2, Pencil, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '../components/PageShell';
import apiClient from '../../../../api/apiClient';
import { formatCurrency } from '../productInventoryData';

export default function StockDetailModal({ open, onClose, product }) {
  const [activeStep, setActiveStep] = useState('choose_variant'); // 'choose_variant' or 'detail'
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stokHabisOnly, setStokHabisOnly] = useState(false);
  
  // Edit mode states
  const [editingItemId, setEditingItemId] = useState(null);
  const [editForm, setEditForm] = useState({ harga_beli: '', rak: '', tanggal: '' });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (open && product) {
      if (product.variants && product.variants.length > 0) {
        setActiveStep('choose_variant');
        setSelectedVariant(null);
        setStockHistory([]);
      } else {
        setActiveStep('detail');
        setSelectedVariant(null);
        fetchHistory(null);
      }
      setStokHabisOnly(false);
      setEditingItemId(null);
      setCurrentPage(1);
    }
  }, [open, product]);

  const fetchHistory = async (variantObj) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (variantObj) {
        params.variant = variantObj.id;
      }
      const res = await apiClient.get(`/products/${product.id}/stock-in-history/`, { params });
      setStockHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[StockDetailModal] Error fetching stock history:', err);
      setError('Gagal memuat riwayat stok.');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !product) return null;

  const handleSelectVariant = (variant) => {
    setSelectedVariant(variant);
    setActiveStep('detail');
    fetchHistory(variant);
  };

  const handleBackToVariants = () => {
    if (product.variants && product.variants.length > 0) {
      setActiveStep('choose_variant');
      setSelectedVariant(null);
      setStockHistory([]);
      setEditingItemId(null);
    }
  };

  // Edit action handlers
  const startEdit = (item) => {
    setEditingItemId(item.id);
    setEditForm({
      harga_beli: item.harga_beli,
      rak: item.rak || '',
      tanggal: item.tanggal || (item.created_at ? item.created_at.split('T')[0] : '')
    });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
  };

  const saveEdit = async (item) => {
    try {
      await apiClient.post(`/products/${product.id}/update-stock-in-item/`, {
        item_id: item.id,
        harga_beli: editForm.harga_beli,
        rak: editForm.rak,
        tanggal: editForm.tanggal
      });
      setEditingItemId(null);
      fetchHistory(selectedVariant);
    } catch (err) {
      console.error('[StockDetailModal] Error updating stock entry:', err);
      alert(err.response?.data?.error || 'Gagal menyimpan perubahan.');
    }
  };

  // Stats calculation
  const filteredHistory = stockHistory.filter(item => {
    if (stokHabisOnly) {
      return item.sisa_qty <= 0;
    } else {
      return item.sisa_qty > 0;
    }
  });

  const totalSisaStok = stockHistory.reduce((sum, item) => sum + (item.sisa_qty || 0), 0);
  const totalStokKeluar = stockHistory.reduce((sum, item) => sum + (item.qty_keluar || 0), 0);
  const totalOnHold = 0.00; // default olsera value

  // Pagination logic
  const totalRows = filteredHistory.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  return (
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
        zIndex: 1000,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 16,
          maxHeight: '90vh'
        }}
      >
        {activeStep === 'choose_variant' ? (
          /* Step 1: Choose Variant */
          <>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Pilih varian</h3>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* List */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {product.variants && product.variants.map((v) => (
                <div
                  key={v.id}
                  onClick={() => handleSelectVariant(v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    marginBottom: 10,
                    cursor: 'pointer',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 6,
                        backgroundColor: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                        color: '#64748b'
                      }}
                    >
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                        {v.nama_varian}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {product.nama} {v.sku ? `• ${v.sku}` : ''}
                      </div>
                    </div>
                  </div>
                  
                  <div
                    style={{
                      border: '1px solid #fdba74',
                      color: '#ea580c',
                      backgroundColor: '#fff7ed',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {v.qty_stok}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Step 2: Stock Details View */
          <>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {product.variants && product.variants.length > 0 && (
                  <button
                    onClick={handleBackToVariants}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <ChevronLeft size={16} /> Kembali
                  </button>
                )}
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>
                    {selectedVariant ? `${product.nama} - ${selectedVariant.nama_varian}` : product.nama}
                  </h3>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>
                    {selectedVariant ? `${selectedVariant.sku || 'No SKU'}` : `${product.sku || 'No SKU'}`}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-header section with filter */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                Stok produk berdasarkan tanggal pembelian
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={stokHabisOnly}
                  onChange={(e) => {
                    setStokHabisOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  style={{ cursor: 'pointer' }}
                />
                Stok habis
              </label>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'flex', gap: 10, padding: '16px 20px 8px 20px' }}>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>Total sisa stok</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {totalSisaStok.toFixed(2)}
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>Total stok keluar</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                  {totalStokKeluar.toFixed(2)}
                </div>
              </div>
              <div style={{ flex: 1, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>On hold qty</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0284c7', marginTop: 4 }}>
                  {totalOnHold.toFixed(2).replace('.', ',')}
                </div>
              </div>
            </div>

            {/* History List */}
            <div style={{ padding: '8px 20px', overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: 13 }}>
                  Memuat data stok...
                </div>
              ) : error ? (
                <div style={{ color: '#ef4444', fontSize: 12.5, textAlign: 'center', padding: '16px 0' }}>
                  {error}
                </div>
              ) : paginatedHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 13 }}>
                  Data tidak ditemukan
                </div>
              ) : (
                paginatedHistory.map((item) => {
                  const isEditing = editingItemId === item.id;
                  const displayDate = item.tanggal
                    ? new Date(item.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : item.created_at
                    ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '-';

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: 14,
                        marginBottom: 12,
                      }}
                    >
                      {/* Header of Item card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                            {item.nomor}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {displayDate}
                          </div>
                        </div>

                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={cancelEdit}
                              style={{
                                border: 'none',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Batal
                            </button>
                            <button
                              onClick={() => saveEdit(item)}
                              style={{
                                border: 'none',
                                backgroundColor: '#22c55e',
                                color: '#ffffff',
                                padding: '4px 10px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Simpan
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(item)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: 4,
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                      </div>

                      {/* Detail fields */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Stok Keluar</span>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.qty_keluar.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                          <span style={{ color: '#64748b' }}>Sisa Stok</span>
                          <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.sisa_qty.toFixed(2)}</span>
                        </div>

                        {isEditing ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ color: '#64748b' }}>Harga Beli</span>
                              <input
                                type="number"
                                value={editForm.harga_beli}
                                onChange={(e) => setEditForm({ ...editForm, harga_beli: e.target.value })}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  padding: '4px 6px',
                                  fontSize: 12,
                                  width: 120,
                                  textAlign: 'right',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ color: '#64748b' }}>Rak</span>
                              <input
                                type="text"
                                value={editForm.rak}
                                onChange={(e) => setEditForm({ ...editForm, rak: e.target.value })}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  padding: '4px 6px',
                                  fontSize: 12,
                                  width: 120,
                                  textAlign: 'right',
                                  outline: 'none',
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: '#64748b' }}>Tanggal</span>
                              <input
                                type="date"
                                value={editForm.tanggal}
                                onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                                style={{
                                  border: '1px solid #cbd5e1',
                                  borderRadius: 4,
                                  padding: '4px 6px',
                                  fontSize: 12,
                                  width: 130,
                                  textAlign: 'right',
                                  outline: 'none',
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 6, borderBottom: '1px solid #f1f5f9' }}>
                              <span style={{ color: '#64748b' }}>Harga Beli</span>
                              <span style={{ color: '#1e293b', fontWeight: 500 }}>
                                {formatCurrency(item.harga_beli)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                              <span style={{ color: '#64748b' }}>Rak</span>
                              <span style={{ color: '#1e293b', fontWeight: 500 }}>{item.rak || '-'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination footer */}
            {!loading && filteredHistory.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderTop: '1px solid #f1f5f9',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 12,
                      backgroundColor: '#ffffff',
                      color: '#334155',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={5}>5 Baris</option>
                    <option value={10}>10 Baris</option>
                    <option value={20}>20 Baris</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      color: currentPage === 1 ? '#cbd5e1' : '#64748b',
                      padding: 4
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Hal {currentPage} dari {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      color: currentPage === totalPages ? '#cbd5e1' : '#64748b',
                      padding: 4
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' }}>
                  Go to
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    style={{
                      width: 40,
                      padding: '3px 6px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 4,
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
