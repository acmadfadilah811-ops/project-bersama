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
import { formatOrderReference, normalizeOrderSearch } from '../components/orderReference';
import getPenjualanColumns from '../components/penjualanColumns';
import { hasActiveReturn } from '../components/penjualanHelpers';

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

export default function Penjualan({ initialTab = 'butuh-diproses' }) {
  const location = useLocation();
  const [view, setView] = useState(() => location.state?.openOrderId ? 'detail' : 'list');
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || location.state?.tab || initialTab;
  });
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(() => location.state?.openOrderId || null);
  const [searchQuery, setSearchQuery] = useState('');

  // Bayar Modal State
  const [payOrder, setPayOrder] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('tunai');

  const fetchOrders = useCallback(async (query = searchQuery) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/orders/?search=${encodeURIComponent(normalizeOrderSearch(query))}`);
      const rows = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      setOrders(rows);
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

  useEffect(() => {
    if (location.state?.openOrderId) {
      setActiveTab(location.state.tab || 'butuh-diproses');
      setSelectedOrderId(location.state.openOrderId);
      setView('detail');
    }
  }, [location.state]);

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

  const columns = getPenjualanColumns({
    activeTab,
    setSelectedOrderId,
    setView,
    setPayOrder,
    setPayAmount,
  });

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
            <CreateOrderForm
              onCancel={() => setView('list')}
              onSave={(createdOrder) => {
                if (createdOrder?.id) {
                  setSelectedOrderId(createdOrder.id);
                  setView('detail');
                } else {
                  setView('list');
                }
                fetchOrders();
              }}
            />
          )
        ) : null}
      </TransactionScaffold>

      {showImport && <ImportStatusModal onClose={() => setShowImport(false)} onSuccess={(msg) => { alert(msg); fetchOrders(); }} />}

      {/* Bayar Modal */}
      {payOrder && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-100">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
              <span className="text-sm font-bold text-slate-800">Catat Pembayaran {formatOrderReference(payOrder, payOrder.status_global)}</span>
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
