// Helper murni untuk notifikasi "pesanan siap diambil" di meja kasir
// (lihat hooks/useNotifikasiSiapDiambil.js). Dipisah dari hook supaya logika
// deteksi "baru siap" bisa diuji tanpa React.

/**
 * Gabungkan pesanan siap-diambil dari dua sumber jadi satu daftar seragam.
 * Kunci diberi awalan sumber karena id Order (string, mis. "ORD-...") dan id
 * POSSale (angka) tidak dijamin unik satu sama lain.
 */
export function gabungPesananSiap(orders = [], penjualanPos = []) {
  return [
    ...orders.map((o) => ({
      kunci: `order:${o.id}`,
      label: o.id,
      nama: o.nama || 'Pelanggan',
    })),
    ...penjualanPos.map((s) => ({
      kunci: `pos:${s.id}`,
      label: s.nomor || `POS-${s.id}`,
      nama: s.pelanggan_name || 'Pelanggan Umum',
    })),
  ];
}

/**
 * Pesanan yang BARU muncul dibanding polling sebelumnya.
 *
 * `kunciSebelumnya` null = polling pertama (baseline): tidak ada yang dianggap
 * baru, supaya membuka halaman kasir tidak membanjiri toast untuk pesanan yang
 * sudah lama siap -- itu sudah terwakili badge jumlah.
 */
export function temukanPesananBaru(kunciSebelumnya, daftarSekarang) {
  if (!kunciSebelumnya) return [];
  return daftarSekarang.filter((p) => !kunciSebelumnya.has(p.kunci));
}

/** Teks toast: satu pesanan disebut lengkap, banyak pesanan diringkas. */
export function pesanNotifikasi(pesananBaru) {
  if (pesananBaru.length === 1) {
    const [p] = pesananBaru;
    return `${p.label} · ${p.nama} sudah selesai diproduksi dan siap diambil.`;
  }
  const contoh = pesananBaru
    .slice(0, 3)
    .map((p) => p.label)
    .join(', ');
  const sisa = pesananBaru.length > 3 ? ` +${pesananBaru.length - 3} lainnya` : '';
  return `${pesananBaru.length} pesanan siap diambil: ${contoh}${sisa}.`;
}
