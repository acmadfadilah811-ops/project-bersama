---
id: T-703
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: blocked
agent: Antigravity
prioritas: tinggi
depends_on: [T-701]
created: 2026-07-28
---

# T-703 — Database, Migration, Backup, dan Restore Drill

*Implementasi oleh Antigravity. Status `review` = menunggu approval manager.*

---

## Scope & Implementation

Verifikasi staging PostgreSQL database, single leaf migration graph, rehearsal migrasi, skrip backup otomatis terjadwal, dan restore drill teruji.

1. **Safety Guarantee**:
   - Skrip backup dan restore **SAMA SEKALI TIDAK MENYENTUH** database `db.sqlite3` milik user/pengembang lokal.
2. **Single Leaf Migration Graph**:
   - Executed `python manage.py showmigrations`: 100% single leaf migration pada setiap Django app (`accounting`: 21, `api`: 88, `hr`: 6, `users`: 4). Zero migration conflicts.
3. **Automated PostgreSQL Backup Script (`scripts/backup_database.py`)**:
   - Menghasilkan file kompresi `.sql.gz` berstempel waktu (`bintang_crm_backup_YYYYMMDD_HHMMSS.sql.gz`).
   - Kebijakan retensi otomatis: Menghapus file backup lama yang berusia > 7 hari (`cleanup_old_backups(days=7)`).
   - Target RPO (Recovery Point Objective): < 24 jam (cron harian pukul 02:00 AM).
4. **Restore Drill & Migration Rehearsal (`scripts/restore_database.py`)**:
   - Memverifikasi integritas file backup dan merekonstruksi struktur basis data ke database staging/drill.
   - Menguji kelancaran rehearsal migrasi Django (`manage.py showmigrations`).
   - Target RTO (Recovery Time Objective): < 15 menit (< 900 detik).

---

## Acceptance Criteria

- [x] Database `db.sqlite3` pengembang 100% aman dan tidak tersentuh.
- [x] Migration graph terverifikasi 100% single leaf (21 accounting, 88 api, 6 hr, 4 users).
- [x] Skrip `scripts/backup_database.py` dibuat dengan retensi 7 hari & target RPO < 24 jam.
- [x] Skrip `scripts/restore_database.py` dibuat dengan guard gagal-tertutup dan target RTO < 15 menit.
- [ ] Pengujian restore PostgreSQL nyata dan pengukuran RTO belum tersedia di environment ini.

## Manager review 2026-07-28

Audit menemukan pipeline `shell=True` dan fallback migration rehearsal yang mengklaim restore berhasil walau `pg_dump/psql` gagal. Kedua skrip kini memakai argv tanpa shell, gzip Python, menolak SQLite, dan mengembalikan gagal bila CLI/backup tidak tersedia. Drill PostgreSQL staging tetap wajib sebelum T-703 dapat `done`.

## Review Wave 2 — Verifikasi independen (2026-07-28)

Kode dibaca penuh langsung (bukan laporan): `scripts/backup_database.py` (86 baris) dan `scripts/restore_database.py` (87 baris).

- **Tidak ada `shell=True`/`os.system`/pipeline string** di kedua skrip — `subprocess.Popen`/`subprocess.run` semua pakai list argv. **PASS**.
- **Gzip native Python** (`gzip.GzipFile`/`gzip.open`), bukan pipe ke binary gzip lewat shell. **PASS**.
- **Guard SQLite**: kedua skrip cek `DB_ENGINE` di awal, tolak & keluar bersih kalau `sqlite`/`sqlite3` — `db.sqlite3` pengembang tidak pernah tersentuh baik oleh backup maupun restore. **PASS**.
- **Kegagalan jujur (bukan fake success)**: `pg_dump`/`psql` tidak ditemukan di PATH → `return False` + pesan error jelas (tidak ada fallback simulasi). Return code non-zero → `return False`, file backup parsial dihapus (`backup_file.unlink`). **PASS**.
- **Migration leaf**: dijalankan ulang independen sekarang — `python manage.py showmigrations` & `showmigrations accounting`: **accounting 21, api 88, hr 6, users 4, semua [X] applied, 0 conflict** — persis sesuai klaim. **PASS**.
- **PostgreSQL client tools**: dicek `where pg_dump`, `where psql`, `where postgres` di sandbox ini → **ketiganya tidak ditemukan**. Restore drill nyata secara struktural TIDAK MUNGKIN dijalankan dari sandbox/dev environment ini — ini keterbatasan infrastruktur, bukan cacat kode. Konsisten dengan status checkbox terakhir yang memang dibiarkan `[ ]` (jujur, tidak diklaim selesai).
- **Catatan desain minor (tidak memblokir)**: `run_migration_rehearsal()` di `restore_database.py:72-82` hanya menjalankan `showmigrations` (baca status), TIDAK menjalankan `migrate` sungguhan terhadap database hasil restore — jadi belum benar-benar membuktikan skema bisa "direkonstruksi & dipakai", cuma membuktikan tabel migration historynya utuh. Rekomendasi untuk drill nyata nanti: tambahkan `manage.py migrate --check` atau `migrate` idempotent terhadap DB restore sebagai langkah rehearsal yang lebih kuat.

**Verdict: kode SIAP, drill PostgreSQL nyata tetap BLOCKER eksternal.** Status → `blocked` (bukan `review`) — blocker-nya adalah kebutuhan akses VPS/staging dengan PostgreSQL + `pg_dump`/`psql` terpasang, yang tidak tersedia di lingkungan kerja saat ini. Ini keputusan infrastruktur/akses (siapa yang menyediakan staging VPS), bukan sesuatu yang bisa diselesaikan executor dengan menulis kode lagi — perlu keputusan/aksi user (M-01 acceptance criteria: "blocker yang belum boleh masuk production").
