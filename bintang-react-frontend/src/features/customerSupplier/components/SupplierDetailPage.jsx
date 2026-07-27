import React, { useState } from 'react';
import { Edit2, ArrowLeft, Trash2 } from 'lucide-react';

export default function SupplierDetailPage({ supplier, onEdit, onDelete, onBack }) {
  const [activeSubTab, setActiveSubTab] = useState('profil'); // 'profil', 'produk'

  const subTabStyle = (tabId) => ({
    padding: '12px 24px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: activeSubTab === tabId ? '#1e293b' : '#64748b',
    borderBottom: activeSubTab === tabId ? '2px solid #0ea5e9' : 'none',
    cursor: 'pointer',
    background: 'transparent',
    border: 0,
    outline: 'none'
  });

  const detailLabelStyle = {
    fontSize: '11px',
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: '2px',
    display: 'block'
  };

  const detailValueStyle = {
    fontSize: '13px',
    color: '#1e293b',
    fontWeight: '500',
    wordBreak: 'break-word',
    display: 'block'
  };

  const cardStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  };

  const sectionTitleStyle = {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#0ea5e9', // Blue headers matching screenshot
    marginBottom: '10px'
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100%' }}>
      {/* Top Header */}
      <div style={{ marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          Pelanggan dan Supplier / Rincian Supplier
        </span>
      </div>

      {/* Profile & Product Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('profil')}
          style={subTabStyle('profil')}
        >
          Profil
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('produk')}
          style={subTabStyle('produk')}
        >
          Produk
        </button>
      </div>

      {activeSubTab === 'profil' && (
        <div>
          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>
              {supplier.nama}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: '#ffffff',
                  border: '1px solid #82c341', // green border
                  color: '#82c341', // green text
                  borderRadius: '6px',
                  padding: '0 16px',
                  height: '34px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={14} />
                <span>Kembali</span>
              </button>
              
              <button
                type="button"
                onClick={() => onEdit(supplier)}
                style={{
                  background: '#0ea5e9', // blue
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '6px',
                  padding: '0 16px',
                  height: '34px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Edit2 size={14} />
                <span>Ubah</span>
              </button>
            </div>
          </div>

          {/* Profil Columns Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' }}>
            
            {/* Column 1: Rincian Supplier */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Rincian Supplier</h3>
              <div>
                <span style={detailLabelStyle}>Personal Yg Dihubungi</span>
                <span style={detailValueStyle}>{supplier.kontak_pic || '-'}</span>
              </div>
              <div>
                <span style={detailLabelStyle}>Telpon</span>
                <span style={detailValueStyle}>{supplier.phone || '-'}</span>
              </div>
              <div>
                <span style={detailLabelStyle}>Email</span>
                <span style={detailValueStyle}>{supplier.email || '-'}</span>
              </div>
            </div>

            {/* Column 2: Alamat */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Alamat</h3>
              <div>
                <span style={detailValueStyle}>
                  {supplier.alamat ? (
                    <>
                      {supplier.alamat}
                      {supplier.kota && `, ${supplier.kota}`}
                      {supplier.provinsi && `, ${supplier.provinsi}`}
                      {supplier.negara && `, ${supplier.negara}`}
                      {supplier.kode_pos && ` (${supplier.kode_pos})`}
                    </>
                  ) : (
                    '-'
                  )}
                </span>
              </div>
            </div>

            {/* Column 3: Catatan */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Catatan</h3>
              <div>
                <span style={detailValueStyle}>{supplier.catatan || 'Tidak ada'}</span>
              </div>
            </div>

            {/* Column 4: Logo Supplier */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ ...sectionTitleStyle, width: '100%', textAlign: 'center' }}>Logo Supplier</h3>
              
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                {localStorage.getItem(`supplier_photo_${supplier.id}`) ? (
                  <img
                    src={localStorage.getItem(`supplier_photo_${supplier.id}`)}
                    alt={supplier.nama}
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  />
                ) : (
                  <svg viewBox="0 0 100 100" width="100" height="100">
                    {/* Base Line */}
                    <line x1="10" y1="85" x2="90" y2="85" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
                    {/* Factory Silhouette */}
                    <path d="M 20 85 L 20 45 L 38 60 L 38 45 L 56 60 L 56 45 L 74 60 L 74 85 Z" fill="#82c341" opacity="0.9" />
                    {/* Windows / Doors */}
                    <rect x="26" y="68" width="6" height="17" fill="#ffffff" rx="1" />
                    <rect x="44" y="68" width="6" height="17" fill="#ffffff" rx="1" />
                    <rect x="62" y="68" width="6" height="17" fill="#ffffff" rx="1" />
                    {/* Chimney Pipe */}
                    <rect x="23" y="32" width="6" height="14" fill="#64748b" />
                    {/* Smoke clouds */}
                    <circle cx="26" cy="22" r="4" fill="#cbd5e1" opacity="0.6" />
                    <circle cx="30" cy="15" r="5" fill="#e2e8f0" opacity="0.8" />
                  </svg>
                )}
              </div>
            </div>

          </div>

          {/* Delete Button */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
            <button
              type="button"
              onClick={() => onDelete(supplier)}
              style={{
                background: '#f87171', // red
                color: '#ffffff',
                border: 0,
                borderRadius: '6px',
                padding: '0 16px',
                height: '36px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={14} />
              <span>Hapus Supplier</span>
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'produk' && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
          Belum ada produk terhubung untuk pemasok ini.
        </div>
      )}
    </div>
  );
}
