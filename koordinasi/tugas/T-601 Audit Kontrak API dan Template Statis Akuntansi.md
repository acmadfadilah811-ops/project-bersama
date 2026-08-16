---
id: T-601
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-601 — Audit Kontrak API dan Template Statis Akuntansi

## Scope

Audit komprehensif 46 submenu dan komponen aplikasi Akuntansi (`AccountingInternalApp.jsx` & `AccountingSecondarySidebar.jsx`).

Audit ini menginventarisasi seluruh submenu ke dalam 5 status:
1. **LIVE**: Terhubung 100% ke Django REST API aktif (`accounting/urls.py` / `api/urls.py`).
2. **READ-ONLY**: Menyajikan data riil dari backend tanpa form modifikasi.
3. **MOCK / EMPTY SCREENSHOT**: Merender data statis hardcoded / layar kosong tanpa fetch HTTP riil.
4. **DISCONNECTED**: Mengirim notifikasi UI (`notify()`) atau memanggil endpoint yang tidak didukung backend (misal 405 Method Not Allowed).
5. **FEATURE-GATED**: Tersembunyi/dikunci oleh sakelar rilis produk.

---

## Snapshot OpenAPI 3.0 & Klarifikasi Parameter

Snapshot OpenAPI 3.0 diekstrak via `python manage.py spectacular --file schema.yml`:
- **File Snapshot**: `bintang-advertising-backend/schema.yml` (dihasilkan via `drf-spectacular`).
- **Klarifikasi Parameter `source` vs `sumber` vs `sumber_tipe`**:
  - `JournalEntry` (Akuntansi): Menggunakan parameter English **`source_type`** (`manual`, `pos_sale`, `order_payment`, `settlement`, dll.) dan **`source_id`** (`PositiveIntegerField`).
  - `Order` (CRM/Kasir): Menggunakan parameter Indonesian **`sumber`** (`online`, `pos`, `manual`, `whatsapp`).
  - `ProductStockMovement` (Inventori): Menggunakan parameter Indonesian **`sumber_tipe`** (`saldo_awal`, `stock_in`, `purchase`, `produksi`, `opname`, `pos_void`, `manual`).
  - *Catatan Penting*: Frontend & serializer wajib membedakan parameter ini secara tepat agar payload HTTP `POST`/`GET` tidak tertukar antara `source_type`, `sumber`, dan `sumber_tipe`.

---

## Matriks Audit 46 Submenu Akuntansi

| Submenu / View Name | Status Frontend | Endpoint URL | View Django | Serializer / Model | Next Task Mapping |
|---|---|---|---|---|---|
| **AccountingSettings** | `LIVE` | `GET/POST /api/accounting/settings/` | `AccountingSettingsView` | `AccountingSettingsSerializer` / `AccountingSettings` | Ready (Lunas) |
| **DaftarAkun (COA)** | `LIVE` | `GET/POST /api/accounting/accounts/` | `AccountViewSet` | `AccountSerializer` / `Account` | Ready (Lunas) |
| **JurnalUmum** | `LIVE` | `GET/POST /api/accounting/journal-entries/` | `JournalEntryViewSet` | `JournalEntrySerializer` / `JournalEntry` | Ready (Lunas) |
| **BukuBesar** | `LIVE` | `GET /api/accounting/ledger/` | `LedgerSummaryView` | `LedgerSummarySerializer` / `JournalEntryLine` | Ready (Lunas) |
| **LogJurnal** | `LIVE` | `GET /api/accounting/journal-audit-logs/` | `JournalAuditLogViewSet` | `JournalAuditLogSerializer` / `JournalAuditLog` | Ready (Lunas) |
| **ListKasBank** | `LIVE` | `GET/POST /api/accounting/cash-bank-accounts/` | `CashBankAccountViewSet` | `CashBankAccountSerializer` / `CashBankAccount` | Ready (Lunas) |
| **Invoice** | `LIVE` | `GET /api/orders/` | `OrderViewSet` | `OrderSerializer` / `Order` | Ready (Lunas) |
| **LabaRugiSatuPeriode** | `MOCK` | Mock local state `rawPendapatan` | None | N/A | T-602 (Gating) / T-603 |
| **LabaRugiMultiPeriode** | `MOCK` | Mock local state | None | N/A | T-602 (Gating) / T-603 |
| **Neraca** | `MOCK` | Mock local state `rawAset` | None | N/A | T-602 (Gating) / T-604 |
| **PerubahanModal** | `MOCK` | Mock local state | None | N/A | T-602 (Gating) / T-604 |
| **ArusKas** | `MOCK` | Mock local state | None | N/A | T-602 (Gating) / T-605 |
| **JurnalTunggal** | `DISCONNECTED` | Form UI only (`notify()`) | None | N/A | T-602 (Gating) / T-606 |
| **MultiJurnal** | `DISCONNECTED` | Form UI only (`notify()`) | None | N/A | T-602 (Gating) / T-606 |
| **HutangJurnalTunggal** | `DISCONNECTED` | Form UI only (`notify()`) | None | N/A | T-602 (Gating) / T-606 |
| **HutangMultiJurnal** | `DISCONNECTED` | Form UI only (`notify()`) | None | N/A | T-602 (Gating) / T-606 |
| **TransferModal** | `DISCONNECTED` | Form UI only (`notify()`) | None | N/A | T-602 (Gating) / T-606 |
| **CaraPembayaran** | `DISCONNECTED` | Form UI only (`notify()`) | None | N/A | T-602 (Gating) / T-606 |
| **TutupBukuTokoIni** | `DISCONNECTED` | Retries `POST /accounting/ledger/` (405) | `LedgerSummaryView` | `GET` only (405 on `POST`) | T-602 (Gating) / T-607 |
| **TutupBukuPusatCabang** | `DISCONNECTED` | Retries `POST /accounting/ledger/` (405) | `LedgerSummaryView` | `GET` only (405 on `POST`) | T-602 (Gating) / T-607 |
| *26 Submenu Lainnya* | `MOCK/DISCONNECTED` | Mock local state / un-routed | None | N/A | T-602 (Gating & Hardening) |

---

## Rekomendasi Alokasi Epik & Next Tasks

1. **T-602 (Feature Gating & Mock Shielding)**: Pasang `BrandyFeatureGate` pada 39 submenu `MOCK` dan `DISCONNECTED` di `AccountingInternalApp.jsx` agar UI production tidak membocorkan data mock hardcoded.
2. **T-603 (Laporan Laba Rugi Real-Time)**: Hubungkan endpoint backend Laba Rugi ke `JournalEntryLine` (Akun Pendapatan 4xxxx & Beban 5xxxx/6xxxx).
3. **T-604 (Laporan Neraca & Perubahan Modal)**: Hubungkan endpoint backend Neraca ke `JournalEntryLine` (Aset 1xxxx, Kewajiban 2xxxx, Ekuitas 3xxxx).
4. **T-605 (Laporan Arus Kas)**: Hubungkan laporan Arus Kas ke transaksi `CashBankAccount` / `JournalEntryLine` (Metode Langsung/Tak Langsung).
5. **T-606 (Form Jurnal Manual & Multi-Journal)**: Hubungkan Form Jurnal Tunggal, Multi Jurnal, Transfer Modal ke `POST /api/accounting/journal-entries/`.
6. **T-607 (Modul Tutup Buku & Periode Akuntansi)**: Sediakan endpoint `POST /api/accounting/periods/close/` untuk proses Tutup Buku Toko Ini & Pusat Cabang.

## Approval Manager — 2026-07-28

Audit disetujui `done` sebagai deliverable audit. Snapshot `schema.yml`, matriks 46 submenu, koreksi parameter `sumber`, serta pembagian T-602–T-612 sudah tercatat. Temuan schema generation (401 error dan 136 warning pada validasi) adalah gap implementasi yang sengaja diteruskan ke task hardening, bukan alasan untuk mengklaim kontrak sudah sempurna.
