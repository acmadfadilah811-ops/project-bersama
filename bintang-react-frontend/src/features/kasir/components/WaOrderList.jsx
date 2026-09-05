import { MessageCircle, Clock, Phone, CheckCircle, Search, X, Calendar, Globe2 } from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val);

/** Panel kiri Antrean Online & Offline: daftar pesanan + filter tanggal +
 * pencarian (nama, nomor WA, ID pesanan, catatan, atau nama item) + halaman
 * server sungguhan — dipisah dari WaOrderQueue.jsx supaya file utama tidak
 * makin melebihi limit baris. Dipakai untuk 2 antrean (props judul/subjudul/
 * pesanKosong), lihat WaOrderQueue.jsx prop `sumber`.
 *
 * Filter/pencarian/pagination SEMUA server-side sekarang (props terkontrol
 * dari WaOrderQueue.jsx) -- volume order advertising bisa ~100/hari, dulu
 * pencarian client-side saja & tanpa halaman jadi makin lambat seiring
 * waktu (kelas masalah sama dengan fetch-all katalog produk yang diperbaiki
 * sebelumnya). "Cari Semua" mengabaikan rentang tanggal (fitur 2026-09-06). */
export default function WaOrderList({
  orders, loading, selectedOrder, onSelectOrder, onRefresh,
  judul = 'Pesanan WhatsApp Otomatis',
  subjudul = 'Semua pesanan WA, diperbarui otomatis',
  judulKosong = 'Belum Ada Pesanan WhatsApp',
  pesanKosong = 'Pesanan yang dibuat otomatis dari WhatsApp akan muncul di sini.',
  searchQuery, onSearchChange,
  dateFrom, dateTo, onDateFromChange, onDateToChange,
  cariSemua, onToggleCariSemua,
  page = 1, pageSize = 20, totalCount = 0, onPageChange, onPageSizeChange,
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="w-full lg:w-[380px] border-r border-slate-200 bg-white flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
            <MessageCircle size={18} />
          </div>
          <div>
            <h5 className="font-extrabold text-slate-800 text-sm">{judul}</h5>
            <p className="text-[10px] text-slate-500 font-semibold">{subjudul}</p>
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari nama, nomor WA, atau ID pesanan..."
            className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter tanggal + Cari Semua */}
      <div className="px-3 pt-2.5 flex items-center gap-1.5">
        <div className={`flex items-center gap-1 flex-1 min-w-0 ${cariSemua ? 'opacity-40 pointer-events-none' : ''}`}>
          <Calendar size={12} className="text-slate-400 shrink-0" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full min-w-0 border border-slate-200 rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <span className="text-slate-300 text-[10px]">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full min-w-0 border border-slate-200 rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
        <button
          type="button"
          onClick={() => onToggleCariSemua(!cariSemua)}
          title="Cari semua tanggal (abaikan filter tanggal)"
          className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all ${
            cariSemua ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Globe2 size={11} /> Semua
        </button>
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
              {searchQuery ? <Search size={24} /> : <CheckCircle size={24} />}
            </div>
            <p className="text-xs text-slate-500 font-bold">
              {searchQuery ? 'Tidak Ada Hasil' : judulKosong}
            </p>
            <p className="text-[10px] text-slate-400 max-w-[200px] mt-0.5">
              {searchQuery ? `Tidak ada pesanan yang cocok dengan pencarian "${searchQuery}".` : pesanKosong}
            </p>
          </div>
        ) : (
          orders.map((order) => {
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

                {order.sumber === 'staff' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-black tracking-wider uppercase">
                      Order via Offline
                    </span>
                    {order.dilayani_oleh_nama && (
                      <span className="text-[9px] text-slate-500 font-bold truncate">
                        Pelayan: {order.dilayani_oleh_nama}
                      </span>
                    )}
                  </div>
                )}

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

      {/* Paginasi */}
      {!loading && totalCount > 0 && (
        <div className="px-3 py-2.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>{totalCount} pesanan</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none cursor-pointer text-slate-700"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2 py-1 cursor-pointer"
            >
              &lt;
            </button>
            <span>{page}/{totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-2 py-1 cursor-pointer"
            >
              &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
