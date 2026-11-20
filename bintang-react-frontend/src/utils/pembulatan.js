// Pembulatan total penjualan kasir (Pengaturan POS > Pembulatan) -- cermin
// api/services/pembulatan.py supaya total di layar = yang ditagih server.
// Aturan: diskon dibulatkan ke bawah, pembayaran (total ditagih) dibulatkan ke atas.
//   kelipatan <= 1 : tidak dibulatkan
//   arah           : 'terdekat' (setengah ke atas) | 'atas' | 'bawah'
//   breakpoint     : mode 'terdekat' (Otomatis Olsera): sisa <= breakpoint% dari kelipatan ke bawah, lebih dari itu ke atas
export const bulatkanContoh = (total, kelipatan, arah = 'terdekat', breakpoint = 50) => {
  const t = Number(total) || 0;
  const k = Number(kelipatan) || 0;
  if (t <= 0 || k <= 1) return t;
  if (arah === 'atas') return Math.ceil(Math.round((t / k) * 1e9) / 1e9) * k;
  if (arah === 'bawah') return Math.floor(Math.round((t / k) * 1e9) / 1e9) * k;
  const sisa = t % k;
  if (sisa === 0) return t;
  const batas = (k * (Number(breakpoint) || 50)) / 100;
  return sisa <= batas + 1e-9 ? t - sisa : t - sisa + k;
};

// Selisih pembulatan (positif = pelanggan membayar lebih).
export const selisihPembulatan = (total, kelipatan, arah, breakpoint) => bulatkanContoh(total, kelipatan, arah, breakpoint) - (Number(total) || 0);

// Selisih pembulatan penjualan dua tahap: diskon dibulatkan (bawaan ke bawah) lalu total ditagih (bawaan ke atas).
export const selisihPembulatanPenjualan = (total, totalDiskon, kelipatan, arahBayar = 'atas', arahDiskon = 'bawah', breakpoint = 50) => {
  const t = Number(total) || 0;
  const d = Number(totalDiskon) || 0;
  if (t <= 0 || (Number(kelipatan) || 0) <= 1) return 0;
  let setelahDiskon = t;
  if (d > 0) setelahDiskon = Math.max(0, t + (d - bulatkanContoh(d, kelipatan, arahDiskon, breakpoint)));
  return bulatkanContoh(setelahDiskon, kelipatan, arahBayar, breakpoint) - t;
};
