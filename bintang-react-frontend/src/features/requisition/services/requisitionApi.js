import apiClient from '../../../api/apiClient';

// Permintaan Bahan (Material Requisition). Semua aturan ada di backend
// (services/material_requisition.py); frontend hanya memanggil dan menampilkan
// `aksi` yang diizinkan server.

const daftar = (res) => (Array.isArray(res.data) ? res.data : res.data?.results || []);

export const listPermintaan = async () => daftar(await apiClient.get('/material-requisitions/'));

export const buatPermintaan = async (payload) =>
  (await apiClient.post('/material-requisitions/', payload)).data;

export const jalankanAksi = async (id, aksi, body = {}) =>
  (await apiClient.post(`/material-requisitions/${id}/${aksi}/`, body)).data;

export const ambilRingkasan = async () => (await apiClient.get('/material-requisitions/ringkasan/')).data;

// Master bahan baku untuk dropdown (InventoryItem).
export const listBahan = async () => daftar(await apiClient.get('/inventory/'));
