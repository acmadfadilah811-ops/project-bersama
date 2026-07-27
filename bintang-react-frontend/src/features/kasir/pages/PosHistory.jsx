import { useState, useEffect } from 'react';
import { Search, Calendar, Eye, Trash2, ShieldAlert, CheckCircle, AlertTriangle, Printer, X } from 'lucide-react';
import apiClient from '../../../api/apiClient';

export default function PosHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Date filter (default to 'today')
  const [dateFilter, setDateFilter] = useState('today');

  // Selected sale for receipt preview / void modal
  const [selectedSale, setSelectedSale] = useState(null);
  const [voiding, setVoiding] = useState(false);

  // Aturan cetak dari Pengaturan POS (Ext Settings).
  const [aturanCetak, setAturanCetak] = useState({ blokirCetakUlang: false, blokirCetakPengecekan: false });
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/pos/sales/pos-rules/');
        setAturanCetak({
          blokirCetakUlang: !!res.data?.blokir_cetak_ulang,
          blokirCetakPengecekan: !!res.data?.blokir_cetak_pengecekan,
        });
      } catch (err) {
        console.error('Gagal memuat aturan cetak:', err);
      }
    })();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      
      const res = await apiClient.get('/pos/sales/', { params });
      let data = res.data || [];

      // Client side date filtering
      const todayStr = new Date().toDateString();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      data = data.filter(item => {
        const itemDate = new Date(item.created_at);
        const dateStr = itemDate.toDateString();

        // Search term matching
        const matchSearch =
          item.nomor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.pelanggan_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.kasir_name || '').toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchSearch) return false;

        if (dateFilter === 'today') {
          return dateStr === todayStr;
        } else if (dateFilter === 'yesterday') {
          return dateStr === yesterdayStr;
        } else if (dateFilter === 'week') {
          return itemDate >= sevenDaysAgo;
        }
        return true; // 'all'
      });

      setSales(data);
    } catch (err) {
      console.error('Error fetching sales history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [statusFilter, dateFilter, searchTerm]);

  const handleVoidTransaction = async (saleId) => {
    if (!window.confirm('Batalkan (void) transaksi ini? Stok barang akan dikembalikan dan status nota berubah menjadi Void secara permanen.')) {
      return;
    }
    setVoiding(true);
    try {
      await apiClient.post(`/pos/sales/${saleId}/void/`);
      alert('Transaksi berhasil dibatalkan. Status nota kini Void dan stok telah dikembalikan.');
      setSelectedSale(null);
      fetchSales();
    } catch (err) {
      console.error('Error voiding sale:', err);
      alert('Gagal membatalkan transaksi: ' + (err.response?.data?.error || err.message));
    } finally {
      setVoiding(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h4 className="font-extrabold text-slate-800 text-lg">Riwayat Transaksi POS</h4>
          <p className="text-xs text-slate-500 font-semibold">Tinjau, cetak ulang nota, atau lakukan pembatalan (void) transaksi kasir.</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm mb-6 shrink-0">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Cari No. Transaksi, Pelanggan, Kasir..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Date Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'yesterday', label: 'Kemarin' },
              { id: 'week', label: '7 Hari Terakhir' },
              { id: 'all', label: 'Semua' },
            ].map(d => (
              <button
                key={d.id}
                onClick={() => setDateFilter(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateFilter === d.id
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <span className="text-xs font-bold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="paid">Paid (Lunas)</option>
            <option value="void">Void (Dibatalkan)</option>
            <option value="hold">Hold (Ditahan)</option>
          </select>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
        {loading ? (
          <div className="m-auto flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="m-auto text-center py-16 flex flex-col items-center">
            <div className="bg-slate-50 p-4 rounded-full text-slate-400 mb-2">
              <Calendar size={32} />
            </div>
            <h5 className="font-extrabold text-slate-700 text-sm">Tidak Ada Transaksi</h5>
            <p className="text-xs text-slate-400 font-semibold max-w-xs mt-1">Gunakan kombinasi pencarian atau filter tanggal yang berbeda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                  <th className="px-6 py-3">No. Transaksi</th>
                  <th className="px-6 py-3">Tanggal & Waktu</th>
                  <th className="px-6 py-3">Pelanggan</th>
                  <th className="px-6 py-3">Kasir</th>
                  <th className="px-6 py-3 text-right">Total Belanja</th>
                  <th className="px-6 py-3">Metode Bayar</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-extrabold text-indigo-600">{sale.nomor}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(sale.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4">{sale.pelanggan_name || <span className="text-slate-400 font-normal">Umum</span>}</td>
                    <td className="px-6 py-4 font-bold">{sale.kasir_name}</td>
                    <td className="px-6 py-4 text-right font-black text-slate-900">{formatCurrency(sale.total)}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 uppercase">
                        {sale.metode_bayar}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        sale.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-600'
                          : sale.status === 'void'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {sale.status === 'paid' ? 'Paid' : sale.status === 'void' ? 'Void' : 'Hold'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
                        title="Lihat Detail / Nota"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail & Receipt Preview Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-sm w-full p-6 relative flex flex-col shadow-2xl">
            <button
              onClick={() => setSelectedSale(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={16} />
            </button>
            
            <div className="flex flex-col items-center text-center pb-4 border-b border-dashed border-slate-200">
              <h5 className="font-extrabold text-slate-800 text-base">Bintang Advertising</h5>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Nota Penjualan Kasir</p>
              <span className="text-[9px] text-slate-400 font-semibold block mt-1">No: {selectedSale.nomor}</span>
              <span className="text-[9px] text-slate-400 font-semibold block">
                {new Date(selectedSale.created_at).toLocaleString('id-ID')}
              </span>
            </div>

            {/* Receipt Items */}
            <div className="py-4 space-y-2 max-h-48 overflow-y-auto text-xs font-semibold text-slate-700">
              {selectedSale.items?.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="min-w-0 pr-2">
                    <p className="truncate font-bold">{item.nama_snapshot}</p>
                    <span className="text-[10px] text-slate-400 font-semibold block">
                      {parseFloat(item.qty)} x {formatCurrency(item.harga_snapshot)}
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-3 border-t border-dashed border-slate-200 text-xs font-semibold text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedSale.subtotal)}</span>
              </div>
              {parseFloat(selectedSale.diskon) > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Diskon</span>
                  <span>-{formatCurrency(selectedSale.diskon)}</span>
                </div>
              )}
              {parseFloat(selectedSale.pajak) > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span>{formatCurrency(selectedSale.pajak)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-slate-900 pt-1">
                <span>Total</span>
                <span>{formatCurrency(selectedSale.total)}</span>
              </div>
              <div className="h-px bg-slate-100 my-1" />
              <div className="flex justify-between text-[10px]">
                <span>Metode Pembayaran</span>
                <span className="font-bold">{selectedSale.metode_bayar}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Dibayar</span>
                <span>{formatCurrency(selectedSale.dibayar)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-emerald-600 font-bold">
                <span>Kembalian</span>
                <span>{formatCurrency(selectedSale.kembalian)}</span>
              </div>
            </div>

            {/* Status Alert if Void */}
            {selectedSale.status === 'void' && (
              <div className="mt-4 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-extrabold">
                <ShieldAlert size={14} className="shrink-0" />
                <span>Transaksi ini telah dibatalkan (Void).</span>
              </div>
            )}

            <div className="mt-5 flex gap-2">
              {/* Void Button - Only if status is paid */}
              {selectedSale.status === 'paid' && (
                <button
                  onClick={() => handleVoidTransaction(selectedSale.id)}
                  disabled={voiding}
                  className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer border border-rose-200 disabled:opacity-50"
                >
                  <TrashAlert size={12} />
                  <span>{voiding ? 'Voiding...' : 'Void (Batal)'}</span>
                </button>
              )}
              {/* Cetak nota — dibatasi setelan Pengaturan POS:
                  - "Non-aktifkan Cetak Ulang" memblokir nota yang sudah dibayar
                  - "Non-aktifkan Cetak untuk pengecekan" memblokir nota belum dibayar (hold) */}
              {(() => {
                const terblokir =
                  (selectedSale.status === 'paid' && aturanCetak.blokirCetakUlang) ||
                  (selectedSale.status === 'hold' && aturanCetak.blokirCetakPengecekan);
                return (
                  <button
                    onClick={() => window.print()}
                    disabled={terblokir}
                    title={terblokir ? 'Cetak nota dinonaktifkan di Pengaturan POS' : 'Cetak nota'}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Printer size={12} />
                    <span>{terblokir ? 'Cetak Dinonaktifkan' : 'Cetak Nota'}</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple warning/void icon helper
function TrashAlert() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  );
}
