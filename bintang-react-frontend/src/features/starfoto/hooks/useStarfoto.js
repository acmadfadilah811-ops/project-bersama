import { useCallback, useEffect, useState } from 'react';
import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';

// Data bersama modul StarFoto (2026-10-11): pengaturan & master paket foto.

const daftar = (data) => (Array.isArray(data) ? data : data?.results || []);

export function usePengaturanStarfoto() {
  const [pengaturan, setPengaturan] = useState(null);
  const muat = useCallback(async () => {
    try {
      const res = await apiClient.get('/starfoto/pengaturan/');
      setPengaturan(res.data);
    } catch {
      setPengaturan(null);
    }
  }, []);
  useEffect(() => { muat(); }, [muat]);
  return { pengaturan, muatUlang: muat };
}

export function usePaketFoto() {
  const [paket, setPaket] = useState([]);
  const muat = useCallback(async () => {
    try {
      setPaket(await fetchAllPages('/starfoto/paket/'));
    } catch {
      setPaket([]);
    }
  }, []);
  useEffect(() => { muat(); }, [muat]);
  return { paket, muatUlang: muat };
}

// Addon yang berlaku untuk produk paket (applies_to / applies_to_categories / umum).
export async function ambilAddonPaket(productId, kategoriId) {
  const res = await apiClient.get('/addons/');
  return daftar(res.data).filter((a) => {
    if (a.is_active === false) return false;
    const produk = a.applies_to || [];
    const kategori = a.applies_to_categories || [];
    if (!produk.length && !kategori.length) return true;
    return produk.includes(productId) || (kategoriId != null && kategori.includes(kategoriId));
  });
}

export const formatRupiah = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;

export const formatJadwal = (iso) => (iso
  ? new Date(iso).toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-');

export const LABEL_STATUS_PESANAN = {
  sesi: 'Sesi Foto',
  menunggu_kasir: 'Menunggu Konfirmasi Kasir',
  dikonfirmasi: 'Produksi (Edit/Cetak)',
  batal: 'Batal',
};
