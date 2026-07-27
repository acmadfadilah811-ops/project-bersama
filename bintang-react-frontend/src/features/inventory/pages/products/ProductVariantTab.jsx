import { useState, useEffect, Fragment } from 'react';
import { Plus, Trash2, Search, X, ChevronRight } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { PriceInput } from './VariantModal';

function Section({ title, headerRight, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{title}</h3>
        {headerRight}
      </div>
      <div style={{ padding: '18px' }}>{children}</div>
    </div>
  );
}

export default function ProductVariantTab({ product, onUpdated, storeName }) {
  const [viewMode, setViewMode] = useState('list'); // 'list', 'add'
  
  // Lists & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);

  // Expanded Inline Details
  const [expandedVariantId, setExpandedVariantId] = useState(null);
  const [isEditingExpanded, setIsEditingExpanded] = useState(false);

  // Form states (shared for creation and inline edit)
  const [variantTypes, setVariantTypes] = useState(['warna', 'ukuran']);
  const [newTypeInput, setNewTypeInput] = useState('');
  const [optionValues, setOptionValues] = useState({});
  const [customValueInputs, setCustomValueInputs] = useState({});

  const [formSku, setFormSku] = useState('');
  const [formAlternatif, setFormAlternatif] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formQtyStok, setFormQtyStok] = useState('0');
  const [formBerat, setFormBerat] = useState('0');
  const [formHargaBeli, setFormHargaBeli] = useState('Rp. 0');
  const [formHargaPasar, setFormHargaPasar] = useState('Rp. 0');
  const [formHargaJualOnline, setFormHargaJualOnline] = useState('Rp. 0');
  const [formHargaJualToko, setFormHargaJualToko] = useState('Rp. 0');

  // Photo uploading states
  const [formFotoFile, setFormFotoFile] = useState(null);
  const [formFotoUrl, setFormFotoUrl] = useState('');

  // Additional database fields aligned with UI mockup
  const [formLoyaltyPoint, setFormLoyaltyPoint] = useState('0.00');
  const [formKomisi, setFormKomisi] = useState('Rp. 0');
  const [komisiIsPersen, setKomisiIsPersen] = useState(false);
  const [habisStok, setHabisStok] = useState(false);
  const [pilihanDefault, setPilihanDefault] = useState(false);
  const [onHoldQty, setOnHoldQty] = useState('0');
  const [qtyFastMoving, setQtyFastMoving] = useState('0');

  const [saving, setSaving] = useState(false);

  // Initialize types based on existing variants
  useEffect(() => {
    if (product.variants && product.variants.length > 0) {
      const parts = product.variants[0].nama_varian.split(',');
      if (parts.length === 1) {
        setVariantTypes(['warna']);
      } else if (parts.length === 2) {
        setVariantTypes(['warna', 'ukuran']);
      } else {
        setVariantTypes(parts.map((_, idx) => `Tipe ${idx + 1}`));
      }
    }
  }, [product]);

  // Extract unique options from other variants to show in dropdown
  const getUniqueOptionsForType = (typeIndex) => {
    if (!product.variants) return [];
    const values = product.variants.map(v => {
      const parts = v.nama_varian.split(',');
      return parts[typeIndex] || '';
    }).filter(Boolean);
    return Array.from(new Set(values));
  };

  const resetForm = () => {
    setOptionValues({});
    setCustomValueInputs({});
    setFormSku('');
    setFormAlternatif('');
    setFormBarcode('');
    setFormQtyStok('0');
    setFormBerat('0');
    setFormHargaBeli('Rp. 0');
    setFormHargaPasar('Rp. 0');
    setFormHargaJualOnline('Rp. 0');
    setFormHargaJualToko('Rp. 0');
    setFormLoyaltyPoint('0.00');
    setFormKomisi('Rp. 0');
    setKomisiIsPersen(false);
    setHabisStok(false);
    setPilihanDefault(false);
    setOnHoldQty('0');
    setQtyFastMoving('0');
    setFormFotoFile(null);
    setFormFotoUrl('');
  };

  const handleStartAdd = () => {
    resetForm();
    if (product) {
      const formatVal = (num) => 'Rp. ' + Math.round(num || 0).toLocaleString('id-ID');
      setFormHargaBeli(formatVal(product.harga_beli));
      setFormHargaPasar(formatVal(product.harga_pasar));
      setFormHargaJualOnline(formatVal(product.harga_jual_online));
      setFormHargaJualToko(formatVal(product.harga_jual_toko));
    }
    setViewMode('add');
  };

  // Toggle row details collapse/expand
  const handleToggleExpand = (v) => {
    if (expandedVariantId === v.id) {
      setExpandedVariantId(null);
      setIsEditingExpanded(false);
      resetForm();
    } else {
      setExpandedVariantId(v.id);
      setIsEditingExpanded(false);

      // Load specific variant data
      const parts = v.nama_varian.split(',');
      const initialVals = {};
      variantTypes.forEach((type, idx) => {
        initialVals[type] = parts[idx] || '';
      });
      setOptionValues(initialVals);

      setFormSku(v.sku || '');
      setFormAlternatif(v.nama_alternatif || '');
      setFormBarcode(v.barcode || '');
      setFormQtyStok(String(v.qty_stok || 0));
      setFormBerat(String(v.berat || 0));

      const formatVal = (num) => 'Rp. ' + Math.round(num || 0).toLocaleString('id-ID');
      setFormHargaBeli(formatVal(v.harga_beli));
      setFormHargaPasar(formatVal(v.harga_pasar));
      setFormHargaJualOnline(formatVal(v.harga_jual_online));
      setFormHargaJualToko(formatVal(v.harga_jual_toko));

      // Loaded from backend DB fields
      setFormLoyaltyPoint(String(v.loyalty_points || 0));
      setKomisiIsPersen(v.komisi_is_persen || false);
      if (v.komisi_is_persen) {
        setFormKomisi(String(v.komisi || 0));
      } else {
        setFormKomisi(formatVal(v.komisi));
      }
      setHabisStok(v.habis_stok || false);
      setPilihanDefault(v.pilihan_default || false);
      setOnHoldQty('0'); // Read-only info field
      setQtyFastMoving(String(v.qty_fast_moving || 0));

      // Photo url loaded from backend
      setFormFotoUrl(v.foto || '');
      setFormFotoFile(null);
    }
  };

  // Add a type pill (e.g. warna, ukuran)
  const handleAddType = () => {
    const trimmed = newTypeInput.trim().toLowerCase();
    if (!trimmed) return;
    if (variantTypes.includes(trimmed)) {
      alert('Tipe varian ini sudah ada.');
      return;
    }
    setVariantTypes([...variantTypes, trimmed]);
    setNewTypeInput('');
  };

  // Remove a type pill
  const handleRemoveType = (typeToRemove) => {
    setVariantTypes(variantTypes.filter(t => t !== typeToRemove));
    const newVals = { ...optionValues };
    delete newVals[typeToRemove];
    setOptionValues(newVals);
  };

  const parseFormattedPrice = (valStr) => {
    return parseFloat(String(valStr).replace(/[^0-9]/g, '')) || 0;
  };

  // Create new Variant
  const handleSaveNewVariant = async () => {
    const nameParts = variantTypes.map(t => optionValues[t] || '').filter(Boolean);
    if (nameParts.length !== variantTypes.length) {
      alert('Harap tentukan nilai untuk semua tipe varian!');
      return;
    }
    const namaVarian = nameParts.join(',');

    try {
      setSaving(true);

      const formData = new FormData();
      formData.append('product', product.id);
      formData.append('nama_varian', namaVarian);
      formData.append('nama_alternatif', formAlternatif);
      formData.append('sku', formSku || '');
      formData.append('barcode', formBarcode || '');
      formData.append('harga_beli', parseFormattedPrice(formHargaBeli));
      formData.append('harga_pasar', parseFormattedPrice(formHargaPasar));
      formData.append('harga_jual_online', parseFormattedPrice(formHargaJualOnline));
      formData.append('harga_jual_toko', parseFormattedPrice(formHargaJualToko));
      formData.append('qty_stok', parseFloat(formQtyStok) || 0);
      formData.append('berat', parseFloat(formBerat) || 0);
      
      formData.append('loyalty_points', parseInt(formLoyaltyPoint, 10) || 0);
      formData.append('komisi_is_persen', komisiIsPersen ? 'true' : 'false');
      const rawKomisi = komisiIsPersen ? parseFloat(formKomisi) || 0 : parseFormattedPrice(formKomisi);
      formData.append('komisi', rawKomisi);
      formData.append('habis_stok', habisStok ? 'true' : 'false');
      formData.append('pilihan_default', pilihanDefault ? 'true' : 'false');
      formData.append('qty_fast_moving', parseFloat(qtyFastMoving) || 0);

      if (formFotoFile) {
        formData.append('foto', formFotoFile);
      }

      await apiClient.post('/product-variants/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Varian berhasil ditambahkan!');

      if (!product.has_variant) {
        await apiClient.patch(`/products/${product.id}/`, { has_variant: true });
      }

      const fresh = await apiClient.get(`/products/${product.id}/`);
      onUpdated?.(fresh.data);
      setViewMode('list');
      resetForm();
    } catch (err) {
      console.error('[ProductVariantTab] save error:', err);
      alert('Gagal menyimpan varian baru.');
    } finally {
      setSaving(false);
    }
  };

  // Update expanded variant changes (multipart form data to support file uploads)
  const handleSaveExpandedChanges = async () => {
    const nameParts = variantTypes.map(t => optionValues[t] || '').filter(Boolean);
    if (nameParts.length !== variantTypes.length) {
      alert('Harap tentukan nilai untuk semua tipe varian!');
      return;
    }
    const namaVarian = nameParts.join(',');

    try {
      setSaving(true);
      
      const formData = new FormData();
      formData.append('nama_varian', namaVarian);
      formData.append('nama_alternatif', formAlternatif);
      formData.append('sku', formSku || '');
      formData.append('barcode', formBarcode || '');
      formData.append('harga_beli', parseFormattedPrice(formHargaBeli));
      formData.append('harga_pasar', parseFormattedPrice(formHargaPasar));
      formData.append('harga_jual_online', parseFormattedPrice(formHargaJualOnline));
      formData.append('harga_jual_toko', parseFormattedPrice(formHargaJualToko));
      formData.append('qty_stok', parseFloat(formQtyStok) || 0);
      formData.append('berat', parseFloat(formBerat) || 0);
      
      formData.append('loyalty_points', parseInt(formLoyaltyPoint, 10) || 0);
      formData.append('komisi_is_persen', komisiIsPersen ? 'true' : 'false');
      
      const rawKomisi = komisiIsPersen 
        ? parseFloat(formKomisi) || 0 
        : parseFormattedPrice(formKomisi);
      formData.append('komisi', rawKomisi);
      
      formData.append('habis_stok', habisStok ? 'true' : 'false');
      formData.append('pilihan_default', pilihanDefault ? 'true' : 'false');
      formData.append('qty_fast_moving', parseFloat(qtyFastMoving) || 0);

      // If user selected a new file, upload it. If they removed it, we can clear the photo.
      if (formFotoFile) {
        formData.append('foto', formFotoFile);
      } else if (!formFotoUrl) {
        // Clear photo
        formData.append('foto', '');
      }

      await apiClient.patch(`/product-variants/${expandedVariantId}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      alert('Varian berhasil diperbarui!');

      const fresh = await apiClient.get(`/products/${product.id}/`);
      onUpdated?.(fresh.data);
      setIsEditingExpanded(false);
      setExpandedVariantId(null);
      resetForm();
    } catch (err) {
      console.error('[ProductVariantTab] update error:', err);
      alert('Gagal memperbarui varian.');
    } finally {
      setSaving(false);
    }
  };

  // Delete variant
  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus varian ini?')) return;
    try {
      setSaving(true);
      await apiClient.delete(`/product-variants/${variantId}/`);
      alert('Varian berhasil dihapus!');

      const fresh = await apiClient.get(`/products/${product.id}/`);
      onUpdated?.(fresh.data);
      setExpandedVariantId(null);
      setIsEditingExpanded(false);
      resetForm();
    } catch (err) {
      console.error('[ProductVariantTab] delete error:', err);
      alert('Gagal menghapus varian.');
    } finally {
      setSaving(false);
    }
  };

  // Batch delete selected variants
  const handleBatchDelete = async () => {
    if (selectedVariantIds.length === 0) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus ${selectedVariantIds.length} varian terpilih?`)) return;

    try {
      setSaving(true);
      await Promise.all(selectedVariantIds.map(id => apiClient.delete(`/product-variants/${id}/`)));
      alert('Varian terpilih berhasil dihapus!');

      const fresh = await apiClient.get(`/products/${product.id}/`);
      onUpdated?.(fresh.data);
      setSelectedVariantIds([]);
      setExpandedVariantId(null);
      resetForm();
    } catch (err) {
      console.error('[ProductVariantTab] batch delete error:', err);
      alert('Gagal menghapus beberapa varian.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = filteredVariants.map(v => v.id);
      setSelectedVariantIds(allIds);
    } else {
      setSelectedVariantIds([]);
    }
  };

  const toggleSelectRow = (id) => {
    if (selectedVariantIds.includes(id)) {
      setSelectedVariantIds(selectedVariantIds.filter(x => x !== id));
    } else {
      setSelectedVariantIds([...selectedVariantIds, id]);
    }
  };

  // Filter & Paginate
  const variants = product.variants || [];
  const filteredVariants = variants.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.nama_varian.toLowerCase().includes(query) ||
      (v.sku && v.sku.toLowerCase().includes(query)) ||
      (v.barcode && v.barcode.toLowerCase().includes(query))
    );
  });

  const totalPages = Math.ceil(filteredVariants.length / rowsPerPage) || 1;
  const paginatedVariants = filteredVariants.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  if (viewMode === 'add') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tipe Varian */}
        <Section title="Tambah Tipe Varian">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, maxWidth: 450 }}>
              <input
                type="text"
                placeholder="Type here..."
                value={newTypeInput}
                onChange={(e) => setNewTypeInput(e.target.value)}
                style={{
                  flex: 1,
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleAddType}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 0,
                  borderRadius: 6,
                  padding: '0 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Tambah
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {variantTypes.map(t => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#eff6ff',
                    color: '#1e40af',
                    border: '1px solid #bfdbfe',
                    borderRadius: 20,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  {t}
                  <X
                    size={14}
                    style={{ cursor: 'pointer', color: '#3b82f6' }}
                    onClick={() => handleRemoveType(t)}
                  />
                </span>
              ))}
            </div>
          </div>
        </Section>

        {/* Tentukan Variant */}
        <Section title="Tentukan Variant">
          <div style={{ overflowX: 'auto', paddingBottom: 10 }}>
            <div style={{ display: 'flex', gap: 12, minWidth: 900 }}>
              {/* Dynamic Type Selects */}
              {variantTypes.map((type, typeIdx) => {
                const uniqueVals = getUniqueOptionsForType(typeIdx);
                const isCustom = customValueInputs[type] !== undefined;

                return (
                  <div key={type} style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'capitalize', marginBottom: 6 }}>
                      {type} *
                    </div>
                    {isCustom ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="text"
                          placeholder={`Nilai ${type}...`}
                          value={customValueInputs[type]}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomValueInputs({ ...customValueInputs, [type]: val });
                            setOptionValues({ ...optionValues, [type]: val });
                          }}
                          style={{
                            width: '100%',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            padding: '8px 10px',
                            fontSize: 13,
                            outline: 'none'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const nextCustom = { ...customValueInputs };
                            delete nextCustom[type];
                            setCustomValueInputs(nextCustom);
                            setOptionValues({ ...optionValues, [type]: '' });
                          }}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: 6,
                            width: 32,
                            height: 35,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={optionValues[type] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setCustomValueInputs({ ...customValueInputs, [type]: '' });
                            setOptionValues({ ...optionValues, [type]: '' });
                          } else {
                            setOptionValues({ ...optionValues, [type]: val });
                          }
                        }}
                        style={{
                          width: '100%',
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          padding: '8px 10px',
                          fontSize: 13,
                          outline: 'none',
                          background: '#fff',
                          height: 35
                        }}
                      >
                        <option value="">Pilih salah satu</option>
                        {uniqueVals.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                        <option value="__custom__" style={{ color: '#0284c7', fontWeight: 600 }}>
                          [+] Tambah Baru...
                        </option>
                      </select>
                    )}
                  </div>
                );
              })}

              {/* SKU */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>SKU</div>
                <input
                  type="text"
                  value={formSku}
                  onChange={(e) => setFormSku(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', height: 35 }}
                />
              </div>

              {/* Alternatif */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Alternatif</div>
                <input
                  type="text"
                  value={formAlternatif}
                  onChange={(e) => setFormAlternatif(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', height: 35 }}
                />
              </div>

              {/* Barcode */}
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Barcode</div>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', height: 35 }}
                />
              </div>

              {/* Qty Stok */}
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Qty Stok</div>
                <input
                  type="number"
                  value={formQtyStok}
                  onChange={(e) => setFormQtyStok(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', height: 35 }}
                />
              </div>

              {/* Berat */}
              <div style={{ flex: 1, minWidth: 90 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Berat (gr)</div>
                <input
                  type="number"
                  value={formBerat}
                  onChange={(e) => setFormBerat(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 10px', fontSize: 13, outline: 'none', height: 35 }}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Harga */}
        <Section title="Harga">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Harga Beli</div>
              <PriceInput
                value={formHargaBeli}
                onChange={setFormHargaBeli}
                style={{ width: '100%', height: 38 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Harga Pasar</div>
              <PriceInput
                value={formHargaPasar}
                onChange={setFormHargaPasar}
                style={{ width: '100%', height: 38 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Harga Jual Online</div>
              <PriceInput
                value={formHargaJualOnline}
                onChange={setFormHargaJualOnline}
                style={{ width: '100%', height: 38 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>Harga Jual di Toko</div>
              <PriceInput
                value={formHargaJualToko}
                onChange={setFormHargaJualToko}
                style={{ width: '100%', height: 38 }}
              />
            </div>
          </div>
        </Section>

        {/* Save Footer Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '16px 20px',
          marginTop: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Simpan di:</span>
            <select
              style={{
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: 13,
                background: '#f8fafc',
                outline: 'none',
                cursor: 'default'
              }}
              disabled
            >
              <option>{storeName}</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => { setViewMode('list'); resetForm(); }}
              disabled={saving}
              style={{
                background: '#fff',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '8px 24px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveNewVariant}
              disabled={saving}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 0,
                borderRadius: 6,
                padding: '8px 24px',
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? 'default' : 'pointer'
              }}
            >
              {saving ? 'Menyimpan...' : 'Konfirmasi'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Section
      title="Daftar Variasi"
      headerRight={
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
            {variants.length} Varian Produk
          </span>
          <button
            type="button"
            onClick={handleStartAdd}
            style={{
              background: '#0284c7',
              color: '#fff',
              border: 0,
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={16} /> Tambah Varian
          </button>
        </div>
      }
    >
      {/* List Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleBatchDelete}
            disabled={selectedVariantIds.length === 0}
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: selectedVariantIds.length > 0 ? '#fef2f2' : '#fff',
              color: selectedVariantIds.length > 0 ? '#dc2626' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: selectedVariantIds.length > 0 ? 'pointer' : 'default',
              transition: 'all 0.2s'
            }}
          >
            <Trash2 size={16} />
          </button>

          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 13,
              background: '#fff',
              outline: 'none',
              height: 34
            }}
          >
            <option value={5}>5 Baris</option>
            <option value={10}>10 Baris</option>
            <option value={15}>15 Baris</option>
            <option value={20}>20 Baris</option>
          </select>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 220 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
            <Search size={14} />
          </span>
          <input
            type="text"
            placeholder="Cari"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              padding: '8px 12px 8px 30px',
              fontSize: 13,
              outline: 'none',
              height: 34,
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', height: 42 }}>
              <th style={{ padding: '10px 14px', width: 40, textAlign: 'left' }}>
                <input
                  type="checkbox"
                  checked={filteredVariants.length > 0 && selectedVariantIds.length === filteredVariants.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '10px 14px', width: 50, textAlign: 'left' }}></th>
              <th style={{ padding: '10px 14px', width: 80, textAlign: 'left', fontWeight: 600, color: '#475569' }}>Foto</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Variant</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>SKU</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Qty Stok</th>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Harga</th>
              <th style={{ padding: '10px 14px', width: 50 }}></th>
            </tr>
          </thead>
          <tbody>
            {paginatedVariants.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
                  Tidak ada data varian
                </td>
              </tr>
            ) : (
              paginatedVariants.map((v) => (
                <Fragment key={v.id}>
                  <tr
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      height: 52,
                      background: selectedVariantIds.includes(v.id) ? '#f8fafc' : '#fff',
                      transition: 'background 0.15s'
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        type="checkbox"
                        checked={selectedVariantIds.includes(v.id)}
                        onChange={() => toggleSelectRow(v.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    {/* Reorder cross icon */}
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>
                      ✥
                    </td>
                    {/* Thumbnail box */}
                    <td style={{ padding: '10px 14px' }}>
                      {v.foto ? (
                        <img
                          src={v.foto}
                          alt={v.nama_varian}
                          style={{
                            width: 36,
                            height: 36,
                            objectFit: 'cover',
                            borderRadius: 6,
                            border: '1px solid #e2e8f0'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 36,
                          height: 36,
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#cbd5e1'
                        }}>
                          🖼️
                        </div>
                      )}
                    </td>
                    {/* Varian name */}
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                      {v.nama_varian}
                    </td>
                    {/* SKU */}
                    <td style={{ padding: '10px 14px', color: '#475569' }}>
                      {v.sku || '-'}
                    </td>
                    {/* Qty Stok */}
                    <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>
                      {Math.round(v.qty_stok)} (0)
                    </td>
                    {/* Harga (Online + Toko stacked) */}
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>
                          {Number(v.harga_jual_online).toFixed(2)}
                        </span>
                        <span style={{ color: '#64748b', fontSize: 12 }}>
                          {Number(v.harga_jual_toko).toFixed(2)}
                        </span>
                      </div>
                    </td>
                    {/* Action button (toggles expand) */}
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(v)}
                        style={{
                          background: expandedVariantId === v.id ? '#e2e8f0' : '#f1f5f9',
                          border: 0,
                          borderRadius: '50%',
                          width: 26,
                          height: 26,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: expandedVariantId === v.id ? '#0f172a' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <ChevronRight
                          size={14}
                          style={{
                            transform: expandedVariantId === v.id ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.2s'
                          }}
                        />
                      </button>
                    </td>
                  </tr>

                  {/* Inline Expanded Detail Form */}
                  {expandedVariantId === v.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: '24px 28px',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                        }}>
                          {/* Ubah / Hapus Button Bar */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            {!isEditingExpanded ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setIsEditingExpanded(true)}
                                  style={{
                                    background: '#0284c7',
                                    color: '#fff',
                                    border: 0,
                                    borderRadius: 6,
                                    padding: '8px 20px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Ubah
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariant(v.id)}
                                  style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 0,
                                    borderRadius: 6,
                                    padding: '8px 20px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Hapus
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Simpan di selector tag */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 10 }}>
                                  <span style={{ fontSize: 13, color: '#64748b' }}>Simpan di:</span>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: '#eff6ff',
                                    color: '#1e40af',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: 20,
                                    padding: '4px 12px',
                                    fontSize: 12,
                                    fontWeight: 600
                                  }}>
                                    {storeName}
                                    <span style={{ cursor: 'pointer', color: '#3b82f6', marginLeft: 4 }}>x</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleSaveExpandedChanges}
                                  disabled={saving}
                                  style={{
                                    background: '#22c55e', // Green Simpan button
                                    color: '#fff',
                                    border: 0,
                                    borderRadius: 6,
                                    padding: '8px 20px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingExpanded(false);
                                    // Restore original values
                                    setFormSku(v.sku || '');
                                    setFormAlternatif(v.nama_alternatif || '');
                                    setFormBarcode(v.barcode || '');
                                    setFormQtyStok(String(v.qty_stok || 0));
                                    setFormBerat(String(v.berat || 0));
                                    const formatVal = (num) => 'Rp. ' + Math.round(num || 0).toLocaleString('id-ID');
                                    setFormHargaBeli(formatVal(v.harga_beli));
                                    setFormHargaPasar(formatVal(v.harga_pasar));
                                    setFormHargaJualOnline(formatVal(v.harga_jual_online));
                                    setFormHargaJualToko(formatVal(v.harga_jual_toko));
                                    setFormLoyaltyPoint(String(v.loyalty_points || 0));
                                    setKomisiIsPersen(v.komisi_is_persen || false);
                                    if (v.komisi_is_persen) {
                                      setFormKomisi(String(v.komisi || 0));
                                    } else {
                                      setFormKomisi(formatVal(v.komisi));
                                    }
                                    setHabisStok(v.habis_stok || false);
                                    setPilihanDefault(v.pilihan_default || false);
                                    setQtyFastMoving(String(v.qty_fast_moving || 0));
                                    setFormFotoUrl(v.foto || '');
                                    setFormFotoFile(null);
                                  }}
                                  disabled={saving}
                                  style={{
                                    background: '#fff',
                                    color: '#64748b',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 20px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariant(v.id)}
                                  disabled={saving}
                                  style={{
                                    background: '#ef4444',
                                    color: '#fff',
                                    border: 0,
                                    borderRadius: 6,
                                    padding: '8px 20px',
                                    fontSize: 13,
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </div>

                          {/* Detail Form Grid */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            
                            {/* Varian Foto uploading preview box - only visible in Edit Mode */}
                            {isEditingExpanded && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Varian Foto</span>
                                <input
                                  type="file"
                                  id="variant-foto-input"
                                  accept="image/*"
                                  disabled={!isEditingExpanded}
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      setFormFotoFile(file);
                                      setFormFotoUrl(URL.createObjectURL(file));
                                    }
                                  }}
                                  style={{ display: 'none' }}
                                />
                                <div
                                  onClick={() => {
                                    if (isEditingExpanded) {
                                      document.getElementById('variant-foto-input').click();
                                    }
                                  }}
                                  style={{
                                    width: 100,
                                    height: 100,
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: isEditingExpanded ? 'pointer' : 'default',
                                    background: '#fff',
                                    position: 'relative',
                                    overflow: 'hidden'
                                  }}
                                >
                                  {formFotoUrl ? (
                                    <>
                                      <img src={formFotoUrl} alt="Varian" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      {isEditingExpanded && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setFormFotoFile(null);
                                            setFormFotoUrl('');
                                          }}
                                          style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            background: 'rgba(239, 68, 68, 0.9)',
                                            color: '#fff',
                                            border: 0,
                                            borderRadius: '50%',
                                            width: 18,
                                            height: 18,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            fontSize: 10
                                          }}
                                        >
                                          ✕
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <span style={{ fontSize: 24, color: '#94a3b8' }}>+</span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Dynamic Type Values (e.g. warna, ukuran) */}
                            {variantTypes.map((type, typeIdx) => (
                              <div key={type} style={{ display: 'flex', alignItems: 'center' }}>
                                <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', textTransform: 'capitalize' }}>
                                    {type}
                                  </div>
                                </div>
                                <div style={{ width: '65%' }}>
                                  <input
                                    type="text"
                                    disabled={!isEditingExpanded}
                                    value={optionValues[type] || ''}
                                    onChange={(e) => setOptionValues({ ...optionValues, [type]: e.target.value })}
                                    style={{
                                      width: '100%',
                                      maxWidth: 600,
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 6,
                                      padding: '8px 12px',
                                      fontSize: 13,
                                      background: isEditingExpanded ? '#fff' : '#f8fafc',
                                      color: isEditingExpanded ? '#0f172a' : '#64748b',
                                      outline: 'none',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                              </div>
                            ))}

                            {/* SKU */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>SKU</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                  Stock Keeping Unit berguna dalam pencarian produk dan identifikasi produk
                                </div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled={!isEditingExpanded}
                                  value={formSku}
                                  onChange={(e) => setFormSku(e.target.value)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Alternatif */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Alternatif</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled={!isEditingExpanded}
                                  value={formAlternatif}
                                  onChange={(e) => setFormAlternatif(e.target.value)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Barcode */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Barcode</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled={!isEditingExpanded}
                                  value={formBarcode}
                                  onChange={(e) => setFormBarcode(e.target.value)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Berat */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Berat</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                  Berat produk dalam kilogram (kg). Gunakan titik "." untuk desimal
                                </div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled={!isEditingExpanded}
                                  value={formBerat}
                                  onChange={(e) => setFormBerat(e.target.value)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Loyalty Point */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Loyalty Point</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                  Loyalty point yang diterima per item pembelian
                                </div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled={!isEditingExpanded}
                                  value={formLoyaltyPoint}
                                  onChange={(e) => setFormLoyaltyPoint(e.target.value)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Komisi */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Komisi</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 600 }}>
                                  {komisiIsPersen ? (
                                    <input
                                      type="number"
                                      disabled={!isEditingExpanded}
                                      value={formKomisi}
                                      onChange={(e) => setFormKomisi(e.target.value)}
                                      style={{
                                        flex: 1,
                                        border: '1px solid #cbd5e1',
                                        borderRadius: 6,
                                        padding: '8px 12px',
                                        fontSize: 13,
                                        background: isEditingExpanded ? '#fff' : '#f8fafc',
                                        color: isEditingExpanded ? '#0f172a' : '#64748b',
                                        outline: 'none',
                                        height: 38,
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                  ) : (
                                    <PriceInput
                                      disabled={!isEditingExpanded}
                                      value={formKomisi}
                                      onChange={setFormKomisi}
                                      style={{
                                        flex: 1,
                                        background: isEditingExpanded ? '#fff' : '#f8fafc',
                                        color: isEditingExpanded ? '#0f172a' : '#64748b',
                                        height: 38
                                      }}
                                    />
                                  )}
                                  {isEditingExpanded && (
                                    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setKomisiIsPersen(false);
                                          setFormKomisi('Rp. ' + Math.round(parseFloat(formKomisi) || 0).toLocaleString('id-ID'));
                                        }}
                                        style={{
                                          border: 0,
                                          background: !komisiIsPersen ? '#3b82f6' : '#fff',
                                          color: !komisiIsPersen ? '#fff' : '#64748b',
                                          padding: '8px 16px',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        IDR
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setKomisiIsPersen(true);
                                          setFormKomisi(String(parseFormattedPrice(formKomisi)));
                                        }}
                                        style={{
                                          border: 0,
                                          background: komisiIsPersen ? '#3b82f6' : '#fff',
                                          color: komisiIsPersen ? '#fff' : '#64748b',
                                          padding: '8px 16px',
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        %
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Harga Beli */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Harga Beli</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <PriceInput
                                  disabled={!isEditingExpanded}
                                  value={formHargaBeli}
                                  onChange={setFormHargaBeli}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    height: 38
                                  }}
                                />
                              </div>
                            </div>

                            {/* Harga Pasar */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Harga Pasar</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <PriceInput
                                  disabled={!isEditingExpanded}
                                  value={formHargaPasar}
                                  onChange={setFormHargaPasar}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    height: 38
                                  }}
                                />
                              </div>
                            </div>

                            {/* Harga Jual Online */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Harga Jual Online</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <PriceInput
                                  disabled={!isEditingExpanded}
                                  value={formHargaJualOnline}
                                  onChange={setFormHargaJualOnline}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    height: 38
                                  }}
                                />
                              </div>
                            </div>

                            {/* Harga Jual Toko (POS) */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Harga Jual Toko (POS)</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <PriceInput
                                  disabled={!isEditingExpanded}
                                  value={formHargaJualToko}
                                  onChange={setFormHargaJualToko}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    height: 38
                                  }}
                                />
                              </div>
                            </div>

                            {/* Habis Stok Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Habis Stok</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <label className="pi-switch" style={{ opacity: isEditingExpanded ? 1 : 0.6 }}>
                                  <input
                                    type="checkbox"
                                    checked={habisStok}
                                    disabled={!isEditingExpanded}
                                    onChange={(e) => setHabisStok(e.target.checked)}
                                  />
                                  <span className="pi-slider">
                                    <span className="pi-slider-text">{habisStok ? 'Ya' : 'Tidak'}</span>
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* Pilihan Default Toggle */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Pilihan Default</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <label className="pi-switch" style={{ opacity: isEditingExpanded ? 1 : 0.6 }}>
                                  <input
                                    type="checkbox"
                                    checked={pilihanDefault}
                                    disabled={!isEditingExpanded}
                                    onChange={(e) => setPilihanDefault(e.target.checked)}
                                  />
                                  <span className="pi-slider">
                                    <span className="pi-slider-text">{pilihanDefault ? 'Ya' : 'Tidak'}</span>
                                  </span>
                                </label>
                              </div>
                            </div>

                            {/* On Hold Qty */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>On hold qty</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled
                                  value={onHoldQty}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Qty Fast Moving */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <div style={{ width: '35%', textAlign: 'right', paddingRight: 24, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Qty Fast Moving</div>
                              </div>
                              <div style={{ width: '65%' }}>
                                <input
                                  type="text"
                                  disabled={!isEditingExpanded}
                                  value={qtyFastMoving}
                                  onChange={(e) => setQtyFastMoving(e.target.value)}
                                  style={{
                                    width: '100%',
                                    maxWidth: 600,
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 6,
                                    padding: '8px 12px',
                                    fontSize: 13,
                                    background: isEditingExpanded ? '#fff' : '#f8fafc',
                                    color: isEditingExpanded ? '#0f172a' : '#64748b',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          marginTop: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: currentPage === 1 ? 'default' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              &lt;
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', padding: '0 8px' }}>
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              style={{
                border: '1px solid #cbd5e1',
                background: '#fff',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: currentPage === totalPages ? 'default' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              &gt;
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569' }}>
            <span>Go to</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => {
                const val = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                setCurrentPage(val);
              }}
              style={{
                width: 45,
                height: 28,
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                textAlign: 'center',
                outline: 'none'
              }}
            />
          </div>
        </div>
      )}
    </Section>
  );
}
