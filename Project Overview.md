---
tags: [overview, bintang-erp, graphify]
created: 2026-07-27
---

# 🗺️ Bintang ERP — Project Overview

> Disusun dari knowledge base yang sudah kamu siapkan: `PROJECT_KNOWLEDGE_BASE.md`, `CLAUDE.md`, dan `graphify-out/GRAPH_REPORT.md` (hasil scan Graphify: **3.705 node · 11.821 edge · 280 komunitas**, 27 Juli 2026) — ditambah `AGENTS.md` & `AUDIT_PERBAIKAN.md` di repo backend. Tidak ada source code yang di-scan manual untuk menyusun catatan ini.

## 1. Apa Project Ini

**Bintang ERP** — sistem internal untuk bisnis advertising, mencakup: POS/kasir, inventori (bahan baku & produk jadi), produksi/job board (SPK), CRM pelanggan & supplier, HR/absensi, dan akuntansi internal (COA, jurnal, buku besar, kas & bank). Ada juga integrasi bot WhatsApp untuk order/CS otomatis (terlihat dari komunitas `wa_logic.py`, `whatsapp.py`, `EvolutionAPIClient` di graph).

| Komponen | Stack | Lokasi |
|---|---|---|
| **Backend** | Django 6 · DRF · SimpleJWT · drf-spectacular · SQLite (dev) / PostgreSQL (prod) | `bintang-advertising-backend/` |
| **Frontend** | React 19 · Vite 8 · React Router 7 · Axios · TailwindCSS | `bintang-react-frontend/` |
| **Graphify** | Knowledge graph arsitektur project | `graphify-out/` |

## 2. Arsitektur Backend — realitas vs target

Dari daftar migration di graph report, app Django yang **benar-benar berdiri sendiri** saat ini cuma empat: `accounting`, `api`, `hr`, `users` (plus `core` yang isinya cuma `settings.py`/`urls.py`, bukan domain app).

- **`accounting`** — paling rapi, 19+ migration sendiri (COA, Jurnal, Buku Besar, Kas & Bank, Settlement, Opening Balance). Contoh app yang sudah "lulus" dari pola god-file.
- **`api`** — app serba-ada: order, POS, produk, inventori, kontak, marketing, job board, promo/kupon, semuanya menumpuk di sini. Ini sumber god node `api/views.py` (~3.700 baris) dan `api/models.py`.
- **`hr`** — absensi, payroll, slip gaji, kontrak.
- **`users`** — autentikasi, security audit log, throttle login/reset password.

⚠️ **Catatan penting**: `AGENTS.md` menyebut `orders`, `inventory`, `pos` sebagai domain yang **seharusnya** dipisah jadi app sendiri-sendiri — tapi di graph tidak ada `orders/migrations`, `inventory/migrations`, atau `pos/migrations`. Artinya pemisahan itu masih **target arsitektur**, belum kondisi sekarang. Kalau lanjut development di area ini, `accounting` adalah referensi pola yang sudah berhasil.

## 3. Empat Pasang Modul yang Mirip Tapi BUKAN Duplikat

Dari `AGENTS.md` — penting supaya tidak salah anggap "duplikat" lalu dihapus:

| Modul | Domain | Catatan |
|---|---|---|
| `Inventory` (`/inventory`) | Bahan baku (tinta, roll — `InventoryItem`) | Satu-satunya tempat kelola/restock bahan baku |
| `ProductInventoryApp` (`/product-inventory/*`) | Katalog produk jadi (`Product`/`ProductVariant`) | Tidak ada CRUD bahan baku sama sekali |
| `CustomersPageLegacy` (`/customers`) | Dashboard CS & penagihan (`Contact`) | Satu-satunya tempat pelunasan piutang (`POST /orders/:id/bayar/`) |
| `CustomerSupplierApp` (`/customer-supplier/*`) | Master data (`Customer`/`Supplier`) | Grup, diskon, deposit, review |

## 4. God Nodes — Pusat Gravitasi Sistem

10 node dengan koneksi terbanyak di graph (artinya paling berisiko kalau diubah — dampaknya menyebar luas):

| # | Node | Edges | Peran |
|---|---|---|---|
| 1 | `apiClient` | 163 | HTTP client pusat di frontend — semua modul lewat sini |
| 2 | `Contact` | 121 | Model kontak/pelanggan |
| 3 | `CustomUser` | 120 | Model autentikasi & user |
| 4 | `Order` | 119 | Model pesanan utama & POS |
| 5 | `JobBoard` | 113 | Papan produksi & tugas kerja |
| 6 | `IsOwnerOrManager` | 110 | Guard permission DRF |
| 7 | `Product` | 105 | Model produk, varian, inventori |
| 8 | `useAuth()` | 96 | React hook context autentikasi |
| 9 | `InventoryItem` | 85 | Manajemen stok/logistik |
| 10 | `notify()` | 85 | Helper notifikasi frontend |

`IsOwnerOrManager` dan `apiClient` juga ditandai graph sebagai **cross-community bridge** (betweenness tertinggi) — keduanya jadi jembatan antar hampir semua modul, jadi perubahan di sini paling berisiko menyebar.

## 5. Kesehatan Kode — God Files

Aturan dari `AGENTS.md` (baris kode, exclude blank/komentar):
- Modul Python: soft **300** / hard **400**
- Komponen React (`.jsx`): soft **200** / hard **300**

Offender yang sudah teridentifikasi (dilarang ditambah, wajib di-extract kalau disentuh):

| File | ~Baris |
|---|---|
| Backend: `api/views.py` | ~3.700 |
| Frontend: `PointOfSale.jsx` | ~3.400 |
| Frontend: `ProductDetailPage.jsx` | ~2.800 |
| Frontend: `Orders.jsx` | ~2.500 |
| Frontend: `StockInPage.jsx` | ~2.300 |

## 6. Peta Komunitas (ringkasan — full list 280 komunitas ada di `graphify-out/GRAPH_REPORT.md`)

Cohesion score di graph ini rata-rata rendah (banyak di 0.05–0.20), artinya komunitas terbentuk sebagai **hub besar yang saling terhubung**, bukan modul yang benar-benar terisolasi — wajar untuk aplikasi web yang semuanya nyambung lewat `apiClient`/`IsOwnerOrManager`.

**Backend (per domain bisnis):**
- `Product` (135 node) — matrix permission inti (Owner/Manager/Admin/Kasir/Staff) + model produk
- `hr/views.py` (75 node) — absensi, kontrak, payroll
- `Customer` (67 node) — serializer jurnal akuntansi
- `Account` (67 node) — admin panel akuntansi
- `promo_engine.py` — mesin kupon/promo/diskon otomatis
- `report_views.py` + `_num` — laporan keuangan (Laba/Rugi, penjualan per item)
- `wa_logic.py` / `whatsapp.py` / `EvolutionAPIClient` — integrasi bot WhatsApp
- `migrate_flask_db.py` — script migrasi data dari sistem lama berbasis **Flask** (jejak sejarah project ini)

**Frontend (per fitur):**
- `apiClient` (39 node) — tulang punggung routing (`App`, `DashboardRouter`, `Layout`, `AuthContext`)
- `KasirApp.jsx` (40 node) — UI POS/kasir
- `StockOutPage.jsx` (47 node) — stok masuk/keluar, import CSV
- `ProductionApp.jsx` (32 node) — job board produksi
- `CustomerSupplierApp.jsx` (31 node) — halaman detail customer/supplier
- `AccountingInternalApp.jsx` (27 node) — UI akuntansi internal
- `Settings.jsx` (23 node) — menu berbasis role, license gate
- `ExecutiveDashboard.jsx` (13 node) — dashboard eksekutif

Untuk eksplorasi spesifik, pakai CLI graphify langsung (sesuai instruksi di `CLAUDE.md`):
```powershell
graphify query "<pertanyaan>"
graphify path "<A>" "<B>"
graphify explain "<konsep>"
```

## 7. Status Keamanan Terkini

Ringkasan dari `PROJECT_KNOWLEDGE_BASE.md` §3 dan `AUDIT_PERBAIKAN.md` (audit 21 Juli 2026):

**Backend**
- POS: harga/total dihitung ulang server-side, stok dikunci (row-lock) saat transaksi, nomor invoice bebas race condition, void dibatasi owner/manager, FIFO void dipulihkan dari konsumsi asli.
- Auth: throttle login/reset, passkey, token reset terikat request, maksimal 5 percobaan OTP, validasi IP proxy, security header fail-closed di production.
- Migration leaf tunggal: `0077_audit_security_integrity`.

**Frontend**
- Route default-deny, path kasir tervalidasi, shift terisolasi per-user (bukan global lagi).
- Pagination v3 pakai `fetchAllPages()` eksplisit, cap aman 50.000 baris (cegah UI freeze).

## 8. Insight Menarik dari Graph

- **Tidak ada import cycle** terdeteksi — sinyal bagus untuk kesehatan dependency.
- **65% edge EXTRACTED (dari AST) · 35% INFERRED** (confidence rata-rata 0.5) — sekitar sepertiga relasi di graph ini hasil inferensi model, bukan fakta AST murni. Graph menandai relasi `Contact` (102 edge), `CustomUser` (94 edge), `Order` (92 edge), `JobBoard` (87 edge) sebagai yang paling butuh diverifikasi.
- **285 node terisolasi** (≤1 koneksi) — kemungkinan dokumentasi/edge yang belum lengkap, bukan berarti kode mati.
- Koneksi tak terduga: model **`JournalEntry`** (accounting) langsung memakai `Customer`/`Supplier` dari app `api` — kopling lintas-domain antara akuntansi dan data pelanggan yang mungkin perlu diperhatikan kalau `api` nanti dipecah.

## 9. Sumber

- [`PROJECT_KNOWLEDGE_BASE.md`](PROJECT_KNOWLEDGE_BASE.md)
- [`CLAUDE.md`](CLAUDE.md)
- [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md)
- [`bintang-advertising-backend/AGENTS.md`](bintang-advertising-backend/AGENTS.md)
- [`bintang-advertising-backend/AUDIT_PERBAIKAN.md`](bintang-advertising-backend/AUDIT_PERBAIKAN.md)
- [`bintang-advertising-backend/README.md`](bintang-advertising-backend/README.md)

Belum dibaca: `PRODUCTION_READINESS_CHECKLIST.md` (28KB) — kandidat bahan analisa lanjutan kalau dibutuhkan.
