import { useMemo, useState, useEffect, useRef, useCallback, Fragment } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  ArrowLeft,
  FileText,
  FileSpreadsheet,
  ChevronsUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Info,
  ClipboardList,
  X,
} from 'lucide-react';
import { Dropdown, DateRangePicker } from '../../../transaksi/components/TransactionScaffold';
import { PRODUK_REPORTS } from './reportList';
import apiClient from '../../../../api/apiClient';

/** Format nilai baris sesuai `type` kolom yang dikirim backend. */
/** 'total_penjualan' -> 'Total Penjualan' (label ringkasan turunan). */
const humanizeKey = (key) =>
  String(key)
    .replace(/_/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatValue = (val, type) => {
  if (val === null || val === undefined || val === '') return type === 'money' || type === 'qty' ? 0 : '';
  if (type === 'money') return `Rp ${Number(val || 0).toLocaleString('id-ID')}`;
  if (type === 'qty') return Number(val || 0).toLocaleString('id-ID');
  if (type === 'date') {
    const d = new Date(val);
    return isNaN(d.getTime())
      ? val
      : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return val;
};

// Pesan error fetch laporan yang manusiawi — bedakan rate-limit (429) dari
// kegagalan umum agar pengguna tahu harus menunggu, bukan mengira data rusak.
const pesanErrorLaporan = (err) => {
  if (err?.response?.status === 429) {
    return 'Terlalu banyak permintaan laporan dalam waktu singkat. Tunggu sebentar lalu coba lagi.';
  }
  return err?.response?.data?.error || 'Gagal memuat data laporan.';
};

const formatRows = (rows, typeByKey) =>
  (rows || []).map((r) => {
    const out = {};
    Object.keys(r).forEach((k) => {
      out[k] = formatValue(r[k], typeByKey[k]);
    });
    return out;
  });

/** Ubah Date -> 'YYYY-MM-DD' pada zona waktu lokal. */
const toISODateLocal = (d) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

/**
 * Panel kiri "Daftar Laporan" — bisa disembunyikan.
 * Header "Daftar Laporan" berfungsi sebagai tombol toggle: saat hover muncul
 * overlay "Klik untuk sembunyikan" (meniru perilaku Olsera).
 */
function DaftarLaporanPanel({ reports, activeId, onSelect, onCollapse }) {
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    const terms = keyword.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return reports;
    // Cocok bila SEMUA kata kunci ada di label (urutan bebas).
    return reports.filter((r) => {
      const label = r.label.toLowerCase();
      return terms.every((t) => label.includes(t));
    });
  }, [keyword, reports]);

  return (
    <div className="w-72 shrink-0 border-r border-slate-200 flex flex-col bg-white">
      {/* Header toggle + tooltip hover */}
      <button
        type="button"
        onClick={onCollapse}
        title="Klik untuk sembunyikan"
        className="group relative flex items-center px-4 py-3 border-b border-slate-100 select-none cursor-pointer text-left"
      >
        <span className="text-[15px] font-bold text-slate-800">Daftar Laporan</span>
        {/* Overlay "Klik untuk sembunyikan" */}
        <span className="absolute inset-0 flex items-center justify-center bg-slate-800/85 text-white text-sm font-semibold rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          Klik untuk sembunyikan
        </span>
      </button>

      {/* Search keyword */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 focus-within:border-blue-400 transition-colors">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Ketikan keyword"
            className="w-full text-[13px] bg-transparent outline-none text-slate-700 placeholder-slate-400"
          />
          {keyword && (
            <button
              type="button"
              onClick={() => setKeyword('')}
              title="Bersihkan"
              className="shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Daftar item */}
      <div className="flex-1 overflow-y-auto pb-4">
        {filtered.map((r) => {
          const isActive = r.id === activeId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={`w-full text-left px-4 py-2 text-[13px] leading-snug transition-colors cursor-pointer ${
                isActive
                  ? 'bg-sky-50 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-slate-400">
            Tidak ada laporan yang cocok.
          </p>
        )}
      </div>
    </div>
  );
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];
const fmtSingle = (d) =>
  `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
const toInputDate = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};
// Format untuk <input type="datetime-local">: YYYY-MM-DDTHH:mm
const toInputDateTime = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
};

/** Pemilih tanggal tunggal dengan navigasi mundur/maju per hari. */
function SingleDatePicker({ value, onChange }) {
  const shift = (dir) => {
    const d = new Date(value);
    d.setDate(d.getDate() + dir);
    onChange(d);
  };
  return (
    <div className="flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 text-[13px] text-slate-600 bg-white">
      <button
        type="button"
        onClick={() => shift(-1)}
        className="p-1 hover:bg-slate-50 rounded text-slate-400 cursor-pointer"
      >
        <ChevronLeft size={16} />
      </button>
      <label className="relative flex items-center gap-1.5 px-2 whitespace-nowrap cursor-pointer hover:text-slate-800">
        <Calendar size={15} /> {fmtSingle(value)}
        <input
          type="date"
          value={toInputDate(value)}
          onChange={(e) => e.target.value && onChange(new Date(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      <button
        type="button"
        onClick={() => shift(1)}
        className="p-1 hover:bg-slate-50 rounded text-slate-400 cursor-pointer"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

/** Dropdown statis — abu/non-aktif (default) atau putih/aktif (disabled=false). */
function GhostSelect({ label, disabled = true }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 min-w-[140px] text-[13px] select-none ${
        disabled
          ? 'text-slate-400 bg-slate-50 cursor-not-allowed'
          : 'text-slate-600 bg-white cursor-pointer hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      <ChevronDown size={14} className="text-slate-400" />
    </div>
  );
}

/** Tombol "Group" + popover filter (pilih/kecualikan grup produk). */
function GroupFilter() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const grupBox = (
    <div className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 bg-white cursor-pointer select-none">
      <span>Pilih Grup</span>
      <ChevronDown size={14} className="text-slate-400" />
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 bg-white cursor-pointer hover:bg-slate-50 select-none"
      >
        <span>Group: 0 terpilih, 0 dikecualikan</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-72 bg-white rounded-lg border border-slate-200 shadow-lg p-4 space-y-3 animate-fade-in">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Produk grup dipilih
            </label>
            {grupBox}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Produk grup dikecualikan
            </label>
            {grupBox}
          </div>
          <button
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg px-4 py-2 cursor-pointer transition-colors"
          >
            Filter
          </button>
        </div>
      )}
    </div>
  );
}

const alignCls = (a) =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

/**
 * Tabel laporan generik: header (opsional sortable) + body.
 * Dipakai untuk tabel utama maupun tabel "Ringkasan".
 * - `title`   : label di atas header (mis. "Ringkasan").
 * - `groups`  : header bertingkat (mis. "Harga beli" > "Harga lama"/"Harga Baru").
 * - `rows`    : array data ({ [column.key]: value }); kosong = empty-state.
 * - `sort`/`onToggleSort` : aktifkan sorting bila diberikan.
 * - `emptyText`: teks empty-state; `null` = baris kosong polos.
 */
function ReportTable({
  columns = [],
  groups,
  title,
  rows = [],
  sort,
  onToggleSort,
  paginated = false,
  emptyText = 'No Data',
}) {
  // Kolom daun: dari grup (jika ada) atau langsung dari `columns`.
  // Default [] agar tabel tidak pernah crash bila pemanggil lupa mengirim kolom.
  const leaf = groups
    ? groups.flatMap((g) => (g.children ? g.children : [{ key: g.key, label: g.label }]))
    : (columns || []);

  const [pageSize, setPageSize] = useState('50/page');
  const [widths, setWidths] = useState({}); // index kolom -> lebar (px)
  const dragRef = useRef(null);

  const onResizing = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const w = Math.max(60, d.startWidth + (e.clientX - d.startX));
    setWidths((prev) => ({ ...prev, [d.index]: w }));
  }, []);

  const onResizeEnd = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('mousemove', onResizing);
    window.removeEventListener('mouseup', onResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onResizing]);

  const onResizeStart = useCallback(
    (e, index, th) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        index,
        startX: e.clientX,
        startWidth: th ? th.getBoundingClientRect().width : 160,
      };
      window.addEventListener('mousemove', onResizing);
      window.addEventListener('mouseup', onResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [onResizing, onResizeEnd]
  );

  // Lepas listener bila komponen di-unmount saat masih men-drag.
  useEffect(() => onResizeEnd, [onResizeEnd]);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {title && (
        <div className="px-3 py-2.5 text-[13px] font-semibold text-slate-600 bg-slate-50 border-b border-slate-200">
          {title}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <colgroup>
            {leaf.map((c, i) => (
              <col key={c.key} style={widths[i] ? { width: `${widths[i]}px` } : undefined} />
            ))}
          </colgroup>
          <thead>
            {groups ? (
              <>
                <tr className="bg-slate-50/70 border-y border-slate-200">
                  {groups.map((g) =>
                    g.children ? (
                      <th
                        key={g.label}
                        colSpan={g.children.length}
                        className="px-3 py-2 text-center text-[13px] font-semibold text-slate-600 whitespace-nowrap border-r border-b border-slate-200 last:border-r-0"
                      >
                        {g.label}
                      </th>
                    ) : (
                      <th
                        key={g.key}
                        rowSpan={2}
                        className="px-3 py-2 text-left align-middle text-[13px] font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0"
                      >
                        {g.label}
                      </th>
                    )
                  )}
                </tr>
                <tr className="bg-slate-50/70 border-b border-slate-200">
                  {groups.flatMap((g) =>
                    g.children
                      ? g.children.map((c) => (
                          <th
                            key={c.key}
                            className="px-3 py-2 text-left text-[13px] font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0"
                          >
                            {c.label}
                          </th>
                        ))
                      : []
                  )}
                </tr>
              </>
            ) : (
              <tr className="bg-slate-50/70 border-y border-slate-200">
                {leaf.map((c, i) => {
                  const sortable = c.sortable && onToggleSort;
                  const active = sort?.key === c.key;
                  const isLast = i === leaf.length - 1;
                  return (
                    <th
                      key={c.key}
                      onClick={() => sortable && onToggleSort(c.key)}
                      className={`relative px-3 py-2 text-left text-[13px] font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0 ${
                        sortable ? 'cursor-pointer hover:text-slate-800 select-none' : ''
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {sortable && (
                          <ChevronsUpDown
                            size={13}
                            className={active ? 'text-sky-600' : 'text-slate-300'}
                          />
                        )}
                      </span>
                      {/* Pegangan resize: tarik untuk mengatur lebar kolom. */}
                      {!isLast && (
                        <span
                          onMouseDown={(e) => onResizeStart(e, i, e.currentTarget.parentElement)}
                          onClick={(e) => e.stopPropagation()}
                          title="Tarik untuk mengatur lebar kolom"
                          className="absolute top-0 right-0 h-full w-1.5 translate-x-1/2 z-10 cursor-col-resize select-none hover:bg-sky-400/60"
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row, ri) => (
                <tr
                  key={row.id ?? ri}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                >
                  {leaf.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 text-[13px] text-slate-600 whitespace-nowrap border-r border-slate-200 last:border-r-0 ${alignCls(
                        c.align
                      )}`}
                    >
                      {row[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                {emptyText ? (
                  <td
                    colSpan={leaf.length}
                    className="px-3 py-10 text-center text-[13px] text-slate-400 italic"
                  >
                    {emptyText}
                  </td>
                ) : (
                  <td colSpan={leaf.length} className="px-3 py-4">
                    &nbsp;
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paginated && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-200">
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value)}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-700 bg-white outline-none focus:border-blue-400 cursor-pointer"
          >
            <option value="50/page">50/page</option>
            <option value="100/page">100/page</option>
          </select>
          <button
            type="button"
            disabled
            className="p-1.5 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="px-3 py-1 rounded-md bg-blue-600 text-white text-[13px] font-semibold cursor-pointer"
          >
            1
          </button>
          <button
            type="button"
            disabled
            className="p-1.5 rounded-md border border-slate-200 text-slate-300 cursor-not-allowed"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Laporan laba-rugi terstruktur (A. Pendapatan … G. Laba Bersih).
 * `sections`: [{ code, title, total?, empty?, items: [{ label, value }] }]
 */
function LabaRugiTable({ sections }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white text-[13px]">
      {sections.map((sec) => (
        <div key={sec.code}>
          <div className="flex items-center justify-between px-4 py-2.5 font-semibold text-slate-700 border-b border-slate-200">
            <span>
              {sec.code}. {sec.title}
            </span>
            {sec.total != null && <span>{sec.total}</span>}
          </div>
          {sec.empty ? (
            <div className="px-4 py-6 text-center text-slate-400 border-b border-slate-200">
              No Data
            </div>
          ) : (
            sec.items.map((it) => (
              <div key={it.label} className="grid grid-cols-2 border-b border-slate-100 text-slate-600">
                <div className="px-4 py-2.5 pl-7">{it.label}</div>
                <div className="px-4 py-2.5 border-l border-slate-200">{it.value}</div>
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Satu baris accordion. Bila item punya `dataSource`, datanya diambil dari
 * backend (lazy — hanya saat dibuka) dan mengganti konten statis (fallback).
 * Item Laba/Rugi memakai `labaRugi` (statis atau live) → LabaRugiTable.
 */
function AccordionItem({ item, queryString }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    loading: false, error: '', columns: null, rows: null, summary: null, labaRugi: null,
  });
  const expandable = !!item.summary || !!item.labaRugi || !!item.dataSource;

  useEffect(() => {
    if (!open || !item.dataSource) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    apiClient
      .get(`/reports/${item.dataSource}/?${queryString}`)
      .then((res) => {
        if (cancelled) return;
        setState({
          loading: false, error: '',
          columns: res.data.columns || [],
          rows: res.data.rows || [],
          summary: res.data.summary || null,
          labaRugi: res.data.labaRugi || null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: pesanErrorLaporan(err) }));
      });
    return () => { cancelled = true; };
  }, [open, item.dataSource, queryString]);

  const typeByKey = useMemo(() => {
    const m = {};
    (state.columns || []).forEach((c) => { m[c.key] = c.type; });
    return m;
  }, [state.columns]);

  const liveRows = useMemo(
    () => (state.rows ? formatRows(state.rows, typeByKey) : null),
    [state.rows, typeByKey],
  );

  const sections = state.labaRugi || item.labaRugi;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-[13px] text-slate-700 hover:bg-slate-50 cursor-pointer text-left"
      >
        <span>{item.label}</span>
        {expandable ? (
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        ) : (
          <ChevronRight size={16} className="text-slate-400" />
        )}
      </button>
      {expandable && open && (
        <div className="px-4 pb-4">
          {state.loading ? (
            <div className="py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
            </div>
          ) : state.error ? (
            <div className="py-6 text-center text-xs text-rose-500 font-semibold">{state.error}</div>
          ) : sections ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 italic">
                Dihitung dari transaksi penjualan (Order & POS) — bisa berbeda dari Laba Rugi di menu Akuntansi
                yang dihitung dari jurnal terposting. Keduanya sengaja terpisah untuk tujuan berbeda.
              </p>
              <LabaRugiTable sections={sections} />
            </div>
          ) : (
            <ReportTable
              columns={item.dataSource ? (state.columns || item.summary?.columns) : item.summary?.columns}
              title={item.summary?.title}
              rows={item.dataSource ? (liveRows || []) : (item.summary?.rows || [])}
              emptyText="No Data"
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Daftar accordion untuk laporan tipe `linkList` (mis. Laporan Keseluruhan
 * Penjualan). Setiap sub-item mengambil datanya sendiri dari backend saat
 * dibuka (bila punya `dataSource`); `queryString` membawa filter tanggal.
 */
function AccordionList({ items, queryString }) {
  const norm = items.map((it) => (typeof it === 'string' ? { label: it } : it));
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {norm.map((it) => (
        <AccordionItem key={it.label} item={it} queryString={queryString} />
      ))}
    </div>
  );
}

/** Panel kanan — toolbar + tabel hasil laporan terpilih. */
function LaporanDetail({ report, collapsed, onExpand }) {
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return { preset: 'today', start: d, end: d };
  });
  const [singleDate, setSingleDate] = useState(() => new Date());
  const [dtEnd, setDtEnd] = useState(() => toInputDateTime(new Date()));
  const [dtStart, setDtStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toInputDateTime(d);
  });
  const [paket, setPaket] = useState('Non Paket');
  const [selectVal, setSelectVal] = useState('');
  const [sortByVal, setSortByVal] = useState('');
  const [extraVals, setExtraVals] = useState({}); // nilai dropdown extraSelects per label
  const [filterSel, setFilterSel] = useState(''); // dropdown band filter kedua
  const [filterQuery, setFilterQuery] = useState(''); // search band filter kedua
  const [cari, setCari] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });
  const rootRef = useRef(null);
  const tableScrollRef = useRef(null);

  // Saat laporan berganti, kembalikan tampilan ke atas agar kolom/tabel langsung
  // terlihat: reset gulir area tabel sekaligus bawa panel ke puncak viewport.
  useEffect(() => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
    // Gulir mentok ke paling atas (semua kontainer yang bisa di-scroll + window)
    // agar judul laporan langsung terlihat.
    let el = rootRef.current?.parentElement;
    while (el) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
      el = el.parentElement;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Catatan: panel detail di-remount lewat key={report.id} di induk, jadi semua
    // state toolbar (Select, Sort By, Cari, tanggal) otomatis kembali default.
  }, [report.id]);

  // Mode tanggal: 'range' (default), 'single' (satu hari + navigasi), atau 'none'.
  const dateMode = report.dateMode || 'range';

  // --- Data dari backend (hanya bila definisi laporan punya `dataSource`) ---
  const [fetched, setFetched] = useState({ rows: [], summary: null, columns: [], labaRugi: null });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (dateMode === 'range' && dateFilter?.preset !== 'all' && dateFilter?.start && dateFilter?.end) {
      p.append('start', toISODateLocal(dateFilter.start));
      p.append('end', toISODateLocal(dateFilter.end));
    } else if (dateMode === 'single') {
      p.append('start', toISODateLocal(singleDate));
      p.append('end', toISODateLocal(singleDate));
    } else if (dateMode === 'datetime') {
      if (dtStart) p.append('start', dtStart.slice(0, 10));
      if (dtEnd) p.append('end', dtEnd.slice(0, 10));
    }
    if (cari.trim()) p.append('search', cari.trim());
    if (sortByVal || selectVal) p.append('sort', sortByVal || selectVal);
    Object.entries(extraVals).forEach(([k, v]) => { if (v) p.append(k, v); });
    return p.toString();
  }, [dateMode, dateFilter, singleDate, dtStart, dtEnd, cari, sortByVal, selectVal, extraVals]);

  useEffect(() => {
    if (!report.dataSource || report.unavailable) return undefined;
    let cancelled = false;
    setLoading(true);
    setFetchError('');
    // Debounce supaya mengetik di kotak "Cari" tidak membanjiri server.
    const t = setTimeout(async () => {
      try {
        const res = await apiClient.get(`/reports/${report.dataSource}/?${queryString}`);
        if (!cancelled) {
          setFetched({
            rows: res.data.rows || [],
            summary: res.data.summary || null,
            columns: res.data.columns || [],
            labaRugi: res.data.labaRugi || null,
          });
        }
      } catch (err) {
        if (!cancelled) setFetchError(pesanErrorLaporan(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [report.dataSource, report.unavailable, queryString]);

  const typeByKey = useMemo(() => {
    const m = {};
    (fetched.columns || []).forEach((c) => { m[c.key] = c.type; });
    return m;
  }, [fetched.columns]);

  const liveRows = useMemo(() => formatRows(fetched.rows, typeByKey), [fetched.rows, typeByKey]);
  const effectiveRows = report.dataSource ? liveRows : report.rows;

  const effectiveSummary = useMemo(() => {
    if (!report.dataSource || !fetched.summary) return report.summary;
    const s = fetched.summary;
    if (s.items) {
      return {
        ...(report.summary || {}),
        type: 'list',
        items: s.items.map((it) => ({ label: it.label, value: formatValue(it.value, it.type || 'money') })),
      };
    }
    if (s.rows) {
      const rows = formatRows(s.rows, typeByKey);
      // Bila definisi laporan sudah mendeklarasikan kolom ringkasan, pakai itu.
      if (report.summary?.columns?.length) {
        return { ...report.summary, rows };
      }
      // Kalau belum, turunkan kolom dari key baris ringkasan supaya ringkasan
      // tetap tampil (dan tidak merender tabel tanpa kolom yang bikin crash).
      const contoh = s.rows[0] || {};
      const columns = Object.keys(contoh).map((k) => ({
        key: k,
        label: humanizeKey(k),
        align: typeof contoh[k] === 'number' ? 'right' : 'left',
      }));
      if (!columns.length) return null;
      return { title: 'Ringkasan', columns, rows };
    }
    return report.summary;
  }, [report.dataSource, report.summary, fetched.summary, typeByKey]);

  const exportToExcelClient = (report, dataRows) => {
    const wb = XLSX.utils.book_new();
    let aoa = [
      ['BINTANG ADVERTISING - LAPORAN SYSTEM'],
      ['Jenis Laporan:', report.label || 'Laporan'],
      ['Tanggal Export:', new Date().toLocaleDateString('id-ID')],
      []
    ];
    let colWidths = [];

    if (report.labaRugi || report.linkList?.some((i) => i.labaRugi)) {
      aoa.push(['Kode', 'Deskripsi / Kategori', 'Jumlah / Total']);
      const sections = report.labaRugi || (report.linkList?.find((i) => i.labaRugi)?.labaRugi) || [];
      sections.forEach((sec) => {
        aoa.push([sec.code || '', `${sec.code ? sec.code + '. ' : ''}${sec.title}`, sec.total != null ? sec.total : '']);
        if (sec.items && sec.items.length > 0) {
          sec.items.forEach((it) => {
            aoa.push(['', `   ${it.label}`, it.value || '0,00']);
          });
        }
        aoa.push([]); // baris kosong antar seksi
      });
      // Atur lebar kolom yang presisi agar teks tidak terpotong / tumpang tindih
      colWidths = [{ wch: 10 }, { wch: 48 }, { wch: 25 }];
    } else {
      const cols = report.columns || (report.groups ? report.groups.flatMap((g) => g.children || [{ key: g.key, label: g.label }]) : []);
      if (cols.length > 0) {
        aoa.push(cols.map((c) => c.label));
        const rowsToUse = dataRows && dataRows.length > 0 ? dataRows : [];
        if (rowsToUse.length > 0) {
          rowsToUse.forEach((row) => {
            aoa.push(cols.map((c) => row[c.key] ?? ''));
          });
        } else {
          // Baris sampel / placeholder agar pengguna tetap bisa melihat struktur & format kolom Excel
          aoa.push(cols.map((c) => '(Belum Ada Data)'));
        }
        colWidths = cols.map((col) => {
          let maxLen = (col.label || '').toString().length;
          (rowsToUse || []).forEach((row) => {
            const val = (row[col.key] || '').toString();
            if (val.length > maxLen) maxLen = val.length;
          });
          return { wch: Math.max(20, maxLen + 6) };
        });
      } else if (report.linkList) {
        aoa.push(['Daftar Laporan']);
        report.linkList.forEach((it) => {
          aoa.push([typeof it === 'string' ? it : it.label]);
        });
        colWidths = [{ wch: 45 }];
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (colWidths.length > 0) {
      ws['!cols'] = colWidths;
    }
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
    const sanitizedName = (report.label || 'Laporan').replace(/[/\\?%*:|"<>]/g, '_');
    XLSX.writeFile(wb, `${sanitizedName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPdfClient = (report, dataRows) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Gagal membuka jendela cetak. Silakan periksa izin pop-up browser Anda.');
      return;
    }

    let tableHtml;

    if (report.labaRugi || report.linkList?.some((i) => i.labaRugi)) {
      const sections = report.labaRugi || (report.linkList?.find((i) => i.labaRugi)?.labaRugi) || [];
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 10%;">Kode</th>
              <th style="width: 60%;">Deskripsi / Kategori</th>
              <th style="width: 30%; text-align: right;">Jumlah / Total</th>
            </tr>
          </thead>
          <tbody>
            ${sections
              .map(
                (sec) => `
              <tr class="sec-header">
                <td>${sec.code || ''}</td>
                <td>${sec.code ? sec.code + '. ' : ''}${sec.title}</td>
                <td class="text-right">${sec.total != null ? sec.total : ''}</td>
              </tr>
              ${(sec.items || [])
                .map(
                  (it) => `
                <tr>
                  <td></td>
                  <td style="padding-left: 28px; color: #475569;">${it.label}</td>
                  <td class="text-right">${it.value || '0,00'}</td>
                </tr>
              `
                )
                .join('')}
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    } else {
      const cols = report.columns || (report.groups ? report.groups.flatMap((g) => g.children || [{ key: g.key, label: g.label }]) : []);
      const rowsToUse = dataRows && dataRows.length > 0 ? dataRows : [];

      tableHtml = `
        <table>
          <thead>
            <tr>
              ${cols.map((c) => `<th style="${c.align === 'right' ? 'text-align: right;' : ''}">${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${
              rowsToUse.length > 0
                ? rowsToUse
                    .map(
                      (r) => `
              <tr>
                ${cols.map((c) => `<td style="${c.align === 'right' ? 'text-align: right;' : ''}">${r[c.key] ?? ''}</td>`).join('')}
              </tr>
            `
                    )
                    .join('')
                : `
              <tr>
                <td colSpan="${cols.length || 1}" style="text-align: center; color: #94a3b8; font-style: italic; padding: 24px;">
                  (Belum Ada Data)
                </td>
              </tr>
            `
            }
          </tbody>
        </table>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${report.label}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; background: #fff; }
          .header { margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
          h1 { font-size: 20px; font-weight: 700; margin: 0 0 6px 0; color: #0f172a; }
          .sub { font-size: 13px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 600; text-align: left; padding: 9px 12px; border: 1px solid #cbd5e1; }
          td { padding: 8px 12px; border: 1px solid #e2e8f0; color: #334155; }
          tr.sec-header { background-color: #f8fafc; font-weight: 700; }
          .text-right { text-align: right; }
          @media print {
            @page { size: A4 portrait; margin: 12mm; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${report.label}</h1>
          <div class="sub">StarPhoto & Advertising | Tanggal Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>
        ${tableHtml}
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  };

  const doExport = async (fmt) => {
    if (report.dataSource) {
      try {
        const res = await apiClient.get(
          `/reports/${report.dataSource}/export/?format=${fmt}&${queryString}`,
          { responseType: 'blob' },
        );
        const mimeType = fmt === 'pdf' ? 'text/html' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([res.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        if (fmt === 'pdf') {
          window.open(url, '_blank');
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = `${report.dataSource}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        return;
      } catch (err) {
        console.warn('Export backend tidak tersedia/gagal, menggunakan client export:', err);
      }
    }

    // Fallback export di sisi client (browser) jika backend belum terhubung/belum ada data
    if (fmt === 'pdf') {
      exportToPdfClient(report, effectiveRows);
    } else {
      exportToExcelClient(report, effectiveRows);
    }
  };

  // Konfigurasi toolbar per laporan.
  // paket: undefined/true = dropdown "Non Paket" fungsional; 'select' = dropdown
  //   "Select" non-aktif (abu); false = sembunyikan.
  // cari: false = sembunyikan; 'left' = di kiri (urutan default); selain itu = kanan.
  const paketMode = report.toolbar?.paket;
  const cariMode = report.toolbar?.cari;
  const showCari = cariMode !== false;

  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const cariBox = (
    <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-2.5 py-1.5 min-w-[150px] focus-within:border-blue-400 transition-colors">
      <Search size={13} className="text-slate-400 shrink-0" />
      <input
        type="text"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder={report.toolbar?.cariPlaceholder || 'Cari'}
        className="w-full text-[13px] bg-transparent outline-none text-slate-700 placeholder-slate-400"
      />
    </div>
  );

  const ghostCtl =
    'flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-600 bg-white cursor-pointer hover:bg-slate-50 select-none';
  const outlineBtn =
    'flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors';
  const blueBtn =
    'flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 text-[13px] font-semibold cursor-pointer transition-colors';

  // Render satu kontrol toolbar berdasarkan token. Urutan default bisa ditimpa
  // lewat `toolbar.layout`, mis. ['paket', 'cari', 'date', 'export'].
  const renderControl = (token) => {
    switch (token) {
      case 'cari':
        return showCari ? <Fragment key="cari">{cariBox}</Fragment> : null;
      case 'date':
        if (dateMode === 'single')
          return <SingleDatePicker key="date" value={singleDate} onChange={setSingleDate} />;
        if (dateMode === 'range')
          return <DateRangePicker key="date" value={dateFilter} onChange={setDateFilter} />;
        return null;
      case 'paket':
        // undefined/true = dropdown "Non Paket" fungsional (default); false = sembunyikan.
        if (paketMode === false) return null;
        if (paketMode === 'select')
          // 'select' dengan selectOptions = dropdown fungsional (placeholder "Select");
          // tanpa opsi = dropdown abu non-aktif.
          // Default menampilkan placeholder "Select"; setelah dipilih, menampilkan
          // opsi Sort By yang dipilih.
          return report.toolbar?.selectOptions ? (
            <Dropdown
              key="paket"
              options={report.toolbar.selectOptions}
              value={selectVal || report.toolbar.selectDefault || ''}
              onChange={setSelectVal}
              placeholder="Select"
              minW="min-w-[200px]"
            />
          ) : (
            <GhostSelect key="paket" label="Select" />
          );
        return (
          <Dropdown
            key="paket"
            options={['Non Paket', '+Paket']}
            value={paket}
            onChange={setPaket}
            minW="min-w-[200px]"
          />
        );
      case 'extraSelects':
        // Item bisa: string (abu), { label, disabled }, atau { label, options }
        // (dropdown fungsional dengan placeholder = label).
        return report.toolbar?.extraSelects?.map((it) => {
          const label = typeof it === 'string' ? it : it.label;
          if (it && it.options)
            return (
              <Dropdown
                key={label}
                options={it.options}
                value={extraVals[label] || ''}
                onChange={(v) => setExtraVals((p) => ({ ...p, [label]: v }))}
                placeholder={label}
                minW="min-w-[160px]"
              />
            );
          const disabled = typeof it === 'string' ? true : it.disabled !== false;
          return <GhostSelect key={label} label={label} disabled={disabled} />;
        });
      case 'group':
        return report.toolbar?.groupFilter ? <GroupFilter key="group" /> : null;
      case 'sortBy': {
        const opts = report.toolbar?.sortByOptions;
        if (opts)
          return (
            <Dropdown
              key="sortBy"
              options={opts}
              value={sortByVal}
              onChange={setSortByVal}
              placeholder="Select"
              minW="min-w-[170px]"
            />
          );
        return report.toolbar?.sortBy ? (
          <div key="sortBy" className={ghostCtl}>
            <span>Sort By: {report.toolbar.sortBy}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </div>
        ) : null;
      }
      case 'sync':
        return report.toolbar?.sync ? (
          <button key="sync" type="button" className={blueBtn}>
            {typeof report.toolbar.sync === 'string' ? report.toolbar.sync : 'Sinkronkan'}
          </button>
        ) : null;
      case 'pdf':
        return report.toolbar?.pdf !== false ? (
          <button
            key="pdf"
            type="button"
            title="Cetak / simpan PDF"
            onClick={() => doExport('pdf')}
            className={outlineBtn}
          >
            <FileText size={15} className="text-rose-500" /> PDF
          </button>
        ) : null;
      case 'excel':
        return report.toolbar?.excel !== false ? (
          <button
            key="excel"
            type="button"
            title="Unduh Excel (.xlsx)"
            onClick={() => doExport('xlsx')}
            className={outlineBtn}
          >
            <FileSpreadsheet size={15} className="text-emerald-600" /> EXCEL
          </button>
        ) : null;
      case 'export':
        return report.toolbar?.exportButton ? (
          <button
            key="export"
            type="button"
            onClick={() => doExport('xlsx')}
            className={blueBtn}
          >
            <FileSpreadsheet size={15} /> Export
          </button>
        ) : null;
      default:
        return null;
    }
  };

  // Urutan default meniru tata letak sebelumnya; bisa ditimpa via toolbar.layout.
  const defaultLayout = [
    ...(cariMode === 'left' ? ['cari'] : []),
    'date',
    'paket',
    'extraSelects',
    'group',
    'sortBy',
    'sync',
    ...(showCari && cariMode !== 'left' ? ['cari'] : []),
    'pdf',
    'excel',
    'export',
  ];
  const layout = report.toolbar?.layout || defaultLayout;

  return (
    <div ref={rootRef} className="flex-1 min-w-0 flex flex-col">
      {/* Header judul + toolbar. Panel terbuka: judul di baris atas sendiri
          (basis-full), toolbar di bawah. Panel disembunyikan: satu baris. */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 border-b border-slate-100 bg-white">
        <div className={`flex items-center gap-2 min-w-0 ${collapsed ? '' : 'basis-full'}`}>
          {collapsed && (
            <button
              type="button"
              onClick={onExpand}
              title="Tampilkan daftar laporan"
              className="p-1 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 cursor-pointer shrink-0"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 className="text-sm font-bold text-slate-800 truncate">{report.label}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {layout.map((token) => renderControl(token))}
        </div>
      </div>

      {/* Band rentang tanggal+jam (mode 'datetime') — dua input + tombol Kirim. */}
      {report.dateMode === 'datetime' && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
          <input
            type="datetime-local"
            value={dtStart}
            onChange={(e) => setDtStart(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-700 outline-none focus:border-blue-400"
          />
          <input
            type="datetime-local"
            value={dtEnd}
            onChange={(e) => setDtEnd(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-700 outline-none focus:border-blue-400"
          />
          <button
            type="button"
            className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-1.5 text-[13px] font-semibold cursor-pointer transition-colors"
          >
            Kirim
          </button>
        </div>
      )}

      {/* Band filter kedua (Select / input / search + tombol Kirim) */}
      {report.filterBar && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
          {report.filterBar.select && (
            <Dropdown
              options={report.filterBar.select}
              value={filterSel}
              onChange={setFilterSel}
              placeholder="Select"
              minW="min-w-[180px]"
            />
          )}
          {report.filterBar.inputPlaceholder && (
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={report.filterBar.inputPlaceholder}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-[13px] text-slate-700 outline-none focus:border-blue-400 min-w-[200px] placeholder-slate-400"
            />
          )}
          {report.filterBar.searchPlaceholder && (
            <div className="flex-1 min-w-[200px] flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 focus-within:border-blue-400">
              <Search size={14} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={report.filterBar.searchPlaceholder}
                className="w-full text-[13px] bg-transparent outline-none text-slate-700 placeholder-slate-400"
              />
            </div>
          )}
          {report.filterBar.submitLabel && (
            <button
              type="button"
              className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-4 py-1.5 text-[13px] font-semibold cursor-pointer transition-colors"
            >
              {report.filterBar.submitLabel}
            </button>
          )}
        </div>
      )}

      {/* Tabel */}
      <div ref={tableScrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3 bg-white">
        {/* Laporan yang datanya memang belum dilacak sistem — jelaskan, jangan
            tampilkan "No Data" yang menyesatkan. */}
        {report.unavailable && (
          <div className="flex items-start gap-2.5 border border-amber-200 bg-amber-50 rounded-xl px-4 py-3 text-[13px] text-amber-800">
            <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Laporan ini belum bisa ditampilkan</p>
              <p className="mt-0.5 text-amber-700">{report.unavailable}</p>
            </div>
          </div>
        )}
        {fetchError && !report.unavailable && (
          <div className="border border-rose-200 bg-rose-50 rounded-xl px-4 py-3 text-[13px] text-rose-700">
            {fetchError}
          </div>
        )}
        {loading && !report.unavailable && (
          <div className="text-[13px] text-slate-400 px-1 animate-pulse">Memuat data laporan…</div>
        )}
        {effectiveSummary && !report.unavailable &&
          (effectiveSummary.type === 'list' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="text-[13px] font-semibold text-slate-600 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                {effectiveSummary.title}
              </div>
              <div className="space-y-1 text-[13px] text-slate-600 px-3 py-2.5">
                {effectiveSummary.items.map((it) => (
                  <div key={it.label}>
                    {it.label}:{it.value ? ` ${it.value}` : ''}
                  </div>
                ))}
              </div>
            </div>
          ) : effectiveSummary.type === 'grid' ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white grid grid-cols-2 sm:grid-cols-4">
              {effectiveSummary.items.map((it) => (
                <div key={it.label} className="px-4 py-3 border-r border-b border-slate-200">
                  <div className="text-[11px] text-slate-400">{it.label}</div>
                  <div className="text-sm font-bold text-slate-700 mt-0.5">{it.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <ReportTable
              columns={effectiveSummary.columns}
              title={effectiveSummary.title}
              rows={effectiveSummary.rows}
              emptyText="No Data"
            />
          ))}
        {report.notice && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50">
            <div className="flex items-start gap-2 text-[13px] text-slate-600">
              <Info size={15} className="text-blue-500 mt-0.5 shrink-0" />
              <span>{report.notice.text}</span>
            </div>
            {report.notice.summaryButton && (
              <button
                type="button"
                className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-slate-600 bg-white hover:bg-slate-50 cursor-pointer shrink-0"
              >
                <ClipboardList size={15} /> Ringkasan
              </button>
            )}
          </div>
        )}
        {report.unavailable ? null : report.linkList ? (
          <AccordionList items={report.linkList} queryString={queryString} />
        ) : (report.labaRugi || fetched.labaRugi) ? (
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 italic">
              Dihitung dari transaksi penjualan (Order & POS) — bisa berbeda dari Laba Rugi di menu Akuntansi
              yang dihitung dari jurnal terposting. Keduanya sengaja terpisah untuk tujuan berbeda.
            </p>
            <LabaRugiTable sections={fetched.labaRugi || report.labaRugi} />
          </div>
        ) : (
          !report.hideTable && (
            <ReportTable
              columns={report.columns}
              groups={report.groups}
              rows={effectiveRows}
              sort={sort}
              onToggleSort={toggleSort}
              paginated={!!report.paginate}
            />
          )
        )}
      </div>

      {/* Band bawah (mis. Pilih Pesanan + tombol Gabung Resi) */}
      {report.bottomBar && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200">
          <span className="text-[13px] text-slate-600">{report.bottomBar.label}</span>
          <button
            type="button"
            disabled
            className="bg-slate-200 text-slate-400 rounded-lg px-4 py-1.5 text-[13px] font-semibold cursor-not-allowed"
          >
            {report.bottomBar.button}
          </button>
        </div>
      )}
    </div>
  );
}

// Browser laporan generik (master–detail). `reports` default = laporan Produk,
// tapi bisa dipakai ulang untuk tab lain (mis. Pembelian) dengan daftar berbeda.
export default function LaporanProduk({ reports = PRODUK_REPORTS }) {
  const [activeId, setActiveId] = useState(reports[0].id);
  const [panelOpen, setPanelOpen] = useState(true);

  const report = useMemo(
    () => reports.find((r) => r.id === activeId) || reports[0],
    [activeId, reports]
  );

  return (
    <div className="flex flex-1 min-h-0 border border-slate-200 rounded-xl overflow-hidden bg-white">
      {panelOpen && (
        <DaftarLaporanPanel
          reports={reports}
          activeId={activeId}
          onSelect={setActiveId}
          onCollapse={() => setPanelOpen(false)}
        />
      )}
      <LaporanDetail
        key={report.id}
        report={report}
        collapsed={!panelOpen}
        onExpand={() => setPanelOpen(true)}
      />
    </div>
  );
}
