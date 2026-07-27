---
trigger: always_on
description: Consult the graphify knowledge graph at graphify-out/ for codebase and architecture questions.
---

## Koordinasi multi-agent (WAJIB dibaca dulu)

Pekerjaan project ini dikoordinasikan lewat vault Obsidian, folder `koordinasi/`:
1. Sebelum mengerjakan apa pun, baca `koordinasi/Agent Board.md` dan klaim task di sana. Jangan kerjakan task `in_progress` milik agent lain.
2. Ikuti `koordinasi/Protokol Agent.md` (klaim → kerja → tulis Hasil → update board → `graphify update .`).
3. Patuhi `koordinasi/Aturan Engineering.md` — aturan teknis mengikat (larangan keras L1–L10, aturan uang/akuntansi M1–M8, eskalasi X1–X6).
4. Peta arsitektur & rambu-rambu: `Project Overview.md` di root vault. Aturan kode: `bintang-advertising-backend/AGENTS.md`.
5. Peran: agent executor mengerjakan task hingga status `review`; keputusan desain, approval final ke `done`, dan eskalasi diputuskan manager (user + sesi Claude manajer). Jangan menandai task `done` sendiri untuk task berkategori uang/akuntansi — set `review` dan tunggu approval.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- For codebase or architecture questions, when `graphify-out/graph.json` exists, first run `graphify query "<question>"` (CLI) or `query_graph` (MCP). Use `graphify path "<A>" "<B>"` / `shortest_path` for relationships and `graphify explain "<concept>"` / `get_node` for focused concepts. These return a scoped subgraph, usually much smaller than `GRAPH_REPORT.md` or raw grep output.
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
