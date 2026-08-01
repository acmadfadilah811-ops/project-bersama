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
