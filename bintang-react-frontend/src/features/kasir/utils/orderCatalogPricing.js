import apiClient from '../../../api/apiClient';
import { fetchAllPages } from '../../../utils/paginatedApi';

/**
 * Katalog produk & paket yang sudah lolos filter POS (is_active,
 * tampil_pos, tidak_tersedia_offline_pos, publikasi, habis_stok) --
 * ditegakkan di backend, bukan cuma frontend. Dipakai bersama oleh
 * WaOrderQueue.jsx & StaffCreateOrderPanel.jsx supaya keduanya selalu
 * konsisten (hindari celah seperti bug tampil_pos yang sempat kelewat
 * di salah satu konsumen, temuan user 2026-09-06).
 */
export async function fetchActiveProducts() {
  return fetchAllPages('/products/', { params: { is_active: true } });
}

export async function fetchActivePackages() {
  const res = await apiClient.get('/product-packages/', {
    params: { page: 1, page_size: 1000, publikasi: true, tampil_pos: true, habis_stok: false },
  });
  return res.data?.results || res.data || [];
}

/** Harga SELALU dihitung server-side (sumber sama dgn bot WA) -- tidak
 * pernah dipercaya dari input manual. paksaPerM2 = P x L selalu jadi
 * pengali harga kalau diisi, apa pun price_type-nya. */
export async function fetchHargaKatalog(productId, { variantId, qty, panjang, lebar, paksaPerM2 } = {}) {
  const params = new URLSearchParams();
  if (variantId) params.set('variant_id', variantId);
  params.set('qty', qty || 1);
  if (panjang) params.set('panjang', panjang);
  if (lebar) params.set('lebar', lebar);
  if (paksaPerM2) params.set('paksa_per_m2', 'true');
  const res = await apiClient.get(`/products/${productId}/hitung-harga/?${params.toString()}`);
  return res.data.harga_satuan;
}
