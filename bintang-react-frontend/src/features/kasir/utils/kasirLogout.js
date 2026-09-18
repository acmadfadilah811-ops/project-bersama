/**
 * Logout kasir yang selaras dengan tombol "Ganti Operator" -- sebelumnya
 * cuma "Ganti Operator" yang mengecek shift masih terbuka, sementara 4
 * tombol "Keluar" lain (KasirHeader, KasirSidebar, KasirTopbar x2)
 * langsung logout tanpa cek sama sekali, jadi kasir bisa lolos dari
 * kewajiban tutup shift lewat jalur itu (gap ditemukan 2026-09-18).
 * Dipusatkan di sini supaya semua tombol Keluar kasir berperilaku sama.
 */
export function handleKasirLogout({ shiftAktif, logout, navigate }) {
  if (shiftAktif) {
    alert('Tutup shift Anda terlebih dahulu sebelum keluar (Logout).');
    navigate('/kasir/shift');
    return;
  }
  logout();
  // Tidak perlu navigate('/login') manual -- ProtectedRoute otomatis
  // redirect begitu user jadi null (pola yang sama dipakai Sidebar.jsx
  // untuk role lain).
}
