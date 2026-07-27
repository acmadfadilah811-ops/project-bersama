import { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Search,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { useTransaksiCrumb } from './TransaksiContext';
import Dropdown from './Dropdown';
import DateRangePicker from './DateRangePicker';
import Pagination from './Pagination';

export { Dropdown, DateRangePicker, Pagination };

/** Tabel data dengan header ber-sort + baris "No Data" saat kosong. */
function DataTableView({ columns, rows, colWidths = {}, onMouseDownResize }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
      <table className="w-full text-xs border-collapse min-w-[960px]">
        <thead>
          <tr className="bg-slate-50/70 border-b border-slate-200">
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ width: colWidths[c.key] ? `${colWidths[c.key]}px` : undefined }}
                className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0 relative group"
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {c.sortable !== false && (
                    <ChevronsUpDown size={13} className="text-slate-400" />
                  )}
                </span>
                {/* Resize divider */}
                <div
                  onMouseDown={(e) => onMouseDownResize && onMouseDownResize(e, c.key)}
                  className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize select-none z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center text-slate-400">
                No Data
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id || i} className="border-b border-slate-100 hover:bg-slate-50/60">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    style={{ width: colWidths[c.key] ? `${colWidths[c.key]}px` : undefined }}
                    className="px-4 py-3 text-slate-700 whitespace-nowrap border-r border-slate-100 last:border-r-0"
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Empty state: ilustrasi + judul + deskripsi, di dalam kotak abu lembut. */
function EmptyState({ icon: Icon, art, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6">
      {art ? (
        <div className="mb-4">{art}</div>
      ) : (
        <div className="w-32 h-32 rounded-full bg-sky-50 flex items-center justify-center mb-4">
          {Icon && <Icon size={52} strokeWidth={1.5} className="text-sky-300" />}
        </div>
      )}
      <h3 className="text-slate-600 font-semibold max-w-xs leading-relaxed">{title}</h3>
      {description && <p className="text-slate-400 text-sm mt-1.5 max-w-sm">{description}</p>}
    </div>
  );
}

/** Tombol aksi seragam untuk header halaman transaksi. */
export function TButton({ children, variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg px-4 py-2 transition-colors cursor-pointer focus:outline-none';
  const styles =
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
      : variant === 'success'
        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
        : variant === 'danger'
          ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

/**
 * Kerangka halaman transaksi (panel full-screen, flush tanpa gap).
 *
 * Setiap tab: { id, label, title, heading?, unit, variant?, emptyTitle, emptyDesc, match }.
 * - variant 'empty' (default): toolbar status + ilustrasi empty (mis. "Butuh Diproses").
 * - variant 'table': toolbar baris/halaman + tabel "No Data" + pagination (mis. "Selesai").
 * `children` mengganti area konten (mode form) tanpa menghilangkan tab.
 */
export default function TransactionScaffold({
  tabs,
  actions,
  statusOptions = [],
  searchPlaceholder = 'Cari',
  emptyIcon,
  emptyArt,
  columns = [],
  rows = [],
  children,
  onTabChange,
  search: searchProp,
  onSearchChange,
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id);
  const [internalSearch, setInternalSearch] = useState('');
  const isSearchControlled = searchProp !== undefined;
  const search = isSearchControlled ? searchProp : internalSearch;
  const setSearch = isSearchControlled ? onSearchChange : setInternalSearch;

  const [colWidths, setColWidths] = useState({});

  const handleMouseDown = (e, colKey) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || e.currentTarget.parentElement.getBoundingClientRect().width;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + deltaX);
      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState('20 Baris');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', start: null, end: null });
  const [currentPage, setCurrentPage] = useState(1);
  const { setSubtitle } = useTransaksiCrumb();

  const current = tabs.find((t) => t.id === activeTab) || tabs[0];
  const variant = current?.variant || 'empty';
  const cols = current?.columns || columns;
  const dateKey = current?.dateKey || 'tanggal';
  const statusOpts = current?.statusOptions || statusOptions;
  const paymentOptions = current?.paymentOptions;
  const rowsTop = !!current?.rowsTop;

  useEffect(() => {
    if (!children) setSubtitle(current?.title || '');
  }, [current?.title, children, setSubtitle]);

  // Reset pagination page on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, status, payment, dateFilter, rowsPerPage, activeTab]);

  const inDateRange = (r) => {
    if (dateFilter.preset === 'all' || !dateFilter.start || !dateFilter.end) return true;
    const raw = r[dateKey];
    if (!raw) return true;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return true;
    const s = new Date(dateFilter.start);
    s.setHours(0, 0, 0, 0);
    const e = new Date(dateFilter.end);
    e.setHours(23, 59, 59, 999);
    return d >= s && d <= e;
  };

  const matchesSearch = (r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();

    // 1. Match IDs (Raw, ORD-, OLYYMMDD..., SRYYMMDD...)
    const dateVal = r.waktu || r.tanggal || r.returDate || new Date();
    const date = new Date(dateVal);
    const yy = isNaN(date.getTime()) ? '' : String(date.getFullYear()).slice(-2);
    const mm = isNaN(date.getTime()) ? '' : String(date.getMonth() + 1).padStart(2, '0');
    const dd = isNaN(date.getTime()) ? '' : String(date.getDate()).padStart(2, '0');
    const paddedId = String(r.id || '').padStart(7, '0');

    const rawId = String(r.id || r.no || r.noPembelian || r.noRetur || '').toLowerCase();
    const ordId = `ord-${r.id}`.toLowerCase();
    const olId = yy ? `ol${yy}${mm}${dd}${paddedId}`.toLowerCase() : '';
    const srId = yy ? `sr${yy}${mm}${dd}${paddedId}`.toLowerCase() : '';

    const idMatch =
      rawId.includes(q) ||
      ordId.includes(q) ||
      (olId && olId.includes(q)) ||
      (srId && srId.includes(q));

    // 2. Match Contacts
    const nameMatch = String(r.nama || r.pelanggan || r.supplier || '').toLowerCase().includes(q);
    const waMatch = String(r.nomor_wa || r.telpon || '').toLowerCase().includes(q);

    // 3. Match Notes / Destination Address
    const notesMatch = String(r.catatan_pelanggan || r.catatan || r.tujuan || r.tujuan_pengiriman || '').toLowerCase().includes(q);

    // 4. Match Status (both DB codes and display labels)
    const sMap = {
      review: 'tunda',
      desain: 'dikonfirmasi',
      proses: 'dikirim',
      ready: 'terkirim',
      selesai: 'selesai',
      batal: 'batal'
    };
    const statusDb = String(r.status_global || r.status || '').toLowerCase();
    const statusLabel = sMap[statusDb] || statusDb;
    const statusMatch = statusDb.includes(q) || statusLabel.includes(q);

    return idMatch || nameMatch || waMatch || notesMatch || statusMatch;
  };

  const matchesStatus = (r) => {
    if (!status || status === 'Semua') return true;
    const sMap = {
      'Tunda': 'review',
      'Dikonfirmasi': 'desain',
      'Dikirim': 'proses',
      'Terkirim': 'ready',
      'Selesai': 'selesai',
      'Batal': 'batal'
    };
    const targetStatus = sMap[status] || status.toLowerCase();
    const currentStatus = String(r.status_global || r.status || '').toLowerCase();
    return currentStatus === targetStatus;
  };

  const filteredRows = rows.filter(
    (r) => 
      (!current?.match || current.match(r)) && 
      inDateRange(r) && 
      matchesSearch(r) && 
      matchesStatus(r)
  );

  const limit = parseInt(rowsPerPage) || 20;
  const totalPages = Math.ceil(filteredRows.length / limit) || 1;
  const startIndex = (currentPage - 1) * limit;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + limit);

  const handleTab = (id) => {
    setActiveTab(id);
    onTabChange?.(id);
  };

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 shrink-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-semibold whitespace-nowrap text-center transition-colors cursor-pointer ${
                isActive
                  ? 'text-blue-600 bg-blue-50/70'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/40'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {children ? (
        <div className="flex-1 bg-[#F4F7FE]">{children}</div>
      ) : (
        <div className="flex flex-col flex-1">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 shrink-0">
            <div>
              <h2 className="text-slate-800 font-bold text-[15px]">
                {current?.heading || current?.title}
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {filteredRows.length} {current?.unit || 'Data'}
              </p>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>

          {/* Toolbar */}
          {paymentOptions ? (
            <div className="flex items-center gap-3 px-6 py-4 shrink-0">
              <Dropdown
                options={statusOpts}
                value={status}
                onChange={setStatus}
                placeholder="Status"
                minW="min-w-[130px]"
              />
              <Dropdown
                options={paymentOptions}
                value={payment}
                onChange={setPayment}
                placeholder="Pembayaran"
                minW="min-w-[150px]"
              />
              <label className="flex-1 flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="bg-transparent outline-none w-full placeholder:text-slate-400"
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-3 items-center gap-3 px-6 py-4 shrink-0">
              <div className="justify-self-start">
                {rowsTop ? (
                  <Dropdown
                    options={['10 Baris', '20 Baris', '50 Baris', '100 Baris']}
                    value={rowsPerPage}
                    onChange={setRowsPerPage}
                    minW="min-w-[140px]"
                  />
                ) : (
                  <Dropdown
                    options={statusOpts}
                    value={status}
                    onChange={setStatus}
                    placeholder="Status order"
                  />
                )}
              </div>

              <div className="justify-self-center">
                <DateRangePicker value={dateFilter} onChange={setDateFilter} />
              </div>

              <label className="justify-self-end w-full max-w-[260px] flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="bg-transparent outline-none w-full placeholder:text-slate-400"
                />
              </label>
            </div>
          )}

          {/* Body */}
          {variant === 'table' ? (
            <div className="px-6 pb-6 flex flex-col h-full min-h-0 justify-between">
              <div className="overflow-auto flex-1">
                <DataTableView
                  columns={cols}
                  rows={paginatedRows}
                  colWidths={colWidths}
                  onMouseDownResize={handleMouseDown}
                />
              </div>
              <Pagination
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={setRowsPerPage}
                showRows={!rowsTop}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          ) : (
            <div className="flex-1 px-6 pb-6 min-h-0 flex flex-col justify-between h-full">
              <div className="h-full rounded-xl bg-slate-50/50 border border-slate-100 flex flex-col items-center justify-center overflow-hidden">
                {paginatedRows.length === 0 ? (
                  <EmptyState
                     icon={emptyIcon}
                     art={emptyArt}
                     title={current?.emptyTitle}
                     description={current?.emptyDesc}
                  />
                ) : (
                  <div className="w-full self-stretch flex flex-col justify-between h-full">
                    <div className="overflow-auto flex-1 bg-white">
                      <table className="w-full text-xs border-collapse min-w-[960px]">
                        <thead>
                          <tr className="bg-white text-slate-500 text-left border-b border-slate-100">
                            {cols.map((c) => (
                              <th
                                key={c.key}
                                style={{ width: colWidths[c.key] ? `${colWidths[c.key]}px` : undefined }}
                                className="px-4 py-3 font-semibold whitespace-nowrap relative group"
                              >
                                {c.label}
                                {/* Resize divider */}
                                <div
                                  onMouseDown={(e) => handleMouseDown(e, c.key)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 hover:bg-blue-400 active:bg-blue-500 cursor-col-resize select-none z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {paginatedRows.map((row, i) => (
                            <tr key={row.id || i} className="hover:bg-slate-50/60">
                              {cols.map((c) => (
                                <td
                                  key={c.key}
                                  style={{ width: colWidths[c.key] ? `${colWidths[c.key]}px` : undefined }}
                                  className="px-4 py-3 text-slate-700 whitespace-nowrap"
                                >
                                  {c.render ? c.render(row) : row[c.key]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 border-t border-slate-100 bg-white">
                      <Pagination
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={setRowsPerPage}
                        showRows={true}
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
