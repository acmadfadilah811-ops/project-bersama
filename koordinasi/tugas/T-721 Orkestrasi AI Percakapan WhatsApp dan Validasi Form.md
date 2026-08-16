---
id: T-721
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Codex
prioritas: tinggi
depends_on: []
created: 2026-08-10
---

# T-721 — AI Respons Awal WhatsApp pada Alur Lama

## Scope

Memakai kembali alur Evolution lama dan daftar harga `ProductPrice`. AI hanya
menjawab pesan pertama dalam sesi satu jam; sesudahnya seluruh rule, katalog,
form, tracking, handover, dan pembuatan draft memakai implementasi lama.

## Bukti akar masalah

- `api/views/whatsapp.py:862-1049` menjalankan rule/form/katalog lama sebelum
  AI fallback. Pengguna meminta alur ini tetap dipakai, dengan AI pada respons
  paling awal.
- `api/wa_logic.py:119-183` membangun konteks AI dari `ProductPrice`; ini kini
  kembali menjadi sumber daftar harga yang dipakai bot.

## Keputusan arsitektur (disetujui arahannya oleh manager 2026-08-10)

| Opsi | Konsekuensi |
|---|---|
| Router AI penuh | Mengubah terlalu banyak perilaku bot lama. Dibatalkan atas arahan manager. |
| Alur lama murni | Stabil, namun respons pertama kembali statis. Tidak dipilih. |
| AI sekali pada respons awal, lalu alur lama | Perubahan paling kecil dan mempertahankan daftar harga lama. Dipilih. |

AI tidak mendapat akses untuk menulis order. Bila AI awal gagal, alur lama tetap
menangani pesan sehingga bot tidak berhenti.

## Batas scope

- Tidak mengubah kontrak `Order`, pembayaran, harga transaksi, atau jurnal.
- Tidak mengirim notifikasi atau pesan UAT ke pelanggan nyata tanpa pesan masuk nyata.
- Tidak menyimpan API key, isi chat mentah, atau token webhook di source/log/task.

## Acceptance criteria

- [x] Respons pertama Evolution memakai AI dengan konteks `ProductPrice` lama.
- [x] Pesan berikutnya memakai rule, daftar harga, form, tracking, dan handover lama.
- [x] Model runtime VPS `openai/gpt-oss-120b`, backend sehat, dan deployment tidak menampilkan rahasia.
- [x] Regression test alur WA lama lulus.

## Hasil

- **File diubah**: `api/views/evolution_ai.py` (24 baris) dan satu import di
  `api/views/__init__.py`. Router AI, validasi form, dan katalog baru dihapus.
- **Endpoint berubah**: tidak ada perubahan kontrak `POST /api/webhook/evolution/`.
- **Migration**: tidak ada.
- **Validasi**: `manage.py test api.tests_wa_logic` lulus 12/12 dan
  `manage.py check` lulus. Backend VPS dibangun ulang, health endpoint `ok`,
  dan probe respons AI awal non-kosong.
- **Deploy VPS**: backup terakhir
  `/opt/bintang/deploy/backups/20260810-091641-wa-ai-router`.
- **Graphify**: `graphify update .` telah dijalankan tetapi fail-closed dan
  mempertahankan graph lama karena sandbox menolak folder dependency lokal;
  tidak memakai `--force` agar graph lengkap tidak tertimpa graph 7.023 node.
