# Deploy VPS — setup pertama kali

Prasyarat di VPS baru: Docker + Docker Compose v2, repo ini di-clone ke `/opt/bintang/project-bersama` (satu checkout monorepo — bukan 2 repo terpisah).

## 1. Isi file secret (tidak ada di git)

```bash
cd /opt/bintang/project-bersama/deploy
cp .env.example .env                       # isi DB_PASSWORD, SECRET_KEY, domain, dst.
cp evolution.env.example evolution.env      # isi password DB evolution + API key
```

## 2. Konfigurasi backup off-site (rclone)

Pilih provider (Backblaze B2 / S3 / Google Drive, dll), lalu jalankan `rclone config` (bisa di komputer lain, tidak harus di VPS) untuk menghasilkan `rclone.conf`. Salin hasilnya ke:

```
deploy/backup/rclone.conf
```

Set `BACKUP_RCLONE_REMOTE` di `deploy/.env` sesuai nama remote yang dibuat (format `nama-remote:nama-bucket-atau-folder`). Tanpa file ini, backup TETAP jalan tapi cuma tersimpan lokal di VPS — tidak aman dari VPS down (ini akar masalah 2x kehilangan data sebelumnya).

## 3. Build & jalankan

```bash
docker compose build
docker compose up -d
docker compose ps
curl -fsS http://127.0.0.1/api/health/
```

`backend` naik sebanyak `BACKEND_REPLICAS` (default 2, sesuai VPS 2 vCPU) di belakang `gateway` (nginx) — ini yang mengatasi lambatnya kasir/produk akibat 1 proses Daphne kebanjiran request. Naikkan `BACKEND_REPLICAS` di `.env` kalau upgrade CPU, lalu `docker compose up -d --build backend`.

## 3b. Ambil URL publik dari Cloudflare Tunnel (belum ada domain)

```bash
docker compose logs cloudflared | grep trycloudflare.com
```

URL `https://xxxxx.trycloudflare.com` ini **berubah tiap `cloudflared` restart** — begitu ada, update `deploy/.env` (`CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`) dengan URL baru ini.

(Catatan: di VPS produksi saat ini tunnel-nya sudah pakai domain tetap lewat Cloudflare Tunnel, bukan Quick Tunnel berubah-ubah lagi — langkah 3b ini relevan cuma untuk setup VPS baru dari nol.)

## 4. Verifikasi backup manual

```bash
docker compose exec backup /app/backup.sh
ls -la deploy/backup/backups/
```

## 5. Restore dari backup

```bash
gunzip -c deploy/backup/backups/bintang_db_<STAMP>.sql.gz | docker compose exec -T bintang-db psql -U bintang -d bintang
```

## Catatan arsitektur

- VPS ini jalankan **backend** (Django/Daphne + Postgres + Redis + Evolution API) **dan** **frontend** (React, di-build via service `frontend` di `docker-compose.yml`, context `../bintang-react-frontend`) — keduanya container di VPS ini, BUKAN Netlify (dokumen ini sempat menyebut Netlify, itu sudah tidak berlaku/salah).
- Semua service jalan lewat `docker compose` di folder ini — satu checkout monorepo, bukan 2 checkout terpisah seperti VPS lama. Update kode backend = `git pull` di root repo, lalu `docker compose build backend` + `up -d backend` di sini. Update kode frontend = `git pull`, lalu `docker compose build frontend` + `up -d frontend`.
- `gateway` (nginx) hanya bind ke loopback host (`127.0.0.1:80`) dan diakses publik melalui Cloudflare Tunnel. `/api/`, `/admin/` → `backend` (round-robin ke semua replica), `/static/`/`/media/` → volume bersama, sisanya → `frontend` (SPA).
- Cloudflare Tunnel di VPS produksi sudah pakai domain tetap (`app.starphotoadvertising.com` dkk., dikonfigurasi dari dashboard Cloudflare Zero Trust, bukan file lokal) — langkah 3b di atas cuma relevan untuk setup VPS baru dari nol yang belum ada domain.
