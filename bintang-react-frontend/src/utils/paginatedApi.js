import apiClient from '../api/apiClient';

/**
 * Ambil seluruh halaman endpoint list secara eksplisit.
 * Tidak pernah mengandalkan mode legacy tanpa pagination, dan gagal dengan
 * pesan jelas bila respons berubah atau batas keselamatan terlampaui.
 */
export async function fetchAllPages(endpoint, { params = {}, pageSize = 1000, maxItems = 50000 } = {}) {
  const all = [];
  let page = 1;

  while (all.length < maxItems) {
    const response = await apiClient.get(endpoint, {
      params: { ...params, page, page_size: pageSize },
    });
    const payload = response.data;

    // Kompatibilitas untuk APIView/non-paginated endpoint yang memang array.
    if (Array.isArray(payload)) return payload;

    const rows = payload?.results;
    if (!Array.isArray(rows)) {
      throw new Error(`Format pagination ${endpoint} tidak valid.`);
    }
    all.push(...rows);

    const total = Number(payload.count);
    const completeByCount = Number.isFinite(total) && all.length >= total;
    if (completeByCount || rows.length < pageSize || !payload.next) return all;
    page += 1;
  }

  throw new Error(`Data ${endpoint} melebihi batas aman ${maxItems} baris. Gunakan pencarian/filter server.`);
}
