import apiClient from '../api/apiClient';
import { notifyError } from './notify';

// Pencarian pelanggan untuk form transaksi (2026-10-19): database Pelanggan + kontak WA
// dalam satu daftar (lihat CustomerViewSet.cari). Gagal (mis. peran tanpa akses) = daftar kosong.
export async function cariPelanggan(search) {
  try {
    const res = await apiClient.get('/customers/cari/', { params: { search: search || '' } });
    return Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

// Pelanggan dari database Pelanggan ditautkan ke kontak WA-nya dulu supaya transaksinya
// tercatat sebagai riwayat pelanggan itu. Kontak WA dipakai apa adanya.
// Pelanggan tanpa nomor WA tidak bisa dipakai transaksi sampai nomornya dilengkapi
// di menu Pelanggan: hasil null.
export async function pakaiPelanggan(row) {
  if (!row?.nomor_wa) {
    notifyError('Nomor WA belum ada', `Lengkapi dulu nomor WA ${row?.nama || 'pelanggan ini'} di menu Pelanggan sebelum dipakai transaksi.`);
    return null;
  }
  if (row?.sumber !== 'customer') return row;
  try {
    const res = await apiClient.post(`/customers/${row.customer_id}/resolve-contact/`);
    return { ...row, nomor_wa: res.data?.nomor_wa || row.nomor_wa, handphone: res.data?.nomor_wa || row.handphone };
  } catch {
    return row;
  }
}
