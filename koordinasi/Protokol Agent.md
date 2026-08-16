---
tags: [koordinasi, protokol]
created: 2026-07-27
---

# Protokol Kerja Agent

Aturan wajib untuk setiap agent (Claude Code, Antigravity, Cursor, dll.) yang mengerjakan project ini. Tujuan: banyak agent bisa kerja paralel **tanpa salah arah, tanpa duplikasi, tanpa saling tabrak**.

## 1. Sebelum mulai kerja

1. Buka [[Agent Board]] — pilih task berstatus `backlog` yang tidak diblokir dependency.
2. **Klaim task**: buat/buka note task di `koordinasi/tugas/` (pakai [[Template Task]]), isi `agent:` dengan nama kamu dan ubah `status: in_progress`. Update baris di [[Agent Board]].
3. **Jangan pernah** mengerjakan task berstatus `in_progress` milik agent lain.
4. Baca konteks dulu, **graph dulu — bukan grep source code**:
   - `graphify query "<pertanyaan>"` untuk area yang disentuh
   - `graphify path "<A>" "<B>"` untuk relasi antar modul
   - [[Project Overview]] untuk peta besar
   - **Kalau task-nya perlu deploy ke VPS**: baca [[Deploy VPS]] dulu — ada jebakan nyata (IP lama, arsitektur Docker Compose vs asumsi systemd, migration uncommitted, SQLite vs Postgres) yang sudah ketemu dan didokumentasikan di sana.

## 2. Saat kerja

- **Patuhi [[Aturan Engineering]]** — aturan teknis ber-ID (U/B/F/M/API/DB/T/R/L/X); reviewer menolak task dengan menyebut ID yang dilanggar. Larangan keras L1–L10 tidak bisa dinego.
- **Scope terkunci** pada task yang diklaim. Nemu masalah lain? Tulis sebagai task baru di backlog epik terkait — jangan dikerjakan sekalian.
- Patuhi `bintang-advertising-backend/AGENTS.md` (berlaku juga untuk frontend):
  - **No god files** — hard limit 1000 baris (Python maupun JSX, diperbarui 2026-08-01 dari 400/300). Sentuh file oversized = extract, bukan extend.
  - **No implementasi duplikat/paralel** — cek model & endpoint yang sudah ada sebelum bikin baru. Ingat 4 pasang modul mirip-tapi-beda di [[Project Overview]] §3.
  - **Authorization server-side** untuk setiap endpoint baru/berubah.
- Hati-hati menyentuh god nodes ([[Project Overview]] §4): `apiClient`, `Order`, `Contact`, `CustomUser`, `IsOwnerOrManager`, `Product`, `JobBoard` — perubahan di sini menyebar luas.
- Kontrak API: **drf-spectacular schema adalah sumber kebenaran** — jangan mengarang field/endpoint.

## 3. Selesai kerja (definition of done)

1. Isi bagian **Hasil** di note task: file yang diubah, endpoint baru/berubah (method + path), migration baru (nomor), keputusan penting.
2. Ubah `status:` → **`review`**. Executor **tidak pernah** menandai task sendiri jadi `done` — itu keputusan manager setelah verifikasi independen (baca kode, jalankan test ulang), bukan sekadar percaya laporan Hasil. (Insiden 2026-07-27: T-103 sempat ditandai `done` sendiri, dikembalikan manager karena ada pelanggaran desain yang lolos dari laporan awal.)
3. Update baris task di [[Agent Board]].
4. Jalankan `graphify update .` supaya graph tetap sinkron dengan kode.
5. Tambahkan 1 baris ringkasan di daily note (`YYYY-MM-DD.md`).

## 4. Kalau nemu blocker / dependency

- Ubah `status: blocked`, tulis alasannya di note task, dan tandai di [[Agent Board]].
- Dependency antar task ditulis di frontmatter `depends_on:` — task ber-dependency belum boleh diklaim sebelum dependency-nya `done`.

## 5. Format status

`backlog` → `in_progress` → `review` → `done` (atau `blocked` kapan saja)
