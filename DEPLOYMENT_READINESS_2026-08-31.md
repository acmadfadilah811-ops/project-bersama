# Catatan Kesiapan Deployment Bintang

Tanggal audit: 31 Agustus 2026

Status: **BELUM SIAP DEPLOYMENT PRODUKSI**

Dokumen ini menjadi catatan kerja untuk perbaikan sebelum deployment dengan metode
`git pull` dari VPS. Jangan menjalankan deployment produksi sampai bagian "Release
Gate" seluruhnya lulus.

## 1. Snapshot Git Saat Audit

- Branch lokal: `main`
- Upstream: `origin/main`
- Commit lokal: `6bd5251f3f09a2b71d962824c9612a029ad8746f`
- Commit pendek: `6bd5251`
- Commit terakhir: `fix: samakan path volume static dengan STATIC_ROOT default Django (/app/static)`
- Tanggal commit: `2026-08-17T01:10:12+07:00`
- Selisih `main` dengan `origin/main`: `0 ahead`, `0 behind`
- Perubahan staged: tidak ada
- Perubahan tracked belum commit: 10 file
- File untracked: 42 file aktual, diringkas Git menjadi 21 entri

Kesimpulan penting: `origin/main` masih berhenti di commit `6bd5251`. Perbaikan
accounting, konfigurasi PostgreSQL-only, Docker lock, AI analyst, dashboard, dan
perubahan lain di working tree belum tersedia untuk VPS. Menjalankan `git pull` di
VPS sekarang tidak akan mengambil perubahan tersebut.

Jangan memakai `git add .` tanpa review. Working tree berisi beberapa kelompok kerja
yang berbeda, termasuk direktori besar `ai-agent-chatbot/`, `evolution-api/`, dan
`package-repo/`. Stage hanya file yang memang masuk release Bintang.

## 2. Perubahan Lokal Penting yang Belum Commit

Perubahan yang dibuat selama pemeriksaan ini:

- Setup awal accounting otomatis melengkapi mapping akun pembelian standar.
- Test regresi setup accounting ditambahkan.
- Dependency `mysqlclient` dihapus.
- Paket build MySQL dihapus dari backend Dockerfile.
- Backend dibatasi ke SQLite untuk development/test atau PostgreSQL untuk deployment.
- Default `DB_ENGINE` menjadi `postgres`.
- Docker backend memakai `uv.lock` secara frozen.
- Timeout dan retry download dependency Docker ditingkatkan.

File terkait:

- `bintang-advertising-backend/Dockerfile`
- `bintang-advertising-backend/pyproject.toml`
- `bintang-advertising-backend/uv.lock`
- `bintang-advertising-backend/core/settings.py`
- `bintang-advertising-backend/accounting/views/settings.py`
- `bintang-advertising-backend/accounting/tests_pos_settings.py`

Perubahan lain yang sudah ada di working tree harus direview terpisah sebelum commit:

- `bintang-advertising-backend/api/urls.py`
- `bintang-react-frontend/src/App.jsx`
- `bintang-react-frontend/src/features/dashboard/pages/ExecutiveDashboard.jsx`
- `deploy/docker-compose.yml`
- Seluruh file untracked yang ditampilkan oleh `git status`

## 3. Hasil Audit yang Lulus

- Docker Desktop dan integrasi WSL2 berfungsi.
- Backend image berhasil dibangun.
- Frontend image berhasil dibangun.
- Backup image berhasil dibangun.
- Backend image tidak memiliki driver MySQL.
- Backend image memiliki driver PostgreSQL.
- Backend image berjalan sebagai user non-root, UID `100`.
- Migration lengkap berhasil dijalankan pada PostgreSQL 16 kosong.
- Backend container terhubung ke PostgreSQL dan Redis.
- `/api/health/` mengembalikan HTTP `200` dengan database dan cache `ok`.
- Frontend container mengembalikan HTTP `200` untuk root dan deep route.
- Lima test setup accounting lulus.
- Frontend production build berhasil.
- Docker Compose valid secara struktur dengan `config --no-env-resolution`.

## 4. Blocker Deployment

### P0: Migration HR Hilang

`python manage.py makemigrations --check --dry-run` gagal dan meminta:

```text
hr/migrations/0007_alter_absensi_status.py
```

Model dan schema deployment belum sinkron. Buat migration, review isinya, lalu uji
migration pada PostgreSQL kosong dan salinan database staging.

### P0: Redirect Loop Cloudflare dan Nginx

Uji container membuktikan request yang masuk dengan `X-Forwarded-Proto: https`
tetap mendapat HTTP `301` ke URL HTTPS yang sama.

Penyebab:

- Cloudflare Tunnel menghubungi gateway melalui HTTP.
- `deploy/nginx.conf` menimpa `X-Forwarded-Proto` dengan `$scheme` yang bernilai `http`.
- Django mempercayai header tersebut dan menjalankan `SECURE_SSL_REDIRECT`.
- Health endpoint dikecualikan dari redirect, sehingga service tampak sehat walau API
  publik mengalami loop.

Perbaiki forwarding protocol dan tambahkan smoke test melalui gateway sebelum deploy.

### P0: Frontend Netlify Masih Memakai Placeholder

`bintang-react-frontend/public/_redirects` masih berisi:

```text
CHANGE_THIS_TO_CURRENT_TUNNEL_URL
```

API frontend produksi akan gagal. Ganti Quick Tunnel dengan named Cloudflare Tunnel
dan domain tetap. Jangan mengandalkan URL `trycloudflare.com` yang berubah saat
container restart.

### P0: Seluruh Test Belum Hijau

- Backend: 690 test dijalankan, 689 lulus, 1 gagal.
- Test gagal: `api.tests_order_filter.OrderFilterTest.test_filter_semua_pesanan_whatsapp_tanpa_status`.
- Frontend E2E: 1 lulus, 1 gagal.
- ESLint: 23 error dan 272 warning.
- Conditional React hooks ditemukan di `UbahJurnalModal.jsx`.

Jangan menurunkan aturan lint untuk meloloskan release. Perbaiki error sumbernya.

### P0: Dependency Tidak Aman

- Django runtime masih `5.0.14`, sudah berakhir masa security support.
- Upgrade target: Django `5.2` LTS, lalu jalankan seluruh test dan migration check.
- `npm audit` menemukan 10 vulnerability: 8 high, 1 moderate, 1 low.
- `xlsx` memiliki prototype pollution dan ReDoS tanpa fix npm langsung.
- Axios, React Router, dan Vite memiliki update perbaikan yang tersedia.

### P0: Media Sensitif Publik

Nginx menyajikan seluruh `/media/` tanpa autentikasi. Area ini dapat berisi kontrak HR
dan lampiran transaksi. Konfigurasi R2 juga menghasilkan URL publik permanen.

Pisahkan public media dan private media. Dokumen privat harus menggunakan endpoint
berizin, signed URL singkat, atau internal redirect yang terautentikasi.

### P0: Backup Belum Lengkap

Backup saat ini hanya mencakup database PostgreSQL Bintang. Belum mencakup:

- `media_files`
- Database Evolution
- `evolution_instances`
- Verifikasi restore otomatis
- Checksum dan manifest backup set

Deployment tidak boleh dianggap aman sebelum restore drill pada environment kosong
berhasil.

## 5. Risiko Tinggi Setelah Blocker

- Frontend Docker mengembalikan HTML `200` untuk `/api/health/`, bukan JSON API.
- Frontend Docker belum memiliki API proxy dan healthcheck.
- Frontend Nginx berjalan sebagai root.
- Gateway mengekspos port `80` ke semua interface host.
- Image `cloudflared`, Evolution, dan beberapa base image memakai tag mutable.
- Runbook restore menulis langsung ke database aktif.
- Belum ada CI yang mewajibkan migration check, test, lint, build, E2E, dan audit.
- `manage.py check --deploy` menghasilkan 228 warning OpenAPI/drf-spectacular.
- Bundle JavaScript awal sekitar 937 KB gzip dan belum memakai route-level lazy load.
- Banyak file backend/frontend melebihi 1.000 baris.
- Logging file backend berada di filesystem container yang tidak persisten.
- Redis belum memiliki healthcheck, auth, dan network segmentation yang jelas.

## 6. Urutan Kerja Besok

1. Review seluruh `git status`; pisahkan file release dan file eksperimen.
2. Buat dan review migration HR `0007`.
3. Perbaiki redirect loop Nginx/Cloudflare.
4. Tetapkan named Cloudflare Tunnel dan domain API stabil.
5. Perbaiki satu backend test yang gagal.
6. Perbaiki 23 ESLint error dan satu E2E login yang gagal.
7. Upgrade Django ke 5.2 LTS.
8. Update dependency frontend yang memiliki fix.
9. Putuskan pengganti atau isolasi aman untuk `xlsx`.
10. Lindungi private media.
11. Lengkapi backup database, media, dan Evolution.
12. Jalankan restore drill.
13. Jalankan seluruh Release Gate.
14. Commit hanya perubahan yang sudah lolos gate.
15. Push ke `origin/main`.
16. Baru jalankan deployment berbasis `git pull` di VPS.

## 7. Release Gate Lokal

Jalankan sebelum commit release:

```powershell
cd C:\bintang-project\bintang-advertising-backend
uv lock --check
uv run python manage.py makemigrations --check --dry-run
uv run python manage.py migrate --check
uv run python manage.py check
uv run python manage.py check --deploy
uv run python manage.py test

cd C:\bintang-project\bintang-react-frontend
npm ci
npm run lint
npm run build
npm run test:e2e
npm audit

cd C:\bintang-project\deploy
docker compose --env-file .env.example config --no-env-resolution --quiet

cd C:\bintang-project
docker build -t bintang-backend:release-check bintang-advertising-backend
docker build -t bintang-frontend:release-check bintang-react-frontend
docker build -t bintang-backup:release-check deploy/backup
```

`check --deploy` harus dijalankan dengan environment production-like yang tidak
mengandung secret produksi. Jangan menampilkan nilai secret di log CI atau terminal
bersama.

## 8. Commit dan Push Release

Pastikan branch masih sinkron sebelum membuat commit:

```powershell
cd C:\bintang-project
git fetch origin
git status -sb
git rev-list --left-right --count origin/main...HEAD
git diff --check
git diff
```

Stage file secara eksplisit. Contoh untuk kelompok perbaikan backend PostgreSQL dan
accounting:

```powershell
git add bintang-advertising-backend/Dockerfile
git add bintang-advertising-backend/pyproject.toml
git add bintang-advertising-backend/uv.lock
git add bintang-advertising-backend/core/settings.py
git add bintang-advertising-backend/accounting/views/settings.py
git add bintang-advertising-backend/accounting/tests_pos_settings.py
git add bintang-advertising-backend/hr/migrations/0007_alter_absensi_status.py
git diff --cached
```

Jangan stage migration `0007` sebelum file benar-benar dibuat dan direview. Tambahkan
file lain hanya jika memang satu release dan sudah diuji.

Setelah semua gate lulus:

```powershell
git commit -m "fix: prepare Bintang production deployment"
git push origin main
git status -sb
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Hash `git rev-parse HEAD` harus sama dengan hash `origin/main` sebelum VPS melakukan
pull. Simpan hash release tersebut sebagai `EXPECTED_COMMIT` pada catatan deployment.

## 9. Deployment VPS dengan Git Pull

Metode deployment yang dipilih: source diperbarui melalui `git pull` di VPS.

Penting: `git pull` hanya memperbarui checkout source. Service Bintang berjalan dari
Docker image, bukan bind mount source. Karena itu container tidak berubah sampai image
dibangun ulang dan container dibuat ulang. Compose tetap dipakai sebagai runtime
orchestrator, bukan sebagai sumber kode.

### Preflight VPS

```bash
cd /opt/bintang/project-bersama
git status --short
git branch --show-current
git rev-parse HEAD
docker compose -f deploy/docker-compose.yml ps
```

Jika `git status --short` di VPS tidak kosong, hentikan deployment. Jangan menjalankan
`git reset --hard` atau menghapus file tanpa memastikan perubahan tersebut bukan data
atau konfigurasi operator.

Pastikan secret tetap berada di file yang di-ignore:

```text
deploy/.env
deploy/evolution.env
deploy/backup/rclone.conf
```

### Backup Sebelum Pull

Jalankan dan verifikasi backup sebelum mengubah source atau schema:

```bash
cd /opt/bintang/project-bersama/deploy
docker compose exec backup /app/backup.sh
docker compose logs --tail=100 backup
```

Ini belum cukup sampai backup media dan Evolution ditambahkan. Jangan go-live hanya
dengan backup database Bintang saat ini.

### Pull Commit Release

```bash
cd /opt/bintang/project-bersama
git fetch origin
git pull --ff-only origin main
git rev-parse HEAD
```

Verifikasi hash hasil pull sama dengan `EXPECTED_COMMIT`. `--ff-only` mencegah merge
commit tak terencana di VPS.

### Build dan Jalankan dari Commit yang Sama

`backend-init` dan `backend` harus memakai image yang dibangun dari commit sama.
Konfigurasi sekarang mendefinisikan build terpisah untuk keduanya, jadi keduanya wajib
dibangun ulang setelah pull:

```bash
cd /opt/bintang/project-bersama/deploy
docker compose build backend-init backend backup
docker compose up --force-recreate backend-init
docker compose up -d --force-recreate backend gateway backup
docker compose ps
```

Perintah `backend-init` sengaja berjalan foreground. Jika migration atau
`collectstatic` gagal, hentikan deployment dan jangan menjalankan perintah berikutnya.

Jangan hanya menjalankan `docker compose build backend && docker compose up -d backend`.
Cara tersebut dapat menjalankan backend baru dengan migration/init image lama.

Evolution tidak perlu di-pull atau di-recreate untuk release backend Bintang kecuali
konfigurasi atau versi Evolution memang berubah dan sudah diuji terpisah.

### Verifikasi Setelah Pull

```bash
cd /opt/bintang/project-bersama/deploy
docker compose ps
docker compose logs --tail=200 backend-init
docker compose logs --tail=200 backend
docker compose exec backend python manage.py migrate --check
curl -fsS http://127.0.0.1/api/health/
```

Setelah redirect loop diperbaiki, verifikasi juga dari domain publik:

```bash
curl -fsS https://API_DOMAIN/api/health/
curl -I https://API_DOMAIN/api/
```

`curl -I` tidak boleh berulang kali mengembalikan redirect ke URL yang sama.

Lakukan smoke test dari frontend produksi:

- Login berhasil.
- Login salah menampilkan error.
- Refresh halaman pada deep route berhasil.
- Order, POS, accounting, upload media, dan WhatsApp dapat mengakses API.
- Sentry menerima test event release.

## 10. Rollback Minimum

Sebelum deployment, catat:

```bash
PREVIOUS_COMMIT=$(git rev-parse HEAD)
echo "$PREVIOUS_COMMIT"
```

Rollback source saja tidak otomatis membalik migration database. Setiap migration baru
harus diklasifikasikan reversible atau memerlukan restore. Gunakan strategi
expand/contract untuk perubahan schema berisiko.

Minimum rollback aplikasi:

```bash
cd /opt/bintang/project-bersama
git switch --detach PREVIOUS_COMMIT
cd deploy
docker compose build backend-init backend
docker compose up -d --force-recreate backend
```

Jangan menjalankan rollback schema atau restore database produksi tanpa maintenance
mode, menghentikan seluruh writer, dan memverifikasi backup. Buat prosedur restore
teruji sebelum deployment pertama.

## 11. Release Gate Akhir

Deployment boleh dimulai hanya jika semua kondisi berikut terpenuhi:

- [ ] Working tree lokal bersih setelah commit.
- [ ] `main` lokal sama dengan `origin/main`.
- [ ] Hash release dicatat.
- [ ] Working tree VPS bersih.
- [ ] Migration drift nol.
- [ ] Seluruh backend test lulus.
- [ ] ESLint nol error.
- [ ] Frontend build lulus.
- [ ] Seluruh E2E smoke test lulus.
- [ ] Dependency high vulnerability ditutup atau mitigasi tertulis disetujui.
- [ ] Django berada pada versi yang masih didukung.
- [ ] Redirect loop gateway sudah diperbaiki dan diuji.
- [ ] Domain API stabil, bukan Quick Tunnel sementara.
- [ ] Private media tidak tersedia tanpa autentikasi.
- [ ] Backup database, media, dan Evolution berhasil.
- [ ] Restore drill berhasil.
- [ ] Rollback commit dan rollback schema terdokumentasi.
- [ ] Monitoring uptime, Sentry, disk, dan backup freshness aktif.

Sampai checklist ini selesai, keputusan deployment tetap: **NO-GO**.

## 12. Perbaikan Ringan Selesai Malam Ini

Selesai pada 31 Agustus 2026:

- [x] Migration HR `0007_alter_absensi_status.py` dibuat.
- [x] Migration drift nol (`makemigrations --check --dry-run`).
- [x] Migration lengkap lulus pada PostgreSQL 16 kosong, termasuk `hr.0007`.
- [x] Urutan daftar order dibuat deterministik dengan tie-breaker `-id`.
- [x] Test order yang sebelumnya gagal sekarang lulus.
- [x] `SECRET_KEY` production divalidasi: minimal 50 karakter, cukup beragam,
  dan bukan placeholder atau prefix `django-insecure-`.
- [x] Warning Django `security.W009` untuk secret audit production-like hilang.
- [x] Nginx mempertahankan `X-Forwarded-Proto: https` dari Cloudflare.
- [x] Redirect loop gateway diperbaiki; smoke test menghasilkan `401` normal,
  bukan redirect `301` ke URL sama.
- [x] Gateway hanya bind ke `127.0.0.1:80`, tidak ke seluruh interface host.
- [x] Redis Bintang memiliki healthcheck.
- [x] Backend dan init menunggu Redis berstatus healthy.
- [x] Syntax Nginx dan Docker Compose lulus validasi.

Verifikasi terarah:

- 17 test order/security lulus.
- Migration PostgreSQL kosong lulus.
- Nginx `nginx -t` lulus.
- Compose `config --no-env-resolution --quiet` lulus.

Blocker P0 yang masih terbuka:

- Domain API stabil/named Cloudflare Tunnel dan placeholder Netlify.
- Seluruh backend test suite sudah lulus: 691/691.
- 23 error ESLint dan satu E2E frontend.
- Upgrade Django 5.2 LTS.
- Vulnerability dependency frontend, terutama `xlsx`.
- Proteksi private media.
- Backup lengkap dan restore drill.
