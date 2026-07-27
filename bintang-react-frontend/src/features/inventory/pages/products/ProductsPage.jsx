import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Plus, Trash2, MoreVertical, Upload, Download, Copy, ChevronUp, Check, X, Eye, Boxes, CheckCircle2, History } from 'lucide-react';
import DataTable from '../components/DataTable';
import { Button, PageHeader, Select, StatusBadge, Toolbar } from '../components/PageShell';
import { formatCurrency } from '../productInventoryData';
import { useAuth } from '../../../../context/AuthContext';
import apiClient from '../../../../api/apiClient';
import VariantModal, { PriceInput } from './VariantModal';
import ImportProductModal from './ImportProductModal';
import ImportRecipeModal from './ImportRecipeModal';
import ProductDetailPage from './ProductDetailPage';
import StockDetailModal from './StockDetailModal';
import AvailabilityModal from './AvailabilityModal';
import ProductLogModal from './ProductLogModal';

const rowMenuItemStyle = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px',
  background: 'none', border: 0, textAlign: 'left', fontSize: 13, color: '#334155', cursor: 'pointer',
};

function RowActionMenu({ rowMenu, product, onDetail, onCopy, onStockDetail, onToggleAvailability, onShowLog, onDelete, onClose }) {
  if (!rowMenu || rowMenu.productId !== product.id) return null;
  const { rect } = rowMenu;
  const menuWidth = 190;
  
  // Calculate if the dropdown would go off the screen at the bottom
  const menuHeight = 220; // safe height for the 6 buttons
  const spaceBelow = window.innerHeight - rect.bottom;
  let top = rect.bottom + 4;
  if (spaceBelow < menuHeight && rect.top > menuHeight) {
    top = rect.top - menuHeight - 4;
  }
  
  const left = Math.max(8, rect.right - menuWidth);

  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={onClose} />
      <div
        style={{
          position: 'fixed', top, left, width: menuWidth, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 10px 28px rgba(15,23,42,0.14)',
          zIndex: 200, overflow: 'hidden', padding: '4px 0',
        }}
      >
        <button type="button" className="row-menu-item" onClick={() => { onClose(); onCopy(); }}>
          <Copy size={14} /> Salin
        </button>
        <button type="button" className="row-menu-item" onClick={onDetail}>
          <Eye size={14} /> Detail
        </button>
        <button type="button" className="row-menu-item" onClick={() => { onClose(); onStockDetail(); }}>
          <Boxes size={14} /> Detail Stok
        </button>
        <button type="button" className="row-menu-item" onClick={() => { onClose(); onToggleAvailability(); }}>
          <CheckCircle2 size={14} /> Ubah ketersediaan
        </button>
        <button type="button" className="row-menu-item" onClick={() => { onClose(); onShowLog(); }}>
          <History size={14} /> Log
        </button>
        <button type="button" className="row-menu-item row-menu-item-danger" onClick={onDelete}>
          <Trash2 size={14} /> Hapus
        </button>
      </div>
    </>,
    document.body
  );
}

export default function ProductsPage() {
  const { businessSettings } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isCreating, setIsCreating] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rowMenu, setRowMenu] = useState(null); // { productId, rect }
  const [viewingProduct, setViewingProduct] = useState(null);
  const [initialCopyMode, setInitialCopyMode] = useState(false);
  const [stockDetailProduct, setStockDetailProduct] = useState(null);
  const [availabilityProduct, setAvailabilityProduct] = useState(null);
  const [logProduct, setLogProduct] = useState(null);

  const openAvailabilityModal = (product) => {
    setRowMenu(null);
    setAvailabilityProduct(product);
  };

  const openLogModal = (product) => {
    setRowMenu(null);
    setLogProduct(product);
  };

  const toggleRowMenu = (product, e) => {
    if (rowMenu?.productId === product.id) {
      setRowMenu(null);
    } else {
      setRowMenu({ productId: product.id, rect: e.currentTarget.getBoundingClientRect() });
    }
  };

  const openProductDetail = async (productId) => {
    setRowMenu(null);
    try {
      const res = await apiClient.get(`/products/${productId}/`);
      setViewingProduct(res.data);
    } catch (err) {
      console.error('[ProductsPage] fetch product detail error:', err);
      setError('Gagal memuat detail produk.');
    }
  };
  const copyProduct = async (productId) => {
    setRowMenu(null);
    try {
      const res = await apiClient.get(`/products/${productId}/`);
      setInitialCopyMode(true);
      setViewingProduct(res.data);
    } catch (err) {
      console.error('[ProductsPage] fetch product for copy error:', err);
      setError('Gagal memuat detail produk untuk disalin.');
    }
  };
  const openStockDetail = async (productId) => {
    setRowMenu(null);
    try {
      const res = await apiClient.get(`/products/${productId}/`);
      setStockDetailProduct(res.data);
    } catch (err) {
      console.error('[ProductsPage] fetch product for stock detail error:', err);
      setError('Gagal memuat detail stok produk.');
    }
  };
  const closeProductDetail = () => {
    setViewingProduct(null);
    setInitialCopyMode(false);
    fetchProducts();
  };

  const handleToggleAvailability = async (product) => {
    setRowMenu(null);
    try {
      await apiClient.patch(`/products/${product.id}/`, { tersedia_online: !product.tersedia_online });
      await fetchProducts();
    } catch (err) {
      console.error('[ProductsPage] toggle availability error:', err);
      setError('Gagal mengubah ketersediaan produk.');
    }
  };

  const handleDeleteRow = async (product) => {
    setRowMenu(null);
    if (!window.confirm(`Hapus produk "${product.nama}"?`)) return;
    try {
      await apiClient.delete(`/products/${product.id}/`);
      await fetchProducts();
    } catch (err) {
      console.error('[ProductsPage] delete product error:', err);
      setError('Gagal menghapus produk.');
    }
  };

  const [showImportProductModal, setShowImportProductModal] = useState(false);
  const [showImportRecipeModal, setShowImportRecipeModal] = useState(false);
  const [importModalTitle, setImportModalTitle] = useState('Import Produk');

  // Inline edit harga langsung di tabel (klik nilai -> input + konfirmasi/batal)
  const [editingCell, setEditingCell] = useState(null); // { productId, variantId, field }
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState(false);

  const startEditCell = (productId, variantId, field, currentValue) => {
    setEditingCell({ productId, variantId, field });
    setEditValue(currentValue ? `Rp. ${Number(currentValue).toLocaleString('id-ID')}` : 'Rp. 0');
  };
  const cancelEditCell = () => {
    setEditingCell(null);
    setEditValue('');
  };
  const confirmEditCell = async () => {
    if (!editingCell || savingCell) return;
    const digits = editValue.replace(/\D/g, '');
    const numericValue = digits ? parseInt(digits, 10) : 0;
    const { productId, variantId, field } = editingCell;
    setSavingCell(true);
    try {
      if (variantId) {
        await apiClient.patch(`/product-variants/${variantId}/`, { [field]: numericValue });
      } else {
        await apiClient.patch(`/products/${productId}/`, { [field]: numericValue });
      }
      await fetchProducts();
      setEditingCell(null);
      setEditValue('');
    } catch (err) {
      console.error('[ProductsPage] update price error:', err);
      setError('Gagal menyimpan perubahan harga.');
    } finally {
      setSavingCell(false);
    }
  };

  const renderPriceColumn = (row, field) => {
    const items =
      row.has_variant && row.variants?.length > 0
        ? row.variants.map((v) => ({ id: v.id, isVariant: true, value: v[field] }))
        : [{ id: row.id, isVariant: false, value: row[field] }];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item) => {
          const isEditing =
            editingCell?.productId === row.id &&
            editingCell?.variantId === (item.isVariant ? item.id : null) &&
            editingCell?.field === field;

          if (isEditing) {
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <PriceInput value={editValue} onChange={setEditValue} style={{ width: 90 }} />
                <button
                  type="button"
                  onClick={confirmEditCell}
                  disabled={savingCell}
                  style={{ width: 22, height: 22, borderRadius: 6, border: 0, background: '#16a34a', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: savingCell ? 'default' : 'pointer', flexShrink: 0 }}
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  onClick={cancelEditCell}
                  disabled={savingCell}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: savingCell ? 'default' : 'pointer', flexShrink: 0 }}
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            );
          }

          return (
            <span
              key={item.id}
              onClick={() => startEditCell(row.id, item.isVariant ? item.id : null, field, item.value)}
              style={{ cursor: 'pointer', textDecoration: 'underline dashed', textUnderlineOffset: 3, color: '#0ea5e9' }}
            >
              {formatCurrency(item.value)}
            </span>
          );
        })}
      </div>
    );
  };

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('');

  // Form states matching screenshot
  const [formNama, setFormNama] = useState('');
  const [formNamaAlt, setFormNamaAlt] = useState('');
  const [formKategori, setFormKategori] = useState('');
  const [formHargaToko, setFormHargaToko] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [onlinePriceSame, setOnlinePriceSame] = useState(true);
  const [trackInventory, setTrackInventory] = useState(false);
  const [formRack, setFormRack] = useState('');
  const [formQtyStok, setFormQtyStok] = useState('');
  const [formStokMinimum, setFormStokMinimum] = useState('');
  const [formQtyFastMoving, setFormQtyFastMoving] = useState('');
  const [hasVariants, setHasVariants] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantTrackInventory, setVariantTrackInventory] = useState(false);
  const [variantTypes, setVariantTypes] = useState([{ name: '', values: [] }]);
  const [variantRows, setVariantRows] = useState([]);
  const [removedVariantLabels, setRemovedVariantLabels] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  const updateVariantTypeName = (idx, name) =>
    setVariantTypes((prev) => prev.map((t, i) => (i === idx ? { ...t, name } : t)));
  const addVariantTypeValue = (idx, value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setVariantTypes((prev) =>
      prev.map((t, i) => (i === idx && !t.values.includes(trimmed) ? { ...t, values: [...t.values, trimmed] } : t))
    );
  };
  const removeVariantTypeValue = (idx, value) =>
    setVariantTypes((prev) => prev.map((t, i) => (i === idx ? { ...t, values: t.values.filter((v) => v !== value) } : t)));
  const addVariantType = () => setVariantTypes((prev) => [...prev, { name: '', values: [] }]);
  const removeVariantType = (idx) => setVariantTypes((prev) => prev.filter((_, i) => i !== idx));
  const updateVariantRow = (label, key, value) =>
    setVariantRows((prev) => prev.map((r) => (r.label === label ? { ...r, [key]: value } : r)));
  const removeVariantRow = (label) => {
    setRemovedVariantLabels((prev) => [...prev, label]);
    setVariantRows((prev) => prev.filter((r) => r.label !== label));
  };

  useEffect(() => {
    if (!hasVariants) return;
    const cleaned = variantTypes
      .map((t) => ({ name: t.name.trim(), values: t.values }))
      .filter((t) => t.name && t.values.length > 0);
    // Urutan mengikuti Olsera: tipe yang ditambahkan belakangan berganti paling lambat (outer loop),
    // tipe yang ditambahkan duluan berganti paling cepat (inner loop) — mis. warna,ukuran -> hijau,s / biru,s / hijau,m / biru,m
    const labels = cleaned.length
      ? [...cleaned]
          .reverse()
          .reduce((acc, type) => acc.flatMap((combo) => type.values.map((v) => [v, ...combo])), [[]])
          .map((combo) => combo.join(','))
      : [];
    setVariantRows((prev) => {
      const prevByLabel = Object.fromEntries(prev.map((r) => [r.label, r]));
      return labels
        .filter((label) => !removedVariantLabels.includes(label))
        .map(
          (label) =>
            prevByLabel[label] || {
              label,
              nama_alternatif: '',
              barcode: '',
              sku: '',
              harga_beli: '',
              harga_pasar: '',
              harga_jual_online: '',
              harga_jual_toko: '',
              berat: '1',
              qty_stok: '',
              rack: '',
            }
        );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantTypes, hasVariants]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search) params.search = search;
      if (categoryFilter) params.kategori = categoryFilter;
      const res = await apiClient.get('/products/', { params });
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      let filtered = brandFilter ? data.filter((p) => String(p.brand) === String(brandFilter)) : data;
      if (collectionFilter) {
        filtered = filtered.filter((p) => String(p.koleksi) === String(collectionFilter));
      }
      setProducts(filtered);
    } catch (err) {
      console.error('[ProductsPage] fetch products error:', err);
      setError('Gagal memuat daftar produk.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [catRes, brandRes, collRes] = await Promise.all([
          apiClient.get('/product-categories/'),
          apiClient.get('/brands/'),
          apiClient.get('/collections/'),
        ]);
        setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data?.results || []);
        setBrands(Array.isArray(brandRes.data) ? brandRes.data : brandRes.data?.results || []);
        setCollections(Array.isArray(collRes.data) ? collRes.data : collRes.data?.results || []);
      } catch (err) {
        console.error('[ProductsPage] fetch categories/brands/collections error:', err);
      }
    })();
  }, []);

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, brandFilter, collectionFilter]);

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(products.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const resetForm = () => {
    setFormNama('');
    setFormNamaAlt('');
    setFormKategori('');
    setFormHargaToko('');
    setFormDeskripsi('');
    setOnlinePriceSame(true);
    setTrackInventory(false);
    setFormRack('');
    setFormQtyStok('');
    setFormStokMinimum('');
    setFormQtyFastMoving('');
    setHasVariants(false);
    setShowVariantModal(false);
    setVariantTrackInventory(false);
    setVariantTypes([{ name: '', values: [] }]);
    setVariantRows([]);
    setRemovedVariantLabels([]);
    setDetailOpen(false);
    setSelectedPhoto(null);
    setPhotoPreviewUrl(null);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSaveProduct = async () => {
    if (!formNama.trim() || saving) return;
    setSaving(true);
    try {
      const trackingAtProductLevel = trackInventory;
      const res = await apiClient.post('/products/', {
        nama: formNama,
        nama_alternatif: formNamaAlt || null,
        kategori: formKategori || null,
        harga_jual_toko: String(formHargaToko || '').replace(/[^0-9]/g, '') || 0,
        harga_online_sama: onlinePriceSame,
        lacak_inventori: trackInventory,
        rack: trackingAtProductLevel ? formRack || '' : '',
        qty_stok: trackingAtProductLevel ? formQtyStok || 0 : 0,
        stok_minimum: trackingAtProductLevel ? formStokMinimum || 0 : 0,
        qty_fast_moving: trackingAtProductLevel ? formQtyFastMoving || 0 : 0,
        has_variant: hasVariants,
        deskripsi: formDeskripsi || null,
      });
      if (hasVariants && variantRows.length > 0) {
        await Promise.all(
          variantRows.map((row) =>
            apiClient.post('/product-variants/', {
              product: res.data.id,
              nama_varian: row.label,
              nama_alternatif: row.nama_alternatif || null,
              barcode: row.barcode || null,
              sku: row.sku || null,
              harga_beli: String(row.harga_beli || '').replace(/[^0-9]/g, '') || 0,
              harga_pasar: String(row.harga_pasar || '').replace(/[^0-9]/g, '') || 0,
              harga_jual_online: String(row.harga_jual_online || '').replace(/[^0-9]/g, '') || 0,
              harga_jual_toko: String(row.harga_jual_toko || '').replace(/[^0-9]/g, '') || 0,
              lacak_inventori: variantTrackInventory,
              qty_stok: variantTrackInventory ? row.qty_stok || 0 : 0,
              rack: variantTrackInventory ? row.rack || '' : '',
              berat: row.berat || null,
            })
          )
        );
      }
      if (selectedPhoto) {
        const fd = new FormData();
        fd.append('product', res.data.id);
        fd.append('is_primary', 'true');
        fd.append('foto', selectedPhoto);
        await apiClient.post('/product-images/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      resetForm();
      setIsCreating(false);
      await fetchProducts();
    } catch (err) {
      console.error('[ProductsPage] create product error:', err);
      setError('Gagal menyimpan produk.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map((id) => apiClient.delete(`/products/${id}/`)));
      setSelectedIds([]);
      await fetchProducts();
    } catch (err) {
      console.error('[ProductsPage] delete products error:', err);
      setError('Gagal menghapus produk terpilih.');
    }
  };

  const handleExportProducts = async () => {
    try {
      const res = await apiClient.get('/export/products/', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `products_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('[ProductsPage] Export products error:', err);
      setError('Gagal mengekspor data produk.');
    }
  };

  // Produk dengan varian: setiap kolom terkait (SKU/Barcode/Qty/Harga) menampilkan nilai
  // per-varian bertumpuk, karena datanya memang tersimpan di masing-masing ProductVariant,
  // bukan di Product itu sendiri (yang tetap kosong/0 untuk produk berv arian).
  const renderStacked = (row, getValue) => {
    if (row.has_variant && row.variants?.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {row.variants.map((v) => (
            <span key={v.id}>{getValue(v)}</span>
          ))}
        </div>
      );
    }
    return getValue(row);
  };

  const columns = [
    {
      key: 'select',
      width: 50,
      label: (
        <input
          type="checkbox"
          checked={selectedIds.length === products.length && products.length > 0}
          onChange={toggleSelectAll}
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelectRow(row.id)}
        />
      ),
    },
    {
      key: 'photo',
      label: 'Foto',
      width: 80,
      render: (row) => (
        row.fotos?.[0]?.foto ? (
          <img src={row.fotos[0].foto} alt={row.nama} className="pi-product-thumb" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="pi-product-thumb" />
        )
      ),
    },
    {
      key: 'nama',
      label: 'Nama Produk',
      width: 250,
      render: (row) => (
        <div>
          <div
            className="clickable-product-name"
            onClick={() => openProductDetail(row.id)}
            style={{ fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
          >
            {row.nama}
          </div>
          {row.nama_alternatif && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{row.nama_alternatif}</div>
          )}
          {row.kategori_nama && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{row.kategori_nama}</div>
          )}
        </div>
      ),
    },
    {
      key: 'variant',
      label: 'Variant',
      width: 120,
      render: (row) =>
        row.has_variant && row.variants?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {row.variants.map((v) => (
              <span key={v.id}>{v.nama_varian}</span>
            ))}
          </div>
        ) : (
          '-'
        ),
    },
    { key: 'sku', label: 'SKU', width: 150, render: (row) => renderStacked(row, (r) => r.sku || '-') },
    { key: 'barcode', label: 'Barcode', width: 150, render: (row) => renderStacked(row, (r) => r.barcode || '-') },
    { key: 'qty_stok', label: 'Qty Stok', width: 120, render: (row) => renderStacked(row, (r) => (r.lacak_inventori ? r.qty_stok : '-')) },
    { key: 'satuan', label: 'Satuan', width: 100 },
    { key: 'harga_beli', label: 'Harga Beli', width: 190, render: (row) => renderPriceColumn(row, 'harga_beli') },
    { key: 'harga_jual_toko', label: 'Harga Jual di Toko', width: 200, render: (row) => renderPriceColumn(row, 'harga_jual_toko') },
    { key: 'harga_jual_online', label: 'Harga Jual Online', width: 200, render: (row) => renderPriceColumn(row, 'harga_jual_online') },
    { key: 'tersedia_online', label: 'Tersedia Online', width: 150, render: (row) => <StatusBadge active={row.tersedia_online} label={row.tersedia_online ? 'Ya' : 'Tidak'} /> },
    {
      key: 'action',
      label: '',
      width: 60,
      render: (row) => (
        <>
          <button className="pi-icon-button" onClick={(e) => toggleRowMenu(row, e)}>
            <MoreHorizontal size={16} />
          </button>
          <RowActionMenu
            rowMenu={rowMenu}
            product={row}
            onDetail={() => openProductDetail(row.id)}
            onCopy={() => copyProduct(row.id)}
            onStockDetail={() => openStockDetail(row.id)}
            onToggleAvailability={() => openAvailabilityModal(row)}
            onShowLog={() => openLogModal(row)}
            onDelete={() => handleDeleteRow(row)}
            onClose={() => setRowMenu(null)}
          />
        </>
      ),
    },
  ];

  if (viewingProduct) {
    return (
      <ProductDetailPage
        product={viewingProduct}
        onBack={closeProductDetail}
        onUpdated={setViewingProduct}
        categories={categories}
        brands={brands}
        storeName={businessSettings?.nama_bisnis || 'Bintang Advertising'}
        initialCopyMode={initialCopyMode}
      />
    );
  }

  if (isCreating) {
    return (
      <div className="pi-create-container">
        <div className="pi-create-header">
          <h2>Tambah Produk</h2>
          <div className="pi-create-actions">
            <button className="pi-btn pi-btn-secondary" onClick={() => { resetForm(); setIsCreating(false); }}>
              Batal
            </button>
            <div className="pi-store-select-group">
              <span>Simpan di:</span>
              <select className="pi-store-select">
                <option>{businessSettings?.nama_bisnis || 'Bintang Advertising'}</option>
              </select>
            </div>
            <button
              className="pi-btn pi-btn-secondary"
              disabled={!formNama.trim() || saving}
              onClick={handleSaveProduct}
              style={!formNama.trim() || saving ? { background: '#e2e8f0', color: '#94a3b8', border: '0' } : undefined}
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>

        <div className="pi-form-rows">
          {/* Gambar Produk */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Gambar Produk</span>
              <span className="pi-row-desc">
                Rekomendasi: 3-5 Gambar Produk. Gunakan foto terbaik untuk produk ini. (Format: JPG, JPEG, PNG, WEBP, max 2 MB)
              </span>
            </div>
            <div className="pi-row-input">
              <label className="pi-upload-square" style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {photoPreviewUrl ? (
                  <img src={photoPreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Plus size={24} />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Nama Produk */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Nama Produk</span>
              <span className="pi-row-desc">
                Tulis nama produk sesuai jenis, merek, dan varian produk *
              </span>
            </div>
            <div className="pi-row-input">
              <input type="text" placeholder="Masukkan Nama Produk" value={formNama} onChange={(e) => setFormNama(e.target.value)} />
            </div>
          </div>

          {/* Nama Produk Alternatif */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Nama Produk Alternatif</span>
              <span className="pi-row-desc">
                Tulis alternatif nama produk dalam bahasa Mandarin / Latin
              </span>
            </div>
            <div className="pi-row-input">
              <input type="text" placeholder="Masukkan Nama Produk Alternatif" value={formNamaAlt} onChange={(e) => setFormNamaAlt(e.target.value)} />
            </div>
          </div>

          {/* Kategori Produk */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Kategori Produk</span>
              <span className="pi-row-desc">
                Pilih dari yang ada atau tambahkan yang baru
              </span>
            </div>
            <div className="pi-row-input">
              <select value={formKategori} onChange={(e) => setFormKategori(e.target.value)}>
                <option value="" disabled>Pilih salah satu</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nama}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Harga Jual di Toko */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Harga Jual di Toko</span>
            </div>
            <div className="pi-row-input">
              <PriceInput placeholder="Rp. 0,00" value={formHargaToko} onChange={(val) => setFormHargaToko(val)} style={{ width: '100%' }} />
            </div>
          </div>

          {/* Harga jual online sama dengan harga jual toko */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Harga jual online sama dengan harga jual toko</span>
            </div>
            <div className="pi-row-input">
              <label className="pi-switch">
                <input
                  type="checkbox"
                  checked={onlinePriceSame}
                  onChange={(e) => setOnlinePriceSame(e.target.checked)}
                />
                <span className="pi-slider">
                  <span className="pi-slider-text">{onlinePriceSame ? 'Ya' : 'Tidak'}</span>
                </span>
              </label>
            </div>
          </div>

          {/* Lacak Inventori */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Lacak Inventori</span>
              <span className="pi-row-desc">
                Jika anda mengaktifkan lacak inventori, sistem akan mengecek ketersediaan stok barang sebelum menjual ke pembeli
              </span>
            </div>
            <div className="pi-row-input">
              <label className="pi-switch">
                <input
                  type="checkbox"
                  checked={trackInventory}
                  onChange={(e) => setTrackInventory(e.target.checked)}
                />
                <span className="pi-slider">
                  <span className="pi-slider-text">{trackInventory ? 'Ya' : 'Tidak'}</span>
                </span>
              </label>
            </div>
          </div>

          {trackInventory && (
            <>
              <div className="pi-create-row">
                <div className="pi-row-label-desc">
                  <span className="pi-row-label">Rack</span>
                </div>
                <div className="pi-row-input">
                  <input type="text" placeholder="Masukkan Rack" value={formRack} onChange={(e) => setFormRack(e.target.value)} />
                </div>
              </div>
              <div className="pi-create-row">
                <div className="pi-row-label-desc">
                  <span className="pi-row-label">Jumlah stok yang tersedia saat ini</span>
                  <span className="pi-row-desc">
                    Jika produk ini memiliki beberapa varian/pilihan, maka sistem akan mengecek ketersediaan stok berdasarkan masing-masing varian/pilihan.
                  </span>
                </div>
                <div className="pi-row-input">
                  <input type="text" placeholder="Masukkan angka contoh: 1234" value={formQtyStok} onChange={(e) => setFormQtyStok(e.target.value)} />
                </div>
              </div>
              <div className="pi-create-row">
                <div className="pi-row-label-desc">
                  <span className="pi-row-label">Peringatan Sisa Stok</span>
                  <span className="pi-row-desc">Jika stok sudah mencapai batas, maka sistem akan memberi peringatan sebelum stok habis</span>
                </div>
                <div className="pi-row-input">
                  <input type="text" placeholder="Masukkan angka contoh: 1234" value={formStokMinimum} onChange={(e) => setFormStokMinimum(e.target.value)} />
                </div>
              </div>
              <div className="pi-create-row">
                <div className="pi-row-label-desc">
                  <span className="pi-row-label">Qty Fast Moving</span>
                </div>
                <div className="pi-row-input">
                  <input type="text" placeholder="Masukkan angka contoh: 1234" value={formQtyFastMoving} onChange={(e) => setFormQtyFastMoving(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Varian */}
          <div className="pi-create-row">
            <div className="pi-row-label-desc">
              <span className="pi-row-label">Varian</span>
              <span className="pi-row-desc">
                Aktifkan jika produk memiliki varian misalnya varian, warna atau ukuran
              </span>
            </div>
            <div className="pi-row-input">
              <label className="pi-switch">
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={(e) => setHasVariants(e.target.checked)}
                />
                <span className="pi-slider">
                  <span className="pi-slider-text">{hasVariants ? 'Ya' : 'Tidak'}</span>
                </span>
              </label>
            </div>
          </div>

          {hasVariants && (
            <div className="pi-create-row">
              <div className="pi-row-label-desc">
                <span className="pi-row-label">Kelola Varian</span>
                <span className="pi-row-desc">Atur tipe varian (mis. Warna, Ukuran) dan detail tiap kombinasinya</span>
              </div>
              <div className="pi-row-input" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                {variantRows.length === 0 && (
                  <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>(Varian harus diisi)</span>
                )}
                <button type="button" className="pi-btn pi-btn-secondary" onClick={() => setShowVariantModal(true)}>
                  Manage Variant
                </button>
                {variantRows.length > 0 && (
                  <span style={{ fontSize: 12, color: '#64748b' }}>{variantRows.length} varian dikonfigurasi</span>
                )}
              </div>
            </div>
          )}
        </div>

        <VariantModal
          open={showVariantModal}
          onClose={() => setShowVariantModal(false)}
          variantTypes={variantTypes}
          onUpdateTypeName={updateVariantTypeName}
          onAddTypeValue={addVariantTypeValue}
          onRemoveTypeValue={removeVariantTypeValue}
          onAddType={addVariantType}
          onRemoveType={removeVariantType}
          variantRows={variantRows}
          onUpdateRow={updateVariantRow}
          onRemoveRow={removeVariantRow}
          trackInventory={variantTrackInventory}
          onTrackInventoryChange={setVariantTrackInventory}
          storeName={businessSettings?.nama_bisnis || 'Bintang Advertising'}
        />

        {/* Informasi Detail Collapsible */}
        <div className="pi-collapsible-section">
          <button className="pi-collapsible-trigger" onClick={() => setDetailOpen(!detailOpen)}>
            <span>Informasi Detail (opsional)</span>
            {detailOpen ? <ChevronUp size={16} /> : <Plus size={16} />}
          </button>
          {detailOpen && (
            <div className="pi-collapsible-content">
              <div className="pi-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <label>
                  Deskripsi Produk
                  <textarea
                    placeholder="Masukkan deskripsi produk..."
                    value={formDeskripsi}
                    onChange={(e) => setFormDeskripsi(e.target.value)}
                    style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', minHeight: '100px', font: 'inherit', width: '100%', boxSizing: 'border-box' }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .row-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 9px 14px;
          background: none;
          border: 0;
          text-align: left;
          font-size: 13px;
          color: #334155;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .row-menu-item:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }
        .row-menu-item-danger {
          color: #dc2626;
        }
        .row-menu-item-danger:hover {
          background-color: #fef2f2;
          color: #991b1b;
        }
        .clickable-product-name {
          color: #2563eb;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.15s, text-decoration 0.15s;
        }
        .clickable-product-name:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
      `}</style>
      <PageHeader
        title="Produk"
        description="Kelola katalog produk jual, harga, SKU, barcode, varian, dan status online."
        actions={<Button variant="success" onClick={() => setIsCreating(true)}><Plus size={16} /> Tambah Produk</Button>}
      />
      <Toolbar
        searchPlaceholder="Cari Produk / SKU / Barcode"
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        left={
          <>
            <button
              className="pi-btn-icon-only"
              title="Hapus Terpilih"
              disabled={selectedIds.length === 0}
              onClick={handleDeleteSelected}
            >
              <Trash2 size={16} />
            </button>
            <div className="pi-dropdown-container">
              <button
                className="pi-btn-icon-only"
                title="Fitur Lainnya"
                onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              >
                <MoreVertical size={16} />
              </button>
              {moreMenuOpen && (
                <div className="pi-dropdown-menu">
                  <button
                    className="pi-dropdown-item"
                    onClick={() => {
                      setImportModalTitle('Import Produk');
                      setShowImportProductModal(true);
                      setMoreMenuOpen(false);
                    }}
                  >
                    <Upload size={14} /> Import Produk
                  </button>
                  <button
                    className="pi-dropdown-item"
                    onClick={() => {
                      setShowImportRecipeModal(true);
                      setMoreMenuOpen(false);
                    }}
                  >
                    <Upload size={14} /> Import Bahan / Resep
                  </button>
                  <button
                    className="pi-dropdown-item"
                    onClick={() => {
                      handleExportProducts();
                      setMoreMenuOpen(false);
                    }}
                  >
                    <Download size={14} /> Export
                  </button>
                  <button
                    className="pi-dropdown-item"
                    onClick={() => {
                      setImportModalTitle('Salin Product');
                      setShowImportProductModal(true);
                      setMoreMenuOpen(false);
                    }}
                  >
                    <Copy size={14} /> Salin Product
                  </button>
                </div>
              )}
            </div>
            <select className="pi-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Kategori</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.nama}</option>
              ))}
            </select>
            <select className="pi-select" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
              <option value="">Brand</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.nama}</option>
              ))}
            </select>
            <select className="pi-select" value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)}>
              <option value="">Koleksi</option>
              {collections.map((coll) => (
                <option key={coll.id} value={coll.id}>{coll.nama}</option>
              ))}
            </select>
          </>
        }
        right={
          <Button variant="success" onClick={() => setIsCreating(true)}>
            <Plus size={16} /> Tambah
          </Button>
        }
      />

      {error && <p className="pi-table-error" style={{ color: '#dc2626', fontSize: 13, margin: '8px 0' }}>{error}</p>}

      <DataTable columns={columns} rows={products} emptyText={loading ? 'Memuat...' : 'Tidak ada data'} />

      <div className="pi-pagination-container">
        <div className="pi-pagination-left">
          <button
            className="pi-btn-icon-only"
            title="Hapus Terpilih"
            disabled={selectedIds.length === 0}
            onClick={handleDeleteSelected}
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div className="pi-pagination-right">
          <Select defaultValue="10">
            <option value="10">10/page</option>
            <option value="20">20/page</option>
            <option value="50">50/page</option>
          </Select>
          <span>Total {products.length}</span>
          <div className="pi-pagination-pages">
            <button className="pi-pagination-btn" disabled>&lt;</button>
            <span className="pi-pagination-active-page">1</span>
            <button className="pi-pagination-btn" disabled>&gt;</button>
          </div>
          <div className="pi-pagination-goto">
            <span>Go to</span>
            <input type="text" defaultValue="1" readOnly style={{ width: '40px', textAlign: 'center', height: '28px', border: '1px solid #e2e8f0', borderRadius: '6px' }} />
          </div>
        </div>
      </div>

      <ImportProductModal
        open={showImportProductModal}
        onClose={() => setShowImportProductModal(false)}
        onSuccess={fetchProducts}
        title={importModalTitle}
      />

      <ImportRecipeModal
        open={showImportRecipeModal}
        onClose={() => setShowImportRecipeModal(false)}
        onSuccess={fetchProducts}
      />

      <StockDetailModal
        open={!!stockDetailProduct}
        onClose={() => setStockDetailProduct(null)}
        product={stockDetailProduct}
      />

      <AvailabilityModal
        open={!!availabilityProduct}
        onClose={() => setAvailabilityProduct(null)}
        product={availabilityProduct}
        onSuccess={fetchProducts}
      />

      <ProductLogModal
        open={!!logProduct}
        onClose={() => setLogProduct(null)}
        product={logProduct}
      />
    </>
  );
}
