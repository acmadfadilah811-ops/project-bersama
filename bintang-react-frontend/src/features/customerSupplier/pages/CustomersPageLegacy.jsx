import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Users,
  DollarSign,
  ShoppingCart,
  Phone,
  RefreshCw,
  Download,
  Trash2,
  FileText,
  X,
} from 'lucide-react';
import apiClient from '../../../api/apiClient';
import { useAuth } from '../../../context/AuthContext';

export default function Customers() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState({
    total_customers: 0,
    total_revenue: 0,
    avg_order_value: 0,
    total_piutang: 0,
    top_customers: [],
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const isManager = ['owner', 'manager'].includes(user?.role);

  // Modul Piutang & Histori Order State
  const [activeCustomerTab, setActiveCustomerTab] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [paymentModalData, setPaymentModalData] = useState(null);

  // CRM Scheduled Activities States
  const [activities, setActivities] = useState([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showAddActivityForm, setShowAddActivityForm] = useState(false);
  const [newActivity, setNewActivity] = useState({
    order_id: '',
    tipe: 'whatsapp',
    keterangan: '',
    waktu_jatuh_tempo: new Date().toISOString().slice(0, 10),
  });

  const fetchCustomerActivities = async (ordersList) => {
    try {
      setLoadingActivities(true);
      const res = await apiClient.get('/customer-activities/');
      const orderIds = ordersList.map((o) => o.id);
      const filtered = res.data.filter((act) => orderIds.includes(act.order));
      setActivities(filtered);
    } catch (err) {
      console.error('Gagal memuat aktivitas:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const fetchCustomerOrders = async (phone) => {
    try {
      setLoadingOrders(true);
      const res = await apiClient.get(`/orders/?nomor_wa=${phone}`);
      const rawOrders = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setCustomerOrders(rawOrders);
      await fetchCustomerActivities(rawOrders);
    } catch (err) {
      console.error('Gagal memuat history order:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', keterangan: '' });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await apiClient.get('/contacts/stats/');
      setStats(res.data);
    } catch (err) {
      console.error('Gagal memuat statistik pelanggan:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchCustomers = async (isSilent = false, page = 1) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await apiClient.get(
        `/contacts/?page=${page}&page_size=50&search=${encodeURIComponent(searchTerm)}&tab=${activeCustomerTab}`
      );
      if (res.data && res.data.results) {
        setCustomers(res.data.results);
        setTotalCount(res.data.count);
        setTotalPages(Math.ceil(res.data.count / 50));
      } else {
        // Fallback jika pagination dinonaktifkan di backend
        const sorted = Array.isArray(res.data)
          ? res.data.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0))
          : [];
        setCustomers(sorted);
        setTotalCount(sorted.length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Gagal memuat data pelanggan:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  // Load stats once on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch customers when page, active tab or search changes (with debounced/direct trigger)
  useEffect(() => {
    fetchCustomers(false, currentPage);
  }, [currentPage, activeCustomerTab]);

  useEffect(() => {
    setCurrentPage(1);
    fetchCustomers(true, 1);
  }, [searchTerm]);

  // Polling data real-time
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchCustomers(true, currentPage);
      fetchStats();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [currentPage, searchTerm, activeCustomerTab]);

  const filteredCustomers = customers;

  const topCustomers = stats.top_customers || [];
  const totalRevenue = stats.total_revenue || 0;
  const totalPiutang = stats.total_piutang || 0;
  const avgOrderValue = stats.avg_order_value || 0;

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) return;
    if (isSavingCustomer) return;
    try {
      setIsSavingCustomer(true);
      await apiClient.post('/contacts/', {
        nama: newCustomer.name,
        nomor_wa: newCustomer.phone,
        total_order: 0,
        total_spent: 0,
        last_order: null,
        keterangan: newCustomer.keterangan || '',
      });
      setIsAddDialogOpen(false);
      setNewCustomer({ name: '', phone: '', keterangan: '' });
      fetchCustomers();
    } catch (err) {
      console.error('Gagal menambah pelanggan', err);
      alert('Gagal menambahkan pelanggan. Nomor WA mungkin sudah ada.');
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDelete = async (customer) => {
    const konfirmasi = window.confirm(
      `Apakah Anda yakin ingin menghapus pelanggan "${customer.nama}" (${customer.nomor_wa})?\n\nPastikan data sudah di-backup sebelum menghapus.\nTindakan ini tidak dapat dibatalkan.`
    );
    if (!konfirmasi) return;
    try {
      await apiClient.delete(`/contacts/${customer.nomor_wa}/`);
      fetchCustomers();
    } catch (err) {
      console.error('Gagal hapus:', err);
      alert('Gagal menghapus data pelanggan.');
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await apiClient.post('/contacts/sync/');
      await fetchCustomers();
      alert(`Sinkronisasi selesai. ${res.data.synced} pelanggan diperbarui.`);
    } catch (err) {
      console.error('Gagal sinkronisasi:', err);
      alert('Gagal sinkronisasi data pelanggan.');
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await apiClient.get('/export/contacts/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pelanggan_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export gagal:', err);
      alert('Gagal mengekspor data pelanggan.');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Data Pelanggan</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola database pelanggan dan lacak histori pesanan
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sync Data */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 h-8 px-3"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>

          {isManager && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-green-600 text-white hover:bg-green-700 shadow h-8 px-3 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          )}

          {/* Tambah Pelanggan */}
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-md text-xs font-medium transition-colors bg-slate-900 text-white shadow hover:bg-slate-800 h-8 px-3"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Tambah Pelanggan
          </button>
        </div>
      </div>

      {/* Add Customer Modal */}
      {isAddDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm overflow-hidden">
            <div className="p-4 space-y-1 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Tambah Pelanggan Baru</h2>
              <p className="text-xs text-slate-500">Masukkan data kontak pelanggan ke database.</p>
            </div>
            <div className="p-4 space-y-3">
              {/* Nama */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Nama Pelanggan <span className="text-red-500">*</span>
                </label>
                <input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder="Bapak Budi Santoso"
                  className="flex h-8 w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 text-slate-900"
                />
              </div>
              {/* Nomor WA */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Nomor WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder="08123456789"
                  className="flex h-8 w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 text-slate-900"
                />
                <p className="text-[10px] text-slate-400">
                  Nomor WA digunakan sebagai ID unik pelanggan.
                </p>
              </div>
              {/* Keterangan */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Keterangan / Catatan
                </label>
                <textarea
                  value={newCustomer.keterangan}
                  onChange={(e) => setNewCustomer({ ...newCustomer, keterangan: e.target.value })}
                  placeholder="Cth: Pelanggan tetap, selalu pesan banner spanduk. Referral dari pak Joko."
                  rows={3}
                  className="w-full rounded-md border border-slate-300 bg-transparent px-2.5 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 text-slate-900 resize-none"
                />
                <p className="text-[10px] text-slate-400">
                  Catatan internal tentang pelanggan ini (tidak terlihat pelanggan).
                </p>
              </div>
            </div>
            <div className="p-4 pt-0 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setNewCustomer({ name: '', phone: '', keterangan: '' });
                }}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-slate-200 bg-white hover:bg-slate-100 h-8 px-3"
              >
                Batal
              </button>
              <button
                onClick={handleAddCustomer}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 h-8 px-3"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-900">Total Pelanggan</p>
            <Users size={14} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900">{customers.length}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Basis pelanggan aktif</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-900">Total Pendapatan</p>
            <DollarSign size={14} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(totalRevenue)}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Pendapatan sepanjang waktu</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-900">Rata-rata Nilai Order</p>
            <ShoppingCart size={14} className="text-slate-400" />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-slate-900">{formatCurrency(avgOrderValue)}</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Rata-rata per order</p>
          </div>
        </div>

        <div className="bg-red-50/50 rounded-lg p-4 border border-red-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-red-950">Total Piutang Aktif</p>
            <DollarSign size={14} className="text-red-500" />
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-bold text-red-700">{formatCurrency(totalPiutang)}</h3>
            <p className="text-[10px] text-red-600 mt-0.5">Tagihan belum lunas (B2B / Retail)</p>
          </div>
        </div>
      </div>

      {/* Main Content Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: All Customers Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 w-max mb-1.5">
                <button
                  onClick={() => setActiveCustomerTab('all')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    activeCustomerTab === 'all'
                      ? 'bg-white shadow-sm text-slate-900 border border-slate-250'
                      : 'text-slate-500 hover:text-slate-950'
                  }`}
                >
                  Semua Pelanggan
                </button>
                <button
                  onClick={() => setActiveCustomerTab('piutang')}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                    activeCustomerTab === 'piutang'
                      ? 'bg-white shadow-sm text-red-600 border border-slate-250'
                      : 'text-red-500 hover:text-red-700'
                  }`}
                >
                  Berpiutang (Belum Lunas)
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Total {totalCount} pelanggan
              </p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Cari nama, WA, keterangan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-md pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-slate-300 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-white text-slate-900 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5">Nama</th>
                  <th className="px-4 py-2.5">Kontak</th>
                  <th className="px-4 py-2.5 max-w-[160px]">Keterangan</th>
                  <th className="px-4 py-2.5 text-center">Orders</th>
                  <th className="px-4 py-2.5 text-right">Total Belanja</th>
                  <th className="px-4 py-2.5 text-right">Piutang</th>
                  <th className="px-4 py-2.5">Terakhir</th>
                  {isManager && <th className="px-4 py-2.5 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={isManager ? 8 : 7}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      <div className="flex justify-center mb-1.5">
                        <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      Memuat data...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isManager ? 8 : 7}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Tidak ada pelanggan ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr
                      key={customer.nomor_wa}
                      className="hover:bg-slate-50/50 transition-colors bg-white cursor-pointer"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        fetchCustomerOrders(customer.nomor_wa);
                      }}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{customer.nama}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div
                          className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(
                              `https://wa.me/${customer.nomor_wa.replace(/^0/, '62')}`,
                              '_blank'
                            );
                          }}
                        >
                          <Phone size={12} />
                          <span>{customer.nomor_wa}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 max-w-[160px]">
                        {customer.keterangan ? (
                          <p
                            className="text-xs text-slate-500 italic truncate"
                            title={customer.keterangan}
                          >
                            {customer.keterangan}
                          </p>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {customer.total_order}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {formatCurrency(customer.total_spent || 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {customer.total_piutang > 0 ? (
                          <span className="font-extrabold text-red-650 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                            {formatCurrency(customer.total_piutang)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {customer.last_order && customer.last_order !== '-' ? (
                          customer.last_order.split(' ')[0]
                        ) : (
                          <span className="italic">Belum pernah</span>
                        )}
                      </td>
                      {isManager && (
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(customer);
                            }}
                            title="Hapus pelanggan (pastikan sudah di-backup)"
                            className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors border border-transparent hover:border-red-200"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                Menampilkan <span className="font-semibold">{Math.min(totalCount, (currentPage - 1) * 50 + 1)}</span> sampai{' '}
                <span className="font-semibold">{Math.min(totalCount, currentPage * 50)}</span> dari{' '}
                <span className="font-semibold">{totalCount}</span> pelanggan
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white rounded transition-colors cursor-pointer"
                >
                  Sebelumnya
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let targetPage = currentPage;
                  if (currentPage <= 3) {
                    targetPage = idx + 1;
                  } else if (currentPage >= totalPages - 2) {
                    targetPage = totalPages - 4 + idx;
                  } else {
                    targetPage = currentPage - 2 + idx;
                  }
                  
                  if (targetPage < 1 || targetPage > totalPages) return null;
                  
                  return (
                    <button
                      key={targetPage}
                      onClick={() => setCurrentPage(targetPage)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                        currentPage === targetPage
                          ? 'bg-slate-800 border-slate-800 text-white'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {targetPage}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white rounded transition-colors cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Top Customers */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-base text-slate-900">Top Customers</h3>
            <p className="text-xs text-slate-500 mt-0.5">Berdasarkan total belanja</p>
          </div>
          <div className="p-4 space-y-4 flex-1">
            {loading ? (
              <div className="text-center text-slate-500 text-xs py-2">Memuat data...</div>
            ) : topCustomers.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-2">Belum ada data.</div>
            ) : (
              topCustomers.map((customer, index) => (
                <div key={customer.nomor_wa} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-900 font-bold text-xs shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-xs truncate">{customer.nama}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {customer.nomor_wa}
                    </p>
                    {customer.keterangan && (
                      <p
                        className="text-[10px] text-slate-400 italic truncate mt-0.5"
                        title={customer.keterangan}
                      >
                        {customer.keterangan}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {customer.total_order} orders
                      </span>
                      <span className="text-xs font-semibold text-slate-900">
                        {formatCurrency(customer.total_spent || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DRAWER DETAIL PELANGGAN & HISTORI PIUTANG */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Detail Pelanggan</h3>
                <p className="text-[10px] text-slate-500 font-mono">{selectedCustomer.nomor_wa}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCustomer(null);
                  setCustomerOrders([]);
                }}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Profile Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {selectedCustomer.nama.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{selectedCustomer.nama}</h4>
                    <button
                      onClick={() =>
                        window.open(
                          `https://wa.me/${selectedCustomer.nomor_wa.replace(/^0/, '62')}`,
                          '_blank'
                        )
                      }
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 mt-0.5"
                    >
                      <Phone size={10} className="inline mr-1" /> {selectedCustomer.nomor_wa}
                    </button>
                  </div>
                </div>
                {selectedCustomer.keterangan && (
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-100 italic">
                    <strong>Catatan:</strong> {selectedCustomer.keterangan}
                  </div>
                )}
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Orders</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {selectedCustomer.total_order}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Total Spent</p>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {formatCurrency(selectedCustomer.total_spent || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Piutang</p>
                    <p
                      className={`text-sm font-extrabold mt-0.5 ${selectedCustomer.total_piutang > 0 ? 'text-red-600' : 'text-slate-800'}`}
                    >
                      {formatCurrency(selectedCustomer.total_piutang || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scheduled Activities Section */}
              <div className="space-y-4 border-t border-slate-150 pt-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider">
                    Aktivitas Follow-Up (CRM)
                  </h4>
                  <button
                    onClick={() => {
                      setShowAddActivityForm(!showAddActivityForm);
                      if (customerOrders.length > 0) {
                        setNewActivity((prev) => ({
                          ...prev,
                          order_id: customerOrders[0].id,
                        }));
                      }
                    }}
                    className="text-[10px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                  >
                    {showAddActivityForm ? 'Batal' : '+ Jadwal Baru'}
                  </button>
                </div>

                {showAddActivityForm && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const payload = {
                          order: newActivity.order_id,
                          tipe: newActivity.tipe,
                          keterangan: newActivity.keterangan,
                          waktu_jatuh_tempo: newActivity.waktu_jatuh_tempo,
                        };
                        await apiClient.post('/customer-activities/', payload);
                        setShowAddActivityForm(false);
                        setNewActivity({
                          order_id: customerOrders[0]?.id || '',
                          tipe: 'whatsapp',
                          keterangan: '',
                          waktu_jatuh_tempo: new Date().toISOString().slice(0, 10),
                        });
                        await fetchCustomerActivities(customerOrders);
                        alert('Aktivitas follow-up berhasil dijadwalkan!');
                      } catch (err) {
                        console.error('Gagal menjadwalkan aktivitas:', err);
                        alert('Gagal menjadwalkan aktivitas.');
                      }
                    }}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-slate-800"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-655 text-slate-600 block">Pilih Pesanan</label>
                        <select
                          value={newActivity.order_id}
                          onChange={(e) => setNewActivity({ ...newActivity, order_id: e.target.value })}
                          className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        >
                          {customerOrders.map((o) => (
                            <option key={o.id} value={o.id}>
                              Order #{o.id} ({o.items?.map((i) => i.jenis_produk).join(', ') || 'No Prod'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-655 text-slate-600 block">Tipe Aktivitas</label>
                        <select
                          value={newActivity.tipe}
                          onChange={(e) => setNewActivity({ ...newActivity, tipe: e.target.value })}
                          className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="whatsapp">Kirim WhatsApp</option>
                          <option value="call">Telepon</option>
                          <option value="design_check">Konfirmasi Desain</option>
                          <option value="payment_followup">Follow-up Pembayaran</option>
                          <option value="other">Lainnya</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-655 text-slate-600 block">Tanggal Jatuh Tempo</label>
                      <input
                        type="date"
                        value={newActivity.waktu_jatuh_tempo}
                        onChange={(e) => setNewActivity({ ...newActivity, waktu_jatuh_tempo: e.target.value })}
                        className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-655 text-slate-600 block">Keterangan Detail</label>
                      <textarea
                        value={newActivity.keterangan}
                        onChange={(e) => setNewActivity({ ...newActivity, keterangan: e.target.value })}
                        placeholder="Contoh: Kirim reminder sisa tagihan DP..."
                        className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                        rows="2"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-1.5 bg-indigo-650 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 shadow-sm"
                    >
                      Jadwalkan Aktivitas
                    </button>
                  </form>
                )}

                {loadingActivities ? (
                  <div className="text-center py-4 text-slate-400 text-xs">Memuat aktivitas...</div>
                ) : activities.length === 0 ? (
                  <p className="text-center py-4 text-slate-400 text-[11px] italic">
                    Belum ada jadwal follow-up untuk pelanggan ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((act) => {
                      const isOverdue = !act.selesai && new Date(act.waktu_jatuh_tempo) < new Date().setHours(0,0,0,0);
                      const tipeLabelMap = {
                        whatsapp: 'WhatsApp',
                        call: 'Telepon',
                        design_check: 'Desain',
                        payment_followup: 'Tagihan',
                        other: 'Lainnya',
                      };
                      return (
                        <div
                          key={act.id}
                          className={`p-3 rounded-lg border flex justify-between items-start ${
                            act.selesai
                              ? 'bg-slate-50/75 border-slate-250 border-slate-200 opacity-75'
                              : isOverdue
                                ? 'bg-red-50/40 border-red-200'
                                : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          <div className="space-y-1 max-w-[80%]">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                  act.tipe === 'whatsapp'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : act.tipe === 'payment_followup'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-indigo-100 text-indigo-700'
                                }`}
                              >
                                {tipeLabelMap[act.tipe] || act.tipe}
                              </span>
                              <span className={`text-[10px] font-semibold ${isOverdue ? 'text-red-650 text-red-600' : 'text-slate-500'}`}>
                                {new Date(act.waktu_jatuh_tempo).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                                {isOverdue && ' (Terlambat)'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 font-medium">{act.keterangan}</p>
                            <p className="text-[9px] text-slate-400">
                              PIC: <span className="font-semibold text-slate-500">{act.pic_username}</span> • Order: #{act.order}
                            </p>
                          </div>

                          {!act.selesai && (
                            <button
                              onClick={async () => {
                                try {
                                  await apiClient.post(`/customer-activities/${act.id}/complete/`);
                                  await fetchCustomerActivities(customerOrders);
                                  alert('Aktivitas ditandai selesai!');
                                } catch (err) {
                                  console.error('Gagal menyelesaikan aktivitas:', err);
                                }
                              }}
                              className="px-2 py-1 bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold shadow-sm transition-colors cursor-pointer"
                              title="Tandai Selesai"
                            >
                              Selesai
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order History Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-[12px] uppercase tracking-wider">
                  Histori Pesanan
                </h4>

                {loadingOrders ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Memuat histori pesanan...
                  </div>
                ) : customerOrders.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-[11px] italic">
                    Belum ada pesanan.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {customerOrders.map((order) => {
                      const isUnpaid = order.sisa_tagihan > 0 && order.status_global !== 'batal';
                      return (
                        <div
                          key={order.id}
                          className={`p-3 rounded-lg border bg-white transition-all shadow-sm ${
                            isUnpaid
                              ? 'border-red-200 bg-red-50/10 hover:bg-red-50/20'
                              : 'border-slate-200 hover:bg-slate-50/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[11px] font-bold text-slate-900">{order.id}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                {new Date(order.waktu).toLocaleDateString('id-ID')} -{' '}
                                {order.items?.map((i) => i.jenis_produk).join(', ') || '-'}
                              </p>
                            </div>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                order.status_global === 'batal'
                                  ? 'bg-red-100 text-red-700'
                                  : order.status_global === 'selesai'
                                    ? 'bg-blue-100 text-blue-700'
                                    : order.status_global === 'ready'
                                      ? 'bg-teal-100 text-teal-700'
                                      : order.status_global === 'proses'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {order.status_global}
                            </span>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 flex justify-between items-center text-[10px]">
                            <div>
                              <span className="text-slate-500">Total:</span>{' '}
                              <span className="font-bold text-slate-900">
                                {formatCurrency(order.total_harga)}
                              </span>
                              {order.dp_dibayar > 0 && (
                                <span className="text-slate-400 ml-1.5">
                                  (DP: {formatCurrency(order.dp_dibayar)})
                                </span>
                              )}
                            </div>

                            {order.total_harga <= 0 ? (
                              <span className="font-bold text-amber-600 uppercase text-[9px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Harga belum di-input
                              </span>
                            ) : isUnpaid ? (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-red-650">
                                  Sisa: {formatCurrency(order.sisa_tagihan)}
                                </span>
                                <button
                                  onClick={() =>
                                    setPaymentModalData({
                                      orderId: order.id,
                                      sisa_tagihan: order.sisa_tagihan,
                                    })
                                  }
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[9px] font-bold shadow-sm transition-colors cursor-pointer"
                                >
                                  Bayar
                                </button>
                              </div>
                            ) : (
                              <span className="font-bold text-emerald-600 uppercase text-[9px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Lunas
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL CATAT PELUNASAN */}
      {paymentModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-xs text-slate-955">Catat Pembayaran / Pelunasan</h3>
                <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                  Order: {paymentModalData.orderId}
                </p>
              </div>
              <button
                onClick={() => setPaymentModalData(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (isSavingPayment) return;
                const form = e.target;
                const jumlah = parseInt(form.jumlah.value || '0');
                const metode = form.metode.value;

                if (jumlah <= 0) {
                  alert('Jumlah pembayaran harus lebih besar dari 0!');
                  return;
                }

                try {
                  setIsSavingPayment(true);
                  await apiClient.post(`/orders/${paymentModalData.orderId}/bayar/`, {
                    jumlah_bayar: jumlah,
                    metode_pembayaran: metode,
                  });

                  // Refresh data
                  await fetchCustomers();

                  // Refresh data list histori order
                  fetchCustomerOrders(selectedCustomer.nomor_wa);

                  // Update selectedCustomer piutang client-side agar instan
                  setSelectedCustomer((prev) => {
                    if (!prev) return prev;
                    const updatedDebt = (prev.total_piutang || 0) - jumlah;
                    return { ...prev, total_piutang: Math.max(0, updatedDebt) };
                  });

                  setPaymentModalData(null);
                  alert('Pembayaran berhasil dicatat!');
                } catch (err) {
                  console.error('Gagal bayar:', err);
                  alert('Gagal mencatat pembayaran.');
                } finally {
                  setIsSavingPayment(false);
                }
              }}
            >
              <div className="p-4 space-y-4">
                <div className="bg-red-50/50 p-2.5 rounded border border-red-200 flex justify-between items-center text-xs">
                  <span className="font-medium text-red-950">Tagihan Yang Harus Dibayar:</span>
                  <span className="font-extrabold text-red-600">
                    {formatCurrency(paymentModalData.sisa_tagihan)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">Jumlah Bayar (Rp)</label>
                  <div className="relative">
                    <input
                      type="number"
                      name="jumlah"
                      max={paymentModalData.sisa_tagihan}
                      placeholder="Cth: 50000"
                      className="w-full text-xs border border-slate-300 rounded-md pl-3 pr-14 py-2 focus:ring-1 focus:ring-slate-900 outline-none text-slate-900 font-bold"
                      id="drawer_bayar_input"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('drawer_bayar_input');
                        if (input) input.value = paymentModalData.sisa_tagihan;
                      }}
                      className="absolute right-1 top-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] rounded cursor-pointer"
                    >
                      Lunas
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700">Metode Pembayaran</label>
                  <select
                    name="metode"
                    className="w-full text-xs border border-slate-300 rounded-md px-2 py-2 focus:ring-1 focus:ring-slate-900 outline-none text-slate-900 font-bold"
                  >
                    <option value="tunai">Tunai / Kas</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS / E-Wallet</option>
                  </select>
                </div>
              </div>

              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalData(null)}
                  className="px-3.5 py-1.5 border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-sm"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
