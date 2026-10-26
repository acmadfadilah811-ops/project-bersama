// Kalkulator meteran (panjang x lebar) -- satu aturan untuk SEMUA tempat membuat/mengedit
// order & kasir, supaya angka di layar sama dengan yang ditagih server
// (api/services/product_pricing.hitung_harga):
//   luas         = P x L persis (tidak dibulatkan ke 2 desimal; 6 desimal hanya membuang noise float)
//   harga satuan = pembulatan rupiah (half-up) dari luas x harga per m2
//   subtotal     = harga satuan x qty
// Contoh: 0,6 x 0,42 = 0,252 m2 x Rp 75.000 = Rp 18.900 (bukan 0,25 -> 18.750).

export const hitungLuas = (panjang, lebar) =>
  Math.round((parseFloat(panjang) || 0) * (parseFloat(lebar) || 0) * 1e6) / 1e6;

// Math.round pada hasil yang sudah dibersihkan dari noise float (2,4999999 -> 2,5 -> 3), sama
// dengan ROUND_HALF_UP di server.
export const hargaSatuanMeteran = (luas, hargaPerM2) =>
  Math.round(Math.round((Number(luas) || 0) * (parseFloat(hargaPerM2) || 0) * 1e6) / 1e6);

export const hitungHargaMeteran = (panjang, lebar, hargaPerM2, qty = 1) => {
  const luas = hitungLuas(panjang, lebar);
  const hargaSatuan = hargaSatuanMeteran(luas, hargaPerM2);
  const jumlah = Math.max(1, parseInt(qty) || 1);
  return { luas, hargaSatuan, subtotal: hargaSatuan * jumlah };
};

// Tampil sampai 4 desimal (sama dengan OrderItem.luas di server = round(P x L, 4)).
export const formatLuas = (luas) =>
  (Number(luas) || 0).toLocaleString('id-ID', { maximumFractionDigits: 4 });
