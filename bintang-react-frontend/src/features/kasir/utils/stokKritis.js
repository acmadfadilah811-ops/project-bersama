import apiClient from '../../../api/apiClient';

// Peringatan stok menipis di Terminal Kasir (2026-09-24, instruksi user).
// Dua mode popup (state `stokKritisModal` di PosTerminal.jsx):
// - 'gate': dihitung di klien SEBELUM modal pembayaran dibuka (kasir tertahan
//   dulu) dari qty_stok & stok_minimum produk di keranjang.
// - 'info': jaring pengaman setelah transaksi tersimpan, dari `stok_kritis`
//   di response backend (pos_services.stok_kritis_warnings) -- data race
//   dengan kasir lain bisa membuat hasil akhir beda dari perkiraan 'gate'.
// Sengaja tidak lewat notify()/DynamicIsland: PosHeaderBar tidak punya tempat
// notifikasi, jadi popup dirender sebagai modal blocking sendiri.

export const hitungStokKritisKeranjang = (cartItems) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) return [];
  const totalQtyByKey = new Map();
  const infoByKey = new Map();
  cartItems.forEach((item) => {
    const product = item.product;
    if (!product || !product.lacak_inventori) return;
    const minimum = Number(product.stok_minimum || 0);
    if (minimum <= 0) return;
    const variant = item.variant;
    const key = variant ? `${product.id}-${variant.id}` : `${product.id}`;
    totalQtyByKey.set(key, (totalQtyByKey.get(key) || 0) + (Number(item.qty) || 0));
    if (!infoByKey.has(key)) {
      infoByKey.set(key, {
        nama: variant ? `${product.nama} (${variant.nama_varian})` : product.nama,
        stokSaatIni: Number((variant ? variant.qty_stok : product.qty_stok) || 0),
        minimum,
      });
    }
  });
  const warnings = [];
  totalQtyByKey.forEach((totalQty, key) => {
    const info = infoByKey.get(key);
    const sisa = info.stokSaatIni - totalQty;
    if (sisa <= info.minimum) {
      warnings.push({ nama: info.nama, sisa, minimum: info.minimum });
    }
  });
  return warnings;
};

// Ambil ulang produk (& varian) tiap item keranjang dari server, HANYA untuk
// perhitungan gerbang stok -- isi keranjang sendiri tidak diubah.
export const segarkanProdukKeranjang = async (cartItems) => {
  const ids = [...new Set(cartItems.filter((it) => it.product?.id).map((it) => it.product.id))];
  if (ids.length === 0) return cartItems;
  const hasil = await Promise.all(
    ids.map((id) => apiClient.get(`/products/${id}/`).then((res) => res.data).catch(() => null)),
  );
  const terbaru = new Map(ids.map((id, i) => [id, hasil[i]]).filter(([, p]) => p));
  return cartItems.map((it) => {
    const p = it.product?.id ? terbaru.get(it.product.id) : null;
    if (!p) return it;
    const variant = it.variant?.id
      ? (p.variants || []).find((v) => v.id === it.variant.id) || it.variant
      : it.variant;
    return { ...it, product: p, variant };
  });
};
