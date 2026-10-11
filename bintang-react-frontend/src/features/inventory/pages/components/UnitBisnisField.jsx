import { useEffect, useState } from 'react';
import apiClient from '../../../../api/apiClient';

// Unit bisnis pada master produk (kategori, brand, koleksi, paket, addon,
// spesifikasi) -- 2026-10-11. Kosong = berlaku untuk semua unit.

export function useUnitBisnisOptions() {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    let aktif = true;
    apiClient.get('/unit-bisnis/')
      .then((res) => { if (aktif) setOptions(Array.isArray(res.data) ? res.data : res.data?.results || []); })
      .catch(() => { if (aktif) setOptions([]); });
    return () => { aktif = false; };
  }, []);
  return options;
}

export const SEMUA_UNIT = 'Semua unit';

export function namaUnitBisnis(row) {
  return row?.unit_bisnis_nama || SEMUA_UNIT;
}

export default function UnitBisnisSelect({ value, onChange, options, label = 'Unit Bisnis', labelStyle, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...style }}>
      <label style={labelStyle || { fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>{label}</label>
      <select
        className="pi-input-text w-full"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box' }}
      >
        <option value="">{SEMUA_UNIT}</option>
        {options.map((u) => (
          <option key={u.id} value={String(u.id)}>{u.nama}</option>
        ))}
      </select>
    </div>
  );
}

// Varian baris berlabel kiri (grid 140px 1fr) untuk form "Tambah ..." di halaman master.
export function UnitBisnisRow({ value, onChange, options }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '16px', alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right', paddingTop: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Unit Bisnis</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.4' }}>Kosongkan bila berlaku untuk semua unit</span>
      </div>
      <UnitBisnisSelect value={value} onChange={onChange} options={options} label="" labelStyle={{ display: 'none' }} />
    </div>
  );
}
