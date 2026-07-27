// Kolom & badge untuk layar Pembelian (Purchase). Semua data berasal dari
// endpoint /purchases/ (field asli), bukan lagi metadata JSON di dalam catatan.

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtRp = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;

const latestPaymentDate = (row) => {
  const p = row.payments || [];
  return p.length ? p[p.length - 1].tanggal : null;
};

/** Badge status penerimaan (dimensi Olsera: Tunda → Diterima). */
export const receiveBadge = (row) => {
  const val = row.status === 'batal' ? 'batal' : row.receive_status;
  const map = {
    tunda: ['Tunda', 'bg-orange-50 text-orange-600 border-orange-100'],
    diterima: ['Diterima', 'bg-emerald-50 text-emerald-600 border-emerald-100'],
    batal: ['Batal', 'bg-rose-50 text-rose-600 border-rose-100'],
  };
  const [label, cls] = map[val] || map.tunda;
  return <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${cls}`}>{label}</span>;
};

/** Badge status pembayaran (dimensi Olsera: Belum → Sebagian → Lunas). */
export const paymentBadge = (statusVal) => {
  const map = {
    belum: ['Belum Bayar', 'bg-rose-50 text-rose-600 border-rose-100'],
    sebagian: ['Sebagian', 'bg-amber-50 text-amber-600 border-amber-100'],
    lunas: ['Lunas', 'bg-emerald-50 text-emerald-600 border-emerald-100'],
  };
  const [label, cls] = map[statusVal] || map.belum;
  return <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${cls}`}>{label}</span>;
};

const nomorButton = (onSelectDoc) => (r) => (
  <button
    type="button"
    onClick={() => onSelectDoc(r.id)}
    className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
  >
    {r.nomor}
  </button>
);

export const getPembelianColumns = (onSelectDoc) => [
  { key: 'no', label: 'No. Pembelian', render: nomorButton(onSelectDoc) },
  { key: 'tanggal', label: 'Tanggal Beli', render: (r) => fmtDate(r.tanggal) },
  { key: 'supplier', label: 'Supplier', render: (r) => <span className="font-semibold text-slate-700">{r.supplier || '-'}</span> },
  { key: 'jumlah', label: 'Jumlah', render: (r) => <span className="font-bold text-slate-800">{fmtRp(r.total)}</span> },
  { key: 'telahBayar', label: 'Telah Bayar', render: (r) => <span className="text-slate-500">{fmtRp(r.total_dibayar)}</span> },
  { key: 'tanggalBayar', label: 'Tanggal Pembayaran', render: (r) => (latestPaymentDate(r) ? fmtDate(latestPaymentDate(r)) : <span className="text-slate-400">-</span>) },
  { key: 'pembayaran', label: 'Pembayaran', render: (r) => paymentBadge(r.payment_status) },
  { key: 'status', label: 'Status', render: (r) => receiveBadge(r) },
];

export const getReturColumns = (onSelectDoc) => [
  { key: 'noRetur', label: 'No. Retur', render: nomorButton(onSelectDoc) },
  { key: 'noPembelian', label: 'No. Pembelian', render: (r) => <span className="font-mono text-slate-500">{r.retur_ref_nomor || '-'}</span> },
  { key: 'returDate', label: 'Retur Date', render: (r) => fmtDate(r.tanggal) },
  { key: 'supplier', label: 'Supplier', render: (r) => <span className="font-semibold text-slate-700">{r.supplier || '-'}</span> },
  { key: 'totalRetur', label: 'Total Retur', render: (r) => <span className="font-bold text-slate-800">{fmtRp(r.total)}</span> },
  {
    key: 'status',
    label: 'Status',
    render: (r) => {
      const map = {
        draft: ['Tunda', 'bg-orange-50 text-orange-600 border-orange-100'],
        selesai: ['Selesai', 'bg-emerald-50 text-emerald-600 border-emerald-100'],
        batal: ['Batal', 'bg-rose-50 text-rose-600 border-rose-100'],
      };
      const [label, cls] = map[r.status] || map.draft;
      return <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${cls}`}>{label}</span>;
    },
  },
];

export const getCancelColumns = (onSelectDoc) => [
  { key: 'no', label: 'No. Pembelian', render: nomorButton(onSelectDoc) },
  { key: 'tanggal', label: 'Tanggal Beli', render: (r) => fmtDate(r.tanggal) },
  { key: 'supplier', label: 'Supplier', render: (r) => <span className="font-semibold text-slate-700">{r.supplier || '-'}</span> },
  { key: 'jumlah', label: 'Jumlah', render: (r) => <span className="font-bold text-slate-800">{fmtRp(r.total)}</span> },
  { key: 'telahBayar', label: 'Telah Bayar', render: (r) => <span className="text-slate-500">{fmtRp(r.total_dibayar)}</span> },
  { key: 'terakhir', label: 'Terakhir Diperbarui', render: (r) => fmtDate(r.updated_at) },
];
