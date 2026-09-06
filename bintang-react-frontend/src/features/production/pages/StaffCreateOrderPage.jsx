import StaffCreateOrderPanel from './panels/StaffCreateOrderPanel';

/** Halaman berdiri sendiri di sidebar utama akun staff (menu "Buat Order")
 * -- dipisah dari Papan Kerja SPK atas permintaan user 2026-09-06, supaya
 * tidak tercampur dengan alur klaim/kerjakan SPK. Isinya cuma membungkus
 * StaffCreateOrderPanel.jsx dengan chrome halaman biasa (Sidebar+Topbar
 * disediakan otomatis oleh Layout.jsx, halaman ini cuma perlu kontennya). */
export default function StaffCreateOrderPage() {
  return <StaffCreateOrderPanel />;
}
