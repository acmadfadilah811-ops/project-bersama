import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TransaksiTopbar from '../../transaksi/components/TransaksiTopbar';
import '../../inventory/pages/ProductInventory.css';
import { TransaksiProvider, useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import {
  Plus, Trash2, Filter,
  Download, Upload, Search, Star, ThumbsUp,
  X, Heart, Edit2, ChevronLeft, ChevronRight, Calendar,
  MoreVertical, User,
} from 'lucide-react';
import { formatCurrency } from './customerSupplierData';
import { formatDisplayDate } from '../../../utils/date';
import apiClient from '../../../api/apiClient';

// Nilai penanda untuk saringan "Guest" (pelanggan tanpa tipe). Sengaja memakai
// bentuk yang mustahil jadi nama tipe sungguhan, supaya tidak bentrok dengan
// isi tab Tipe Pelanggan.
const TIPE_TANPA_GRUP = '__tanpa_tipe__';
import CustomerFilterDrawer, { defaultCustomerFilters } from '../components/CustomerFilterDrawer';
import CustomerImportModal from '../components/CustomerImportModal';
import AddCustomerModal from '../components/AddCustomerModal';
import CustomerDetailPage from '../components/CustomerDetailPage';
import CustomerNoteModal from '../components/CustomerNoteModal';
import * as XLSX from 'xlsx';
import SupplierFormPage from '../components/SupplierFormPage';
import SupplierDetailPage from '../components/SupplierDetailPage';
import SupplierImportModal from '../components/SupplierImportModal';


const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const fmtDate = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_ID[d.getMonth()]}-${d.getFullYear()}`;
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
const formatRangeText = (startStr, endStr) => {
  if (!startStr || !endStr) return 'Pilih Tanggal';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Pilih Tanggal';
  const fmt = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = MONTHS_SHORT[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day} ${month} ${year}`;
  };
  return `${fmt(start)} - ${fmt(end)}`;
};

/** Ubah error response DRF jadi satu baris pesan. */
const extractApiError = (err, fallback) => {
  const data = err.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.error) return data.error;
  if (data.detail) return data.detail;
  const parts = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
  return parts.length ? parts.join(' | ') : fallback;
};

/** Sakelar Aktif/Nonaktif dipakai di kolom Aksi tiap daftar. */
function StatusToggle({ active, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={active ? 'Nonaktifkan' : 'Aktifkan'}
      style={{
        padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', border: 0,
        background: active ? '#dcfce7' : '#f1f5f9', color: active ? '#15803d' : '#64748b',
      }}
    >
      {active ? 'Aktif' : 'Nonaktif'}
    </button>
  );
}

// Cute Polar Bear & Blue Profiles empty state SVG
const EmptyState = ({ title, desc }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  }}>
    <h4 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 6px 0' }}>{title}</h4>
    <p style={{ fontSize: '13px', color: '#64748b', margin: 0, maxWidth: '380px', lineHeight: '1.4' }}>{desc}</p>
  </div>
);

const inputSm = { border: '1px solid #cbd5e1', borderRadius: '6px', height: '36px', padding: '0 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const labelSm = { fontSize: '11px', fontWeight: 'bold', color: '#475569' };

function CustomerSupplierInner() {
  const location = useLocation();
  const navigate = useNavigate();

  const pathParts = location.pathname.replace(/^\//, '').split('/');
  const activeTab = pathParts[1] || 'customer';

  const tabs = [
    { id: 'customer', label: 'Pelanggan' },
    { id: 'notes', label: 'Catatan Pelanggan' },
    { id: 'types', label: 'Tipe Pelanggan' },
    { id: 'reviews', label: 'Ulasan Pelanggan' },
    { id: 'satisfaction', label: 'Kepuasan Pelanggan' },
    { id: 'supplier', label: 'Supplier' }
  ];

  const activeTabDetails = tabs.find(t => t.id === activeTab) || tabs[0];

  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setSubtitle(activeTabDetails?.label || '');
  }, [activeTabDetails, setSubtitle]);

  // ── Data umum (dipakai lintas tab) ──────────────────────────────
  const [customers, setCustomers] = useState([]);
  const [groups, setGroups] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState(null);

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const res = await apiClient.get('/customers/');
      const daftar = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setCustomers(daftar);
      // Rincian memegang salinan pelanggannya. Tanpa disegarkan di sini, layar
      // rincian tetap menampilkan data lama setelah Ubah disimpan.
      setActiveCustomer((prev) => (prev ? daftar.find((c) => c.id === prev.id) || null : null));
    } catch (err) {
      console.error('[CustomerSupplierApp] fetch customers error:', err);
      setError('Gagal memuat daftar pelanggan.');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await apiClient.get('/customer-groups/');
      setGroups(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[CustomerSupplierApp] fetch groups error:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchGroups();
  }, []);

  // ── Pelanggan (form + toolbar) ───────────────────────────────────
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  // Pelanggan yang sedang dibuka rinciannya; null = tampilkan daftar.
  const [activeCustomer, setActiveCustomer] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('Semua Tipe');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(defaultCustomerFilters);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportingCustomers, setExportingCustomers] = useState(false);

  const handleDownloadCustomers = async () => {
    if (exportingCustomers) return;
    setExportingCustomers(true);
    setError(null);
    try {
      const res = await apiClient.get('/export/customers/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `daftar_pelanggan_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('[CustomerSupplierApp] export customers error:', err);
      setError(extractApiError(err, 'Gagal mengekspor data pelanggan.'));
    } finally {
      setExportingCustomers(false);
    }
  };

  const openCustomerCreate = () => setShowAddCustomerModal(true);
  const openCustomerEdit = (cust) => setEditingCustomer(cust);
  const closeCustomerModal = () => {
    setShowAddCustomerModal(false);
    setEditingCustomer(null);
  };
  const handleCustomerSaved = () => {
    closeCustomerModal();
    fetchCustomers();
  };

  const handleToggleCustomer = async (cust) => {
    try {
      await apiClient.post(`/customers/${cust.id}/toggle-status/`);
      fetchCustomers();
    } catch (err) {
      console.error('[CustomerSupplierApp] toggle customer error:', err);
    }
  };

  const handleDeleteCustomer = async (cust) => {
    if (!window.confirm(`Hapus pelanggan "${cust.nama}"?`)) return;
    try {
      await apiClient.delete(`/customers/${cust.id}/`);
      fetchCustomers();
    } catch (err) {
      console.error('[CustomerSupplierApp] delete customer error:', err);
    }
  };

  const filteredCustomers = useMemo(() => {
    const inRange = (value, min, max) => {
      const num = Number(value) || 0;
      if (min !== '' && num < Number(min)) return false;
      if (max !== '' && num > Number(max)) return false;
      return true;
    };
    const inDateRange = (value, start, end) => {
      if (!start && !end) return true;
      if (!value) return false;
      if (start && value < start) return false;
      if (end && value > end) return false;
      return true;
    };

    return customers.filter(c => {
      const matchQuery = `${c.nama} ${c.handphone} ${c.email}`.toLowerCase().includes(customerQuery.toLowerCase());
      // "Guest" bukan tipe di database — itu pelanggan yang customer_group-nya
      // kosong, jadi disaring lewat sentinel, bukan dicocokkan namanya.
      const matchGroup =
        selectedGroupFilter === 'Semua Tipe' ||
        (selectedGroupFilter === TIPE_TANPA_GRUP
          ? !c.customer_group_nama
          : c.customer_group_nama === selectedGroupFilter);
      const matchFilterGroup = !appliedFilters.customerGroup || String(c.customer_group) === String(appliedFilters.customerGroup);
      const matchStatus =
        appliedFilters.status === 'semua' ||
        (appliedFilters.status === 'dibekukan' ? !!c.bekukan : !c.bekukan);
      const matchDob = inDateRange(c.tanggal_lahir, appliedFilters.dobStart, appliedFilters.dobEnd);
      const matchExpiry = inDateRange(c.tanggal_berakhir, appliedFilters.expiryStart, appliedFilters.expiryEnd);
      const matchDeposit = inRange(c.deposit, appliedFilters.depositMin, appliedFilters.depositMax);
      const matchLoyalty = inRange(c.loyalty_points, appliedFilters.loyaltyMin, appliedFilters.loyaltyMax);
      return matchQuery && matchGroup && matchFilterGroup && matchStatus && matchDob && matchExpiry && matchDeposit && matchLoyalty;
    });
  }, [customers, customerQuery, selectedGroupFilter, appliedFilters]);

  // Paginasi daftar Pelanggan — pola sama dengan tab Supplier (rows-dropdown +
  // prev/next + go-to-page), sebelumnya tab ini render SEMUA hasil filter
  // tanpa halaman sama sekali (temuan user 2026-09-06).
  const [customerPageSize, setCustomerPageSize] = useState(10);
  const [customerCurrentPage, setCustomerCurrentPage] = useState(1);

  useEffect(() => {
    setCustomerCurrentPage(1);
  }, [customerQuery, selectedGroupFilter, appliedFilters, customerPageSize]);

  const paginatedCustomers = useMemo(() => {
    const start = (customerCurrentPage - 1) * customerPageSize;
    return filteredCustomers.slice(start, start + customerPageSize);
  }, [filteredCustomers, customerCurrentPage, customerPageSize]);

  const totalCustomerPages = Math.ceil(filteredCustomers.length / customerPageSize) || 1;

  // ── Catatan Pelanggan ────────────────────────────────────────────
  const [notes, setNotes] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [noteTags, setNoteTags] = useState([]);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [defaultNoteCustomerId, setDefaultNoteCustomerId] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
  };
  const getLastDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
  };

  const [noteCustomerFilter, setNoteCustomerFilter] = useState('');
  const [noteTagFilter, setNoteTagFilter] = useState('');
  const [noteDateStart, setNoteDateStart] = useState(() => getFirstDayOfMonth(new Date()));

  const [noteDateEnd, setNoteDateEnd] = useState(() => getLastDayOfMonth(new Date()));
  const [showNoteDatePicker, setShowNoteDatePicker] = useState(false);
  const [notePage, setNotePage] = useState(1);
  const [notePageSize, setNotePageSize] = useState(10);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [exportingNotes, setExportingNotes] = useState(false);

  const fetchNotes = async () => {
    setLoadingNotes(true);
    try {
      const res = await apiClient.get('/customer-notes/');
      setNotes(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[CustomerSupplierApp] fetch notes error:', err);
    } finally {
      setLoadingNotes(false);
    }
  };

  const fetchNoteTags = async () => {
    try {
      const res = await apiClient.get('/customer-note-tags/');
      setNoteTags(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[CustomerSupplierApp] fetch note tags error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'notes') { fetchNotes(); fetchNoteTags(); }
  }, [activeTab]);

  // Rincian pelanggan menampilkan catatannya, jadi catatan perlu dimuat juga saat
  // rincian dibuka — bukan cuma saat tab Catatan aktif.
  useEffect(() => {
    if (activeCustomer) fetchNotes();
  }, [activeCustomer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNoteCreate = () => {
    setDefaultNoteCustomerId('');
    setShowNoteModal(true);
  };
  const openNoteEdit = (note) => {
    setDefaultNoteCustomerId('');
    setEditingNote(note);
  };
  const closeNoteModal = () => {
    setShowNoteModal(false);
    setEditingNote(null);
    setDefaultNoteCustomerId('');
  };
  const handleNoteSaved = () => {
    closeNoteModal();
    fetchNotes();
    fetchNoteTags();
  };

  const handleDownloadNotes = async (format, customerIdOverride) => {
    if (exportingNotes) return;
    setExportingNotes(true);
    try {
      const params = {
        format,
        customer: customerIdOverride || noteCustomerFilter || undefined,
        tag: noteTagFilter || undefined,
        start_date: noteDateStart || undefined,
        end_date: noteDateEnd || undefined,
        search: noteQuery || undefined
      };

      if (format === 'excel') {
        const res = await apiClient.get('/export/customer-notes/', { params, responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `customer-notes-${new Date().toISOString().slice(0, 10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } else if (format === 'pdf') {
        const res = await apiClient.get('/export/customer-notes/', { params });
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(res.data);
          printWindow.document.close();
        } else {
          alert('Popup diblokir oleh browser. Harap izinkan popup untuk mencetak laporan.');
        }
      }
    } catch (err) {
      console.error('[CustomerSupplierApp] export customer notes error:', err);
      alert('Gagal mengekspor data catatan pelanggan.');
    } finally {
      setExportingNotes(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleDeleteNote = async (note) => {
    if (!window.confirm('Hapus catatan ini?')) return;
    try {
      await apiClient.delete(`/customer-notes/${note.id}/`);
      fetchNotes();
    } catch (err) {
      console.error('[CustomerSupplierApp] delete note error:', err);
    }
  };

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchQuery = `${n.judul} ${n.customer_name}`.toLowerCase().includes(noteQuery.trim().toLowerCase());
      const matchCustomer = !noteCustomerFilter || String(n.customer) === String(noteCustomerFilter);
      const matchTag = !noteTagFilter || (n.tags || []).includes(noteTagFilter);
      const matchStart = !noteDateStart || (n.tanggal && n.tanggal >= noteDateStart);
      const matchEnd = !noteDateEnd || (n.tanggal && n.tanggal <= noteDateEnd);
      return matchQuery && matchCustomer && matchTag && matchStart && matchEnd;
    });
  }, [notes, noteQuery, noteCustomerFilter, noteTagFilter, noteDateStart, noteDateEnd]);

  const paginatedNotes = useMemo(() => {
    return filteredNotes.slice((notePage - 1) * notePageSize, notePage * notePageSize);
  }, [filteredNotes, notePage, notePageSize]);

  // ── Tipe Pelanggan (CustomerGroup) ───────────────────────────────
  const [groupForm, setGroupForm] = useState({ nama: '', diskon_persen: '' });
  const [savingGroup, setSavingGroup] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [activeGroupDropdownId, setActiveGroupDropdownId] = useState(null);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => g.nama.toLowerCase().includes(groupSearchQuery.toLowerCase()));
  }, [groups, groupSearchQuery]);

  const showGuestCard = !groupSearchQuery || 'guest'.includes(groupSearchQuery.toLowerCase());

  const handleSaveGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.nama.trim()) return;
    setSavingGroup(true);
    setError(null);
    try {
      if (editingGroup) {
        await apiClient.put(`/customer-groups/${editingGroup.id}/`, {
          nama: groupForm.nama.trim(),
          diskon_persen: parseFloat(groupForm.diskon_persen) || 0,
        });
      } else {
        await apiClient.post('/customer-groups/', {
          nama: groupForm.nama.trim(),
          diskon_persen: parseFloat(groupForm.diskon_persen) || 0,
        });
      }
      setGroupForm({ nama: '', diskon_persen: '' });
      setEditingGroup(null);
      setShowGroupModal(false);
      fetchGroups();
    } catch (err) {
      console.error('[CustomerSupplierApp] save group error:', err);
      setError(extractApiError(err, 'Gagal menyimpan tipe pelanggan.'));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleToggleGroup = async (grp) => {
    try {
      await apiClient.post(`/customer-groups/${grp.id}/toggle-status/`);
      fetchGroups();
    } catch (err) {
      console.error('[CustomerSupplierApp] toggle group error:', err);
    }
  };

  const handleDeleteGroup = async (grp) => {
    if (!window.confirm(`Hapus tipe pelanggan "${grp.nama}"?`)) return;
    try {
      await apiClient.delete(`/customer-groups/${grp.id}/`);
      fetchGroups();
    } catch (err) {
      console.error('[CustomerSupplierApp] delete group error:', err);
    }
  };

  // ── Ulasan Pelanggan ─────────────────────────────────────────────
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewForm, setReviewForm] = useState({ customer: '', rating: 5, comment: '' });
  const [savingReview, setSavingReview] = useState(false);

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await apiClient.get('/customer-reviews/');
      setReviews(Array.isArray(res.data) ? res.data : res.data?.results || []);
    } catch (err) {
      console.error('[CustomerSupplierApp] fetch reviews error:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews') fetchReviews();
  }, [activeTab]);

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comment.trim()) return;
    setSavingReview(true);
    setError(null);
    const selectedCustomer = customers.find(c => String(c.id) === String(reviewForm.customer));
    try {
      await apiClient.post('/customer-reviews/', {
        customer: reviewForm.customer || null,
        customer_name: selectedCustomer ? selectedCustomer.nama : 'Pelanggan Umum',
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
      });
      setReviewForm({ customer: '', rating: 5, comment: '' });
      fetchReviews();
    } catch (err) {
      console.error('[CustomerSupplierApp] save review error:', err);
      setError(extractApiError(err, 'Gagal menyimpan ulasan.'));
    } finally {
      setSavingReview(false);
    }
  };

  const handleDeleteReview = async (rev) => {
    if (!window.confirm('Hapus ulasan ini?')) return;
    try {
      await apiClient.delete(`/customer-reviews/${rev.id}/`);
      fetchReviews();
    } catch (err) {
      console.error('[CustomerSupplierApp] delete review error:', err);
    }
  };

  const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  // ── Supplier ─────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [activeSupplier, setActiveSupplier] = useState(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showSupplierImportModal, setShowSupplierImportModal] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const res = await apiClient.get('/suppliers/');
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setSuppliers(data);
      // Sync activeSupplier data if it was set
      if (activeSupplier) {
        const found = data.find(s => s.id === activeSupplier.id);
        if (found) setActiveSupplier(found);
      }
    } catch (err) {
      console.error('[CustomerSupplierApp] fetch suppliers error:', err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'supplier') fetchSuppliers();
  }, [activeTab]);

  const openSupplierCreate = () => {
    setEditingSupplier(null);
    setShowSupplierForm(true);
  };

  const openSupplierEdit = (sup) => {
    setEditingSupplier(sup);
    setShowSupplierForm(true);
  };

  const handleSaveSupplier = async (formValues, photoFile) => {
    setSavingSupplier(true);
    setError(null);
    try {
      // Foto (kalau ada file baru dipilih) dikirim sungguhan ke server lewat
      // multipart — sebelumnya cuma disimpan base64 ke localStorage (hilang
      // kalau ganti perangkat/browser, tidak pernah tersinkron; bug ditemukan
      // & diperbaiki 2026-09-05). Tanpa file baru, kirim JSON biasa supaya
      // foto yang sudah ada di server tidak ikut terhapus/ter-reset.
      let payload = formValues;
      let config;
      if (photoFile) {
        const fd = new FormData();
        Object.entries(formValues).forEach(([key, value]) => {
          if (value !== null && value !== undefined) fd.append(key, value);
        });
        fd.append('foto', photoFile);
        payload = fd;
        config = { headers: { 'Content-Type': 'multipart/form-data' } };
      }

      if (editingSupplier) {
        const res = await apiClient.patch(`/suppliers/${editingSupplier.id}/`, payload, config);
        // If we are editing from details view, update the activeSupplier
        if (activeSupplier && activeSupplier.id === editingSupplier.id) {
          setActiveSupplier(res.data);
        }
      } else {
        await apiClient.post('/suppliers/', payload, config);
      }

      setShowSupplierForm(false);
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (err) {
      console.error('[CustomerSupplierApp] save supplier error:', err);
      setError(extractApiError(err, 'Gagal menyimpan supplier.'));
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleToggleSupplier = async (sup) => {
    try {
      await apiClient.post(`/suppliers/${sup.id}/toggle-status/`);
      fetchSuppliers();
    } catch (err) {
      console.error('[CustomerSupplierApp] toggle supplier error:', err);
    }
  };

  const handleDeleteSupplier = async (sup) => {
    if (!window.confirm(`Hapus supplier "${sup.nama}"?`)) return;
    try {
      await apiClient.delete(`/suppliers/${sup.id}/`);
      setActiveSupplier(null);
      fetchSuppliers();
    } catch (err) {
      console.error('[CustomerSupplierApp] delete supplier error:', err);
    }
  };

  const handleExportSuppliers = () => {
    const data = filteredSuppliers.map((s) => ({
      'Name': s.nama,
      'Email': s.email || '',
      'Phone': s.phone || '',
      'Supplier Type': s.kontak_pic || '',
      'Address': s.alamat || '',
      'Postal Code': s.kode_pos || '',
      'City': s.kota || '',
      'State/Province': s.provinsi || '',
      'Country': s.negara || 'Indonesia'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
    XLSX.writeFile(wb, `suppliers-export.xlsx`);
  };

  const filteredSuppliers = suppliers.filter(s => `${s.nama} ${s.kontak_pic} ${s.phone}`.toLowerCase().includes(supplierQuery.toLowerCase()));

  const [supplierPageSize, setSupplierPageSize] = useState(10);
  const [supplierCurrentPage, setSupplierCurrentPage] = useState(1);

  useEffect(() => {
    setSupplierCurrentPage(1);
  }, [supplierQuery, supplierPageSize]);

  const paginatedSuppliers = useMemo(() => {
    const start = (supplierCurrentPage - 1) * supplierPageSize;
    return filteredSuppliers.slice(start, start + supplierPageSize);
  }, [filteredSuppliers, supplierCurrentPage, supplierPageSize]);

  const totalSupplierPages = Math.ceil(filteredSuppliers.length / supplierPageSize) || 1;



  // Tab change helper
  const handleTabChange = (tabId) => {
    navigate(`/customer-supplier/${tabId}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TransaksiTopbar />
      
      {/* Tab atas — sama persis dengan Laporan.jsx, tanpa space */}
      <div className="flex border-b border-slate-200 shrink-0 bg-white">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 px-3 py-4 text-sm font-semibold text-center whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                isActive
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50/40 bg-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Area Konten */}
      <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-50 overflow-y-auto">
        <div className="pi-module pi-module-full">
          <section className="pi-full-panel" style={{ borderTop: 0 }}>
            <div className="pi-page-body" style={{ padding: 0 }}>
          {error && (
            <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {/* TAB 1: PELANGGAN — rincian menggantikan daftar saat nama diklik */}
          {activeTab === 'customer' && activeCustomer && (
            <CustomerDetailPage
              customer={activeCustomer}
              notes={notes}
              onBack={() => setActiveCustomer(null)}
              onEdit={openCustomerEdit}
              onDelete={async (cust) => {
                await handleDeleteCustomer(cust);
                setActiveCustomer(null);
              }}
              onAddNote={() => {
                setDefaultNoteCustomerId(activeCustomer.id);
                setShowNoteModal(true);
              }}
              onEditNote={(note) => {
                setEditingNote(note);
              }}
              onDownloadNotes={handleDownloadNotes}
            />
          )}

          {activeTab === 'customer' && !activeCustomer && (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
                <select
                  value={customerPageSize}
                  onChange={e => setCustomerPageSize(Number(e.target.value))}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 10px', height: '38px', fontSize: '13px', fontWeight: 'bold', color: '#475569', outline: 'none', cursor: 'pointer' }}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                  <option value={100}>100 Baris</option>
                </select>
                <button onClick={() => setShowFilterDrawer(true)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 16px', height: '38px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}>
                  <Filter size={15} /><span>Filter</span>
                </button>
                {/* Isinya tipe nyata dari tab Tipe Pelanggan (/customer-groups/),
                    ditambah "Guest" untuk pelanggan yang belum bertipe — tanpa itu
                    mereka tidak bisa disaring sama sekali. Kalau nanti ada tipe
                    sungguhan bernama "Guest", labelnya akan kembar di sini. */}
                <select value={selectedGroupFilter} onChange={e => setSelectedGroupFilter(e.target.value)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 12px', height: '38px', fontSize: '13px', fontWeight: 'bold', width: '160px', cursor: 'pointer', color: '#475569', outline: 'none' }}>
                  <option value="Semua Tipe">Tipe Pelanggan</option>
                  {groups.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
                  <option value={TIPE_TANPA_GRUP}>Guest</option>
                </select>
                <button
                  onClick={handleDownloadCustomers}
                  disabled={exportingCustomers}
                  style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 16px', height: '38px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: exportingCustomers ? 'default' : 'pointer', color: '#475569', opacity: exportingCustomers ? 0.6 : 1 }}
                >
                  <Download size={15} /><span>{exportingCustomers ? 'Mengekspor...' : 'Download'}</span>
                </button>
                <button onClick={() => setShowImportModal(true)} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 16px', height: '38px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}>
                  <Upload size={15} /><span>Import</span>
                </button>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input type="text" placeholder="Cari" value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px 0 36px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }} />
                  <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                </div>
                <button onClick={openCustomerCreate} style={{ background: '#22c55e', color: '#ffffff', border: 0, borderRadius: '6px', padding: '0 18px', height: '38px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)' }}>
                  <Plus size={16} /><span>Tambah</span>
                </button>
              </div>

              {filteredCustomers.length === 0 ? (
                <EmptyState
                  title="Eh, belum ada Pelanggan. Kelola pelanggan hingga Loyalty Point"
                  desc="Hubungkan kontak WhatsApp pelanggan Anda, kelompokkan berdasarkan grup tertentu, dan catat saldo deposit mereka untuk proses pengerjaan yang lebih cepat."
                />
              ) : (
                <>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        {/* Urutan kolom mengikuti Olsera. "Tanggal Transaksi
                            Terakhir" belum ada — Order tidak terhubung ke
                            Customer; lihat catatan di HANDOVER. Kolom "Status"
                            dipertahankan meski Olsera tidak punya: tanpa itu
                            pelanggan yang dibekukan tak terlihat. */}
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Nama</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>ID Pelanggan</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Kode</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Email</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Telpon</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Tipe</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Jumlah deposit</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Total Loyalty Point</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Tanggal Aktif</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Tanggal Berakhir</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', whiteSpace: 'nowrap' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCustomers.map(cust => (
                        <tr key={cust.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {/* Kolom Aksi dihapus mengikuti Olsera; Ubah & Hapus
                              pindah ke halaman rincian yang dibuka dari sini. */}
                          <td
                            onClick={() => setActiveCustomer(cust)}
                            style={{ padding: '12px 16px', fontWeight: 'bold', color: '#2563eb', cursor: 'pointer' }}
                          >
                            {cust.nama}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>{cust.id}</td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{cust.kode_pelanggan || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>{cust.email || '-'}</td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{cust.handphone || '-'}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {/* "Guest" = pelanggan tanpa tipe, mengikuti Olsera. Itu
                                LABEL tampilan, bukan tipe sungguhan — di database
                                customer_group-nya tetap kosong. Sengaja berwarna
                                netral, bukan biru seperti tipe asli, supaya tidak
                                dikira ada tipe "Guest" di tab Tipe Pelanggan. */}
                            {cust.customer_group_nama ? (
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: '#dbeafe', color: '#1d4ed8' }}>{cust.customer_group_nama}</span>
                            ) : (
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: '#f1f5f9', color: '#64748b' }}>Guest</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: '600', color: '#16a34a', whiteSpace: 'nowrap' }}>{formatCurrency(cust.deposit)}</td>
                          <td style={{ padding: '12px 16px', color: '#334155' }}>{cust.loyalty_points ?? 0}</td>
                          {/* Tanggal Aktif = created_at. Olsera memakai waktu saat
                              pelanggan dibuat, bukan field yang bisa diubah. */}
                          <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{formatDisplayDate(cust.created_at)}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>{formatDisplayDate(cust.tanggal_berakhir)}</td>
                          {/* Status TIDAK ikut dibuang bersama kolom Aksi: tanpa ini
                              pelanggan yang dibekukan tak terlihat & tak bisa diaktifkan. */}
                          <td style={{ padding: '12px 16px' }}>
                            <StatusToggle active={cust.is_active} onToggle={() => handleToggleCustomer(cust)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Pagination Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', fontSize: '13px', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      disabled={customerCurrentPage === 1}
                      onClick={() => setCustomerCurrentPage(p => Math.max(1, p - 1))}
                      style={{
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
                        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: customerCurrentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: customerCurrentPage === 1 ? 0.5 : 1,
                      }}
                    >
                      &lt;
                    </button>
                    <span style={{ padding: '0 8px', fontWeight: 'bold' }}>{customerCurrentPage}</span>
                    <button
                      disabled={customerCurrentPage === totalCustomerPages}
                      onClick={() => setCustomerCurrentPage(p => Math.min(totalCustomerPages, p + 1))}
                      style={{
                        background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px',
                        width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: customerCurrentPage === totalCustomerPages ? 'not-allowed' : 'pointer',
                        opacity: customerCurrentPage === totalCustomerPages ? 0.5 : 1,
                      }}
                    >
                      &gt;
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Go to</span>
                    <input
                      type="number"
                      min={1}
                      max={totalCustomerPages}
                      value={customerCurrentPage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (val >= 1 && val <= totalCustomerPages) setCustomerCurrentPage(val);
                      }}
                      style={{ width: '45px', height: '28px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', outline: 'none', fontSize: '13px' }}
                    />
                    <span>dari {totalCustomerPages}</span>
                  </div>
                  <span style={{ color: '#94a3b8' }}>{filteredCustomers.length} pelanggan</span>
                </div>
                </>
              )}

              <CustomerFilterDrawer
                open={showFilterDrawer}
                onClose={() => setShowFilterDrawer(false)}
                groups={groups}
                value={appliedFilters}
                onApply={(filters) => { setAppliedFilters(filters); setShowFilterDrawer(false); }}
                onReset={() => setAppliedFilters(defaultCustomerFilters)}
              />

              {showImportModal && (
                <CustomerImportModal
                  onClose={() => setShowImportModal(false)}
                  onImported={() => { setShowImportModal(false); fetchCustomers(); }}
                />
              )}
            </>
          )}

          {/* TAB 2: CATATAN PELANGGAN */}
          {activeTab === 'notes' && (
            <>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <select value={noteCustomerFilter} onChange={e => { setNoteCustomerFilter(e.target.value); setNotePage(1); }} style={{ ...inputSm, width: '150px', background: '#fff' }}>
                  <option value="">Pembeli</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                </select>
                <select value={noteTagFilter} onChange={e => { setNoteTagFilter(e.target.value); setNotePage(1); }} style={{ ...inputSm, width: '130px', background: '#fff' }}>
                  <option value="">Tag</option>
                  {noteTags.map(t => <option key={t.id} value={t.nama}>{t.nama}</option>)}
                </select>

                {/* Custom Month-Switching Date Range Picker */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', height: '36px', background: '#fff', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const current = new Date(noteDateStart);
                        current.setMonth(current.getMonth() - 1);
                        setNoteDateStart(getFirstDayOfMonth(current));
                        setNoteDateEnd(getLastDayOfMonth(current));
                        setNotePage(1);
                      }}
                      style={{ border: 0, background: 'transparent', height: '100%', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNoteDatePicker(!showNoteDatePicker)}
                      style={{ border: 0, background: 'transparent', height: '100%', padding: '0 12px', fontSize: '13px', color: '#334155', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}
                    >
                      <Calendar size={14} className="text-slate-400" />
                      <span>{formatRangeText(noteDateStart, noteDateEnd)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const current = new Date(noteDateStart);
                        current.setMonth(current.getMonth() + 1);
                        setNoteDateStart(getFirstDayOfMonth(current));
                        setNoteDateEnd(getLastDayOfMonth(current));
                        setNotePage(1);
                      }}
                      style={{ border: 0, background: 'transparent', height: '100%', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {showNoteDatePicker && (
                    <div style={{ position: 'absolute', zIndex: 10, top: 'calc(100% + 4px)', left: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px', width: '280px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input type="date" value={noteDateStart} onChange={e => { setNoteDateStart(e.target.value); setNotePage(1); }} style={inputSm} />
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                        <input type="date" value={noteDateEnd} onChange={e => { setNoteDateEnd(e.target.value); setNotePage(1); }} style={inputSm} />
                      </div>
                      <button type="button" onClick={() => setShowNoteDatePicker(false)} style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: '4px', padding: '6px 0', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>Terapkan</button>
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                    style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0 16px', height: '36px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#475569' }}
                  >
                    <Download size={15} /><span>{exportingNotes ? 'Exporting...' : 'Download'}</span>
                  </button>
                  {showDownloadDropdown && (
                    <div style={{ position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '150px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <button
                        type="button"
                        onClick={() => { handleDownloadNotes('excel'); setShowDownloadDropdown(false); }}
                        style={{ border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}
                        onMouseEnter={e => e.target.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        Excel (.xlsx)
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleDownloadNotes('pdf'); setShowDownloadDropdown(false); }}
                        style={{ border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9', width: '100%' }}
                        onMouseEnter={e => e.target.style.background = '#f1f5f9'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        PDF Document
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '160px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input type="text" placeholder="Cari" value={noteQuery} onChange={e => { setNoteQuery(e.target.value); setNotePage(1); }} style={{ width: '100%', height: '36px', padding: '0 12px 0 36px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', color: '#334155' }} />
                  <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                </div>
                <button onClick={openNoteCreate} style={{ background: '#22c55e', color: '#ffffff', border: 0, borderRadius: '6px', padding: '0 18px', height: '36px', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)' }}>
                  <Plus size={16} /><span>Tambah</span>
                </button>
              </div>

              {loadingNotes ? (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Memuat...</p>
              ) : filteredNotes.length === 0 ? (
                <div style={{ display: 'grid', placeItems: 'center', minHeight: '160px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', fontSize: '13px' }}>
                  Belum ada catatan pelanggan ditambahkan.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #e2e8f0' }}>Judul</th>
                          <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #e2e8f0' }}>No Catatan</th>
                          <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #e2e8f0' }}>Pembeli</th>
                          <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #e2e8f0' }}>Waktu buat</th>
                          <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #e2e8f0' }}>Tag</th>
                          <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #e2e8f0' }}>Dibuat oleh</th>
                          <th style={{ padding: '12px 16px', width: '60px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedNotes.map(note => (
                          <tr key={note.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #f1f5f9' }}>{note.judul || '(Tanpa judul)'}</td>
                            <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'monospace', borderRight: '1px solid #f1f5f9' }}>
                              {"N" + String(note.id).padStart(6, '0')}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#334155', borderRight: '1px solid #f1f5f9' }}>{note.customer_name || 'Umum / Anonim'}</td>
                            <td style={{ padding: '12px 16px', color: '#475569', borderRight: '1px solid #f1f5f9' }}>
                              {note.tanggal ? `${note.tanggal} ${note.jam ? note.jam.slice(0, 8) : ''}` : '-'}
                            </td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid #f1f5f9' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {(note.tags || []).map(tag => (
                                  <span key={tag} style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>{tag}</span>
                                ))}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#334155', borderRight: '1px solid #f1f5f9' }}>
                              {note.dibuat_oleh_nama || 'Brandy'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <button
                                onClick={() => openNoteEdit(note)}
                                style={{ border: '1px solid #cbd5e1', borderRadius: '50%', background: '#fff', color: '#3b82f6', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#f0f9ff'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#fff'; }}
                              >
                                <Edit2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Control */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', marginTop: '16px', fontSize: '13px', color: '#64748b' }}>
                    <span>Total {filteredNotes.length}</span>
                    <select
                      value={notePageSize}
                      onChange={e => { setNotePageSize(Number(e.target.value)); setNotePage(1); }}
                      style={{ ...inputSm, width: '70px', height: '32px', background: '#fff' }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        disabled={notePage === 1}
                        onClick={() => setNotePage(p => Math.max(1, p - 1))}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', padding: '4px 8px', cursor: notePage === 1 ? 'not-allowed' : 'pointer', opacity: notePage === 1 ? 0.5 : 1 }}
                      >
                        &lt;
                      </button>
                      <span style={{ padding: '0 8px', fontWeight: 'bold', color: '#1e293b' }}>{notePage}</span>
                      <button
                        disabled={notePage >= Math.ceil(filteredNotes.length / notePageSize)}
                        onClick={() => setNotePage(p => Math.min(Math.ceil(filteredNotes.length / notePageSize), p + 1))}
                        style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: '#fff', padding: '4px 8px', cursor: notePage >= Math.ceil(filteredNotes.length / notePageSize) ? 'not-allowed' : 'pointer', opacity: notePage >= Math.ceil(filteredNotes.length / notePageSize) ? 0.5 : 1 }}
                      >
                        &gt;
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Go to</span>
                      <input
                        type="number"
                        min={1}
                        max={Math.ceil(filteredNotes.length / notePageSize) || 1}
                        value={notePage}
                        onChange={e => {
                          const val = Number(e.target.value);
                          if (val >= 1 && val <= Math.ceil(filteredNotes.length / notePageSize)) {
                            setNotePage(val);
                          }
                        }}
                        style={{ ...inputSm, width: '50px', height: '32px', textAlign: 'center', background: '#fff' }}
                      />
                    </div>
                  </div>
                </>
              )}

            </>
          )}

          {(showNoteModal || editingNote) && (
            <CustomerNoteModal
              note={editingNote}
              customers={customers}
              allTags={noteTags}
              defaultCustomerId={defaultNoteCustomerId}
              onClose={closeNoteModal}
              onSaved={handleNoteSaved}
            />
          )}

          {/* TAB 3: TIPE PELANGGAN */}
          {activeTab === 'types' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '0 4px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Daftar Jenis Pelanggan</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  {filteredGroups.length + (showGuestCard ? 1 : 0)} Jenis Pelanggan
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Cari"
                    value={groupSearchQuery}
                    onChange={e => setGroupSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      height: '38px',
                      padding: '0 12px 0 36px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      outline: 'none',
                      fontSize: '13px',
                      color: '#334155'
                    }}
                  />
                  <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingGroup(null);
                    setGroupForm({ nama: '', diskon_persen: '' });
                    setShowGroupModal(true);
                  }}
                  style={{
                    background: '#82c341', // Green from screenshot
                    color: '#ffffff',
                    border: 0,
                    borderRadius: '6px',
                    padding: '0 18px',
                    height: '38px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(130, 195, 65, 0.2)'
                  }}
                >
                  <Plus size={16} />
                  <span>Tambah</span>
                </button>
              </div>

              {loadingGroups ? (
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>Memuat...</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginTop: '4px' }}>
                  {filteredGroups.map(grp => {
                    const count = customers.filter(c => c.customer_group === grp.id || c.customer_group_nama === grp.nama).length;
                    return (
                      <div
                        key={grp.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '16px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          position: 'relative',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                          opacity: grp.is_active ? 1 : 0.7
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: grp.is_active ? '#1e293b' : '#64748b', textDecoration: grp.is_active ? 'none' : 'line-through' }}>
                            {grp.nama}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                            <User size={15} style={{ color: '#94a3b8' }} />
                            <span style={{ fontWeight: '500' }}>{count}</span>
                          </div>

                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveGroupDropdownId(activeGroupDropdownId === grp.id ? null : grp.id);
                              }}
                              style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                            >
                              <MoreVertical size={16} />
                            </button>

                            {activeGroupDropdownId === grp.id && (
                              <>
                                <div 
                                  onClick={() => setActiveGroupDropdownId(null)}
                                  style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                                />
                                <div style={{ position: 'absolute', right: 0, top: '28px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', zIndex: 1000, minWidth: '140px', padding: '4px 0' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingGroup(grp);
                                      setGroupForm({ nama: grp.nama, diskon_persen: String(grp.diskon_persen) });
                                      setShowGroupModal(true);
                                      setActiveGroupDropdownId(null);
                                    }}
                                    style={{ width: '100%', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <Edit2 size={14} />
                                    <span>Ubah</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleToggleGroup(grp);
                                      setActiveGroupDropdownId(null);
                                    }}
                                    style={{ width: '100%', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', color: grp.is_active ? '#e11d48' : '#16a34a', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <span style={{ fontSize: '10px' }}>{grp.is_active ? '●' : '○'}</span>
                                    <span>{grp.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDeleteGroup(grp);
                                      setActiveGroupDropdownId(null);
                                    }}
                                    style={{ width: '100%', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', textAlign: 'left', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <Trash2 size={14} />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {showGuestCard && (
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '16px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'relative',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                          Guest
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          Bawaan sistem
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px' }}>
                          <User size={15} style={{ color: '#94a3b8' }} />
                          <span style={{ fontWeight: '500' }}>
                            {customers.filter(c => !c.customer_group && !c.customer_group_nama).length}
                          </span>
                        </div>

                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveGroupDropdownId(activeGroupDropdownId === 'guest' ? null : 'guest');
                            }}
                            style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                          >
                            <MoreVertical size={16} />
                          </button>

                          {activeGroupDropdownId === 'guest' && (
                            <>
                              <div 
                                onClick={() => setActiveGroupDropdownId(null)}
                                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                              />
                              <div style={{ position: 'absolute', right: 0, top: '28px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', zIndex: 1000, minWidth: '140px', padding: '4px 0' }}>
                                <button
                                  type="button"
                                  disabled
                                  style={{ width: '100%', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', textAlign: 'left', cursor: 'not-allowed', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                  <Edit2 size={14} />
                                  <span>Ubah</span>
                                </button>
                                <button
                                  type="button"
                                  disabled
                                  style={{ width: '100%', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', textAlign: 'left', cursor: 'not-allowed', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #f1f5f9' }}
                                >
                                  <Trash2 size={14} />
                                  <span>Hapus</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {showGroupModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', zIndex: 1000, display: 'grid', placeItems: 'center' }}>
                  <div 
                    onClick={() => { setShowGroupModal(false); setEditingGroup(null); }}
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  <div style={{ background: '#fff', borderRadius: '12px', width: '420px', padding: '24px', position: 'relative', zIndex: 1001, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                    <button
                      type="button"
                      onClick={() => { setShowGroupModal(false); setEditingGroup(null); }}
                      style={{ position: 'absolute', right: '16px', top: '16px', border: 0, background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <X size={18} />
                    </button>

                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                      {editingGroup ? 'Ubah Tipe Pelanggan' : 'Tambah Tipe Pelanggan'}
                    </h3>

                    <form onSubmit={handleSaveGroup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Nama Tipe *</label>
                        <input
                          type="text"
                          value={groupForm.nama}
                          onChange={e => setGroupForm(p => ({ ...p, nama: e.target.value }))}
                          placeholder="Contoh: Reseller, VIP, dll."
                          required
                          style={{ border: '1px solid #cbd5e1', borderRadius: '6px', height: '38px', padding: '0 12px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Diskon Khusus (%)</label>
                        <input
                          type="number"
                          value={groupForm.diskon_persen}
                          onChange={e => setGroupForm(p => ({ ...p, diskon_persen: e.target.value }))}
                          placeholder="0"
                          style={{ border: '1px solid #cbd5e1', borderRadius: '6px', height: '38px', padding: '0 12px', fontSize: '13px' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => { setShowGroupModal(false); setEditingGroup(null); }}
                          style={{ background: '#f1f5f9', color: '#475569', border: 0, borderRadius: '6px', padding: '0 16px', height: '38px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          Batal
                        </button>
                        <button
                          type="submit"
                          disabled={savingGroup}
                          style={{
                            background: '#82c341', // Green from screenshot
                            color: '#fff',
                            border: 0,
                            borderRadius: '6px',
                            padding: '0 16px',
                            height: '38px',
                            fontSize: '13px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            opacity: savingGroup ? 0.7 : 1
                          }}
                        >
                          {savingGroup ? 'Menyimpan...' : 'Simpan'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ULASAN PELANGGAN */}
          {activeTab === 'reviews' && (
            <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr', gap: '20px' }}>
              <form onSubmit={handleAddReview} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', height: 'fit-content' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Tulis Ulasan Baru</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={labelSm}>Nama Pelanggan</label>
                  <select value={reviewForm.customer} onChange={e => setReviewForm(p => ({ ...p, customer: e.target.value }))} style={{ ...inputSm, background: '#fff' }}>
                    <option value="">-- Pilih Pelanggan (Opsional) --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={labelSm}>Rating</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={22} onClick={() => setReviewForm(p => ({ ...p, rating: star }))}
                        style={{ cursor: 'pointer', fill: star <= reviewForm.rating ? '#eab308' : 'none', stroke: star <= reviewForm.rating ? '#eab308' : '#cbd5e1', transition: 'all 0.1s' }} />
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={labelSm}>Komentar Ulasan *</label>
                  <textarea value={reviewForm.comment} onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))} required placeholder="Berikan komentar mengenai kualitas cetak atau layanan..." rows={4} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', resize: 'vertical', outline: 'none' }} />
                </div>
                <button type="submit" disabled={savingReview} style={{ background: '#0ea5e9', color: '#fff', border: 0, borderRadius: '6px', height: '38px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', opacity: savingReview ? 0.7 : 1 }}>
                  {savingReview ? 'Mengirim...' : 'Kirim Ulasan'}
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 2px 0' }}>Rata-rata Rating Toko</h4>
                    <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Berdasarkan {reviews.length} ulasan pelanggan</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={24} style={{ fill: '#eab308', stroke: '#eab308' }} />
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>{avgRating}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>/ 5.0</span>
                  </div>
                </div>

                {loadingReviews ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>Memuat...</p>
                ) : reviews.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>Belum ada ulasan.</p>
                ) : reviews.map(rev => (
                  <div key={rev.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fff', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginRight: '8px' }}>{rev.customer_name || 'Pelanggan Umum'}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{fmtDate(rev.created_at)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star key={star} size={14} style={{ fill: star <= rev.rating ? '#eab308' : 'none', stroke: star <= rev.rating ? '#eab308' : '#cbd5e1' }} />
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.5', fontStyle: 'italic' }}>"{rev.comment}"</p>
                    <button onClick={() => handleDeleteReview(rev)} style={{ position: 'absolute', right: '16px', bottom: '12px', border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: KEPUASAN PELANGGAN (ilustratif — belum ada integrasi survei WA) */}
          {activeTab === 'satisfaction' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: '#bae6fd', color: '#0284c7', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                    <Heart size={24} style={{ fill: '#0284c7' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#0369a1', margin: '0 0 2px 0' }}>Customer Satisfaction (CSAT)</h4>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0369a1', margin: 0 }}>94.2%</h2>
                    <p style={{ fontSize: '11px', color: '#0284c7', margin: 0 }}>Sangat Puas / Sangat Baik</p>
                  </div>
                </div>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: '#bbf7d0', color: '#16a34a', width: '48px', height: '48px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                    <ThumbsUp size={24} style={{ fill: '#16a34a' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: '#15803d', margin: '0 0 2px 0' }}>Net Promoter Score (NPS)</h4>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#15803d', margin: 0 }}>+72</h2>
                    <p style={{ fontSize: '11px', color: '#16a34a', margin: 0 }}>Loyalitas Pelanggan Sangat Kuat</p>
                  </div>
                </div>
              </div>

              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '14px 16px', fontSize: '12px', color: '#92400e' }}>
                Angka di halaman ini masih ilustratif — perhitungannya berasal dari survei resi WhatsApp yang diisi pelanggan, dan integrasi tersebut belum tersedia di sistem ini.
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 16px 0' }}>Faktor Nilai Kepuasan Layanan</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'Kualitas Cetakan (Resolusi & Kecerahan Warna)', score: 96 },
                    { label: 'Kecepatan Waktu Pengerjaan (SPK)', score: 88 },
                    { label: 'Keramahan Admin WhatsApp & Kasir', score: 92 },
                    { label: 'Kesesuaian Harga dengan Spek Bahan', score: 90 }
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>
                        <span>{item.label}</span>
                        <span>{item.score}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${item.score}%`, height: '100%', background: '#0ea5e9', borderRadius: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SUPPLIER */}
          {activeTab === 'supplier' && (
            <>
              {showSupplierForm ? (
                <SupplierFormPage
                  supplier={editingSupplier}
                  onSave={handleSaveSupplier}
                  onCancel={() => { setShowSupplierForm(false); setEditingSupplier(null); }}
                  saving={savingSupplier}
                />
              ) : activeSupplier ? (
                <SupplierDetailPage
                  supplier={activeSupplier}
                  onEdit={(sup) => { setEditingSupplier(sup); setShowSupplierForm(true); }}
                  onDelete={handleDeleteSupplier}
                  onBack={() => setActiveSupplier(null)}
                />
              ) : (
                <>
                  {/* Title & Count Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Supplier Supplier</h2>
                      <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{suppliers.length} Supplier</p>
                    </div>
                    
                    {/* Action buttons on the right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Download Excel */}
                      <button
                        onClick={handleExportSuppliers}
                        disabled={filteredSuppliers.length === 0}
                        style={{
                          background: 'transparent',
                          border: 0,
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: filteredSuppliers.length === 0 ? '#94a3b8' : '#0ea5e9',
                          cursor: filteredSuppliers.length === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Download size={14} />
                        <span>Download Excel</span>
                      </button>

                      {/* Import CSV */}
                      <button
                        onClick={() => setShowSupplierImportModal(true)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '0 16px',
                          height: '34px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Upload size={14} />
                        <span>Import</span>
                      </button>

                      {/* Tambah Button */}
                      <button
                        onClick={openSupplierCreate}
                        style={{
                          background: '#82c341', // Olsera green
                          color: '#ffffff',
                          border: 0,
                          borderRadius: '6px',
                          padding: '0 16px',
                          height: '34px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Plus size={14} />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>

                  {/* Toolbar Row */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    {/* Rows dropdown */}
                    <div>
                      <select
                        value={supplierPageSize}
                        onChange={e => {
                          setSupplierPageSize(Number(e.target.value));
                          setSupplierCurrentPage(1);
                        }}
                        style={{
                          height: '34px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          background: '#ffffff',
                          outline: 'none',
                          color: '#475569'
                        }}
                      >
                        <option value={10}>10 Baris</option>
                        <option value={25}>25 Baris</option>
                        <option value={50}>50 Baris</option>
                        <option value={100}>100 Baris</option>
                      </select>
                    </div>

                    {/* Search query */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Cari..."
                        value={supplierQuery}
                        onChange={e => setSupplierQuery(e.target.value)}
                        style={{
                          width: '200px',
                          height: '34px',
                          padding: '0 12px 0 32px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          fontSize: '13px',
                          color: '#334155'
                        }}
                      />
                      <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    </div>
                  </div>

                  {/* Table */}
                  {loadingSuppliers ? (
                    <p style={{ fontSize: '13px', color: '#94a3b8' }}>Memuat...</p>
                  ) : filteredSuppliers.length === 0 ? (
                    <div style={{ display: 'grid', placeItems: 'center', minHeight: '160px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b', fontSize: '13px' }}>
                      Belum ada supplier bahan baku ditambahkan.
                    </div>
                  ) : (
                    <>
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Nama</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Personal Yg Dihubungi</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Email</th>
                              <th style={{ padding: '12px 16px', fontWeight: 'bold', color: '#475569' }}>Telpon</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedSuppliers.map(sup => (
                              <tr key={sup.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '12px 16px' }}>
                                  <button
                                    onClick={() => setActiveSupplier(sup)}
                                    style={{
                                      background: 'transparent',
                                      border: 0,
                                      padding: 0,
                                      fontWeight: 'bold',
                                      color: '#0ea5e9', // Blue link
                                      cursor: 'pointer',
                                      fontSize: '13px',
                                      textAlign: 'left'
                                    }}
                                  >
                                    {sup.nama}
                                  </button>
                                </td>
                                <td style={{ padding: '12px 16px', color: '#334155' }}>{sup.kontak_pic || '-'}</td>
                                <td style={{ padding: '12px 16px', color: '#334155' }}>{sup.email || '-'}</td>
                                <td style={{ padding: '12px 16px', color: '#334155' }}>{sup.phone || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Bottom Pagination Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px', fontSize: '13px', color: '#475569' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            disabled={supplierCurrentPage === 1}
                            onClick={() => setSupplierCurrentPage(p => Math.max(1, p - 1))}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: supplierCurrentPage === 1 ? 'not-allowed' : 'pointer',
                              opacity: supplierCurrentPage === 1 ? 0.5 : 1
                            }}
                          >
                            &lt;
                          </button>
                          <span style={{ padding: '0 8px', fontWeight: 'bold' }}>{supplierCurrentPage}</span>
                          <button
                            disabled={supplierCurrentPage === totalSupplierPages}
                            onClick={() => setSupplierCurrentPage(p => Math.min(totalSupplierPages, p + 1))}
                            style={{
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: supplierCurrentPage === totalSupplierPages ? 'not-allowed' : 'pointer',
                              opacity: supplierCurrentPage === totalSupplierPages ? 0.5 : 1
                            }}
                          >
                            &gt;
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Go to</span>
                          <input
                            type="number"
                            min={1}
                            max={totalSupplierPages}
                            value={supplierCurrentPage}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (val >= 1 && val <= totalSupplierPages) {
                                setSupplierCurrentPage(val);
                              }
                            }}
                            style={{
                              width: '45px',
                              height: '28px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              textAlign: 'center',
                              outline: 'none',
                              fontSize: '13px'
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Import Modal */}
              {showSupplierImportModal && (
                <SupplierImportModal
                  onClose={() => setShowSupplierImportModal(false)}
                  onImported={() => {
                    setShowSupplierImportModal(false);
                    fetchSuppliers();
                  }}
                />
              )}
            </>
          )}

        </div>
      </section>
        </div>
      </div>
      {(showAddCustomerModal || editingCustomer) && (
        <AddCustomerModal
          customer={editingCustomer}
          groups={groups}
          onClose={closeCustomerModal}
          onSaved={handleCustomerSaved}
        />
      )}
    </div>
  );
}

export default function CustomerSupplierApp() {
  return (
    <TransaksiProvider>
      <CustomerSupplierInner />
    </TransaksiProvider>
  );
}
