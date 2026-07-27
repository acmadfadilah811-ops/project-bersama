# 🚀 Bintang Project - Central Knowledge Base & Architecture Map

Dokumen ini adalah **pusat informasi dan kondisi proyek** yang dapat dibaca oleh **Obsidian** maupun AI (**Claude Code, Antigravity, Cursor, ChatGPT CLI**, dll). 

Dengan dokumen ini dan integrasi **Graphify**, AI tidak perlu lagi melakukan scanning ke 670+ berkas dari awal saat Anda mengajukan pertanyaan.

---

## 📌 1. Ringkasan Proyek

| Komponen | Spesifikasi / Tech Stack | Lokasi Folder |
| :--- | :--- | :--- |
| **Backend** | Python / Django REST Framework / SQLite (Dev) / PostgreSQL (Prod) | [`/bintang-advertising-backend`](file:///c:/bintang-project/bintang-advertising-backend) |
| **Frontend** | React / Vite / TailwindCSS | [`/bintang-react-frontend`](file:///c:/bintang-project/bintang-react-frontend) |
| **Graphify** | Architectural Knowledge Graph (3,705 nodes, 11,821 edges, 280 communities) | [`/graphify-out`](file:///c:/bintang-project/graphify-out) |

---

## 🏗️ 2. Hub Arsitektur Utama (God Nodes)
Berdasarkan analisis Graphify AST, berikut adalah 10 modul/komponen dengan keterkaitan paling tinggi (pusat arsitektur sistem):

1. **`apiClient`** (163 koneksi) - Central HTTP Client di React Frontend.
2. **`Contact`** (121 koneksi) - Model Manajemen Kontak / Pelanggan di Backend.
3. **`CustomUser`** (120 koneksi) - Model Autentikasi dan Pengguna.
4. **`Order`** (119 koneksi) - Model Pesanan Utama & POS.
5. **`JobBoard`** (113 koneksi) - Papan Produksi & Tugas Pekerjaan.
6. **`IsOwnerOrManager`** (110 koneksi) - Guard Permission & Otorisasi DRF.
7. **`Product`** (105 koneksi) - Model Produk, Varian, dan Inventaris.
8. **`useAuth()`** (96 koneksi) - React Context Hook untuk Autentikasi User.
9. **`InventoryItem`** (85 koneksi) - Manajemen Stok & Logistik.
10. **`notify()`** (85 koneksi) - Notification Helper di Frontend.

---

## 🛡️ 3. Status Perbaikan & Security Audit (Terbaru)

### Backend (Django)
- **POS & Transaksi**: Rekalkulasi harga server-side, row-locking stok saat transaksi, nomor invoice bebas race condition, void dibatasi owner/manager.
- **Autentikasi & Security**: Throttle login, passkey support, token reset terikat request, IP proxy validation, security header fail-closed.
- **Migrasi Database**: Leaf migration tuntas pada `0077_audit_security_integrity`.

### Frontend (React)
- **Otorisasi**: Route default-deny, path kasir tervalidasi, shift terisolasi per-user.
- **Pagination v3**: Menggunakan helper `fetchAllPages()` eksplisit dengan batas aman 50,000 baris untuk mencegah UI freeze.

---

## 🤖 4. Panduan Penggunaan AI (Claude, Cursor, Antigravity, dll.)

Setiap AI yang membuka proyek ini **otomatis disunting agar membaca Knowledge Graph terlebih dahulu**:
- **Claude Code**: Membaca [`CLAUDE.md`](file:///c:/bintang-project/CLAUDE.md) dan Hook PreTool.
- **Antigravity**: Membaca [`.agents/rules/graphify.md`](file:///c:/bintang-project/.agents/rules/graphify.md).
- **Obsidian**: Anda dapat membuka visualisasi interaktif Graphify di Obsidian dengan membuka file [`graphify-out/graph.html`](file:///c:/bintang-project/graphify-out/graph.html) atau laporan di [`graphify-out/GRAPH_REPORT.md`](file:///c:/bintang-project/graphify-out/GRAPH_REPORT.md).

### Perintah Pembaruan Graphify (Jika Ada Perubahan Kode Besar)
```powershell
graphify extract . --code-only && graphify cluster-only .
```

---
*Terakhir Diperbarui: 27 Juli 2026*
