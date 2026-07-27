import { useState } from 'react';
import { Settings, SlidersHorizontal, Search, Plus } from 'lucide-react';

export function DepositPage() {
  const [searchVal, setSearchVal] = useState('');

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
      {/* Blue Banner Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
        borderRadius: '12px', 
        padding: '30px 40px', 
        color: '#ffffff', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '24px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Deposit</h2>
          <p style={{ fontSize: '15px', margin: '8px 0 0 0', opacity: 0.9 }}>Mudahkan pembayaran pelanggan Anda dengan Deposit</p>
        </div>

        {/* Graphic illustration - wallet on circular backgrounds */}
        <div style={{ position: 'relative', width: '160px', height: '120px' }}>
          {/* Outer light circle */}
          <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', background: '#7dd3fc', opacity: 0.35, right: '10px', top: '5px' }}></div>
          {/* Inner lighter circle */}
          <div style={{ position: 'absolute', width: '78px', height: '78px', borderRadius: '50%', background: '#e0f2fe', opacity: 0.95, right: '22px', top: '21px' }}></div>
          {/* Wallet body */}
          <div style={{
            position: 'absolute',
            background: '#0284c7',
            borderRadius: '12px',
            width: '76px',
            height: '56px',
            right: '26px',
            top: '32px',
            boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
            border: '2.5px solid #ffffff'
          }}>
            {/* Card tab inside wallet */}
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              width: '22px',
              height: '14px',
              borderRadius: '3px',
              background: '#e0f2fe',
              border: '1px solid #0369a1'
            }}></div>
          </div>
        </div>
      </div>

      {/* Heading */}
      <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginBottom: '20px', marginTop: 0 }}>Deposit</h3>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: '#0085ca', 
            color: '#ffffff', 
            border: 0, 
            padding: '10px 18px', 
            borderRadius: '6px', 
            fontSize: '13px', 
            fontWeight: 'bold', 
            cursor: 'pointer' 
          }}>
            <Settings size={14} />
            <span>Pengaturan</span>
          </button>
          
          <button style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            background: '#0085ca', 
            color: '#ffffff', 
            border: 0, 
            padding: '10px 18px', 
            borderRadius: '6px', 
            fontSize: '13px', 
            fontWeight: 'bold', 
            cursor: 'pointer' 
          }}>
            <SlidersHorizontal size={14} />
            <span>Filter</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Cari" 
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              style={{ 
                width: '100%', 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                padding: '8px 12px 8px 36px', 
                fontSize: '13px', 
                outline: 'none', 
                boxSizing: 'border-box' 
              }}
            />
          </div>

          <button style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            background: '#22c55e', 
            color: '#ffffff', 
            border: 0, 
            padding: '10px 20px', 
            borderRadius: '6px', 
            fontSize: '13px', 
            fontWeight: 'bold', 
            cursor: 'pointer' 
          }}>
            <Plus size={14} />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
              <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Nama</th>
              <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Nominal</th>
              <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Harga Jual</th>
              <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Masa berlaku</th>
              <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Tampilkan di POS?</th>
              <th style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Aktif</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>Tidak ada deposit</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
