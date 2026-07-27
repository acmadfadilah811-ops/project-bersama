export const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const fmtDate = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(`${isoStr}T00:00:00`);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ID[d.getMonth()]}-${d.getFullYear()}`;
};

export const fmtDiskon = (row) =>
  row.tipe_diskon === 'percent'
    ? `${Number(row.jumlah_diskon)}%`
    : `Rp ${Number(row.jumlah_diskon).toLocaleString('id-ID')}`;

export const fmtRupiah = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

/** Untuk input angka: tampilkan dengan pemisah ribuan titik (mis. "1.000.000"). */
export const formatRibuan = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('id-ID') : '';
};

/** Kebalikan formatRibuan: buang semua non-digit, kembalikan string angka mentah. */
export const unformatRibuan = (v) => String(v ?? '').replace(/\D/g, '');

/** Ubah error response DRF (dict field->list, atau {error}/{detail}) jadi satu baris pesan. */
export const extractApiError = (err, fallback) => {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const parts = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  return parts.length ? parts.join(' | ') : fallback;
};

export const inputCls =
  'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all placeholder-slate-400';
