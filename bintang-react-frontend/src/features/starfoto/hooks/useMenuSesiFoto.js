import { useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

// Menu "Sesi Foto" hanya untuk staff/SPV/Kordiv di divisi tahap Sesi/Asisten
// Foto (Pengaturan StarFoto). Satu permintaan per muat halaman.
let permintaan = null;

export const MENU_SESI_FOTO = { path: '/sesi-foto', label: 'Sesi Foto', isGroup: false };

export default function useMenuSesiFoto() {
  const { user } = useAuth();
  const [boleh, setBoleh] = useState(false);
  const peranProduksi = ['staff', 'spv', 'kordiv'].includes(user?.role?.toLowerCase());

  useEffect(() => {
    if (!peranProduksi) return undefined;
    let aktif = true;
    permintaan = permintaan || apiClient.get('/starfoto/pengaturan/').then((res) => Boolean(res.data?.menu_sesi_foto)).catch(() => {
      permintaan = null;
      return false;
    });
    permintaan.then((boleh) => { if (aktif) setBoleh(boleh); });
    return () => { aktif = false; };
  }, [peranProduksi]);

  // Ditentukan server: anggota divisi Sesi/Asisten Foto atau SPV/Kordiv atasannya.
  return peranProduksi && boleh;
}
