---
id: T-203
epik: "[[Integrasi Akuntansi-Orders]]"
status: done
agent: Claude (instruksi eksplisit user, 2026-08-01)
prioritas: sedang
depends_on: [T-202]
created: 2026-08-01
---

# T-203 — Edge Case DP/Pelunasan Order: Diskon, Kupon, Pembulatan

## Investigasi (bukti dulu, B1)

Baca `accounting/services/order_posting.py` dan `api/views/orders.py` (aksi
`bayar()`) untuk 3 kemungkinan celah yang disebut judul task:

1. **Pembulatan** — `bayar()` (`orders.py:499`) memaksa `jumlah_bayar =
   int(jumlah_bayar)` di boundary API. Tidak ada rupiah pecahan yang bisa
   masuk sama sekali. **Sudah aman by construction, tidak ada bug.**
2. **Diskon/kupon** — `Order.total_harga` (`api/models.py:217-230,
   233-255`) sudah dihitung ulang server-side dari subtotal item dikurangi
   diskon%, kupon, dan diskon otomatis SETIAP `Order.save()`. Journal
   pembayaran (`post_order_payment_journal`) hanya mem-posting
   `jumlah_bayar` (kas riil yang diterima) sebagai pendapatan net — tidak
   ada baris diskon terpisah, pola ini SAMA dengan POS
   (`pos_posting.py` juga tidak memecah baris diskon). **Desain konsisten,
   bukan bug** — diskon/kupon sudah netted di `total_harga` sebelum
   pembayaran dicatat.
3. **BUG UANG NYATA ditemukan**: `bayar()` TIDAK PERNAH memvalidasi
   `jumlah_bayar` terhadap `order.sisa_tagihan`. `Order.save()` meng-clamp
   `sisa_tagihan = max(0, total_harga - dp_dibayar)` — jika kasir input
   `jumlah_bayar` melebihi sisa tagihan (overpayment), `dp_dibayar`
   bertambah penuh, jurnal mem-posting SELURUH nominal sebagai pendapatan
   (melebihi `total_harga` order), dan `sisa_tagihan` diam-diam floor ke 0
   tanpa jejak kelebihan bayar (tidak ada mekanisme deposit/refund untuk
   selisihnya). Beda dari POS (`pos_services.py:217`) yang MEMANG
   mengizinkan overpay tunai karena ada semantik "kembalian" — Order
   DP/pelunasan adalah model cicilan invoice, tidak ada uang kembali,
   jadi overpay harus ditolak, bukan diterima diam-diam (M6: hitung ulang
   server-side, jangan percaya input mentah).
4. Tambahan kecil: `jumlah_bayar` bernilai 0/negatif sebelumnya lolos
   validasi tipe (`int()`) dan hanya `<= 0` di-skip DIAM-DIAM oleh gating
   `should_post_order_payment` — `dp_dibayar` bisa saja sudah kadung
   berubah di `bayar()` sebelum gating servis dicek (servis dipanggil
   SETELAH `order.save()`). Ditutup sekalian dengan guard yang sama.

## Perbaikan (`api/views/orders.py`, aksi `bayar()`)

Guard baru SEBELUM `order.dp_dibayar += jumlah_bayar`:
```python
if jumlah_bayar <= 0:
    return Response({'error': 'jumlah_bayar harus lebih dari nol.'}, status=400)
if jumlah_bayar > order.sisa_tagihan:
    return Response({'error': f'Jumlah bayar (Rp{jumlah_bayar:,}) melebihi sisa tagihan (Rp{order.sisa_tagihan:,}).'}, status=400)
```
Diletakkan SEBELUM mutasi `order.dp_dibayar`/`order.save()` — reject
terjadi sebelum ada efek samping apa pun (tidak perlu rollback, tidak ada
`OrderActivityLog`/jurnal yang sempat dibuat).

**Sengaja tidak diubah**: alur DP awal saat `Order` dibuat
(`perform_create`, jalur terpisah dari `bayar()`) — di luar scope U1,
task ini fokus pada aksi cicilan/pelunasan yang namanya disebut di judul.
Kalau overpayment di titik pembuatan Order juga jadi masalah nyata, itu
task terpisah.

## Dampak ke test lama

`accounting/tests_order_posting.py::OrderPostingViaAPITest` memakai Order
tanpa `OrderItem` (total_harga=0 by construction) lalu bayar dengan
nominal sembarang — pola ini valid untuk menguji mekanisme posting jurnal
saja, tapi sekarang gagal guard baru (`jumlah_bayar > sisa_tagihan=0`).
Diperbaiki (bukan dilemahkan, T4): tambah helper `_add_item()` yang
memberi tiap Order fixture satu `OrderItem` bernilai besar (Rp10.000.000)
supaya `total_harga` mencukupi semua nominal test yang ada — bukan
mengubah assertion atau skip test.

## Test baru (B3)

`OrderPostingViaAPITest`:
- `test_bayar_overpayment_rejected` — `jumlah_bayar = sisa_tagihan + 1` →
  400, `dp_dibayar` TIDAK berubah, 0 `JournalEntry`.
- `test_bayar_zero_or_negative_rejected` — `0` dan `-1000` → 400 keduanya,
  `dp_dibayar` tetap 0.

## Verifikasi

- `accounting.tests_order_posting` + `tests_order_reversal` +
  `tests_order_settlement`: 28/28 lulus (termasuk 2 test baru), 0 regresi
  dari fixture yang diperbaiki.
- Full suite `accounting api`: 329/329 lulus, 0 regresi.
- Tidak ada migration (perubahan murni logic view, tidak ada perubahan
  model).

Status `done` — diimplementasikan dan diverifikasi test nyata di sesi yang
sama oleh Claude (manager), sesuai instruksi eksplisit user untuk
mempercepat penyelesaian backlog akuntansi hari ini.
