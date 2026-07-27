import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, FileSpreadsheet, Receipt, X } from 'lucide-react';
import TransactionScaffold, { TButton } from '../components/TransactionScaffold';
import CreateOrderForm from '../components/CreateOrderForm';
import ReturnOrderForm from '../components/ReturnOrderForm';
import ImportStatusModal from '../components/ImportStatusModal';
import OrderDetail from '../components/OrderDetail';
import ReturnOrderDetail from '../components/ReturnOrderDetail';
import apiClient from '../../../api/apiClient';

const getReturnInfo = (rowOrNotes) => {
  if (!rowOrNotes) return null;
  if (typeof rowOrNotes === 'object') {
    if (rowOrNotes.pengembalian_aktif) {
      return {
        id: rowOrNotes.pengembalian_aktif.id,
        tanggal: rowOrNotes.pengembalian_aktif.tanggal_pengembalian,
        status: rowOrNotes.pengembalian_aktif.status || 'Tunda',
        catatan: rowOrNotes.pengembalian_aktif.catatan,
        nominal_refund: rowOrNotes.pengembalian_aktif.nominal_refund,
      };
    }
    return getReturnInfo(rowOrNotes.catatan_pelanggan);
  }

  const match = String(rowOrNotes).match(
    /\[PENGEMBALIAN - Tanggal:\s*([^\s,]*),\s*Status:\s*([^,]*),\s*Catatan:\s*([^\]]*)\]/
  ) || String(rowOrNotes).match(
    /\[PENGEMBALIAN - Tanggal:\s*([^\s,]+),\s*Catatan:\s*([^\]]*)\]/
  );
  
  if (match) {
    if (match.length === 4) {
      return {
        tanggal: match[1],
        status: match[2] || 'Tunda',
        catatan: match[3],
      };
    }
    return {
      tanggal: match[1],
      status: 'Tunda',
      catatan: match[2],
    };
  }
  return null;
};

const hasActiveReturn = (row) => !!getReturnInfo(row);

const tabs = [
  {
    id: 'butuh-diproses',
    label: 'Butuh Diproses',
    title: 'Pesanan Butuh Diproses',
    unit: 'Pesanan',
    emptyTitle: 'Belum ada penjualan yang butuh di proses.',
    emptyDesc: 'Pemesanan produk oleh outlet-outletmu akan muncul di sini.',
    match: (row) => row.status_global !== 'selesai' && row.status_global !== 'batal' && !hasActiveReturn(row),
  },
  {
    id: 'selesai',
    label: 'Selesai',
    title: 'Pesanan Selesai',
    heading: 'Telah Diproses',
    unit: 'Pesanan',
    variant: 'table',
    match: (row) => row.status_global === 'selesai' && !hasActiveReturn(row),
  },
  {
    id: 'pengembalian',
    label: 'Pengembalian',
    title: 'Pengembalian Penjualan',
    heading: 'Pengembalian Pesanan',
    unit: 'Pesanan',
    variant: 'table',
    match: (row) => hasActiveReturn(row),
  },
  {
    id: 'dibatalkan',
    label: 'Dibatalkan',
    title: 'Pesanan Dibatalkan',
    unit: 'Pesanan',
    variant: 'table',
    match: (row) => row.status_global === 'batal' && !hasActiveReturn(row),
  },
];

const statusMap = {
  review: { label: 'Tunda', cls: 'bg-orange-50 text-orange-600 border-orange-100' },
  desain: { label: 'Dikonfirmasi', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
  proses: { label: 'Dikirim', cls: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  ready: { label: 'Terkirim', cls: 'bg-amber-50 text-amber-600 border-amber-100' },
  selesai: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  batal: { label: 'Batal', cls: 'bg-rose-50 text-rose-600 border-rose-100' },
};

export default function Penjualan() {
  const location = useLocation();
  const [view, setView] = useState('list');
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || location.state?.tab || 'butuh-diproses';
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Bayar Modal State
  const [payOrder, setPayOrder] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('tunai');

  const fetchOrders = useCallback(async (query = searchQuery) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/orders/?search=${encodeURIComponent(query)}`);
      setOrders(res.data || []);
    } catch (err) {
      console.error('Gagal mengambil data pesanan:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchOrders(searchQuery);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, activeTab, fetchOrders]);

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payAmount || parseInt(payAmount) <= 0) return alert('Jumlah pembayaran tidak valid.');
    try {
      await apiClient.post(`/orders/${payOrder.id}/bayar/`, {
        jumlah_bayar: parseInt(payAmount),
        metode_pembayaran: payMethod,
      });
      setPayOrder(null);
      setPayAmount('');
      fetchOrders();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memproses pembayaran.');
    }
  };

  const columns = [
    { 
      key: 'no', 
      label: 'No. Pesanan', 
      render: (r) => {
        if (activeTab === 'pengembalian') {
          const returnId = `SR${new Date(r.waktu).getFullYear().toString().slice(-2)}${String(
            new Date(r.waktu).getMonth() + 1
          ).padStart(2, '0')}${String(new Date(r.waktu).getDate()).padStart(2, '0')}0000000${r.id}`;
          return (
            <button
              type="button"
              onClick={() => {
                setSelectedOrderId(r.id);
                setView('return-detail');
              }}
              className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            >
              {returnId}
            </button>
          );
        }
        return (
          <button
            type="button"
            onClick={() => {
              setSelectedOrderId(r.id);
              setView('detail');
            }}
            className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          >
            ORD-{r.id}
          </button>
        );
      }
    },
    { 
      key: 'tanggal', 
      label: activeTab === 'pengembalian' ? 'Tanggal Pengembalian' : 'Tanggal Jual', 
      render: (r) => {
        if (activeTab === 'pengembalian') {
          const info = getReturnInfo(r.catatan_pelanggan);
          const dStr = info?.tanggal || r.waktu;
          try {
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return dStr;
            return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
          } catch {
            return dStr;
          }
        }
        return new Date(r.waktu).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
      }
    },
    { key: 'jatuhTempo', label: 'Jatuh Tempo', render: (r) => <span className="text-slate-500">{r.jatuh_tempo || '-'}</span> },
    { key: 'pelanggan', label: 'Pelanggan', render: (r) => <span className="font-semibold text-slate-700">{r.nama}</span> },
    { key: 'kodePelanggan', label: 'Kode Pelanggan', render: (r) => <span className="font-mono text-slate-400">{r.nomor_wa || '-'}</span> },
    { key: 'tujuan', label: 'Tujuan Pengiriman', render: (r) => <span className="truncate max-w-[150px] block text-slate-500" title={r.catatan_pelanggan}>{r.catatan_pelanggan || '-'}</span> },
    { key: 'total', label: 'Total', render: (r) => <span className="font-bold text-slate-800">Rp {r.total_harga?.toLocaleString('id-ID')}</span> },
    { key: 'sisa', label: 'Sisa Pembayaran', render: (r) => <span className={`font-bold ${r.sisa_tagihan > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Rp {r.sisa_tagihan?.toLocaleString('id-ID')}</span> },
    {
      key: 'status',
      label: 'Status',
      render: (r) => {
        if (activeTab === 'pengembalian') {
          const info = getReturnInfo(r.catatan_pelanggan);
          const st = info?.status || 'Tunda';
          const returnStatusMap = {
            'Draft': { label: 'Draft', cls: 'bg-slate-50 text-slate-500 border-slate-100' },
            'Tunda': { label: 'Tunda', cls: 'bg-orange-50 text-orange-600 border-orange-100' },
            'Dikonfirmasi': { label: 'Dikonfirmasi', cls: 'bg-blue-50 text-blue-600 border-blue-100' },
            'Batal': { label: 'Batal', cls: 'bg-rose-50 text-rose-600 border-rose-100' },
          };
          const item = returnStatusMap[st] || { label: st, cls: 'bg-slate-50 text-slate-500 border-slate-100' };
          return <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${item.cls}`}>{item.label}</span>;
        }
        const item = statusMap[r.status_global] || { label: r.status_global, cls: 'bg-slate-50 text-slate-500' };
        return <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${item.cls}`}>{item.label}</span>;
      },
    },
    {
      key: 'telahBayar',
      label: 'Telah Bayar',
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Rp {r.dp_dibayar?.toLocaleString('id-ID')}</span>
          {r.sisa_tagihan > 0 && (
            <button
              type="button"
              onClick={() => { setPayOrder(r); setPayAmount(String(r.sisa_tagihan)); }}
              className="px-2.5 py-1 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100/70 rounded-lg cursor-pointer transition-colors"
            >
              Bayar
            </button>
          )}
        </div>
      ),
    },
  ];

  const actions =
    activeTab === 'butuh-diproses' ? (
      <>
        <TButton variant="secondary" onClick={() => setShowImport(true)}>
          <FileSpreadsheet size={16} /> Perbarui Status (CSV)
        </TButton>
        <TButton variant="primary" onClick={() => setView('create')}>
          <Plus size={16} /> Tambah
        </TButton>
      </>
    ) : activeTab === 'pengembalian' ? (
      <TButton variant="primary" onClick={() => setView('create')}>
        <Plus size={16} /> Tambah
      </TButton>
    ) : null;

  return (
    <>
      <TransactionScaffold
        tabs={tabs}
        columns={columns}
        rows={orders}
        statusOptions={['Semua', 'Tunda', 'Dikonfirmasi', 'Dikirim', 'Terkirim', 'Selesai', 'Batal']}
        searchPlaceholder="Cari Pesanan"
        emptyIcon={Receipt}
        actions={actions}
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onTabChange={(id) => {
          setActiveTab(id);
          setView('list');
        }}
      >
        {view === 'detail' ? (
          <OrderDetail
            orderId={selectedOrderId}
            onBack={() => setView('list')}
            onSaved={fetchOrders}
          />
        ) : view === 'return-detail' ? (
          <ReturnOrderDetail
            orderId={selectedOrderId}
            onBack={() => setView('list')}
            onSaved={fetchOrders}
          />
        ) : view === 'create' ? (
          activeTab === 'pengembalian' ? (
            <ReturnOrderForm
              onCancel={() => setView('list')}
              onSave={async (data) => {
                try {
                  await apiClient.post(`/orders/${data.orderId}/retur/`, {
                    tanggal_pengembalian: data.tanggal,
                    catatan: data.catatan,
                    nominal_refund: data.nominal_refund,
                  });
                  alert('Pengembalian pesanan berhasil disimpan.');
                  setView('list');
                  fetchOrders();
                } catch (err) {
                  const errMsg = err?.response?.data?.error || 'Gagal menyimpan pengembalian pesanan.';
                  alert(errMsg);
                }
              }}
            />
          ) : (
            <CreateOrderForm onCancel={() => setView('list')} onSave={() => { setView('list'); fetchOrders(); }} />
          )
        ) : null}
      </TransactionScaffold>

      {showImport && <ImportStatusModal onClose={() => setShowImport(false)} onSuccess={(msg) => { alert(msg); fetchOrders(); }} />}

      {/* Bayar Modal */}
      {payOrder && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">Catat Pembayaran ORD-{payOrder.id}</span>
              <button type="button" onClick={() => setPayOrder(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X size={18} /></button>
            </div>
            <form onSubmit={handlePaySubmit} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Jumlah Bayar</label>
                <input
                  type="number"
                  max={payOrder.sisa_tagihan}
                  min="1"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Maksimal pelunasan: Rp {payOrder.sisa_tagihan?.toLocaleString('id-ID')}</span>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">Metode Pembayaran</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 cursor-pointer"
                >
                  <option value="tunai">Tunai</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="qris">QRIS / E-Wallet</option>
                </select>
              </div>
              <button type="submit" className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm">Simpan Pembayaran</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
