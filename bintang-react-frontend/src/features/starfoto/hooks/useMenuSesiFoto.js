import { useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

// Menu StarFoto untuk staff/SPV/Kordiv (ditentukan server, Pengaturan StarFoto):
// - Sesi Foto: anggota divisi tahap Sesi/Asisten Foto atau atasannya.
// - Edit Foto: anggota divisi tahap Edit atau atasannya.
// Satu permintaan per muat halaman.
let permintaan = null;

export const MENU_SESI_FOTO = { path: '/sesi-foto', label: 'Sesi Foto', isGroup: false };
export const MENU_EDIT_FOTO = { path: '/edit-foto', label: 'Edit Foto', isGroup: false };

export function useMenuStarfoto() {
  const { user } = useAuth();
  const [menu, setMenu] = useState({ sesi: false, edit: false });
  const peranProduksi = ['staff', 'spv', 'kordiv'].includes(user?.role?.toLowerCase());

  useEffect(() => {
    if (!peranProduksi) return undefined;
    let aktif = true;
    permintaan = permintaan || apiClient.get('/starfoto/pengaturan/')
      .then((res) => ({ sesi: Boolean(res.data?.menu_sesi_foto), edit: Boolean(res.data?.menu_edit_foto) }))
      .catch(() => {
        permintaan = null;
        return { sesi: false, edit: false };
      });
    permintaan.then((hasil) => { if (aktif) setMenu(hasil); });
    return () => { aktif = false; };
  }, [peranProduksi]);

  return peranProduksi ? menu : { sesi: false, edit: false };
}

export default function useMenuSesiFoto() {
  return useMenuStarfoto().sesi;
}
