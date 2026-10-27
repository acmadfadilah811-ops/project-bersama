// Pembulatan total penjualan kasir (Pengaturan POS > Pembulatan) -- cermin
// api/services/pembulatan.py supaya total di layar = yang ditagih server.
//   kelipatan <= 1 : tidak dibulatkan
//   arah           : 'terdekat' (setengah ke atas) | 'atas' | 'bawah'
export const bulatkanContoh = (total, kelipatan, arah = 'terdekat') => {
  const t = Number(total) || 0;
  const k = Number(kelipatan) || 0;
  if (t <= 0 || k <= 1) return t;
  const rasio = Math.round((t / k) * 1e9) / 1e9;
  const n = arah === 'atas' ? Math.ceil(rasio) : arah === 'bawah' ? Math.floor(rasio) : Math.floor(rasio + 0.5);
  return n * k;
};

// Selisih pembulatan (positif = pelanggan membayar lebih).
export const selisihPembulatan = (total, kelipatan, arah) => bulatkanContoh(total, kelipatan, arah) - (Number(total) || 0);
