import apiClient from '../../../api/apiClient';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  Download,
  Plus,
  FileText,
  FileClock,
  FileCheck,
  CheckSquare,
  XCircle,
  Search,
  Edit2,
  X,
  Trash2,
  Printer,
  Truck,
  DollarSign,
  Palette,
  AlertTriangle,
  Calculator,
  User,
  Calendar,
  CreditCard,
  Save,
  UserCheck,
} from 'lucide-react';
import OrderInputForm from '../components/OrderInputForm';
import KomplainModal from '../components/KomplainModal';

export default function Orders() {
  const { user, businessSettings } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [statsData, setStatsData] = useState({
    total_count: 0,
    total_piutang: 0,
    piutang_count: 0,
    draft: 0,
    quotation: 0,
    review: 0,
    desain: 0,
    proses: 0,
    ready: 0,
    selesai: 0,
    batal: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [staffList, setStaffList] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      setIsManualModalOpen(true);
      // Clean up URL query parameters
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isKomplainModalOpen, setIsKomplainModalOpen] = useState(false);
  const [editModalData, setEditModalData] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);

  // States for Smart Calculator in Edit Modal
  const [editItems, setEditItems] = useState([]);
  const [dbPrices, setDbPrices] = useState([]);
  const [editPricelistActiveIndex, setEditPricelistActiveIndex] = useState(null);
  const [priceSearch, setPriceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const priceCategories = {
    print_outdoor_per_m2: 'Print Outdoor / m²',
    stand_banner: 'Stand Banner',
    print_a3_plus: 'Print A3+',
    sticker_a3_plus: 'Sticker A3+',
    laminasi_a3_plus: 'Laminasi A3+',
    paket_cetak_brosur: 'Paket Cetak Brosur',
    merchandise_dan_seminar_kit: 'Merchandise & Seminar Kit',
    buku_yasin_dan_finishing: 'Buku Yasin & Finishing',
    kartu_nama_ivory_260: 'Kartu Nama Ivory 260',
    kartu_nama_aster_200: 'Kartu Nama Aster 200',
  };

  // CRM Scheduled Activities states
  const [chatterTab, setChatterTab] = useState('logs'); // 'logs' | 'crm'
  const [orderActivities, setOrderActivities] = useState([]);
  const [loadingOrderActivities, setLoadingOrderActivities] = useState(false);
  const [newOrderActivity, setNewOrderActivity] = useState({
    tipe: 'whatsapp',
    keterangan: '',
    waktu_jatuh_tempo: new Date().toISOString().slice(0, 10),
  });

  const fetchOrderActivities = async (orderId) => {
    try {
      setLoadingOrderActivities(true);
      const res = await apiClient.get(`/customer-activities/?order=${orderId}`);
      setOrderActivities(res.data);
    } catch (err) {
      console.error('Gagal memuat aktivitas order:', err);
    } finally {
      setLoadingOrderActivities(false);
    }
  };

  const fetchPrices = async () => {
    try {
      const res = await apiClient.get('/product-prices/');
      setDbPrices(res.data);
    } catch (err) {
      console.error('Gagal memuat daftar harga:', err);
    }
  };

  const filteredProducts = useMemo(() => {
    return dbPrices.filter((prod) => {
      const matchesCategory = selectedCategory === 'all' || prod.kategori === selectedCategory;
      const searchData = `${(prod.nama_produk || '').toLowerCase()} ${(prod.material || '').toLowerCase()}`;
      const matchesSearch = searchData.includes(priceSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [dbPrices, selectedCategory, priceSearch]);

  const handleSelectEditProduct = (product, selectedPrice) => {
    if (editPricelistActiveIndex === null) return;

    const catMap = {
      print_outdoor_per_m2: 'Cetak Outdoor',
      stand_banner: 'Stand Banner',
      print_a3_plus: 'Print A3+',
      sticker_a3_plus: 'Sticker A3+',
      laminasi_a3_plus: 'Laminasi A3+',
      paket_cetak_brosur: 'Paket Brosur',
      merchandise_dan_seminar_kit: 'Merchandise',
      buku_yasin_dan_finishing: 'Yasin & Finishing',
      kartu_nama_ivory_260: 'Kartu Nama',
      kartu_nama_aster_200: 'Kartu Nama',
    };

    const jenisProduk = catMap[product.kategori] || product.kategori;
    const isMeteran = product.kategori === 'print_outdoor_per_m2';

    const newItems = [...editItems];
    newItems[editPricelistActiveIndex].is_meteran = isMeteran;
    newItems[editPricelistActiveIndex].jenis_produk = jenisProduk;
    newItems[editPricelistActiveIndex].bahan =
      product.nama_produk + (product.material ? ` (${product.material})` : '');
    newItems[editPricelistActiveIndex].harga_per_m2 = selectedPrice;
    newItems[editPricelistActiveIndex].panjang = isMeteran ? 1 : 0;
    newItems[editPricelistActiveIndex].lebar = isMeteran ? 1 : 0;

    const qty = parseInt(newItems[editPricelistActiveIndex].qty) || 1;
    if (isMeteran) {
      newItems[editPricelistActiveIndex].harga_jual = Math.round(1 * 1 * selectedPrice * qty);
    } else {
      newItems[editPricelistActiveIndex].harga_jual = Math.round(selectedPrice * qty);
    }

    setEditItems(newItems);
    setEditPricelistActiveIndex(null);
    setPriceSearch('');
    setSelectedCategory('all');
  };

  const handleEditItemChange = (index, field, value) => {
    const newItems = [...editItems];
    newItems[index] = { ...newItems[index], [field]: value };

    const item = newItems[index];
    const isMeteran = item.is_meteran !== false;
    const qty = parseInt(item.qty) || 1;
    const hargaUnit = parseFloat(item.harga_per_m2) || 0;

    if (field === 'panjang' || field === 'lebar' || field === 'harga_per_m2' || field === 'qty' || field === 'is_meteran') {
      if (isMeteran) {
        const p = parseFloat(item.panjang) || 0;
        const l = parseFloat(item.lebar) || 0;
        item.harga_jual = Math.round(p * l * hargaUnit * qty);
      } else {
        item.harga_jual = Math.round(hargaUnit * qty);
      }
    }

    setEditItems(newItems);
  };

  const openEditModal = (order) => {
    setEditModalData(order);
    const itemsWithMeteran = (order.items || []).map(item => ({
      ...item,
      is_meteran: item.panjang > 0 || item.lebar > 0
    }));
    setEditItems(itemsWithMeteran);
    setSelectedStatus(order.status_global);
    setChatterTab('logs');
    fetchOrderActivities(order.id);
    fetchPrices();
  };

  const closeEditModal = () => {
    setEditModalData(null);
    setEditItems([]);
    setSelectedStatus('');
  };

  const [printOrder, setPrintOrder] = useState(null); // Resi Thermal
  const [printInvoiceOrder, setPrintInvoiceOrder] = useState(null); // Invoice A4
  const [printSuratJalanOrder, setPrintSuratJalanOrder] = useState(null); // Surat Jalan
  const [printSpkOrder, setPrintSpkOrder] = useState(null); // SPK Produksi (Baru)

  // State untuk Dropdown Menu Aksi Cetak per Order
  const [activeDropdownId, setActiveDropdownId] = useState(null);

  const isManager = ['owner', 'manager'].includes(user?.role);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const res = await apiClient.get('/orders/stats/');
      setStatsData(res.data);
    } catch (err) {
      console.error('Gagal menarik statistik orders:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // FE-14: batalkan request yang masih berjalan agar respon lama tidak menimpa
  // hasil terbaru (race condition saat mengetik pencarian / ganti halaman).
  const abortRef = useRef(null);

  const fetchOrders = async (isSilent = false, page = 1) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!isSilent) setLoading(true);
      const res = await apiClient.get(
        `/orders/?page=${page}&page_size=50&search=${encodeURIComponent(searchQuery)}&tab=${activeTab}`,
        { signal: controller.signal }
      );
      if (res.data && res.data.results) {
        setOrders(res.data.results);
        setTotalCount(res.data.count);
        setTotalPages(Math.ceil(res.data.count / 50));
      } else {
        const raw = Array.isArray(res.data) ? res.data : [];
        setOrders(raw);
        setTotalCount(raw.length);
        setTotalPages(1);
      }
    } catch (err) {
      // Abaikan error pembatalan (request digantikan request lebih baru).
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
      console.error('Gagal menarik data orders:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    apiClient
      .get('/users/')
      .then((res) => {
        setStaffList(res.data.filter((u) => u.role === 'staff'));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchOrders(false, currentPage);
  }, [currentPage, activeTab]);

  // FE-14: debounce pencarian agar tidak menembak API di setiap ketikan.
  useEffect(() => {
    const handler = setTimeout(() => {
      setCurrentPage(1);
      fetchOrders(true, 1);
    }, 400);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Polling data real-time
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchOrders(true, currentPage);
      fetchStats();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [currentPage, searchQuery, activeTab]);

  // Tutup dropdown jika user klik di luar area tabel
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getStatusType = (statusText = '') => {
    if (statusText === 'draft') return 'draft';
    if (statusText === 'quotation') return 'quotation';
    if (statusText === 'batal') return 'cancelled';
    if (statusText === 'review') return 'pending';
    if (statusText === 'desain') return 'desain';
    if (statusText === 'proses') return 'printing';
    if (statusText === 'ready') return 'ready';
    if (statusText === 'selesai') return 'completed';
    return 'other';
  };

  const stats = useMemo(() => {
    return {
      draft: statsData.draft || 0,
      quotation: statsData.quotation || 0,
      pending: statsData.review || 0,
      desain: statsData.desain || 0,
      progress: statsData.proses || 0,
      ready: statsData.ready || 0,
      completed: statsData.selesai || 0,
      cancelled: statsData.batal || 0,
      piutang: statsData.piutang_count || 0,
      total_piutang_amount: statsData.total_piutang || 0,
    };
  }, [statsData]);

  const filteredOrders = useMemo(() => {
    if (activeTab === 'all') return orders;
    if (activeTab === 'piutang') {
      return orders.filter((o) => (o.sisa_tagihan || 0) > 0 && o.status_global !== 'batal');
    }
    const tabToStatus = {
      pending: 'review',
      printing: 'proses',
      completed: 'selesai',
      cancelled: 'batal',
    };
    const targetStatus = tabToStatus[activeTab] || activeTab;
    return orders.filter((o) => o.status_global === targetStatus);
  }, [orders, activeTab]);

  const renderBadge = (statusText = '') => {
    const type = getStatusType(statusText);
    if (type === 'draft') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
          Draft
        </span>
      );
    }
    if (type === 'quotation') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
          Quotation
        </span>
      );
    }
    if (type === 'cancelled') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-red-100 text-red-700 uppercase tracking-wider flex items-center gap-1 w-max mx-auto">
          <X className="w-2.5 h-2.5" /> Cancelled
        </span>
      );
    }
    if (type === 'pending') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-slate-100 text-slate-600 uppercase tracking-wider">
          Pending
        </span>
      );
    }
    if (type === 'desain') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wider">
          Desain
        </span>
      );
    }
    if (type === 'printing') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-orange-100 text-orange-700 uppercase tracking-wider">
          Printing
        </span>
      );
    }
    if (type === 'ready') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">
          Ready
        </span>
      );
    }
    if (type === 'completed') {
      return (
        <span className="px-1.5 py-0.5 rounded-[4px] text-[8.5px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
          Completed
        </span>
      );
    }
    return null;
  };

  const formatRupiah = (angka) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(angka || 0);

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (savingChanges) return;
    setSavingChanges(true);
    const form = e.target;
    const newStatus = form.status.value;
    const staffId = form.assign_staff?.value;
    const biayaDesain = form.biaya_desain?.value ? parseInt(form.biaya_desain.value) : undefined;
    const jumlahBayar = parseInt(form.jumlah_bayar?.value || '0');
    const metodePembayaran = form.metode_pembayaran?.value || 'tunai';

    try {
      // 1. Update status global
      await apiClient.patch(`/orders/${editModalData.id}/`, {
        status_global: newStatus,
      });

      // 1b. Update detail item (jenis_produk, qty, panjang, lebar, bahan, harga_per_m2, harga_jual, biaya_bahan, biaya_desain)
      if (editItems && editItems.length > 0) {
        for (const item of editItems) {
          const itemPayload = {
            jenis_produk: item.jenis_produk,
            qty: parseInt(item.qty || 1),
            panjang: parseFloat(item.panjang || 0),
            lebar: parseFloat(item.lebar || 0),
            bahan: item.bahan || '',
            harga_per_m2: parseInt(item.harga_per_m2 || 0),
            harga_jual: parseInt(item.harga_jual || 0),
            biaya_bahan: parseInt(item.biaya_bahan || 0),
            biaya_desain: parseInt(item.biaya_desain || 0),
          };
          await apiClient.patch(`/order-items/${item.id}/`, itemPayload);
        }
      }

      // 2. Tambah Pembayaran jika diisi
      if (jumlahBayar > 0) {
        await apiClient.post(`/orders/${editModalData.id}/bayar/`, {
          jumlah_bayar: jumlahBayar,
          metode_pembayaran: metodePembayaran,
          idempotency_key: crypto.randomUUID(),
        });
      }

      // 3. Assign / Publish Job (Staff PIC atau Global Pool)
      let updatedOrderData = null;
      if (['desain', 'proses'].includes(newStatus)) {
        const payload = { status_global: newStatus };
        if (staffId && staffId !== '') payload.staff_id = parseInt(staffId);
        if (biayaDesain !== undefined) payload.biaya_desain = biayaDesain;
        await apiClient.post(`/orders/${editModalData.id}/assign/`, payload);
      }

      // Tarik data pesanan terbaru setelah semua update selesai
      const orderRes = await apiClient.get(`/orders/${editModalData.id}/`);
      updatedOrderData = orderRes.data;

      closeEditModal();
      fetchOrders();

      // Tampilkan SPK cetak jika masuk ke antrean/penugasan
      if (['desain', 'proses'].includes(newStatus) && updatedOrderData) {
        setPrintSpkOrder(updatedOrderData);
      }
    } catch (error) {
      console.error('Gagal update:', error);
      alert('Gagal menyimpan perubahan: ' + (error.response?.data?.error || error.message));
    } finally {
      setSavingChanges(false);
    }
  };

  const handleDeleteOrder = async (order) => {
    const konfirmasi = window.confirm(
      `Apakah Anda yakin ingin menghapus permanen order ${order.id}?\n\nNama: ${order.nama}\n\nSemua item dan job terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`
    );
    if (!konfirmasi) return;
    try {
      await apiClient.delete(`/orders/${order.id}/`);
      fetchOrders();
    } catch (error) {
      console.error('Gagal hapus order:', error);
      alert('Gagal menghapus order.');
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const response = await apiClient.get('/export/orders/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'orders.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed', error);
      alert('Gagal mengekspor data.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Orders</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Manage and track all jobs</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          )}
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Order
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard
          title="Pending"
          icon={FileText}
          count={stats.pending}
          iconColor="text-slate-400"
        />
        <StatCard title="Desain" icon={Palette} count={stats.desain} iconColor="text-purple-500" />
        <StatCard
          title="In Progress"
          icon={FileClock}
          count={stats.progress}
          iconColor="text-orange-500"
        />
        <StatCard title="Ready" icon={FileCheck} count={stats.ready} iconColor="text-emerald-500" />
        <StatCard
          title="Completed"
          icon={CheckSquare}
          count={stats.completed}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Cancelled"
          icon={XCircle}
          count={stats.cancelled}
          iconColor="text-red-500"
        />
        <StatCard
          title="Belum Lunas"
          icon={DollarSign}
          count={stats.piutang}
          iconColor="text-red-600"
          subtitle={formatRupiah(stats.total_piutang_amount)}
        />
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
        <div className="flex gap-1 bg-slate-100/50 p-1 rounded-md border border-slate-200 overflow-x-auto">
          {[
            'all',
            'draft',
            'quotation',
            'pending',
            'desain',
            'printing',
            'ready',
            'completed',
            'cancelled',
            'piutang',
          ].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-sm border border-slate-900'
                  : tab === 'cancelled' || tab === 'piutang'
                    ? 'text-red-600 hover:text-red-800'
                    : 'text-slate-500 hover:text-slate-950'
              }`}
            >
              {tab === 'all'
                ? 'All Jobs'
                : tab === 'piutang'
                  ? 'Piutang'
                  : tab === 'printing'
                    ? 'Printing'
                    : tab === 'desain'
                      ? 'Desain'
                      : tab === 'draft'
                        ? 'Draft'
                        : tab === 'quotation'
                          ? 'Quotation'
                          : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search orders..."
            className="w-full pl-8 pr-3 py-1 text-[11px] border border-slate-200 rounded-md focus:ring-1 focus:ring-slate-900 outline-none bg-slate-50/50"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-1">
        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-[12px] font-bold text-slate-800">
            Job List{' '}
            <span className="text-[10px] text-slate-500 font-normal ml-1">
              ({filteredOrders.length} items)
            </span>
          </h3>
        </div>
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-[10px] border-collapse min-w-[800px]">
            <thead className="bg-white text-slate-500 border-b border-slate-200 font-bold">
              <tr>
                <th className="px-3 py-2">Job #</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2 w-48">Description</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <SkeletonRow />
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-3 py-6 text-center text-slate-400 text-[10px] italic"
                  >
                    No jobs found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const type = getStatusType(order.status_global);
                  const isCancelled = type === 'cancelled';

                  return (
                    <tr
                      key={order.id}
                      className={`hover:bg-slate-50/50 transition-colors ${isCancelled ? 'opacity-60 bg-red-50/20 hover:bg-red-50/40' : ''}`}
                    >
                      <td
                        className={`px-3 py-2 font-bold ${isCancelled ? 'line-through text-slate-500' : 'text-slate-900'}`}
                      >
                        {order.id}
                      </td>
                      <td className="px-3 py-2">
                        <p
                          className={`font-bold ${isCancelled ? 'text-slate-600' : 'text-slate-900'}`}
                        >
                          {order.nama}
                        </p>
                        <p className="text-[9px] text-slate-500">{order.nomor_wa}</p>
                      </td>
                      <td className="px-3 py-2 text-slate-600 truncate max-w-[12rem]">
                        <div className="font-medium text-indigo-700">
                          {order.items?.map((i) => i.jenis_produk).join(', ') || '-'}
                        </div>
                        <div
                          className="text-[10px] text-slate-400 mt-0.5 truncate"
                          title={order.catatan_pelanggan}
                        >
                          {order.catatan_pelanggan || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {(() => {
                          const staffs = [];
                          order.items?.forEach((item) => {
                            item.jobs?.forEach((job) => {
                              if (job.pic_nama && !staffs.includes(job.pic_nama)) {
                                staffs.push(job.pic_nama);
                              }
                            });
                          });
                          if (staffs.length === 0)
                            return <span className="text-slate-400 italic">Belum diset</span>;
                          return <span className="font-bold">{staffs.join(', ')}</span>;
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="font-bold text-slate-900">
                          {formatRupiah(order.total_harga)}
                        </div>
                        <div
                          className={`text-[9px] font-semibold ${order.total_harga <= 0 ? 'text-amber-650' : order.sisa_tagihan <= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                        >
                          {order.total_harga <= 0
                            ? 'Harga belum di-input'
                            : order.sisa_tagihan <= 0
                              ? 'LUNAS'
                              : `Sisa: ${formatRupiah(order.sisa_tagihan)}`}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">{renderBadge(order.status_global)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1.5 relative">
                          {/* DROPDOWN TERPADU CETAK */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() =>
                                setActiveDropdownId(activeDropdownId === order.id ? null : order.id)
                              }
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-[4px] text-[10px] font-bold flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                            >
                              <Printer className="w-3 h-3" /> Cetak
                            </button>

                            {activeDropdownId === order.id && (
                              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 shadow-xl rounded-lg z-50 py-1 overflow-hidden animate-fade-in text-left">
                                <button
                                  onClick={() => {
                                    setPrintOrder(order);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-[11px] font-medium text-slate-700 flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                                >
                                  <Printer size={13} className="text-slate-400" /> Resi Thermal
                                </button>
                                <button
                                  onClick={() => {
                                    setPrintInvoiceOrder(order);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-blue-50 text-[11px] font-medium text-blue-700 flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                                >
                                  <FileText size={13} className="text-blue-500" /> Invoice Resmi
                                </button>
                                <button
                                  onClick={() => {
                                    setPrintSuratJalanOrder(order);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-[11px] font-medium text-emerald-700 flex items-center gap-2 border-b border-slate-100 cursor-pointer"
                                >
                                  <Truck size={13} className="text-emerald-500" /> Surat Jalan
                                </button>
                                <button
                                  onClick={() => {
                                    setPrintSpkOrder(order);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 hover:bg-orange-50 text-[11px] font-medium text-orange-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <FileCheck size={13} className="text-orange-500" /> SPK Produksi
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

                          {/* ACTION ASLI (Edit, Cancel, Delete) */}
                          <button
                            onClick={() => openEditModal(order)}
                            title="Edit Status"
                            className="p-1 bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 rounded-[4px] transition-colors shadow-sm cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {type !== 'cancelled' && type !== 'completed' && (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Batalkan pesanan ${order.id}?`)) {
                                  await apiClient.patch(`/orders/${order.id}/`, {
                                    status_global: 'batal',
                                  });
                                  fetchOrders();
                                }
                              }}
                              title="Batalkan Order"
                              className="p-1 bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-[4px] transition-colors shadow-sm cursor-pointer"
                            >
                              <XCircle className="w-3 h-3" />
                            </button>
                          )}
                          {isManager && (
                            <button
                              onClick={() => handleDeleteOrder(order)}
                              title="Hapus Permanen"
                              className="p-1 bg-white border border-slate-200 text-slate-300 hover:bg-red-100 hover:text-red-700 hover:border-red-300 rounded-[4px] transition-colors shadow-sm cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                Menampilkan <span className="font-semibold">{Math.min(totalCount, (currentPage - 1) * 50 + 1)}</span> sampai{' '}
                <span className="font-semibold">{Math.min(totalCount, currentPage * 50)}</span> dari{' '}
                <span className="font-semibold">{totalCount}</span> pesanan
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
      </div>

      {/* COMPONENT FORM INPUT FULLSCREEN */}
      <OrderInputForm
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSuccess={() => {
          setIsManualModalOpen(false);
          fetchOrders(); // Refresh table
        }}
      />

      <KomplainModal
        isOpen={isKomplainModalOpen}
        onClose={() => setIsKomplainModalOpen(false)}
        order={editModalData}
        onSuccess={() => {
          setIsKomplainModalOpen(false);
        }}
      />

      {/* EDIT STATUS DRAWER */}
      {editModalData && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] flex justify-end overflow-hidden transition-all duration-300">
          {/* Backdrop Click to Close */}
          <div className="absolute inset-0 -z-10" onClick={closeEditModal} />
          
          <div className="bg-white w-full max-w-5xl h-full flex flex-col md:flex-row shadow-2xl overflow-hidden border-l border-slate-200 animate-in slide-in-from-right duration-350 ease-out">
            
            {/* PANEL KIRI: DETAIL FORM & WORKFLOW (60% LEBAR) */}
            <div className="w-full md:w-3/5 flex flex-col h-full bg-white">
              
              {/* Form Action Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Orders</span>
                    <span>/</span>
                    <span className="font-mono text-slate-600">{editModalData.id}</span>
                  </div>
                  <h3 className="text-[14px] font-extrabold text-slate-900 mt-0.5">
                    {editModalData.nama}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsKomplainModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-[10px] font-bold border border-rose-200 transition-colors shadow-sm"
                  >
                    <AlertTriangle size={12} />
                    Buat Komplain
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="p-1.5 hover:bg-slate-200/60 rounded-full text-slate-450 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Form Scrollable Area */}
              <form onSubmit={handleUpdateStatus} className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Workflow Status Tracker */}
                <div className="space-y-2">
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Alur Tahapan Kerja</div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200 overflow-x-auto scrollbar-none">
                    {[
                      { id: 'draft', label: 'Draft' },
                      { id: 'quotation', label: 'Quotation' },
                      { id: 'review', label: 'Review' },
                      { id: 'desain', label: 'Desain' },
                      { id: 'proses', label: 'Proses Cetak' },
                      { id: 'ready', label: 'Ready' },
                      { id: 'selesai', label: 'Selesai' }
                    ].map((stg, idx, arr) => {
                      const isActive = editModalData.status_global === stg.id;
                      return (
                        <div key={stg.id} className="flex items-center shrink-0">
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                            isActive 
                              ? 'bg-[#714B67] text-white shadow-sm border border-[#714B67]' 
                              : 'text-slate-500 bg-white border border-slate-200'
                          }`}>
                            {stg.label}
                          </span>
                          {idx < arr.length - 1 && (
                            <span className="text-slate-350 text-[10px] mx-1.5 font-bold">➔</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Smart Buttons Grid */}
                <div>
                  <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Tombol Pintar (Shortcut)</div>
                  <div className="grid grid-cols-3 gap-3">
                    <button 
                      type="button" 
                      onClick={() => { closeEditModal(); navigate('/jobs'); }} 
                      className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50/80 transition-all cursor-pointer shadow-2xs hover:shadow-xs group"
                    >
                      <span className="text-[14px] font-extrabold text-slate-900 group-hover:scale-105 transition-transform">
                        {editModalData.items?.reduce((acc, i) => acc + (i.jobs?.length || 0), 0) || 0}
                      </span>
                      <span className="text-[9px] font-bold text-slate-450 mt-1">Tugas Produksi</span>
                    </button>
                    
                    <div className={`flex flex-col items-center justify-center p-3 border rounded-xl shadow-2xs ${
                      editModalData.total_harga <= 0 ? 'bg-amber-50/50 border-amber-250 text-amber-800' : editModalData.sisa_tagihan <= 0 ? 'bg-emerald-50/50 border-emerald-250 text-emerald-800' : 'bg-red-50/50 border-red-250 text-red-800'
                    }`}>
                      <span className="text-[11px] font-extrabold text-center">
                        {editModalData.total_harga <= 0 ? 'Harga belum di-input' : editModalData.sisa_tagihan <= 0 ? 'LUNAS' : formatRupiah(editModalData.sisa_tagihan)}
                      </span>
                      <span className="text-[9px] font-bold mt-1 opacity-75">Status Tagihan</span>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => { closeEditModal(); navigate('/customers'); }} 
                      className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50/80 transition-all cursor-pointer shadow-2xs hover:shadow-xs group"
                    >
                      <span className="text-[11px] font-extrabold text-[#714B67] group-hover:scale-105 transition-transform">
                        {formatRupiah(editModalData.customer_total_spent || 0)}
                      </span>
                      <span className="text-[9px] font-bold text-slate-450 mt-1">Loyalty Pelanggan</span>
                    </button>
                  </div>
                </div>

                {/* HPP & Margin Profitabilitas (Owner/Manager Only) */}
                {isManager && editModalData.hpp_bahan !== undefined && (
                  <div className={`rounded-xl border p-4 shadow-2xs ${
                    editModalData.margin_persen === null
                      ? 'bg-slate-50 border-slate-200'
                      : editModalData.margin_persen >= 40
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : editModalData.margin_persen >= 15
                          ? 'bg-amber-50/60 border-amber-200'
                          : 'bg-red-50/60 border-red-200'
                  }`}>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      Analitik Profitabilitas Order
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <div className="text-[12px] font-extrabold text-slate-800">
                          {formatRupiah(editModalData.total_harga || 0)}
                        </div>
                        <div className="text-[9px] text-slate-450 font-bold mt-0.5">Omset / Revenue</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[12px] font-extrabold text-rose-700">
                          {formatRupiah(editModalData.hpp_bahan || 0)}
                        </div>
                        <div className="text-[9px] text-slate-450 font-bold mt-0.5">HPP Bahan</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-[12px] font-extrabold ${
                          editModalData.margin_persen === null
                            ? 'text-slate-400'
                            : editModalData.margin_persen >= 40
                              ? 'text-emerald-700'
                              : editModalData.margin_persen >= 15
                                ? 'text-amber-700'
                                : 'text-red-700'
                        }`}>
                          {editModalData.margin_persen !== null ? `${editModalData.margin_persen}%` : '-'}
                        </div>
                        <div className="text-[9px] text-slate-450 font-bold mt-0.5">Margin Laba</div>
                      </div>
                    </div>
                    {editModalData.hpp_bahan === 0 && (
                      <p className="text-[9px] text-slate-400 italic mt-2.5 border-t border-slate-200/60 pt-2">
                        HPP belum terhitung — operator belum mencatat pemakaian bahan baku di Lembar Kerja SPK.
                      </p>
                    )}
                  </div>
                )}

                {/* Detail Produk & Kalkulator Pintar */}
                {editItems && editItems.length > 0 && (
                  <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
                    <div className="text-[11px] font-extrabold text-slate-800 border-b border-slate-200/60 pb-2 mb-2 uppercase tracking-wide flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Calculator className="w-3.5 h-3.5 text-[#714B67]" />
                        Kalkulator Pintar — Detail Produk & Harga
                      </span>
                    </div>
                    {editItems.map((item, idx) => (
                      <div key={item.id} className="p-4 bg-white border border-slate-200 rounded-lg space-y-3 shadow-3xs">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-[10px] font-black text-[#714B67] uppercase tracking-wider">
                            Item #{idx + 1} - ID: {item.id}
                          </span>
                          {/* is_meteran toggle button */}
                          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleEditItemChange(idx, 'is_meteran', true)}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded ${item.is_meteran !== false ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              P x L (Meteran)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditItemChange(idx, 'is_meteran', false)}
                              className={`px-2 py-0.5 text-[9px] font-bold rounded ${item.is_meteran === false ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                              Pcs (Satuan)
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-650">Nama Produk</label>
                            <input
                              type="text"
                              value={item.jenis_produk || ''}
                              onChange={(e) => handleEditItemChange(idx, 'jenis_produk', e.target.value)}
                              className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                            />
                          </div>
                          
                          <div className="space-y-1.5 col-span-2 sm:col-span-1">
                            <label className="text-[10px] font-bold text-slate-650">Bahan / Material</label>
                            <input
                              type="text"
                              value={item.bahan || ''}
                              onChange={(e) => handleEditItemChange(idx, 'bahan', e.target.value)}
                              placeholder="Cth: Flexi Korea"
                              className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-3">
                          {item.is_meteran !== false ? (
                            <>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-650">Panjang (m)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.panjang || ''}
                                  onChange={(e) => handleEditItemChange(idx, 'panjang', parseFloat(e.target.value) || 0)}
                                  className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-650">Lebar (m)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.lebar || ''}
                                  onChange={(e) => handleEditItemChange(idx, 'lebar', parseFloat(e.target.value) || 0)}
                                  className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                                />
                              </div>
                            </>
                          ) : null}

                          <div className={`space-y-1.5 ${item.is_meteran !== false ? 'col-span-1' : 'col-span-2'}`}>
                            <label className="text-[10px] font-bold text-slate-650">
                              {item.is_meteran !== false ? 'Harga / m² (Rp)' : 'Harga / Pcs (Rp)'}
                            </label>
                            <input
                              type="number"
                              value={item.harga_per_m2 || ''}
                              onChange={(e) => handleEditItemChange(idx, 'harga_per_m2', parseInt(e.target.value) || 0)}
                              className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                            />
                          </div>

                          <div className={`space-y-1.5 ${item.is_meteran !== false ? 'col-span-1' : 'col-span-2'}`}>
                            <label className="text-[10px] font-bold text-slate-650">Qty</label>
                            <input
                              type="number"
                              value={item.qty || ''}
                              onChange={(e) => handleEditItemChange(idx, 'qty', parseInt(e.target.value) || 0)}
                              className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                            />
                          </div>
                        </div>

                        {/* Pricelist Picker Button */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setEditPricelistActiveIndex(idx)}
                            className="w-full bg-[#714B67]/8 hover:bg-[#714B67]/15 text-[#714B67] border border-[#714B67]/25 text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Search size={12} />
                            🔍 Pilih dari Daftar Harga Resmi
                          </button>
                        </div>

                        {/* Live Calculation Summary */}
                        <div className="mt-2 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 p-3 text-white">
                          <div className="text-[9px] font-bold text-slate-400 uppercase mb-1.5">Hasil Kalkulasi Otomatis</div>
                          <div className="text-[9.5px] text-slate-300 mb-2">
                            {item.is_meteran !== false
                              ? <>📐 {item.panjang || 0}m × {item.lebar || 0}m = <span className="text-white font-bold">{((parseFloat(item.panjang) || 0) * (parseFloat(item.lebar) || 0)).toFixed(2)} m²</span> &nbsp;×&nbsp; {formatRupiah(item.harga_per_m2 || 0)}/m² &nbsp;×&nbsp; {item.qty || 1} pcs</>
                              : <>{formatRupiah(item.harga_per_m2 || 0)}/pcs &nbsp;×&nbsp; {item.qty || 1} pcs</>
                            }
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-700 pt-2">
                            <span className="text-[9px] font-bold text-slate-400">TOTAL HARGA JUAL</span>
                            <input
                              type="number"
                              value={item.harga_jual || 0}
                              onChange={(e) => handleEditItemChange(idx, 'harga_jual', parseInt(e.target.value) || 0)}
                              className="text-right text-[13px] font-black text-emerald-400 bg-transparent border-b border-slate-600 focus:border-emerald-400 outline-none w-36 pb-0.5"
                            />
                          </div>
                        </div>

                        {/* Biaya Bahan / HPP */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-650">Biaya Bahan / HPP (Rp)</label>
                          <input
                            type="number"
                            value={item.biaya_bahan || 0}
                            onChange={(e) => handleEditItemChange(idx, 'biaya_bahan', parseInt(e.target.value) || 0)}
                            className="w-full text-[11px] border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-slate-900 outline-none"
                          />
                        </div>
                      </div>
                    ))}

                    {/* Grand Total Summary */}
                    {editItems.length > 1 && (
                      <div className="mt-2 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold text-slate-600 uppercase">Grand Total Semua Item</span>
                        <span className="text-[14px] font-black text-[#714B67]">
                          {formatRupiah(editItems.reduce((sum, it) => sum + (parseInt(it.harga_jual) || 0), 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}



                {/* Form Fields Card */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
                  <div className="text-[11px] font-extrabold text-slate-800 border-b border-slate-200/60 pb-2 mb-2 uppercase tracking-wide">Pengaturan Pesanan & PIC</div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700">Status Alur Kerja Baru</label>
                    <select
                      name="status"
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full text-[12px] border border-slate-200 bg-white rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-slate-900 outline-none shadow-3xs"
                    >
                      <option value="draft">Draft Penawaran</option>
                      <option value="quotation">Kirim Penawaran (Quotation)</option>
                      <option value="review">Pending / Review</option>
                      <option value="desain">Proses Desain</option>
                      <option value="proses">In Progress / Proses Cetak</option>
                      <option value="ready">Ready / Siap Diambil</option>
                      <option value="selesai">Completed / Selesai</option>
                      <option value="batal" className="text-red-500 font-bold">
                        Cancelled / Batal
                      </option>
                    </select>
                  </div>

                  {isManager && ['review', 'desain', 'proses'].includes(selectedStatus) && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          Tugaskan Staf (PIC)
                        </label>
                        <select
                          name="assign_staff"
                          className="w-full text-[12px] border border-slate-200 bg-white rounded-lg px-3 py-2.5 focus:ring-1 focus:ring-slate-900 outline-none shadow-3xs"
                        >
                          <option value="">-- Kirim ke Antrean Global Divisi (Claim Pool) --</option>
                          {staffList.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.username}
                              {staff.divisi_nama ? ` (${staff.divisi_nama})` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-slate-400 italic">
                          Biarkan kosong untuk mempublikasikan tugas ke kolam klaim divisi (Claim Pool).
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-600">
                          Biaya Desain (Custom)
                        </label>
                        <input
                          type="number"
                          name="biaya_desain"
                          placeholder="Cth: 25000"
                          className="w-full text-[12px] border border-slate-200 bg-white rounded-lg px-3 py-2 focus:ring-1 focus:ring-slate-900 outline-none shadow-3xs"
                        />
                      </div>
                    </div>
                  )}

                  {editModalData.sisa_tagihan > 0 && (
                    <div className="border-t border-slate-200/60 pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold text-slate-700">
                          Pembayaran & Pelunasan
                        </label>
                        <span className="text-[9.5px] font-extrabold text-red-650 bg-red-50/55 px-2 py-0.5 rounded border border-red-200">
                          Sisa: {formatRupiah(editModalData.sisa_tagihan)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500">
                            Bayar Pelunasan (Rp)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              name="jumlah_bayar"
                              placeholder="Cth: 50000"
                              className="w-full text-[12px] border border-slate-200 bg-white rounded-lg pl-3 pr-12 py-2 focus:ring-1 focus:ring-slate-900 outline-none shadow-3xs"
                              id="jumlah_bayar_input"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById('jumlah_bayar_input');
                                if (input) input.value = editModalData.sisa_tagihan;
                              }}
                              className="absolute right-1 top-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[9px] rounded-md cursor-pointer transition-colors"
                            >
                              Lunas
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500">
                            Metode Pembayaran
                          </label>
                          <select
                            name="metode_pembayaran"
                            defaultValue={editModalData.metode_pembayaran || 'tunai'}
                            className="w-full text-[12px] border border-slate-200 bg-white rounded-lg px-2.5 py-2 focus:ring-1 focus:ring-slate-900 outline-none shadow-3xs"
                          >
                            <option value="tunai">Tunai / Kas</option>
                            <option value="transfer">Transfer Bank</option>
                            <option value="qris">QRIS / E-Wallet</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>

              {/* Form Footer Buttons */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-[11px] font-bold text-slate-650 hover:bg-slate-55 transition-colors shadow-3xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingChanges}
                  onClick={() => document.querySelector('form')?.requestSubmit()}
                  className="px-4 py-2 bg-[#714B67] hover:bg-[#5b3c53] text-white rounded-lg text-[11px] font-bold shadow-sm transition-colors cursor-pointer"
                >
                  {savingChanges ? 'Menyimpan…' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>

            {/* PANEL KANAN: TIME LINE AKTIVITAS */}
            <div className="w-full md:w-2/5 bg-slate-50 border-l border-slate-200 flex flex-col h-full">
              
              {/* Chatter Header */}
              <div className="px-5 py-4 border-b border-slate-250 bg-slate-100/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Aktivitas & Log Dokumen</span>
                </div>
                {/* Chatter Tab Switcher */}
                <div className="flex gap-1 bg-slate-200/50 p-0.5 rounded border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChatterTab('logs')}
                    className={`px-2.5 py-0.5 rounded text-[9px] font-extrabold transition-all cursor-pointer ${
                      chatterTab === 'logs'
                        ? 'bg-white shadow-3xs text-slate-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Log
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatterTab('crm')}
                    className={`px-2.5 py-0.5 rounded text-[9px] font-extrabold transition-all cursor-pointer ${
                      chatterTab === 'crm'
                        ? 'bg-white shadow-3xs text-slate-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    CRM
                  </button>
                </div>
              </div>

              {/* Chatter Content Container */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {chatterTab === 'logs' ? (
                  (!editModalData.activity_logs || editModalData.activity_logs.length === 0) ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-12">
                      <FileText size={24} className="text-slate-300 mb-1" />
                      <p className="text-[10px] italic">Belum ada riwayat aktivitas tercatat pada pesanan ini.</p>
                    </div>
                  ) : (
                    editModalData.activity_logs.map((log) => {
                      // Custom styles based on action type (Tindakan)
                      let badgeColor = "bg-slate-100 text-slate-600 border-slate-200";
                      if (log.tindakan === "CREATE_ORDER" || log.tindakan === "READY_ORDER") {
                        badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      } else if (log.tindakan === "ADD_ITEM") {
                        badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100";
                      } else if (log.tindakan === "UPDATE_ORDER" || log.tindakan === "UPDATE_ITEM") {
                        badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                      } else if (log.tindakan === "DELETE_ITEM") {
                        badgeColor = "bg-rose-50 text-rose-700 border-rose-100";
                      } else if (["CLAIM_JOB", "START_JOB", "COMPLETE_JOB"].includes(log.tindakan)) {
                        badgeColor = "bg-[#714B67]/10 text-[#714B67] border-[#714B67]/20";
                      }

                      return (
                        <div key={log.id} className="flex gap-2.5 text-[10.5px] items-start animate-fade-in">
                          {/* Initial Circle Avatar */}
                          <div className="w-7 h-7 rounded-full bg-[#714B67]/10 text-[#714B67] border border-[#714B67]/20 font-extrabold flex items-center justify-center shrink-0 uppercase text-[10px] shadow-3xs">
                            {log.user_nama?.substring(0, 2) || 'SY'}
                          </div>
                          
                          {/* Bubble Chat content */}
                          <div className="bg-white border border-slate-200/80 p-3 rounded-xl shadow-3xs flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100/50 mb-1.5">
                              <span className="font-extrabold text-slate-800 truncate">{log.user_nama || 'System'}</span>
                              <span className="text-[8.5px] text-slate-450 shrink-0">{log.waktu_formatted || log.waktu}</span>
                            </div>
                            
                            {/* Human-readable text */}
                            <p className="text-slate-650 leading-relaxed font-medium break-words">{log.keterangan}</p>
                            
                            {/* Tindakan Badge */}
                            <div className="mt-2 flex">
                              <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-extrabold border uppercase tracking-wider ${badgeColor}`}>
                                {log.tindakan}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  // CRM Follow-Up Tab
                  <div className="space-y-4">
                    {/* Form Jadwalkan Aktivitas Baru */}
                    <div
                      className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-3xs text-slate-800"
                    >
                      <div className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1">
                        <span>📅</span> Jadwalkan Follow-up Baru
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">Tipe</label>
                          <select
                            value={newOrderActivity.tipe}
                            onChange={(e) => setNewOrderActivity({ ...newOrderActivity, tipe: e.target.value })}
                            className="w-full text-[11px] p-1.5 border border-slate-200 rounded bg-slate-50 text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-450"
                          >
                            <option value="whatsapp">WhatsApp</option>
                            <option value="call">Telepon</option>
                            <option value="design_check">Konfirmasi Desain</option>
                            <option value="payment_followup">Follow-up Bayar</option>
                            <option value="other">Lainnya</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 block">Jatuh Tempo</label>
                          <input
                            type="date"
                            value={newOrderActivity.waktu_jatuh_tempo}
                            onChange={(e) => setNewOrderActivity({ ...newOrderActivity, waktu_jatuh_tempo: e.target.value })}
                            className="w-full text-[11px] p-1.5 border border-slate-200 rounded bg-slate-50 text-slate-900 focus:outline-none"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 block">Keterangan / Rencana Tindakan</label>
                        <textarea
                          value={newOrderActivity.keterangan}
                          onChange={(e) => setNewOrderActivity({ ...newOrderActivity, keterangan: e.target.value })}
                          placeholder="Cth: WA ingatkan pelunasan sisa tagihan..."
                          className="w-full text-[11px] p-1.5 border border-slate-200 rounded bg-slate-50 text-slate-900 focus:outline-none resize-none"
                          rows="2"
                          required
                        />
                      </div>
                      
                      <button
                        type="button"
                        onClick={async () => {
                          if (!newOrderActivity.keterangan) {
                            alert('Isi keterangan rencana follow-up!');
                            return;
                          }
                          try {
                            await apiClient.post('/customer-activities/', {
                              order: editModalData.id,
                              tipe: newOrderActivity.tipe,
                              keterangan: newOrderActivity.keterangan,
                              waktu_jatuh_tempo: newOrderActivity.waktu_jatuh_tempo,
                            });
                            setNewOrderActivity({
                              tipe: 'whatsapp',
                              keterangan: '',
                              waktu_jatuh_tempo: new Date().toISOString().slice(0, 10),
                            });
                            await fetchOrderActivities(editModalData.id);
                            alert('Aktivitas follow-up berhasil dijadwalkan!');
                          } catch (err) {
                            console.error('Gagal menjadwalkan aktivitas:', err);
                            alert('Gagal menjadwalkan aktivitas.');
                          }
                        }}
                        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-extrabold shadow-sm transition-colors cursor-pointer"
                      >
                        Jadwalkan Aktivitas
                      </button>
                    </div>

                    {/* Daftar Aktivitas untuk Order ini */}
                    <div className="space-y-2 pt-2">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Daftar Jadwal Follow-Up</div>
                      
                      {loadingOrderActivities ? (
                        <div className="text-center py-4 text-slate-400 text-[10px]">Memuat jadwal...</div>
                      ) : orderActivities.length === 0 ? (
                        <p className="text-center py-4 text-slate-400 text-[10px] italic">Belum ada aktivitas dijadwalkan.</p>
                      ) : (
                        <div className="space-y-2">
                          {orderActivities.map((act) => {
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
                                className={`p-3 rounded-xl border flex justify-between items-start text-[10.5px] ${
                                  act.selesai
                                    ? 'bg-slate-100/60 border-slate-200 opacity-75'
                                    : isOverdue
                                      ? 'bg-red-50/40 border-red-200'
                                      : 'bg-white border-slate-200/80 shadow-3xs'
                                }`}
                              >
                                <div className="space-y-1.5 max-w-[75%]">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                                        act.tipe === 'whatsapp'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                          : act.tipe === 'payment_followup'
                                            ? 'bg-red-50 text-red-700 border border-red-100'
                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                      }`}
                                    >
                                      {tipeLabelMap[act.tipe] || act.tipe}
                                    </span>
                                    <span className={`text-[9px] font-bold ${isOverdue ? 'text-red-600' : 'text-slate-450'}`}>
                                      {new Date(act.waktu_jatuh_tempo).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                      {isOverdue && ' (Terlambat)'}
                                    </span>
                                  </div>
                                  <p className="text-slate-750 font-medium leading-relaxed">{act.keterangan}</p>
                                  <p className="text-[8.5px] text-slate-400">
                                    PIC: <span className="font-bold">{act.pic_username}</span>
                                  </p>
                                </div>

                                {!act.selesai && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await apiClient.post(`/customer-activities/${act.id}/complete/`);
                                        await fetchOrderActivities(editModalData.id);
                                        alert('Aktivitas ditandai selesai!');
                                      } catch (err) {
                                        console.error('Gagal menyelesaikan aktivitas:', err);
                                      }
                                    }}
                                    className="px-2 py-1 bg-emerald-650 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-extrabold shadow-sm transition-colors cursor-pointer"
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
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

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
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 receipt-print-area text-slate-900 text-sm font-mono max-h-[70vh] overflow-y-auto bg-white">
              {/* RESI HEADER */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-4">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">BUKTI PESANAN</p>
                <h2 className="font-black text-[18px] uppercase tracking-wider text-slate-900">RESI</h2>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {new Date(printOrder.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* INFO PELANGGAN */}
              <div className="space-y-1 mb-4 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">No. Order:</span>
                  <span className="font-bold">{printOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelanggan:</span>
                  <span className="font-bold">{printOrder.nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No. WA:</span>
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
                      <span>{formatRupiah(item.harga_jual || 0)}</span>
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
                  <span>{formatRupiah(printOrder.total_harga || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>DP / BAYAR:</span>
                  <span>{formatRupiah(printOrder.dp_dibayar || 0)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-dashed border-slate-300 text-indigo-700">
                  <span>SISA TAGIHAN:</span>
                  <span>
                    {printOrder.total_harga <= 0
                      ? 'Harga belum di-input'
                      : printOrder.sisa_tagihan <= 0
                        ? 'LUNAS'
                        : formatRupiah(printOrder.sisa_tagihan || 0)}
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

            <div className="p-8 print-area bg-white text-slate-800 text-[12px]">
              {/* INVOICE HEADER — 1 baris, tidak duplikasi */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-2xl font-black tracking-widest uppercase text-slate-900">INVOICE</h1>
                  <p className="text-slate-500 font-mono text-[11px] mt-1">#{printInvoiceOrder.id}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {new Date(printInvoiceOrder.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">DITAGIHKAN KEPADA</p>
                  <p className="font-black text-[15px] text-slate-900">{printInvoiceOrder.nama}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{printInvoiceOrder.nomor_wa}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5 capitalize">Metode: {printInvoiceOrder.metode_pembayaran || 'Tunai'}</p>
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
                        {formatRupiah(item.harga_jual)}
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
                      {formatRupiah(
                        printInvoiceOrder.items?.reduce((s, i) => s + (i.harga_jual || 0), 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Diskon ({printInvoiceOrder.diskon_persen || 0}%)</span>
                    <span>
                      -{' '}
                      {formatRupiah(
                        ((printInvoiceOrder.items?.reduce((s, i) => s + (i.harga_jual || 0), 0) ||
                          0) *
                          (printInvoiceOrder.diskon_persen || 0)) /
                          100
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-[14px] border-t border-slate-300 pt-2 text-slate-900">
                    <span>TOTAL</span>
                    <span>{formatRupiah(printInvoiceOrder.total_harga)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>DP Dibayar</span>
                    <span>{formatRupiah(printInvoiceOrder.dp_dibayar)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[14px] bg-slate-100 p-2 rounded border border-slate-200 mt-2">
                    <span>SISA TAGIHAN</span>
                    <span
                      className={
                        printInvoiceOrder.total_harga <= 0 ? 'text-amber-600' : printInvoiceOrder.sisa_tagihan <= 0 ? 'text-emerald-600' : 'text-red-600'
                      }
                    >
                      {printInvoiceOrder.total_harga <= 0
                        ? 'Harga belum di-input'
                        : printInvoiceOrder.sisa_tagihan <= 0
                          ? 'LUNAS'
                          : formatRupiah(printInvoiceOrder.sisa_tagihan)}
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
                className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-md hover:bg-blue-700 flex items-center gap-2 cursor-pointer"
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
              {/* SURAT JALAN HEADER — tidak duplikasi */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                <div>
                  <h1 className="text-xl font-black tracking-widest uppercase text-slate-900">SURAT JALAN</h1>
                  <p className="text-slate-500 font-mono text-[11px] mt-1">#{printSuratJalanOrder.id}</p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    {new Date(printSuratJalanOrder.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">PENERIMA</p>
                  <p className="font-black text-[15px] text-slate-900">{printSuratJalanOrder.nama}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{printSuratJalanOrder.nomor_wa}</p>
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
                className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs rounded-md hover:bg-emerald-700 flex items-center gap-2 cursor-pointer"
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
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 print-area bg-white text-slate-800 text-[11px] leading-tight">
              {/* Header SPK — tidak duplikasi, nama pelanggan ada di Data Customer */}
              <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-slate-900 rounded flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                    SPK
                  </div>
                  <div>
                    <h2 className="font-black text-[13px] tracking-widest uppercase text-slate-900 leading-none">
                      SURAT PERINTAH KERJA
                    </h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Production Order</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px]">
                  <div className="text-right">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase">No Order</span>
                    <span className="font-mono font-black text-red-600 text-xs">#{printSpkOrder.id}</span>
                  </div>
                  <div className="text-right border-l pl-3">
                    <span className="text-slate-400 font-bold block text-[8px] uppercase">Tgl Order</span>
                    <span className="font-bold text-slate-800">
                      {new Date(printSpkOrder.waktu).toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
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
                          {formatRupiah(item.harga_jual || 0)}
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
                      {formatRupiah(printSpkOrder.total_harga || 0)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 p-1.5">
                    <span className="text-slate-400 text-[8px] uppercase">DP</span>
                    <span className="text-right font-black text-indigo-700">
                      {printSpkOrder.dp_dibayar > 0 ? formatRupiah(printSpkOrder.dp_dibayar) : '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 p-1.5 bg-red-50/10">
                    <span className="text-red-900 text-[8px] uppercase">Sisa</span>
                    <span
                      className={`text-right font-black ${printSpkOrder.total_harga <= 0 ? 'text-amber-600' : printSpkOrder.sisa_tagihan <= 0 ? 'text-emerald-600' : 'text-red-650'}`}
                    >
                      {printSpkOrder.total_harga <= 0
                        ? 'Harga belum di-input'
                        : printSpkOrder.sisa_tagihan <= 0
                          ? 'LUNAS'
                          : formatRupiah(printSpkOrder.sisa_tagihan)}
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

      {/* MODAL DAFTAR HARGA UNTUK EDIT ORDER */}
      {editPricelistActiveIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded">
                  <Calculator size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Asisten Daftar Harga (Edit Item)</h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Pilih produk untuk mengisi data item #{editPricelistActiveIndex + 1}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditPricelistActiveIndex(null)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Pencarian */}
            <div className="p-4 border-b border-slate-100 flex gap-3 bg-white">
              <input
                type="text"
                value={priceSearch}
                onChange={(e) => setPriceSearch(e.target.value)}
                placeholder="Cari nama bahan, produk, banner, sticker..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden min-h-[400px]">
              {/* Sidebar Kategori */}
              <div className="w-56 bg-slate-50 border-r border-slate-100 p-2 overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors ${selectedCategory === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200/60'}`}
                >
                  Semua Kategori
                </button>
                {Object.entries(priceCategories).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedCategory(key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-[11px] font-bold transition-colors ${selectedCategory === key ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-200/60'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Daftar Produk */}
              <div className="flex-1 p-4 overflow-y-auto bg-slate-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((prod, idx) => {
                      const currentQty =
                        parseInt(editItems[editPricelistActiveIndex]?.qty || '1') || 1;

                      return (
                        <div
                          key={idx}
                          className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-indigo-300 transition-all"
                        >
                          <div>
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {priceCategories[prod.kategori] || prod.kategori}
                            </span>
                            <h4 className="font-bold text-slate-800 text-xs mt-2 capitalize">
                              {prod.nama_produk}
                              {prod.material ? ` (${prod.material})` : ''}
                            </h4>
                          </div>

                          <div className="mt-4 border-t border-slate-100 pt-3">
                            {prod.price_type === 'flat' ? (
                              <div className="flex justify-between items-center">
                                <span className="text-[13px] font-black text-slate-900">
                                  {formatRupiah(prod.harga)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSelectEditProduct(prod, prod.harga)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                                >
                                  Pilih Item
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase">
                                  Harga Bertingkat (Qty saat ini: {currentQty}):
                                </p>
                                <div className="space-y-1.5">
                                  {Object.entries(prod.tiers || {}).map(([tierKey, tierVal]) => {
                                    const tierPrice = parseInt(tierVal) || 0;

                                    let isMatched;
                                    const cleanKey = tierKey.toLowerCase();
                                    if (cleanKey.includes('-')) {
                                      const parts = cleanKey.split('-');
                                      const min = parseInt(parts[0]) || 0;
                                      const max = parseInt(parts[1]) || 999999;
                                      isMatched = currentQty >= min && currentQty <= max;
                                    } else if (cleanKey.includes('>')) {
                                      const min = parseInt(cleanKey.replace(/[^\d]/g, '')) || 0;
                                      isMatched = currentQty > min;
                                    } else if (cleanKey.includes('<')) {
                                      const max =
                                        parseInt(cleanKey.replace(/[^\d]/g, '')) || 999999;
                                      isMatched = currentQty < max;
                                    } else {
                                      const val = parseInt(cleanKey.replace(/[^\d]/g, '')) || 1;
                                      isMatched = currentQty === val;
                                    }

                                    return (
                                      <div
                                        key={tierKey}
                                        className={`flex justify-between items-center p-1.5 rounded-lg border text-[10px] ${isMatched ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-100'}`}
                                      >
                                        <span
                                          className={`font-semibold ${isMatched ? 'text-emerald-800' : 'text-slate-600'}`}
                                        >
                                          {tierKey}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-slate-800">
                                            {formatRupiah(tierPrice)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => handleSelectEditProduct(prod, tierPrice)}
                                            className={`px-2 py-1 rounded text-[9px] font-bold cursor-pointer ${isMatched ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'}`}
                                          >
                                            Pilih
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-2 text-center py-8 text-slate-400 font-bold text-xs">
                      Tidak ada produk yang cocok dengan pencarian / kategori.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-komponen StatCard
function StatCard({ title, icon: Icon, count, iconColor, subtitle }) {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-20">
      <div className="flex justify-between items-start">
        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{title}</p>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <div>
        <h3 className="text-xl font-extrabold text-slate-900">{count}</h3>
        {subtitle && (
          <p className="text-[9px] text-red-500 font-bold truncate mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// Sub-komponen Skeleton Table Row
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-3 py-3">
        <div className="h-3 bg-slate-200 rounded w-16"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 bg-slate-200 rounded w-20 mb-1"></div>
        <div className="h-2 bg-slate-200 rounded w-16"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 bg-slate-200 rounded w-full"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 bg-slate-200 rounded w-16"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 bg-slate-200 rounded w-16 ms-auto"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-3 bg-slate-200 rounded w-16"></div>
      </td>
      <td className="px-3 py-3">
        <div className="h-5 bg-slate-200 rounded w-8 mx-auto"></div>
      </td>
    </tr>
  );
}
