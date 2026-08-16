import { formatOrderReference } from './orderReference';
import { getReturnInfo, statusMap } from './penjualanHelpers';

export default function getPenjualanColumns({
  activeTab,
  setSelectedOrderId,
  setView,
  setPayOrder,
  setPayAmount,
}) {
  return [
    {
      key: 'no',
      label: 'No. Pesanan',
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelectedOrderId(row.id);
            setView(activeTab === 'pengembalian' ? 'return-detail' : 'detail');
          }}
          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
        >
          {formatOrderReference(row, activeTab)}
        </button>
      ),
    },
    {
      key: 'tanggal',
      label: activeTab === 'pengembalian' ? 'Tanggal Pengembalian' : 'Tanggal Jual',
      render: (row) => {
        const dStr = activeTab === 'pengembalian'
          ? (getReturnInfo(row)?.tanggal || row.waktu)
          : row.waktu;
        const date = new Date(dStr);
        return Number.isNaN(date.getTime())
          ? dStr
          : date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      },
    },
    { key: 'jatuhTempo', label: 'Jatuh Tempo', render: (row) => <span className="text-slate-500">{row.jatuh_tempo || '-'}</span> },
    { key: 'pelanggan', label: 'Pelanggan', render: (row) => <span className="font-semibold text-slate-700">{row.nama}</span> },
    { key: 'kodePelanggan', label: 'Kode Pelanggan', render: (row) => <span className="font-mono text-slate-400">{row.kode_pelanggan || '-'}</span> },
    { key: 'tujuan', label: 'Tujuan Pengiriman', render: (row) => <span className="truncate max-w-[150px] block text-slate-500" title={row.alamat_pelanggan}>{row.alamat_pelanggan || '-'}</span> },
    { key: 'total', label: 'Total', render: (row) => <span className="font-bold text-slate-800">Rp {row.total_harga?.toLocaleString('id-ID')}</span> },
    { key: 'sisa', label: 'Sisa Pembayaran', render: (row) => <span className={`font-bold ${row.sisa_tagihan > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Rp {row.sisa_tagihan?.toLocaleString('id-ID')}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        if (activeTab === 'pengembalian') {
          const returnStatusMap = {
            Draft: { label: 'Draft', cls: 'bg-slate-50 text-slate-500 border-slate-100' },
            Tunda: { label: 'Tunda', cls: 'bg-orange-50 text-orange-600 border-orange-100' },
            Dikonfirmasi: { label: 'Dikonfirmasi', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
            Batal: { label: 'Batal', cls: 'bg-rose-50 text-rose-600 border-rose-100' },
          };
          const state = getReturnInfo(row)?.status || 'Tunda';
          const item = returnStatusMap[state] || { label: state, cls: 'bg-slate-50 text-slate-500 border-slate-100' };
          return <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${item.cls}`}>{item.label}</span>;
        }
        const item = statusMap[row.status_global] || { label: row.status_global, cls: 'bg-slate-50 text-slate-500' };
        return <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${item.cls}`}>{item.label}</span>;
      },
    },
    {
      key: 'telahBayar',
      label: 'Telah Bayar',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Rp {row.dp_dibayar?.toLocaleString('id-ID')}</span>
          {row.sisa_tagihan > 0 && (
            <button
              type="button"
              onClick={() => { setPayOrder(row); setPayAmount(String(row.sisa_tagihan)); }}
              className="px-2.5 py-1 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100/70 rounded-lg cursor-pointer transition-colors"
            >
              Bayar
            </button>
          )}
        </div>
      ),
    },
  ];
}
