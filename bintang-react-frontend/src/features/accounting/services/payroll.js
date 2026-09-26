import apiClient from '../../../api/apiClient';

// Posting Gaji (HR -> jurnal). Semua aturan ada di backend
// (accounting/services/payroll_posting.py); di sini hanya pemanggilan API.

const daftar = (res) => (Array.isArray(res.data) ? res.data : res.data?.results || []);

export const ambilPratinjauGaji = async (tahun, bulan) =>
  (await apiClient.get('/accounting/payroll/pratinjau/', { params: { tahun, bulan } })).data;

export const postingGaji = async (tahun, bulan) =>
  (await apiClient.post('/accounting/payroll/posting/', { tahun, bulan })).data;

export const koreksiGaji = async (tahun, bulan) =>
  (await apiClient.post('/accounting/payroll/koreksi/', { tahun, bulan })).data;

export const bayarGaji = async (tahun, bulan, akunKas, tanggal) =>
  (await apiClient.post('/accounting/payroll/bayar/', { tahun, bulan, akun_kas: akunKas, tanggal })).data;

export const ambilRiwayatGaji = async () => daftar(await apiClient.get('/accounting/payroll/riwayat/'));

export const ambilPemetaanGaji = async () => daftar(await apiClient.get('/accounting/payroll/pemetaan/'));

export const simpanPemetaanGaji = async (payload) =>
  (await apiClient.post('/accounting/payroll/pemetaan/', payload)).data;

export const hapusPemetaanGaji = async (id) => apiClient.delete(`/accounting/payroll/pemetaan/${id}/`);

export const ambilAkunGaji = async () =>
  daftar(await apiClient.get('/accounting/accounts/', { params: { semua_akun: true } })).filter((a) => a.is_active);

// Persetujuan pencairan gaji 5 tahap (accounting/services/payroll_persetujuan.py).
export const ambilPengajuanGaji = async () =>
  (await apiClient.get('/accounting/payroll/pengajuan/')).data?.results || [];

export const ambilAkunKasPengajuan = async () =>
  (await apiClient.get('/accounting/payroll/pengajuan/akun-kas/')).data || [];

export const verifikasiPengajuanGaji = async (id) =>
  (await apiClient.post(`/accounting/payroll/pengajuan/${id}/verifikasi/`)).data;

export const otorisasiPengajuanGaji = async (id) =>
  (await apiClient.post(`/accounting/payroll/pengajuan/${id}/otorisasi/`)).data;

export const tolakPengajuanGaji = async (id, alasan) =>
  (await apiClient.post(`/accounting/payroll/pengajuan/${id}/tolak/`, { alasan })).data;

export const bayarPengajuanGaji = async (id, { akunKas, tanggal, bukti }) => {
  const form = new FormData();
  form.append('akun_kas', akunKas);
  if (tanggal) form.append('tanggal', tanggal);
  form.append('bukti', bukti);
  return (await apiClient.post(`/accounting/payroll/pengajuan/${id}/bayar/`, form)).data;
};
