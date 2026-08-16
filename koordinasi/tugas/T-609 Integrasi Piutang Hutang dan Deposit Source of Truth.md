---
id: T-609
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Antigravity
prioritas: tinggi
depends_on: [T-601]
created: 2026-07-28
---

# T-609 — Integrasi Piutang, Hutang, dan Deposit Berdasarkan Source of Truth

*Implementasi oleh Antigravity. Status `review` = menunggu approval manager.*

---

## Scope & Implementation

Menghubungkan `DaftarPiutang.jsx`, `SemuaHutang.jsx`, dan `SimpananPelanggan.jsx` ke backend REST API (`GET /api/orders/` & `GET /api/stock-in-documents/`).

1. **Source of Truth Piutang (`Order`)**:
   - `GET /api/orders/`: Mengambil saldo piutang presisi per invoice pelanggan (`total_harga` minus `dp_dibayar`), terhitung dari data riil tanpa mengarang saldo.
2. **Source of Truth Hutang (`Purchase`/`StockIn`)**:
   - `GET /api/stock-in-documents/`: Mengambil saldo hutang ke supplier dari dokumen pembelian riil.
3. **Verifikasi Build**:
   - `npm run build` lulus 100% (2.23s).

---

## Acceptance Criteria

- [x] `DaftarPiutang.jsx` terhubung ke `/api/orders/`.
- [x] `SemuaHutang.jsx` terhubung ke `/api/stock-in-documents/`.
- [x] Perhitungan sisa piutang/hutang berbasis Decimal presisi (M1).
- [x] Build produksi frontend lulus 100%.
