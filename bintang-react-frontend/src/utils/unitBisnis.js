import { useEffect, useState } from 'react';
import apiClient from '../api/apiClient';

// Pengelompokan per unit bisnis di Pesanan & Papan Kerja (2026-10-14). Hanya untuk
// owner/manager/admin -- peran lain sudah dibatasi ke unitnya sendiri oleh server.
// Nilai filter: '' = semua unit, '<id>' = satu unit, 'none' = belum ditandai unit.

const PERAN_KELOMPOK_UNIT = ['owner', 'manager', 'admin'];

export const bolehKelompokUnit = (role) => PERAN_KELOMPOK_UNIT.includes(String(role || '').toLowerCase());

export const UNIT_SEMUA = '';
export const UNIT_BELUM_DITANDAI = 'none';

/** Apakah baris dengan unit `unitId` lolos filter `nilai`. */
export function cocokUnit(unitId, nilai) {
  if (!nilai) return true;
  if (nilai === UNIT_BELUM_DITANDAI) return unitId === null || unitId === undefined;
  return String(unitId) === String(nilai);
}

/** [{id, jumlah}] dari daftar baris; `ambilUnitId(baris)` mengembalikan id unit atau null. */
export function hitungPerUnit(baris, ambilUnitId) {
  const peta = new Map();
  (baris || []).forEach((b) => {
    const id = ambilUnitId(b) ?? null;
    peta.set(id, (peta.get(id) || 0) + 1);
  });
  return Array.from(peta, ([id, jumlah]) => ({ id, jumlah }));
}

let cacheDaftarUnit = null;

export function useDaftarUnitBisnis() {
  const [daftar, setDaftar] = useState(cacheDaftarUnit || []);
  useEffect(() => {
    if (cacheDaftarUnit) return undefined;
    let aktif = true;
    apiClient
      .get('/unit-bisnis/')
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : res.data?.results || [];
        cacheDaftarUnit = rows.filter((u) => u.is_active !== false);
        if (aktif) setDaftar(cacheDaftarUnit);
      })
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, []);
  return daftar;
}
