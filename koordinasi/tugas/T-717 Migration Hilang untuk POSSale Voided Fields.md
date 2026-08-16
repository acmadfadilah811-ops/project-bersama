---
id: T-717
epik: "[[Bug QA Manual]]"
status: review
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-08-09
---

# T-717 — Migration hilang untuk `POSSale.voided_at`/`voided_by`

## Scope

Ditemukan manager (Claude) 2026-08-09 secara tidak sengaja saat verifikasi deploy VPS untuk T-716 (bukan bagian dari task itu, dicatat terpisah sesuai protokol scope terkunci).

`api/pos_models.py` (baik di checkout lokal maupun VPS `/opt/bintang/backend`) sudah punya field baru di model `POSSale`:

```python
voided_at = models.DateTimeField(null=True, blank=True, db_index=True)
```

...dan kemungkinan `voided_by` juga (lihat hasil `makemigrations --check --dry-run` di bawah). Field ini terkait pekerjaan WIP (belum di-commit) yang juga menyentuh `api/pos_views.py`, `api/pos_services.py`, `accounting/tests_pos_void.py` — sepertinya lanjutan/revisi alur void POS (T-104 sudah `done` sebelumnya, ini tambahan baru).

**Masalah**: field model ini **tidak punya migration**. Dikonfirmasi di VPS:

```
$ docker compose run --rm backend python manage.py makemigrations --check --dry-run
Migrations for 'api':
  api/migrations/0104_possale_voided_at_possale_voided_by.py
    - Add field voided_at to possale
    - Add field voided_by to possale
```

Akibatnya: di VPS production, kolom `voided_at`/`voided_by` **tidak ada di database** (Postgres) padahal model Python sudah mengharapkannya. Setiap `POSSale.objects.create(...)` yang lewat ORM (termasuk seluruh test yang menyentuh `POSSale`) crash: `django.db.utils.OperationalError`/`psycopg2.errors.UndefinedColumn: column "voided_at" of relation "api_possale" does not exist`. Kalau kode WIP yang menulis/membaca field ini sudah aktif di endpoint manapun, itu akan crash live di production sekarang juga.

## Konteks graph

Tidak dipakai `graphify query` khusus untuk ini — ditemukan langsung lewat `manage.py makemigrations --check --dry-run` di VPS saat verifikasi task lain (T-716).

## Acceptance criteria

- [ ] Migration `0104_possale_voided_at_possale_voided_by` (atau nomor lain sesuai urutan terkini) dibuat lewat `makemigrations` dan direview isinya (pastikan tidak ada operasi destruktif tak terduga)
- [ ] Migration diterapkan ke local `db.sqlite3` DAN VPS Postgres
- [ ] Test yang menyentuh `POSSale` (termasuk `api/tests_spk_pos.py`, `accounting/tests_pos_void.py`, dan lainnya) lulus lagi di kedua environment
- [ ] Cek apakah field `voided_by` benar-benar dipakai (FK ke user?) — kalau ya pastikan `on_delete` masuk akal
- [ ] `graphify update .` sudah dijalankan

## Hasil

- **File diubah**: tidak ada perubahan kode — migration `0098_possale_void_audit_fields.py` sudah ada di checkout lokal (dibuat agent lain, tidak pernah di-commit), tinggal disalin. File `0104_merge_20260808_1115.py` (merge migration, no-op) juga disalin karena VPS sekarang punya 2 head (`0098` dan `0103`) yang perlu direkonsiliasi.
- **Migration**: `api.0098_possale_void_audit_fields` (tambah `voided_at`, `voided_by` ke `POSSale`) + `api.0104_merge_20260808_1115` (merge, no operasi) — diterapkan ke VPS Postgres (`bintang-db`) via `docker compose up -d backend` (backend-init menjalankan `migrate --noinput` otomatis sebagai dependency). Lokal sudah lama punya file ini di disk (makanya `makemigrations --check` lokal selalu "No changes detected"), tapi **belum pernah di-commit ke git** — itu sebab VPS (yang deploy lewat `git pull`) tidak pernah dapat migration ini.
- **Keputusan penting / catatan untuk agent lain**:
  - Verifikasi dilakukan lewat `psql \d api_possale` langsung di VPS — kolom `voided_at`, `voided_by_id` + index + FK constraint dikonfirmasi ada. `makemigrations --check --dry-run` di VPS sekarang "No changes detected", `showmigrations api` menunjukkan `0098` dan `0104` keduanya `[X]`.
  - **Migration file 0098/0104 masih uncommitted di git** (lokal maupun sekarang juga di VPS, karena disalin manual, bukan lewat git pull) — kalau agent lain nanti melakukan `git pull` di VPS tanpa commit dulu, migration ini bisa ketiban/hilang tertimpa. Perlu commit migration ini ke `main` di titik yang aman (bareng pekerjaan void POS yang masih WIP), bukan wewenang saya untuk commit sekarang karena banyak file lain punya agent lain yang juga uncommitted di working tree yang sama.
  - **Temuan sampingan lain (bukan bug, tidak ditindaklanjuti)**: jalankan `manage.py test` langsung di dalam container VPS menghasilkan banyak `301` alih-alih status code yang diharapkan — itu karena `SECURE_SSL_REDIRECT = True` di `core/settings.py` (setting production yang benar) memaksa redirect HTTPS, dan Django test client secara default tidak mengirim `X-Forwarded-Proto`. Bukan bug functional; verifikasi migration/logic yang sebenarnya sudah cukup lewat cek skema Postgres langsung + 400/400 test lokal (yang tidak kena setting ini).
  - Script deploy (`deploy_vps.py`, `check_vps_full.py`, `scripts/_find_vps.py`, `scripts/_vps_pull_backend.py`) diperbaiki di sesi yang sama: IP/port/password diupdate ke VPS aktif (`38.253.224.44:44156`), dan `deploy_vps.py`/`_vps_pull_backend.py` logic-nya diganti dari asumsi systemd+git-pull-langsung (VPS lama) ke Docker Compose (`/opt/bintang/deploy`, build context `/opt/bintang/backend` & `/opt/bintang/frontend`) sesuai arsitektur VPS yang sebenarnya.
