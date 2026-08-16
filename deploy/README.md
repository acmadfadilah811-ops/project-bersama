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

URL `https://xxxxx.trycloudflare.com` ini **berubah tiap `cloudflared` restart** — begitu ada, update `deploy/.env` (`CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, tambahkan domain Netlify juga), lalu update `bintang-react-frontend/public/_redirects` (baris `/api/*`) dengan URL baru ini, commit, dan redeploy Netlify.

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

- VPS ini cuma jalankan **backend** (Django/Daphne + Postgres + Redis + Evolution API). Frontend (React) di-deploy terpisah ke **Netlify** (`bintang-react-frontend/netlify.toml`), bukan container di VPS — disk VPS ini kecil (11GB), jadi sengaja tidak dipakai untuk build/serve frontend.
- Semua service jalan lewat `docker compose` di folder ini — satu checkout monorepo, bukan 2 checkout terpisah seperti VPS lama. Update kode backend = `git pull` di root repo, lalu `docker compose build backend` + `up -d backend` di sini.
- `gateway` (nginx) satu-satunya service yang expose port ke host (80), API-only: `/api/`, `/admin/` → `backend` (round-robin ke semua replica), `/static/`/`/media/` → volume bersama. Root `/` cuma balas teks penanda, bukan situs — situs publiknya di Netlify.
- Cloudflare Tunnel masih Quick Tunnel (URL publik berubah tiap restart `cloudflared`, belum ada domain) — lihat langkah 3b buat cara ambil URL-nya dan menyambungkannya ke Netlify.
