import { useState } from 'react';
import { MessageCircle, Clock, Phone, CheckCircle, Search, X } from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val);

/** Panel kiri Antrean WA: daftar pesanan + pencarian pesan/order (nama,
 * nomor WA, ID pesanan, catatan, atau nama item) — dipisah dari
 * WaOrderQueue.jsx supaya file utama tidak makin melebihi limit baris. */
export default function WaOrderList({ orders, loading, selectedOrder, onSelectOrder, onRefresh }) {
  const [searchQuery, setSearchQuery] = useState('');

  const query = searchQuery.trim().toLowerCase();
  const filteredOrders = !query
    ? orders
    : orders.filter((order) => {
        const itemsText = (order.items || []).map((i) => i.jenis_produk).join(' ').toLowerCase();
        return (
          (order.nama || '').toLowerCase().includes(query) ||
          (order.nomor_wa || '').toLowerCase().includes(query) ||
          String(order.id || '').toLowerCase().includes(query) ||
          (order.catatan_pelanggan || '').toLowerCase().includes(query) ||
          itemsText.includes(query)
        );
      });

  return (
    <div className="w-full lg:w-[380px] border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
            <MessageCircle size={18} />
          </div>
          <div>
            <h5 className="font-extrabold text-slate-800 text-sm">Pesanan WhatsApp Otomatis</h5>
            <p className="text-[10px] text-slate-500 font-semibold">Semua pesanan WA, diperbarui otomatis</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="text-[10px] bg-white border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {/* Pencarian pesan/order */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, nomor WA, ID pesanan, atau item..."
            className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* List of cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
            <div className="bg-white p-3 rounded-full text-slate-400 mb-2">
              <CheckCircle size={24} />
            </div>
            <p className="text-xs text-slate-500 font-bold">Belum Ada Pesanan WhatsApp</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">Pesanan yang dibuat otomatis dari WhatsApp akan muncul di sini.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
            <div className="bg-white p-3 rounded-full text-slate-400 mb-2">
              <Search size={24} />
            </div>
            <p className="text-xs text-slate-500 font-bold">Tidak Ada Hasil</p>
            <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">Tidak ada pesanan yang cocok dengan pencarian "{searchQuery}".</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const itemsText = order.items?.map(i => `${i.jenis_produk} (x${i.qty})`).join(', ') || 'Tanpa detail item';
            const isSelected = selectedOrder?.id === order.id;
            return (
              <button
                key={order.id}
                onClick={() => onSelectOrder(order)}
                className={`w-full p-3 text-left border rounded-xl transition-all cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/10'
                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <span className="font-extrabold text-slate-800 text-xs truncate max-w-[200px]">{order.nama}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                      {order.status_global}
                    </span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                      {order.id}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                  <Phone size={10} />
                  <span>{order.nomor_wa}</span>
                </div>

                <p className="text-[10px] text-slate-500 font-medium line-clamp-1 italic">
                  "{itemsText}"
                </p>

                <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100 w-full text-[10px] font-bold">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(order.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-indigo-600">
                    {formatCurrency(order.total_harga || 0)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
