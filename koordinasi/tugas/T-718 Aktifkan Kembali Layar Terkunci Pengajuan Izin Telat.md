---
id: T-718
epik: "[[Bug QA Manual]]"
status: review
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-08-09
---

# T-718 — Aktifkan kembali layar terkunci & pengajuan izin telat absensi

## Scope

User melaporkan: "pengajuan izin, ketika staff telat absensi, itu belum berfungsi." Setelah fix pertama dideploy, user lapor lagi: submit izin masih gagal saat dicoba, dan minta dashboard owner (bagian absensi & permohonan buka absensi) sekalian dibenahi supaya menampilkan permohonan + ada opsi buka izin.

## Investigasi

Fitur ini **sudah lengkap diimplementasikan di backend maupun frontend** — bukan fitur yang hilang, tapi dinonaktifkan:

- Backend (`hr/views.py`, `hr/models.py`): `DailyAttendanceSession`, `UnlockRequest` model, `ClockInView` (cek `batas_maksimal` + `UnlockRequest` approved), `UnlockRequestStaffView` (`POST /api/hr/unlock-request/`), `UnlockRequestManagerView`/`UnlockRequestActionView` (approve/reject), `StaffDashboardView` menghitung `status_terkunci.is_locked` — semua sudah benar dan lengkap.
- Frontend: `LockedScreen.jsx` (form kirim alasan, tampilan pending/rejected) sudah lengkap. Sisi manager (`AttendanceSessionManager.jsx`, `Dashboard.jsx`) sudah polling & render daftar `unlock-requests` dengan tombol approve/reject — sudah lengkap.

**Akar masalah**: `bintang-react-frontend/src/components/Layout.jsx` baris 57-60 — gate yang menampilkan `<LockedScreen>` saat `status_terkunci.is_locked` **dikomentari**:

```jsx
// TEMPORARY BYPASS: Dibuka sementara untuk pengetesan/review log Papan Kerja
// if (statusTerkunci && statusTerkunci.is_locked) {
//   return <LockedScreen statusTerkunci={statusTerkunci} onRefresh={checkStatus} />;
// }
```

Sudah begini sejak commit merge monorepo (`347d4e3`), tidak ada histori sebelumnya untuk tahu siapa/kapan persisnya menonaktifkan — komentarnya sendiri bilang "sementara untuk pengetesan". Akibatnya: staff yang telat/terkunci tidak pernah melihat layar "Ajukan Izin" — mereka langsung masuk ke aplikasi seperti biasa, seolah tidak terkunci sama sekali.

## Perbaikan

Uncomment 3 baris di `Layout.jsx` supaya gate aktif kembali:

```jsx
if (statusTerkunci && statusTerkunci.is_locked) {
  return <LockedScreen statusTerkunci={statusTerkunci} onRefresh={checkStatus} />;
}
```

## Acceptance criteria

- [x] Staff yang telat (lewat `batas_maksimal`, belum clock-in, belum ada `UnlockRequest` approved) melihat `LockedScreen` dan bisa kirim alasan
- [x] `npm run build` bersih (2474 modul, tidak ada error)
- [x] Backend `hr` test suite tetap lulus (14/14) — fix ini murni frontend, tidak menyentuh backend
- [x] `graphify update .` sudah dijalankan

## Hasil

- **File diubah**: `bintang-react-frontend/src/components/Layout.jsx` — uncomment gate `LockedScreen` (3 baris)
- **Endpoint baru/berubah**: tidak ada (semua endpoint backend sudah ada sebelumnya, tidak disentuh)
- **Migration**: tidak ada
- **Keputusan penting / catatan untuk agent lain**: ini bug regresi murni ("kelupaan mengaktifkan lagi" setelah testing), bukan desain baru. Kalau ke depan perlu bypass sementara lagi untuk testing, sebaiknya pakai flag env/query-param eksplisit, bukan comment-out — supaya tidak lagi kelupaan ter-deploy ke production dalam keadaan nonaktif.

## Deploy VPS (2026-08-09)

- File `Layout.jsx` disalin ke `/opt/bintang/frontend/src/components/Layout.jsx` di VPS (backup `.bak_t718` dibuat dulu), `docker compose build frontend` + `docker compose up -d frontend`.
- Verifikasi: container `deploy-frontend-1` recreated & `Up`, health check `curl http://127.0.0.1/api/health/` → `200`.

## Investigasi lanjutan: "submit izin masih gagal" + dashboard owner (2026-08-09, sesi sama)

**Backend dibuktikan berfungsi 100%** — di-tes langsung dengan JWT nyata (dibuat lewat Django shell, bukan tebak-tebakan) untuk staff yang benar-benar dalam status `is_locked=true` (`staff_editor2`): `POST /api/hr/unlock-request/` mengembalikan `201 Created` "Permintaan berhasil dikirim." Data diagnostik & permintaan uji coba sudah dibersihkan dari database production setelahnya.

**Kenapa user sempat mengalami "tidak bisa"**: dicek dari `docker exec deploy-bintang-db-1 psql ... SELECT * FROM absensi` — akun yang dites user (`staff_editor1`) ternyata **sudah clock-in tepat waktu** sebelum `batas_maksimal`, sehingga `is_locked=false` untuk akun itu — LockedScreen memang tidak akan muncul (perilaku benar, bukan bug: tidak perlu izin kalau sudah hadir). Log server menunjukkan akun ini berulang kali mencoba `POST /api/hr/absensi/clock-in/` dan ditolak `403` setelah lewat batas — pesan errornya menyarankan "ajukan izin" padahal mereka sudah absen, agak membingungkan tapi bukan blocker inti (tidak diperbaiki di task ini, di luar scope; dicatat sebagai potensi follow-up UX kecil: urutan pengecekan di `ClockInView` bisa dibalik supaya cek "sudah absen" didahulukan dari cek "telat").

**Bug NYATA yang ditemukan & diperbaiki**: `bintang-react-frontend/src/features/dashboard/pages/Dashboard.jsx` (halaman owner asli, route `/dashboard` — bukan `AdminDashboard.jsx` yang cuma dipakai role `admin`) menampilkan daftar "Permohonan Buka Absen" (nama staff + alasan) tapi **tidak punya tombol Setuju/Tolak sama sekali** — cuma read-only. Ini kontras dengan `AttendanceSessionManager.jsx` (dipakai di `AdminDashboard.jsx`) yang sudah lengkap approve/reject — dua implementasi paralel, satu lengkap satu tidak (pola duplikasi modul yang sudah dicatat di Project Overview §3).

**Perbaikan**: tambah `handleUnlockAction(id, action)` di `Dashboard.jsx` (pola sama seperti `AttendanceSessionManager.jsx`) + tombol Setuju/Tolak di accordion "Permohonan Buka Absen", pakai endpoint yang sudah ada `POST /api/hr/unlock-requests/{id}/{action}/`. Import `CheckCircle2`, `XCircle` ditambahkan dari `lucide-react`.

- **File diubah (tambahan)**: `bintang-react-frontend/src/features/dashboard/pages/Dashboard.jsx`
- **Verifikasi**: `npm run build` bersih (2474 modul). Dideploy ke VPS (rebuild+restart container `frontend`, health check 200).
- **Catatan untuk agent lain**: kalau nanti sempat, `AttendanceSessionManager.jsx` dan bagian sesi-absensi/unlock di `Dashboard.jsx` sebaiknya disatukan jadi satu komponen shared — saat ini dua implementasi terpisah gampang drift lagi seperti kasus ini.

## Bug lanjutan: staff yang telat & disetujui izinnya tidak bisa Clock Out (2026-08-11)

User lapor lagi: "ada staff yng ngga bisa clock out, ketika telat hadir." Root cause **BUKAN** di backend (backend `ClockOutView`/`ClockInView`/`UnlockRequestActionView` sudah benar dan konsisten dengan desainnya) — bug murni di 4 file frontend.

**Kronologi bug**: `UnlockRequestActionView.approve` (hr/views.py) sengaja membuat/mengubah `Absensi` dengan `status='terlambat'` + `workspace_unlocked=True` TAPI **tidak mengisi `jam_masuk`** — itu memang desain awal, staff diharapkan tetap klik Clock In sungguhan setelah dibuka (lihat komentar di `ClockInView`). Masalahnya: 4 layar frontend (`StaffDashboard.jsx`, `AdminDashboard.jsx`, `Dashboard.jsx` bagian "DRAFT STAFF VIEW", `KasirDashboard.jsx`) semuanya menghitung "sudah clock-in?" dari `absensi.status !== 'belum_absen'`, bukan dari `jam_masuk`. Begitu status berubah jadi `'terlambat'` (saat izin disetujui), keempat layar itu langsung menganggap staff SUDAH clock-in — tombol Clock In berubah disabled "Sudah Masuk", padahal `jam_masuk` masih kosong. Staff jadi tidak pernah benar-benar klik Clock In. Saat pulang, tombol Clock Out terlihat aktif tapi request ke `POST /api/hr/absensi/clock-out/` selalu ditolak backend dengan "Belum ada clock-in hari ini, atau sudah clock-out." — persis laporan user.

**Perbaikan**: ganti definisi "sudah clock-in" di keempat file dari cek `status` jadi cek `Boolean(absensi_hari_ini?.jam_masuk)`:
- `bintang-react-frontend/src/features/dashboard/pages/StaffDashboard.jsx` (`isClockedIn`)
- `bintang-react-frontend/src/features/dashboard/pages/AdminDashboard.jsx` (`sudahClockIn`)
- `bintang-react-frontend/src/features/dashboard/pages/KasirDashboard.jsx` (`sudahClockIn`)
- `bintang-react-frontend/src/features/dashboard/pages/Dashboard.jsx` (`sudahAbsen`, plus dua kondisi `disabled`/label tombol Clock Out yang sebelumnya duplikat cek `status === 'belum_absen'` langsung, disatukan pakai `sudahAbsen`)

Efeknya: staff yang izin telatnya disetujui sekarang melihat tombol "Clock In Sekarang" aktif kembali (bukan "Sudah Masuk"), badge "Papan Kerja Dibuka" tetap tampil (dari `workspace_unlocked`) jadi mereka tahu aksesnya sudah terbuka meski belum absen — begitu diklik, `jam_masuk` tercatat benar dan Clock Out di akhir hari berfungsi normal. Baris statistik donat kehadiran owner (`countHadir`/`countTerlambat`/`countBelumAbsen`, line ~396-404 `Dashboard.jsx`) sengaja TIDAK diubah — itu klasifikasi status agregat, bukan gating tombol, tidak berkontribusi ke bug ini.

**Verifikasi**: `npm run build` bersih (2474 modul, tidak ada error). Backend tidak disentuh sama sekali (murni bug frontend), jadi test `hr` yang lama tidak perlu dijalankan ulang. Dideploy ke VPS (rebuild+restart container `frontend`, health check 200).

## Bug lanjutan: jadwal absensi berulang tidak bertahan setelah deploy (2026-08-11)

User tanya: "untuk pengaturan jam absensi apakah aman di bagian dashboard owner?" — dicek proaktif, ketemu bug nyata.

**Root cause**: `AttendanceSessionManagerView.post()` (hr/views.py) menulis jadwal "Terapkan Jadwal Ini Setiap Hari" (checkbox `repeat_daily` di `AttendanceSessionManager.jsx`) ke file `hr_attendance_schedule.json` di `BASE_DIR` (root project di dalam container backend). Volume Docker backend (`docker-compose.yml` di VPS) cuma mount `bintang_static:/data/static` dan `bintang_media:/data/media` — bukan `/app` — jadi file itu HANYA hidup selama container belum di-rebuild. Setiap `docker compose build backend` (yang rutin terjadi tiap deploy fitur baru) bikin image baru dari nol, file itu hilang, dan `get_or_create_daily_session()` gagal auto-membuat sesi besok karena fallback filenya juga sudah tidak ada.

**Bukti dari data produksi**: `daily_attendance_session` punya baris untuk 5 hari berturut-turut (7-11 Agustus), SEMUANYA dengan `dihidupkan_oleh_id` terisi (bukan `null`) — artinya semua dibuat lewat POST manual (klik "Mulai Sesi"), bukan auto-create dari jadwal berulang. `SystemConfig` (tabel yang JUSTRU sudah dicek duluan sebagai sumber utama di `get_or_create_daily_session()`) kosong sama sekali untuk key `payroll_*`. Kesimpulan: toggle "otomatis" ini kemungkinan besar sudah lama tidak pernah benar-benar berfungsi, cuma tidak ketahuan karena selalu ada yang membuka sesi manual duluan.

**Perbaikan**: pindahkan penyimpanan jadwal berulang dari file ke `SystemConfig` (key `payroll_jam_masuk` + `payroll_toleransi_menit`, database, otomatis bertahan lintas deploy):
- `get_or_create_daily_session()`: hapus fallback baca file JSON, hanya baca `SystemConfig`.
- `AttendanceSessionManagerView.get()`: `repeat_daily` dihitung dari keberadaan kedua key `SystemConfig`, bukan baca file.
- `AttendanceSessionManagerView.post()`: kalau `repeat_daily=True` → `update_or_create` kedua key `SystemConfig` (toleransi dihitung dari selisih `batas_maksimal - waktu_mulai`); kalau `False` → hapus kedua key (supaya mematikan toggle benar-benar berhenti auto-generate besok, bukan cuma UI). Ditambah validasi `batas_maksimal` harus setelah `waktu_mulai` (400 kalau tidak, sebelumnya tidak divalidasi).

**File diubah**: `bintang-advertising-backend/hr/views.py`, `bintang-advertising-backend/hr/tests.py` (5 test baru: `AttendanceSessionScheduleTests`).

**Verifikasi**: 21/21 test `hr` lulus lokal & di container VPS (301 di container = artefak test-harness dikenal, sudah dikonfirmasi berkali-kali sesi ini, bukan bug — lihat entri T-718 sebelumnya). Diverifikasi langsung ke database produksi lewat `APIRequestFactory` + transaksi yang di-rollback: POST `repeat_daily=True` → `SystemConfig` terisi benar (`08:00`/`45`), sesi besok terbukti otomatis terbentuk dari `SystemConfig` walau semua row `DailyAttendanceSession` dihapus (simulasi "setelah deploy ulang"), GET melaporkan `repeat_daily: true` dengan benar, dan mematikan toggle menghapus `SystemConfig` dengan benar. Tidak ada data uji yang tersisa permanen. Dideploy ke VPS (rebuild+restart `backend`, health 200).
