import { useState, useEffect } from 'react';
import { Search, X, Plus, ArrowLeft, ArrowRight, ChevronsUpDown, Trash2, CloudUpload, Printer, ChevronDown } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { useAuth } from '../../../../context/AuthContext';
import { todayISO } from '../../../../utils/date';
import { getLogoUrl } from '../../../../utils/logo';
import { receivedByDisplay } from '../../../../utils/stockDocument';
import { ProductionCostSection } from './ProductionCostSection';

const STATUS_LABEL = { draft: 'Draft', selesai: 'Selesai', batal: 'Batal' };
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

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
  date: formatDisplayDate(doc.tanggal),
  note: doc.catatan || '-',
  status: STATUS_LABEL[doc.status] || doc.status,
  receivedBy: receivedByDisplay(doc),
});

export function StockProductionPage({ onToggleCreate, viewState: propViewState }) {
  const [viewState, setViewState] = useState('list'); // 'list' | 'detail'

  useEffect(() => {
    if (propViewState) {
      setViewState(propViewState);
    }
  }, [propViewState]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSerapWarning, setShowSerapWarning] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [productionList, setProductionList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');

  // Form states (create header)
  // Pakai tanggal lokal — toISOString() memundurkan tanggal sehari di WIB
  // pada dini hari, sehingga dokumen tercatat di tanggal yang salah.
  const [tanggal, setTanggal] = useState(todayISO());
  const [catatan, setCatatan] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Item staging (Tambah Produk)
  const [searchProduct, setSearchProduct] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [qtyValue, setQtyValue] = useState(1);
  const [itemSaving, setItemSaving] = useState(false);

  // Pagination & Sorting States
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Dokumen aktif (mentah dari API) untuk layar detail
  const [activeDoc, setActiveDoc] = useState(null);

  // Inline edit kartu Tanggal & Catatan (pola sama dengan StockOutPage).
  // Backend hanya mengizinkan ubah saat status draft (product_views.py:1666).
  // Nama bisnis & logo untuk kop cetak
  const { businessSettings } = useAuth();
  // Dropdown Cetak: Cetak (A4) / Cetak A5
  const [cetakMenuOpen, setCetakMenuOpen] = useState(false);

  const [isEditingTanggal, setIsEditingTanggal] = useState(false);
  const [isEditingCatatan, setIsEditingCatatan] = useState(false);
  const [editTanggalValue, setEditTanggalValue] = useState('');
  const [editCatatanValue, setEditCatatanValue] = useState('');

  const patchDocument = async (payload) => {
    try {
      const res = await apiClient.patch(`/stock-production-documents/${activeDoc.id}/`, payload);
      setActiveDoc(res.data);
      return true;
    } catch (err) {
      console.error('[StockProductionPage] patch document error:', err);
      setError(err.response?.data?.error || 'Gagal menyimpan perubahan.');
      return false;
    }
  };

  const saveInlineTanggal = async () => {
    if (await patchDocument({ tanggal: editTanggalValue })) setIsEditingTanggal(false);
  };

  const saveInlineCatatan = async () => {
    if (await patchDocument({ catatan: editCatatanValue })) setIsEditingCatatan(false);
  };

  /**
   * Cetak dokumen produksi. Olsera menyediakan dua pilihan di sini: "Cetak"
   * (A4) dan "Cetak A5" — tanpa Delivery Order, karena produksi tidak dikirim
   * ke pihak luar. Tidak ada library PDF di proyek ini, jadi user menyimpan PDF
   * lewat dialog cetak browser.
   */
  const handleCetak = (mode = 'pdf') => {
    if (!activeDoc) return;
    const isA5 = mode === 'a5';
    const doc = activeDoc;
    const esc = (v) => String(v ?? '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const namaBisnis = businessSettings?.nama_bisnis || '';
    const logoUrl = getLogoUrl(businessSettings?.logo_url);
    let totalQty = 0;
    const rows = (doc.items || []).map((item, i) => {
      const qty = Number(item.qty) || 0;
      totalQty += qty;
      const varian = item.variant_nama ? ` — ${esc(item.variant_nama)}` : '';
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.product_nama)}${item.product_sku ? ` (${esc(item.product_sku)})` : ''}${varian}</td>
        <td style="text-align:right">${qty} ${esc(item.product_satuan || '')}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(doc.nomor)}</title>
      <style>
        @page { size: ${isA5 ? 'A5' : 'A4'}; margin: ${isA5 ? '8mm' : '14mm'}; }
        body { font-family: Arial, sans-serif; font-size: ${isA5 ? '10px' : '13px'}; color: #111; margin: 0; }
        .logo-box { border: 1px solid #e5e7eb; border-radius: 6px; padding: ${isA5 ? '8px' : '16px'}; margin-bottom: ${isA5 ? '8px' : '16px'}; min-height: ${isA5 ? '34px' : '60px'}; display: flex; align-items: center; }
        .logo-box img { max-height: ${isA5 ? '30px' : '56px'}; max-width: ${isA5 ? '100px' : '160px'}; object-fit: contain; }
        .doc-title { font-size: ${isA5 ? '12px' : '15px'}; margin: 0 0 4px; }
        .doc-title .biz { font-size: ${isA5 ? '10px' : '12px'}; color: #555; margin-left: 6px; }
        .tanggal { margin: 6px 0 4px; }
        .info-extra { color: #666; font-size: ${isA5 ? '9px' : '11px'}; margin-bottom: 10px; }
        table.items { border-collapse: collapse; width: 100%; margin-top: ${isA5 ? '6px' : '10px'}; }
        table.items th, table.items td { border: 1px solid #999; padding: ${isA5 ? '3px 5px' : '6px 8px'}; text-align: left; }
        table.items th { background: #f8fafc; }
        .foot { margin-top: ${isA5 ? '12px' : '24px'}; color: #999; font-size: ${isA5 ? '8px' : '10px'}; }
      </style></head><body>
      <div class="logo-box">${logoUrl ? `<img src="${esc(logoUrl)}" alt="logo">` : ''}</div>
      <p class="doc-title">No. Produksi Stok #${esc(doc.nomor)}<span class="biz">${esc(namaBisnis)}</span></p>
      <p class="tanggal"><strong>Tanggal</strong> : ${esc(doc.tanggal)}</p>
      ${doc.catatan ? `<p class="info-extra">Catatan: ${esc(doc.catatan)}</p>` : ''}
      <table class="items">
        <thead><tr><th>#</th><th>Produk</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">Tidak ada produk</td></tr>'}</tbody>
        <tfoot><tr><td style="text-align:right"><strong>Total</strong></td><td></td><td style="text-align:right">${totalQty}</td></tr></tfoot>
      </table>
      <p class="foot">Dicetak ${new Date().toLocaleString('id-ID')}</p>
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`;
    const win = window.open('', '_blank', isA5 ? 'width=600,height=520' : 'width=800,height=600');
    if (!win) {
      setError('Popup diblokir browser. Izinkan popup untuk mencetak.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const fetchDocuments = async () => {
    setListLoading(true);
    try {
      const res = await apiClient.get('/stock-production-documents/');
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setProductionList(data.map(mapDocToRow));
    } catch (err) {
      console.error('[StockProductionPage] fetch documents error:', err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (!searchProduct.trim()) {
      setProductOptions([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await apiClient.get('/products/', { params: { search: searchProduct } });
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setProductOptions(data);
      } catch (err) {
        console.error('[StockProductionPage] search product error:', err);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchProduct]);

  // Reset page when search or active items change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const handleStateChange = (state) => {
    setViewState(state);
    if (onToggleCreate) {
      onToggleCreate(state);
    }
    if (state === 'list') {
      fetchDocuments();
    }
  };

  const fetchDocDetail = async (id) => {
    const res = await apiClient.get(`/stock-production-documents/${id}/`);
    setActiveDoc(res.data);
    return res.data;
  };

  const handleSaveProduction = async () => {
    try {
      const res = await apiClient.post('/stock-production-documents/', { tanggal, catatan });
      setActiveDoc(res.data);
      setCatatan('');
      setShowCreateModal(false);
      handleStateChange('detail');
    } catch (err) {
      console.error('[StockProductionPage] create document error:', err);
      setError('Gagal membuat dokumen produksi stok.');
    }
  };

  const handleAddItem = async () => {
    if (!selectedProduct || itemSaving) return;
    setItemSaving(true);
    try {
      await apiClient.post(`/stock-production-documents/${activeDoc.id}/add-item/`, {
        product: selectedProduct.id,
        qty: qtyValue,
      });
      await fetchDocDetail(activeDoc.id);
      setSelectedProduct(null);
      setSearchProduct('');
      setProductOptions([]);
      setQtyValue(1);
    } catch (err) {
      console.error('[StockProductionPage] add item error:', err);
      setError(err.response?.data?.error || 'Gagal menambah produk.');
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      const res = await apiClient.post(`/stock-production-documents/${activeDoc.id}/remove-item/`, { item_id: itemId });
      setActiveDoc(res.data);
    } catch (err) {
      console.error('[StockProductionPage] remove item error:', err);
    }
  };

  const handlePost = async () => {
    // Posting tidak bisa dibatalkan, dan setelahnya biaya tidak bisa lagi
    // dimasukkan ke HPP. Kalau dokumen punya biaya tapi penyerapan tidak
    // dicentang, pastikan dulu itu memang disengaja.
    const adaBiaya = (activeDoc?.biaya?.length || 0) > 0;
    if (adaBiaya && !activeDoc?.serap_biaya_ke_hpp) {
      setShowSerapWarning(true);
      return;
    }
    await doPost();
  };

  const doPost = async () => {
    setShowSerapWarning(false);
    try {
      await apiClient.post(`/stock-production-documents/${activeDoc.id}/post-document/`);
      handleStateChange('list');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal memposting dokumen.');
    }
  };

  const handleCancelDoc = async () => {
    try {
      await apiClient.post(`/stock-production-documents/${activeDoc.id}/cancel/`);
      handleStateChange('list');
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membatalkan dokumen.');
    }
  };

  const handleImportCsv = async () => {
    if (!importFile || importing) return;
    setImporting(true);
    setImportResult(null);
    try {
      const docRes = await apiClient.post('/stock-production-documents/', {
        tanggal: todayISO(),
        catatan: 'Import CSV',
      });
      const docId = docRes.data.id;

      const fd = new FormData();
      fd.append('file', importFile);
      const importRes = await apiClient.post(`/stock-production-documents/${docId}/import-csv/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportResult({ errors: importRes.data.errors || [], createdCount: importRes.data.created?.length || 0 });
      setActiveDoc(importRes.data.document);
      setImportFile(null);
      if ((importRes.data.created?.length || 0) > 0) {
        setShowImportModal(false);
        handleStateChange('detail');
      }
    } catch (err) {
      console.error('[StockProductionPage] import csv error:', err);
      setImportResult({ errors: [err.response?.data?.error || 'Gagal mengimpor file CSV.'], createdCount: 0 });
    } finally {
      setImporting(false);
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

  // Sort list
  let sortedList = [...productionList];
  if (sortKey) {
    sortedList.sort((a, b) => {
      let valA = a[sortKey] || '';
      let valB = b[sortKey] || '';

      valA = valA.toString().toLowerCase();
      valB = valB.toString().toLowerCase();

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Filter list
  const filteredList = sortedList.filter(row =>
    row.no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.receivedBy.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination calculations
  const totalPages = Math.ceil(filteredList.length / pageSize) || 1;
  const paginatedList = filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      {viewState === 'list' && (
        <>
          {/* Top Row: Search Input and Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Cari"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 12px 10px 38px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              onClick={() => { setImportResult(null); setImportFile(null); setShowImportModal(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#0d9488',
                border: 0,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#ffffff',
                cursor: 'pointer',
                height: '38px',
                whiteSpace: 'nowrap',
              }}
            >
              <CloudUpload size={16} />
              <span>Import</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#16a34a',
                border: 0,
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 'bold',
                color: '#ffffff',
                cursor: 'pointer',
                height: '38px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)'
              }}
            >
              <Plus size={16} />
              <span>Tambah</span>
            </button>
          </div>

          <div className="pi-table-card" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table className="pi-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th
                    onClick={() => handleSort('no')}
                    style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>No.</span>
                      <ChevronsUpDown size={14} style={{ color: sortKey === 'no' ? '#0085ca' : '#94a3b8' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('date')}
                    style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Tanggal</span>
                      <ChevronsUpDown size={14} style={{ color: sortKey === 'date' ? '#0085ca' : '#94a3b8' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('note')}
                    style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Catatan</span>
                      <ChevronsUpDown size={14} style={{ color: sortKey === 'note' ? '#0085ca' : '#94a3b8' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Status</span>
                      <ChevronsUpDown size={14} style={{ color: sortKey === 'status' ? '#0085ca' : '#94a3b8' }} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('receivedBy')}
                    style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Diterima Oleh</span>
                      <ChevronsUpDown size={14} style={{ color: sortKey === 'receivedBy' ? '#0085ca' : '#94a3b8' }} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>{listLoading ? 'Memuat...' : 'No Data'}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((row, index) => (
                    <tr
                      key={index}
                      onClick={async () => {
                        await fetchDocDetail(row.id);
                        handleStateChange('detail');
                      }}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      className="pi-table-row-hover"
                    >
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'semibold', color: '#3b82f6' }}>{row.no}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#334155' }}>{row.date}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#334155' }}>{row.note}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          background: row.status === 'Draft' ? '#ffedd5' : row.status === 'Selesai' ? '#dcfce7' : '#fee2e2',
                          color: row.status === 'Draft' ? '#ea580c' : row.status === 'Selesai' ? '#16a34a' : '#dc2626',
                          padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                        }}>{row.status}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569' }}>{row.receivedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none', background: '#ffffff' }}
              >
                <option value={5}>5 Baris</option>
                <option value={10}>10 Baris</option>
                <option value={15}>15 Baris</option>
                <option value={30}>30 Baris</option>
                <option value={50}>50 Baris</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748b' }}>
              <span>Total {filteredList.length}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  style={{ background: 'transparent', border: 0, padding: '4px', color: currentPage === 1 ? '#cbd5e1' : '#64748b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ArrowLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <span
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      background: currentPage === page ? '#3b82f6' : 'transparent',
                      color: currentPage === page ? '#ffffff' : '#64748b',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {page}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  style={{ background: 'transparent', border: 0, padding: '4px', color: currentPage === totalPages ? '#cbd5e1' : '#64748b', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  <ArrowRight size={16} />
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
                  style={{ width: '40px', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px', fontSize: '12px', textAlign: 'center', outline: 'none' }}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail View */}
      {viewState === 'detail' && activeDoc && (
        <div>
          <button
            onClick={() => handleStateChange('list')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 0, color: '#3b82f6', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', padding: 0 }}
          >
            <ArrowLeft size={16} />
            <span>Kembali ke Daftar</span>
          </button>

          {error && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{activeDoc.nomor}</h3>
                  <span style={{
                    background: activeDoc.status === 'draft' ? '#ffedd5' : activeDoc.status === 'selesai' ? '#dcfce7' : '#fee2e2',
                    color: activeDoc.status === 'draft' ? '#ea580c' : activeDoc.status === 'selesai' ? '#16a34a' : '#dc2626',
                    padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold'
                  }}>{STATUS_LABEL[activeDoc.status] || activeDoc.status}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>Dibuat pada {formatDisplayDate(activeDoc.tanggal)} oleh {activeDoc.dibuat_oleh_nama || '-'}</p>
              </div>
              {/* Cetak tersedia untuk semua status — dokumen yang sudah
                  diposting pun tetap perlu bisa dicetak ulang. */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCetakMenuOpen((open) => !open)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: cetakMenuOpen ? '#f8fafc' : '#ffffff',
                      border: '1px solid #cbd5e1', borderRadius: '6px',
                      padding: '8px 14px', fontSize: '13px', fontWeight: 'bold',
                      color: '#475569', cursor: 'pointer'
                    }}
                  >
                    <Printer size={14} />
                    <span>Cetak</span>
                    <ChevronDown size={14} style={{ transform: cetakMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>

                  {cetakMenuOpen && (
                    <>
                      <div onClick={() => setCetakMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 41,
                        background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', minWidth: '150px', overflow: 'hidden'
                      }}>
                        {[
                          { label: 'Cetak', mode: 'pdf' },
                          { label: 'Cetak A5', mode: 'a5' },
                        ].map((opt) => (
                          <button
                            key={opt.mode}
                            type="button"
                            onClick={() => { setCetakMenuOpen(false); handleCetak(opt.mode); }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                              border: 0, background: 'transparent', padding: '9px 14px',
                              fontSize: '13px', color: '#475569', cursor: 'pointer', textAlign: 'left'
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

                {activeDoc.status === 'draft' && (
                  <>
                  <button
                    onClick={handleCancelDoc}
                    style={{ background: '#ffffff', border: '1px solid #fecdd3', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 'bold', color: '#e11d48', cursor: 'pointer' }}
                  >
                    Batalkan
                  </button>
                  <button
                    onClick={handlePost}
                    style={{ background: '#16a34a', border: 0, borderRadius: '6px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', color: '#ffffff', cursor: 'pointer' }}
                  >
                    Posting Sekarang
                  </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Kartu Tanggal — bisa diubah selama dokumen masih draft */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Tanggal Produksi</span>
                  {activeDoc.status === 'draft' && (!isEditingTanggal ? (
                    <button
                      onClick={() => {
                        setEditTanggalValue(activeDoc.tanggal || '');
                        setIsEditingTanggal(true);
                      }}
                      style={{ border: 0, background: 'transparent', color: '#0ea5e9', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                    >
                      Ubah
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={saveInlineTanggal} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>Simpan</button>
                      <button onClick={() => setIsEditingTanggal(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>Batal</button>
                    </div>
                  ))}
                </div>
                {!isEditingTanggal ? (
                  <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 'semibold' }}>{formatDisplayDate(activeDoc.tanggal)}</span>
                ) : (
                  <input
                    type="date"
                    value={editTanggalValue}
                    onChange={(e) => setEditTanggalValue(e.target.value)}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                )}
              </div>

              {/* Kartu Catatan — bisa diubah selama dokumen masih draft */}
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>Catatan</span>
                  {activeDoc.status === 'draft' && (!isEditingCatatan ? (
                    <button
                      onClick={() => {
                        setEditCatatanValue(activeDoc.catatan || '');
                        setIsEditingCatatan(true);
                      }}
                      style={{ border: 0, background: 'transparent', color: '#0ea5e9', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}
                    >
                      Ubah
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={saveInlineCatatan} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>Simpan</button>
                      <button onClick={() => setIsEditingCatatan(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', padding: 0 }}>Batal</button>
                    </div>
                  ))}
                </div>
                {!isEditingCatatan ? (
                  <span style={{ fontSize: '14px', color: activeDoc.catatan ? '#1e293b' : '#94a3b8', fontWeight: 'semibold' }}>{activeDoc.catatan || '-'}</span>
                ) : (
                  <textarea
                    value={editCatatanValue}
                    onChange={(e) => setEditCatatanValue(e.target.value)}
                    rows={2}
                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Panel Tambah Produk */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Produk yang Diproduksi</span>
            </div>
            <div style={{ padding: '20px' }}>
              {/* Proporsi mengikuti Olsera: kolom produk melebar, qty diberi
                  ruang cukup supaya tombol - dan + tidak berdempetan dan
                  terbaca sebagai satu tombol. */}
              {activeDoc.status === 'draft' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 44px', gap: '12px', alignItems: 'flex-end', marginBottom: '20px' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>Produk</label>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Cari Produk"
                        value={searchProduct}
                        onChange={(e) => { setSearchProduct(e.target.value); setSelectedProduct(null); }}
                        style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 10px 8px 30px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', height: '36px' }}
                      />
                    </div>
                    {productOptions.length > 0 && !selectedProduct && (
                      <div style={{ position: 'absolute', top: '60px', left: 0, right: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                        {productOptions.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => { setSelectedProduct(p); setSearchProduct(p.nama); setProductOptions([]); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '8px 12px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                          >
                            {p.nama} {p.sku ? `(${p.sku})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '6px', display: 'block' }}>Qty</label>
                    <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden', height: '36px' }}>
                      <button type="button" onClick={() => setQtyValue(prev => Math.max(1, prev - 1))} style={{ border: 0, background: '#f8fafc', width: '44px', flexShrink: 0, fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}>-</button>
                      <input
                        type="text"
                        value={qtyValue}
                        onChange={(e) => setQtyValue(parseInt(e.target.value, 10) || 1)}
                        style={{ border: 0, borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1', textAlign: 'center', flex: 1, minWidth: 0, fontSize: '13px', color: '#334155', outline: 'none' }}
                      />
                      <button type="button" onClick={() => setQtyValue(prev => prev + 1)} style={{ border: 0, background: '#f8fafc', width: '44px', flexShrink: 0, fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}>+</button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!selectedProduct || itemSaving}
                    style={{
                      background: (!selectedProduct || itemSaving) ? '#bae6fd' : '#0ea5e9',
                      color: '#ffffff', border: 0, borderRadius: '4px', width: '44px', height: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: (!selectedProduct || itemSaving) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              )}

              {activeDoc.items && activeDoc.items.length > 0 ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '10px 16px', fontWeight: 'bold', color: '#475569' }}>Produk</th>
                      <th style={{ padding: '10px 16px', fontWeight: 'bold', color: '#475569' }}>Qty</th>
                      {activeDoc.status === 'draft' && <th style={{ padding: '10px 16px' }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activeDoc.items.map((item) => (
                      <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 16px', color: '#1e293b' }}>{item.product_nama}{item.product_sku ? ` (${item.product_sku})` : ''}{item.variant_nama ? ` - ${item.variant_nama}` : ''}</td>
                        <td style={{ padding: '10px 16px', color: '#334155' }}>{item.qty} {item.product_satuan}</td>
                        {activeDoc.status === 'draft' && (
                          <td style={{ padding: '10px 16px' }}>
                            <button type="button" onClick={() => handleRemoveItem(item.id)} style={{ border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0' }}>
                  <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>Belum ada produk</span>
                </div>
              )}
            </div>
          </div>

          <ProductionCostSection
            documentId={activeDoc.id}
            isDraft={activeDoc.status === 'draft'}
            biaya={activeDoc.biaya || []}
            totalBiaya={activeDoc.total_biaya || 0}
            serapKeHpp={activeDoc.serap_biaya_ke_hpp}
            onChanged={() => fetchDocDetail(activeDoc.id)}
          />
        </div>
      )}

      {/* Konfirmasi: dokumen punya biaya tapi tidak diserap ke HPP */}
      {showSerapWarning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={() => setShowSerapWarning(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '460px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Biaya produksi tidak masuk HPP</h3>
            </div>
            <div style={{ padding: '20px 24px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
              Dokumen ini punya biaya produksi, tapi opsi <strong>&ldquo;Serap biaya produksi ke HPP&rdquo;</strong> tidak dicentang.
              Artinya harga pokok barang jadi hanya memakai harga beli produk, dan biaya tersebut tidak akan
              tercermin di laporan laba.
              <div style={{ marginTop: '12px', padding: '10px 12px', background: '#fef3c7', borderRadius: '8px', color: '#92400e' }}>
                Dokumen yang sudah diposting tidak bisa diubah lagi. Pastikan ini memang disengaja.
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShowSerapWarning(false)} style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Kembali &amp; centang dulu
              </button>
              <button onClick={doPost} style={{ padding: '9px 16px', borderRadius: '8px', border: 0, background: '#2783de', color: '#ffffff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Ya, posting tanpa serap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup for adding new production */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={() => setShowCreateModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}></div>

          <div style={{ position: 'relative', width: '100%', maxWidth: '480px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', overflow: 'hidden', border: '1px solid #e2e8f0', margin: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Tambah Produksi Stock</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 0, color: '#64748b', cursor: 'pointer', padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Tanggal</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none', color: '#334155', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>Catatan <span style={{ color: '#94a3b8', fontWeight: '400' }}>(opsional)</span></label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Masukkan catatan produksi"
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical', color: '#334155', boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>Setelah dibuat, Anda akan diarahkan ke layar tambah produk sebelum posting.</p>
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 'semibold', color: '#475569', cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                onClick={handleSaveProduction}
                style={{ background: '#16a34a', border: 0, borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 'semibold', color: '#ffffff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(22, 163, 74, 0.15)' }}
              >
                Lanjut Tambah Produk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '8px', width: '90%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Import Produksi Stok (CSV)</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: '#f1f5f9', border: 0, padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                Tutup
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                Kolom CSV: <strong>Product, Variant Name, Qty</strong>. Produk dicocokkan berdasarkan nama.
              </p>
              <a
                href="/templates/produksi-stok-template.csv"
                download
                style={{ fontSize: '12px', color: '#0d9488', fontWeight: 'bold', textDecoration: 'underline', width: 'fit-content' }}
              >
                Download Template CSV
              </a>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files[0] || null)}
                style={{ fontSize: '13px' }}
              />
              {importResult && (
                <div style={{ fontSize: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ color: '#16a34a', fontWeight: 'bold', marginBottom: importResult.errors.length ? 6 : 0 }}>
                    {importResult.createdCount} baris berhasil ditambahkan.
                  </div>
                  {importResult.errors.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#dc2626' }}>
                      {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button onClick={() => setShowImportModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                Batal
              </button>
              <button
                onClick={handleImportCsv}
                disabled={!importFile || importing}
                style={{
                  background: (!importFile || importing) ? '#99f6e4' : '#0d9488',
                  border: 0, borderRadius: '4px', padding: '8px 24px', fontSize: '13px', fontWeight: 'bold', color: '#ffffff',
                  cursor: (!importFile || importing) ? 'not-allowed' : 'pointer',
                }}
              >
                {importing ? 'Memproses...' : 'Post Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
