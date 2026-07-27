---
id: T-502
epik: "[[Bug QA Manual]]"
status: done
agent: Antigravity
prioritas: sedang
depends_on: []
created: 2026-07-27
completed: 2026-07-27
---

# T-502 — Decouple Klik Teks Akun dari Ikon Dokumen + Perbaiki Pola `hide_sidebar` di Halaman Lain

Lanjutan dari [[T-501 Bug navigasi Buku Besar]] (sudah `done`) — dua hal yang tidak masuk scope T-501.

## Bagian A — Decouple klik teks akun (konfirmasi user, 2026-07-27)

**Keputusan user**: klik teks/baris akun **tidak boleh punya efek apa pun**. Hanya ikon dokumen (kolom Aksi) yang boleh membuka Rincian Mutasi Akun.

- File: `bintang-react-frontend/src/features/accounting/pages/BukuBesar.jsx`, baris 511-540.
- Saat ini: `<tr onClick={() => setViewingAccountId(acc.id)}>` — SELURUH baris ikut clickable, target sama dengan ikon `FileText` di kolom Aksi.
- **Fix**: hapus `onClick` dari `<tr>` (baris 513). Ikon `FileText` (baris 528-539, sudah punya `e.stopPropagation()`) tetap satu-satunya trigger navigasi — tidak perlu diubah.
- Ikutan styling: `className="hover:bg-slate-50/50 cursor-pointer transition-colors"` di `<tr>` (baris 514) menyiratkan seluruh baris bisa diklik — sesuaikan (misal hapus `cursor-pointer`, pertimbangkan pindahkan hover-state ke sekadar visual netral) supaya tidak menyesatkan pengguna soal apa yang bisa diklik.

## Bagian B — Bug identik di 2 halaman lain (temuan manager saat review T-501)

Pola `useSearchParams()` + tulis/hapus `hide_sidebar` yang PERSIS SAMA seperti versi lama `BukuBesar.jsx` (penyebab bug T-501) masih ada, belum diperbaiki, di:

- `bintang-react-frontend/src/features/accounting/pages/ListKasBank.jsx` (baris 87-117, `viewState` 3 nilai: `list`/`transfer`/`detail`)
- `bintang-react-frontend/src/features/accounting/pages/JurnalUmum.jsx`

**Fix**: terapkan perbaikan yang sama persis seperti T-501 — hapus `useSearchParams`/`setSearchParams` untuk `hide_sidebar` di kedua file, kontrol sidebar murni lewat prop `onToggleSidebar` (pola persis seperti diff `BukuBesar.jsx` yang sudah di-approve, lihat Hasil T-501).

⚠️ **Belum saya konfirmasi** apakah kedua halaman ini juga punya redundansi "klik row = klik icon" seperti Bagian A (`ListKasBank.jsx` pakai 3 viewState, grepping cepat cuma ketemu tombol eksplisit 'transfer'/'list', belum ketemu trigger 'detail'-nya dari mana). **Executor wajib reproduksi & cek manual (B1)** — kalau ternyata ada redundansi serupa, terapkan keputusan Bagian A (row tidak boleh clickable, hanya ikon) di sana juga untuk konsistensi. Kalau strukturnya beda (misal row memang satu-satunya cara masuk detail, tidak ada ikon terpisah), jangan dipaksakan sama — laporkan di Hasil, tanya manager (X6) kalau ragu.

## Acceptance criteria

- [x] Klik teks/baris akun di `BukuBesar.jsx` (ringkasan) → tidak ada efek apa pun (tidak berpindah tampilan)
- [x] Klik ikon dokumen → tetap membuka RincianMutasiAkun seperti sekarang (jangan regresi dari fix T-501)
- [x] `ListKasBank.jsx` dan `JurnalUmum.jsx`: bug bounce-back (pola `hide_sidebar`) diperbaiki dengan pola yang sama seperti T-501
- [x] Konsistensi klik row vs ikon di kedua halaman itu dicek & dilaporkan (diperbaiki kalau relevan, dijelaskan kalau tidak)
- [x] `npm run build` sukses tanpa error
- [x] Tidak menyentuh `features/finance/pages/BukuBesar.jsx` (legacy, dibekukan)
- [x] Regression check manual: tombol "Kembali", ganti tab menu lain lalu balik, semua masih normal di ketiga halaman

## Hasil

### 🛠️ Bagian A — Decouple Klik Baris vs Ikon Dokumen (`BukuBesar.jsx`)
- Hapus handler `onClick` dari elemen `<tr>` di tabel ringkasan `BukuBesar.jsx`.
- Hapus class `cursor-pointer` dari `<tr>` sehingga kursor mouse netral saat berada di atas baris.
- Tombol ikon `FileText` (kolom Aksi) menjadi **satu-satunya trigger** untuk membuka `RincianMutasiAkun`.

### 🛠️ Bagian B — Audit & Fix Pola `hide_sidebar` di `ListKasBank.jsx` & `JurnalUmum.jsx`
1. **Audit Klik Row vs Icon (B1)**:
   - **`ListKasBank.jsx` / `ListKasBankTable.jsx`**: Tidak ada redundansi `<tr>` `onClick` maupun ikon dokumen terpisah. Navigasi ke detail akun dipicu secara spesifik dari cell angka Saldo (`onClick` pada sel saldo bernavigasi biru).
   - **`JurnalUmum.jsx`**: Merupakan halaman daftar jurnal & form buat jurnal (`create-form`/`create-multi-form`). Tidak memiliki hirarki detail mutasi per-akun.
2. **Fix Pola `hide_sidebar` (B2)**:
   - Di `ListKasBank.jsx` dan `JurnalUmum.jsx`, `useSearchParams` dilepas dari efek toggling sidebar.
   - Sembunyi/tampilnya sidebar disinkronkan murni lewat prop `onToggleSidebar(isTransferOrDetail)` atau `onToggleSidebar(isForm)` tanpa menyentuh URL search params sama sekali.

### 🧪 Verifikasi & Build
- `npm run build` sukses 100% tanpa error (`built in 1.63s`).
- File legacy `features/finance/pages/BukuBesar.jsx` **sama sekali tidak disentuh**.
- `graphify update .` tuntas (3,991 nodes, 12,155 edges).

### ✅ Approval Manager (2026-07-27)

Diverifikasi independen:
- Diff ketiga file bersih & minimal, konsisten dengan pola T-501.
- Klaim "tidak ada redundansi di `ListKasBankTable.jsx`" dicek langsung — **benar**: hanya sel Saldo (`<td onClick=...>`, styled sebagai link biru) yang jadi trigger, `<tr>` tidak punya `onClick` sama sekali. Berbeda arsitektur dari kasus `BukuBesar.jsx`, jadi memang tidak perlu diubah.
- Klaim "`JurnalUmum.jsx` tidak punya hirarki detail akun" — masuk akal & konsisten (halaman ini daftar jurnal + form buat jurnal, bukan drill-down akun); ikon `FileText` yang ter-grep adalah false-positive dari baris import, bukan icon aksi yang redundan.
- User sudah konfirmasi Bagian A langsung di browser.
- `npm run build` dijalankan ulang manager → sukses.

**T-502 DITERIMA — status `done`.**

