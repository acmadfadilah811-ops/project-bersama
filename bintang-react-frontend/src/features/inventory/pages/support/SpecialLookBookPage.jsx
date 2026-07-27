import { useState, useEffect } from 'react';
import DataTable from '../components/DataTable';
import { Button, PageHeader, Toolbar, StatusBadge } from '../components/PageShell';
import { productRows } from '../productInventoryData';
import { X, Plus, Trash2, Edit, Image as ImageIcon } from 'lucide-react';

export function SpecialLookBookPage() {
  const [lookbooks, setLookbooks] = useState(() => {
    const saved = localStorage.getItem('special_lookbooks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse special_lookbooks', e);
      }
    }
    return [
      { 
        id: 'lb-1', 
        name: 'Katalog Ramadhan 2026', 
        group: 'Ramadhan', 
        image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=300', 
        products: ['PRD-0001', 'PRD-0002'], 
        status: 'Publikasi' 
      },
      { 
        id: 'lb-2', 
        name: 'Katalog Tahun Baru', 
        group: 'Tahun Baru', 
        image: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=300', 
        products: ['PRD-0003'], 
        status: 'Draft' 
      }
    ];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null if adding new, lookbook id if editing

  // Form states
  const [name, setName] = useState('');
  const [group, setGroup] = useState('');
  const [image, setImage] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [status, setStatus] = useState('Draft');

  useEffect(() => {
    localStorage.setItem('special_lookbooks', JSON.stringify(lookbooks));
  }, [lookbooks]);

  // Open modal for creating
  const handleOpenAdd = () => {
    setEditingId(null);
    setName('');
    setGroup('');
    setImage('');
    setSelectedProducts([]);
    setStatus('Draft');
    setShowModal(true);
  };

  // Open modal for editing
  const handleOpenEdit = (lb) => {
    setEditingId(lb.id);
    setName(lb.name);
    setGroup(lb.group);
    setImage(lb.image || '');
    setSelectedProducts(lb.products || []);
    setStatus(lb.status);
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus lookbook ini?')) {
      setLookbooks(prev => prev.filter(lb => lb.id !== id));
    }
  };

  const handleToggleProduct = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      // Edit mode
      setLookbooks(prev => prev.map(lb => {
        if (lb.id === editingId) {
          return {
            ...lb,
            name: name.trim(),
            group: group.trim(),
            image: image.trim(),
            products: selectedProducts,
            status
          };
        }
        return lb;
      }));
    } else {
      // Add mode
      const newLb = {
        id: `lb-${Date.now()}`,
        name: name.trim(),
        group: group.trim(),
        image: image.trim(),
        products: selectedProducts,
        status
      };
      setLookbooks(prev => [...prev, newLb]);
    }

    setShowModal(false);
  };

  // Filter lookbooks list
  const filteredLookbooks = lookbooks.filter(lb => {
    const term = searchQuery.toLowerCase();
    return lb.name.toLowerCase().includes(term) || lb.group.toLowerCase().includes(term);
  });

  const columns = [
    {
      key: 'photo',
      label: 'Foto',
      render: (row) => (
        <div style={{
          width: '50px',
          height: '40px',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {row.image ? (
            <img 
              src={row.image} 
              alt={row.name} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <ImageIcon size={16} style={{ color: '#94a3b8' }} />
          )}
        </div>
      )
    },
    { key: 'name', label: 'Nama' },
    { key: 'group', label: 'Grup' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <StatusBadge 
          active={row.status === 'Publikasi'} 
          label={row.status} 
        />
      )
    },
    {
      key: 'action',
      label: 'Aksi',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleOpenEdit(row)}
            className="pi-icon-button"
            style={{ color: '#0284c7' }}
            title="Edit Lookbook"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="pi-icon-button"
            style={{ color: '#dc2626' }}
            title="Hapus Lookbook"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <>
      <PageHeader 
        title="Look Book" 
        description="Kurasi produk dan gambar untuk etalase website atau katalog online." 
        actions={<Button variant="success" onClick={handleOpenAdd}><Plus size={16} /> Tambah Look Book</Button>} 
      />
      
      <Toolbar 
        searchPlaceholder="Cari berdasarkan nama atau grup..." 
        searchValue={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
      />

      <DataTable
        rows={filteredLookbooks}
        columns={columns}
        emptyText="Belum ada lookbook ditambahkan."
      />

      {/* Form Dialog Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <form onSubmit={handleSave} style={{
            background: '#ffffff',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                {editingId ? 'Edit Look Book' : 'Tambah Look Book'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  border: 0,
                  background: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Nama Look Book *</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Katalog Ramadhan 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Grup / Kategori Lookbook</label>
                <input 
                  type="text" 
                  placeholder="Contoh: Ramadhan atau Kategori Pakaian"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>URL Gambar Lookbook</label>
                <input 
                  type="text" 
                  placeholder="Paste URL gambar (https://...)"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                {image && (
                  <div style={{ marginTop: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Preview Gambar:</div>
                    <img 
                      src={image} 
                      alt="Preview" 
                      style={{ maxWidth: '100%', maxHeight: '120px', borderRadius: '6px', border: '1px solid #cbd5e1', objectFit: 'cover' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Produk dalam Lookbook</label>
                <div style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  background: '#f8fafc'
                }}>
                  {productRows.map(product => (
                    <label key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => handleToggleProduct(product.id)}
                      />
                      <span>{product.name} ({product.sku})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>Status Publikasi</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                >
                  <option value="Draft">Draft</option>
                  <option value="Publikasi">Publikasi</option>
                </select>
              </div>
            </div>

            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#f8fafc'
            }}>
              <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button type="submit" variant="success">
                Simpan
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
