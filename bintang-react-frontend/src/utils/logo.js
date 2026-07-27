/**
 * Ubah path logo dari API jadi URL yang bisa dipakai <img src>.
 *
 * Backend kadang mengirim URL absolut, kadang path relatif ('/media/...').
 * Fungsi ini menormalkannya. Sebelumnya disalin identik di StockInPage,
 * StockOutPage, dan StockOpnamePage — disatukan di sini agar perubahan base
 * URL cukup dilakukan sekali.
 */
export const getLogoUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
};
