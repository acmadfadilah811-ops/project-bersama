---
tags: [epik, production-readiness, accounting, integration]
created: 2026-07-28
status: planned
owner: manager
---

# Program Production Readiness & Integrasi Akuntansi

## Tujuan

Membawa `bintang-advertising-backend` dan `bintang-react-frontend` ke kondisi
siap produksi dengan dua hasil yang dapat dibuktikan:

1. tidak ada menu Akuntansi yang menampilkan data contoh/mock seolah-olah data
   produksi; setiap menu harus terhubung ke sumber data backend yang sah,
   dinonaktifkan dengan pesan yang jujur, atau disembunyikan melalui feature
   gate sampai backend tersedia;
2. deployment hanya boleh dilakukan setelah integritas finansial, keamanan,
   migrasi, observability, backup/restore, performa, dan rollback dibuktikan
   lewat evidence, bukan skor atau checklist asumsi.

Program ini adalah peta kerja manager. Setiap executor hanya boleh mengklaim
satu task kecil di [[Agent Board]] sesuai [[Protokol Agent]].

## Baseline hasil Graphify (2026-07-28)

Graph saat ini sinkron dengan commit `347d4e37`:

- 4.272 node, 12.291 edge, 333 komunitas;
- tidak ada import cycle yang terdeteksi;
- `apiClient` (163 edge), `Order` (130), `Contact` (126),
  `CustomUser` (124), `IsOwnerOrManager` (109), dan `useAuth()` (96)
  adalah titik perubahan berisiko tinggi;
- `AccountingInternalApp.jsx` adalah composition hub untuk lebih dari 40
  halaman Akuntansi;
- backend sudah memiliki endpoint untuk COA, jurnal, buku besar, payment
  method, kas/bank, bank statement, rekonsiliasi, settlement, transfer modal,
  saldo awal, settings, dan lifecycle log;
- hubungan URL-string frontend ke route backend tidak terbentuk sebagai edge
  AST. Karena itu kecocokan method/path/payload/response wajib diaudit terhadap
  skema drf-spectacular pada T-601.

### Template statis yang sudah terkonfirmasi

| Halaman | Bukti | Perlakuan sebelum production |
|---|---|---|
| `BankStatement.jsx` | komentar `Dummy statement list` di sekitar L56; tidak ada pemanggilan `apiClient` di halaman | hubungkan ke endpoint bank statement atau feature-gate |
| `DaftarPiutang.jsx` | komentar `Static mock data` di sekitar L49 | gunakan sumber Order/piutang yang disetujui; jangan membuat ledger baru |
| `KonfirmasiSettlement.jsx` | komentar `Mock settlement items` di sekitar L12 | hubungkan ke settlement backend setelah aturan status diverifikasi |
| `PosTransactions.jsx` | `mockPosData` di sekitar L45 | gunakan endpoint POS yang sudah ada |
| `PenjualanDiToko.jsx` | komentar `Mock Sales Data` di sekitar L48 | gunakan sumber transaksi POS/Order yang sudah ada |
| `SimpananPelanggan.jsx` | dataset kosong untuk meniru screenshot di sekitar L7 | audit model/sumber deposit; feature-gate sampai kontrak disetujui |

### Kandidat template / disconnected yang wajib diaudit T-601

Tidak adanya `apiClient` di file halaman belum otomatis berarti bug karena
data dapat datang dari parent, hook, context, atau props. Daftar berikut harus
diverifikasi, bukan langsung dibuatkan endpoint baru:

- Kas & Bank: `BankStatement`, `RekonsiliasiBank`,
  `KonfirmasiSettlement`, `TransferModal`;
- transaksi: `PosTransactions`, `PenjualanDiToko`,
  `PenjualanMarketplace`, `Pembelian`, `ReturPenjualan`,
  `ReturPembelian`, `StokMasuk`, `StokKeluar`, `ProduksiStok`,
  `OpnameStok`;
- pendapatan/biaya: `Pendapatan`, `Pengeluaran`, `KomisiPenjualan`,
  `BiayaMdr`;
- piutang/hutang: `DaftarPiutang`, `PelangganJatuhTempo`,
  `UangMukaPembelian`, `SemuaHutang`, `PengaturanSupplier`,
  `SimpananPelanggan`, form jurnal tunggal/multi;
- aset dan laporan: `DaftarAset`, `DaftarBiaya`, `Invoice`,
  `DetailPiutangSelesai`, laporan keuangan, dan tutup buku.

## Keputusan arsitektur

### Opsi A — big-bang

Menghubungkan semua halaman dan mengerjakan hardening production dalam satu
epik implementasi.

Trade-off:

- waktu kalender tampak singkat;
- diff sangat besar, kontrak sulit direview, rollback tidak granular;
- mencampur perubahan data uang, endpoint, UI, security, dan operasi;
- melanggar U1 dan meningkatkan risiko L1-L10.

### Opsi B — phase-gated (dipilih)

Audit kontrak lebih dulu, pecah implementasi per domain/sumber data, selesaikan
integritas jurnal, lalu lakukan production gate berbasis evidence.

Trade-off:

- memerlukan disiplin dependency dan lebih banyak task kecil;
- progress lebih mudah diuji, direview, dirollback, dan dikerjakan paralel;
- keputusan skema/kontrak finansial tetap melewati approval manager;
- fitur yang belum siap dapat ditahan tanpa memalsukan data.

### Kebijakan UI production

Setiap menu wajib berada tepat pada satu status:

1. **LIVE** — membaca/menulis backend nyata, memiliki loading/empty/error state,
   permission, pagination bila list, dan test kontrak;
2. **READ-ONLY** — backend nyata tetapi aksi mutasi belum dibuka; UI menjelaskan
   batasnya;
3. **FEATURE-GATED** — tidak tampil untuk production sampai backend dan test
   selesai;
4. **UNAVAILABLE** — hanya bila manager meminta menu tetap terlihat; tampilkan
   pesan “Fitur belum tersedia”, tanpa angka atau transaksi contoh.

Status **MOCK** dilarang pada build production.

## Work breakdown

### Gate 0 — inventarisasi dan kontrak

| ID | Task | Output | Depends on |
|---|---|---|---|
| T-601 | Audit kontrak API dan template statis Akuntansi | matriks seluruh menu: source, endpoint, method, payload, response, role, pagination, status LIVE/MOCK/GATED | — |
| T-602 | Pasang production feature gate untuk menu belum siap | tidak ada mock yang dapat dianggap data produksi | T-601 |

T-601 adalah satu-satunya task baru yang langsung siap diklaim. Task
implementasi di bawah tidak boleh dimulai sebelum matriks T-601 disetujui.

### Gate 1 — integrasi UI Akuntansi

Task harus dipecah lagi menjadi irisan maksimal satu hari bila hasil T-601
menunjukkan scope terlalu besar.

| ID | Task | Scope utama | Depends on |
|---|---|---|---|
| T-603 | Hubungkan Bank Statement | list/import/preview/commit statement, pagination, empty/error/loading | T-601 |
| T-604 | Hubungkan Rekonsiliasi Bank | unmatched bank/internal lines dan match manual dengan validasi akun | T-601, T-603 |
| T-605 | Hubungkan Settlement | list/confirm settlement; verifikasi status, nominal per pembayaran, dan idempotensi | T-601, T-211 |
| T-606 | Hubungkan Transfer Modal | list/create transfer melalui service jurnal dan akun Kas & Bank | T-601 |
| T-607 | Hubungkan transaksi POS dan Penjualan di Toko | ganti mock dengan endpoint POS/Order yang sudah ada; jangan buat sumber transaksi kedua | T-601 |
| T-608 | Hubungkan pembelian, retur, dan pergerakan stok | reuse domain inventory/order; mutasi stok melalui service FIFO | T-601 |
| T-609 | Desain dan implementasi Piutang/Hutang/Deposit | tentukan source of truth dan lifecycle; approval desain finansial sebelum kode | T-601 |
| T-610 | Desain dan implementasi Aset/Biaya/Invoice | audit model yang sudah ada; perubahan skema/FK wajib approval manager | T-601 |
| T-611 | Validasi laporan dan tutup buku end-to-end | laporan berasal dari `accounting.JournalEntry`, periode terkunci, ekspor sesuai filter | T-601, T-206 |
| T-612 | Permission dan audit trail seluruh Akuntansi | matriks role backend, queryset scoping, lifecycle log, frontend hanya refleksi | T-601 |

### Gate 2 — integritas akuntansi

Jangan membuat task duplikat. Selesaikan backlog yang sudah ada:

- T-104 — void/retur POS menjadi jurnal pembalik dan menjaga settlement;
- T-105 — rekonsiliasi shift POS dengan jurnal;
- T-107 — HPP POS;
- T-203 — edge case pembayaran Order;
- T-204 — HPP Order;
- T-205 — test integrasi Orders–Akuntansi;
- T-206 — migrasi dan pensiun ledger legacy HR;
- T-207 — jurnal pembalik Order;
- T-211 — desain settlement Order.

Gate 2 lulus hanya jika:

- semua posting lewat `create_journal_entry()` (M2/L2);
- nilai uang memakai `Decimal` (M1/L6);
- operasi finansial atomic dan idempotent (M4-M5);
- void/retur memakai jurnal pembalik (M7/L7);
- debit sama dengan kredit, retry tidak menggandakan jurnal, dan kegagalan
  di tengah melakukan rollback (T3);
- tidak ada penulis baru ke ledger legacy HR (M3/L3).

### Gate 3 — production engineering

Dokumen `PRODUCTION_READINESS_CHECKLIST.md` terakhir diperbarui 2026-06-07 dan
berisi target/score yang belum otomatis menjadi bukti kondisi saat ini. Semua
item harus diaudit ulang.

| ID | Task | Evidence wajib | Depends on |
|---|---|---|---|
| T-701 | Audit ulang production readiness | matriks PASS/FAIL/UNKNOWN beserta command, test, atau konfigurasi pembukti | — |
| T-702 | Staging, environment, dan security baseline | `DEBUG=False`, secrets eksternal, allowed hosts/CORS/CSRF/HTTPS, fail-closed check | T-701 |
| T-703 | Database, migration, backup, dan restore drill | PostgreSQL staging, satu migration leaf, backup terjadwal, restore terbukti | T-701 |
| T-704 | Observability dan incident handling | health/readiness, structured log, error tracking, alert dan redaction data sensitif | T-701 |
| T-705 | Performance dan load test | dataset representatif, p95 target disetujui, query budget, concurrency finansial | T-701, T-703 |
| T-706 | Frontend production hardening | build bersih, tidak ada mock, error boundary, API error UX, route/permission smoke test | T-602, T-603-T-612 |
| T-707 | Runbook deploy dan rollback | langkah deploy, migration, smoke test, rollback app+DB, PIC dan trigger eskalasi | T-702-T-706 |
| T-708 | Final go-live gate dan UAT finansial | checklist sign-off manager, skenario POS/Order→jurnal→ledger→laporan→reversal | T-104, T-105, T-107, T-203-T-207, T-211, T-707 |

## Urutan eksekusi

```text
T-601
  ├─ T-602 ───────────────────────────────┐
  ├─ T-603..T-612 ── T-706 ──────────────┤
  └─ backlog T-104..T-211 (Gate 2) ──────┤
T-701 ───── T-702..T-705 ────────────────┤
                      T-706 ─ T-707 ─ T-708
```

T-708 tidak boleh disetujui jika masih ada:

- menu Akuntansi berstatus MOCK;
- task uang/akuntansi kritis belum `done`;
- migration/restore belum diuji di staging;
- error security/data integrity yang belum ditutup;
- endpoint tanpa permission server-side;
- test finansial, build frontend, atau smoke test utama gagal.

## Definition of Ready untuk task implementasi

- [ ] Source of truth dan pemilik domain sudah ditulis.
- [ ] Endpoint lama diperiksa di schema drf-spectacular.
- [ ] Mapping UI field ↔ request/response terdokumentasi.
- [ ] Role dan queryset scoping disetujui.
- [ ] Untuk uang/jurnal/stok: desain status, debit/kredit, idempotensi,
      atomicity, reversal, dan edge case disetujui manager (F1).
- [ ] Tidak membutuhkan perubahan god model/FK/kontrak lama tanpa eskalasi X2/X5.

## Definition of Done program

- [ ] Semua submenu Akuntansi memiliki status LIVE, READ-ONLY, atau
      FEATURE-GATED; tidak ada MOCK di production.
- [ ] Frontend dan OpenAPI contract test cocok untuk method, path, payload,
      response, pagination, dan error.
- [ ] Seluruh Gate 2 selesai dan suite `api accounting` lulus.
- [ ] Build frontend production dan smoke test role utama lulus.
- [ ] Backup/restore dan rollback terbukti di staging.
- [ ] Observability serta alerting aktif sebelum traffic production.
- [ ] UAT finansial end-to-end ditandatangani manager.
- [ ] `graphify update .` dijalankan setelah perubahan kode.

## Batas scope

- Dokumen ini tidak mengotorisasi perubahan skema, FK lintas app, dependency
  baru, atau breaking API; semua itu tetap mengikuti X2/X5 dan approval manager.
- Tidak membuat ledger ketiga dan tidak menghidupkan kembali ledger legacy HR.
- Tidak menganggap halaman dengan nama mirip sebagai duplikat tanpa
  memverifikasi model dan endpoint.
- Tidak menetapkan target kapasitas “1M user” sebagai kebutuhan final sebelum
  manager menetapkan traffic, data volume, RPO, RTO, dan SLO yang realistis.
