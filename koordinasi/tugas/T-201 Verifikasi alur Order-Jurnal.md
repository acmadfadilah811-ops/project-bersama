---
id: T-201
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Claude (manager)
prioritas: tinggi
depends_on: []
created: 2026-07-27
---

# T-201 — Verifikasi alur pembayaran Order → Buku Besar

## Scope

Graph mengklaim `OrderViewSet` *"mencatat pembayaran (DP/Pelunasan) secara otomatis ke Buku Besar (Double-Entry)"* — tapi user bilang integrasi belum ada. Task ini menyelesaikan kontradiksi itu. Read-only.

Pertanyaan yang harus terjawab:

1. Endpoint pembayaran order mana saja yang ada (`/orders/:id/bayar/`, lainnya?) dan mana yang benar-benar menulis `JournalEntry`?
2. Kalau jurnal tertulis: akun apa yang dipakai, dari mana mappingnya, apakah benar secara akuntansi?
3. Piutang di `DaftarPiutang.jsx` — datanya dari jurnal atau dihitung terpisah dari Order? (dua sumber kebenaran = bahaya)
4. DP sebagian, diskon, kupon — ikut tercatat atau bocor?
5. Idempotency key pembayaran — melindungi jurnal juga atau cuma pembayaran?
6. HPP: `production_costing.py` + konsumsi FIFO — nyambung ke jurnal HPP atau berhenti di laporan?

## Cara kerja

```powershell
graphify path "Order" "JournalEntry"
graphify path "Order" "DaftarPiutang"
graphify explain "pembayaran order buku besar"
graphify query "bagaimana HPP order dihitung dan dicatat"
```
Baru baca file yang ditunjuk graph.

## Acceptance criteria

- [ ] Keenam pertanyaan terjawab dengan bukti (file:baris atau output graph)
- [ ] Tabel "alur uang order: tercatat / tidak tercatat" di bagian Hasil
- [ ] Rekomendasi revisi scope T-202–T-204
- [ ] Bagian "Kondisi awal" di [[Integrasi Akuntansi-Orders]] diupdate dari ✳️ menjadi ✅/❌

## Hasil

*Dikerjakan Claude (manager), 2026-07-27. Metode: `graphify path/explain` → baca file yang ditunjuk → grep tertarget. Read-only, tidak ada kode diubah.*

### Jawaban 6 pertanyaan

**1. Endpoint mana yang benar-benar menulis JournalEntry? — ❌ TIDAK ADA.**
`POST /orders/:id/bayar/` (`api/views/orders.py:522-567`) dan DP awal di `perform_create` (baris 243) **keduanya** memanggil `record_payment_to_general_ledger()` (baris 35-77) — yang menulis **eksklusif ke ledger legacy** `hr.Akun`/`hr.TransaksiBukuBesar` (`from hr.models import Akun, TransaksiBukuBesar`, baris 27). Nol referensi `accounting.JournalEntry` atau `create_journal_entry()` di file ini. Graph mengonfirmasi: satu-satunya jalur Order→JournalEntry adalah lewat `services/settlement.py` (settlement non-tunai, tidak terkait pembayaran DP/pelunasan langsung).

**2. Akun yang dipakai — ada di sistem yang salah.**
Hardcode via `get_or_create`: debit `1-1000`/`1-1001`/`1-1002` (Kas Tunai/Bank Transfer/QRIS) di `hr.Akun`, kredit `4-1000` (Pendapatan Jasa Cetak). Strukturnya benar secara akuntansi (debit aset, kredit pendapatan) — tapi di **ledger legacy**, bukan `accounting.Account` (COA baru yang sudah dibangun modul akuntansi). Sama seperti pola yang sudah ditemukan T-101.

**3. `DaftarPiutang.jsx` — ❌ TEMUAN BESAR: bukan dua sumber kebenaran, tapi BELUM ada sumber data sama sekali.**
File 501 baris, nol `apiClient`/`axios`/`fetch` call. Baris 49 secara eksplisit: `// Static mock data matching Screenshot 1`. Ini murni **mockup UI dengan data hardcoded**, sama sekali belum terhubung ke backend. Bukan risiko konflik data — risiko sebenarnya adalah orang mengira fitur ini sudah jalan padahal belum.

**4. Diskon/kupon — tidak bocor, tapi juga tidak tercatat granular.**
`record_payment_to_general_ledger()` hanya menerima `jumlah_bayar` mentah (nominal aktual yang dibayar, sudah bersih dari diskon/kupon karena itu sudah dihitung ke `total_harga`/`sisa_tagihan` sebelumnya via `update_totals()`). Jadi nominalnya benar, tapi tidak ada baris jurnal terpisah untuk "Diskon Penjualan" — diskon cuma implisit mengecilkan pendapatan yang tercatat, tidak muncul sebagai pos akuntansi sendiri.

**5. Idempotency — ✅ melindungi jurnal juga.**
Cek `idempotency_key` (baris 526-528) terjadi **sebelum** `record_payment_to_general_ledger()` dipanggil (baris 547) — request dobel dengan key sama akan return early, jurnal (dan payment) tidak tercatat dua kali. Aman.

**6. HPP — ❌ berhenti di laporan, tidak pernah nyambung ke jurnal (legacy maupun baru).**
`production_costing.py` (`biaya_per_unit()`, alokasi biaya produksi) degree 4 di graph — nol koneksi ke `JournalEntry` atau akun mana pun. Murni fungsi kalkulasi untuk laporan HPP, bukan posting.

### Tabel: alur uang Order vs pencatatan (kondisi sekarang)

| Alur uang | Ledger baru (`accounting.JournalEntry`) | Ledger legacy (`hr`) | UI terkait |
|---|---|---|---|
| DP awal saat order dibuat | ❌ | ✅ (D Kas/Bank, K Pendapatan) | — |
| Pelunasan/cicilan (`bayar`) | ❌ | ✅ | — |
| Order jadi `selesai` (via T-210) | ❌ (tidak ada posting sama sekali) | ❌ | — |
| Piutang (belum lunas) | ❌ | ❌ (dihitung dari `sisa_tagihan`, tidak dijurnal) | `DaftarPiutang.jsx` **mock, tidak nyambung ke API sama sekali** |
| HPP produksi | ❌ | ❌ | Laporan saja |

### ⚠️ Temuan yang mengubah rencana: T-207 belum bisa jalan tanpa T-202 dulu

**Sama persis pola yang ditemukan untuk POS sebelum T-102/T-103**: Order membayar ke ledger LEGACY, bukan ke `accounting.JournalEntry`. Order jadi `selesai` (via endpoint T-210 yang baru) juga **tidak memicu posting apa pun** — cuma ubah status.

Konsekuensi untuk **T-207 (jurnal pembalik Dibatalkan & Pengembalian)**: tidak ada jurnal ASLI di ledger baru untuk dibalik. Membangun "jurnal pembalik" sekarang berarti membalik... tidak ada apa-apa (atau terpaksa membalik ledger legacy, yang bertentangan dengan M3 — legacy dibekukan, bukan diperpanjang).

**Rekomendasi**: kerjakan **T-202 (pelunasan piutang Order → jurnal, mirip pola T-102/T-103 untuk POS) DULU**, baru T-207 jadi masuk akal (membalik jurnal yang benar-benar ada). T-207 saya update dependency-nya.

## Update epik

Bagian "Kondisi awal" di [[Integrasi Akuntansi-Orders]] diupdate dari ✳️ (belum diverifikasi) menjadi ✅/❌ sesuai temuan di atas.
