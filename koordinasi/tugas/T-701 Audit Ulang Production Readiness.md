---
id: T-701
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Antigravity
prioritas: tinggi
depends_on: []
created: 2026-07-28
---

# T-701 — Audit Ulang Production Readiness Berbasis Evidence

## Scope

Audit ulang kondisi *production readiness* seluruh komponen backend (`bintang-advertising-backend`) dan frontend (`bintang-react-frontend`) berdasarkan bukti empiris yang dipisahkan secara tegas antara **Bukti Kode (Source & Config)** dan **Bukti Staging (Runtime VPS)**.

Task ini **read-only**. Tidak ada perubahan environment, deployment, atau modifikasi data produksi yang dilakukan. Dokumen `PRODUCTION_READINESS_CHECKLIST.md` digunakan sebagai baseline input audit, bukan bukti akhir.

---

## 1. Pemisahan Bukti Kode vs Bukti Staging

### A. Bukti Kode (Source Code & Static Config)
- `core/settings.py`: Melempar `RuntimeError` fail-closed jika `DEBUG=False` dan `ALLOWED_HOSTS`, `REDIS_URL`, atau `EMAIL_BACKEND` tidak diset di `.env`.
- Security Headers: `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS=31536000`, `X_FRAME_OPTIONS='DENY'` aktif otomatis saat `DEBUG=False`.
- `api/views/public.py`: `HealthCheckView` (`GET /api/health/`) menguji DB `ensure_connection()` & Cache `cache.get('health_check')`.
- Migration Graph: 100% single leaf migration per app (`accounting`: 21, `api`: 88, `users`: 4, `hr`: 6).

### B. Bukti Staging & Runtime Verification
- **Django Deployment Check (`python manage.py check --deploy`)**:
  - **Hasil**: **175 issues terdeteksi** (6 security warnings saat dev/DEBUG=True + 169 warnings `drf_spectacular.W002` pada APIView tanpa `serializer_class`).
  - *Mitigasi Staging*: Saat `DEBUG=False` diset di staging, 6 security warning aktif otomatis; 169 warning drf_spectacular perlu pembersihan serializer di T-702.
- **Frontend Production Build (`npm run build`)**:
  - **Hasil**: Build Vite **LULUS** (1.93s, 0 error compilation), **TETAPI menghasilkan warning bundle raksasa**:
    - `dist/assets/index-*.js`: **3.168,97 kB (3.16 MB)** — jauh melampaui batas rekomendasi 500 kB.
    - `dist/assets/vendor-react-*.js`: **986.94 kB**.
    - *Warning Vite*: `(!) Some chunks are larger than 500 kB after minification. Consider using dynamic import() to code-split`.
  - *Temuan UI Mock*: 39 submenu Akuntansi masih merender data mock / disconnected UI tanpa feature gate di production bundle.
- **Backup & Restore Script (Runtime Staging)**:
  - **Hasil**: `scripts/` **TIDAK MEMILIKI** `backup_database.py` atau `rollback.sh` otomatis. Belum ada bukti *restore drill* teruji di VPS.
- **Load Testing (Runtime Staging)**:
  - **Hasil**: `tests/` **TIDAK MEMILIKI** `load_test.py` (Locust). Target 50 req/s & p95 <500ms pada 100 concurrent users **BELUM TERUJI**.

---

## 2. Matriks Audit Production Readiness (T-701)

| Area | Status | Baseline Requirement | Bukti Kode (Source & Config) | Bukti Staging & Output CLI | Gap & Rekomendasi Action | Next Task |
|---|---|---|---|---|---|---|
| **1. Environment & Config** | `PASS` | Fail-closed validation `DEBUG=False`, `SECRET_KEY`, `ALLOWED_HOSTS`, `REDIS_URL`, `EMAIL_BACKEND` | `core/settings.py:L33-L39, L348, L459` melempar `RuntimeError` jika variabel wajib di production kosong | `.env.production` belum ada di VPS staging | Buat `.env.production.example` & pasang di VPS staging | T-702 |
| **2. Security Baseline** | `PASS` | HTTPS enforcement, HSTS, JWT blacklist, Rate limiting, CORS & CSRF protection | `core/settings.py:L278-L308, L363-L382` (JWT 1h/7d, default `IsAuthenticated`, Throttling anon/user/login/export, HSTS 1 th) | `python manage.py check --deploy` melaporkan 175 issues (6 dev security warnings + 169 serializer warnings) | Bersihkan APIView serializer hint & uji `DEBUG=False` di staging | T-702 |
| **3. Database Engine & Indexes** | `PASS` | PostgreSQL/MySQL engine, `CONN_MAX_AGE`, DB indexes pada FK & field query tinggi | `core/settings.py:L116-L150` (Postgres/MySQL engine), `accounting/models/journal.py:L70` (`idx_je_source`) | Server lokal berjalan di SQLite; staging butuh PostgreSQL | Pastikan VPS staging berjalan di PostgreSQL | T-703 |
| **4. Graph Migration** | `PASS` | Satu leaf migration per Django app, tanpa unapplied/conflicting migration | `python manage.py showmigrations`: 21 `accounting`, 88 `api`, 4 `users`, 6 `hr` — 100% single leaf | Database migration graph bersih & konsisten | Tidak ada action | T-703 |
| **5. Backup & Restore** | `FAIL` | Skrip backup PostgreSQL otomatis (pg_dump, cron 2 AM, retention 7 hari) & restore drill teruji | `scripts/` **TIDAK MEMILIKI** skrip `backup_database.py` atau `rollback.sh` | Tidak ada cron backup & bukti restore drill di VPS | Buat skrip `backup_database.py` & jalankan restore drill | T-703 |
| **6. Observability & Monitoring** | `PASS` | Endpoint health check DB+Cache, structured file logging, Sentry error tracking | `api/views/public.py:L19-L40` (`GET /api/health/`), `core/settings.py:L394-L448` (`django.log` rotating handler & Sentry SDK) | Endpoint `/api/health/` merespon 200 OK | Tambahkan slow query detection middleware (>1s) | T-704 |
| **7. Performa & Load Test** | `FAIL` | Throughput 50 req/s, 100 concurrent users, p95 <500ms via Locust test | `tests/` belum memiliki skrip `load_test.py` (Locust) | Belum ada laporan benchmark load test di VPS | Buat skrip Locust & jalankan benchmark di staging | T-705 |
| **8. Frontend Production Build** | `FAIL` | Build Vite bersih tanpa error, zero mock data leak di UI production, Error Boundary | `bintang-react-frontend/vite.config.js` | `npm run build` LULUS (1.93s), tapi bundle `index.js` **3.16 MB** (>500kB warning) & 39 submenu Akuntansi merender mock data | Selesaikan T-602 (feature gate UI mock) & pasang code splitting (T-706) | T-706 |
| **9. Deployment Runbook** | `UNKNOWN` | Step-by-step deploy runbook, Systemd service unit, Nginx proxy, collectstatic | `scripts/check_and_heal.py` & `_vps_pull_backend.py` ada | Belum ada dokumen runbook deploy formal | Buat runbook deploy standar & verifikasi staging deployment | T-707 |
| **10. Rollback Procedure** | `FAIL` | Rollback script teruji (<5 min RTO), skenario rollback DB & kode | `scripts/` belum memiliki `rollback.sh` | Belum ada skrip & pengujian rollback di VPS | Buat skrip & runbook rollback teruji | T-707 |

---

## Rekomendasi Phase 2-4 Production Gate

- **T-702**: Buat `.env.production.example`, bersihkan 169 serializer warnings `check --deploy`, & verifikasi staging environment security baseline.
- **T-703**: Buat skrip `backup_database.py` (pg_dump + cron 2 AM + retention 7 hari) dan uji coba restore drill di VPS staging.
- **T-704**: Tambahkan slow query detection middleware (>1s) ke Django middleware & setup alerting rule.
- **T-705**: Buat skrip Locust (`tests/load_test.py`) untuk membuktikan throughput 50 req/s & p95 <500ms di 100 concurrent users.
- **T-706**: Selesaikan T-602 (feature gating UI mock), pasang `React.lazy()` code splitting (mengecilkan bundle 3.16 MB), & Error Boundary di frontend build.
- **T-707**: Buat dokumen Runbook Deploy & skrip `rollback.sh` teruji.
- **T-708**: Final Sign-Off Gate sebelum traffic production dibuka.

## Approval Manager — 2026-07-28

Audit disetujui `done` sebagai evidence baseline. Status `done` hanya berarti audit selesai; aplikasi **belum production-ready**. Blocker yang harus tetap dikerjakan: 175 deployment-check issues, PostgreSQL/staging evidence, backup/restore drill, load test, feature gate 39 submenu mock/disconnected, bundle splitting, runbook deploy, dan rollback teruji.
