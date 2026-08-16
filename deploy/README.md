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

`backend` naik sebanyak `BACKEND_REPLICAS` (default 3) di belakang `gateway` (nginx) — ini yang mengatasi lambatnya kasir/produk akibat 1 proses Daphne kebanjiran request. Naikkan `BACKEND_REPLICAS` di `.env` kalau masih terasa lambat (sesuaikan dengan jumlah core VPS), lalu `docker compose up -d --build backend`.

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

- Semua service jalan lewat `docker compose` di folder ini — tidak ada lagi 2 checkout terpisah (`/opt/bintang/backend` + `/opt/bintang/frontend`) seperti VPS lama. Update kode = `git pull` di root repo, lalu `docker compose build` + `up -d` di sini.
- `gateway` (nginx) satu-satunya service yang expose port ke host (80). Routing: `/api/`, `/admin/` → `backend` (round-robin ke semua replica), `/static/`/`/media/` → volume bersama, selain itu → `frontend` (SPA).
- Cloudflare Tunnel masih Quick Tunnel (URL publik berubah tiap restart `cloudflared`) — sama seperti VPS lama. Kalau butuh domain tetap, perlu setup named tunnel terpisah (bukan `--url` quick tunnel).
