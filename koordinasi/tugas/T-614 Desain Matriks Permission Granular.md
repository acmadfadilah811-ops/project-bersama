---
id: T-614
epik: "[[Production Readiness dan Integrasi Akuntansi]]"
status: done
agent: Claude (keputusan & implementasi 2026-07-31, instruksi eksplisit user)
prioritas: sedang
depends_on: []
created: 2026-07-28
---

# T-614 — Desain Matriks Permission Granular (`PenyesuaianHakAkses.jsx`)

*Dipecah keluar dari [[T-612 Modul Tutup Buku dan Audit Trail Akuntansi|T-612]] pada review Wave 2 (2026-07-28) — lihat catatan "Wave 2 — Verifikasi independen" di T-612 untuk bukti lengkap.*

*(Catatan penomoran: task ini sempat salah ditulis sebagai "T-613" oleh manager sebelum menyadari Antigravity sudah memakai ID T-613 untuk [[T-613 Restore UI Akuntansi Setelah Integrasi API|task lain]] secara bersamaan — file lama sudah dihapus, dipindah ke T-614.)*

## Scope

`PenyesuaianHakAkses.jsx` (~575 baris, ~100 checkbox permission per modul: `do_tutup_buku`, `delete_jurnal_umum`, dll — lihat `INITIAL_MODULES`) mengimplikasikan matriks permission granular per-modul, tapi **tidak ada backend sama sekali** untuk fitur ini:
- Satu-satunya network call memanggil `GET /auth/user-profile/` — endpoint yang tidak ada (404 ditelan diam-diam).
- Tidak ada handler save/submit — semua checkbox murni state React lokal.
- Tidak ada model (`RolePermission`/`ModulePermission`/dsb tidak ditemukan di manapun).
- Enforcement backend yang benar-benar ada hanya role kasar 4 nilai (`owner/manager/admin/kasir`) via `IsOwnerOrManager` dkk di `api/permissions.py` — bukan matriks per-checkbox.

Ini bukan "hubungkan ke API yang ada" — ini **desain fitur baru** dari nol: apakah butuh model permission granular per user/role, bagaimana skemanya, bagaimana relasinya ke `CustomUser` (god node — R2, perubahan wajib approval manager terpisah), dan apakah ~100 checkbox itu semua benar-benar dibutuhkan atau bisa disederhanakan.

## Sebelum diklaim

Task ini butuh **desain tertulis approved manager (F1-style, meski bukan soal uang langsung — ini soal security/access control)** sebelum implementasi:
- Model permission granular: per-user override, atau per-role default + override?
- Endpoint contract: GET (baca permission efektif) + POST/PATCH (ubah) — siapa yang boleh ubah permission siapa (X2: hindari privilege escalation, misal manager menaikkan diri sendiri jadi owner-level).
- Interaksi dengan permission class yang sudah ada di `api/permissions.py` — apakah menggantikan, atau melengkapi role kasar yang sudah ada?
- Dampak ke 85–163 titik yang bergantung pada `CustomUser`/`IsOwnerOrManager` (R2) — audit dampak sebelum ubah apa pun.

**Jangan diklaim untuk implementasi langsung** — klaim dulu untuk fase desain, ajukan ke manager untuk approval, baru lanjut koding.

## Acceptance criteria

- [ ] Desain tertulis (model, endpoint, permission-of-permissions) diajukan & approved manager
- [ ] Endpoint baru terdaftar di skema drf-spectacular
- [ ] Authorization server-side untuk endpoint baca DAN tulis permission
- [ ] Test: matriks role x endpoint (siapa 200/403), termasuk uji privilege-escalation (user tidak bisa menaikkan permission diri sendiri)
- [ ] Tidak ada file melebihi hard limit (Python 400 / JSX 300)
- [ ] `graphify update .` sudah dijalankan

## Keputusan manager+user 2026-07-31 — scope disederhanakan drastis

Matriks 89-checkbox `PenyesuaianHakAkses.jsx` yang diusulkan sebagai desain
awal (per-permission granular per role, butuh ~89 titik enforcement baru di
backend) **DITOLAK user** setelah dijelaskan risikonya (skala penegakan
sangat besar, bahaya "keamanan palsu" kalau tersimpan tapi belum semua
ditegakkan). User memilih pendekatan jauh lebih sederhana: *"kita kan multi
akun, setiap akun beda tampilan menunya, jadi hanya akun owner, manager,
admin yang bisa akses akuntansi — tinggal titip tampilannya ke pengaturan
izin akses tiap akun yang sudah ada di Pengaturan Toko."*

**Temuan kunci**: `PenyesuaianHakAkses.jsx` (89 checkbox lokal, tidak pernah
tersimpan) BUKAN satu-satunya sistem hak akses di aplikasi ini. Ada sistem
**lain yang sudah nyata dan berfungsi**, sama sekali tidak disebut di note
awal task ini:
- `utils/permissions.js` — `MENU_FEATURES` (daftar fitur × path),
  `DEFAULT_PERMISSIONS`/`LOCKED_PERMISSIONS` per role, `hasMenuAccess()`.
- Ditegakkan nyata oleh `ProtectedRoute.jsx` (redirect kalau `fid` truthy dan
  `!hasMenuAccess`) DAN disembunyikan di `Sidebar.jsx` (filter menu per role).
- Diedit lewat tab **"Hak Akses"** di halaman Pengaturan Toko
  (`features/settings/pages/Settings.jsx` — tabel checkbox Manager/Admin/Staff
  Produksi per fitur, Owner selalu penuh & terkunci).
- Penyimpanan: `localStorage` (`brandy_menu_permissions`) — bukan backend.
  Sudah begini sejak awal, di luar scope task ini untuk diubah (U1).

**Gap yang ditemukan & diperbaiki**: `/accounting-internal` (Akuntansi
Internal) TIDAK PERNAH terdaftar di `MENU_FEATURES` — akibatnya
`getFeatureIdByPath()` mengembalikan `null` untuk rute itu, jadi
`ProtectedRoute` **tidak pernah menjaga rute ini sama sekali** (siapa pun yang
login & tahu URL bisa masuk), dan Admin bahkan tidak melihat menunya di
`Sidebar.jsx` (array `menuAdmin` tidak memuatnya) padahal backend
(`IsOwnerOrManager` di `api/permissions.py`) sudah mengizinkan Admin.
Backend API akuntansi sendiri sudah aman (dicek ulang: semua view di
`accounting/views/*.py` pakai `IsOwnerOrManager`/`IsStrictOwnerOrManager`
kecuali `lookups.py` yang memang cuma data referensi read-only).

**Implementasi** (frontend murni, tidak ada perubahan backend/model):
- `utils/permissions.js`: tambah entry `{id:'accounting-internal', label:'Akuntansi Internal', path:'/accounting-internal'}` ke `MENU_FEATURES`; tambah `'accounting-internal'` ke `DEFAULT_PERMISSIONS.owner/manager/admin` (tidak ke staff/kasir).
- `Sidebar.jsx`: tambah case `/accounting-internal` di `getFeatureIdByPath()` lokal; tambah item menu "Akuntansi Internal" ke array `menuAdmin`.
- `Settings.jsx` (Pengaturan Toko → Hak Akses): TIDAK diubah — tabelnya sudah generic (`MENU_FEATURES.map(...)`), baris baru otomatis muncul.

**Efek**: Owner selalu penuh. Manager/Admin defaultnya bisa akses Akuntansi
Internal, tapi sekarang benar-benar bisa di-uncheck lewat tab Hak Akses
(sebelumnya toggle ini diam-diam tidak berpengaruh karena `fid` selalu
`null`). Staff/Kasir default tidak bisa, dan kalau coba akses URL langsung
akan di-redirect oleh `ProtectedRoute` (sebelumnya lolos begitu saja). Kasir
tidak punya kolom di tabel Hak Akses sama sekali (terkunci ke `kasir-pos`) —
tidak bisa diberi akses akuntansi lewat jalur ini.

`PenyesuaianHakAkses.jsx` (menu dalam Akuntansi Internal, 89 checkbox lokal)
TIDAK disentuh — tetap ada sebagai halaman terpisah, di luar scope keputusan
ini. Kalau granularitas per-fitur di dalam Akuntansi Internal (bukan cuma
akses ke seluruh modulnya) suatu saat dibutuhkan, itu tetap desain besar
terpisah dengan pertimbangan F1/X2 yang sama seperti draf awal task ini.

## Verifikasi

- ESLint `utils/permissions.js`, `Sidebar.jsx`, `ProtectedRoute.jsx`: lulus.
- `npm run build`: lulus (2.34s).
- Review kode manual (bukan test otomatis — tidak ada unit test JS di repo
  ini, hanya Playwright e2e yang tidak disentuh): ditelusuri jalur
  `hasMenuAccess` untuk tiap role (owner/manager/admin/staff/kasir), terbukti
  konsisten dengan hasil yang diinginkan.
- Verifikasi visual manual di browser (server dev + 5 akun QA per role)
  diserahkan ke user secara langsung, bukan otomatis oleh Claude.
- `graphify update .`: selesai.

Status `review` — bukan `done`, sesuai protokol (executor/Claude tidak
menandai task sendiri jadi `done`).

## Verifikasi independen manager 2026-08-01 (sesi kedua) — ✅ PROMOTED TO `done`

- `utils/permissions.js` `MENU_FEATURES` dikonfirmasi punya entry
  `accounting-internal`; `DEFAULT_PERMISSIONS.owner/manager/admin` memuatnya.
- `ProtectedRoute.jsx` dikonfirmasi memakai `getFeatureIdByPath()` generik
  (bukan whitelist per-path hardcode) — otomatis ikut menjaga
  `/accounting-internal` begitu entry ditambahkan ke `MENU_FEATURES`, tidak
  perlu perubahan terpisah di `ProtectedRoute.jsx` sendiri.
- `Sidebar.jsx` dikonfirmasi punya case path & item menu untuk Akuntansi Internal.
- `npm run build`: lulus bersih.
Tidak ada blocker tersisa. Status → `done`.
