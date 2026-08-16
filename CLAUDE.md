## Koordinasi multi-agent (WAJIB dibaca dulu)

Pekerjaan project ini dikoordinasikan lewat vault Obsidian, folder `koordinasi/`:
1. Sebelum mengerjakan apa pun, baca `koordinasi/Agent Board.md` dan klaim task di sana. Jangan kerjakan task `in_progress` milik agent lain.
2. Ikuti `koordinasi/Protokol Agent.md` (klaim → kerja → tulis Hasil → update board → `graphify update .`).
3. **Patuhi `koordinasi/Aturan Engineering.md`** — aturan teknis mengikat untuk perbaikan bug & penambahan fitur (larangan keras L1–L10, aturan uang/akuntansi M1–M8, eskalasi X1–X6).
4. Peta arsitektur & rambu-rambu: `Project Overview.md`. Aturan kode: `bintang-advertising-backend/AGENTS.md`.
5. Peran: agent executor mengerjakan task hingga status `review`; jangan pernah menandai task sendiri jadi `done` (termasuk task yang terasa kecil/jelas) — approval final, keputusan desain, dan eskalasi diputuskan manager (user + sesi Claude manajer) setelah verifikasi independen.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- Kalau node count graph terlihat menyusut tiba-tiba atau kehilangan cakupan salah satu subfolder (mis. `bintang-react-frontend/` hilang) — `graphify update .` pakai manifest+scan inkremental yang kadang skip file non-Python di subfolder terpisah. Perbaikan: `graphify extract . --code-only` (scan ulang seluruh tree, AST lokal, tanpa API key) lalu `graphify cluster-only .`, dijalankan dari root `C:\bintang-project` — bukan `update .` biasa.
