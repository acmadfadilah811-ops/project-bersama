import apiClient from '../../api/apiClient';

// Hapus produk (2026-10-20): Owner/Manager/Admin lewat hapus-bersih -- produk hasil impor
// yang riwayatnya cuma saldo awal ikut bisa dihapus (jurnal saldo awalnya dibalik).
// Peran lain memakai hapus biasa. Melempar Error berisi pesan server bila ditolak.
export async function hapusProduk(id) {
  try {
    await apiClient.post(`/products/${id}/hapus-bersih/`);
  } catch (err) {
    if (err.response?.status === 403) {
      try {
        await apiClient.delete(`/products/${id}/`);
        return;
      } catch (err2) {
        throw new Error(err2.response?.data?.error || 'Gagal menghapus produk.', { cause: err2 });
      }
    }
    throw new Error(err.response?.data?.error || err.response?.data?.detail || 'Gagal menghapus produk.', { cause: err });
  }
}
