import { MessageCircle, Clock, Phone, CheckCircle, Search, X, Calendar, Globe2 } from 'lucide-react';

const formatCurrency = (val) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(val);

/** Daftar Antrean Online & Offline — grid kartu full layar (redesign
 * 2026-09-07, mengikuti pola "Antrean Global Divisi" di Papan Kerja Staff:
 * ClaimPool.jsx). Sebelumnya sidebar sempit 380px dengan detail selalu
 * tampil di sebelah kanan; sekarang kasir lihat grid kartu penuh dulu, klik
 * satu kartu baru masuk ke layar detail penuh (lihat WaOrderQueue.jsx yang
 * menoggle list ini vs panel detail, sama seperti ProductionApp.jsx
 * menoggle ClaimPool vs WorkspaceSPK).
 *
 * Filter/pencarian/pagination semua server-side (props terkontrol dari
 * WaOrderQueue.jsx) -- volume order advertising bisa ~100/hari. */
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
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header + Filter Bar */}
      <div className="p-4 border-b border-slate-200 bg-white shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
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

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
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

          <div className={`flex items-center gap-1 shrink-0 ${cariSemua ? 'opacity-40 pointer-events-none' : ''}`}>
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => onDateFromChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-1.5 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <span className="text-slate-300 text-[10px]">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-1.5 py-1.5 text-[10px] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <button
            type="button"
            onClick={() => onToggleCariSemua(!cariSemua)}
            title="Cari semua tanggal (abaikan filter tanggal)"
            className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all ${
              cariSemua ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Globe2 size={11} /> Semua
          </button>
        </div>
      </div>

      {/* Grid Kartu */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-dashed border-slate-200 rounded-2xl">
            <div className="bg-slate-50 p-3 rounded-full text-slate-400 mb-2">
              {searchQuery ? <Search size={24} /> : <CheckCircle size={24} />}
            </div>
            <p className="text-xs text-slate-500 font-bold">
              {searchQuery ? 'Tidak Ada Hasil' : judulKosong}
            </p>
            <p className="text-[10px] text-slate-400 max-w-[240px] mt-0.5">
              {searchQuery ? `Tidak ada pesanan yang cocok dengan pencarian "${searchQuery}".` : pesanKosong}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
            {orders.map((order) => {
              const itemsText = order.items?.map(i => `${i.jenis_produk} (x${i.qty})`).join(', ') || 'Tanpa detail item';
              const isSelected = selectedOrder?.id === order.id;
              return (
                <button
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className={`text-left border rounded-lg transition-all cursor-pointer flex flex-col gap-1 bg-white shadow-2xs hover:shadow-md p-2 ${
                    isSelected
                      ? 'border-indigo-300 ring-2 ring-indigo-500/10'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex justify-between items-start w-full gap-1">
                    <span className="font-extrabold text-slate-800 text-[11px] truncate">{order.nama}</span>
                    <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-black tracking-wider uppercase shrink-0">
                      {order.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1 py-0.5 rounded font-black tracking-wider uppercase">
                      {order.status_global}
                    </span>
                    {order.sumber === 'staff' && (
                      <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded font-black tracking-wider uppercase">
                        Offline
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[9.5px] text-slate-400 font-semibold">
                    <Phone size={9} className="shrink-0" />
                    <span className="truncate">{order.nomor_wa}</span>
                  </div>

                  <p className="text-[9.5px] text-slate-500 font-medium line-clamp-1 italic" title={itemsText}>
                    "{itemsText}"
                  </p>

                  <div className="flex justify-between items-center mt-0.5 pt-1 border-t border-slate-100 w-full text-[9.5px] font-bold">
                    <span className="text-slate-400 flex items-center gap-0.5">
                      <Clock size={9} />
                      {new Date(order.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-indigo-600 truncate">
                      {formatCurrency(order.total_harga || 0)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginasi */}
      {!loading && totalCount > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>{totalCount} pesanan</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none cursor-pointer text-slate-700"
            >
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={80}>80</option>
              <option value={150}>150</option>
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
