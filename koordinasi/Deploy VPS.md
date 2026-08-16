---
tags: [koordinasi, deploy, vps]
created: 2026-08-09
---

# 🚀 Deploy ke VPS — Panduan Wajib Baca Sebelum Deploy

> Ditulis Claude (manager) 2026-08-09 setelah sesi deploy T-716/T-717/T-718 dan perbaikan bug POS/resi — banyak asumsi lama soal VPS ternyata salah (IP, arsitektur, cara deploy). Baca ini SEBELUM pakai script `deploy_vps.py` dkk. atau nge-SSH manual, supaya tidak mengulang kesalahan yang sama.

## 1. Koneksi

```
ssh root@38.253.224.44 -p 44156
```
- User: `root`
- Password: tanya user/manager langsung (jangan diketik ulang di sini, tapi SUDAH ada plaintext di `deploy_vps.py`, `check_vps_full.py`, `scripts/_find_vps.py`, `scripts/_vps_pull_backend.py` — pakai itu sebagai referensi kalau sudah execute-access ke repo).

⚠️ **Jangan pakai IP/port di catatan lama** (`38.253.224.40:40186`) — itu VPS SEBELUMNYA yang sudah tidak dipakai. Kalau nemu file/catatan yang masih nyebut `.40`, itu stale, jangan dipercaya begitu saja.

## 2. Arsitektur — Docker Compose, BUKAN systemd

VPS ini menjalankan semuanya lewat Docker Compose, didefinisikan di `/opt/bintang/deploy/docker-compose.yml`. **Bukan** `git pull` + restart service systemd seperti yang diasumsikan beberapa script lama (itu pola VPS sebelumnya).

| Path di VPS | Isi |
|---|---|
| `/opt/bintang/backend` | Checkout git backend — **build context** image `backend`, bukan bind-mount live |
| `/opt/bintang/frontend` | Checkout git frontend — build context image `frontend` |
| `/opt/bintang/deploy/docker-compose.yml` | Definisi semua service |
| `/opt/bintang/deploy/.env`, `evolution.env` | Env vars (password DB dll, jangan disalin ke git) |
| `/opt/bintang/deploy/nginx.conf.template` | Config nginx frontend (proxy `/api/`, `/admin/`, serve `/static/` `/media/`) |
| `/opt/bintang/deploy/backups/` | Backup pg_dump manual |

Container: `deploy-backend-1`, `deploy-frontend-1`, `deploy-bintang-db-1` (Postgres, DB `bintang`/user `bintang`), `deploy-bintang-redis-1`, `deploy-evolution-api-1`, `deploy-evolution-db-1`, `deploy-evolution-redis-1`, `deploy-cloudflared-1` (Cloudflare Quick Tunnel — URL publik berubah tiap restart, bukan domain tetap).

**Konsekuensi penting**: karena backend/frontend adalah build context (bukan bind-mount), source code yang diedit di host `/opt/bintang/backend/...` TIDAK otomatis kepakai container yang sedang jalan. Wajib `docker compose build <service>` dulu baru `docker compose up -d <service>`.

## 3. Cara deploy yang benar

### Kalau kerjaan sudah di-commit & di-push ke `main`

```bash
cd /opt/bintang/backend && git pull --ff-only origin main
cd /opt/bintang/frontend && git pull --ff-only origin main
cd /opt/bintang/deploy
docker compose build backend frontend
docker compose up -d backend frontend
```
`docker compose up -d backend` otomatis men-trigger service `backend-init` (jalankan `migrate` + `collectstatic`) sebagai dependency SEBELUM `backend` start — tidak perlu jalankan manual terpisah, asal image-nya baru di-build.

### Kalau kerjaan MASIH uncommitted (kondisi umum di project ini — banyak agent kerja langsung di working tree tanpa commit dulu)

**Jangan `git pull`** — checkout VPS juga punya banyak file uncommitted dari agent lain (working tree VPS itu mirror kondisi lokal, dua working tree independen tapi sama-sama "kotor"). `git pull` berisiko konflik atau menimpa kerjaan yang belum ter-commit di VPS.

Solusi: SFTP/scp file yang diubah langsung ke path yang sama di `/opt/bintang/backend/...` atau `/opt/bintang/frontend/...` (backup dulu dengan `cp file file.bak_<namatask>` sebelum overwrite), baru `docker compose build <service>` + `up -d <service>`.

### Verifikasi wajib setelah deploy

```bash
docker compose -f /opt/bintang/deploy/docker-compose.yml ps
curl -ksS -o /dev/null -w "%{http_code}\n" http://127.0.0.1/api/health/          # lewat nginx, harus 200
docker exec deploy-backend-1 curl -ksS -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-Proto: https" http://127.0.0.1:8080/api/health/   # langsung ke backend
```
Kalau baru rebuild dan sempat lihat `502`/`000` di curl pertama, tunggu beberapa detik lagi (`sleep 5-8`) sebelum simpulkan gagal — container butuh waktu singkat sampai health check compose bilang `healthy`.

## 4. Jebakan yang sudah ketemu (baca supaya tidak terulang)

1. **Migration bisa ada di disk tapi belum ter-commit ke git** — `manage.py makemigrations --check --dry-run` bisa bilang "No changes detected" secara lokal padahal migration file-nya `?? ` (untracked) di `git status`. Kalau VPS deploy lewat `git pull`, migration begini TIDAK PERNAH sampai ke VPS meski kelihatan "sudah ada" di lokal. Selalu cek `git status` migration folder sebelum asumsi VPS punya migration yang sama.
2. **SQLite (test lokal) tidak menegakkan aturan yang Postgres (VPS) tegakkan** — contoh nyata: `select_for_update()` digabung `select_related()` ke FK yang `null=True` bikin Postgres error `FOR UPDATE cannot be applied to the nullable side of an outer join`. Test lokal (SQLite) lolos mulus, POS di VPS crash 500 di SETIAP request. Kalau nambah/ubah `select_for_update()`, cek dulu apakah field yang di-`select_related()` bareng itu nullable — kalau ya, pakai `select_for_update(of=('self',))`.
3. **`docker compose run --rm <service> <command>` juga men-trigger dependency dan bisa DIAM-DIAM migrate DB nyata** (karena `backend-init` adalah dependency `backend`, dan compose menjalankan seluruh dependency chain termasuk saat cuma mau `run` satu service). Jangan kaget kalau migration keterapkan cuma dari coba `docker compose run --rm backend python manage.py showmigrations`.
4. **`manage.py test` langsung di dalam container produksi bisa gagal karena `SECURE_SSL_REDIRECT=True`** (setting yang BENAR untuk production) — request test client HTTP polos di-redirect 301, banyak test gagal "301 != 200" dll. Itu bukan bug kode; kalau perlu verifikasi test di VPS, jalankan dengan header `X-Forwarded-Proto: https` atau percaya hasil test lokal (SQLite, DEBUG=True) untuk soal LOGIC — pakai VPS cuma untuk verifikasi SCHEMA/migration/deploy state via `psql`/`curl` langsung, bukan test runner.
5. **Field FK yang namanya beda dari yang diasumsikan** — pernah ada bug `staff.no_wa` padahal field aslinya `no_hp` di model `CustomUser`. Kalau nambah kode yang akses field user/model lain, cek definisi model-nya dulu, jangan asumsi nama field dari konteks/kebiasaan proyek lain.

## 5. Script helper yang tersedia (root repo & `bintang-advertising-backend/scripts/`)

Semua sudah diperbaiki 2026-08-09 (IP, port, password, dan logic Docker Compose):
- `deploy_vps.py` — deploy penuh (git pull backend+frontend, backup DB, build+up backend & frontend, health check). Prasyarat: kerjaan sudah di-commit & push ke `main` (lihat §3).
- `check_vps_full.py` — diagnostik sistem (CPU/RAM/disk/docker/firewall/log error), read-only.
- `scripts/_find_vps.py` — cari file `manage.py` di VPS (generic diagnostik).
- `scripts/_vps_pull_backend.py` — git pull + jalankan skrip sync tertentu di dalam container + rebuild/restart backend.

Semua masih pakai password plaintext di source — ikuti pola yang sudah ada, jangan expose ke tempat lain di luar repo ini.
