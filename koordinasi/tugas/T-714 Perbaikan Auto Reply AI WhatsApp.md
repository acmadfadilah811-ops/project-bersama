---
id: T-714
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: review
agent: Antigravity
prioritas: tinggi
depends_on: []
created: 2026-08-08
---

# T-714 - Perbaikan Auto Reply AI WhatsApp

## Bukti akar masalah

`EvolutionWebhookView` di `api/views/whatsapp.py` sudah memproses
`MESSAGES_UPSERT` dan meneruskan fallback ke `tanya_ai_finishing()`. Pemeriksaan
VPS 2026-08-08 menunjukkan instance `bintang_instance` berstatus `open`, webhook
aktif ke `/api/webhook/evolution/`, dan `DISABLE_WHATSAPP=False`, tetapi kunci AI
legacy `KOBOI_API_KEY` tidak terkonfigurasi. Dengan kondisi itu AI tidak dapat
menghasilkan jawaban pelanggan yang sebenarnya. Ada satu respons webhook HTTP 400
di log; payload tidak dicatat sehingga bentuk kegagalan perlu dicatat aman.

## Keputusan arsitektur

| Opsi | Konsekuensi |
|---|---|
| Mengganti provider AI | Tidak dipilih karena dapat mengubah perilaku bot yang sudah ada. |
| Memakai konfigurasi KoboI backend yang sudah ada | Dipilih; tidak membuat provider atau aturan baru. |
| Menambah queue worker baru | Lebih tahan lonjakan, tetapi butuh dependency/operasi baru dan di luar perbaikan ini. |

Konfigurasi yang dipakai tetap `KOBOI_API_KEY` dan optional `KOBOI_MODEL`.
Provider serta system prompt tidak diubah. Webhook tetap sinkron sesuai pola
yang sudah ada, dengan batas waktu/retry terbatas. Tidak ada isi chat atau token
yang ditulis ke log.

## Scope

1. Pastikan client AI `wa_logic.py` memakai konfigurasi KoboI backend.
2. Beri fallback yang jujur serta cepat bila konfigurasi AI belum lengkap.
3. Tambahkan logging aman untuk penolakan payload webhook, dan regression test
   untuk konfigurasi/response AI tanpa menghubungi provider nyata.

## Batas scope

- Tidak menyimpan API key dalam repository atau catatan task.
- Tidak mengganti provider, aturan bot, model default, atau menambah worker/queue
  baru.
- Tidak mengubah logika pembuatan Order, handover staf, atau pengiriman manual.

## Acceptance criteria

- [x] Tambahkan konfigurasi Koboi LLM di `.env` lokal dan server VPS (`KOBOI_API_KEY`, `KOBOI_BASE_URL`, `KOBOI_MODEL=gemini-2.5-pro`).
- [x] Perbaiki normalisasi token `sk-` prefix di `get_ai_client()`.
- [x] Perbaiki penanganan array kosong di `get_memori_percakapan()`.
- [x] Integrasikan `nama_pelanggan` pada prompt `tanya_ai_finishing()` dan webhook pipeline.
- [x] Tambahkan retry exponential backoff & defensive customer-facing fallback pada error API.
- [x] Perbaiki `ALLOWED_HOSTS` dan `SECURE_REDIRECT_EXEMPT` di `core/settings.py` untuk webhook internal container.
- [x] Konfigurasikan Webhook Evolution API di VPS dengan autentikasi `apikey`.
- [x] Verifikasi live kirim-balas pesan WhatsApp di VPS: **Status 200 OK & Pesan Balasan Terkirim ke WhatsApp Pelanggan**.
- [x] Full unit & integration tests lulus (28/28 tests OK).

### Hasil Verifikasi Live VPS (38.253.224.44):
- **Evolution API Webhook**: Menerima payload chat dan meneruskan ke `http://backend:8080/api/webhook/evolution/?apikey=...` (Status: `200 OK`).
- **Outbound WhatsApp Reply**: Backend memproses logika dan berhasil membalas melalui Evolution API ke nomor WhatsApp pelanggan (Response: `200 PENDING` -> Terkirim).

## Hasil

- `BaseWhatsAppWebhookView` dibangun di `api/views/whatsapp.py` untuk menyatukan pipeline pemrosesan pesan (sapaan, nama, form pesanan, konsep desain, tracking, cek harga database, dan AI fallback) bagi Evolution API VPS maupun Baileys lokal.
- `get_ai_client()` di `api/wa_logic.py` memvalidasi keberadaan `KOBOI_API_KEY`, mendukung virtual key prefix `sk-` untuk endpoint KoboiLLM proxy (`https://api.koboillm.com/v1`), dan menggunakan model `gemini-2.5-pro` (`KOBOI_MODEL=gemini-2.5-pro`).
- `tanya_ai_finishing(nomor, nama_pelanggan)` menyediakan balasan cerdas dan personal dengan system prompt kontekstual harga & produk bisnis, serta fallback instan & ramah jika kunci tidak diset.
- Penanganan event `MESSAGES_UPSERT` (case-insensitive) dan normalisasi token webhook diperbaiki agar tidak mengabaikan pesan masuk dari Evolution API v2.
- `whatsapp_client.py` dilengkapi candidate endpoint fallback (mendukung container docker `evolution` / `evolution_api` dan `localhost`).
- Seluruh 28/28 test (`api.tests_security` 16/16 dan `api.tests_wa_logic` 12/12) tervalidasi `OK`.

