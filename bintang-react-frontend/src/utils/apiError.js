// FE-16: Ekstraksi pesan error API yang ramah-pengguna dari error axios.
// Interceptor di apiClient.js sudah menandai err.isTimeout / err.isNetworkError /
// err.isServerError. Fungsi ini merangkum semuanya menjadi satu pesan berbahasa
// Indonesia yang bisa langsung ditampilkan ke pengguna.
//
// Revisi 2026-09-29 (permintaan user: kasir jangan melihat "code"): tidak
// pernah menampilkan teks teknis -- "Request failed with status code 400",
// nama field mentah ("metode_bayar: ..."), bentuk list Python ("['...']"),
// atau halaman HTML error server.

// Nama field API yang sering muncul di layar kasir -> label yang dikenal user.
const LABEL_FIELD = {
  items: 'Item',
  qty: 'Jumlah',
  harga: 'Harga',
  total: 'Total',
  dibayar: 'Jumlah bayar',
  metode_bayar: 'Metode pembayaran',
  pelanggan: 'Pelanggan',
  nomor_wa: 'Nomor WhatsApp',
  nama: 'Nama',
  catatan: 'Catatan',
  deadline: 'Deadline',
  spk: 'SPK',
  status: 'Status',
  diskon_persen: 'Diskon',
  pajak_persen: 'Pajak',
  kupon_kode: 'Kode kupon',
  alasan: 'Alasan',
};

// Kunci yang isinya sudah berupa kalimat utuh -- tampilkan tanpa awalan.
const KUNCI_KALIMAT = new Set(['error', 'detail', 'message', 'non_field_errors', '__all__']);
// Kunci yang isinya kode mesin (mis. "belum_absen_hr"), TIDAK pernah ditampilkan.
const KUNCI_KODE = new Set(['code', 'codes', 'status_absen', 'cakupan_kunci']);

const kelihatanTeknis = (teks) =>
  /status code \d+|request failed|traceback|<\/?(html|body|head|!doctype)|\[object |axios|django/i.test(teks);

function bersihkan(nilai) {
  let teks = String(nilai).trim();
  // str(ValidationError) Django: "['pesan']" atau '["pesan"]'.
  const dalamList = teks.match(/^\[\s*(['"])([\s\S]*)\1\s*\]$/);
  if (dalamList) teks = dalamList[2].trim();
  if (!teks || teks.length > 300 || kelihatanTeknis(teks)) return null;
  return teks;
}

const humanisasi = (kunci) => {
  if (LABEL_FIELD[kunci]) return LABEL_FIELD[kunci];
  const teks = String(kunci).replace(/_/g, ' ').trim();
  return teks.charAt(0).toUpperCase() + teks.slice(1);
};

// Cari pesan pertama yang layak tampil di dalam data error DRF (string, list,
// atau dict bersarang). Mengembalikan teks tanpa awalan nama field bila
// kuncinya sudah kalimat utuh.
function cariPesan(data, kunci = null) {
  if (data == null) return null;
  // Angka (retry_after, sisa_percobaan, dst) bukan pesan -- hanya teks.
  if (typeof data === 'string') {
    const teks = bersihkan(data);
    if (!teks) return null;
    return kunci && !KUNCI_KALIMAT.has(kunci) ? `${humanisasi(kunci)}: ${teks}` : teks;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const hasil = cariPesan(item, kunci);
      if (hasil) return hasil;
    }
    return null;
  }
  if (typeof data === 'object') {
    // Kunci kalimat lebih dulu (error/detail/message), baru field lain.
    const kunci_ada = Object.keys(data).filter((k) => !KUNCI_KODE.has(k));
    const urutan = [
      ...kunci_ada.filter((k) => KUNCI_KALIMAT.has(k)),
      ...kunci_ada.filter((k) => !KUNCI_KALIMAT.has(k)),
    ];
    for (const k of urutan) {
      const hasil = cariPesan(data[k], KUNCI_KALIMAT.has(k) ? kunci : k);
      if (hasil) return hasil;
    }
  }
  return null;
}

export function getApiErrorMessage(err, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!err) return fallback;

  // Request dibatalkan (AbortController) bukan error yang perlu ditampilkan.
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError') return null;

  if (err.isTimeout) return 'Koneksi ke server timeout. Periksa jaringan Anda lalu coba lagi.';
  if (err.isNetworkError) return 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';

  const status = err.response?.status;
  const pesan = cariPesan(err.response?.data);
  if (pesan) return pesan;

  if (status === 400) return 'Data belum lengkap atau tidak valid. Periksa isian lalu coba lagi.';
  if (status === 401) return 'Sesi Anda berakhir. Silakan login ulang.';
  if (status === 403) return 'Anda tidak memiliki akses untuk tindakan ini.';
  if (status === 404) return 'Data yang diminta tidak ditemukan.';
  if (status === 409) return 'Data sudah berubah atau sudah ada. Muat ulang lalu coba lagi.';
  if (status === 429) return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
  if (status >= 500 || err.isServerError) return 'Server sedang bermasalah. Silakan coba beberapa saat lagi.';

  // err.message bawaan axios ("Request failed with status code ...") sengaja
  // TIDAK ditampilkan.
  return fallback;
}
