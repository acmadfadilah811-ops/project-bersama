---
id: T-716
epik: "[[Bug QA Manual]]"
status: review
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-08-09
---

# T-716 — Staff tidak bisa memproses SPK yang diterbitkan dari POS (crash `job.order_item.order`)

## Scope

Bug ditemukan manager (Claude) 2026-08-09 saat mengecek pertanyaan user: "apakah data dari kasir langsung terhubung ke SPK yang dipakai staff, dan ordernya bisa diproses staff".

**Yang sudah benar**: kasir bisa menerbitkan SPK dari transaksi POS lunas via `POST /api/pos/sales/{id}/terbitkan-spk/` (`api/pos_views.py:353`) → `spk.terbitkan()` (`api/spk.py`) membuat `JobBoard` dengan `pos_sale_item` terisi (bukan `order_item`, keduanya saling eksklusif — dijaga `CheckConstraint` di `api/models.py:620-628`). `GET /api/jobs/{id}/` juga sudah benar menampilkannya (lewat properti `sumber`/`nama_produk`/`nomor_sumber`/`pelanggan` di model `JobBoard`, `api/models.py:634-655`, dibuktikan test `tests_spk_pos.py`).

**Bug**: begitu staff mencoba benar-benar mengerjakan job yang sumbernya POS, kode di `api/views/jobs.py` (`JobBoardViewSet`) mengakses `job.order_item.order` secara langsung tanpa null-check di banyak tempat. Untuk job dari POS, `order_item` adalah `None` → `AttributeError: 'NoneType' object has no attribute 'order'` → request gagal (500).

Titik yang harus diperbaiki (semua di `api/views/jobs.py`):
- `perform_update()` (PATCH ubah status) — baris ~257-362, banyak `OrderActivityLog.objects.create(order=job.order_item.order, ...)` dan `active_jobs_exist = JobBoard.objects.filter(order_item__order=order, ...)`
- `claim()` — baris ~388-415
- `start()` — baris ~417-449
- `complete()` — baris ~451-509, termasuk `order = job.order_item.order` di baris ~488 dan cek `active_jobs_exist` yang query `order_item__order=order`

Perbaikan harus konsisten dengan pola yang sudah ada di model: pakai properti `job.pelanggan` / `job.sumber` dan cari padanan untuk "order" abstrak (butuh keputusan desain — lihat di bawah).

## Konteks graph

`graphify query "SPK diproses oleh staff, JobBoard, TahapProses"` dan pembacaan langsung `api/spk.py`, `api/views/jobs.py`, `api/models.py` (class `JobBoard`, baris 568-660), `api/tests_spk_pos.py`. Tidak ada test yang menutupi claim/start/complete/perform_update untuk job ber-`pos_sale_item` — itu sebabnya bug ini lolos.

## Keputusan desain yang perlu diputuskan sebelum implementasi (bukan wewenang executor — eskalasi ke manager kalau ambigu)

`OrderActivityLog` terikat ke `Order` (FK wajib, `api/models.py:380`). Job dari POS tidak punya `Order`. Opsi:
1. Skip pencatatan `OrderActivityLog` kalau `job.order_item` `None` (job dari POS tidak tercatat di log aktivitas order — masuk akal karena memang bukan order).
2. Buat log activity terpisah khusus POS (lebih besar scope-nya, mungkin di luar task ini).
3. Lainnya sesuai temuan agent saat investigasi.

**Keputusan diambil (2026-08-09, instruksi eksplisit user)**: Opsi 1 — untuk job ber-`pos_sale_item`, pencatatan `OrderActivityLog` dilewati (bukan dibuat log pengganti). Konsisten dengan constraint "tepat satu sumber"; tidak ditemukan konsumen lain yang mengasumsikan `OrderActivityLog` selalu ada per job (log ini murni riwayat Order, job POS memang tidak punya Order).

**Temuan tambahan saat implementasi**: `deduct_job_materials_if_needed()` (pemotongan stok bahan otomatis via BoM) juga mengakses `job.order_item.jenis_produk/bahan/luas/qty` langsung — field ini tidak punya padanan di `POSSaleItem` (tidak ada `bahan`/`luas`). Untuk job POS, fungsi ini sekarang no-op (return awal); staff tetap bisa input manual lewat `JobMaterialDeductView` (`POST /api/jobs/{id}/use-materials/`) yang sudah aman (tidak menyentuh `order_item`).

## Acceptance criteria

- [x] `claim()`, `start()`, `complete()`, `perform_update()` di `JobBoardViewSet` tidak crash untuk job dengan `pos_sale_item` terisi (`order_item=None`)
- [x] Cek "semua job dalam order selesai → status_global='ready'" (di `complete()` dan `perform_update()`) di-skip untuk job POS (dijaga `if job.order_item_id:`)
- [x] Test baru: staff claim → start → complete job yang sumbernya POS, end-to-end lewat HTTP nyata (`SpkPosDiprosesStaffTest` di `tests_spk_pos.py`, 2 test: alur claim/start/complete dan alur PATCH status)
- [x] Test regresi: job dari order (alur lama) tetap jalan seperti sebelumnya — full suite 400/400 lulus, 0 regresi
- [x] Authorization server-side tidak berubah (permission classes & pengecekan pic_staff/divisi tidak disentuh)
- [x] Tidak ada file melebihi hard limit 1000 baris (`jobs.py` masih jauh di bawah)
- [x] `graphify update .` sudah dijalankan

## Hasil

- **File diubah**:
  - `api/views/jobs.py` — tambah helper `_catat_aktivitas_order()` (skip log kalau `order_item` kosong); `deduct_job_materials_if_needed()` sekarang no-op untuk job tanpa `order_item`; `claim()`, `start()`, `complete()`, `perform_update()` diganti pakai helper + `job.nama_produk` (bukan `job.order_item.jenis_produk` langsung); blok "tandai order ready" di `complete()`/`perform_update()` dibungkus `if job.order_item_id:`
  - `api/tests_spk_pos.py` — tambah `SpkPosDiprosesStaffTest` (2 test: claim→start→complete via action endpoint, dan update status via PATCH)
- **Endpoint baru/berubah**: tidak ada endpoint baru; perilaku `POST /api/jobs/{id}/claim/`, `/start/`, `/complete/`, dan `PATCH /api/jobs/{id}/` diperbaiki supaya tidak crash untuk job asal POS
- **Migration**: tidak ada
- **Keputusan penting / catatan untuk agent lain**: lihat bagian "Keputusan diambil" di atas. Test dijalankan: `uv run python manage.py test api.tests_spk_pos api.tests_spk_deadline api.tests_security hr.tests_staff_dashboard` (34/34 lulus) dan full suite `uv run python manage.py test` (400/400 lulus). Menunggu verifikasi independen manager sebelum `done` sesuai protokol.

## Deploy VPS (2026-08-09, instruksi eksplisit user "update juga bagian vps nya")

- VPS aktif: `38.253.224.44` (port SSH `44156`, port di `deploy_vps.py`/`check_vps_full.py`/`scripts/_find_vps.py`/`scripts/_vps_pull_backend.py` — semuanya `38.253.224.40:40186` — **sudah stale/salah**, punya VPS lama yang tidak dipakai lagi; sebaiknya file-file itu diperbarui atau dihapus di task terpisah supaya tidak menyesatkan agent berikutnya).
- Arsitektur VPS: Docker Compose (`/opt/bintang/deploy/docker-compose.yml`), source backend di `/opt/bintang/backend` (build context, bukan bind-mount live) — `git pull` saja TIDAK cukup, wajib `docker compose build backend` lalu recreate container.
- Karena checkout backend di VPS juga penuh perubahan uncommitted (mirror kondisi lokal — agent lain kerja langsung di sana) dan HEAD-nya divergen dari lokal, saya **tidak melakukan `git pull`/push** — file `api/views/jobs.py` dan `api/tests_spk_pos.py` disalin langsung via SFTP ke checkout VPS (backup `.bak_t716` dibuat lebih dulu), lalu `docker compose build backend` + `docker compose up -d backend`.
- **Temuan terpisah (bukan bug T-716, tidak disentuh)**: test `tests_spk_pos.py` gagal 11/11 di VPS — semuanya crash di `setUp()` pada `POSSale.objects.create()` dengan `column "voided_at" does not exist`. Sebab: `api/pos_models.py` di checkout VPS sudah punya field `voided_at`/`voided_by` (kerjaan agent lain, fitur void POS, terlihat juga di `pos_views.py`/`pos_services.py` yang berubah) tapi **migration-nya belum pernah dibuat** (`makemigrations --check --dry-run` mengonfirmasi 2 field yang hilang migration-nya). Ini artinya di production SEKARANG, kode punya field itu tapi kolom DB tidak ada — kalau ada code path yang menulis/membaca `POSSale.voided_at`, akan crash live. Perlu task terpisah untuk generate+terapkan migration-nya (bukan wewenang saya — punya agent lain).
- Verifikasi fix T-716 di VPS: karena diblokir temuan di atas, test Django tidak bisa jalan bersih di VPS (gagal di baris `setUp()` yang sama sekali belum menyentuh kode JobBoard). Kebenaran logic sudah dibuktikan lewat 400/400 lokal; di VPS saya verifikasi lewat cara lain — grep container live mengonfirmasi kode fix benar-benar ter-deploy (`_catat_aktivitas_order` muncul 9x di `/app/api/views/jobs.py` container), health check backend (internal `curl` ke `127.0.0.1:8080/api/health/` dari dalam container) dan proxy frontend (`127.0.0.1/api/health/`) sama-sama `200`, container `healthy`.
