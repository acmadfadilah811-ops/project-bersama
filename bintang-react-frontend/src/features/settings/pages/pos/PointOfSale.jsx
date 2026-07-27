import { useState, useEffect } from 'react';
import apiClient from '../../../../api/apiClient';
import {
  Wallet,
  Smartphone,
  Receipt,
  Mail,
  Key,
  Sliders,
  Clock,
  Search,
  Timer,
  Users,
  RefreshCw,
  GripVertical,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Info,
  CheckCircle,
  HelpCircle,
  ShieldCheck,
  Percent,
  X,
} from 'lucide-react';
import { useTransaksiCrumb } from '../../../transaksi/components/TransaksiContext';

const POS_TABS = [
  { id: 'pengaturan', label: 'Pengaturan' },
  { id: 'kas-harian', label: 'Saldo Kas Harian (V1)' },
  { id: 'ringkasan-shift', label: 'Ringkasan Shift (V2)' },
];

const POS_MENUS = [
  { id: 'pembayaran', label: 'Pembayaran', icon: Wallet },
  { id: 'perangkat', label: 'Perangkat', icon: Smartphone },
  { id: 'catatan-resi', label: 'Catatan Resi', icon: Receipt },
  { id: 'email-laporan', label: 'Email Laporan', icon: Mail },
  { id: 'passkey', label: 'POS Pass Key', icon: Key },
  { id: 'ext-settings', label: 'POS Ext. Settings', icon: Sliders },
  { id: 'shift', label: 'Shift', icon: Clock },
  { id: 'cek-stok', label: 'Mode - cek stok', icon: Search },
  { id: 'shift-timing', label: 'Shift Timing (POS V1)', icon: Timer },
  { id: 'antrian', label: 'POS Antrian', icon: Users },
];

const EXT_SETTINGS_KEYS = [
  { key: 'hide_packet_item_resi', title: 'Sembunyikan item paket di resi', desc: 'Aktifkan jika Anda tidak ingin rincian dari item paket tercetak di resi' },
  { key: 'merge_qty_item_resi', title: 'Gabungkan Qty item di resi', desc: 'Aktifkan jika Anda ingin di resi item yang sama digabungkan untuk penghematan' },
  { key: 'print_total_qty_resi', title: 'Cetak total qty item di resi', desc: 'Aktifkan jika ingin cetak total qty item pesanan di resi' },
  { key: 'print_note_item_resi', title: 'Cetak catatan item di resi', desc: 'Aktifkan jika ingin cetak catatan item pesanan di resi' },
  { key: 'pos_custom_resi_windows', title: 'Resi POS custom untuk Windows', desc: 'Resi custom disesuaikan untuk kertas A4 atau kertas karbon rangkap 3' },
  { key: 'disable_print_checking', title: 'Non-aktifkan Cetak untuk pengecekan', desc: 'Aktifkan jika tidak perbolehkan cetak resi yang belum dibayar untuk tujuan pengecekan' },
  { key: 'disable_reprint', title: 'Non-aktifkan Cetak Ulang', desc: 'Aktifkan jika tidak perbolehkan cetak ulang resi yang sudah dibayar' },
  { key: 'disable_drawer_reprint', notApplicable: 'laci kas', title: 'Non-aktifkan Buka Laci ketika Cetak Ulang', desc: 'Aktifkan jika tidak perbolehkan buka laci ketika cetak ulang resi melalui riwayat transaksi' },
  { key: 'disable_hold_queue', title: 'Tidak diperbolehkan tahan/antri pesanan', desc: 'Aktifkan jika pesanan harus diselesaikan (dibayar/dikirimkan ke dapur) sebelum mulai pesanan berikutnya' },
  { key: 'hide_other_device_online_tx', title: 'Sembunyikan Transaksi Perangkat Lain/Online', desc: 'Aktifkan jika tidak ingin pengguna POS melihat transaksi dari perangkat POS lain dan online' },
  { key: 'disable_auto_change_qty_view', notApplicable: 'alur ubah qty', title: 'Non-aktifkan otomatis ke tampilan ubah qty item', desc: 'Aktifkan jika tidak ingin otomatis lanjut tampilan ubah qty item setelah menambahkan ke keranjang' },
  { key: 'disable_add_cash_io_type', title: 'Tidak diperbolehkan menambah tipe Kas Masuk/Keluar', desc: 'Aktifkan jika ingin memblokir kasir untuk menambahkan tipe Kas Masuk/Keluar yang baru' },
  { key: 'enable_waiter_tracking', notApplicable: 'pelayan', title: 'Aktifkan lacak Pelayan', desc: 'Setelah diaktifkan, Anda perlu atur user/staff yang menjadi pelayan di POS.' },
  { key: 'block_sell_less_than_buy_price', title: 'POS blokir harga jual < harga beli', desc: 'POS tidak memperbolehkan harga jual di bawah harga beli' },
  { key: 'credit_payment_check_balance', notApplicable: 'saldo kredit pelanggan', title: 'Pembayaran Kredit harus cek saldo', desc: 'Pastikan saldo kredit pelanggan mencukupi sebelum memproses' },
  { key: 'disable_add_custom_item', title: 'Tidak diperbolehkan menambah Item Custom', desc: 'Aktifkan jika ingin memblokir kasir untuk menambahkan Item Custom' },
  { key: 'staff_only_see_same_day_tx', title: 'Staff POS hanya bisa lihat transaksi di hari yg sama', desc: 'Aktifkan jika Anda tidak ingin kasir melihat transaksi hari sebelumnya' },
  { key: 'hide_remaining_stock', title: 'Sembunyikan sisa stok di POS', desc: '' },
  { key: 'hide_customer_list', title: 'Sembunyikan daftar pelanggan', desc: 'Daftar Pelanggan tidak dimunculkan, Kasir harus memasukkan kode/mobile untuk memilih pelanggan' },
  { key: 'disable_dine_in_take_away', notApplicable: 'dine-in/take-away', title: 'Non-aktifkan Dine-In/Take-Away', desc: 'Aktifkan jika tidak membutuhkan penanda Dine-In/Take-Away di transaksi penjualan' },
  { key: 'must_select_table', title: 'Harus memilih Meja', desc: 'Aktifkan jika meja harus dipilih terlebih dahulu sebelum menambahkan item pesanan' },
  { key: 'kitchen_print_normal_font', title: 'Cetakan ke Dapur/Bar dalam font normal', desc: 'Aktifkan jika tidak ingin cetakan ke Dapur/Bar dalam tulisan berukuran besar' },
  { key: 'block_same_order_multi_waiter', notApplicable: 'pelayan', title: 'Blokir pesanan yang sama dilayani beberapa pelayan dalam waktu yang sama', desc: '' },
  { key: 'enable_take_feature', notApplicable: 'fitur pengambilan', title: 'Aktifkan fitur pengambilan', desc: '' },
  { key: 'enable_paper_saving', title: 'Aktifkan fitur hemat kertas', desc: '' },
  { key: 'order_no_reset_daily', title: 'No. Order reset setiap hari', desc: '' },
  { key: 'hide_splitbill', title: 'Sembunyikan Splitbill di POS', desc: '' },
  { key: 'allow_offline_tx', notApplicable: 'mode offline', title: 'Perbolehkan transaksi POS Offline', desc: '' },
  { key: 'allow_backdate_online_tx', notApplicable: 'transaksi backdate', title: 'Perbolehkan transaksi Backdate saat POS Online', desc: '' },
  { key: 'log_cancelled_pos_items', notApplicable: 'log item dibatalkan', title: 'Log Item POS Dibatalkan', desc: '' },
  { key: 'different_customers_same_no', notApplicable: 'validasi nomor pelanggan', title: 'Pelanggan berbeda dapat memiliki nomor yang sama', desc: '' }
];

const METODE_OPTIONS = [
  { value: 'Tunai', label: 'Tunai (Cash)' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'Debit', label: 'Kartu Debit' },
  { value: 'Kredit', label: 'Kartu Kredit' },
  { value: 'Transfer', label: 'Transfer Bank' },
  { value: 'E-Wallet', label: 'E-Wallet (OVO/GoPay/ShopeePay)' },
];

export default function PointOfSale() {
  const { setSubtitle } = useTransaksiCrumb();

  // Set subtitle on mount
  useEffect(() => {
    setSubtitle('Point Of Sale');
  }, [setSubtitle]);

  const [activeTab, setActiveTab] = useState('pengaturan');
  const [activeMenu, setActiveMenu] = useState('pembayaran');
  const [menuCollapsed, setMenuCollapsed] = useState(false);

  const formatIDR = (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'Rp. 0,00';
    return 'Rp. ' + num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fName = (user) => {
    if (!user) return '';
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name || user.username || '';
  };

  // Cara Pembayaran — tersimpan di backend (/pos-payment-methods/).
  const [payments, setPayments] = useState([]);

  // Form state
  const [formType, setFormType] = useState('Tunai');
  const [formName, setFormName] = useState('');
  const [formFeeName, setFormFeeName] = useState('');
  const [formFeeValue, setFormFeeValue] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const fetchPayments = async () => {
    try {
      const res = await apiClient.get('/pos-payment-methods/');
      setPayments(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
      triggerToast('Gagal memuat cara pembayaran.');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!formType || !formName) {
      triggerToast('Tipe dan Nama pembayaran wajib diisi!');
      return;
    }
    try {
      await apiClient.post('/pos-payment-methods/', {
        tipe: formType,
        nama: formName,
        nama_biaya: formFeeName || '',
        nilai_biaya: parseFloat(formFeeValue || 0),
        urutan: payments.length,
      });
      setFormName('');
      setFormFeeName('');
      setFormFeeValue('');
      await fetchPayments();
      triggerToast(`Metode pembayaran "${formName}" berhasil ditambahkan!`);
    } catch (err) {
      console.error('Failed to add payment method:', err);
      triggerToast(err.response?.data?.error || 'Gagal menambahkan cara pembayaran.');
    }
  };

  const handleDeletePayment = async (id, name) => {
    try {
      await apiClient.delete(`/pos-payment-methods/${id}/`);
      await fetchPayments();
      triggerToast(`Metode "${name}" berhasil dihapus.`);
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      triggerToast('Gagal menghapus cara pembayaran.');
    }
  };
  // State & tindakan untuk Perangkat POS (dari Sesi Aktif di Backend)
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState(null);

  const fetchDevices = async () => {
    setLoadingDevices(true);
    setDeviceError(null);
    try {
      const res = await apiClient.get('/security/sessions/');
      const list = res.data.results || res.data || [];
      // Perangkat = sesi login aktif (SessionToken). Tampilkan data apa adanya;
      // tidak ada nomor seri yang dikarang.
      setDevices(
        list
          .filter((s) => s.is_active && !s.is_expired)
          .map((s) => ({
            id: s.id,
            name: s.device_name || '',
            username: s.username,
            ip: s.ip_address || '',
            userAgent: s.user_agent || '',
            lastUsed: s.last_used_at,
          }))
      );
    } catch (err) {
      console.error('Failed to fetch POS devices:', err);
      setDevices([]);
      setDeviceError(
        err.response?.status === 403
          ? 'Butuh akses Owner/Manager untuk melihat perangkat yang terhubung.'
          : 'Gagal memuat daftar perangkat.'
      );
    } finally {
      setLoadingDevices(false);
    }
  };

  // Ambil data perangkat saat menu perangkat aktif
  useEffect(() => {
    if (activeMenu === 'perangkat') {
      fetchDevices();
    }
  }, [activeMenu]);

  const handleRevokeDevice = async (id, label) => {
    if (!window.confirm(`Cabut akses perangkat "${label}"? Pengguna akan otomatis logout.`)) return;
    try {
      await apiClient.delete(`/security/sessions/${id}/`);
      await fetchDevices();
      triggerToast(`Akses perangkat "${label}" telah dicabut.`);
    } catch (err) {
      console.error('Failed to revoke device access:', err);
      // Jangan hapus dari tampilan kalau server menolak — nanti terlihat
      // seolah berhasil padahal sesi masih aktif.
      triggerToast(
        err.response?.status === 403
          ? 'Butuh akses Owner/Manager untuk mencabut sesi.'
          : 'Gagal mencabut akses perangkat.'
      );
    }
  };

  // State & tindakan untuk Catatan Resi, Email Laporan, & POS Pass Key (dari Backend)
  const [namaBisnis, setNamaBisnis] = useState('Avicena CRM');
  
  // Resi States
  const [resiJudul, setResiJudul] = useState('Resi Pembelian');
  const [resiJudulEmail, setResiJudulEmail] = useState('Resi Pembelian');
  const [resiCatatan, setResiCatatan] = useState('Terima Kasih Atas Kunjungan Anda');
  const [resiSembunyikanNoPesanan, setResiSembunyikanNoPesanan] = useState(false);
  const [showAlertBanner, setShowAlertBanner] = useState(true);

  // Email Laporan States
  const [emailPenerima, setEmailPenerima] = useState('');
  const [emailKirimOtomatis, setEmailKirimOtomatis] = useState(false);
  const [showAlertEmailBanner, setShowAlertEmailBanner] = useState(true);

  // POS Pass Key States
  const [pkBelumBayarAktif, setPkBelumBayarAktif] = useState(false);
  const [pkBelumBayarVal, setPkBelumBayarVal] = useState('000000');
  const [pkSudahBayarAktif, setPkSudahBayarAktif] = useState(false);
  const [pkSudahBayarVal, setPkSudahBayarVal] = useState('000000');
  const [pkDiskonAktif, setPkDiskonAktif] = useState(false);
  const [pkDiskonVal, setPkDiskonVal] = useState('000000');
  const [pkPelangganAktif, setPkPelangganAktif] = useState(false);
  const [pkPelangganVal, setPkPelangganVal] = useState('000000');

  // POS Ext Settings States
  const [extSettings, setExtSettings] = useState({
    hide_packet_item_resi: false,
    merge_qty_item_resi: false,
    print_total_qty_resi: false,
    print_note_item_resi: false,
    pos_custom_resi_windows: false,
    disable_print_checking: false,
    disable_reprint: false,
    disable_drawer_reprint: false,
    disable_hold_queue: false,
    hide_other_device_online_tx: false,
    disable_auto_change_qty_view: false,
    disable_add_cash_io_type: false,
    enable_waiter_tracking: false,
    block_sell_less_than_buy_price: false,
    credit_payment_check_balance: false,
    disable_add_custom_item: false,
    staff_only_see_same_day_tx: false,
    hide_remaining_stock: false,
    hide_customer_list: false,
    disable_dine_in_take_away: false,
    must_select_table: false,
    kitchen_print_normal_font: false,
    block_same_order_multi_waiter: false,
    enable_take_feature: false,
    enable_paper_saving: false,
    order_no_reset_daily: false,
    hide_splitbill: false,
    allow_offline_tx: true,
    allow_backdate_online_tx: true,
    log_cancelled_pos_items: true,
    different_customers_same_no: false,
  });

  // POS Shift States
  const [shiftAktif, setShiftAktif] = useState(false);
  const [shiftKasAwal, setShiftKasAwal] = useState(0);
  const [shiftSembunyikanSetor, setShiftSembunyikanSetor] = useState(false);
  const [shiftCekPesananTertahan, setShiftCekPesananTertahan] = useState(false);

  // POS Mode Cek Stok States
  const [stokBlokirJualJikaKosong, setStokBlokirJualJikaKosong] = useState(true);
  const [stokSelaluCekSebelumOrder, setStokSelaluCekSebelumOrder] = useState(false);
  const [stokBlokirHapusJikaAda, setStokBlokirHapusJikaAda] = useState(false);
  const [stokTransferHarusProsesPenerima, setStokTransferHarusProsesPenerima] = useState(false);
  const [stokPostingOtomatisLabaRugi, setStokPostingOtomatisLabaRugi] = useState(false);

  // POS Shift Timing States
  const [shiftTimings, setShiftTimings] = useState([]);
  const [isAddingShiftTiming, setIsAddingShiftTiming] = useState(false);
  const [editingShiftTimingId, setEditingShiftTimingId] = useState(null);
  const [newShiftTitle, setNewShiftTitle] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00:00');

  // POS Antrian States
  const [posAntrianAktif, setPosAntrianAktif] = useState(false);
  const [posAntrianDevices, setPosAntrianDevices] = useState([]);
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [newDeviceSerial, setNewDeviceSerial] = useState('');
  const [newDevicePrefix, setNewDevicePrefix] = useState('');

  // Saldo Kas Harian (V1) States
  const [kasHarianData, setKasHarianData] = useState([]);
  const [isAddingKasHarian, setIsAddingKasHarian] = useState(false);
  const [newKasHarianKasir, setNewKasHarianKasir] = useState('');
  const [kasirSearchTerm, setKasirSearchTerm] = useState('');
  const [showKasirDropdown, setShowKasirDropdown] = useState(false);
  const [newKasHarianShift, setNewKasHarianShift] = useState('');
  const [newKasHarianAwal, setNewKasHarianAwal] = useState('');
  const [newKasHarianAkhir, setNewKasHarianAkhir] = useState('');
  const [editingKasHarianId, setEditingKasHarianId] = useState(null);
  
  // Filters for Kas Harian
  const [filterKasHarianRows, setFilterKasHarianRows] = useState(5);
  const [filterKasHarianDate, setFilterKasHarianDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [filterKasHarianSearch, setFilterKasHarianSearch] = useState('');

  // Dropdown list states
  const [usersList, setUsersList] = useState([]);

  // Ringkasan Shift (V2) States
  const [shiftHarianData, setShiftHarianData] = useState([]);
  const [filterShiftHarianRows, setFilterShiftHarianRows] = useState(5);
  const [filterShiftHarianStartDate, setFilterShiftHarianStartDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [filterShiftHarianEndDate, setFilterShiftHarianEndDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [filterShiftHarianSearch, setFilterShiftHarianSearch] = useState('');
  const [shiftHarianPage, setShiftHarianPage] = useState(1);
  const [shiftHarianGoToPage, setShiftHarianGoToPage] = useState('1');

  // Loading States
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await apiClient.get('/business-settings/');
      if (res.data) {
        setNamaBisnis(res.data.nama_bisnis || 'Avicena CRM');
        setResiJudul(res.data.pos_resi_judul || 'Resi Pembelian');
        setResiJudulEmail(res.data.pos_resi_judul_email || 'Resi Pembelian');
        setResiCatatan(res.data.pos_resi_catatan || 'Terima Kasih Atas Kunjungan Anda');
        setResiSembunyikanNoPesanan(!!res.data.pos_resi_sembunyikan_no_pesanan);
        setEmailPenerima(res.data.pos_email_penerima || '');
        setEmailKirimOtomatis(!!res.data.pos_email_kirim_otomatis);
        
        // Pass Key settings
        setPkBelumBayarAktif(!!res.data.pos_passkey_belum_bayar_aktif);
        setPkBelumBayarVal(res.data.pos_passkey_belum_bayar_val || '000000');
        setPkSudahBayarAktif(!!res.data.pos_passkey_sudah_bayar_aktif);
        setPkSudahBayarVal(res.data.pos_passkey_sudah_bayar_val || '000000');
        setPkDiskonAktif(!!res.data.pos_passkey_diskon_aktif);
        setPkDiskonVal(res.data.pos_passkey_diskon_val || '000000');
        setPkPelangganAktif(!!res.data.pos_passkey_pelanggan_aktif);
        setPkPelangganVal(res.data.pos_passkey_pelanggan_val || '000000');

        // Ext settings
        if (res.data.pos_ext_settings) {
          setExtSettings((prev) => ({
            ...prev,
            ...res.data.pos_ext_settings
          }));
        }

        // Shift settings
        setShiftAktif(!!res.data.pos_shift_aktif);
        setShiftKasAwal(res.data.pos_shift_kas_awal || 0);
        setShiftSembunyikanSetor(!!res.data.pos_shift_sembunyikan_setor);
        setShiftCekPesananTertahan(!!res.data.pos_shift_cek_pesanan_tertahan);

        // Cek Stok settings
        setStokBlokirJualJikaKosong(res.data.pos_stok_blokir_jual_jika_kosong !== undefined ? !!res.data.pos_stok_blokir_jual_jika_kosong : true);
        setStokSelaluCekSebelumOrder(!!res.data.pos_stok_selalu_cek_sebelum_order);
        setStokBlokirHapusJikaAda(!!res.data.pos_stok_blokir_hapus_jika_ada);
        setStokTransferHarusProsesPenerima(!!res.data.pos_stok_transfer_harus_proses_penerima);
        setStokPostingOtomatisLabaRugi(!!res.data.pos_stok_posting_otomatis_laba_rugi);
        setPosAntrianAktif(!!res.data.pos_antrian_aktif);
      }
    } catch (err) {
      console.error('Failed to fetch receipt settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchShiftTimings = async () => {
    setLoadingSettings(true);
    try {
      const res = await apiClient.get('/shift-timing/');
      setShiftTimings(res.data);
    } catch (err) {
      console.error('Failed to fetch shift timings:', err);
      triggerToast('Gagal memuat daftar shift timing.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchPOSAntrianDevices = async () => {
    setLoadingSettings(true);
    try {
      const res = await apiClient.get('/pos-antrian-device/');
      setPosAntrianDevices(res.data);
    } catch (err) {
      console.error('Failed to fetch POS antrian devices:', err);
      triggerToast('Gagal memuat daftar perangkat antrian.');
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'catatan-resi' || activeMenu === 'email-laporan' || activeMenu === 'passkey' || activeMenu === 'ext-settings' || activeMenu === 'shift' || activeMenu === 'cek-stok' || activeMenu === 'antrian') {
      fetchSettings();
      if (activeMenu === 'antrian') {
        fetchPOSAntrianDevices();
        setShowAddDeviceModal(false);
        setEditingDevice(null);
      }
    } else if (activeMenu === 'shift-timing') {
      fetchShiftTimings();
      setIsAddingShiftTiming(false);
      setEditingShiftTimingId(null);
    } else if (activeMenu === 'pembayaran') {
      fetchPayments();
    }
  }, [activeMenu]);

  useEffect(() => {
    if (activeTab === 'kas-harian') {
      fetchKasHarianData();
      fetchUsers();
      fetchShiftTimings();
      setIsAddingKasHarian(false);
      setEditingKasHarianId(null);
      setNewKasHarianKasir('');
      setKasirSearchTerm('');
      setNewKasHarianShift('');
      setNewKasHarianAwal('');
      setNewKasHarianAkhir('');
    }
  }, [activeTab, filterKasHarianDate]);

  useEffect(() => {
    if (activeTab === 'ringkasan-shift') {
      fetchShiftHarianData();
    }
  }, [activeTab, filterShiftHarianStartDate, filterShiftHarianEndDate]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.patch('/business-settings/', {
        pos_resi_judul: resiJudul,
        pos_resi_judul_email: resiJudulEmail,
        pos_resi_catatan: resiCatatan,
        pos_resi_sembunyikan_no_pesanan: resiSembunyikanNoPesanan,
      });
      triggerToast('Pengaturan Catatan Resi berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save receipt settings:', err);
      triggerToast('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.patch('/business-settings/', {
        pos_email_penerima: emailPenerima,
        pos_email_kirim_otomatis: emailKirimOtomatis,
      });
      triggerToast('Pengaturan Email Laporan berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save email settings:', err);
      triggerToast('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSavePassKeySettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.patch('/business-settings/', {
        pos_passkey_belum_bayar_aktif: pkBelumBayarAktif,
        pos_passkey_belum_bayar_val: pkBelumBayarVal,
        pos_passkey_sudah_bayar_aktif: pkSudahBayarAktif,
        pos_passkey_sudah_bayar_val: pkSudahBayarVal,
        pos_passkey_diskon_aktif: pkDiskonAktif,
        pos_passkey_diskon_val: pkDiskonVal,
        pos_passkey_pelanggan_aktif: pkPelangganAktif,
        pos_passkey_pelanggan_val: pkPelangganVal,
      });
      triggerToast('Pengaturan POS Pass Key berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save pass key settings:', err);
      triggerToast('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveExtSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.patch('/business-settings/', {
        pos_ext_settings: extSettings,
      });
      triggerToast('Pengaturan POS Ext. Settings berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save ext settings:', err);
      triggerToast('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveShiftSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.patch('/business-settings/', {
        pos_shift_aktif: shiftAktif,
        pos_shift_kas_awal: shiftKasAwal,
        pos_shift_sembunyikan_setor: shiftSembunyikanSetor,
        pos_shift_cek_pesanan_tertahan: shiftCekPesananTertahan,
      });
      triggerToast('Pengaturan Shift berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save shift settings:', err);
      triggerToast('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveCekStokSettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.patch('/business-settings/', {
        pos_stok_blokir_jual_jika_kosong: stokBlokirJualJikaKosong,
        pos_stok_selalu_cek_sebelum_order: stokSelaluCekSebelumOrder,
        pos_stok_blokir_hapus_jika_ada: stokBlokirHapusJikaAda,
        pos_stok_transfer_harus_proses_penerima: stokTransferHarusProsesPenerima,
        pos_stok_posting_otomatis_laba_rugi: stokPostingOtomatisLabaRugi,
      });
      triggerToast('Pengaturan Mode Cek Stok berhasil disimpan!');
    } catch (err) {
      console.error('Failed to save cek stok settings:', err);
      triggerToast('Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveShiftTiming = async () => {
    if (!newShiftTitle.trim()) {
      triggerToast('Judul shift timing harus diisi!');
      return;
    }
    setSavingSettings(true);
    try {
      const payload = {
        judul: newShiftTitle,
        jam_mulai: newShiftStart,
        jam_berakhir: newShiftEnd
      };

      if (editingShiftTimingId) {
        await apiClient.put(`/shift-timing/${editingShiftTimingId}/`, payload);
        triggerToast('Shift Timing berhasil diperbarui!');
      } else {
        await apiClient.post('/shift-timing/', payload);
        triggerToast('Shift Timing baru berhasil ditambahkan!');
      }

      setIsAddingShiftTiming(false);
      setEditingShiftTimingId(null);
      setNewShiftTitle('');
      fetchShiftTimings();
    } catch (err) {
      console.error('Failed to save shift timing:', err);
      triggerToast('Gagal menyimpan Shift Timing.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteShiftTiming = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus shift timing ini?')) return;
    try {
      await apiClient.delete(`/shift-timing/${id}/`);
      triggerToast('Shift Timing berhasil dihapus!');
      fetchShiftTimings();
    } catch (err) {
      console.error('Failed to delete shift timing:', err);
      triggerToast('Gagal menghapus Shift Timing.');
    }
  };

  const handleEditShiftTimingClick = (item) => {
    setEditingShiftTimingId(item.id);
    setNewShiftTitle(item.judul);
    setNewShiftStart(item.jam_mulai);
    setNewShiftEnd(item.jam_berakhir);
    setIsAddingShiftTiming(true);
  };

  const handleToggleAntrian = async (newValue) => {
    setPosAntrianAktif(newValue);
    try {
      await apiClient.patch('/business-settings/', {
        pos_antrian_aktif: newValue
      });
      triggerToast(`Nomor Antrian di POS berhasil ${newValue ? 'diaktifkan' : 'dinonaktifkan'}!`);
    } catch (err) {
      console.error('Failed to toggle antrian setting:', err);
      triggerToast('Gagal mengubah pengaturan antrian.');
      setPosAntrianAktif(!newValue);
    }
  };

  const handleSaveAntrianDevice = async () => {
    if (!newDeviceSerial.trim()) {
      triggerToast('Serial perangkat harus diisi!');
      return;
    }
    setSavingSettings(true);
    try {
      const payload = {
        serial_perangkat: newDeviceSerial,
        prefix: newDevicePrefix
      };

      if (editingDevice) {
        await apiClient.put(`/pos-antrian-device/${editingDevice.id}/`, payload);
        triggerToast('Perangkat Antrian berhasil diperbarui!');
      } else {
        await apiClient.post('/pos-antrian-device/', payload);
        triggerToast('Perangkat Antrian baru berhasil ditambahkan!');
      }

      setShowAddDeviceModal(false);
      setEditingDevice(null);
      setNewDeviceSerial('');
      setNewDevicePrefix('');
      fetchPOSAntrianDevices();
    } catch (err) {
      console.error('Failed to save POS antrian device:', err);
      triggerToast('Gagal menyimpan perangkat antrian. Pastikan Serial Perangkat unik!');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteAntrianDevice = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus perangkat antrian ini?')) return;
    try {
      await apiClient.delete(`/pos-antrian-device/${id}/`);
      triggerToast('Perangkat Antrian berhasil dihapus!');
      fetchPOSAntrianDevices();
    } catch (err) {
      console.error('Failed to delete POS antrian device:', err);
      triggerToast('Gagal menghapus perangkat antrian.');
    }
  };

  const handleEditAntrianDeviceClick = (item) => {
    setEditingDevice(item);
    setNewDeviceSerial(item.serial_perangkat);
    setNewDevicePrefix(item.prefix || '');
    setShowAddDeviceModal(true);
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users/');
      setUsersList(res.data);
    } catch (err) {
      console.error('Failed to fetch users list:', err);
    }
  };

  const fetchKasHarianData = async () => {
    setLoadingSettings(true);
    try {
      const params = {};
      if (filterKasHarianDate) {
        params.tanggal = filterKasHarianDate;
      }
      if (filterKasHarianSearch) {
        params.query = filterKasHarianSearch;
      }
      const res = await apiClient.get('/saldo-kas-harian/', { params });
      setKasHarianData(res.data);
    } catch (err) {
      console.error('Failed to fetch kas harian data:', err);
      triggerToast('Gagal memuat saldo kas harian.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveKasHarian = async () => {
    if (!newKasHarianKasir) {
      triggerToast('Kasir harus diisi!');
      return;
    }
    if (!newKasHarianShift) {
      triggerToast('Shift harus diisi!');
      return;
    }
    setSavingSettings(true);
    try {
      const payload = {
        kasir: newKasHarianKasir,
        shift: newKasHarianShift,
        kas_awal: parseFloat(newKasHarianAwal) || 0,
      };
      if (newKasHarianAkhir !== '') {
        payload.kas_akhir = parseFloat(newKasHarianAkhir);
      }

      if (editingKasHarianId) {
        await apiClient.put(`/saldo-kas-harian/${editingKasHarianId}/`, payload);
        triggerToast('Saldo Kas Harian berhasil diperbarui!');
      } else {
        await apiClient.post('/saldo-kas-harian/', payload);
        triggerToast('Saldo Kas Harian baru berhasil ditambahkan!');
      }

      setIsAddingKasHarian(false);
      setEditingKasHarianId(null);
      setNewKasHarianKasir('');
      setKasirSearchTerm('');
      setNewKasHarianShift('');
      setNewKasHarianAwal('');
      setNewKasHarianAkhir('');
      fetchKasHarianData();
    } catch (err) {
      console.error('Failed to save kas harian:', err);
      triggerToast('Gagal menyimpan saldo kas harian.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteKasHarian = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus catatan saldo kas harian ini?')) return;
    try {
      await apiClient.delete(`/saldo-kas-harian/${id}/`);
      triggerToast('Saldo Kas Harian berhasil dihapus!');
      fetchKasHarianData();
    } catch (err) {
      console.error('Failed to delete kas harian:', err);
      triggerToast('Gagal menghapus saldo kas harian.');
    }
  };

  const handleEditKasHarianClick = (item) => {
    setEditingKasHarianId(item.id);
    setNewKasHarianKasir(item.kasir || '');
    const foundUser = usersList.find(u => u.id === item.kasir);
    setKasirSearchTerm(foundUser ? fName(foundUser) : '');
    setNewKasHarianShift(item.shift || '');
    setNewKasHarianAwal(item.kas_awal || '0');
    setNewKasHarianAkhir(item.kas_akhir !== null && item.kas_akhir !== undefined ? item.kas_akhir : '');
    setIsAddingKasHarian(true);
  };

  const fetchShiftHarianData = async () => {
    setLoadingSettings(true);
    try {
      const params = {};
      if (filterShiftHarianStartDate) {
        params.tanggal_mulai = filterShiftHarianStartDate;
      }
      if (filterShiftHarianEndDate) {
        params.tanggal_akhir = filterShiftHarianEndDate;
      }
      if (filterShiftHarianSearch) {
        params.query = filterShiftHarianSearch;
      }
      const res = await apiClient.get('/ringkasan-shift/', { params });
      setShiftHarianData(res.data);
    } catch (err) {
      console.error('Failed to fetch shift harian data:', err);
      triggerToast('Gagal memuat ringkasan shift.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleExportExcel = () => {
    if (shiftHarianData.length === 0) {
      triggerToast('Tidak ada data untuk diekspor!');
      return;
    }
    const headers = ['Tanggal', 'Kasir', 'Mulai', 'Berakhir', 'Expected', 'Aktual', 'Selisih'];
    const rows = shiftHarianData.map(item => [
      item.tanggal,
      item.kasir_nama,
      item.mulai ? new Date(item.mulai).toLocaleString('id-ID') : '-',
      item.berakhir ? new Date(item.berakhir).toLocaleString('id-ID') : '-',
      item.expected,
      item.aktual,
      item.selisih
    ]);

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ringkasan_shift_${filterShiftHarianStartDate}_ke_${filterShiftHarianEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Data berhasil diekspor ke Excel (CSV)!');
  };

  const inputCls =
    'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all';

  const filteredUsers = usersList.filter((u) => {
    const query = (kasirSearchTerm || '').toLowerCase();
    const username = (u.username || '').toLowerCase();
    const firstName = (u.first_name || '').toLowerCase();
    const lastName = (u.last_name || '').toLowerCase();
    return username.includes(query) || firstName.includes(query) || lastName.includes(query);
  });

  return (
    <div className="flex flex-col flex-1 bg-slate-50 min-h-screen">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-800 animate-slide-up-fade">
          <CheckCircle size={16} className="text-emerald-400" />
          <span className="text-xs font-semibold">{toastMsg}</span>
        </div>
      )}

      {/* POS Sub-Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 py-1 shrink-0 flex items-center gap-1 overflow-x-auto">
        {POS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-6 max-w-[1400px] w-full mx-auto">
        {activeTab === 'pengaturan' ? (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-1 overflow-hidden min-h-[600px]">
            {/* Sidebar POS Menu */}
            <div
              className={`border-r border-slate-100 bg-slate-50/50 flex flex-col transition-all duration-300 ${
                menuCollapsed ? 'w-16' : 'w-64'
              }`}
            >
              {/* Toggle Collapse */}
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                {!menuCollapsed && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                    Menu POS
                  </span>
                )}
                <button
                  onClick={() => setMenuCollapsed(!menuCollapsed)}
                  className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 cursor-pointer ml-auto"
                  title={menuCollapsed ? 'Expand Menu' : 'Collapse Menu'}
                >
                  {menuCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
              </div>

              {/* Menu Items */}
              <nav className="p-2 space-y-0.5 overflow-y-auto flex-1">
                {POS_MENUS.map((m) => {
                  const Icon = m.icon;
                  const active = activeMenu === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setActiveMenu(m.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left cursor-pointer ${
                        active
                          ? 'bg-blue-50 text-blue-700 font-extrabold'
                          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        size={16}
                        className={`shrink-0 ${active ? 'text-blue-600' : 'text-slate-450 text-slate-400'}`}
                      />
                      {!menuCollapsed && <span className="truncate">{m.label}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Content Panel */}
            <div className="flex-1 p-6 overflow-y-auto bg-white flex flex-col">
              {activeMenu === 'pembayaran' ? (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 flex-1">
                  {/* Left Column: Form (3/5 width) */}
                  <div className="xl:col-span-3 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm">
                            Tambahkan cara pembayaran
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Tambahkan metode pembayaran POS yang valid untuk digunakan kasir.
                          </p>
                        </div>
                        <button
                          onClick={handleAddPayment}
                          disabled={!formName}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
                        >
                          <Plus size={14} /> Simpan
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Cara Pembayaran */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">
                            Cara Pembayaran <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formType}
                            onChange={(e) => setFormType(e.target.value)}
                            className={inputCls}
                          >
                            {METODE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Nama */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">
                            Nama <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Contoh: Tunai Toko, QRIS BCA"
                            className={inputCls}
                            required
                          />
                        </div>

                        {/* Nama Biaya Tambahan */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">
                            Nama Biaya Tambahan
                          </label>
                          <input
                            type="text"
                            value={formFeeName}
                            onChange={(e) => setFormFeeName(e.target.value)}
                            placeholder="Contoh: MDR, Service Charge"
                            className={inputCls}
                          />
                        </div>

                        {/* Tagihan Tambahan */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-500 uppercase">
                            Tagihan Tambahan (%)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={formFeeValue}
                              onChange={(e) => setFormFeeValue(e.target.value)}
                              placeholder="0.0"
                              className={`${inputCls} pr-8`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">
                              %
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3 text-blue-800">
                      <Info size={18} className="shrink-0 text-blue-600 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold">Panduan Konfigurasi</h4>
                        <p className="text-[11px] leading-relaxed text-blue-750 text-slate-650">
                          Biaya tambahan atau MDR (%) biasanya otomatis ditambahkan ke total transaksi 
                          saat kasir memilih metode pembayaran non-tunai ini. Pastikan nama metode 
                          singkat dan mudah dikenali di layar POS kasir.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: List (2/5 width) */}
                  <div className="xl:col-span-2 space-y-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          Cara Pembayaran Aktif
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Urutkan dan kelola cara pembayaran yang tampil pada terminal kasir.
                        </p>
                      </div>

                      {payments.length === 0 ? (
                        <div className="border border-dashed border-slate-200 rounded-xl py-12 px-4 text-center">
                          <Wallet size={32} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-500">Belum ada metode</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Gunakan form di samping kiri untuk membuat cara pembayaran baru.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {payments.map((pay) => (
                            <div
                              key={pay.id}
                              className="flex items-center justify-between p-3 border border-slate-150 border-slate-200 rounded-xl hover:bg-slate-50/60 transition-colors group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="text-slate-400 cursor-grab hover:text-slate-600 active:cursor-grabbing">
                                  <GripVertical size={16} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-extrabold text-slate-800 truncate">
                                    {pay.nama}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-semibold uppercase">
                                    {pay.tipe}
                                    {Number(pay.nilai_biaya) > 0
                                      ? ` • ${pay.nama_biaya || 'Biaya'} +${Number(pay.nilai_biaya)}%`
                                      : ''}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeletePayment(pay.id, pay.nama)}
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Hapus cara pembayaran"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : activeMenu === 'perangkat' ? (
                <div className="flex-1 flex flex-col space-y-6">
                  {/* Header Section */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-3">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">
                        Perangkat POS Aktif
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Perangkat terdaftar otomatis saat pengguna login. Cabut akses untuk
                        memaksa logout perangkat tersebut.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={fetchDevices}
                        disabled={loadingDevices}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={loadingDevices ? 'animate-spin' : ''} /> Muat ulang
                      </button>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold">
                        Sesi aktif ({devices.length})
                      </span>
                    </div>
                  </div>

                  {/* Table Section */}
                  <div className="flex-1 overflow-x-auto min-h-[300px]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50">
                          <th className="py-3 px-4 text-xs font-bold text-slate-500">Perangkat &amp; Operator</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500">Alamat IP</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500">Terakhir Dipakai</th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {loadingDevices ? (
                          <tr>
                            <td colSpan="4" className="py-16 text-center text-slate-400 text-xs font-bold">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <span>Memuat data perangkat aktif...</span>
                              </div>
                            </td>
                          </tr>
                        ) : deviceError ? (
                          <tr>
                            <td colSpan="4" className="py-16 text-center text-amber-600 text-xs font-bold">
                              {deviceError}
                            </td>
                          </tr>
                        ) : devices.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-16 text-center text-slate-400 text-xs font-bold">
                              Tidak ada sesi perangkat yang aktif.
                            </td>
                          </tr>
                        ) : (
                          devices.map((dev) => (
                            <tr key={dev.id} className="hover:bg-slate-50/40 transition-colors">
                              <td className="py-4 px-4 text-xs font-bold text-slate-800">
                                <span className="block text-slate-800">
                                  {dev.name || dev.userAgent?.slice(0, 48) || 'Perangkat tidak dikenal'}
                                </span>
                                {dev.username && (
                                  <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">
                                    Operator: {dev.username}
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-xs font-mono text-slate-600 select-all">
                                {dev.ip || '-'}
                              </td>
                              <td className="py-4 px-4 text-xs text-slate-500 font-semibold">
                                {dev.lastUsed ? new Date(dev.lastUsed).toLocaleString('id-ID') : '-'}
                              </td>
                              <td className="py-4 px-4 text-right">
                                <button
                                  onClick={() => handleRevokeDevice(dev.id, dev.name || dev.username || dev.ip)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                  <Trash2 size={13} /> Cabut akses
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Section */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500 mt-auto">
                    <div>
                      Total {devices.length}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 cursor-not-allowed" disabled type="button">
                          <ChevronLeft size={16} />
                        </button>
                        <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-600 font-extrabold">1</span>
                        <button className="p-1 rounded hover:bg-slate-100 text-slate-400 cursor-not-allowed" disabled type="button">
                          <ChevronRight size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span>Go to</span>
                        <input
                          type="number"
                          defaultValue="1"
                          className="w-12 px-2 py-1 border border-slate-200 rounded text-center outline-none bg-slate-50 text-xs"
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeMenu === 'catatan-resi' ? (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1">
                  {/* Left Column: Form (3/5 width) */}
                  <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                      {/* Title & Save bar */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm">
                            Catatan Resi
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Sesuaikan judul dan teks footer pada cetakan resi transaksi Anda.
                          </p>
                        </div>
                        <button
                          onClick={handleSaveSettings}
                          disabled={savingSettings || loadingSettings}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5 animate-all"
                        >
                          {savingSettings ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Plus size={14} />
                          )}
                          Simpan
                        </button>
                      </div>

                      {/* Alert Banner */}
                      {showAlertBanner && (
                        <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex gap-3 text-slate-600 relative">
                          <Info size={18} className="shrink-0 text-slate-400 mt-0.5" />
                          <div className="pr-6">
                            <p className="text-[11px] leading-relaxed font-semibold text-slate-600">
                              Hasil cetak Resi akan disesuaikan dengan pengaturan Jumlah Kolom pada Pengaturan Printer di aplikasi POS Anda.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowAlertBanner(false)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-650 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                      {loadingSettings ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span>Memuat pengaturan resi...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Judul Resi */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">
                              Judul resi
                            </label>
                            <textarea
                              value={resiJudul}
                              onChange={(e) => setResiJudul(e.target.value)}
                              placeholder="Resi Pembelian"
                              rows={2}
                              className={`${inputCls} resize-none`}
                            />
                            <p className="text-[10px] text-slate-400 font-semibold">
                              Jika kosong, akan berjudul Resi Pembelian
                            </p>
                          </div>

                          {/* Judul Resi Email */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">
                              Judul resi email
                            </label>
                            <textarea
                              value={resiJudulEmail}
                              onChange={(e) => setResiJudulEmail(e.target.value)}
                              placeholder="Resi Pembelian"
                              rows={2}
                              className={`${inputCls} resize-none`}
                            />
                            <p className="text-[10px] text-slate-400 font-semibold">
                              Jika kosong, akan berjudul Resi Pembelian
                            </p>
                          </div>

                          {/* Catatan Resi (Footer) */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-slate-500 uppercase">
                              Catatan Resi
                            </label>
                            <textarea
                              value={resiCatatan}
                              onChange={(e) => setResiCatatan(e.target.value)}
                              placeholder="Terima Kasih Atas Kunjungan Anda"
                              rows={3}
                              className={`${inputCls} resize-none`}
                            />
                            <p className="text-[10px] text-slate-400 font-semibold">
                              Dicetak dibagian bawah resi
                            </p>
                          </div>

                          {/* Sembunyikan no. pesanan Toggle */}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                            <div>
                              <span className="text-[11px] font-bold text-slate-500 uppercase block">
                                Sembunyikan no. pesanan
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                Sembunyikan nomor pesanan/transaksi di bagian atas resi
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold transition-colors ${!resiSembunyikanNoPesanan ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                onClick={() => setResiSembunyikanNoPesanan(!resiSembunyikanNoPesanan)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  resiSembunyikanNoPesanan ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    resiSembunyikanNoPesanan ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs font-bold transition-colors ${resiSembunyikanNoPesanan ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Preview (2/5 width) */}
                  <div className="lg:col-span-2 space-y-4">
                    <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col h-full">
                      <div className="mb-3">
                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                          Preview Resi
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Tampilan simulasi cetakan kertas struk fisik POS.
                        </p>
                      </div>

                      {/* Receipt Mockup Paper */}
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md font-mono text-[11px] text-slate-850 space-y-3 flex-1 flex flex-col select-none max-w-[340px] mx-auto w-full">
                        {/* Receipt Header */}
                        <div className="text-center space-y-1">
                          <h5 className="font-extrabold text-xs uppercase tracking-wide">{namaBisnis}</h5>
                          <div className="text-[9px] text-slate-500 font-semibold space-y-0.5">
                            <p>03 Okt 2022 09:00</p>
                            <div className="flex justify-between px-2">
                              <span>Kasir: Budiman</span>
                              <span>Pelanggan: Jerompolin</span>
                            </div>
                            {!resiSembunyikanNoPesanan && (
                              <p className="font-mono text-[9px] border border-dashed border-slate-200 py-0.5 px-1 bg-slate-50 rounded mt-1">
                                #1231230129312093
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Dashed Line */}
                        <div className="border-t border-dashed border-slate-300 my-1"></div>

                        {/* Queue Info */}
                        <div className="text-center font-bold text-[10px] text-slate-700 bg-slate-50 py-1 rounded">
                          Antrian B01 (DINE-IN)
                        </div>

                        {/* Title of Receipt (Judul resi) */}
                        <div className="text-center font-extrabold uppercase text-[10px] text-slate-900 tracking-wide mt-1">
                          {resiJudul ? resiJudul : 'Resi Pembelian'}
                        </div>

                        {/* Dashed Line */}
                        <div className="border-t border-dashed border-slate-300 my-1"></div>

                        {/* Receipt Items */}
                        <div className="space-y-2 text-[10px] font-medium">
                          <div className="flex justify-between">
                            <span className="font-bold">Burger - Cheese</span>
                            <span className="font-bold">Rp. 24.000</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[9px] px-2 font-semibold">
                            <span>Rp. 12.000</span>
                            <span>x2</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="font-bold">Fried Fries</span>
                            <span className="font-bold">Rp. 15.000</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[9px] px-2 font-semibold">
                            <span>Rp. 15.000</span>
                            <span>x1</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="font-bold">Paket Hemat</span>
                            <span className="font-bold">Rp. 105.000</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[9px] px-2 font-semibold">
                            <span>Rp. 35.000</span>
                            <span>x3</span>
                          </div>
                        </div>

                        {/* Dashed Line */}
                        <div className="border-t border-dashed border-slate-300 my-1"></div>

                        {/* Totals Section */}
                        <div className="space-y-1 text-[9px] text-slate-650 font-semibold">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>Rp. 144.000</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Service charge 0.01%</span>
                            <span>Rp. 14</span>
                          </div>
                          <div className="flex justify-between">
                            <span>PPN 11%</span>
                            <span>Rp. 15.840</span>
                          </div>
                          <div className="flex justify-between text-slate-900 font-extrabold text-[10px] border-t border-dotted border-slate-200 pt-1 mt-1 font-mono">
                            <span>Total</span>
                            <span>Rp. 159.854</span>
                          </div>
                          <div className="flex justify-between text-slate-700">
                            <span>Tunai</span>
                            <span>Rp. 160.000</span>
                          </div>
                          <div className="flex justify-between text-slate-700">
                            <span>Kembali</span>
                            <span>Rp. 146</span>
                          </div>
                        </div>

                        {/* Dashed Line */}
                        <div className="border-t border-dashed border-slate-300 my-1"></div>

                        {/* Operator info and Catatan Resi */}
                        <div className="text-center text-[9px] text-slate-500 space-y-2 mt-auto font-semibold">
                          <p>Dilayani oleh : Budiman</p>
                          {resiCatatan && (
                            <p className="text-[10px] text-slate-800 font-bold italic tracking-wide break-words border-t border-slate-100 pt-2 whitespace-pre-line">
                              {resiCatatan}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeMenu === 'email-laporan' ? (
                <div className="max-w-3xl w-full mx-auto space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    {/* Header & Save Bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          Email Laporan
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Tentukan tujuan email penerima ringkasan laporan operasional POS.
                        </p>
                      </div>
                      <button
                        onClick={handleSaveEmailSettings}
                        disabled={savingSettings || loadingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5 animate-all"
                      >
                        {savingSettings ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Plus size={14} />
                        )}
                        Simpan
                      </button>
                    </div>

                    {/* Alert Banner */}
                    {showAlertEmailBanner && (
                      <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 flex gap-3 text-slate-600 relative">
                        <Info size={18} className="shrink-0 text-slate-400 mt-0.5" />
                        <div className="pr-6">
                          <p className="text-[11px] leading-relaxed font-semibold text-slate-600">
                            Berlaku untuk POS Ver. 2+
                          </p>
                        </div>
                        <button
                          onClick={() => setShowAlertEmailBanner(false)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-650 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {loadingSettings ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat pengaturan email...</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Email Penerima */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                          <div className="md:col-span-1 pt-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase block">
                              Email Penerima
                            </label>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                              Tambah Email Penerima
                            </span>
                          </div>
                          <div className="md:col-span-3 space-y-2">
                            <textarea
                              value={emailPenerima}
                              onChange={(e) => setEmailPenerima(e.target.value)}
                              placeholder="admin@bisnis.com, owner@bisnis.com"
                              rows={3}
                              className={inputCls}
                            />
                            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                              Tuliskan email penerima yang akan menerima "Laporan Tutup Penjualan" dari aplikasi POS. Multi akun pisahkan dengan koma .
                            </p>
                          </div>
                        </div>

                        {/* Automatic Email Send Toggle */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                          <div className="max-w-md">
                            <span className="text-xs font-bold text-slate-700 block">
                              Setiap pagi sistem akan otomatis mengirimkan ringkasan tutup penjualan
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-xs font-bold transition-colors ${!emailKirimOtomatis ? 'text-blue-600' : 'text-slate-400'}`}>
                              Tidak
                            </span>
                            <button
                              type="button"
                              onClick={() => setEmailKirimOtomatis(!emailKirimOtomatis)}
                              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                emailKirimOtomatis ? 'bg-blue-600' : 'bg-slate-300'
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                  emailKirimOtomatis ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className={`text-xs font-bold transition-colors ${emailKirimOtomatis ? 'text-blue-600' : 'text-slate-400'}`}>
                              Ya
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeMenu === 'passkey' ? (
                <div className="max-w-3xl w-full mx-auto space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    {/* Header & Save Bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          POS Pass Key
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Pass Key berupa kombinasi angka, minimal 6 digit, untuk memberikan otoritas aksi di POS.
                        </p>
                      </div>
                      <button
                        onClick={handleSavePassKeySettings}
                        disabled={savingSettings || loadingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
                      >
                        {savingSettings ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Plus size={14} />
                        )}
                        Simpan
                      </button>
                    </div>

                    {loadingSettings ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat pengaturan pass key...</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* 1. Belum Bayar */}
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-slate-50 text-slate-500 rounded-lg mt-0.5 border border-slate-100">
                                <Key size={18} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                  Pass Key kelola pesanan yg belum dibayar
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  Seperti mengubah qty item, menghapus item / biaya, atau batalkan pesanan
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold transition-colors ${!pkBelumBayarAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Non-aktif
                              </span>
                              <button
                                type="button"
                                onClick={() => setPkBelumBayarAktif(!pkBelumBayarAktif)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  pkBelumBayarAktif ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    pkBelumBayarAktif ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs font-bold transition-colors ${pkBelumBayarAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Aktif
                              </span>
                            </div>
                          </div>
                          <div className="pl-11 max-w-md">
                            <input
                              type="text"
                              maxLength={12}
                              pattern="\d*"
                              disabled={!pkBelumBayarAktif}
                              value={pkBelumBayarVal}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setPkBelumBayarVal(val);
                              }}
                              className={`${inputCls} font-mono ${!pkBelumBayarAktif ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                              placeholder="000000"
                            />
                            {pkBelumBayarAktif && pkBelumBayarVal.length < 6 && (
                              <span className="text-[9px] text-red-500 font-bold block mt-1">
                                Pass Key minimal 6 digit angka
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Sudah Bayar */}
                        <div className="space-y-3 border-t border-slate-100 pt-5">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-slate-50 text-slate-500 rounded-lg mt-0.5 border border-slate-100">
                                <ShieldCheck size={18} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                  Pass Key kelola pesanan yg sudah dibayar
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  Seperti mengubah qty item, menghapus item / biaya, atau batalkan pesanan, edit / tambah printer, edit mode pelayan, buka laci kas
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold transition-colors ${!pkSudahBayarAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Non-aktif
                              </span>
                              <button
                                type="button"
                                onClick={() => setPkSudahBayarAktif(!pkSudahBayarAktif)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  pkSudahBayarAktif ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    pkSudahBayarAktif ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs font-bold transition-colors ${pkSudahBayarAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Otoritas Aktif
                              </span>
                            </div>
                          </div>
                          <div className="pl-11 max-w-md">
                            <input
                              type="text"
                              maxLength={12}
                              pattern="\d*"
                              disabled={!pkSudahBayarAktif}
                              value={pkSudahBayarVal}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setPkSudahBayarVal(val);
                              }}
                              className={`${inputCls} font-mono ${!pkSudahBayarAktif ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                              placeholder="000000"
                            />
                            {pkSudahBayarAktif && pkSudahBayarVal.length < 6 && (
                              <span className="text-[9px] text-red-500 font-bold block mt-1">
                                Pass Key minimal 6 digit angka
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3. Diskon */}
                        <div className="space-y-3 border-t border-slate-100 pt-5">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-slate-50 text-slate-500 rounded-lg mt-0.5 border border-slate-100">
                                <Percent size={18} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                  Pass Key pemberian diskon
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  Berlaku untuk diskon item atau pesanan
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold transition-colors ${!pkDiskonAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Non-aktif
                              </span>
                              <button
                                type="button"
                                onClick={() => setPkDiskonAktif(!pkDiskonAktif)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  pkDiskonAktif ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    pkDiskonAktif ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs font-bold transition-colors ${pkDiskonAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Otoritas Aktif
                              </span>
                            </div>
                          </div>
                          <div className="pl-11 max-w-md">
                            <input
                              type="text"
                              maxLength={12}
                              pattern="\d*"
                              disabled={!pkDiskonAktif}
                              value={pkDiskonVal}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setPkDiskonVal(val);
                              }}
                              className={`${inputCls} font-mono ${!pkDiskonAktif ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                              placeholder="000000"
                            />
                            {pkDiskonAktif && pkDiskonVal.length < 6 && (
                              <span className="text-[9px] text-red-500 font-bold block mt-1">
                                Pass Key minimal 6 digit angka
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 4. Kelola Pelanggan */}
                        <div className="space-y-3 border-t border-slate-100 pt-5">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-3">
                              <div className="p-2 bg-slate-50 text-slate-500 rounded-lg mt-0.5 border border-slate-100">
                                <Users size={18} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800">
                                  Pass Key kelola pelanggan
                                </h4>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  Seperti menambah, ubah, dan hapus data pelanggan
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`text-xs font-bold transition-colors ${!pkPelangganAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Non-aktif
                              </span>
                              <button
                                type="button"
                                onClick={() => setPkPelangganAktif(!pkPelangganAktif)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  pkPelangganAktif ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    pkPelangganAktif ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-xs font-bold transition-colors ${pkPelangganAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                                Otoritas Aktif
                              </span>
                            </div>
                          </div>
                          <div className="pl-11 max-w-md">
                            <input
                              type="text"
                              maxLength={12}
                              pattern="\d*"
                              disabled={!pkPelangganAktif}
                              value={pkPelangganVal}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setPkPelangganVal(val);
                              }}
                              className={`${inputCls} font-mono ${!pkPelangganAktif ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                              placeholder="000000"
                            />
                            {pkPelangganAktif && pkPelangganVal.length < 6 && (
                              <span className="text-[9px] text-red-500 font-bold block mt-1">
                                Pass Key minimal 6 digit angka
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeMenu === 'ext-settings' ? (
                <div className="max-w-3xl w-full mx-auto space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    {/* Header & Save Bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          POS Ext. Settings
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Konfigurasi lanjutan cetakan resi, pembatasan operasional kasir, dan penyesuaian alur Point of Sale.
                        </p>
                      </div>
                      <button
                        onClick={handleSaveExtSettings}
                        disabled={savingSettings || loadingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
                      >
                        {savingSettings ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Plus size={14} />
                        )}
                        Simpan
                      </button>
                    </div>

                    {loadingSettings ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat pengaturan lanjutan...</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {EXT_SETTINGS_KEYS.map((item) => {
                          const val = !!extSettings[item.key];
                          return (
                            <div key={item.key} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-6">
                              <div className="max-w-xl">
                                <span className="text-xs font-bold text-slate-700 block">
                                  {item.title}
                                </span>
                                {item.desc && (
                                  <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 leading-relaxed">
                                    {item.desc}
                                  </span>
                                )}
                                {item.notApplicable && (
                                  <span className="text-[10px] text-amber-600 font-bold block mt-1 leading-relaxed">
                                    Belum berpengaruh — fitur {item.notApplicable} belum ada di aplikasi ini.
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                <span className={`text-[11px] font-bold transition-colors ${!val ? 'text-blue-600' : 'text-slate-400'}`}>
                                  Tidak
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExtSettings((prev) => ({
                                      ...prev,
                                      [item.key]: !val
                                    }));
                                  }}
                                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                    val ? 'bg-blue-600' : 'bg-slate-300'
                                  }`}
                                >
                                  <div
                                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                      val ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                                <span className={`text-[11px] font-bold transition-colors ${val ? 'text-blue-600' : 'text-slate-400'}`}>
                                  Ya
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeMenu === 'shift' ? (
                <div className="max-w-2xl w-full mx-auto space-y-6">
                  {/* Alert Banner */}
                  <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 text-sky-800 shadow-sm">
                    <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-sky-800">Info Versi</h4>
                      <p className="text-[10px] text-sky-600 font-semibold mt-0.5 leading-relaxed">
                        Berlaku untuk POS Ver. 2+
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    {/* Header & Save Bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          Pengaturan Shift
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Konfigurasi modal kas laci dan aturan tutup sesi kasir.
                        </p>
                      </div>
                      <button
                        onClick={handleSaveShiftSettings}
                        disabled={savingSettings || loadingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
                      >
                        {savingSettings ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Simpan
                      </button>
                    </div>

                    {loadingSettings ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat pengaturan shift...</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* 1. Aktifkan Shift */}
                        <div className="flex items-start justify-between gap-6 pb-5 border-b border-slate-100">
                          <div className="max-w-md">
                            <span className="text-xs font-bold text-slate-800 block">
                              Aktifkan Shift
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 leading-relaxed">
                              Aktifkan pengelompokan transaksi berdasarkan sesi waktu kerja kasir.
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 pt-0.5">
                            <span className={`text-[11px] font-bold transition-colors ${!shiftAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                              Tidak
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = !shiftAktif;
                                setShiftAktif(nextVal);
                                if (!nextVal) {
                                  setShiftSembunyikanSetor(false);
                                  setShiftCekPesananTertahan(false);
                                }
                              }}
                              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                shiftAktif ? 'bg-blue-600' : 'bg-slate-300'
                              }`}
                            >
                              <div
                                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                  shiftAktif ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className={`text-[11px] font-bold transition-colors ${shiftAktif ? 'text-blue-600' : 'text-slate-400'}`}>
                              Ya
                            </span>
                          </div>
                        </div>

                        {/* 2. Kas awal di laci */}
                        <div className="flex flex-col gap-2 pb-5 border-b border-slate-100">
                          <div className="flex items-start justify-between gap-6">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Kas awal di laci
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 leading-relaxed">
                                Ini hanya nilai awal, Anda masih dapat mengubahnya di POS
                              </span>
                            </div>
                            <div className="w-48 shrink-0">
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs font-bold text-slate-400">Rp.</span>
                                <input
                                  type="text"
                                  disabled={!shiftAktif}
                                  value={shiftKasAwal.toLocaleString('id-ID')}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                                    setShiftKasAwal(val);
                                  }}
                                  className={`${inputCls} pl-10 text-right font-semibold ${!shiftAktif ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''}`}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Section: Akhir Shift */}
                        <div className="space-y-4 pt-1">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs pb-1">
                            <span>Akhir Shift</span>
                            <ChevronDown size={14} className="text-slate-400" />
                          </div>

                          {/* Sembunyikan jumlah uang yang harus disetor saat tutup sesi */}
                          <div className="flex items-start justify-between gap-6 pb-4 border-b border-slate-100">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Sembunyikan jumlah uang yang harus disetor saat tutup sesi
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!shiftSembunyikanSetor ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                disabled={!shiftAktif}
                                onClick={() => setShiftSembunyikanSetor(!shiftSembunyikanSetor)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  !shiftAktif ? 'opacity-50 cursor-not-allowed bg-slate-200' : shiftSembunyikanSetor ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    shiftSembunyikanSetor ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${shiftSembunyikanSetor ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>

                          {/* Cek Pesanan tertahan */}
                          <div className="flex items-start justify-between gap-6">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Cek Pesanan tertahan
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!shiftCekPesananTertahan ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                disabled={!shiftAktif}
                                onClick={() => setShiftCekPesananTertahan(!shiftCekPesananTertahan)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  !shiftAktif ? 'opacity-50 cursor-not-allowed bg-slate-200' : shiftCekPesananTertahan ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    shiftCekPesananTertahan ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${shiftCekPesananTertahan ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeMenu === 'cek-stok' ? (
                <div className="max-w-2xl w-full mx-auto space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    {/* Header & Save Bar */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          Mode - Cek Stok
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Konfigurasi sinkronisasi, validasi, dan pembatasan stok di Point of Sale.
                        </p>
                      </div>
                      <button
                        onClick={handleSaveCekStokSettings}
                        disabled={savingSettings || loadingSettings}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer flex items-center gap-1.5"
                      >
                        {savingSettings ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Simpan
                      </button>
                    </div>

                    {loadingSettings ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat pengaturan cek stok...</span>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        
                        {/* Section 1: Jual - Tidak ada stok */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs pb-1 border-b border-slate-100">
                            <span>Jual - Tidak ada stok</span>
                            <ChevronDown size={14} className="text-slate-400" />
                          </div>
                          
                          {/* Alert Banner */}
                          <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 text-sky-800 shadow-sm">
                            <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-sky-600 font-semibold leading-relaxed">
                                Koneksi internet yang stabil dibutuhkan untuk memastikan stok ter-sinkronisasi. (Utk POS Ver. 2+)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-6 pt-2">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Tidak diperbolehkan menjual barang jika tidak ada stok
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!stokBlokirJualJikaKosong ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                onClick={() => setStokBlokirJualJikaKosong(!stokBlokirJualJikaKosong)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  stokBlokirJualJikaKosong ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    stokBlokirJualJikaKosong ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${stokBlokirJualJikaKosong ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Section 2: Mode - cek stok */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs pb-1 border-b border-slate-100">
                            <span>Mode - cek stok</span>
                            <ChevronDown size={14} className="text-slate-400" />
                          </div>

                          {/* Alert Banner */}
                          <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3 text-sky-800 shadow-sm">
                            <Info size={18} className="text-sky-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] text-sky-600 font-semibold leading-relaxed">
                                Peringatan! Pastikan POS dijalankan dengan koneksi internet yang stabil apabila mengaktifkan mode ini. (Hanya utk POS Ver. 1)
                              </p>
                            </div>
                          </div>

                          {/* Row 1 */}
                          <div className="flex items-start justify-between gap-6 pt-2">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Selalu cek stok sebelum menambahkan barang orderan
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!stokSelaluCekSebelumOrder ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                onClick={() => setStokSelaluCekSebelumOrder(!stokSelaluCekSebelumOrder)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  stokSelaluCekSebelumOrder ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    stokSelaluCekSebelumOrder ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${stokSelaluCekSebelumOrder ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>

                          {/* Row 2 */}
                          <div className="flex items-start justify-between gap-6 pt-2">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Blokir hapus barang jika ada stok
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!stokBlokirHapusJikaAda ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                onClick={() => setStokBlokirHapusJikaAda(!stokBlokirHapusJikaAda)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  stokBlokirHapusJikaAda ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    stokBlokirHapusJikaAda ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${stokBlokirHapusJikaAda ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Section 3: Transfer stok */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs pb-1 border-b border-slate-100">
                            <span>Transfer stok</span>
                            <ChevronDown size={14} className="text-slate-400" />
                          </div>

                          <div className="flex items-start justify-between gap-6 pt-2">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Harus diproses oleh toko penerima
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 leading-relaxed">
                                Toko penerima akan mengecek stock yang diterima sebelum mem-posting.
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!stokTransferHarusProsesPenerima ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                onClick={() => setStokTransferHarusProsesPenerima(!stokTransferHarusProsesPenerima)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  stokTransferHarusProsesPenerima ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    stokTransferHarusProsesPenerima ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${stokTransferHarusProsesPenerima ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Section 4: Laba / Rugi */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs pb-1 border-b border-slate-100">
                            <span>Laba / Rugi</span>
                            <ChevronDown size={14} className="text-slate-400" />
                          </div>

                          <div className="flex items-start justify-between gap-6 pt-2">
                            <div className="max-w-md">
                              <span className="text-xs font-bold text-slate-800 block">
                                Posting otomatis laba / rugi
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className={`text-[11px] font-bold transition-colors ${!stokPostingOtomatisLabaRugi ? 'text-blue-600' : 'text-slate-400'}`}>
                                Tidak
                              </span>
                              <button
                                type="button"
                                onClick={() => setStokPostingOtomatisLabaRugi(!stokPostingOtomatisLabaRugi)}
                                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 outline-none ${
                                  stokPostingOtomatisLabaRugi ? 'bg-blue-600' : 'bg-slate-300'
                                }`}
                              >
                                <div
                                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-300 ${
                                    stokPostingOtomatisLabaRugi ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                              <span className={`text-[11px] font-bold transition-colors ${stokPostingOtomatisLabaRugi ? 'text-blue-600' : 'text-slate-400'}`}>
                                Ya
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              ) : activeMenu === 'shift-timing' ? (
                <div className="max-w-2xl w-full mx-auto space-y-6">
                  {isAddingShiftTiming ? (
                    /* TAMBAH/EDIT SHIFT TIMING FORM VIEW */
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                      {/* Form Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          {editingShiftTimingId ? 'Ubah Shift Timing' : 'Tambah Shift Timing'}
                        </h3>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingShiftTiming(false);
                              setEditingShiftTimingId(null);
                              setNewShiftTitle('');
                            }}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveShiftTiming}
                            disabled={savingSettings || !newShiftTitle.trim()}
                            className="px-4 py-2 bg-blue-600 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow cursor-pointer"
                          >
                            {savingSettings ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        </div>
                      </div>

                      {/* Form Content */}
                      <div className="space-y-6 py-2">
                        {/* Judul Input */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                          <label className="sm:w-28 text-xs font-bold text-slate-700 flex items-center">
                            <span className="text-red-500 mr-1">*</span> Judul
                          </label>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={newShiftTitle}
                              onChange={(e) => setNewShiftTitle(e.target.value)}
                              placeholder="Masukkan Judul"
                              className="w-full max-w-lg px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Jam Mulai Input */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                          <label className="sm:w-28 text-xs font-bold text-slate-700">
                            Jam Mulai
                          </label>
                          <div className="relative w-full max-w-[200px]">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                              <Clock size={14} />
                            </span>
                            <input
                              type="time"
                              step="1"
                              value={newShiftStart}
                              onChange={(e) => setNewShiftStart(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>

                        {/* Jam Berakhir Input */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                          <label className="sm:w-28 text-xs font-bold text-slate-700">
                            Jam Berakhir
                          </label>
                          <div className="relative w-full max-w-[200px]">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                              <Clock size={14} />
                            </span>
                            <input
                              type="time"
                              step="1"
                              value={newShiftEnd}
                              onChange={(e) => setNewShiftEnd(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SHIFT TIMINGS LIST VIEW */
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div>
                          <h3 className="font-extrabold text-slate-800 text-sm">
                            Shift Timing
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Kelola jadwal operasional shift kerja Point Of Sale.
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingShiftTimingId(null);
                            setNewShiftTitle('');
                            // Default to current time formatted as HH:MM:SS
                            const now = new Date();
                            const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS
                            setNewShiftStart(timeString);
                            setNewShiftEnd(timeString);
                            setIsAddingShiftTiming(true);
                          }}
                          className="px-4 py-2 bg-[#75C043] hover:bg-[#66a83a] text-white rounded-lg text-xs font-bold hover:shadow transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} />
                          Tambah
                        </button>
                      </div>

                      {loadingSettings ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span>Memuat daftar shift...</span>
                        </div>
                      ) : shiftTimings.length === 0 ? (
                        /* GORGEOUS ILLUSTRATION EMPTY STATE - EXACTLY MATCHING DESIGN ELEMENTS */
                        <div className="border border-slate-100 rounded-xl bg-slate-50/50 py-12 px-6 flex flex-col items-center justify-center text-center">
                          {/* Polar Bear & Igloo CSS Art / SVG */}
                          <div className="w-64 h-48 flex items-center justify-center relative mb-6">
                            {/* Blue Igloo Background */}
                            <svg className="w-56 h-40 drop-shadow-md" viewBox="0 0 200 150" fill="none">
                              {/* Igloo Dome */}
                              <path d="M20,130 C20,50 180,50 180,130 Z" fill="#EBF3FC" stroke="#B9D5F4" strokeWidth="3" />
                              {/* Ice Blocks Grid Pattern */}
                              <path d="M40,90 C70,75 130,75 160,90 M60,65 C90,55 110,55 140,65" stroke="#D1E4F9" strokeWidth="2" strokeDasharray="5,5" />
                              <path d="M60,130 L60,90 M100,130 L100,80 M140,130 L140,90 M70,90 L70,65 M130,90 L130,65" stroke="#D1E4F9" strokeWidth="2" />
                              {/* Igloo Doorway (Arch) */}
                              <path d="M75,130 C75,95 125,95 125,130 Z" fill="#91C3F7" stroke="#6AA6E8" strokeWidth="3" />
                              {/* Polar Bear face peeking out */}
                              <g transform="translate(10, 10)">
                                {/* Bear head */}
                                <circle cx="90" cy="110" r="22" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                                {/* Bear Left Ear */}
                                <circle cx="74" cy="94" r="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                                <circle cx="74" cy="94" r="3" fill="#FFEAEF" />
                                {/* Bear Right Ear */}
                                <circle cx="106" cy="94" r="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                                <circle cx="106" cy="94" r="3" fill="#FFEAEF" />
                                {/* Bear Eyes */}
                                <circle cx="83" cy="106" r="2.5" fill="#1A202C" />
                                <circle cx="97" cy="106" r="2.5" fill="#1A202C" />
                                {/* Bear Muzzle */}
                                <ellipse cx="90" cy="115" rx="7" ry="5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                                <polygon points="87,113 93,113 90,116" fill="#1A202C" />
                              </g>
                            </svg>
                          </div>
                          
                          <h4 className="text-sm font-extrabold text-slate-700">
                            Belum ada karyawan yang memiliki Pass Key
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 max-w-sm leading-relaxed">
                            Silakan tambahkan jadwal shift timing baru dengan menekan tombol "+ Tambah" di atas.
                          </p>
                        </div>
                      ) : (
                        /* SHIFT TIMINGS DATA LIST */
                        <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Judul
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Jam Mulai
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Jam Berakhir
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Aksi
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {shiftTimings.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-800">
                                    {item.judul}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                                    {item.jam_mulai}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                                    {item.jam_berakhir}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-3">
                                    <button
                                      onClick={() => handleEditShiftTimingClick(item)}
                                      className="text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
                                    >
                                      Ubah
                                    </button>
                                    <button
                                      onClick={() => handleDeleteShiftTiming(item.id)}
                                      className="text-red-600 hover:text-red-800 font-bold transition-colors cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : activeMenu === 'antrian' ? (
                <div className="max-w-4xl w-full mx-auto space-y-6">
                  {/* CARD 1: Toggle Aktifkan No. Antrian di POS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800">
                        Aktifkan No. Antrian di POS
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {posAntrianAktif ? 'Aktif' : 'Non-aktif'}
                      </p>
                    </div>
                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggleAntrian(!posAntrianAktif)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        posAntrianAktif ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          posAntrianAktif ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* CARD 2: Perangkat POS */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
                    {/* Card Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          Perangkat POS
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Hubungkan perangkat POS Anda untuk mengatur antrian pesanan.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingDevice(null);
                          setNewDeviceSerial('');
                          setNewDevicePrefix('');
                          setShowAddDeviceModal(true);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold hover:shadow transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} />
                        Tambah
                      </button>
                    </div>

                    {/* Devices list or empty state */}
                    {loadingSettings ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span>Memuat perangkat...</span>
                      </div>
                    ) : posAntrianDevices.length === 0 ? (
                      /* Polar Bear empty state */
                      <div className="border border-slate-100 rounded-xl bg-slate-50/50 py-12 px-6 flex flex-col items-center justify-center text-center">
                        <div className="w-64 h-48 flex items-center justify-center relative mb-6">
                          <svg className="w-56 h-40 drop-shadow-md" viewBox="0 0 200 150" fill="none">
                            <path d="M20,130 C20,50 180,50 180,130 Z" fill="#EBF3FC" stroke="#B9D5F4" strokeWidth="3" />
                            <path d="M40,90 C70,75 130,75 160,90 M60,65 C90,55 110,55 140,65" stroke="#D1E4F9" strokeWidth="2" strokeDasharray="5,5" />
                            <path d="M60,130 L60,90 M100,130 L100,80 M140,130 L140,90 M70,90 L70,65 M130,90 L130,65" stroke="#D1E4F9" strokeWidth="2" />
                            <path d="M75,130 C75,95 125,95 125,130 Z" fill="#91C3F7" stroke="#6AA6E8" strokeWidth="3" />
                            <g transform="translate(10, 10)">
                              <circle cx="90" cy="110" r="22" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                              <circle cx="74" cy="94" r="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                              <circle cx="74" cy="94" r="3" fill="#FFEAEF" />
                              <circle cx="106" cy="94" r="6" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                              <circle cx="106" cy="94" r="3" fill="#FFEAEF" />
                              <circle cx="83" cy="106" r="2.5" fill="#1A202C" />
                              <circle cx="97" cy="106" r="2.5" fill="#1A202C" />
                              <ellipse cx="90" cy="115" rx="7" ry="5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
                              <polygon points="87,113 93,113 90,116" fill="#1A202C" />
                            </g>
                          </svg>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-700">
                          Belum ada Perangkat POS
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm leading-relaxed">
                          Tambah Perangkat POS baru untuk menambahkan antrian.
                        </p>
                      </div>
                    ) : (
                      /* DEVICES DATA TABLE */
                      <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Serial Perangkat
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Prefix
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {posAntrianDevices.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-800">
                                  {item.serial_perangkat}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                                  {item.prefix || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-3">
                                  <button
                                    onClick={() => handleEditAntrianDeviceClick(item)}
                                    className="text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
                                  >
                                    Ubah
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAntrianDevice(item.id)}
                                    className="text-red-600 hover:text-red-800 font-bold transition-colors cursor-pointer"
                                  >
                                    Hapus
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="p-4 bg-slate-50 rounded-full text-slate-400 mb-4 animate-pulse">
                    <Sparkles size={36} />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-800">
                    Fitur "{POS_MENUS.find((m) => m.id === activeMenu)?.label}" Sedang Dipersiapkan
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                    Halaman detail pengaturan ini akan segera tersedia untuk disambungkan ke backend pada iterasi berikutnya.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'kas-harian' ? (
          /* SALDO KAS HARIAN (V1) COMPONENT */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col flex-1 min-h-[600px]">
            {isAddingKasHarian ? (
              /* TAMBAH KAS AWAL HARIAN FORM */
              <div className="space-y-6">
                {/* Form Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    {editingKasHarianId ? 'Ubah Kas Awal Harian' : 'Tambah Kas Awal Harian'}
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingKasHarian(false);
                        setEditingKasHarianId(null);
                        setNewKasHarianKasir('');
                        setKasirSearchTerm('');
                        setNewKasHarianShift('');
                        setNewKasHarianAwal('');
                        setNewKasHarianAkhir('');
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveKasHarian}
                      disabled={savingSettings || !newKasHarianKasir || !newKasHarianShift}
                      className={`px-4 py-1.5 rounded text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                        savingSettings || !newKasHarianKasir || !newKasHarianShift
                          ? 'bg-slate-100 text-slate-400'
                          : 'bg-[#75C043] hover:bg-[#66a83a] text-white'
                      }`}
                    >
                      {savingSettings ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>

                {/* Form Content */}
                <div className="max-w-xl space-y-5 py-4">
                  {/* Kasir Select */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                    <label className="text-xs font-bold text-slate-600 sm:text-right">
                      Kasir <span className="text-red-500">*</span>
                    </label>
                    <div className="sm:col-span-3 relative">
                      <input
                        type="text"
                        value={kasirSearchTerm}
                        onChange={(e) => {
                          setKasirSearchTerm(e.target.value);
                          setShowKasirDropdown(true);
                          if (!e.target.value) {
                            setNewKasHarianKasir('');
                          }
                        }}
                        onFocus={() => setShowKasirDropdown(true)}
                        onBlur={() => setTimeout(() => setShowKasirDropdown(false), 250)}
                        placeholder="Ketik nama kasir untuk mencari..."
                        className={inputCls}
                      />
                      {newKasHarianKasir && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewKasHarianKasir('');
                            setKasirSearchTerm('');
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                      
                      {showKasirDropdown && (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
                          {filteredUsers.length === 0 ? (
                            <div className="px-4 py-3 text-center text-xs text-slate-400">
                              Tidak ada kasir yang cocok
                            </div>
                          ) : (
                            filteredUsers.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setNewKasHarianKasir(u.id);
                                  setKasirSearchTerm(fName(u));
                                  setShowKasirDropdown(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-xs hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer flex items-center justify-between ${
                                  newKasHarianKasir === u.id ? 'bg-blue-50/50 text-blue-600' : ''
                                }`}
                              >
                                <span>{fName(u)}</span>
                                {newKasHarianKasir === u.id && <CheckCircle size={12} className="text-blue-500" />}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Shift Select */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                    <label className="text-xs font-bold text-slate-600 sm:text-right">
                      Shift <span className="text-red-500">*</span>
                    </label>
                    <div className="sm:col-span-3">
                      <select
                        value={newKasHarianShift}
                        onChange={(e) => setNewKasHarianShift(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Cari</option>
                        {shiftTimings.map((s) => (
                          <option key={s.id} value={s.judul}>
                            {s.judul} ({s.jam_mulai} - {s.jam_berakhir})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Kas Awal */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                    <label className="text-xs font-bold text-slate-600 sm:text-right">
                      Kas Awal
                    </label>
                    <div className="sm:col-span-3 relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-xs">Rp.</span>
                      </div>
                      <input
                        type="number"
                        value={newKasHarianAwal}
                        onChange={(e) => setNewKasHarianAwal(e.target.value)}
                        className={`${inputCls} pl-10`}
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* Kas Akhir (Optional for edit) */}
                  {editingKasHarianId && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                      <label className="text-xs font-bold text-slate-600 sm:text-right">
                        Kas Akhir
                      </label>
                      <div className="sm:col-span-3 relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-slate-400 text-xs">Rp.</span>
                        </div>
                        <input
                          type="number"
                          value={newKasHarianAkhir}
                          onChange={(e) => setNewKasHarianAkhir(e.target.value)}
                          className={`${inputCls} pl-10`}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* KAS AWAL HARIAN LIST VIEW */
              <div className="space-y-6 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    Kas Awal Harian
                  </h3>
                  <button
                    onClick={() => {
                      setEditingKasHarianId(null);
                      setNewKasHarianKasir('');
                      setKasirSearchTerm('');
                      setNewKasHarianShift('');
                      setNewKasHarianAwal('0');
                      setNewKasHarianAkhir('');
                      setIsAddingKasHarian(true);
                    }}
                    className="px-4 py-2 bg-[#75C043] hover:bg-[#66a83a] text-white rounded-lg text-xs font-bold hover:shadow transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    Tambah
                  </button>
                </div>

                {/* Filter section */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-4 py-1">
                  {/* Rows select */}
                  <div className="flex items-center gap-2 mr-auto">
                    <select
                      value={filterKasHarianRows}
                      onChange={(e) => setFilterKasHarianRows(parseInt(e.target.value))}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value={5}>5 Baris</option>
                      <option value={10}>10 Baris</option>
                      <option value={25}>25 Baris</option>
                      <option value={50}>50 Baris</option>
                    </select>
                  </div>

                  {/* Date picker + Search */}
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <input
                      type="date"
                      value={filterKasHarianDate}
                      onChange={(e) => setFilterKasHarianDate(e.target.value)}
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-40"
                    />
                    <div className="relative w-full sm:w-56">
                      <input
                        type="text"
                        value={filterKasHarianSearch}
                        onChange={(e) => setFilterKasHarianSearch(e.target.value)}
                        placeholder="Cari kasir / shift"
                        className="w-full px-3 py-1.5 pr-8 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={fetchKasHarianData}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <Search size={14} />
                      </button>
                    </div>
                    <button
                      onClick={fetchKasHarianData}
                      className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200 flex items-center gap-1"
                    >
                      Cari
                    </button>
                  </div>
                </div>

                {/* Table list */}
                {loadingSettings ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold flex-1">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span>Memuat data kas harian...</span>
                  </div>
                ) : kasHarianData.length === 0 ? (
                  <div className="border border-slate-150 rounded-xl bg-slate-50/30 flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <span className="text-xs font-bold text-slate-400">No Data</span>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white w-full">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Tanggal
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Kasir
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Shift
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Kas Awal
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Kas Akhir
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {kasHarianData.slice(0, filterKasHarianRows).map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                              {item.tanggal}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-800">
                              {item.kasir_nama}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                              {item.shift}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-emerald-600">
                              {formatIDR(item.kas_awal)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-blue-600">
                              {item.kas_akhir !== null && item.kas_akhir !== undefined ? formatIDR(item.kas_akhir) : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-3">
                              <button
                                onClick={() => handleEditKasHarianClick(item)}
                                className="text-blue-600 hover:text-blue-800 font-bold transition-colors cursor-pointer"
                              >
                                Ubah
                              </button>
                              <button
                                onClick={() => handleDeleteKasHarian(item.id)}
                                className="text-red-600 hover:text-red-800 font-bold transition-colors cursor-pointer"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'ringkasan-shift' ? (
          /* RINGKASAN SHIFT (V2) COMPONENT */
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col flex-1 min-h-[600px]">
            <div className="space-y-6 flex-1 flex flex-col">
              {/* Header */}
              <div className="border-b border-slate-100 pb-4">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Ringkasan Shift
                </h3>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-4 py-1">
                {/* Rows select */}
                <div className="flex items-center gap-2 mr-auto">
                  <select
                    value={filterShiftHarianRows}
                    onChange={(e) => {
                      setFilterShiftHarianRows(parseInt(e.target.value));
                      setShiftHarianPage(1);
                    }}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={5}>5 Baris</option>
                    <option value={10}>10 Baris</option>
                    <option value={25}>25 Baris</option>
                    <option value={50}>50 Baris</option>
                  </select>
                </div>

                {/* Date Picker Range + Search + Export */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {/* Date range inputs */}
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-1 bg-slate-50">
                    <input
                      type="date"
                      value={filterShiftHarianStartDate}
                      onChange={(e) => setFilterShiftHarianStartDate(e.target.value)}
                      className="px-2 py-1 border-0 bg-transparent text-xs outline-none focus:ring-0 w-32 font-bold text-slate-700"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <input
                      type="date"
                      value={filterShiftHarianEndDate}
                      onChange={(e) => setFilterShiftHarianEndDate(e.target.value)}
                      className="px-2 py-1 border-0 bg-transparent text-xs outline-none focus:ring-0 w-32 font-bold text-slate-700"
                    />
                  </div>

                  {/* Search bar */}
                  <div className="relative w-full sm:w-48">
                    <input
                      type="text"
                      value={filterShiftHarianSearch}
                      onChange={(e) => setFilterShiftHarianSearch(e.target.value)}
                      placeholder="Cari"
                      className="w-full px-3 py-1.5 pr-8 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={fetchShiftHarianData}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <Search size={14} />
                    </button>
                  </div>

                  {/* Cari Button */}
                  <button
                    onClick={fetchShiftHarianData}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer border border-slate-200 flex items-center gap-1"
                  >
                    Cari
                  </button>

                  {/* Export Excel */}
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-1.5 bg-[#0082c3] hover:bg-[#0071ab] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Table list */}
              {loadingSettings ? (
                <div className="py-24 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs font-bold flex-1">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Memuat data ringkasan shift...</span>
                </div>
              ) : shiftHarianData.length === 0 ? (
                <div className="border border-slate-150 rounded-xl bg-slate-50/30 flex-1 flex flex-col items-center justify-center p-12 text-center">
                  <span className="text-xs font-bold text-slate-400">No Data</span>
                </div>
              ) : (
                <div className="overflow-hidden border border-slate-200 rounded-xl shadow-sm bg-white w-full">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Tanggal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Kasir
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Mulai
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Berakhir
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Expected
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Aktual
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Selisih
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {shiftHarianData.slice((shiftHarianPage - 1) * filterShiftHarianRows, shiftHarianPage * filterShiftHarianRows).map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                            {item.tanggal}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-800">
                            {item.kasir_nama}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                            {item.mulai ? new Date(item.mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                            {item.berakhir ? new Date(item.berakhir).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-700">
                            {formatIDR(item.expected)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-700">
                            {formatIDR(item.aktual)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-xs font-bold ${item.selisih < 0 ? 'text-red-650 text-red-600' : item.selisih > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                            {formatIDR(item.selisih)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Section */}
                  <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-center justify-between sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setShiftHarianPage(Math.max(1, shiftHarianPage - 1))}
                        disabled={shiftHarianPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-xs font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setShiftHarianPage(Math.min(Math.ceil(shiftHarianData.length / filterShiftHarianRows), shiftHarianPage + 1))}
                        disabled={shiftHarianPage >= Math.ceil(shiftHarianData.length / filterShiftHarianRows)}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-xs font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs text-slate-700">
                          Menunjukkan <span className="font-medium">{Math.min(shiftHarianData.length, (shiftHarianPage - 1) * filterShiftHarianRows + 1)}</span> sampai{' '}
                          <span className="font-medium">{Math.min(shiftHarianData.length, shiftHarianPage * filterShiftHarianRows)}</span> dari{' '}
                          <span className="font-medium">{shiftHarianData.length}</span> hasil
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => setShiftHarianPage(Math.max(1, shiftHarianPage - 1))}
                            disabled={shiftHarianPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="relative inline-flex items-center px-4 py-2 border border-slate-300 bg-blue-50 text-xs font-bold text-blue-600">
                            {shiftHarianPage}
                          </span>
                          <button
                            onClick={() => setShiftHarianPage(Math.min(Math.ceil(shiftHarianData.length / filterShiftHarianRows) || 1, shiftHarianPage + 1))}
                            disabled={shiftHarianPage >= (Math.ceil(shiftHarianData.length / filterShiftHarianRows) || 1)}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </nav>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <span>Go to</span>
                          <input
                            type="number"
                            min={1}
                            max={Math.ceil(shiftHarianData.length / filterShiftHarianRows) || 1}
                            value={shiftHarianGoToPage}
                            onChange={(e) => setShiftHarianGoToPage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const targetPage = parseInt(shiftHarianGoToPage);
                                const maxPage = Math.ceil(shiftHarianData.length / filterShiftHarianRows) || 1;
                                if (targetPage >= 1 && targetPage <= maxPage) {
                                  setShiftHarianPage(targetPage);
                                }
                              }
                            }}
                            className="w-12 px-2 py-1 border border-slate-300 rounded text-center outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full mb-4">
              <Sparkles size={32} />
            </div>
            <h3 className="font-extrabold text-slate-800 text-sm">
              Tab "{POS_TABS.find((t) => t.id === activeTab)?.label}" Segera Hadir
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
              Modul Point Of Sale lanjutan ini sedang dalam proses pengembangan oleh tim frontend.
            </p>
          </div>
        )}
      </div>

      {/* Device Add/Edit Modal */}
      {showAddDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-150 flex items-center justify-between">
              <span className="font-bold text-slate-800 text-sm">
                Device
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDeviceModal(false);
                    setEditingDevice(null);
                    setNewDeviceSerial('');
                    setNewDevicePrefix('');
                  }}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveAntrianDevice}
                  disabled={savingSettings || !newDeviceSerial.trim()}
                  className="px-4 py-1.5 bg-[#75C043] hover:bg-[#66a83a] text-white rounded text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingSettings ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Serial Perangkat */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Serial Perangkat <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newDeviceSerial}
                  onChange={(e) => setNewDeviceSerial(e.target.value)}
                  placeholder="Masukkan serial perangkat"
                  className={inputCls}
                />
              </div>

              {/* Prefix */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Prefix
                </label>
                <input
                  type="text"
                  value={newDevicePrefix}
                  onChange={(e) => setNewDevicePrefix(e.target.value)}
                  placeholder="Masukkan prefix antrian (contoh: A)"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
