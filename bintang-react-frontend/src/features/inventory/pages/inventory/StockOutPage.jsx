import { useState, useEffect } from 'react';
import { Search, ChevronDown, Calendar, Printer, X, Plus, CloudUpload, Download, Check, ChevronsUpDown, ArrowLeft, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import apiClient from '../../../../api/apiClient';
import { getLogoUrl } from '../../../../utils/logo';
import { useAuth } from '../../../../context/AuthContext';
import { fetchAllPages } from '../../../../utils/paginatedApi';
import { todayISO, startOfYearISO } from '../../../../utils/date';
import { receivedByDisplay, receivedByRaw } from '../../../../utils/stockDocument';
import { ImportCsvModal } from './ImportCsvModal';


const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const STATUS_LABEL = { draft: 'Draft', selesai: 'Selesai', batal: 'Batal' };
// Daftar alasan Olsera, urut seperti di layarnya. 'transfer' & 'manual' sengaja
// TIDAK ditawarkan: 'transfer' punya alurnya sendiri (lewat Transfer ke), dan
// 'manual' cuma nilai bawaan dokumen lama — keduanya tetap ada di REASON_LABEL
// supaya dokumen lama tetap terbaca.
const REASON_OPTIONS = [
  { value: 'rusak', label: 'Rusak' },
  { value: 'kadaluarsa', label: 'Kadaluarsa' },
  { value: 'refund', label: 'Pengembalian dana (refund)' },
  { value: 'kelebihan_stok', label: 'Jumlah stock kelebihan' },
  { value: 'lainnya', label: 'Alasan lainnya' },
];
const REASON_LABEL = {
  transfer: 'Transfer Toko',
  manual: 'Manual',
  ...Object.fromEntries(REASON_OPTIONS.map((o) => [o.value, o.label])),
};

// Untuk 'lainnya', teks bebasnya lebih menjelaskan daripada label "Alasan lainnya".
const reasonText = (doc) => {
  if (doc.alasan === 'lainnya' && doc.alasan_lainnya) return doc.alasan_lainnya;
  return REASON_LABEL[doc.alasan] || doc.alasan || '-';
};

// Batas baris import CSV — harus sama dengan CSV_IMPORT_MAX_ROWS_STOCK_OUT di
// backend (product_views.py) supaya user tidak ditolak server setelah pratinjau
// terlanjur menyatakan aman. Olsera memakai 500 untuk Stok Keluar (Stok Masuk 200).
const CSV_MAX_ROWS = 500;
// Kolom template resmi Olsera: to_store_url_id,product,variant,sku,qty
const CSV_PREVIEW_COLUMNS = [
  { key: 'to_store_url_id', label: 'Transfer Ke' },
  { key: 'product', label: 'Produk' },
  { key: 'variant', label: 'Varian' },
  { key: 'sku', label: 'SKU' },
  { key: 'qty', label: 'Qty' },
];

const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(`${isoStr}T00:00:00`);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTHS_ID[d.getMonth()]}-${d.getFullYear()}`;
};

const mapDocToRow = (doc) => ({
  id: doc.id,
  no: doc.nomor,
  transferTo: doc.transfer_ke || '-',
  date: formatDisplayDate(doc.tanggal),
  note: doc.catatan || '-',
  reason: reasonText(doc),
  status: STATUS_LABEL[doc.status] || doc.status,
  receivedBy: receivedByDisplay(doc),
  // Nilai mentah untuk export XLSX
  transferToRaw: doc.transfer_ke || '',
  tanggalRaw: doc.tanggal || '',
  noteRaw: doc.catatan || '',
  receivedByRaw: receivedByRaw(doc),
});

export function StockOutPage({ onToggleCreate, viewState: propViewState }) {
  const { businessSettings } = useAuth();
  const [viewState, setViewState] = useState('list'); // 'list', 'create', 'detail'

  useEffect(() => {
    if (propViewState) {
      setViewState(propViewState);
    }
  }, [propViewState]);

  const [showTambahDropdown, setShowTambahDropdown] = useState(false);
  // Dropdown Cetak: Download PDF / Delivery Order / Cetak A5
  const [cetakMenuOpen, setCetakMenuOpen] = useState(false);
  // File, pratinjau, dan status import dipegang ImportCsvModal.
  const [showImportModal, setShowImportModal] = useState(false);

  // Stock List State
  const [stockList, setStockList] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  const fetchDocuments = async () => {
    setListLoading(true);
    try {
      const data = await fetchAllPages('/stock-out-documents/');
      setStockList(data.map(mapDocToRow));
    } catch (err) {
      console.error('[StockOutPage] fetch documents error:', err);
      setStockList([]);
      alert('Gagal memuat dokumen stok keluar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Form State
  // Pakai tanggal lokal — toISOString() memundurkan tanggal sehari di WIB
  // pada dini hari, sehingga dokumen tercatat di tanggal yang salah.
  const todayStr = todayISO();
  const [tanggal, setTanggal] = useState(todayStr);
  const [catatan, setCatatan] = useState('');
  const [transferKe, setTransferKe] = useState('');
  const [createType, setCreateType] = useState('transfer'); // 'transfer' | 'manual'

  // Autocomplete Product Search
  const [searchProduct, setSearchProduct] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [qtyValue, setQtyValue] = useState(1);
  // Satuan alternatif (UOM); backend mengonversi ke satuan dasar.
  const [uomKode, setUomKode] = useState('');
  const [uomAktif, setUomAktif] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/business-settings/');
        setUomAktif(!!res.data?.uom_multi_enabled);
      } catch {
        setUomAktif(false);
      }
    })();
  }, []);
  const [itemSaving, setItemSaving] = useState(false);
  const [searchListQuery, setSearchListQuery] = useState('');

  // Active Detail Document (for Staging / Detail screen)
  const [activeDetailDoc, setActiveDetailDoc] = useState(null);

  useEffect(() => {
    if (!searchProduct.trim()) {
      setProductOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products/', { params: { search: searchProduct, page: 1, page_size: 100 } });
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setProductOptions(data);
      } catch (err) {
        console.error('[StockOutPage] search product error:', err);
        setProductOptions([]);
        alert('Gagal mencari produk: ' + (err.response?.data?.detail || err.message));
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchProduct]);

  const fetchDocumentDetail = async (id) => {
    const res = await apiClient.get(`/stock-out-documents/${id}/`);
    setActiveDetailDoc(res.data);
    return res.data;
  };

  // Sort & Pagination State
  const [sortKey, setSortKey] = useState('no');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inline editing states for Detail Metadata Cards
  const [isEditingTanggal, setIsEditingTanggal] = useState(false);
  const [isEditingCatatan, setIsEditingCatatan] = useState(false);
  const [isEditingAlasan, setIsEditingAlasan] = useState(false);
  const [isEditingTransferKe, setIsEditingTransferKe] = useState(false);

  // Inline edit input value states
  const [editTanggalValue, setEditTanggalValue] = useState('');
  const [editCatatanValue, setEditCatatanValue] = useState('');
  const [editAlasanValue, setEditAlasanValue] = useState('');
  const [editAlasanLainnyaValue, setEditAlasanLainnyaValue] = useState('');
  const [editTransferKeValue, setEditTransferKeValue] = useState('');

  const [validationError, setValidationError] = useState('');
  const [startDate, setStartDate] = useState(startOfYearISO());
  const [endDate, setEndDate] = useState(todayStr);
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('custom');

  // Column Widths
  const [columnWidths, setColumnWidths] = useState({
    no: 180,
    transferTo: 180,
    date: 150,
    note: 180,
    reason: 160,
    status: 120,
    receivedBy: 180
  });

  const handleResizeStart = (e, colKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colKey];

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [colKey]: Math.max(80, startWidth + deltaX)
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchListQuery, pageSize]);

  const handleStateChange = (state) => {
    setViewState(state);
    if (onToggleCreate) {
      onToggleCreate(state);
    }
    if (state === 'list') {
      fetchDocuments();
    }
  };

  // Buat dokumen draft baru di backend
  const handleStageStock = async () => {
    try {
      const res = await apiClient.post('/stock-out-documents/', {
        tanggal,
        catatan,
        alasan: createType,
        transfer_ke: createType === 'transfer' ? transferKe : '',
      });
      setActiveDetailDoc(res.data);
      handleStateChange('detail');

      setTanggal(todayStr);
      setCatatan('');
      setTransferKe('');
    } catch (err) {
      console.error('[StockOutPage] create document error:', err);
      setValidationError('Gagal membuat dokumen stok keluar.');
    }
  };

  // Import CSV — pratinjau & validasi ditangani ImportCsvModal; di sini murni
  // panggilan API-nya.
  const prosesImportCsv = async (file) => {
    const docRes = await apiClient.post('/stock-out-documents/', {
      tanggal: todayStr,
      catatan: 'Import CSV',
      alasan: 'transfer',
    });
    const docId = docRes.data.id;

    const fd = new FormData();
    fd.append('file', file);
    const importRes = await apiClient.post(`/stock-out-documents/${docId}/import-csv/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return {
      errors: importRes.data.errors || [],
      createdCount: importRes.data.created?.length || 0,
      document: importRes.data.document,
    };
  };

  // Commit document status
  const handleCommitStockOut = async (targetStatus) => {
    if (targetStatus === 'Draft') {
      handleStateChange('list');
      return;
    }
    try {
      if (targetStatus === 'Batal') {
        await apiClient.post(`/stock-out-documents/${activeDetailDoc.id}/cancel/`);
      } else if (targetStatus === 'Selesai') {
        await apiClient.post(`/stock-out-documents/${activeDetailDoc.id}/post-document/`);
      }
      handleStateChange('list');
    } catch (err) {
      const message = err.response?.data?.error || 'Gagal memproses dokumen stok keluar.';
      setValidationError(message);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleExport = (rows) => {
    // Belum ada file referensi asli Olsera utk stock-out — kolom disusun mengikuti
    // pola stock-in (no, ..., date, notes, status, received by) sebagai perkiraan terbaik.
    const data = rows.map((row) => ({
      no: row.no,
      'transfer to': row.transferToRaw,
      reason: row.reason === '-' ? '' : row.reason,
      date: row.tanggalRaw,
      notes: row.noteRaw,
      status: row.status,
      'received by': row.receivedByRaw,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `stockoutgoing-${startDate}__${endDate}.xlsx`);
  };

  // Filtering and Sorting
  const filteredList = stockList.filter(row => {
    const q = searchListQuery.toLowerCase();
    
    let matchesDate = true;
    if (row.date) {
      const parts = row.date.split('-');
      if (parts.length === 3) {
        const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5, Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11 };
        const rowDate = new Date(parts[2], months[parts[1]] || 0, parts[0]);
        
        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');
        matchesDate = rowDate >= start && rowDate <= end;
      }
    }

    return (
      matchesDate &&
      (row.no.toLowerCase().includes(q) ||
       row.transferTo.toLowerCase().includes(q) ||
       row.note.toLowerCase().includes(q))
    );
  });

  const sortedList = [...filteredList].sort((a, b) => {
    let aVal = a[sortKey] || '';
    let bVal = b[sortKey] || '';

    if (sortKey === 'date') {
      const parseDate = (dStr) => {
        const parts = dStr.split('-');
        if (parts.length < 3) return new Date(0);
        const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5, Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11 };
        return new Date(parts[2], months[parts[1]] || 0, parts[0]);
      };
      aVal = parseDate(aVal).getTime();
      bVal = parseDate(bVal).getTime();
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalItems = sortedList.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedList = sortedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getFormattedRange = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const parse = (dateStr) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = months[d.getMonth()];
      const year = String(d.getFullYear()).slice(-2);
      return `${day} ${month} ${year}`;
    };
    return `${parse(startDate)} - ${parse(endDate)}`;
  };

  const handleShiftDate = (direction) => {
    setSelectedPreset('custom');
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const shiftDays = direction * diffDays;
    
    const newStart = new Date(start.setDate(start.getDate() + shiftDays));
    const newEnd = new Date(end.setDate(end.getDate() + shiftDays));
    
    const toISO = (d) => d.toISOString().split('T')[0];
    setStartDate(toISO(newStart));
    setEndDate(toISO(newEnd));
  };

  const handlePresetSelect = (preset) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'last7':
        start.setDate(today.getDate() - 6);
        break;
      case 'last30':
        start.setDate(today.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      case 'lastYear':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }
    
    const toISO = (d) => d.toISOString().split('T')[0];
    setStartDate(toISO(start));
    setEndDate(toISO(end));
    setSelectedPreset(preset);
    
    if (preset !== 'custom') {
      setShowDateDropdown(false);
    }
  };

  // Inline updates PATCH
  // Mengembalikan true bila tersimpan, supaya pemanggilnya tidak menutup editor
  // (dan membuang ketikan user) saat server menolak.
  const patchDocument = async (payload) => {
    try {
      const res = await apiClient.patch(`/stock-out-documents/${activeDetailDoc.id}/`, payload);
      setActiveDetailDoc(res.data);
      return true;
    } catch (err) {
      console.error('[StockOutPage] patch document error:', err);
      const data = err.response?.data;
      // DRF mengirim error per-field ({ alasan_lainnya: ['...'] }), bukan { error }.
      // Tanpa ini pesannya jatuh ke teks generik dan alasan penolakannya hilang.
      const pesan = typeof data === 'string'
        ? data
        : data?.error || (data ? Object.values(data).flat()[0] : null);
      setValidationError(typeof pesan === 'string' ? pesan : 'Gagal menyimpan perubahan.');
      return false;
    }
  };

  const saveInlineTanggal = async () => {
    await patchDocument({ tanggal: editTanggalValue });
    setIsEditingTanggal(false);
  };

  const saveInlineCatatan = async () => {
    await patchDocument({ catatan: editCatatanValue });
    setIsEditingCatatan(false);
  };

  const saveInlineAlasan = async () => {
    const teks = editAlasanLainnyaValue.trim();
    if (editAlasanValue === 'lainnya' && !teks) {
      setValidationError('Tulis dulu alasannya saat memilih "Alasan lainnya".');
      return;
    }
    const tersimpan = await patchDocument({
      alasan: editAlasanValue,
      // Teks bebas hanya berlaku untuk 'lainnya'; backend juga membuangnya
      // untuk alasan lain, dikirim di sini supaya tampilannya langsung cocok.
      alasan_lainnya: editAlasanValue === 'lainnya' ? teks : '',
    });
    if (tersimpan) setIsEditingAlasan(false);
  };

  const saveInlineTransferKe = async () => {
    await patchDocument({ transfer_ke: editTransferKeValue });
    setIsEditingTransferKe(false);
  };

  const handleAddItem = async () => {
    if (!selectedProduct || itemSaving) return;
    if (selectedProduct.variants && selectedProduct.variants.length > 0 && !selectedVariant) {
      setValidationError('Silakan pilih varian produk terlebih dahulu.');
      return;
    }
    setItemSaving(true);
    try {
      await apiClient.post(`/stock-out-documents/${activeDetailDoc.id}/add-item/`, {
        product: selectedProduct.id,
        qty: qtyValue,
        variant: selectedVariant ? selectedVariant.id : null,
        uom_kode: uomKode || null,
      });
      await fetchDocumentDetail(activeDetailDoc.id);
      setSelectedProduct(null);
      setSelectedVariant(null);
      setSearchProduct('');
      setProductOptions([]);
      setQtyValue(1);
      setUomKode('');
    } catch (err) {
      console.error('[StockOutPage] add item error:', err);
      setValidationError(err.response?.data?.error || 'Gagal menambah produk.');
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      const res = await apiClient.post(`/stock-out-documents/${activeDetailDoc.id}/remove-item/`, { item_id: itemId });
      setActiveDetailDoc(res.data);
    } catch (err) {
      console.error('[StockOutPage] remove item error:', err);
      setValidationError(err.response?.data?.error || 'Gagal menghapus produk.');
    }
  };

  /**
   * Cetak dokumen stok keluar.
   *
   * mode:
   *  - 'pdf'            : tampilan A4 biasa. Tidak ada library PDF di proyek ini,
   *                       jadi "Download PDF" mengandalkan dialog cetak browser —
   *                       user memilih "Save as PDF". Teksnya tetap tajam & bisa
   *                       dicari, beda dengan hasil raster library PDF.
   *  - 'delivery-order' : surat jalan — menonjolkan penerima dan menyediakan
   *                       kolom tanda tangan pengirim/penerima.
   *  - 'a5'             : sama seperti 'pdf' tapi kertas A5 dengan skala lebih kecil.
   */
  const handleCetak = (mode = 'pdf') => {
    if (!activeDetailDoc) return;
    const isA5 = mode === 'a5';
    const isDeliveryOrder = mode === 'delivery-order';
    const doc = activeDetailDoc;
    const esc = (v) => String(v ?? '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const namaBisnis = businessSettings?.nama_bisnis || '';
    const logoUrl = getLogoUrl(businessSettings?.logo_url);
    let totalQty = 0;
    const rows = (doc.items || []).map((item, i) => {
      const qty = Number(item.qty) || 0;
      totalQty += qty;
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.product_nama)}${item.product_sku ? ` (${esc(item.product_sku)})` : ''}</td>
        <td style="text-align:right">${qty} ${esc(item.product_satuan || '')}</td>
      </tr>`;
    }).join('');
    const infoExtra = [
      doc.alasan === 'transfer' && doc.transfer_ke ? `Transfer ke: ${esc(doc.transfer_ke)}` : `Alasan: ${esc(reasonText(doc))}`,
      doc.catatan ? `Catatan: ${esc(doc.catatan)}` : '',
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    const judul = isDeliveryOrder ? 'SURAT JALAN' : `No. Stok Keluar #${esc(doc.nomor)}`;
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(doc.nomor)}</title>
      <style>
        @page { size: ${isA5 ? 'A5' : 'A4'}; margin: ${isA5 ? '8mm' : '14mm'}; }
        body { font-family: Arial, sans-serif; font-size: ${isA5 ? '10px' : '13px'}; color: #111; margin: 0; }
        .logo-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: ${isA5 ? '8px' : '16px'}; margin-bottom: ${isA5 ? '8px' : '16px'}; min-height: ${isA5 ? '34px' : '60px'}; display: flex; align-items: center; }
        .logo-box img { max-height: ${isA5 ? '30px' : '56px'}; max-width: ${isA5 ? '100px' : '160px'}; object-fit: contain; }
        .doc-title { font-size: ${isDeliveryOrder ? '18px' : (isA5 ? '12px' : '15px')}; margin: 0 0 4px; ${isDeliveryOrder ? 'letter-spacing: 2px; text-align: center; font-weight: bold;' : ''} }
        .doc-title .biz { font-size: ${isA5 ? '10px' : '12px'}; color: #555; margin-left: 6px; }
        .tanggal { margin: 6px 0 4px; }
        .info-extra { color: #666; font-size: ${isA5 ? '9px' : '11px'}; margin-bottom: 10px; }
        table.items { border-collapse: collapse; width: 100%; margin-top: ${isA5 ? '6px' : '10px'}; }
        table.items th, table.items td { border: 1px solid #999; padding: ${isA5 ? '3px 5px' : '6px 8px'}; text-align: left; }
        table.items th { background: #f8fafc; }
        .foot { margin-top: ${isA5 ? '12px' : '24px'}; color: #999; font-size: ${isA5 ? '8px' : '10px'}; }
        .kepada { border: 1px solid #999; padding: 10px 12px; margin: 12px 0; }
        .kepada .label { color: #666; font-size: 11px; margin-bottom: 2px; }
        .kepada .nama { font-size: 14px; font-weight: bold; }
        .ttd { display: flex; justify-content: space-between; margin-top: 48px; }
        .ttd div { width: 40%; text-align: center; }
        .ttd .garis { margin-top: 56px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
      </style></head><body>
      <div class="logo-box">${logoUrl ? `<img src="${esc(logoUrl)}" alt="logo">` : ''}</div>
      <p class="doc-title">${judul}${isDeliveryOrder ? '' : `<span class="biz">${esc(namaBisnis)}</span>`}</p>
      ${isDeliveryOrder ? `<p class="tanggal" style="text-align:center;color:#555">${esc(namaBisnis)} &nbsp;·&nbsp; No. ${esc(doc.nomor)}</p>` : ''}
      <p class="tanggal"><strong>Tanggal</strong> : ${esc(doc.tanggal)}</p>
      ${isDeliveryOrder
        ? `<div class="kepada"><div class="label">Dikirim kepada</div><div class="nama">${esc(doc.transfer_ke || '-')}</div></div>`
        : (infoExtra ? `<p class="info-extra">${infoExtra}</p>` : '')}
      <table class="items">
        <thead><tr><th>#</th><th>Produk</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">Tidak ada produk</td></tr>'}</tbody>
        <tfoot><tr><td style="text-align:right"><strong>Total</strong></td><td></td><td style="text-align:right">${totalQty}</td></tr></tfoot>
      </table>
      ${isDeliveryOrder
        ? `<div class="ttd"><div><div>Pengirim</div><div class="garis">( .......................... )</div></div><div><div>Penerima</div><div class="garis">( .......................... )</div></div></div>`
        : ''}
      <p class="foot">Dicetak ${new Date().toLocaleString('id-ID')}</p>
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`;
    const win = window.open('', '_blank', isA5 ? 'width=600,height=520' : 'width=800,height=600');
    if (!win) {
      setValidationError('Popup diblokir browser. Izinkan popup untuk mencetak.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  return (
    <>
      {viewState === 'list' && (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Daftar Stok Keluar</h2>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>{stockList.length} Stok Keluar</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Date Range Picker */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', height: '34px', position: 'relative' }}>
                <button 
                  type="button" 
                  onClick={() => handleShiftDate(-1)} 
                  style={{ border: 0, background: 'transparent', padding: '0 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', borderTopLeftRadius: '6px', borderBottomLeftRadius: '6px' }}
                >
                  &lt;
                </button>
                <div 
                  onClick={() => setShowDateDropdown(!showDateDropdown)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 8px', fontSize: '13px', color: '#1e293b', fontWeight: '500', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', height: '100%', cursor: 'pointer', userSelect: 'none' }}
                >
                  <Calendar size={14} style={{ color: '#64748b' }} />
                  <span>{getFormattedRange()}</span>
                  <ChevronDown size={12} style={{ color: '#64748b' }} />
                </div>
                <button 
                  type="button" 
                  onClick={() => handleShiftDate(1)} 
                  style={{ border: 0, background: 'transparent', padding: '0 10px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', borderTopRightRadius: '6px', borderBottomRightRadius: '6px' }}
                >
                  &gt;
                </button>

                {showDateDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '40px',
                    right: 0,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    padding: '8px 0',
                    zIndex: 1000,
                    width: '200px',
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                    {[
                      { id: 'today', label: 'Today' },
                      { id: 'yesterday', label: 'Yesterday' },
                      { id: 'last7', label: 'Last 7 Days' },
                      { id: 'last30', label: 'Last 30 Days' },
                      { id: 'thisMonth', label: 'This Month' },
                      { id: 'lastMonth', label: 'Last Month' },
                      { id: 'thisYear', label: 'This Year' },
                      { id: 'lastYear', label: 'Last Year' },
                      { id: 'custom', label: 'Custom Range' }
                    ].map((item) => {
                      const isSelected = selectedPreset === item.id;
                      return (
                        <div key={item.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (item.id === 'custom') {
                                setSelectedPreset('custom');
                              } else {
                                handlePresetSelect(item.id);
                              }
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              border: 0,
                              background: isSelected ? '#0ea5e9' : 'transparent',
                              color: isSelected ? '#ffffff' : '#334155',
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: isSelected ? 'bold' : 'normal',
                              cursor: 'pointer',
                              transition: 'background 0.2s, color 0.2s',
                              display: 'block'
                            }}
                            onMouseOver={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = '#f1f5f9';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            {item.label}
                          </button>
                          
                          {item.id === 'custom' && selectedPreset === 'custom' && (
                            <div style={{
                              padding: '12px 16px',
                              borderTop: '1px solid #e2e8f0',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              background: '#f8fafc'
                            }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>Mulai Dari</label>
                                <input 
                                  type="date" 
                                  value={startDate}
                                  onChange={(e) => setStartDate(e.target.value)}
                                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none' }}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#64748b', marginBottom: '2px' }}>Sampai Dengan</label>
                                <input 
                                  type="date" 
                                  value={endDate}
                                  onChange={(e) => setEndDate(e.target.value)}
                                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none' }}
                                />
                              </div>
                              <button 
                                type="button"
                                onClick={() => setShowDateDropdown(false)}
                                style={{ background: '#0ea5e9', color: '#ffffff', border: 0, borderRadius: '4px', padding: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s', marginTop: '4px', width: '100%' }}
                                onMouseOver={(e) => e.currentTarget.style.background = '#0284c7'}
                                onMouseOut={(e) => e.currentTarget.style.background = '#0ea5e9'}
                              >
                                Terapkan
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={() => handleExport(sortedList)}
                disabled={sortedList.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: sortedList.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  color: '#ffffff',
                  border: 0,
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: sortedList.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.2)'
                }}
              >
                <Download size={14} />
                <span>Export</span>
              </button>

              {/* Import Button — ImportCsvModal mengosongkan dirinya sendiri
                  saat ditutup, jadi di sini cukup membukanya. */}
              <button
                onClick={() => setShowImportModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #0f766e, #0d9488)',
                  color: '#ffffff',
                  border: 0,
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2)'
                }}
              >
                <CloudUpload size={14} />
                <span>Import</span>
              </button>

              {/* Tambah Dropdown Button */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setShowTambahDropdown(!showTambahDropdown)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', 
                    color: '#ffffff', 
                    border: 0, 
                    padding: '8px 16px', 
                    borderRadius: '6px', 
                    fontSize: '13px', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.2)'
                  }}
                >
                  <Plus size={14} />
                  <span>Tambah</span>
                  <ChevronDown size={12} />
                </button>

                {showTambahDropdown && (
                  <>
                    <div 
                      onClick={() => setShowTambahDropdown(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    />
                    <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', width: '220px', zIndex: 999, overflow: 'hidden' }}>
                      <button 
                        onClick={() => {
                          setShowTambahDropdown(false);
                          setCreateType('transfer');
                          handleStateChange('create');
                        }}
                        style={{ width: '100%', border: 0, background: 'transparent', padding: '10px 16px', textAlign: 'left', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                        className="pi-dropdown-item-hover"
                      >
                        Transfer ke Toko
                      </button>
                      <button 
                        onClick={() => {
                          setShowTambahDropdown(false);
                          setCreateType('manual');
                          handleStateChange('create');
                        }}
                        style={{ width: '100%', border: 0, background: 'transparent', padding: '10px 16px', textAlign: 'left', fontSize: '13px', color: '#334155', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}
                        className="pi-dropdown-item-hover"
                      >
                        Tambah Stok Keluar
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="pi-category-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div className="pi-category-card-body" style={{ padding: '20px' }}>
              {/* Row: Show / Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <select 
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  style={{ 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '6px', 
                    padding: '6px 12px', 
                    fontSize: '13px', 
                    color: '#334155', 
                    outline: 'none',
                    background: '#ffffff',
                    height: '34px',
                    minWidth: '100px'
                  }}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                </select>

                <div style={{ position: 'relative', width: '240px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="text" 
                    placeholder="Cari No. Stok Keluar" 
                    value={searchListQuery}
                    onChange={(e) => setSearchListQuery(e.target.value)}
                    style={{ 
                      width: '100%', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '6px', 
                      padding: '8px 10px 8px 32px', 
                      fontSize: '13px', 
                      outline: 'none', 
                      boxSizing: 'border-box',
                      height: '34px'
                    }}
                  />
                </div>
              </div>

              {/* Table Container - WITH RESIZABLE COLUMNS AND HORIZONTAL SCROLLSIDEWAY & VERTICAL DIVIDERS */}
              <div
                className="pi-table-scroll-container"
                style={{
                  overflowX: 'scroll',
                  width: '100%',
                  marginTop: '8px',
                  marginBottom: '16px',
                  border: '1px solid #e2e8f0',
                  // Sudut bawah dulu siku karena ditutup bar tombol scroll di
                  // bawahnya; bar itu sudah dibuang, jadi tabel menutup sendiri.
                  borderRadius: '6px'
                }}
              >
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  textAlign: 'left', 
                  tableLayout: 'fixed',
                  border: 'none' 
                }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {/* NO HEADER */}
                      <th 
                        onClick={() => handleSort('no')} 
                        style={{ 
                          width: `${columnWidths.no}px`, 
                          minWidth: `${columnWidths.no}px`,
                          maxWidth: `${columnWidths.no}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>No.</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'no' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'no')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>
                      
                      {/* TRANSFER TO HEADER */}
                      <th 
                        onClick={() => handleSort('transferTo')} 
                        style={{ 
                          width: `${columnWidths.transferTo}px`, 
                          minWidth: `${columnWidths.transferTo}px`,
                          maxWidth: `${columnWidths.transferTo}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Transfer ke</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'transferTo' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'transferTo')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>

                      {/* DATE HEADER */}
                      <th 
                        onClick={() => handleSort('date')} 
                        style={{ 
                          width: `${columnWidths.date}px`, 
                          minWidth: `${columnWidths.date}px`,
                          maxWidth: `${columnWidths.date}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Tanggal</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'date' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'date')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>

                      {/* NOTE HEADER */}
                      <th 
                        onClick={() => handleSort('note')} 
                        style={{ 
                          width: `${columnWidths.note}px`, 
                          minWidth: `${columnWidths.note}px`,
                          maxWidth: `${columnWidths.note}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Catatan</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'note' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'note')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>

                      {/* REASON HEADER */}
                      <th 
                        onClick={() => handleSort('reason')} 
                        style={{ 
                          width: `${columnWidths.reason}px`, 
                          minWidth: `${columnWidths.reason}px`,
                          maxWidth: `${columnWidths.reason}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Alasan</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'reason' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'reason')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>

                      {/* STATUS HEADER */}
                      <th 
                        onClick={() => handleSort('status')} 
                        style={{ 
                          width: `${columnWidths.status}px`, 
                          minWidth: `${columnWidths.status}px`,
                          maxWidth: `${columnWidths.status}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Status</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'status' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'status')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>

                      {/* RECEIVED BY HEADER */}
                      <th 
                        onClick={() => handleSort('receivedBy')} 
                        style={{ 
                          width: `${columnWidths.receivedBy}px`, 
                          minWidth: `${columnWidths.receivedBy}px`,
                          maxWidth: `${columnWidths.receivedBy}px`,
                          padding: '14px 20px', 
                          fontSize: '13px', 
                          fontWeight: 'bold', 
                          color: '#475569', 
                          cursor: 'pointer', 
                          userSelect: 'none', 
                          borderBottom: '1px solid #e2e8f0', 
                          borderTop: '1px solid #e2e8f0',
                          borderRight: '1px solid #e2e8f0',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Diterima Oleh</span>
                          <ChevronsUpDown size={14} style={{ color: sortKey === 'receivedBy' ? '#0ea5e9' : '#94a3b8' }} />
                        </div>
                        <div 
                          onMouseDown={(e) => handleResizeStart(e, 'receivedBy')}
                          onClick={(e) => e.stopPropagation()}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 20 }}
                          className="pi-resize-handle"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>{listLoading ? 'Memuat...' : 'No Data'}</span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedList.map((row, index) => (
                        <tr 
                          key={index} 
                          style={{ cursor: 'default' }}
                          className="pi-table-row-hover"
                        >
                          <td 
                            onClick={async () => {
                              await fetchDocumentDetail(row.id);
                              handleStateChange('detail');
                            }}
                            style={{ 
                              width: `${columnWidths.no}px`, 
                              minWidth: `${columnWidths.no}px`, 
                              maxWidth: `${columnWidths.no}px`, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap', 
                              padding: '14px 20px', 
                              fontSize: '13px', 
                              fontWeight: 'semibold', 
                              color: '#0ea5e9', 
                              cursor: 'pointer', 
                              borderBottom: '1px solid #e2e8f0', 
                              borderRight: '1px solid #e2e8f0' 
                            }}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            {row.no}
                          </td>
                          <td style={{ width: `${columnWidths.transferTo}px`, minWidth: `${columnWidths.transferTo}px`, maxWidth: `${columnWidths.transferTo}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '14px 20px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.transferTo}</td>
                          <td style={{ width: `${columnWidths.date}px`, minWidth: `${columnWidths.date}px`, maxWidth: `${columnWidths.date}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '14px 20px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.date}</td>
                          <td style={{ width: `${columnWidths.note}px`, minWidth: `${columnWidths.note}px`, maxWidth: `${columnWidths.note}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '14px 20px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.note || '-'}</td>
                          <td style={{ width: `${columnWidths.reason}px`, minWidth: `${columnWidths.reason}px`, maxWidth: `${columnWidths.reason}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '14px 20px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.reason}</td>
                          <td style={{ width: `${columnWidths.status}px`, minWidth: `${columnWidths.status}px`, maxWidth: `${columnWidths.status}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                            <span style={{ 
                              background: row.status === 'Draf' || row.status === 'Draft' ? '#ffedd5' : row.status === 'Selesai' ? '#dcfce7' : '#fee2e2', 
                              color: row.status === 'Draf' || row.status === 'Draft' ? '#ea580c' : row.status === 'Selesai' ? '#16a34a' : '#dc2626', 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px', 
                              fontWeight: 'bold' 
                            }}>{row.status}</span>
                          </td>
                          <td style={{ width: `${columnWidths.receivedBy}px`, minWidth: `${columnWidths.receivedBy}px`, maxWidth: `${columnWidths.receivedBy}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '14px 20px', fontSize: '13px', color: '#475569', borderBottom: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0' }}>{row.receivedBy}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-start', 
                alignItems: 'center', 
                gap: '16px', 
                marginTop: '16px', 
                fontSize: '13px', 
                color: '#64748b' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button 
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1} 
                    style={{ 
                      border: 0, 
                      background: 'none', 
                      color: currentPage === 1 ? '#cbd5e1' : '#64748b', 
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}
                  >
                    &lt;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      style={{
                        border: 0,
                        background: 'none',
                        color: currentPage === page ? '#0085ca' : '#64748b',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: currentPage === page ? '#e4f8ff' : 'transparent'
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages} 
                    style={{ 
                      border: 0, 
                      background: 'none', 
                      color: currentPage === totalPages ? '#cbd5e1' : '#64748b', 
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                      fontWeight: 'bold',
                      fontSize: '14px'
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
                    max={totalPages}
                    value={currentPage} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
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
            </div>
          </div>
        </div>
      )}

      {/* STATE: create */}
      {viewState === 'create' && (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
          <div className="pi-category-card" style={{ maxWidth: '1200px', margin: '0 auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b' }}>Tambah Stok Keluar</span>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Tanggal</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      style={{ 
                        width: '100%', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '4px', 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        color: '#334155', 
                        outline: 'none', 
                        boxSizing: 'border-box',
                        height: '36px'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Catatan</label>
                  <input 
                    type="text"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    style={{ 
                      width: '100%', 
                      border: '1px solid #cbd5e1', 
                      borderRadius: '4px', 
                      padding: '8px 12px', 
                      fontSize: '13px', 
                      color: '#334155', 
                      outline: 'none', 
                      boxSizing: 'border-box',
                      height: '36px'
                    }}
                  />
                </div>

                {createType === 'transfer' && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>Transfer ke</label>
                    <input 
                      type="text"
                      placeholder="Pilih toko (Autocomplete)"
                      value={transferKe}
                      onChange={(e) => setTransferKe(e.target.value)}
                      style={{ 
                        width: '100%', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '4px', 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        color: '#334155', 
                        outline: 'none', 
                        boxSizing: 'border-box',
                        height: '36px'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button 
                  onClick={() => handleStateChange('list')}
                  style={{ 
                    background: '#ffffff', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '4px', 
                    padding: '8px 20px', 
                    fontSize: '13px', 
                    fontWeight: 'bold', 
                    color: '#475569', 
                    cursor: 'pointer',
                    height: '36px'
                  }}
                >
                  Batal
                </button>
                <button 
                  onClick={handleStageStock}
                  style={{ 
                    background: '#0ea5e9', 
                    border: 0, 
                    borderRadius: '4px', 
                    padding: '8px 24px', 
                    fontSize: '13px', 
                    fontWeight: 'bold', 
                    color: '#ffffff', 
                    cursor: 'pointer',
                    height: '36px'
                  }}
                >
                  Lanjut tambah stok keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE: detail */}
      {viewState === 'detail' && activeDetailDoc && (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
          {/* Warning Banner */}
          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#b45309', fontSize: '13px' }}>
            <span>ⓘ Pastikan data sudah benar sebelum diposting. Setelah diposting, data tidak diperbolehkan diubah.</span>
          </div>

          {/* Header Card */}
          {/* Catatan: JANGAN pakai overflow:hidden di sini — itu memotong
              dropdown Cetak yang menjulur ke bawah kartu. Sudut membulat
              blok status di kiri diatur lewat borderRadius-nya sendiri. */}
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            marginBottom: '20px',
            minHeight: '80px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            {/* Left Status Block */}
            <div style={{
              background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
              borderRight: '1px solid #fed7aa',
              borderTopLeftRadius: '8px',
              borderBottomLeftRadius: '8px',
              padding: '16px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c2410c',
              gap: '4px',
              minWidth: '95px'
            }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>📄</span>
              <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{STATUS_LABEL[activeDetailDoc.status] || activeDetailDoc.status}</span>
            </div>

            {/* Center Title and Back Button */}
            <div style={{ flex: 1, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={() => handleStateChange('list')}
                title="Kembali ke Daftar"
                style={{ 
                  border: 0, 
                  background: '#f1f5f9', 
                  color: '#64748b', 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
              >
                <ArrowLeft size={16} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>No. Stok Keluar</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginTop: '1px' }}>{activeDetailDoc.nomor}</span>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 24px' }}>
              {/* Dropdown Cetak — Download PDF / Delivery Order / Cetak A5 */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setCetakMenuOpen((open) => !open)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: cetakMenuOpen ? '#f8fafc' : '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer',
                    height: '36px',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                  onMouseOut={(e) => e.currentTarget.style.background = cetakMenuOpen ? '#f8fafc' : '#ffffff'}
                >
                  <Printer size={14} />
                  <span>Cetak</span>
                  <ChevronDown size={14} style={{ transform: cetakMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>

                {cetakMenuOpen && (
                  <>
                    {/* Lapisan penutup: klik di mana pun menutup menu */}
                    <div
                      onClick={() => setCetakMenuOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    />
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      zIndex: 41,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      minWidth: '175px',
                      overflow: 'hidden'
                    }}>
                      {[
                        { label: 'Download PDF', mode: 'pdf' },
                        { label: 'Delivery Order', mode: 'delivery-order' },
                        { label: 'Cetak A5', mode: 'a5' },
                      ].map((opt) => (
                        <button
                          key={opt.mode}
                          type="button"
                          onClick={() => { setCetakMenuOpen(false); handleCetak(opt.mode); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            border: 0,
                            background: 'transparent',
                            padding: '9px 14px',
                            fontSize: '13px',
                            color: '#475569',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <Printer size={14} />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {activeDetailDoc.status === 'draft' && (
                <>
                  <button 
                    type="button"
                    onClick={() => handleCommitStockOut('Draft')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'linear-gradient(135deg, #f97316, #ea580c)', 
                      border: 0, 
                      padding: '8px 16px', 
                      borderRadius: '6px', 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      color: '#ffffff', 
                      cursor: 'pointer',
                      height: '36px',
                      boxShadow: '0 2px 4px rgba(234, 88, 12, 0.15)',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <span>Draft</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleCommitStockOut('Batal')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: '#ffffff', 
                      border: '1px solid #fecdd3', 
                      padding: '8px 16px', 
                      borderRadius: '6px', 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      color: '#e11d48', 
                      cursor: 'pointer',
                      height: '36px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#fff1f2'}
                    onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <X size={14} />
                    <span>Batalkan</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleCommitStockOut('Selesai')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', 
                      border: 0, 
                      padding: '8px 20px', 
                      borderRadius: '6px', 
                      fontSize: '13px', 
                      fontWeight: 'bold', 
                      color: '#ffffff', 
                      cursor: 'pointer',
                      height: '36px',
                      boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.3)',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <Check size={14} />
                    <span>Posting Sekarang</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-card metadata details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Tanggal Box */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Tanggal</span>
                {activeDetailDoc.status === 'draft' && (!isEditingTanggal ? (
                  <button 
                    onClick={() => {
                      setEditTanggalValue(activeDetailDoc.tanggal || '');
                      setIsEditingTanggal(true);
                    }}
                    style={{ border: 0, background: 'transparent', color: '#0ea5e9', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Ubah
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveInlineTanggal} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                    <button onClick={() => setIsEditingTanggal(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px' }}>
                {!isEditingTanggal ? (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{formatDisplayDate(activeDetailDoc.tanggal)}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{activeDetailDoc.dibuat_oleh_nama || '-'}</div>
                  </>
                ) : (
                  <input 
                    type="date" 
                    value={editTanggalValue} 
                    onChange={(e) => setEditTanggalValue(e.target.value)} 
                    style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', height: '28px', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            </div>

            {/* Transfer ke Box */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Transfer ke</span>
                {activeDetailDoc.status === 'draft' && (!isEditingTransferKe ? (
                  <button 
                    onClick={() => {
                      setEditTransferKeValue(activeDetailDoc.transfer_ke || '');
                      setIsEditingTransferKe(true);
                    }}
                    style={{ border: 0, background: 'transparent', color: '#0ea5e9', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Ubah
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveInlineTransferKe} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                    <button onClick={() => setIsEditingTransferKe(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px' }}>
                {!isEditingTransferKe ? (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: activeDetailDoc.transfer_ke ? '#1e293b' : '#94a3b8' }}>{activeDetailDoc.transfer_ke || '-'}</div>
                ) : (
                  <input 
                    type="text" 
                    value={editTransferKeValue} 
                    onChange={(e) => setEditTransferKeValue(e.target.value)} 
                    style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', height: '28px', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            </div>

            {/* Catatan Box */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Catatan</span>
                {activeDetailDoc.status === 'draft' && (!isEditingCatatan ? (
                  <button 
                    onClick={() => {
                      setEditCatatanValue(activeDetailDoc.catatan || '');
                      setIsEditingCatatan(true);
                    }}
                    style={{ border: 0, background: 'transparent', color: '#0ea5e9', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Ubah
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveInlineCatatan} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                    <button onClick={() => setIsEditingCatatan(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px' }}>
                {!isEditingCatatan ? (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: activeDetailDoc.catatan ? '#1e293b' : '#94a3b8' }}>{activeDetailDoc.catatan || '-'}</div>
                ) : (
                  <input 
                    type="text" 
                    value={editCatatanValue} 
                    onChange={(e) => setEditCatatanValue(e.target.value)} 
                    style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', height: '28px', color: '#334155', width: '100%', boxSizing: 'border-box' }}
                  />
                )}
              </div>
            </div>

            {/* Alasan Box */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Alasan</span>
                {activeDetailDoc.status === 'draft' && (!isEditingAlasan ? (
                  <button
                    onClick={() => {
                      setEditAlasanValue(activeDetailDoc.alasan || '');
                      setEditAlasanLainnyaValue(activeDetailDoc.alasan_lainnya || '');
                      setIsEditingAlasan(true);
                    }}
                    style={{ border: 0, background: 'transparent', color: '#0ea5e9', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Ubah
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveInlineAlasan} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                    <button onClick={() => setIsEditingAlasan(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                  </div>
                ))}
              </div>
              <div style={{ padding: '16px' }}>
                {!isEditingAlasan ? (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                    {reasonText(activeDetailDoc)}
                  </div>
                ) : (
                  <>
                    {/* <select> bawaan, bukan panel melayang seperti Olsera: kotak
                        Alasan ini ber-overflow:hidden, dan dropdown buatan akan
                        terpotong olehnya. Isinya sama persis. */}
                    <select
                      value={editAlasanValue}
                      onChange={(e) => setEditAlasanValue(e.target.value)}
                      style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', height: '28px', color: '#334155', width: '100%', background: '#ffffff' }}
                    >
                      <option value="">Pilih Alasan</option>
                      {REASON_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                      {/* Dokumen lama bisa ber-alasan transfer/manual — tetap
                          ditampilkan supaya nilainya tidak diam-diam berubah
                          saat kotaknya dibuka. */}
                      {(editAlasanValue === 'transfer' || editAlasanValue === 'manual') && (
                        <option value={editAlasanValue}>{REASON_LABEL[editAlasanValue]}</option>
                      )}
                    </select>
                    {editAlasanValue === 'lainnya' && (
                      <input
                        type="text"
                        autoFocus
                        value={editAlasanLainnyaValue}
                        onChange={(e) => setEditAlasanLainnyaValue(e.target.value)}
                        placeholder="Tulis alasannya"
                        maxLength={255}
                        style={{ marginTop: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', outline: 'none', height: '28px', color: '#334155', width: '100%', minWidth: 0, boxSizing: 'border-box', background: '#ffffff' }}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Staging Product Add Container */}
          <div className="pi-category-card" style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Tambah Produk</span>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 220px 44px', gap: '12px', alignItems: 'flex-end', marginBottom: '24px' }}>
                {/* Cari Produk */}
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>Produk</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      placeholder="Cari Produk" 
                      value={searchProduct}
                      onChange={(e) => {
                        setSearchProduct(e.target.value);
                        setSelectedProduct(null);
                        setSelectedVariant(null);
                      }}
                      disabled={activeDetailDoc.status !== 'draft'}
                      style={{ 
                        width: '100%', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '4px', 
                        padding: '8px 10px 8px 30px', 
                        fontSize: '13px', 
                        outline: 'none', 
                        boxSizing: 'border-box',
                        background: '#ffffff',
                        height: '36px'
                      }} 
                    />
                    {productOptions.length > 0 && !selectedProduct && (
                      <div style={{ position: 'absolute', top: '38px', left: 0, right: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                        {productOptions.map((p) => (
                          <button 
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(p);
                              setSearchProduct(p.nama);
                              setProductOptions([]);
                              if (p.variants && p.variants.length > 0) {
                                setSelectedVariant(p.variants[0]);
                              } else {
                                setSelectedVariant(null);
                              }
                            }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {p.nama} {p.sku ? `(${p.sku})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Varian Selector */}
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>Varian</label>
                  {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 ? (
                    <select
                      value={selectedVariant?.id || ''}
                      onChange={(e) => {
                        const v = selectedProduct.variants.find(varItem => varItem.id === Number(e.target.value));
                        setSelectedVariant(v || null);
                      }}
                      disabled={activeDetailDoc.status !== 'draft'}
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontSize: '13px',
                        color: '#334155',
                        outline: 'none',
                        height: '36px',
                        width: '100%',
                        background: '#ffffff'
                      }}
                    >
                      {selectedProduct.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nama_varian} (Stok: {v.qty_stok})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input 
                      type="text" 
                      placeholder="Tidak ada varian" 
                      disabled 
                      style={{ 
                        width: '100%', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '4px', 
                        padding: '8px 12px', 
                        fontSize: '13px', 
                        color: '#94a3b8', 
                        outline: 'none', 
                        background: '#f1f5f9',
                        height: '36px',
                        boxSizing: 'border-box'
                      }} 
                    />
                  )}
                </div>

                {/* Qty Stepper */}
                <div>
                  <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>Qty</label>
                  <div style={{ 
                    display: 'flex', 
                    border: '1px solid #cbd5e1', 
                    borderRadius: '4px', 
                    overflow: 'hidden', 
                    height: '36px', 
                    width: '100%',
                    background: '#ffffff'
                  }}>
                    <button 
                      type="button"
                      onClick={() => setQtyValue(prev => Math.max(1, prev - 1))}
                      disabled={activeDetailDoc.status !== 'draft'}
                      style={{ border: 0, background: '#f8fafc', width: '44px', flexShrink: 0, cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: '#64748b' }}
                    >
                      -
                    </button>
                    <input 
                      type="text"
                      value={qtyValue}
                      onChange={(e) => setQtyValue(parseInt(e.target.value, 10) || 1)}
                      disabled={activeDetailDoc.status !== 'draft'}
                      style={{ 
                        border: 0, 
                        borderLeft: '1px solid #cbd5e1', 
                        borderRight: '1px solid #cbd5e1', 
                        textAlign: 'center', 
                        flex: 1,
                        minWidth: 0, 
                        fontSize: '13px', 
                        color: '#334155', 
                        outline: 'none',
                        background: '#ffffff'
                      }} 
                    />
                    <button 
                      type="button"
                      onClick={() => setQtyValue(prev => prev + 1)}
                      disabled={activeDetailDoc.status !== 'draft'}
                      style={{ border: 0, background: '#f8fafc', width: '44px', flexShrink: 0, cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: '#64748b' }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Satuan (UOM) — bila multi satuan aktif & produk punya satuan alternatif */}
                {uomAktif && selectedProduct?.uom_enabled
                  && Array.isArray(selectedProduct.uom_units) && selectedProduct.uom_units.length > 0 && (
                  <div style={{ minWidth: '170px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Satuan
                    </label>
                    <select
                      value={uomKode}
                      onChange={(e) => setUomKode(e.target.value)}
                      disabled={activeDetailDoc.status !== 'draft'}
                      style={{
                        width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px',
                        padding: '8px 10px', fontSize: '13px', color: '#334155',
                        outline: 'none', background: '#ffffff', cursor: 'pointer',
                      }}
                    >
                      <option value="">{selectedProduct.satuan || 'pcs'} (dasar)</option>
                      {selectedProduct.uom_units.map((u) => (
                        <option key={u.id || u.kode_satuan} value={u.kode_satuan}>
                          {u.nama_satuan} — 1 = {u.konverter} {selectedProduct.satuan || 'pcs'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Plus Blue Button */}
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={activeDetailDoc.status !== 'draft' || !selectedProduct || itemSaving}
                  style={{ 
                    background: (!selectedProduct || itemSaving) ? '#93c5fd' : '#0ea5e9', 
                    color: '#ffffff', 
                    border: 0, 
                    borderRadius: '4px', 
                    width: '44px', 
                    height: '36px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: (!selectedProduct || itemSaving) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(14, 165, 233, 0.2)'
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Daftar produk yang sudah ditambahkan */}
              {activeDetailDoc.items && activeDetailDoc.items.length > 0 ? (
                <div style={{ borderTop: '1px solid #f1f5f9' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '10px 20px', fontWeight: 'bold', color: '#475569' }}>Produk</th>
                        <th style={{ padding: '10px 20px', fontWeight: 'bold', color: '#475569' }}>Varian</th>
                        <th style={{ padding: '10px 20px', fontWeight: 'bold', color: '#475569' }}>Qty</th>
                        {activeDetailDoc.status === 'draft' && <th style={{ padding: '10px 20px' }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {activeDetailDoc.items.map((item) => (
                        <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 20px', color: '#1e293b' }}>{item.product_nama}{item.product_sku ? ` (${item.product_sku})` : ''}</td>
                          <td style={{ padding: '10px 20px', color: '#334155' }}>{item.variant_nama || '-'}</td>
                          <td style={{ padding: '10px 20px', color: '#334155' }}>{item.qty} {item.product_satuan}</td>
                          {activeDetailDoc.status === 'draft' && (
                            <td style={{ padding: '10px 20px' }}>
                              <button 
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                style={{ border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                title="Hapus"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>Belum ada produk</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      <ImportCsvModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Stok Keluar"
        templateHref="/templates/stok-keluar-template.csv"
        columns={CSV_PREVIEW_COLUMNS}
        maxRows={CSV_MAX_ROWS}
        footnote="Produk dicocokkan lewat SKU, atau nama produk bila SKU kosong."
        onProcess={prosesImportCsv}
        onSuccess={(doc) => { setActiveDetailDoc(doc); handleStateChange('detail'); }}
      />

      {/* VALIDATION ERROR MODAL OVERLAY */}
      {validationError && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '440px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid #fee2e2',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              fontSize: '24px'
            }}>
              ⚠️
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Gagal Posting</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>
              {validationError}
            </p>
            <button 
              onClick={() => setValidationError('')}
              style={{
                background: '#ef4444',
                color: '#ffffff',
                border: 0,
                borderRadius: '6px',
                padding: '10px 24px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
              onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
