import { useState, useEffect } from 'react';
import { Trash2, Check } from 'lucide-react';

export function SpecialCollectionPage() {
  const [collections, setCollections] = useState(() => {
    const saved = localStorage.getItem('special_collections');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse special_collections', e);
      }
    }
    return [
      { id: 'col-1', name: 'Koleksi Hari Raya' },
      { id: 'col-2', name: 'Koleksi Promo' }
    ];
  });

  const [nameInput, setNameInput] = useState('');

  useEffect(() => {
    localStorage.setItem('special_collections', JSON.stringify(collections));
  }, [collections]);

  const handleSaveCollection = (e) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) return;

    const newCol = {
      id: `col-${Date.now()}`,
      name: nameInput.trim()
    };

    setCollections(prev => [...prev, newCol]);
    setNameInput('');
  };

  const handleDeleteCollection = (id) => {
    setCollections(prev => prev.filter(c => c.id !== id));
  };

  const isInputValid = nameInput.trim().length > 0;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '16px', marginBottom: '16px' }}>
        {/* Left Column: Tambah Koleksi Form Card */}
        <form 
          onSubmit={handleSaveCollection}
          style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}
        >
          {/* Header of Tambah Koleksi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Tambah Koleksi</h3>
            <button 
              type="submit"
              disabled={!isInputValid}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isInputValid ? '#0ea5e9' : '#f1f5f9',
                color: isInputValid ? '#ffffff' : '#cbd5e1',
                border: 0,
                borderRadius: '6px',
                padding: '0 16px',
                height: '32px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: isInputValid ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
                boxShadow: isInputValid ? '0 2px 4px rgba(14, 165, 233, 0.15)' : 'none'
              }}
              onMouseOver={(e) => {
                if (isInputValid) e.currentTarget.style.background = '#0284c7';
              }}
              onMouseOut={(e) => {
                if (isInputValid) e.currentTarget.style.background = '#0ea5e9';
              }}
            >
              <Check size={14} />
              <span>Simpan</span>
            </button>
          </div>

          {/* Form Fields Row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ width: '220px', marginRight: '24px', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155' }}>
                Nama Koleksi <span style={{ color: '#ef4444' }}>*</span>
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block', lineHeight: '1.4' }}>
                Nama koleksi produk, e.g. Koleksi Hari Raya, dll.
              </span>
            </div>
            
            <div style={{ flex: 1 }}>
              <input 
                type="text"
                placeholder="" 
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  color: '#334155',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </form>

        {/* Right Column: Daftar Koleksi Card */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          {/* Header of Daftar Koleksi */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Daftar Koleksi</h3>
          </div>

          {collections.length === 0 ? (
            <div style={{ display: 'grid', placeItems: 'center', minHeight: '120px', background: '#f8fafc', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
              Belum ada koleksi ditambahkan.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {collections.map(c => (
                <div 
                  key={c.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#ffffff'
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteCollection(c.id)}
                    style={{
                      border: 0,
                      background: '#fee2e2',
                      color: '#ef4444',
                      borderRadius: '6px',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
