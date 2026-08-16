---
id: T-622
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-07-30
---

# T-622 — Hubungkan Pengaturan Supplier dan Simpanan Pelanggan ke Backend

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** `akun_hutang`/`jatuh_tempo_hari` nyata di model `Supplier`, migration terpasang, permission kasir 403 terbukti test, 3/3+3/3 test lulus.

*Dikerjakan langsung oleh Claude (biasanya manager) karena agent executor lain sedang off — instruksi eksplisit user. Status tetap `review`, bukan `done`, sesuai Protokol Agent (final approval tetap butuh verifikasi independen dari user/manager).*

## Scope

User bertanya apakah menu Akuntansi > Pengaturan Supplier dan Akuntansi > Simpanan Pelanggan sudah terhubung backend. Audit menemukan keduanya 100% mock:
- `PengaturanSupplier.jsx`: 3 supplier hardcode di `useState`, tombol "Perbarui" cuma update state lokal + toast, tidak ada `apiClient` sama sekali.
- `SimpananPelanggan.jsx`: `deposits` di-set array kosong dengan komentar eksplisit "Empty dataset matching screenshot ('No Data')" — sengaja mock.

Task ini menyambungkan keduanya ke data asli. Tidak menyentuh jurnal/posting (murni settings + laporan saldo), jadi F1 (desain debit/kredit) tidak berlaku.

## Konteks graph

- `graphify explain "SimpananPelanggan.jsx"` dan `"PengaturanSupplier.jsx"` — degree rendah, cuma terhubung ke `notify()`, TIDAK ke `apiClient` sama sekali → konfirmasi mock.
- `graphify query "customer deposit saldo simpanan wallet ..."` → menemukan `Customer.deposit` (`api/customer_models.py:36`) sudah ada sebagai field asli, tidak pernah dipakai UI manapun.
- Endpoint yang sudah ada dan dipakai ulang (bukan bikin baru): `CustomerViewSet` (`/api/customers/`), `SupplierViewSet` (`/api/suppliers/`), `AccountListView` (`/api/accounting/accounts/`).

## Acceptance criteria

- [x] `SimpananPelanggan.jsx` membaca `Customer.deposit` asli via `/api/customers/` (fetchAllPages), filter `deposit != 0`, kolom Kode/Pelanggan/Jumlah dari data nyata.
- [x] `PengaturanSupplier.jsx` membaca daftar Supplier asli via `/api/suppliers/` dan daftar akun hutang (liability) via `/api/accounting/accounts/`.
- [x] Model `Supplier` dapat 2 field baru: `akun_hutang` (FK `accounting.Account`, nullable) dan `jatuh_tempo_hari` (nullable) — migration `api/0095_supplier_akun_hutang_jatuh_tempo.py`.
- [x] "Ubah" di Pengaturan Supplier menyimpan lewat `PATCH /api/suppliers/{id}/` sungguhan (bukan state lokal).
- [x] Authorization server-side: `SupplierViewSet` tetap pakai `IsOwnerManagerAdminOrReadOnly` yang sudah ada (kasir/staff read-only) — dibuktikan test.
- [x] Tidak ada file melebihi hard limit — `EditSupplierModal.jsx` diekstrak dari `PengaturanSupplier.jsx` supaya tetap di bawah 300 baris JSX (247 + 81 baris).
- [x] Test baru `api/tests_supplier_settings.py` (3/3 lulus) + suite `api.tests_customer_import` & `accounting` (80/80 lulus, 0 regresi).
- [x] `npm run build` lulus 100%.
- [x] `graphify update .` sudah dijalankan.

## Hasil

- **File diubah (backend)**:
  - `api/customer_models.py` — tambah `akun_hutang`, `jatuh_tempo_hari` ke `Supplier`.
  - `api/customer_serializers.py` — `SupplierSerializer` tambah `akun_hutang_display` (read-only, format "kode - nama").
  - `api/migrations/0095_supplier_akun_hutang_jatuh_tempo.py` — migration baru.
  - `api/tests_supplier_settings.py` — test baru (owner bisa ubah, kasir 403, display kosong saat belum diset).
- **File diubah (frontend)**:
  - `bintang-react-frontend/src/features/accounting/pages/PengaturanSupplier.jsx` — fetch asli, PATCH asli, loading/error state.
  - `bintang-react-frontend/src/features/accounting/components/settings/EditSupplierModal.jsx` — baru, hasil ekstraksi modal (L5).
  - `bintang-react-frontend/src/features/accounting/pages/SimpananPelanggan.jsx` — fetch asli dari `/api/customers/`, filter deposit != 0, loading state, perbaiki format total (sebelumnya `IDR {totalSum}` tanpa `toLocaleString`, tidak konsisten dengan baris lain).
- **Endpoint berubah**: tidak ada endpoint baru. Kontrak `SupplierSerializer` bertambah field (`akun_hutang`, `jatuh_tempo_hari`, `akun_hutang_display`) — additive, tidak menghapus/mengganti field lama (API5 aman).
- **Migration**: `api.0095_supplier_akun_hutang_jatuh_tempo` — FK baru lintas app (`api.Supplier` → `accounting.Account`), pakai string reference `'accounting.Account'` (lazy, tanpa import langsung) mengikuti idiom yang sudah ada di `product_views.py` (DB5, R2 god node `Account` disentuh secara aditif, tidak ubah perilaku lama).
- **Keputusan penting**:
  - Simpanan Pelanggan HANYA baca (report saldo `Customer.deposit`); tidak ada mutasi saldo dari halaman ini — kalau nanti butuh alur top-up/pemakaian deposit, itu task terpisah (butuh desain F1 karena menyentuh uang).
  - Tombol Export PDF/Excel di Simpanan Pelanggan TIDAK disentuh (masih toast simulasi) — di luar scope pertanyaan user ("terhubung backend & ambil data asli"), U1.
  - Verifikasi visual di browser BELUM dilakukan oleh Claude — user meminta cek sendiri via browser. Backend diverifikasi via test (`APITestCase`, bukan hanya baca kode) dan `npm run build`. Data uji sementara (1 user dummy + 1 deposit dummy) sudah dihapus/dikembalikan setelah dipakai untuk mengecek migration jalan di DB dev.

**Follow-up styling (sesi sama, instruksi user)**: user minta hilangkan garis tepi kotak (card border) di 4 halaman supaya lebih profesional — `PengaturanSupplier.jsx`, `SimpananPelanggan.jsx` (2 file di atas) + 2 file tambahan di luar scope awal T-622: `PelangganJatuhTempo.jsx` dan `UangMukaPembelian.jsx`. Perubahan murni CSS (hapus class `border border-slate-*` pada div card pembungkus & wrapper tabel, shadow tetap dipertahankan untuk depth) — tidak menyentuh logic/data, tidak ada risiko. `npm run build` lulus lagi setelah perubahan ini.
