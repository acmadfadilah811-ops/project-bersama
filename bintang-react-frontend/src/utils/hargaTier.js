// Harga kasir menurut Tingkatan Harga (Detail Produk) per Tipe Pelanggan -- cermin
// api/services/product_pricing.harga_tier_atau_dasar supaya angka di layar = yang ditagih server.
//
// Tier: { tipe_pelanggan, min_qty, price, tipe_nilai?, persen? }
//  - tipe_nilai 'harga' (bawaan) : `price` = Rp tetap per satuan
//  - tipe_nilai 'persen'         : `persen` = potongan % dari harga normal (dibulatkan half-up)
// Urutan: tier bertipe sama (pelanggan tanpa tipe = "Guest"), lalu tier umum (tipe kosong),
// lalu harga dasar. Dalam satu kelompok dipilih tier dengan min_qty terbesar yang <= qty.

export const TIPE_GUEST = 'Guest';

const bulatHalfUp = (nilai) => Math.round(Math.round(nilai * 1e6) / 1e6);

export const nilaiTier = (tier, base) => {
  if (String(tier?.tipe_nilai || 'harga').toLowerCase() === 'persen') {
    const persen = Number(tier.persen) || 0;
    if (persen < 0 || persen > 100) return null;
    return bulatHalfUp((Number(base) || 0) * (100 - persen) / 100);
  }
  return Number(tier?.price) || 0;
};

const pilih = (kandidat, qty, base) => {
  let terpilih = null;
  kandidat.forEach((t) => {
    const minQty = Number(t.min_qty) || 0;
    const nilai = nilaiTier(t, base);
    if (nilai === null || qty < minQty) return;
    if (!terpilih || minQty > terpilih.minQty) terpilih = { minQty, nilai };
  });
  return terpilih;
};

export const hargaTierAtauDasar = (product, base, qty, tipeNama) => {
  const tiers = Array.isArray(product?.tiers) ? product.tiers : [];
  const dasar = Number(base) || 0;
  if (!tiers.length) return dasar;
  const nama = String(tipeNama || TIPE_GUEST).trim().toLowerCase();
  const cocokTipe = (t) => String(t?.tipe_pelanggan || '').trim().toLowerCase();
  let terpilih = pilih(tiers.filter((t) => t && cocokTipe(t) === nama), Number(qty) || 0, dasar);
  if (!terpilih) terpilih = pilih(tiers.filter((t) => t && cocokTipe(t) === ''), Number(qty) || 0, dasar);
  return terpilih ? terpilih.nilai : dasar;
};

// Teks ringkas satu tier untuk daftar: "Rp 50.000" atau "10% (Rp 54.000)".
export const labelNilaiTier = (tier, base) => {
  const rp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
  if (String(tier?.tipe_nilai || 'harga').toLowerCase() === 'persen') {
    const hasil = nilaiTier(tier, base);
    return `${Number(tier.persen) || 0}%${hasil === null ? '' : ` (${rp(hasil)})`}`;
  }
  return rp(tier?.price);
};
