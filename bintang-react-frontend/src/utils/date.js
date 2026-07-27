/**
 * Helper tanggal berbasis waktu LOKAL.
 *
 * Jangan pakai `new Date().toISOString().split('T')[0]` untuk mendapatkan
 * "hari ini". toISOString() mengonversi ke UTC, sedangkan Indonesia ada di
 * UTC+7..+9. Akibatnya antara tengah malam sampai pagi, tanggalnya MUNDUR
 * SEHARI — dokumen bisa tercatat di tanggal yang salah, dan filter tanggal
 * bisa menyembunyikan data yang baru dibuat.
 *
 * Contoh: 16 Juli 2026 pukul 02:00 WIB -> toISOString() memberi "2026-07-15".
 */

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * "DD-Mmm-YYYY" untuk ditampilkan. Menerima dua bentuk sekaligus:
 *  - tanggal polos "YYYY-MM-DD" (mis. `tanggal_berakhir`)
 *  - datetime ISO berzona (mis. `created_at`: "2026-07-17T10:56:19+07:00")
 *
 * Yang polos ditambahi "T00:00:00" supaya dibaca sebagai tengah malam LOKAL;
 * tanpa itu Date membacanya sebagai UTC dan tanggalnya bisa mundur sehari.
 * Yang berzona dibiarkan apa adanya — Date sudah mengonversinya ke waktu lokal.
 *
 * CATATAN: `formatDisplayDate` versi lokal masih tersalin di StockInPage,
 * StockOutPage, StockProductionPage, StockOpnamePage, dan marketing/format.js.
 * Menyatukan kelimanya ke sini = tugas tersendiri; ini rumah yang benar untuk
 * pemakaian baru.
 */
export const formatDisplayDate = (value) => {
  if (!value) return '-';
  const s = String(value);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ID[d.getMonth()]}-${d.getFullYear()}`;
};

/** Ubah objek Date jadi "YYYY-MM-DD" memakai tanggal lokal, bukan UTC. */
export const toISODate = (date) => {
  const bulan = String(date.getMonth() + 1).padStart(2, '0');
  const tanggal = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${bulan}-${tanggal}`;
};

/** "YYYY-MM-DD" untuk hari ini menurut waktu lokal pengguna. */
export const todayISO = () => toISODate(new Date());

/** "YYYY-01-01" untuk tahun berjalan — dipakai sebagai awal rentang filter. */
export const startOfYearISO = () => `${new Date().getFullYear()}-01-01`;

/**
 * "HH:MM:SS" untuk jam sekarang menurut waktu lokal — format yang diterima
 * <input type="time" step="1">.
 *
 * Alasan yang sama seperti di atas: getUTCHours()/toISOString() memberi jam UTC,
 * meleset 7 jam di WIB. Jam hitung fisik yang salah 7 jam lebih menyesatkan
 * daripada dikosongkan.
 */
export const nowTimeLocal = () => {
  const d = new Date();
  const jam = String(d.getHours()).padStart(2, '0');
  const menit = String(d.getMinutes()).padStart(2, '0');
  const detik = String(d.getSeconds()).padStart(2, '0');
  return `${jam}:${menit}:${detik}`;
};

/** "YYYY-MM-DDTHH:mm" untuk input datetime-local, tanpa konversi UTC. */
export const toLocalDateTimeInput = (date = new Date()) => {
  const jam = String(date.getHours()).padStart(2, '0');
  const menit = String(date.getMinutes()).padStart(2, '0');
  return `${toISODate(date)}T${jam}:${menit}`;
};
