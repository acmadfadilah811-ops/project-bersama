/**
 * ============================================================================
 * VERSI LAMA — TIDAK DIPAKAI APLIKASI
 * ============================================================================
 * File ini sisa rancangan awal modul Pelanggan & Supplier dan **tidak dirender
 * di mana pun**. Barrel `CustomerPages.jsx` / `SupplierPages.jsx` yang
 * mengekspornya sudah tidak diimpor oleh file mana pun.
 *
 * Halaman yang BENAR-BENAR dipakai: `pages/CustomerSupplierApp.jsx`
 * (rute `/customer-supplier/*` di App.jsx), yang sudah terhubung ke API asli.
 *
 * Jangan jadikan file ini acuan kondisi aplikasi — mengubahnya tidak
 * berpengaruh apa pun ke layar yang dilihat pengguna. Aman untuk dihapus.
 * ============================================================================
 */
import { AlertCircle } from 'lucide-react';
import { PageHeader } from '../../../inventory/pages/components/PageShell';

/**
 * Grup Supplier belum tersedia: backend tidak punya model SupplierGroup, dan
 * model Supplier pun belum punya kolom grup. Sebelumnya halaman ini menampilkan
 * data contoh yang tersimpan hanya di memori — terlihat berfungsi padahal hilang
 * saat halaman dimuat ulang. Lebih baik menyatakannya apa adanya.
 */
export function SupplierGroupsPage() {
  return (
    <>
      <PageHeader
        title="Grup Supplier"
        description="Kelompokkan supplier berdasarkan jenis pasokan."
      />
      <div
        style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          border: '1px solid #fde68a', background: '#fffbeb',
          borderRadius: 12, padding: '16px 18px', margin: '8px 0',
        }}
      >
        <AlertCircle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Belum tersedia</strong>
          Pengelompokan supplier membutuhkan tabel grup di database dan kolom grup pada data
          supplier — keduanya belum ada. Daftar supplier sendiri sudah berfungsi penuh di menu{' '}
          <strong>Supplier</strong>.
        </div>
      </div>
    </>
  );
}
