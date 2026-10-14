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

// Role yang tidak dibatasi satu unit bisnis (melihat gabungan semua unit).
export const ROLE_SEMUA_UNIT = ['owner', 'manager', 'admin', 'admin_finance', 'spv_finance', 'sales'];

/** Nama unit karyawan untuk ditampilkan; role lintas-unit tanpa unit tampil "Semua unit". */
export function namaUnitKaryawan(role, unitNama) {
  return unitNama || (ROLE_SEMUA_UNIT.includes(role) ? 'Semua unit' : 'Unit belum diatur');
}

/** Karyawan yang seharusnya punya unit tetapi belum diisi. */
export function unitKaryawanBelumDiatur(role, unitNama) {
  return !unitNama && !ROLE_SEMUA_UNIT.includes(role);
}

/**
 * Kasir unit StarFoto (2026-10-14): fitur WA (antrean order WA, WA Live) belum dipakai;
 * order WA StarFoto sudah masuk lewat Terminal Kasir. Antrean tetap ada untuk order staff/CRM.
 */
export function isKasirStarfoto(user) {
  return String(user?.role || '').toLowerCase() === 'kasir' && /starfoto/i.test(user?.unit_bisnis_nama || '');
}

/**
 * Parameter API agar kasir StarFoto hanya menerima pesanan StarFoto (tanpa pesanan
 * yang belum bertanda unit, mis. order WA/manual unit lain). Kosong untuk peran lain.
 */
export function paramUnitKasirStarfoto(user) {
  return isKasirStarfoto(user) && user?.unit_bisnis ? { unit_bisnis: user.unit_bisnis } : {};
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
