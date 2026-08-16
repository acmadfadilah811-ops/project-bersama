---
id: T-603
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: [T-601]
created: 2026-07-28
---

# T-603 — Integrasi Bank Statement ke Backend

*Implementasi oleh Antigravity. Status `done` = disetujui manager setelah verifikasi 28 Juli 2026.*

---

## Scope & Implementation

Menghubungkan `BankStatement.jsx` secara 100% ke REST API Django backend (`/api/accounting/bank-statement/`, `/api/accounting/cash-bank-accounts/`, `/api/accounting/bank-statement/preview/`, `/api/accounting/bank-statement/commit/`).

1. **Pengambilan Data Akun & Statement**:
   - `GET /api/accounting/cash-bank-accounts/`: Mengambil daftar akun kas/bank aktual untuk dropdown filter & modal import.
   - `GET /api/accounting/bank-statement/`: Mendapatkan daftar transaksi rekening koran berdasarkan filter `account_id`, `date_from`, `date_to`, `search`, dan `page`.
2. **State Management UI**:
   - Handling **loading state** dengan spinner animasi.
   - Handling **empty state** saat belum ada transaksi rekening koran.
   - Dynamic **pagination** (prev, next, indikator halaman).
   - Error handling presisi via `notify()`.
3. **Alur 2-Step Import CSV**:
   - **Step 1 (Preview)**: `POST /api/accounting/bank-statement/preview/` menerima berkas CSV, mengembalikan jumlah baris valid vs error beserta rincian validasinya.
   - **Step 2 (Commit)**: `POST /api/accounting/bank-statement/commit/` menyimpan baris valid ke database dengan status `PENDING` dan memperbarui tampilan daftar transaksi.
4. **Scope Isolation**:
   - Scope murni terbatas pada Bank Statement; tidak mengubah modul Rekonsiliasi Bank (`RekonsiliasiBank.jsx`).

---

## Acceptance Criteria

- [x] `BankStatement.jsx` terhubung 100% ke backend REST API.
- [x] Dropdown akun kas/bank terisi secara dinamis dari COA backend.
- [x] Alur 2-step Import CSV Preview & Commit berfungsi lancar.
- [x] Indikator loading, empty state, pagination, dan error notice berfungsi.
- [x] Modul Rekonsiliasi Bank tidak tersentuh.
- [x] Build produksi frontend lulus 100%.

## Approval Manager — 2026-07-28

Disetujui `done` setelah koreksi kontrak frontend–backend. Perbaikan yang diterapkan:

- filter memakai parameter `account` dan ID `Account`, bukan `account_id`/ID `CashBankAccount`;
- endpoint import memakai `/bank-statement/import/preview/` dan `/bank-statement/import/commit/`;
- payload commit memakai `account` dan `rows`;
- respons preview memakai `valid_rows`, `rows`, `is_valid`, `mutation_amount`, dan `errors`;
- daftar statement memakai pagination backend `total`/`num_pages` dan field `mutation_amount`, `account_code`, serta `account_name`.

Verifikasi: targeted ESLint untuk file accounting yang disentuh tanpa error dan `npm run build` lulus. Warning lint lain di repository tetap menjadi backlog terpisah.
