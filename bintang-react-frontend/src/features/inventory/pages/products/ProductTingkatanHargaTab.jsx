import { useState } from 'react';
import { Plus, Trash2, Edit2, X, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { PriceInput } from './VariantModal';

export default function ProductTingkatanHargaTab({ product, onUpdated, storeName }) {
  // Price tiers are stored in product.tiers as an array of objects
  const tiers = Array.isArray(product.tiers) ? product.tiers : [];

  // Table pagination and row limits
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  // Form states for ADD / EDIT
  const [formTipePelanggan, setFormTipePelanggan] = useState('');
  const [formVariant, setFormVariant] = useState('All');
  const [formQtyMulai, setFormQtyMulai] = useState('1');
  const [formHargaJual, setFormHargaJual] = useState('Rp. 0');
  const [editingTierId, setEditingTierId] = useState(null);

  // Parse price string like "Rp. 15.000" to number
  const parsePriceString = (str) => {
    if (!str) return 0;
    const clean = str.replace(/[^\d]/g, '');
    return parseInt(clean, 10) || 0;
  };

  // Format number to currency "Rp. 15.000,00"
  const formatPrice = (val) => {
    const num = typeof val === 'number' ? val : parsePriceString(val);
    return 'Rp. ' + (num || 0).toLocaleString('id-ID') + ',00';
  };

  // Pagination calculations
  const totalRowsCount = tiers.length;
  const totalPages = Math.ceil(totalRowsCount / rowsPerPage) || 1;
  const paginatedTiers = tiers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const handleOpenAdd = () => {
    setFormTipePelanggan('');
    setFormVariant('All');
    setFormQtyMulai('1');
    setFormHargaJual('Rp. 0');
    setFormError(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (tier) => {
    setEditingTierId(tier.id);
    setFormTipePelanggan(tier.tipe_pelanggan || '');
    setFormVariant(tier.variant || 'All');
    setFormQtyMulai((tier.qty_mulai || 1).toString());
    
    // Set price format "Rp. XXX" for PriceInput
    const priceNum = typeof tier.harga_jual === 'number' ? tier.harga_jual : parsePriceString(tier.harga_jual);
    setFormHargaJual('Rp. ' + priceNum.toLocaleString('id-ID'));
    
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleSave = async (isEdit) => {
    if (!formTipePelanggan.trim()) {
      setFormError('Nama/Tipe Pelanggan wajib diisi.');
      return;
    }
    const qty = parseInt(formQtyMulai, 10);
    if (isNaN(qty) || qty <= 0) {
      setFormError('Qty Mulai harus angka lebih besar dari 0.');
      return;
    }
    const price = parsePriceString(formHargaJual);
    if (price < 0) {
      setFormError('Harga Jual tidak boleh negatif.');
      return;
    }

    setSaving(true);
    setFormError(null);

    let updatedTiers = [...tiers];

    if (isEdit) {
      // Edit existing
      updatedTiers = updatedTiers.map(t => {
        if (t.id === editingTierId) {
          return {
            ...t,
            tipe_pelanggan: formTipePelanggan.trim(),
            variant: formVariant,
            qty_mulai: qty,
            harga_jual: price
          };
        }
        return t;
      });
    } else {
      // Add new
      const newTier = {
        id: 'tier-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        tipe_pelanggan: formTipePelanggan.trim(),
        variant: formVariant,
        qty_mulai: qty,
        harga_jual: price
      };
      updatedTiers.push(newTier);
    }

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        tiers: updatedTiers
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
      setIsAddOpen(false);
      setIsEditOpen(false);
    } catch (err) {
      console.error('[TingkatanHargaTab] Error saving tier:', err);
      setFormError('Gagal menyimpan tingkatan harga ke server.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tierId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus tingkatan harga ini?')) {
      return;
    }

    const updatedTiers = tiers.filter(t => t.id !== tierId);

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        tiers: updatedTiers
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
    } catch (err) {
      console.error('[TingkatanHargaTab] Error deleting tier:', err);
      alert('Gagal menghapus tingkatan harga dari server.');
    }
  };

  // Get list of variants for dropdown
  const variantOptions = product.variants && product.variants.length > 0
    ? ['All', ...product.variants.map(v => v.nama_varian)]
    : ['All'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Daftar Tingkat Harga</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            {totalRowsCount} Produk Tingkatan Harga
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
        {/* Row count filter bar */}
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
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
            No Data
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textJustify: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '12px 18px' }}>Tipe Pelanggan</th>
                  <th style={{ padding: '12px 18px' }}>Variant</th>
                  <th style={{ padding: '12px 18px' }}>Qty Mulai</th>
                  <th style={{ padding: '12px 18px' }}>Harga Jual</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTiers.map((tier) => (
                  <tr
                    key={tier.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      color: '#334155',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '12px 18px', fontWeight: 500 }}>
                      {tier.tipe_pelanggan}
                    </td>
                    <td style={{ padding: '12px 18px', color: '#64748b' }}>
                      {tier.variant === 'All' ? 'Semua Varian' : tier.variant}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 600 }}>
                      {tier.qty_mulai}
                    </td>
                    <td style={{ padding: '12px 18px', fontWeight: 700, color: '#0f172a' }}>
                      {formatPrice(tier.harga_jual)}
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          onClick={() => handleOpenEdit(tier)}
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
                          onClick={() => handleDelete(tier.id)}
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

      {/* ================= MODAL: ADD / EDIT TIER ================= */}
      {(isAddOpen || isEditOpen) && (
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
            onSubmit={(e) => {
              e.preventDefault();
              handleSave(isEditOpen);
            }}
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
                {isEditOpen ? 'Ubah Tingkatan Harga' : 'Tambah Tingkatan Harga'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                }}
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

              {/* Tipe Pelanggan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Tipe Pelanggan</label>
                <input
                  type="text"
                  placeholder="Masukkan Nama/Tipe Pelanggan"
                  value={formTipePelanggan}
                  onChange={(e) => setFormTipePelanggan(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Variant selector */}
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

              {/* Qty Mulai */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Qty Mulai</label>
                <input
                  type="number"
                  min="1"
                  value={formQtyMulai}
                  onChange={(e) => setFormQtyMulai(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Harga Jual */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Harga Jual</label>
                <PriceInput
                  value={formHargaJual}
                  onChange={(val) => setFormHargaJual(val)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 20px', borderTop: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                }}
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
                {saving ? 'Menyimpan...' : isEditOpen ? 'Simpan' : 'Tambah'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
