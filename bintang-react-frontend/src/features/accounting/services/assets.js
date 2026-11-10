import apiClient from '../../../api/apiClient';

export async function fetchAssets(params = {}) {
  const { data } = await apiClient.get('/accounting/assets/', { params });
  return data.results || data;
}
export async function fetchAssetAccounts() {
  const { data } = await apiClient.get('/accounting/accounts/', { params: { semua_akun: true } });
  return data.results || data;
}
export async function createAsset(payload) {
  const { data } = await apiClient.post('/accounting/assets/', payload);
  return data;
}
export async function updateAsset(id, payload) {
  const { data } = await apiClient.patch(`/accounting/assets/${id}/`, payload);
  return data;
}
export async function postMonthlyDepreciation(period) {
  const { data } = await apiClient.post('/accounting/assets/depreciation/post/', period ? { period } : {});
  return data;
}
export async function disposeAsset(id, payload) {
  const { data } = await apiClient.post(`/accounting/assets/${id}/dispose/`, payload);
  return data;
}
export async function previewAssetImport(file, config) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(config).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') form.append(key, value);
  });
  const { data } = await apiClient.post('/accounting/assets/import/preview/', form);
  return data;
}
export async function commitAssetImport(entries, config) {
  const { data } = await apiClient.post('/accounting/assets/import/commit/', { ...config, entries });
  return data;
}

// Aset dari HR & proyeksi penyusutan (2026-11-10)
export async function fetchAsetDariHR(status = 'menunggu') {
  const { data } = await apiClient.get('/accounting/assets/dari-hr/', { params: { status } });
  return data;
}
export async function prosesAsetDariHR(id, payload) {
  const { data } = await apiClient.post(`/accounting/assets/dari-hr/${id}/proses/`, payload);
  return data;
}
export async function tolakAsetDariHR(id, alasan) {
  const { data } = await apiClient.post(`/accounting/assets/dari-hr/${id}/tolak/`, { alasan });
  return data;
}
export async function selesaiTinjauAsetDariHR(id) {
  const { data } = await apiClient.post(`/accounting/assets/dari-hr/${id}/selesai-tinjau/`);
  return data;
}
export async function fetchProyeksiPenyusutan(bulan = 12) {
  const { data } = await apiClient.get('/accounting/assets/proyeksi/', { params: { bulan } });
  return data;
}
