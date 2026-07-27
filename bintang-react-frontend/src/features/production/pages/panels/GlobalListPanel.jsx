import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw,
  Search,
  Plus,
  X,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  Printer,
  Truck,
  FileCheck,
} from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import OrderInputForm from '../../../orders/components/OrderInputForm';
import { useAuth } from '../../../../context/AuthContext';

const STATUS_COLORS = {
  review: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  desain: 'bg-blue-100 text-blue-800 border-blue-200',
  proses: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  selesai: 'bg-slate-100 text-slate-600 border-slate-200',
  batal: 'bg-red-100 text-red-700 border-red-200',
};

const getKonsepDesain = (detail) => {
  if (!detail) return null;
  try {
    const arr = typeof detail === 'string' ? JSON.parse(detail) : detail;
    if (Array.isArray(arr)) {
      const found = arr.find(d => d && (d.key === 'Konsep Desain' || d.key === 'konsep_desain'));
      if (found && found.value) {
        return found.value;
      }
    }
  } catch (e) {
    console.error("Error parsing detail:", e);
  }
  return null;
};

const STATUS_LABEL = {
  review: 'Menunggu Review',
  desain: 'Proses Desain',
  proses: 'Produksi',
  ready: 'Siap Ambil',
  selesai: 'Selesai',
  batal: 'Dibatalkan',
};

function formatRp(n) {
  return 'Rp' + (n || 0).toLocaleString('id-ID');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

export default function GlobalListPanel() {
  const { businessSettings, user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  // States for printing
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printInvoiceOrder, setPrintInvoiceOrder] = useState(null);
  const [printSuratJalanOrder, setPrintSuratJalanOrder] = useState(null);
  const [printSpkOrder, setPrintSpkOrder] = useState(null);

  // States for assigning order to division/staff
  const [assignOrder, setAssignOrder] = useState(null);
  const [assignOrderItem, setAssignOrderItem] = useState(null);
  const [metadataDivisions, setMetadataDivisions] = useState([]);
  const [metadataTahapList, setMetadataTahapList] = useState([]);
  const [metadataStaffList, setMetadataStaffList] = useState([]);
  const [selectedDivisiId, setSelectedDivisiId] = useState('');
  const [selectedTahapId, setSelectedTahapId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedAssignStatus, setSelectedAssignStatus] = useState('desain');

  const mountedRef = useRef(true);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (activeDropdownId && !e.target.closest(`#action-print-menu-${activeDropdownId}`)) {
        setActiveDropdownId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeDropdownId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await apiClient.get('/orders/', { params: { page: 1, page_size: 1000 } });
      const ordersData = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      if (mountedRef.current) setOrders(ordersData);
    } catch (err) {
      console.error('Gagal memuat orders:', err);
    } finally {
      if (mountedRef.current && !isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadAssignMetadata = async () => {
      try {
        const [resDivs, resTahap, resStaff] = await Promise.all([
          apiClient.get('/divisi/'),
          apiClient.get('/tahap-proses/'),
          apiClient.get('/users/?role=staff'),
        ]);
        setMetadataDivisions(Array.isArray(resDivs.data) ? resDivs.data : (resDivs.data?.results || []));
        setMetadataTahapList(Array.isArray(resTahap.data) ? resTahap.data : (resTahap.data?.results || []));
        setMetadataStaffList(Array.isArray(resStaff.data) ? resStaff.data : (resStaff.data?.results || []));
      } catch (err) {
        console.error('Gagal memuat metadata divisi/tahap/staff:', err);
      }
    };

    const isAdmin = ['owner', 'manager', 'admin'].includes(user?.role?.toLowerCase());
    if (isAdmin) {
      loadAssignMetadata();
    }
  }, [user]);

  useEffect(() => {
    if (assignOrder) {
      setSelectedAssignStatus(
        assignOrder.status_global === 'review' ? 'desain' : assignOrder.status_global
      );
      setSelectedDivisiId('');
      setSelectedTahapId('');
      setSelectedStaffId('');
    }
  }, [assignOrder]);

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      status_global: formData.get('status_global'),
      biaya_desain: parseInt(formData.get('biaya_desain') || 0),
      insentif: parseInt(formData.get('insentif') || 0),
    };

    const staffId = formData.get('staff_id');
    if (staffId) payload.staff_id = parseInt(staffId);

    const divisiId = formData.get('divisi_id');
    if (divisiId) payload.divisi_id = parseInt(divisiId);

    const tahapId = formData.get('tahap_id');
    if (tahapId) payload.tahap_id = parseInt(tahapId);

    if (assignOrderItem) {
      payload.order_item_id = assignOrderItem.id;
    }

    try {
      await apiClient.post(`/orders/${assignOrder.id}/assign/`, payload);
      alert(
        assignOrderItem
          ? 'Item produk berhasil diarahkan ke divisi!'
          : 'Order berhasil diarahkan ke divisi!'
      );
      setAssignOrder(null);
      setAssignOrderItem(null);
      fetchOrders();
    } catch (err) {
      console.error('Gagal mengarahkan:', err);
      alert(err.response?.data?.error || 'Gagal mengarahkan.');
    }
  };

  useEffect(() => {
    fetchOrders();

    // Background polling every 5 seconds
    const intervalId = setInterval(() => {
      fetchOrders(true); // Silent fetch
    }, 5000);

    return () => clearInterval(intervalId);
  }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (o.nama || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q) ||
      (o.nomor_wa || '').includes(q);
    const matchStatus = !filterStatus || o.status_global === filterStatus;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = {
    total: orders.length,
    aktif: orders.filter((o) => !['selesai', 'batal'].includes(o.status_global)).length,
    ready: orders.filter((o) => o.status_global === 'ready').length,
    review: orders.filter((o) => o.status_global === 'review').length,
    selesai: orders.filter((o) => o.status_global === 'selesai').length,
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header + Stats */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm shrink-0">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">Monitor Pesanan Global</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pantau & kelola semua order dari satu panel terpadu.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-indigo-100 transition-all"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Segarkan
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 text-[11px] font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg cursor-pointer transition-all shadow-sm"
            >
              <Plus size={12} />
              Buat Order
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: 'Total Order', value: stats.total, color: 'text-slate-700' },
            { label: 'Aktif', value: stats.aktif, color: 'text-indigo-600' },
            { label: 'Siap Ambil', value: stats.ready, color: 'text-emerald-600' },
            { label: 'Perlu Review', value: stats.review, color: 'text-yellow-600' },
            {
              label: 'Selesai/Sukses',
              value: stats.selesai,
              color: 'text-purple-650 text-purple-600',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center"
            >
              <div className={`text-base font-black ${s.color}`}>{s.value}</div>
              <div className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm shrink-0 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          <input
            type="text"
            placeholder="Cari nama, nomor nota, atau nomor WA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none w-40"
        >
          <option value="">Semua Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Order List */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
            <span className="text-xs">Memuat data pesanan...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 flex flex-col items-center gap-2 text-slate-400">
            <FileText size={28} className="text-slate-300" />
            <p className="text-xs font-semibold">
              {orders.length === 0
                ? 'Belum ada order. Klik "+ Buat Order" untuk memulai.'
                : 'Tidak ada order yang cocok dengan filter.'}
            </p>
          </div>
        ) : (
          filtered.map((order) => {
            const isExpanded = expandedOrder === order.id;
            const itemCount = order.items?.length || 0;
            const statusCls = STATUS_COLORS[order.status_global] || 'bg-slate-100 text-slate-600';

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-xl shadow-sm relative"
              >
                {/* Order Row Header */}
                <div
                  onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60 transition-all cursor-pointer"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {order.id}
                      </span>
                      <span className="font-extrabold text-slate-800 text-xs truncate">
                        {order.nama}
                      </span>
                      <span className="text-[9.5px] text-slate-400">{order.nomor_wa}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-extrabold text-[8.5px] uppercase tracking-wide">
                        {itemCount} item produk
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-800">
                        {formatRp(order.total_harga)}
                      </div>
                      {order.sisa_tagihan > 0 && (
                        <div className="text-[9px] text-red-500 font-bold">
                          Sisa: {formatRp(order.sisa_tagihan)}
                        </div>
                      )}
                      <div className="text-[9px] text-slate-450 text-slate-450 mt-1 flex items-center justify-end gap-1 font-semibold text-slate-400">
                        <Clock size={10} className="shrink-0" />
                        <span>{timeAgo(order.waktu)}</span>
                      </div>
                    </div>

                    {/* ARAHKAN DIVISI */}
                    {['owner', 'manager', 'admin'].includes(user?.role?.toLowerCase()) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignOrder(order);
                        }}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer animate-fade-in"
                      >
                        <FileCheck className="w-3 h-3 text-amber-600" /> Arahkan Divisi
                      </button>
                    )}

                    {/* CETAK DROPDOWN */}
                    <div
                      className="relative no-print"
                      id={`action-print-menu-${order.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setActiveDropdownId(activeDropdownId === order.id ? null : order.id)
                        }
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <Printer className="w-3 h-3" /> Cetak
                      </button>

                      {activeDropdownId === order.id && (
                        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 shadow-xl rounded-lg z-50 py-1 overflow-hidden text-left animate-fade-in">
                          <button
                            onClick={() => {
                              setPrintOrder(order);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                          >
                            <Printer size={13} className="text-slate-400" /> Resi Thermal
                          </button>
                          <button
                            onClick={() => {
                              setPrintInvoiceOrder(order);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-[11px] font-semibold text-blue-700 flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                          >
                            <FileText size={13} className="text-blue-500" /> Invoice Resmi
                          </button>
                          <button
                            onClick={() => {
                              setPrintSuratJalanOrder(order);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-[11px] font-semibold text-emerald-700 flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                          >
                            <Truck size={13} className="text-emerald-500" /> Surat Jalan
                          </button>
                          <button
                            onClick={() => {
                              setPrintSpkOrder(order);
                              setActiveDropdownId(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-orange-50 text-[11px] font-semibold text-orange-700 flex items-center gap-2 cursor-pointer"
                          >
                            <FileCheck size={13} className="text-orange-500" /> SPK Produksi
                          </button>
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase tracking-wide ${statusCls}`}
                    >
                      {STATUS_LABEL[order.status_global] || order.status_global}
                    </span>
                  </div>
                </div>

                {/* Expanded Items */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/40 rounded-b-xl">
                    {itemCount === 0 ? (
                      <p className="text-[10.5px] text-slate-400 italic">
                        Tidak ada item produk dalam order ini.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                          Detail Item Produk
                        </div>
                        {order.items.map((item, i) => (
                          <div
                            key={item.id || i}
                            className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-2 text-[10.5px]"
                          >
                            <div>
                              <span className="font-extrabold text-slate-800">
                                {item.jenis_produk || '-'}
                              </span>
                              {item.desain_susulan && (
                                <span className="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-100 text-[8px] font-black text-cyan-700 uppercase tracking-wider animate-pulse">
                                  Desain Susulan
                                </span>
                              )}
                              {item.bahan && (
                                <span className="text-slate-400 ml-1.5">/ {item.bahan}</span>
                              )}
                              {(item.panjang > 0 || item.lebar > 0) && (
                                <span className="text-slate-400 ml-1.5">
                                  {item.panjang}×{item.lebar}m
                                </span>
                              )}
                              {item.keterangan_detail && (
                                <div className="mt-1 text-[10px] text-indigo-700 bg-indigo-50/50 border border-indigo-100/50 rounded px-2 py-1 font-semibold whitespace-pre-line leading-relaxed max-w-lg text-left">
                                  <span className="block text-[8px] font-black text-indigo-500 uppercase tracking-wider mb-0.5">
                                    {item.keterangan_detail.startsWith('Konsep Desain:') ? 'Konsep Desain' : 'Catatan CS'}
                                  </span>
                                  {(() => {
                                    const konsep = getKonsepDesain(item.detail);
                                    if (konsep) {
                                      return (
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-[9.5px]">
                                          <div>
                                            <span className="text-indigo-400 font-bold">Tulisan:</span> {konsep.tulisan || '-'}
                                          </div>
                                          <div>
                                            <span className="text-indigo-400 font-bold">Warna:</span> {konsep.warna_dominan || '-'}
                                          </div>
                                          <div>
                                            <span className="text-indigo-400 font-bold">Logo/Foto:</span> {konsep.logo_foto || '-'}
                                          </div>
                                          <div>
                                            <span className="text-indigo-400 font-bold">Bentuk:</span> {konsep.bentuk || '-'}
                                          </div>
                                          <div className="col-span-2">
                                            <span className="text-indigo-400 font-bold">Request:</span> {konsep.request_tambahan || '-'}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return item.keterangan_detail.startsWith('Konsep Desain:') ? item.keterangan_detail.replace('Konsep Desain:\n', '') : item.keterangan_detail;
                                  })()}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <span className="text-slate-500">
                                Qty: <strong>{item.qty || 1}</strong>
                              </span>
                              <span className="font-bold text-slate-700">
                                {formatRp(item.harga_jual)}
                              </span>

                              <div className="flex items-center gap-2">
                                <div className="flex flex-col gap-0.5">
                                  {(item.jobs || []).map((job, ji) => (
                                    <span
                                      key={ji}
                                      className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border uppercase ${STATUS_COLORS[job.status_pekerjaan] || 'bg-slate-100'}`}
                                    >
                                      {job.tahap_nama || 'SPK'}: {job.status_pekerjaan}
                                    </span>
                                  ))}
                                  {(item.jobs || []).length === 0 && (
                                    <span className="text-[8px] text-slate-400 italic">
                                      Belum ada SPK
                                    </span>
                                  )}
                                </div>

                                {['owner', 'manager', 'admin'].includes(
                                  user?.role?.toLowerCase()
                                ) && (
                                  <button
                                    onClick={() => {
                                      setAssignOrder(order);
                                      setAssignOrderItem(item);
                                    }}
                                    className="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded text-[9.5px] font-extrabold cursor-pointer transition-all shadow-sm shrink-0"
                                  >
                                    Arahkan
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {order.catatan_pelanggan && (
                      <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-1.5">
                        Catatan Pelanggan: {order.catatan_pelanggan}
                      </div>
                    )}

                    {/* STATUS MANAGEMENT PANEL FOR ADMIN/MANAGER/OWNER */}
                    {['owner', 'manager', 'admin'].includes(user?.role?.toLowerCase()) && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[10.5px]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-500 uppercase tracking-wide">
                            Status Global Order:
                          </span>
                          <select
                            value={order.status_global}
                            onChange={async (e) => {
                              const nextStatus = e.target.value;
                              if (
                                window.confirm(
                                  `Ubah status global order ini menjadi "${STATUS_LABEL[nextStatus]}"?`
                                )
                              ) {
                                try {
                                  await apiClient.patch(`/orders/${order.id}/`, {
                                    status_global: nextStatus,
                                  });
                                  alert('Status order berhasil diperbarui!');
                                  fetchOrders();
                                } catch {
                                  alert('Gagal memperbarui status order.');
                                }
                              }
                            }}
                            className="text-xs border border-slate-200 rounded px-2 py-0.5 bg-white outline-none font-bold text-slate-700 cursor-pointer"
                          >
                            {Object.entries(STATUS_LABEL).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>

                        {order.status_global === 'ready' && (
                          <button
                            onClick={async () => {
                              if (
                                window.confirm(
                                  'Selesaikan order ini? Seluruh pembayaran dan penyerahan barang dianggap selesai.'
                                )
                              ) {
                                try {
                                  await apiClient.patch(`/orders/${order.id}/`, {
                                    status_global: 'selesai',
                                  });
                                  alert('Order berhasil diselesaikan!');
                                  fetchOrders();
                                } catch {
                                  alert('Gagal menyelesaikan order.');
                                }
                              }
                            }}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-[4px] shadow-sm transition-all cursor-pointer text-[10px]"
                          >
                            Selesaikan Order (Selesai)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Order Form Modal */}
      <OrderInputForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => {
          setShowForm(false);
          fetchOrders();
        }}
      />

      {/* CETAK RESI THERMAL MODAL */}
      {printOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm flex flex-col overflow-hidden border border-slate-200">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50 no-print">
              <h3 className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
                <Printer size={14} /> Cetak Resi
              </h3>
              <button
                onClick={() => setPrintOrder(null)}
                className="text-slate-400 hover:text-slate-655 text-slate-500 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 receipt-print-area text-slate-900 text-sm font-mono max-h-[70vh] overflow-y-auto bg-white">
              <div className="text-center border-b border-dashed border-slate-300 pb-4 mb-4">
                <h2 className="font-extrabold text-[14px] uppercase tracking-wider text-slate-900 leading-tight">
                  RESI - {printOrder.nama?.toUpperCase()} - #{printOrder.id}
                </h2>
                <h3 className="font-bold text-[10px] text-slate-500 mt-1">
                  {businessSettings?.nama_bisnis || 'Bintang Advertising'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {businessSettings?.alamat || 'Jl. Produksi No. 123, Kota'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Telp: {businessSettings?.no_telepon || '0812-3456-7890'}
                </p>
              </div>

              <div className="space-y-1 mb-4 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Order:</span>
                  <span className="font-bold">{printOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505 text-slate-500">Tanggal:</span>
                  <span>{new Date(printOrder.waktu).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505 text-slate-500">Pelanggan:</span>
                  <span className="font-bold">{printOrder.nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-505 text-slate-500">No. WA:</span>
                  <span>{printOrder.nomor_wa}</span>
                </div>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 py-3 mb-4 space-y-3">
                {printOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex flex-col text-[11px]">
                    <div className="flex justify-between font-bold">
                      <span>
                        {item.qty}x {item.jenis_produk}
                      </span>
                      <span>{formatRp(item.harga_jual || 0)}</span>
                    </div>
                    {item.keterangan_detail && (
                      <span className="text-[10px] text-slate-500 mt-0.5 max-w-[80%] break-words">
                        {item.keterangan_detail}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px] font-bold">
                <div className="flex justify-between">
                  <span>TOTAL:</span>
                  <span>{formatRp(printOrder.total_harga || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>DP / BAYAR:</span>
                  <span>{formatRp(printOrder.dp_dibayar || 0)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-dashed border-slate-300 text-indigo-700">
                  <span>SISA TAGIHAN:</span>
                  <span>
                    {printOrder.sisa_tagihan <= 0
                      ? 'LUNAS'
                      : formatRp(printOrder.sisa_tagihan || 0)}
                  </span>
                </div>
              </div>

              <div className="text-center mt-6 text-[10px] text-slate-500 italic">
                <p>Terima kasih telah mempercayakan</p>
                <p>kebutuhan advertising Anda pada kami.</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 no-print">
              <button
                onClick={() => setPrintOrder(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-md hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const originalTitle = document.title;
                  const cleanName = (printOrder.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
                  document.title = `RESI_${cleanName}_${printOrder.id}`;
                  window.print();
                  document.title = originalTitle;
                }}
                className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-md hover:bg-indigo-700 flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer size={14} /> Cetak Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE A4 MODAL */}
      {printInvoiceOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 backdrop-blur-[2px] overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200 mt-4">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50 no-print">
              <h3 className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
                <FileText size={14} /> Preview Invoice A4
              </h3>
              <button
                onClick={() => setPrintInvoiceOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-8 print-area bg-white text-slate-805 text-slate-800 text-[12px]">
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-2xl font-black tracking-widest uppercase text-slate-900">
                    INVOICE
                  </h1>
                  <p className="text-slate-500 font-mono mt-1">#{printInvoiceOrder.id}</p>
                </div>
                <div className="text-right">
                  <h2 className="font-bold text-[14px]">
                    INVOICE - {printInvoiceOrder.nama?.toUpperCase()} - #{printInvoiceOrder.id}
                  </h2>
                  <p className="text-slate-500 font-bold text-[10px] mt-0.5">
                    {businessSettings?.nama_bisnis || 'Bintang Advertising'}
                  </p>
                  <p className="text-slate-550 text-slate-500 mt-0.5">
                    {businessSettings?.alamat || 'Jl. Produksi No. 123, Kota'}
                  </p>
                  <p className="text-slate-550 text-slate-500">
                    WA: {businessSettings?.no_telepon || '0812-3456-7890'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between mb-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    DITAGIHKAN KEPADA:
                  </p>
                  <p className="font-bold text-[14px]">{printInvoiceOrder.nama}</p>
                  <p className="text-slate-600">{printInvoiceOrder.nomor_wa}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    TANGGAL INVOICE:
                  </p>
                  <p className="font-bold">
                    {new Date(printInvoiceOrder.waktu).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-1 capitalize">
                    Pembayaran: {printInvoiceOrder.metode_pembayaran || 'Tunai'}
                  </p>
                </div>
              </div>

              <table className="w-full text-left border-collapse mb-8">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300">
                    <th className="py-2 px-2 font-bold text-slate-700 w-10 text-center">NO</th>
                    <th className="py-2 px-2 font-bold text-slate-700">DESKRIPSI PRODUK</th>
                    <th className="py-2 px-2 font-bold text-slate-700 text-center">UKURAN</th>
                    <th className="py-2 px-2 font-bold text-slate-700 text-center">QTY</th>
                    <th className="py-2 px-2 font-bold text-slate-700 text-right">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {printInvoiceOrder.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-2 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-2">
                        <p className="font-bold text-slate-800">{item.jenis_produk}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          Bahan: {item.bahan || '-'}
                        </p>
                        {item.keterangan_detail && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            {item.keterangan_detail}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {parseFloat(item.panjang) > 0 && parseFloat(item.lebar) > 0
                          ? `${item.panjang} x ${item.lebar} m`
                          : '-'}
                      </td>
                      <td className="py-3 px-2 text-center font-bold">{item.qty}</td>
                      <td className="py-3 px-2 text-right font-bold">
                        {formatRp(item.harga_jual)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-12">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>
                      {formatRp(
                        printInvoiceOrder.items?.reduce((s, i) => s + (i.harga_jual || 0), 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Diskon ({printInvoiceOrder.diskon_persen || 0}%)</span>
                    <span>
                      -{' '}
                      {formatRp(
                        ((printInvoiceOrder.items?.reduce((s, i) => s + (i.harga_jual || 0), 0) ||
                          0) *
                          (printInvoiceOrder.diskon_persen || 0)) /
                          100
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-[14px] border-t border-slate-300 pt-2 text-slate-900">
                    <span>TOTAL</span>
                    <span>{formatRp(printInvoiceOrder.total_harga)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>DP Dibayar</span>
                    <span>{formatRp(printInvoiceOrder.dp_dibayar)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[14px] bg-slate-100 p-2 rounded border border-slate-200 mt-2">
                    <span>SISA TAGIHAN</span>
                    <span
                      className={
                        printInvoiceOrder.sisa_tagihan <= 0 ? 'text-emerald-600' : 'text-red-650'
                      }
                    >
                      {printInvoiceOrder.sisa_tagihan <= 0
                        ? 'LUNAS'
                        : formatRp(printInvoiceOrder.sisa_tagihan)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end mt-10">
                <div className="flex gap-12">
                  <div className="text-[10px] text-slate-500 space-y-1 self-start">
                    <p className="font-bold text-slate-700">Metode Pembayaran:</p>
                    <p className="max-w-[220px]">
                      {businessSettings?.deskripsi ||
                        `Transfer BCA: 1234567890 a/n ${businessSettings?.nama_bisnis || 'Bintang Advertising'}`}
                    </p>
                  </div>
                  <div className="text-center w-36">
                    <p className="mb-12 text-slate-500">Tanda Terima,</p>
                    <p className="font-bold border-t border-slate-400 pt-1 text-slate-800">
                      Pelanggan
                    </p>
                  </div>
                </div>
                <div className="text-center w-36">
                  <p className="mb-12 text-slate-500">Hormat Kami,</p>
                  <p className="font-bold border-t border-slate-400 pt-1 text-slate-800">
                    Finance Dept.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 no-print">
              <button
                onClick={() => setPrintInvoiceOrder(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-md hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const originalTitle = document.title;
                  const cleanName = (printInvoiceOrder.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
                  document.title = `INVOICE_${cleanName}_${printInvoiceOrder.id}`;
                  window.print();
                  document.title = originalTitle;
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-md flex items-center gap-2 cursor-pointer"
              >
                <Printer size={14} /> Cetak (Ctrl+P)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SURAT JALAN MODAL */}
      {printSuratJalanOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 backdrop-blur-[2px] overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200 mt-4">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50 no-print">
              <h3 className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
                <Truck size={14} /> Preview Surat Jalan
              </h3>
              <button
                onClick={() => setPrintSuratJalanOrder(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-8 print-area bg-white text-slate-800 text-[12px]">
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-xl font-black tracking-widest uppercase text-slate-900">
                    SURAT JALAN
                  </h1>
                  <p className="text-slate-500 font-mono mt-1">
                    Ref Order: #{printSuratJalanOrder.id}
                  </p>
                </div>
                <div className="text-right text-[11px]">
                  <h2 className="font-bold text-[13px]">
                    SURAT JALAN - {printSuratJalanOrder.nama?.toUpperCase()} - #{printSuratJalanOrder.id}
                  </h2>
                  <p className="text-slate-500 font-bold text-[10px] mt-0.5">
                    {businessSettings?.nama_bisnis || 'Bintang Advertising'}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    {businessSettings?.alamat || 'Jl. Produksi No. 123, Kota'}
                  </p>
                  <p className="text-slate-500">
                    WA: {businessSettings?.no_telepon || '0812-3456-7890'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between mb-8">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    PENERIMA:
                  </p>
                  <p className="font-bold text-[14px]">{printSuratJalanOrder.nama}</p>
                  <p className="text-slate-600">{printSuratJalanOrder.nomor_wa}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    TANGGAL KIRIM:
                  </p>
                  <p className="font-bold border-b border-slate-300 pb-1 w-32 ml-auto">&nbsp;</p>
                </div>
              </div>

              <table className="w-full text-left border-collapse mb-16 border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="py-2 px-3 font-bold text-slate-700 w-10 text-center border-r border-slate-300">
                      NO
                    </th>
                    <th className="py-2 px-3 font-bold text-slate-700 border-r border-slate-300">
                      NAMA BARANG / DESKRIPSI
                    </th>
                    <th className="py-2 px-3 font-bold text-slate-700 text-center border-r border-slate-300">
                      UKURAN
                    </th>
                    <th className="py-2 px-3 font-bold text-slate-700 text-center">QTY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {printSuratJalanOrder.items?.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-3 text-center border-r border-slate-300">{idx + 1}</td>
                      <td className="py-3 px-3 border-r border-slate-300">
                        <p className="font-bold text-slate-800">{item.jenis_produk}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">
                          Bahan: {item.bahan || '-'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-center border-r border-slate-300">
                        {parseFloat(item.panjang) > 0 && parseFloat(item.lebar) > 0
                          ? `${item.panjang} x ${item.lebar} m`
                          : '-'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-[14px]">{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-start mt-10">
                <div className="text-center w-40">
                  <p className="mb-16">Penerima,</p>
                  <p className="font-bold border-t border-slate-400 pt-1">
                    ( {printSuratJalanOrder.nama} )
                  </p>
                </div>
                <div className="text-center w-40">
                  <p className="mb-16">Pengirim,</p>
                  <p className="font-bold border-t border-slate-400 pt-1">( Kurir / Staff )</p>
                </div>
                <div className="text-center w-40">
                  <p className="mb-16">Mengetahui,</p>
                  <p className="font-bold border-t border-slate-400 pt-1">
                    {businessSettings?.nama_bisnis || 'Bintang Advertising'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 no-print">
              <button
                onClick={() => setPrintSuratJalanOrder(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-md hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const originalTitle = document.title;
                  const cleanName = (printSuratJalanOrder.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
                  document.title = `SURAT_JALAN_${cleanName}_${printSuratJalanOrder.id}`;
                  window.print();
                  document.title = originalTitle;
                }}
                className="px-4 py-2 bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-md flex items-center gap-2 cursor-pointer"
              >
                <Printer size={14} /> Cetak Surat Jalan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SURAT PERINTAH KERJA (SPK) MODAL */}
      {printSpkOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 backdrop-blur-[2px] overflow-y-auto pt-10 pb-10">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200 mt-4">
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-slate-50 no-print">
              <h3 className="font-bold text-slate-800 text-[13px] flex items-center gap-2">
                <FileCheck size={14} className="text-orange-500" /> Preview SPK Produksi
              </h3>
              <button
                onClick={() => setPrintSpkOrder(null)}
                className="text-slate-500 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 print-area bg-white text-slate-800 text-[11px] leading-tight">
              {/* Header SPK */}
              <div className="flex justify-between items-center border-b pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-900 rounded flex items-center justify-center text-white font-black text-sm">
                    {businessSettings?.nama_bisnis?.slice(0, 2).toUpperCase() || 'BA'}
                  </div>
                  <div>
                    <h2 className="font-extrabold text-xs tracking-wide uppercase text-slate-900 leading-none">
                      SPK - {printSpkOrder.nama?.toUpperCase()} - #{printSpkOrder.id}
                    </h2>
                    <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                      {businessSettings?.nama_bisnis || 'Bintang Advertising'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px]">
                  <div className="text-right">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase">
                      No Order
                    </span>
                    <span className="font-mono font-black text-red-600 text-xs">
                      #{printSpkOrder.id}
                    </span>
                  </div>
                  <div className="text-right border-l pl-3">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase">
                      Tgl Order
                    </span>
                    <span className="font-bold text-slate-800">
                      {new Date(printSpkOrder.waktu).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Customer */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 grid grid-cols-3 gap-3 mb-3 text-[10px]">
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Pelanggan
                  </span>
                  <span className="text-slate-900 font-extrabold capitalize">
                    {printSpkOrder.nama}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Kontak / WA
                  </span>
                  <span className="text-slate-900 font-bold">{printSpkOrder.nomor_wa}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[8px] uppercase font-bold">
                    Metode Pembayaran
                  </span>
                  <span className="text-slate-900 font-extrabold uppercase">
                    {printSpkOrder.metode_pembayaran || 'Cash/EDC/Transfer'}
                  </span>
                </div>
              </div>

              {/* Tabel SPK */}
              <table className="w-full text-left border-collapse mb-3 border border-slate-350">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-350 divide-x divide-slate-350 text-[9px] uppercase font-black text-slate-650">
                    <th className="py-1.5 px-2">Item Order</th>
                    <th className="py-1.5 px-2 text-center w-24">Ukuran</th>
                    <th className="py-1.5 px-2 text-center w-36">Finishing & Keterangan</th>
                    <th className="py-1.5 px-2 text-center w-14">Qty</th>
                    <th className="py-1.5 px-2 text-right w-24">Harga</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-250 text-[10px]">
                  {printSpkOrder.items?.map((item, idx) => {
                    const formatUkuran =
                      parseFloat(item.panjang) > 0 && parseFloat(item.lebar) > 0
                        ? `${parseFloat(item.panjang)} x ${parseFloat(item.lebar)} m`
                        : '-';

                    return (
                      <tr
                        key={idx}
                        className="divide-x divide-slate-250 font-medium text-slate-800 hover:bg-slate-50/50"
                      >
                        <td className="py-1.5 px-2">
                          <p className="font-extrabold text-slate-900 leading-tight">
                            {item.jenis_produk}
                          </p>
                          <p className="text-[8.5px] text-slate-500">Bahan: {item.bahan || '-'}</p>
                          {item.jobs && item.jobs.length > 0 && (
                            <div className="mt-1 space-y-0.5 border-t border-slate-100 pt-1 text-[8px] text-slate-400">
                              {item.jobs.map((job) => (
                                <p key={job.id}>
                                  <strong>{job.tahap_nama}:</strong> {job.pic_nama || 'Belum Klaim'}{' '}
                                  ({job.status_pekerjaan})
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center whitespace-nowrap">
                          {formatUkuran}
                        </td>
                        <td className="py-1.5 px-2 text-slate-600 leading-tight text-[9.5px]">
                          {item.keterangan_detail || '-'}
                        </td>
                        <td className="py-1.5 px-2 text-center font-extrabold">{item.qty}</td>
                        <td className="py-1.5 px-2 text-right font-bold">
                          {formatRp(item.harga_jual || 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Rincian Notes & Total */}
              <div className="grid grid-cols-5 border border-slate-350 rounded overflow-hidden text-[10px] mb-3">
                <div className="col-span-3 p-2 bg-slate-50/20 border-r border-slate-350">
                  <span className="font-bold text-slate-400 block text-[8px] uppercase">
                    Catatan Pelanggan / Produksi :
                  </span>
                  <p className="text-slate-700 whitespace-pre-wrap leading-tight mt-0.5">
                    {printSpkOrder.catatan_pelanggan || '-'}
                  </p>
                </div>

                <div className="col-span-2 divide-y divide-slate-350 font-bold text-slate-700">
                  <div className="grid grid-cols-2 p-1.5 bg-slate-50/50">
                    <span className="text-slate-400 text-[8px] uppercase">Total</span>
                    <span className="text-right font-black text-slate-900">
                      {formatRp(printSpkOrder.total_harga || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 p-1.5">
                    <span className="text-slate-400 text-[8px] uppercase">DP</span>
                    <span className="text-right font-black text-indigo-700">
                      {printSpkOrder.dp_dibayar > 0 ? formatRp(printSpkOrder.dp_dibayar) : '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 p-1.5 bg-red-50/10">
                    <span className="text-red-900 text-[8px] uppercase">Sisa</span>
                    <span
                      className={`text-right font-black ${printSpkOrder.sisa_tagihan <= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                    >
                      {printSpkOrder.sisa_tagihan <= 0
                        ? 'LUNAS'
                        : formatRp(printSpkOrder.sisa_tagihan)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lembar Checklist Alur Produksi */}
              <div className="grid grid-cols-8 gap-1 text-center">
                {[
                  { label: 'Ord. Service', checked: true },
                  { label: 'Editor 1' },
                  { label: 'Editor 2' },
                  { label: 'Review' },
                  { label: 'Cetak' },
                  { label: 'QC' },
                  { label: 'Approval' },
                  { label: 'QC' },
                ].map((box, index) => (
                  <div
                    key={index}
                    className="border border-slate-300 rounded p-1 flex flex-col justify-between h-10 bg-slate-50/10"
                  >
                    <p className="text-[7.5px] font-bold text-slate-450 truncate border-b border-slate-100 pb-0.5 uppercase tracking-wide">
                      {box.label}
                    </p>
                    <div className="flex items-center justify-center">
                      {box.checked ? (
                        <span className="text-[8px] font-black text-blue-600 font-mono">✓ CS</span>
                      ) : (
                        <span className="text-slate-300 font-mono text-[7px]">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 no-print">
              <button
                onClick={() => setPrintSpkOrder(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-md hover:bg-slate-100 cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const originalTitle = document.title;
                  const cleanName = (printSpkOrder.nama || 'Pelanggan').replace(/[^a-zA-Z0-9]/g, '_');
                  document.title = `SPK_${cleanName}_${printSpkOrder.id}`;
                  window.print();
                  document.title = originalTitle;
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-md flex items-center gap-2 cursor-pointer"
              >
                <Printer size={14} /> Cetak SPK Produksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARAHKAN DIVISI */}
      {assignOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-amber-500" />
                  {assignOrderItem ? 'Arahkan Produk ke Divisi' : 'Arahkan Pesanan ke Divisi'}
                </h3>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {assignOrder.id} · {assignOrder.nama}
                </p>
                {assignOrderItem && (
                  <p className="text-[10px] text-indigo-600 font-bold mt-0.5">
                    Produk: {assignOrderItem.jenis_produk}{' '}
                    {assignOrderItem.bahan ? `(${assignOrderItem.bahan})` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssignOrder(null);
                  setAssignOrderItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="p-5 space-y-4 text-left">
              {/* STATUS UTAMA */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                  Status Pekerjaan
                </label>
                <select
                  name="status_global"
                  value={selectedAssignStatus}
                  onChange={(e) => setSelectedAssignStatus(e.target.value)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-slate-700 bg-white cursor-pointer"
                  required
                >
                  <option value="review">Menunggu Review Manager</option>
                  <option value="desain">Proses Desain</option>
                  <option value="proses">Dalam Proses Produksi</option>
                  <option value="ready">Siap Diambil / Selesai Produksi</option>
                  <option value="selesai">Selesai Seluruhnya (Completed)</option>
                  <option value="batal">Dibatalkan / Cancel</option>
                </select>
              </div>

              {/* DIVISI TUJUAN */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                  Divisi Tujuan
                </label>
                <select
                  name="divisi_id"
                  value={selectedDivisiId}
                  onChange={(e) => {
                    setSelectedDivisiId(e.target.value);
                    setSelectedTahapId('');
                    setSelectedStaffId('');
                  }}
                  className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-slate-700 bg-white cursor-pointer"
                >
                  <option value="">-- Pilih Divisi --</option>
                  {metadataDivisions.map((div) => (
                    <option key={div.id} value={div.id}>
                      {div.nama}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 italic">
                  Sistem otomatis memilih tahap pertama di divisi jika tahap spesifik dikosongkan.
                </p>
              </div>

              {/* TAHAP SPESIFIK */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                  Tahap Spesifik (Opsional)
                </label>
                <select
                  name="tahap_id"
                  value={selectedTahapId}
                  onChange={(e) => setSelectedTahapId(e.target.value)}
                  disabled={!selectedDivisiId}
                  className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">-- Tahap Pertama Divisi (Default) --</option>
                  {metadataTahapList
                    .filter((t) => !selectedDivisiId || t.divisi === parseInt(selectedDivisiId))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nama}
                      </option>
                    ))}
                </select>
              </div>

              {/* PIC STAFF */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                  Assign Staff PIC (Opsional)
                </label>
                <select
                  name="staff_id"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full text-xs border border-slate-200 bg-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="">-- Kirim ke Antrean Global Divisi (Claim Pool) --</option>
                  {metadataStaffList
                    .filter((s) => !selectedDivisiId || s.divisi === parseInt(selectedDivisiId))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.username} {s.divisi_nama ? `(${s.divisi_nama})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* BIAYA & INSENTIF */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                    Biaya Desain (Rp)
                  </label>
                  <input
                    type="number"
                    name="biaya_desain"
                    min="0"
                    placeholder="0"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-slate-700 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                    Estimasi Insentif (Rp)
                  </label>
                  <input
                    type="number"
                    name="insentif"
                    min="0"
                    placeholder="0"
                    className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-semibold text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAssignOrder(null);
                    setAssignOrderItem(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 transition-all"
                >
                  Simpan & Arahkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
