---
id: T-625
epik: "[[Bug QA Manual]]"
status: done
agent: Claude
prioritas: tinggi
depends_on: []
created: 2026-07-30
---

# T-625 — Perbaiki Hard Delete Jurnal Posted

**Verifikasi manager 2026-08-01 — CONFIRMED, promosi ke `done`.** `delete()` sudah tidak hard-delete (M7/L7 dipatuhi) — bikin jurnal pembalik + `JournalAuditLog` nyata, 28/28 test lulus. Minor non-blocking: status `draft` sekarang tidak bisa dihapus sama sekali lewat endpoint ini (aman-secara-default, tapi pertanyaan terbuka di desain awal belum diputuskan eksplisit).

## Update 2026-07-31: DIPERBAIKI (bukan lagi blocked)

User memilih opsi jurnal pembalik (bukan hard-delete-Olsera-persis) saat ditanya lewat AskUserQuestion — lihat bagian "Implementasi" di bawah. Dikerjakan bersamaan dengan permintaan user membangun Log Jurnal yang benar (menu itu ternyata butuh persis perbaikan ini sebagai sumber datanya).

## Kenapa awalnya `blocked` (X3 — eskalasi ke manager, jangan menebak)

Ditemukan Claude saat investigasi tombol "Hapus" di Rincian Mutasi Akun (2026-07-30), bukan dicari sengaja — muncul waktu cek cara membersihkan data dummy demo untuk user.

## Bukti

`accounting/views/journal.py:165-184`:

```python
class JournalEntryDetailView(APIView):
    """
    GET /api/accounting/journal-entries/<entry_number>/
    DELETE /api/accounting/journal-entries/<entry_number>/
    """
    permission_classes = [IsOwnerOrManager]

    def delete(self, request, entry_number):
        entry = get_object_or_404(JournalEntry, entry_number=entry_number)
        entry.delete()
        return Response({"message": "Transaksi berhasil dihapus."}, status=status.HTTP_200_OK)
```

- `entry.delete()` — hard delete langsung ke `JournalEntry` (dan lines-nya via cascade), TIDAK PEDULI `status` (termasuk `posted`).
- Tidak ada pembuatan jurnal pembalik (bandingkan pola yang sudah benar di `reverse_purchase_payment_journal()` — `accounting/services/purchase_posting.py:69-111`).
- Parameter `reason` yang dikirim frontend (`HapusTransaksiModal.jsx` mengirim `{data: {reason}}`) TIDAK PERNAH dibaca `request.data` — hilang begitu saja, tidak ada `JournalAuditLog` yang dicatat untuk aksi hapus ini.
- Dipanggil dari: `RincianMutasiKasBank.jsx`/`MutasiTable.jsx` (Kas & Bank, sudah lama ada) dan `RincianMutasiAkun.jsx` (baru disambungkan Claude hari ini, T-610 follow-up) — jadi berlaku untuk SEMUA jurnal posted yang bisa diakses lewat kedua halaman itu, bukan cuma data baru/dummy.

## Pelanggaran

- **L7** — "Edit/hapus jurnal `posted`" (larangan keras).
- **M7** — "Pembatalan (void/retur) = jurnal pembalik ... Jurnal berstatus `posted` tidak pernah di-edit atau di-delete."

## Pertanyaan untuk manager (X6)

1. Apakah `delete()` diubah supaya untuk jurnal `posted` membuat jurnal pembalik (reuse pola `reverse_purchase_payment_journal`/`create_journal_entry` yang sudah ada), dan `reason` disimpan ke `JournalAuditLog`?
2. Apakah jurnal berstatus `draft` (kalau ada) boleh tetap hard-delete, atau semua status disamakan jadi reversal-only?
3. Apakah endpoint ini perlu dibatasi lebih lanjut (mis. hanya `owner`, bukan `manager`) mengingat dampaknya menyentuh semua modul (Kas & Bank, Biaya, Buku Besar, dan bakal disambungkan ke halaman lain)?

## Implementasi (Claude, 2026-07-31)

**Keputusan user** (ditanya via pilihan eksplisit): jurnal `posted` TIDAK di-hard-delete (M7/L7 tetap dipatuhi) — dibuat jurnal pembalik otomatis, tapi Log Jurnal tetap menampilkan deskripsi format Olsera ("Debit/Kredit akun ... IDR x", pipa-terpisah) persis contoh yang diberikan user.

- **Model**: `JournalAuditLog.Action` +`DELETED = "deleted", "Dihapus"` — migration `accounting/0032_journal_audit_log_deleted_action.py`.
- **Service baru**: `accounting/services/journal_audit.py::build_deletion_note()` — format persis contoh user.
- **`JournalEntryDetailView.delete()`** (`accounting/views/journal.py`) ditulis ulang:
  - Wajib `reason` (400 kalau kosong) — field yang sebelumnya dikirim frontend tapi tidak pernah dibaca.
  - Tolak kalau `status != posted` (400) atau sudah pernah dihapus/dibalik sebelumnya (400) — cegah dobel reversal.
  - Buat jurnal pembalik via `create_journal_entry()` (M2, satu pintu), `reversed_entry` di-set ke entry asli.
  - Catat `JournalAuditLog(action=DELETED, note=build_deletion_note(...))` ke entry ASLI (bukan ke pembalik) — entry asli tetap hidup di database (L7 terpenuhi), cuma statusnya tetap `posted` dengan penanda `reversed_entry` pada pembaliknya menunjuk balik ke sini.
- **Endpoint baru**: `GET /api/accounting/journal-audit-logs/?date_from=&date_to=&search=` (`JournalAuditLogListView`, `IsOwnerOrManager`, paginasi `OptionalPageNumberPagination`) — sebelumnya TIDAK ADA endpoint list untuk `JournalAuditLog` sama sekali.
- **Frontend `LogJurnal.jsx`**: sebelumnya terhubung ke endpoint yang SALAH TOTAL (`/accounting/lifecycle-logs/` — itu log Aktifkan/Hentikan Akuntansi, bukan Log Jurnal), penuh fallback tebak-tebakan (nama "Brandy" hardcode, nomor transaksi dikarang). Diganti ke endpoint asli di atas, field dipetakan langsung tanpa tebakan. Dipecah jadi 4 file (`LogJurnal.jsx` 226 baris + `LogJurnalTable/FilterModal/DescriptionModal.jsx`) — file lama sudah 539 baris sebelum disentuh, wajib extract (L5).
- **Komponen baru `LogJurnalLinesModal.jsx`**: klik "No. Transaksi" di Log Jurnal membuka rincian baris jurnal (Tanggal/Akun/No Transaksi/Deskripsi/No Dokumen/Nilai Debit/Nilai Kredit) — reuse `GET /accounting/journal-entries/<entry_number>/` yang sudah ada, tabel baru sesuai kolom yang diminta user (beda dari `PasanganJurnalModal` yang sudah ada, jadi bukan duplikat — kolomnya memang beda: No Dokumen per baris vs Diproses Oleh).
- **Kolom Aksi Log Jurnal**: sekarang dropdown titik-3 beneran (bukan tombol langsung) dengan 1 item "Deskripsi" — sesuai deskripsi user.

**Test baru**: `accounting/tests_journal_delete_audit.py` (7/7 lulus) — reversal bukan hard-delete, format note persis contoh user, wajib `reason`, permission, cegah hapus dobel, endpoint list mengembalikan log asli & search by entry_number. Suite `accounting` penuh 99/99 lulus, 0 regresi. `npm run build` lulus.

**Diverifikasi lewat alur nyata**: satu jurnal Pembelian dummy betul-betul dihapus lewat `DELETE /api/accounting/journal-entries/JU-202607-0029/` dengan `reason` asli — hasil note persis: `"Hapus Pembelian - JU-202607-0029 Debit 50000 Pembelian [DUMMY] Pembelian dari Jaya Sentosa, CV IDR 90.190 | Kredit 21000 Hutang dagang [DUMMY] Pembelian dari Jaya Sentosa, CV IDR 90.190 | Catatan: [DUMMY] Contoh hapus untuk demo Log Jurnal"`.

**Di luar scope (dicatat, bukan dikerjakan)**: contoh user menunjukkan SATU aksi "Hapus" mencakup 3 nomor transaksi sekaligus (1 PO + 2 pembayarannya, dihapus bersamaan). Sistem ini belum punya trigger UI untuk "hapus 1 dokumen induk beserta semua dokumen turunannya sekaligus" — satu-satunya jalur Hapus yang ada saat ini beroperasi per satu `entry_number`. Implementasi saat ini benar untuk skenario itu (hapus 1 entry → 1 baris Log dengan rincian entry itu saja). Cascade multi-dokumen adalah fitur terpisah yang lebih besar, belum diminta/di-trigger di UI manapun.
