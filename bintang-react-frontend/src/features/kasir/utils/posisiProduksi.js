// Keterangan posisi pesanan di produksi (2026-10-08): divisi/tahap tujuan
// SPK terakhir beserta tanggal & jam masuknya, dari data job (JobBoard) yang
// sudah ikut di respons /orders/ dan /pos/sales/produksi/.

/** "08 Okt 2026, 14:05" */
export function formatTanggalJam(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Job aktif terakhir pesanan: { divisi, tahap, waktu } atau null bila belum ada SPK. */
export function posisiTerakhir(order) {
  const jobs = (order?.items || [])
    .flatMap((it) => it.jobs || [])
    .filter((j) => j.status_pekerjaan !== 'batal' && j.dibuat_pada);
  if (!jobs.length) return null;
  const j = jobs.reduce((a, b) => (new Date(b.dibuat_pada) > new Date(a.dibuat_pada) ? b : a));
  return {
    divisi: j.tahap_divisi_nama || j.pic_divisi_nama || '',
    tahap: j.tahap_nama || '',
    waktu: j.dibuat_pada,
  };
}

/** "Divisi Produksi (Cetak) · 08 Okt 2026, 14:05" */
export function teksPosisi(order) {
  const p = posisiTerakhir(order);
  if (!p) return '';
  const tujuan = [p.divisi && `Divisi ${p.divisi}`, p.tahap && `(${p.tahap})`].filter(Boolean).join(' ') || 'Produksi';
  return `${tujuan} · ${formatTanggalJam(p.waktu)}`;
}
