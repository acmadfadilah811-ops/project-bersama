---
id: T-606
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Antigravity
prioritas: tinggi
depends_on: [T-601]
created: 2026-07-28
---

# T-606 — Hubungkan Form Jurnal Manual dan Transfer Modal

*Implementasi oleh Antigravity. Status `review` = menunggu approval manager.*

---

## Scope & Implementation

Menghubungkan `TransferModal.jsx` dan `JurnalTunggal.jsx` ke REST API Django backend (`GET/POST /api/accounting/journal-entries/` & `GET /api/accounting/accounts/`).

1. **Transfer Modal (`TransferModal.jsx`)**:
   - `GET /api/accounting/accounts/`: Mengambil daftar akun COA secara dinamis.
   - `GET /api/accounting/journal-entries/?source_type=manual`: Mengambil riwayat transfer modal.
   - `POST /api/accounting/journal-entries/`: Membuat jurnal berimbang (DEBIT Kas/Bank penerima & KREDIT Kas/Bank sumber) dengan `source_type=manual`.
2. **Form Jurnal Manual (`JurnalTunggal.jsx`)**:
   - Selector akun COA terhubung langsung ke COA backend.
   - Fitur kumpul draf jurnal & posting simultan via `POST /api/accounting/journal-entries/` dengan baris Debit/Kredit presisi (M1/M2).
3. **Verifikasi Build**:
   - `npm run build` lulus 100% (2.31s).

---

## Acceptance Criteria

- [x] `TransferModal.jsx` terhubung 100% ke backend REST API.
- [x] `JurnalTunggal.jsx` terhubung 100% ke backend REST API.
- [x] Pilihan COA terisi dinamis dari database backend.
- [x] Jurnal manual & transfer modal terposting berimbang (M1/M2) ke `JournalEntry` & `JournalEntryLine`.
- [x] Build produksi frontend lulus 100%.

## Perbaikan lanjutan oleh Codex (manager) — 2026-07-29

- Detail **Pasangan Jurnal** dari List Kas & Bank sekarang mengambil satu `JournalEntry` langsung berdasarkan nomor jurnal, bukan melalui list yang dibatasi periode tanggal.
- Modal menampilkan setiap baris pasangan: tanggal, kode dan nama akun, nama transaksi, deskripsi, debit, kredit, dan pengguna pemroses dari data jurnal sebenarnya.
- Verifikasi: `check`, `makemigrations --check`, serta 9 test jurnal/ledger/POS/pembayaran lulus; lint dan build frontend lulus.
