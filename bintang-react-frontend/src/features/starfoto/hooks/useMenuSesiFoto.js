import { useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

// Menu "Sesi Foto" hanya untuk staff/SPV/Kordiv di divisi tahap Sesi/Asisten
// Foto (Pengaturan StarFoto). Satu permintaan per muat halaman.
let permintaan = null;

export const MENU_SESI_FOTO = { path: '/sesi-foto', label: 'Sesi Foto', isGroup: false };

export default function useMenuSesiFoto() {
  const { user } = useAuth();
  const [divisiIds, setDivisiIds] = useState([]);
  const peranProduksi = ['staff', 'spv', 'kordiv'].includes(user?.role?.toLowerCase());

  useEffect(() => {
    if (!peranProduksi) return undefined;
    let aktif = true;
    permintaan = permintaan || apiClient.get('/starfoto/pengaturan/').then((res) => res.data?.divisi_sesi_ids || []).catch(() => {
      permintaan = null;
      return [];
    });
    permintaan.then((ids) => { if (aktif) setDivisiIds(ids); });
    return () => { aktif = false; };
  }, [peranProduksi]);

  return peranProduksi && Boolean(user?.divisi) && divisiIds.includes(Number(user.divisi));
}
