import { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, MoreHorizontal, Printer, X, Plus, Trash2, ArrowLeft, CloudUpload, Download, Check, FileText, Edit, Settings, ChevronsUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../../context/AuthContext';
import apiClient from '../../../../api/apiClient';
import { getLogoUrl } from '../../../../utils/logo';
import { nowTimeLocal, todayISO } from '../../../../utils/date';
import { receivedByDisplay } from '../../../../utils/stockDocument';


const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const STATUS_LABEL = { draft: 'Draft', selesai: 'Selesai', batal: 'Batal' };
const OPNAME_CONFIG_KEY = 'opname_visibility_settings';
const OPNAME_ROLE_OPTIONS = [
  'Perpajakan', 'Logistik + Gudang', 'Purchase + Stok', 'Penjualan + Stok', 'Admin Penjualan',
  'Laporan', 'POS Staff Senior', 'POS Staff', 'Staff', 'Asisten Supervisor', 'Supervisor',
];

const formatDisplayDate = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(`${isoStr}T00:00:00`);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}-${MONTHS_ID[d.getMonth()]}-${d.getFullYear()}`;
};

const formatCurrencyRp = (value) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);

const mapDocToRow = (doc) => ({
  id: doc.id,
  no: doc.nomor,
  date: formatDisplayDate(doc.tanggal),
  note: doc.catatan || '-',
  status: STATUS_LABEL[doc.status] || doc.status,
  receivedBy: receivedByDisplay(doc),
});

/** Section "Terapkan di" mandiri milik satu checkbox (Qty Sistem atau Qty Selisih). */
function TerapkanDiSection({ roles, onToggleRole, onPilihSemua, onKosongkan }) {
  const [open, setOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div style={{ paddingLeft: '26px', paddingBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 6px', borderBottom: '1px solid #f1f5f9' }}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', border: 0, background: 'transparent', color: '#1e293b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
        >
          {open ? <ChevronUp size={16} style={{ color: '#0085ca' }} /> : <ChevronDown size={16} style={{ color: '#0085ca' }} />}
          <span>Terapkan di</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            style={{ border: 0, background: 'transparent', color: '#64748b', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '170px', zIndex: 50, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => { onPilihSemua(); setShowMenu(false); }}
                  style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', fontWeight: 'bold', color: '#334155', cursor: 'pointer' }}
                >
                  Pilih Semua
                </button>
                <button
                  type="button"
                  onClick={() => { onKosongkan(); setShowMenu(false); }}
                  style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}
                >
                  Kosongkan pilihan
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {OPNAME_ROLE_OPTIONS.map((role) => {
            const isChecked = roles.includes(role);
            return (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', fontSize: '13px', color: '#334155', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                <input type="checkbox" checked={isChecked} onChange={() => onToggleRole(role)} style={{ display: 'none' }} />
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: isChecked ? '1.5px solid #0085ca' : '1.5px solid #cbd5e1',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isChecked ? '#0085ca' : 'transparent',
                  transition: 'all 0.15s'
                }}>
                  {isChecked && <Check size={10} style={{ color: '#ffffff', strokeWidth: 3 }} />}
                </div>
                <span>{role}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function StockOpnamePage({ onToggleCreate, viewState: propViewState }) {
  const { businessSettings, user } = useAuth();
  const [viewState, setViewState] = useState('list'); // 'list' | 'create' | 'detail'

  useEffect(() => {
    if (propViewState) {
      setViewState(propViewState);
    }
  }, [propViewState]);

  const handleStateChange = (state) => {
    setViewState(state);
    if (onToggleCreate) {
      onToggleCreate(state);
    }
  };

  // Daftar dokumen (dari API)
  const [opnameList, setOpnameList] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  const fetchDocuments = async () => {
    setListLoading(true);
    try {
      const res = await apiClient.get('/stock-opname-documents/');
      const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setOpnameList(data.map(mapDocToRow));
    } catch (err) {
      console.error('[StockOpnamePage] fetch documents error:', err);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    loadSettings();
  }, []);

  const fetchDocumentDetail = async (id) => {
    const res = await apiClient.get(`/stock-opname-documents/${id}/`);
    setActiveDetailDoc(res.data);
    return res.data;
  };

  // Form pembuatan dokumen baru
  const [tanggal, setTanggal] = useState(todayISO());
  const [catatan, setCatatan] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & sorting
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState('no');
  const [sortDirection, setSortDirection] = useState('desc');

  // Detail dokumen aktif (objek mentah dari API)
  const [activeDetailDoc, setActiveDetailDoc] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Modal Tambah Produk — multi-select ala Olsera (waktu + kategori + cari, centang banyak produk sekaligus)
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addModalTime, setAddModalTime] = useState('');
  const [addModalCategory, setAddModalCategory] = useState('');
  const [addModalCategories, setAddModalCategories] = useState([]);
  const [addModalSearch, setAddModalSearch] = useState('');
  const [addModalResults, setAddModalResults] = useState([]);
  const [addModalSelected, setAddModalSelected] = useState([]); // [{id, nama, sku, satuan}]
  const [addModalSearching, setAddModalSearching] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [itemSaving, setItemSaving] = useState(false); // dipakai saat update-item (isi Qty Aktual per baris)

  // Import CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);

  // Rentang tetap 1 - 100.000 (200 opsi @500 baris), sama seperti dropdown "Download Template" Olsera.
  // Tidak dihitung dari jumlah produk saat ini — rentang yang melebihi data asli cukup
  // menghasilkan file CSV kosong/sebagian (backend menangani ini secara aman).
  const templateRanges = [];
  for (let i = 0; i < 100000; i += 500) {
    templateRanges.push({ start: i + 1, end: i + 500 });
  }

  const handleDownloadTemplateRange = async (start, end) => {
    setTemplateDownloading(true);
    try {
      const res = await apiClient.get('/stock-opname-documents/template-csv/', {
        params: { start, end },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockopname_template_${start}_${end}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[StockOpnamePage] download template error:', err);
      setValidationError('Gagal mengunduh template.');
    } finally {
      setTemplateDownloading(false);
      setShowTemplateDropdown(false);
    }
  };

  // Panel Pengaturan Opname (ikon gerigi) — Qty Sistem & Qty Selisih masing2 punya dropdown "Terapkan di" sendiri
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [hideQtySistem, setHideQtySistem] = useState(false);
  const [hideQtySelisih, setHideQtySelisih] = useState(false);
  const [applyToRolesSistem, setApplyToRolesSistem] = useState([]);
  const [applyToRolesSelisih, setApplyToRolesSelisih] = useState([]);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadSettings = async () => {
    try {
      const res = await apiClient.get(`/app-config/${OPNAME_CONFIG_KEY}/`);
      const parsed = JSON.parse(res.data.value || '{}');
      setHideQtySistem(!!parsed.hide_qty_sistem);
      setHideQtySelisih(!!parsed.hide_qty_selisih);
      setApplyToRolesSistem(Array.isArray(parsed.apply_to_qty_sistem) ? parsed.apply_to_qty_sistem : []);
      setApplyToRolesSelisih(Array.isArray(parsed.apply_to_qty_selisih) ? parsed.apply_to_qty_selisih : []);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error('[StockOpnamePage] fetch settings error:', err);
      }
      setHideQtySistem(false);
      setHideQtySelisih(false);
      setApplyToRolesSistem([]);
      setApplyToRolesSelisih([]);
    }
  };

  const openSettingsPanel = async () => {
    setShowSettingsPanel(true);
    await loadSettings();
  };

  const toggleRoleIn = (setter) => (role) => {
    setter((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    const payload = JSON.stringify({
      hide_qty_sistem: hideQtySistem,
      hide_qty_selisih: hideQtySelisih,
      apply_to_qty_sistem: applyToRolesSistem,
      apply_to_qty_selisih: applyToRolesSelisih,
    });
    try {
      await apiClient.patch(`/app-config/${OPNAME_CONFIG_KEY}/`, { value: payload });
    } catch (err) {
      if (err.response?.status === 404) {
        try {
          await apiClient.post('/app-config/', { key: OPNAME_CONFIG_KEY, value: payload });
        } catch (err2) {
          console.error('[StockOpnamePage] create settings error:', err2);
          setValidationError('Gagal menyimpan pengaturan.');
          setSettingsSaving(false);
          return;
        }
      } else {
        console.error('[StockOpnamePage] save settings error:', err);
        setValidationError('Gagal menyimpan pengaturan.');
        setSettingsSaving(false);
        return;
      }
    }
    setSettingsSaving(false);
    setShowSettingsPanel(false);
  };

  // Owner/Manager selalu lihat data lengkap; role lain mengikuti pengaturan (sistem kita
  // belum punya grup peran granular seperti daftar di atas, jadi diterapkan global per-viewer).
  const isPrivilegedViewer = user?.role === 'owner' || user?.role === 'manager';
  const effectiveHideQtySistem = hideQtySistem && !isPrivilegedViewer;
  const effectiveHideQtySelisih = hideQtySelisih && !isPrivilegedViewer;

  // Inline edit Tanggal/Catatan
  const [isEditingTanggal, setIsEditingTanggal] = useState(false);
  const [isEditingCatatan, setIsEditingCatatan] = useState(false);
  const [editTanggalValue, setEditTanggalValue] = useState('');
  const [editCatatanValue, setEditCatatanValue] = useState('');
  const [showCetakDropdown, setShowCetakDropdown] = useState(false);

  // Cari produk untuk modal Tambah Produk (multi-select), filter kategori + teks
  useEffect(() => {
    if (!showAddProductModal) return;
    setAddModalSearching(true);
    const handle = setTimeout(async () => {
      try {
        const params = {};
        if (addModalSearch) params.search = addModalSearch;
        if (addModalCategory) params.kategori = addModalCategory;
        const res = await apiClient.get('/products/', { params });
        const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setAddModalResults(data);
      } catch (err) {
        console.error('[StockOpnamePage] search product error:', err);
      } finally {
        setAddModalSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [showAddProductModal, addModalSearch, addModalCategory]);

  // Kategori (untuk filter dropdown modal), diambil sekali saat modal dibuka
  useEffect(() => {
    if (!showAddProductModal || addModalCategories.length > 0) return;
    apiClient.get('/product-categories/')
      .then((res) => setAddModalCategories(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((err) => console.error('[StockOpnamePage] fetch categories error:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddProductModal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, pageSize]);

  const handleCreateNew = async () => {
    try {
      const res = await apiClient.post('/stock-opname-documents/', { tanggal, catatan });
      setActiveDetailDoc(res.data);
      handleStateChange('detail');
      setTanggal(todayISO());
      setCatatan('');
    } catch (err) {
      console.error('[StockOpnamePage] create document error:', err);
      setValidationError('Gagal membuat dokumen opname stok.');
    }
  };

  const patchDocument = async (payload) => {
    try {
      const res = await apiClient.patch(`/stock-opname-documents/${activeDetailDoc.id}/`, payload);
      setActiveDetailDoc(res.data);
    } catch (err) {
      console.error('[StockOpnamePage] patch document error:', err);
      setValidationError(err.response?.data?.error || 'Gagal menyimpan perubahan.');
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

  // Dipanggil tiap kali modal dibuka, jadi jamnya selalu jam saat itu — bukan
  // jam halaman ini dimuat. Tetap bisa diubah user lewat input-nya.
  const resetAddProductForm = () => {
    setAddModalTime(nowTimeLocal());
    setAddModalCategory('');
    setAddModalSearch('');
    setAddModalResults([]);
    setAddModalSelected([]);
  };

  const toggleAddModalSelect = (product) => {
    setAddModalSelected((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      if (prev.length >= 500) return prev; // maksimal 500 produk terpilih tiap penambahan
      return [...prev, product];
    });
  };

  const handleBulkAdd = async () => {
    if (addModalSelected.length === 0 || bulkAdding) return;
    setBulkAdding(true);
    try {
      await apiClient.post(`/stock-opname-documents/${activeDetailDoc.id}/bulk-add-items/`, {
        products: addModalSelected.map((p) => ({ product: p.id })),
        jam_opname: addModalTime,
      });
      await fetchDocumentDetail(activeDetailDoc.id);
      resetAddProductForm();
      setShowAddProductModal(false);
    } catch (err) {
      console.error('[StockOpnamePage] bulk add items error:', err);
      setValidationError(err.response?.data?.error || 'Gagal menambah produk.');
    } finally {
      setBulkAdding(false);
    }
  };

  // Isi/ubah Qty Aktual atau Tgl Kadaluwarsa langsung di tabel (dipanggil saat blur/change)
  const handleUpdateItemField = async (itemId, field, value) => {
    setItemSaving(true);
    try {
      const res = await apiClient.post(`/stock-opname-documents/${activeDetailDoc.id}/update-item/`, {
        item_id: itemId,
        [field]: value,
      });
      setActiveDetailDoc((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === itemId ? res.data : it)),
      }));
    } catch (err) {
      console.error('[StockOpnamePage] update item error:', err);
      setValidationError(err.response?.data?.error || 'Gagal menyimpan perubahan item.');
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      const res = await apiClient.post(`/stock-opname-documents/${activeDetailDoc.id}/remove-item/`, { item_id: itemId });
      setActiveDetailDoc(res.data);
    } catch (err) {
      console.error('[StockOpnamePage] remove item error:', err);
      setValidationError(err.response?.data?.error || 'Gagal menghapus produk.');
    }
  };

  // Draft = kembali ke daftar (dokumen sudah tersimpan otomatis sbg draft)
  const handleCommitStatus = async (targetStatus) => {
    if (targetStatus === 'Draft') {
      handleStateChange('list');
      fetchDocuments();
      return;
    }
    try {
      let res;
      if (targetStatus === 'Batal') {
        res = await apiClient.post(`/stock-opname-documents/${activeDetailDoc.id}/cancel/`);
      } else if (targetStatus === 'Selesai') {
        res = await apiClient.post(`/stock-opname-documents/${activeDetailDoc.id}/post-document/`);
      }
      // Tetap di halaman detail menampilkan status terbaru (mis. "Batal": Kembali, Cetak, Download Excel saja),
      // bukan kembali ke daftar — persis alur Olsera asli.
      setActiveDetailDoc(res.data);
      fetchDocuments();
    } catch (err) {
      const message = err.response?.data?.error || 'Gagal memproses dokumen opname stok.';
      setValidationError(message);
    }
  };

  const handleImportCsv = async () => {
    if (!importFile || importing) return;
    setImporting(true);
    setImportResult(null);
    try {
      const docRes = await apiClient.post('/stock-opname-documents/', {
        tanggal: todayISO(),
        catatan: 'Import CSV',
      });
      const docId = docRes.data.id;

      const fd = new FormData();
      fd.append('file', importFile);
      const importRes = await apiClient.post(`/stock-opname-documents/${docId}/import-csv/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportResult({ errors: importRes.data.errors || [], createdCount: importRes.data.created?.length || 0 });
      setActiveDetailDoc(importRes.data.document);
      setImportFile(null);
      if ((importRes.data.created?.length || 0) > 0) {
        setShowImportModal(false);
        handleStateChange('detail');
      }
    } catch (err) {
      console.error('[StockOpnamePage] import csv error:', err);
      setImportResult({ errors: [err.response?.data?.error || 'Gagal mengimpor file CSV.'], createdCount: 0 });
    } finally {
      setImporting(false);
    }
  };

  const handleCetak = (size = 'default') => {
    if (!activeDetailDoc) return;
    const doc = activeDetailDoc;
    const esc = (v) => String(v ?? '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const namaBisnis = businessSettings?.nama_bisnis || '';
    const logoUrl = getLogoUrl(businessSettings?.logo_url);
    const isA5 = size === 'a5';
    let totalAktual = 0;
    const rows = (doc.items || []).map((item, i) => {
      totalAktual += Number(item.stok_aktual) || 0;
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(item.product_nama)}</td>
        <td style="text-align:right">${item.stok_aktual}</td>
      </tr>`;
    }).join('');
    // Format sederhana persis hasil cetak/PDF asli Olsera: logo, nama bisnis, "Stok Opname {nomor}",
    // "Date : ...", tabel # | Produk | Qty, lalu Total Aktual — tanpa detail sistem/selisih/rak.
    // Varian A5 memakai @page A5 dan margin/font lebih kecil supaya muat satu halaman A5.
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(doc.nomor)}</title>
      <style>
        ${isA5 ? '@page { size: A5; margin: 12mm; }' : ''}
        body { font-family: Arial, sans-serif; font-size: ${isA5 ? '11px' : '13px'}; color: #111; margin: ${isA5 ? '0' : '24px'}; text-align: center; }
        .logo-box { display: flex; justify-content: center; margin-bottom: 8px; }
        .logo-box img { max-height: ${isA5 ? '40px' : '56px'}; max-width: 140px; object-fit: contain; }
        .biz-name { font-size: ${isA5 ? '12px' : '14px'}; font-weight: bold; margin: 4px 0 10px; }
        hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
        .doc-title { font-size: ${isA5 ? '11px' : '13px'}; font-weight: bold; margin: 8px 0 2px; text-align: left; }
        .tanggal { font-size: ${isA5 ? '10px' : '12px'}; font-weight: bold; margin: 0 0 8px; text-align: left; }
        table.items { border-collapse: collapse; width: 100%; margin-top: 6px; }
        table.items th, table.items td { padding: 4px 6px; text-align: left; }
        table.items th { border-bottom: 1px solid #333; }
        .total { text-align: right; font-weight: bold; margin-top: 6px; }
        .foot { margin-top: 24px; color: #999; font-size: 10px; }
      </style></head><body>
      ${logoUrl ? `<div class="logo-box"><img src="${esc(logoUrl)}" alt="logo"></div>` : ''}
      <p class="biz-name">${esc(namaBisnis)}</p>
      <hr />
      <p class="doc-title">Stok Opname ${esc(doc.nomor)}</p>
      <p class="tanggal">Date : ${esc(doc.tanggal)}</p>
      <table class="items">
        <thead><tr><th>#</th><th>Produk</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">Tidak ada produk</td></tr>'}</tbody>
      </table>
      <hr />
      <p class="total">Total Aktual : ${totalAktual}</p>
      <p class="foot">Dicetak ${new Date().toLocaleString('id-ID')}</p>
      <script>window.onload = function () { window.print(); };</script>
      </body></html>`;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) {
      setValidationError('Popup diblokir browser. Izinkan popup untuk mencetak.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  const handleDownloadExcel = () => {
    if (!activeDetailDoc) return;
    // Kolom & urutan persis file export asli Olsera (stock_opname*.xls):
    // product, variant, sku, time, actual qty, system qty, difference, uom, cost price,
    // cost difference, sell price, sell difference, has material.
    const data = (activeDetailDoc.items || []).map((item) => {
      const selisih = Number(item.selisih ?? (item.stok_aktual - item.stok_sistem));
      const costPrice = Number(item.product_harga_beli) || 0;
      const sellPrice = Number(item.product_harga_jual_toko) || 0;
      return {
        product: item.product_nama,
        variant: item.variant_nama || '',
        sku: item.product_sku || '',
        time: item.jam_opname || '',
        'actual qty': item.stok_aktual,
        'system qty': item.stok_sistem,
        difference: selisih,
        uom: item.product_satuan || '',
        'cost price': costPrice,
        'cost difference': Number(item.selisih_harga ?? (selisih * costPrice)),
        'sell price': sellPrice,
        'sell difference': Number(item.selisih_harga_jual ?? (selisih * sellPrice)),
        'has material': '',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'stock_opname');
    XLSX.writeFile(wb, `stock_opname_${activeDetailDoc.nomor}.xlsx`);
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredList = opnameList.filter((row) => {
    const q = searchQuery.toLowerCase();
    return (
      row.no.toLowerCase().includes(q) ||
      row.note.toLowerCase().includes(q) ||
      row.receivedBy.toLowerCase().includes(q)
    );
  });

  const sortedList = [...filteredList].sort((a, b) => {
    let valA = String(a[sortKey] || '').toLowerCase();
    let valB = String(b[sortKey] || '').toLowerCase();
    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedList.length / pageSize) || 1;
  const paginatedList = sortedList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <>
      {viewState === 'list' && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Opname Stok</h2>
              <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>{filteredList.length} Opname Stok</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={openSettingsPanel}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b', width: '34px', height: '34px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}
                title="Pengaturan Opname"
              >
                <Settings size={16} />
              </button>

              <button
                type="button"
                onClick={() => { setImportResult(null); setImportFile(null); setShowImportModal(true); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0085ca', color: '#ffffff', border: 0, padding: '0 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', height: '34px', boxShadow: '0 2px 4px rgba(0, 133, 202, 0.15)' }}
              >
                <CloudUpload size={14} />
                <span>Import</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTanggal(todayISO());
                  setCatatan('');
                  handleStateChange('create');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0085ca', color: '#ffffff', border: 0, padding: '0 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', height: '34px', boxShadow: '0 2px 4px rgba(0, 133, 202, 0.15)' }}
              >
                <Plus size={14} />
                <span>Tambah</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', color: '#334155', outline: 'none', background: '#ffffff', height: '34px', minWidth: '100px' }}
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
            </select>

            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Cari No. Opname Stok"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px 8px 32px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', height: '34px' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'scroll', marginTop: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '860px' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th onClick={() => handleSort('no')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>No.</span><ChevronsUpDown size={14} style={{ color: sortKey === 'no' ? '#0085ca' : '#94a3b8' }} /></div>
                  </th>
                  <th onClick={() => handleSort('date')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>Tanggal</span><ChevronsUpDown size={14} style={{ color: sortKey === 'date' ? '#0085ca' : '#94a3b8' }} /></div>
                  </th>
                  <th onClick={() => handleSort('note')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>Catatan</span><ChevronsUpDown size={14} style={{ color: sortKey === 'note' ? '#0085ca' : '#94a3b8' }} /></div>
                  </th>
                  <th onClick={() => handleSort('status')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>Status</span><ChevronsUpDown size={14} style={{ color: sortKey === 'status' ? '#0085ca' : '#94a3b8' }} /></div>
                  </th>
                  <th onClick={() => handleSort('receivedBy')} style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span>Diterima Oleh</span><ChevronsUpDown size={14} style={{ color: sortKey === 'receivedBy' ? '#0085ca' : '#94a3b8' }} /></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '40px 20px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>{listLoading ? 'Memuat...' : 'No Data'}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedList.map((row) => (
                    <tr key={row.id} className="pi-table-row-hover">
                      <td
                        onClick={async () => {
                          await fetchDocumentDetail(row.id);
                          handleStateChange('detail');
                        }}
                        style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 'semibold', color: '#3b82f6', borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                      >
                        {row.no}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{row.date}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>{row.note}</td>
                      <td style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
                        <span style={{ background: row.status === 'Draft' ? '#ffedd5' : row.status === 'Selesai' ? '#dcfce7' : '#fee2e2', color: row.status === 'Draft' ? '#ea580c' : row.status === 'Selesai' ? '#16a34a' : '#dc2626', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{row.status}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>{row.receivedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '16px', marginTop: '16px', fontSize: '13px', color: '#64748b', padding: '8px 4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button type="button" onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ border: 0, background: 'none', color: currentPage === 1 ? '#cbd5e1' : '#64748b', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '4px 8px', fontWeight: 'bold', fontSize: '14px' }}>&lt;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button key={page} type="button" onClick={() => setCurrentPage(page)} style={{ border: 0, background: 'none', color: currentPage === page ? '#0085ca' : '#64748b', fontWeight: 'bold', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', backgroundColor: currentPage === page ? '#e4f8ff' : 'transparent' }}>{page}</button>
              ))}
              <button type="button" onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} style={{ border: 0, background: 'none', color: currentPage === totalPages ? '#cbd5e1' : '#64748b', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', padding: '4px 8px', fontWeight: 'bold', fontSize: '14px' }}>&gt;</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Go to</span>
              <input type="number" min={1} max={totalPages} value={currentPage} onChange={(e) => { const val = parseInt(e.target.value, 10); if (val >= 1 && val <= totalPages) setCurrentPage(val); }} style={{ width: '45px', height: '28px', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center', outline: 'none', fontSize: '13px' }} />
            </div>
          </div>
        </div>
      )}

      {viewState === 'create' && (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
          <div className="pi-category-card" style={{ maxWidth: '1200px', margin: '0 auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Tambah Opname Stok</h3>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'semibold', color: '#475569', marginBottom: '6px' }}>Tanggal</label>
                  <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 'semibold', color: '#475569', marginBottom: '6px' }}>Catatan</label>
                  <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none', minHeight: '38px', height: '38px', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', color: '#1e293b' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                <button onClick={() => handleStateChange('list')} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>Batal</button>
                <button onClick={handleCreateNew} style={{ background: '#0085ca', border: 0, borderRadius: '6px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', color: '#ffffff', cursor: 'pointer' }}>Lanjut tambah Opname Stok</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewState === 'detail' && activeDetailDoc && (
        <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f4f4f5', border: '1px solid #e4e4e7', padding: '12px 16px', borderRadius: '8px', color: '#52525b', fontSize: '13px', fontWeight: '600', marginBottom: '20px' }}>
            <span style={{ fontSize: '16px', color: '#71717a' }}>ⓘ</span>
            <span>Pastikan data sudah benar sebelum diposting. Setelah terposting, data tidak diperbolehkan diubah.</span>
          </div>

          <div className="pi-category-card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: '20px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'visible' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {activeDetailDoc.status === 'draft' && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', width: '64px', height: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ea580c', gap: '4px' }}>
                  <FileText size={20} /><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Draft</span>
                </div>
              )}
              {activeDetailDoc.status === 'selesai' && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', width: '64px', height: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#15803d', gap: '4px' }}>
                  <Check size={20} /><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Selesai</span>
                </div>
              )}
              {activeDetailDoc.status === 'batal' && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', width: '64px', height: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#b91c1c', gap: '4px' }}>
                  <X size={20} /><span style={{ fontSize: '11px', fontWeight: 'bold' }}>Batal</span>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>No. Opname Stok</span>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>{activeDetailDoc.nomor}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {activeDetailDoc.status !== 'draft' && (
                <button onClick={() => handleStateChange('list')} style={{ background: '#ffffff', border: '1px solid #0085ca', color: '#0085ca', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowLeft size={14} /><span>Kembali</span>
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowCetakDropdown((prev) => !prev)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Printer size={14} /><span>Cetak</span><ChevronDown size={14} />
                </button>
                {showCetakDropdown && (
                  <>
                    <div onClick={() => setShowCetakDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '160px', zIndex: 50 }}>
                      <button type="button" onClick={() => { setShowCetakDropdown(false); handleCetak('default'); }} style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', color: '#334155', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
                        Cetak
                      </button>
                      <button type="button" onClick={() => { setShowCetakDropdown(false); handleCetak('a5'); }} style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                        Cetak A5
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={handleDownloadExcel} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} /><span>Download Excel</span>
              </button>
              {activeDetailDoc.status === 'draft' && (
                <>
                  <button onClick={() => handleCommitStatus('Draft')} style={{ background: '#ffffff', border: '1px solid #fdba74', color: '#ea580c', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /><span>Draf</span>
                  </button>
                  <button onClick={() => handleCommitStatus('Batal')} style={{ background: '#ef4444', border: 0, color: '#ffffff', padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <X size={14} /><span>Batalkan</span>
                  </button>
                  <button onClick={() => handleCommitStatus('Selesai')} style={{ background: '#22c55e', border: 0, color: '#ffffff', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={14} /><span>Posting Sekarang</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Tanggal</span>
                {activeDetailDoc.status === 'draft' && !isEditingTanggal && (
                  <button onClick={() => { setEditTanggalValue(activeDetailDoc.tanggal); setIsEditingTanggal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '650', cursor: 'pointer' }}>
                    <Edit size={12} /><span>Ubah</span>
                  </button>
                )}
                {isEditingTanggal && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveInlineTanggal} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                    <button onClick={() => setIsEditingTanggal(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                  </div>
                )}
              </div>
              <div style={{ padding: '16px' }}>
                {!isEditingTanggal ? (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{formatDisplayDate(activeDetailDoc.tanggal)}</div>
                ) : (
                  <input type="date" value={editTanggalValue} onChange={(e) => setEditTanggalValue(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', outline: 'none' }} />
                )}
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span>Dibuat oleh: {activeDetailDoc.dibuat_oleh_nama || '-'}</span>
                </div>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Catatan</span>
                {activeDetailDoc.status === 'draft' && !isEditingCatatan && (
                  <button onClick={() => { setEditCatatanValue(activeDetailDoc.catatan || ''); setIsEditingCatatan(true); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '650', cursor: 'pointer' }}>
                    <Edit size={12} /><span>Ubah</span>
                  </button>
                )}
                {isEditingCatatan && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveInlineCatatan} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                    <button onClick={() => setIsEditingCatatan(false)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                  </div>
                )}
              </div>
              <div style={{ padding: '16px' }}>
                {!isEditingCatatan ? (
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: activeDetailDoc.catatan ? '#334155' : '#94a3b8' }}>{activeDetailDoc.catatan || '-'}</div>
                ) : (
                  <input type="text" value={editCatatanValue} onChange={(e) => setEditCatatanValue(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', fontSize: '13px', outline: 'none' }} />
                )}
              </div>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden' }}>
            {activeDetailDoc.status === 'draft' ? (
              <div style={{ background: '#0085ca', color: '#ffffff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Produk Stok Opname ( {activeDetailDoc.items?.length || 0} )</span>
                <button onClick={() => { resetAddProductForm(); setShowAddProductModal(true); }} style={{ background: '#ffffff', color: '#0085ca', border: 0, borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /><span>Tambah Produk</span>
                </button>
              </div>
            ) : (
              <div style={{ background: '#ffffff', color: '#1e293b', padding: '16px 20px', borderBottom: '1px solid #cbd5e1' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Produk Stok Opname ( {activeDetailDoc.items?.length || 0} )</span>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', border: '1px solid #cbd5e1' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Produk</th>
                  <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Waktu</th>
                  {!effectiveHideQtySistem && <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Qty System</th>}
                  <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Qty Aktual</th>
                  {!effectiveHideQtySelisih && <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Qty Selisih</th>}
                  {!effectiveHideQtySelisih && <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Selisih Harga</th>}
                  <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>Tgl. Kadaluwarsa</th>
                  <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderRight: activeDetailDoc.status === 'draft' ? '1px solid #cbd5e1' : 0, borderBottom: '1px solid #cbd5e1' }}>Rack</th>
                  {activeDetailDoc.status === 'draft' && <th style={{ padding: '12px 20px', fontSize: '12px', fontWeight: 'bold', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {!activeDetailDoc.items || activeDetailDoc.items.length === 0 ? (
                  <tr>
                    <td colSpan={9 - (effectiveHideQtySistem ? 1 : 0) - (effectiveHideQtySelisih ? 2 : 0) - (activeDetailDoc.status === 'draft' ? 0 : 1)} style={{ padding: '40px 20px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>Belum ada produk</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeDetailDoc.items.map((item) => {
                    const selisih = Number(item.selisih ?? (item.stok_aktual - item.stok_sistem));
                    const selisihHarga = Number(item.selisih_harga ?? (selisih * (item.product_harga_beli || 0)));
                    const isDraft = activeDetailDoc.status === 'draft';
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 'semibold', color: '#334155', borderRight: '1px solid #cbd5e1' }}>{item.product_nama}{item.product_sku ? ` (${item.product_sku})` : ''}</td>
                        <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', borderRight: '1px solid #cbd5e1' }}>{item.jam_opname || '-'}</td>
                        {!effectiveHideQtySistem && <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', borderRight: '1px solid #cbd5e1' }}>{item.stok_sistem} {item.product_satuan}</td>}
                        <td style={{ padding: '10px 20px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', borderRight: '1px solid #cbd5e1' }}>
                          {isDraft ? (
                            <input
                              type="number"
                              min="0"
                              defaultValue={item.stok_aktual}
                              onBlur={(e) => {
                                const val = e.target.value;
                                if (val !== '' && Number(val) !== Number(item.stok_aktual)) handleUpdateItemField(item.id, 'stok_aktual', val);
                              }}
                              style={{ width: '80px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '5px 8px', fontSize: '13px', outline: 'none' }}
                            />
                          ) : (
                            <>{item.stok_aktual} {item.product_satuan}</>
                          )}
                        </td>
                        {!effectiveHideQtySelisih && (
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 'bold', color: selisih === 0 ? '#475569' : selisih > 0 ? '#16a34a' : '#dc2626', borderRight: '1px solid #cbd5e1' }}>
                            {selisih > 0 ? `+${selisih}` : selisih}
                          </td>
                        )}
                        {!effectiveHideQtySelisih && (
                          <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 'bold', color: selisihHarga === 0 ? '#475569' : selisihHarga > 0 ? '#16a34a' : '#dc2626', borderRight: '1px solid #cbd5e1' }}>
                            {formatCurrencyRp(selisihHarga)}
                          </td>
                        )}
                        <td style={{ padding: '10px 20px', fontSize: '13px', color: '#475569', borderRight: '1px solid #cbd5e1' }}>
                          {isDraft ? (
                            <input
                              type="date"
                              defaultValue={item.tanggal_kadaluwarsa || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (item.tanggal_kadaluwarsa || '')) handleUpdateItemField(item.id, 'tanggal_kadaluwarsa', e.target.value);
                              }}
                              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '5px 6px', fontSize: '12px', outline: 'none' }}
                            />
                          ) : (
                            item.tanggal_kadaluwarsa ? formatDisplayDate(item.tanggal_kadaluwarsa) : '-'
                          )}
                        </td>
                        <td style={{ padding: '12px 20px', fontSize: '13px', color: '#475569', borderRight: isDraft ? '1px solid #cbd5e1' : 0 }}>{item.rak || '-'}</td>
                        {isDraft && (
                          <td style={{ padding: '12px 20px' }}>
                            <button onClick={() => handleRemoveItem(item.id)} style={{ background: 'transparent', border: 0, color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Panel: Atur Stok Opname (ikon gerigi) */}
      {showSettingsPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowSettingsPanel(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.3)' }}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px', background: '#ffffff', boxShadow: '-8px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Atur Stok Opname</h3>
              <button onClick={() => setShowSettingsPanel(false)} style={{ background: 'transparent', border: 0, color: '#64748b', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', fontSize: '13px', color: hideQtySistem ? '#0085ca' : '#334155', fontWeight: hideQtySistem ? '600' : 'normal', cursor: 'pointer' }}>
                <input type="checkbox" checked={hideQtySistem} onChange={(e) => setHideQtySistem(e.target.checked)} style={{ display: 'none' }} />
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: hideQtySistem ? '2px solid #0085ca' : '2px solid #cbd5e1',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hideQtySistem ? '#0085ca' : '#ffffff',
                  transition: 'all 0.15s'
                }}>
                  {hideQtySistem && <Check size={12} style={{ color: '#ffffff', strokeWidth: 3 }} />}
                </div>
                <span>Sembunyikan Qty Sistem</span>
              </label>
              {hideQtySistem && (
                <TerapkanDiSection
                  roles={applyToRolesSistem}
                  onToggleRole={toggleRoleIn(setApplyToRolesSistem)}
                  onPilihSemua={() => setApplyToRolesSistem([...OPNAME_ROLE_OPTIONS])}
                  onKosongkan={() => setApplyToRolesSistem([])}
                />
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', fontSize: '13px', color: hideQtySelisih ? '#0085ca' : '#334155', fontWeight: hideQtySelisih ? '600' : 'normal', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}>
                <input type="checkbox" checked={hideQtySelisih} onChange={(e) => setHideQtySelisih(e.target.checked)} style={{ display: 'none' }} />
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: hideQtySelisih ? '2px solid #0085ca' : '2px solid #cbd5e1',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: hideQtySelisih ? '#0085ca' : '#ffffff',
                  transition: 'all 0.15s'
                }}>
                  {hideQtySelisih && <Check size={12} style={{ color: '#ffffff', strokeWidth: 3 }} />}
                </div>
                <span>Sembunyikan Qty Selisih</span>
              </label>
              {hideQtySelisih && (
                <TerapkanDiSection
                  roles={applyToRolesSelisih}
                  onToggleRole={toggleRoleIn(setApplyToRolesSelisih)}
                  onPilihSemua={() => setApplyToRolesSelisih([...OPNAME_ROLE_OPTIONS])}
                  onKosongkan={() => setApplyToRolesSelisih([])}
                />
              )}
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={settingsSaving}
                style={{ width: '100%', background: settingsSaving ? '#93c5fd' : '#0085ca', color: '#ffffff', border: 0, borderRadius: '6px', padding: '10px', fontSize: '13px', fontWeight: 'bold', cursor: settingsSaving ? 'not-allowed' : 'pointer' }}
              >
                {settingsSaving ? 'Menyimpan...' : 'Terapkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Tambah Produk — multi-select ala Olsera (centang banyak produk sekaligus, maks 500) */}
      {showAddProductModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={() => setShowAddProductModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '640px', maxHeight: '85vh', background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden', margin: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Tambah Produk</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowAddProductModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Batal</button>
                <button
                  onClick={handleBulkAdd}
                  disabled={addModalSelected.length === 0 || bulkAdding}
                  style={{ background: (addModalSelected.length === 0 || bulkAdding) ? '#86efac' : '#22c55e', border: 0, borderRadius: '6px', padding: '6px 16px', fontSize: '13px', fontWeight: 'bold', color: '#ffffff', cursor: (addModalSelected.length === 0 || bulkAdding) ? 'not-allowed' : 'pointer' }}
                >
                  {bulkAdding ? 'Menambah...' : `Tambah (${addModalSelected.length})`}
                </button>
              </div>
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', gap: '10px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ position: 'relative', width: '130px', flexShrink: 0 }}>
                <input type="time" step="1" value={addModalTime} onChange={(e) => setAddModalTime(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <select value={addModalCategory} onChange={(e) => setAddModalCategory(e.target.value)} style={{ width: '160px', flexShrink: 0, border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', outline: 'none', color: addModalCategory ? '#1e293b' : '#94a3b8' }}>
                <option value="">Kategori</option>
                {addModalCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.nama}</option>
                ))}
              </select>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Cari Produk / SKU / Barcode"
                  value={addModalSearch}
                  onChange={(e) => setAddModalSearch(e.target.value)}
                  style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px 8px 32px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '10px 20px', background: '#eff6ff', color: '#1e3a8a', fontSize: '12px', borderBottom: '1px solid #f1f5f9' }}>
              ⓘ Maksimal 500 produk terpilih tiap penambahan
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
              {addModalSearching ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Mencari...</div>
              ) : addModalResults.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                  <span style={{ fontSize: '14px', color: '#64748b', marginTop: '16px', fontWeight: 'bold' }}>Belum ada produk</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {addModalResults.map((p) => {
                    const checked = addModalSelected.some((sel) => sel.id === p.id);
                    return (
                      <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAddModalSelect(p)} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nama}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.sku ? `SKU: ${p.sku}` : 'Tanpa SKU'}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', flexShrink: 0 }}>Stok: {p.qty_stok} {p.satuan}</div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Import CSV */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#ffffff', borderRadius: '8px', width: '90%', maxWidth: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Import Opname Stok (CSV)</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: '#f1f5f9', border: 0, padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', color: '#475569' }}>Tutup</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'relative', width: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => setShowTemplateDropdown((prev) => !prev)}
                  disabled={templateDownloading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0085ca', padding: '8px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: templateDownloading ? 'not-allowed' : 'pointer' }}
                >
                  <span>{templateDownloading ? 'Mengunduh...' : 'Download Template'}</span>
                  <ChevronDown size={14} />
                </button>
                {showTemplateDropdown && (
                  <>
                    <div onClick={() => setShowTemplateDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: '200px', maxHeight: '220px', overflowY: 'auto', zIndex: 50 }}>
                      {templateRanges.map((r) => (
                        <button
                          key={r.start}
                          type="button"
                          onClick={() => handleDownloadTemplateRange(r.start, r.end)}
                          style={{ width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '10px 14px', fontSize: '13px', color: '#334155', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        >
                          Baris {r.start} - {r.end}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                <strong style={{ color: '#334155' }}>Import dari CSV (maks. 500 baris)</strong><br />
                Import dikelompokkan berdasarkan rak, 1 produk dapat ditulis dalam beberapa baris jika berbeda rak.
                Produk dicocokkan berdasarkan SKU, lalu nama produk bila SKU kosong.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files[0] || null)} style={{ fontSize: '13px' }} />
                {importFile && (
                  <button type="button" onClick={() => setImportFile(null)} style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    Hapus semua file
                  </button>
                )}
              </div>
              {importResult && (
                <div style={{ fontSize: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ color: '#16a34a', fontWeight: 'bold', marginBottom: importResult.errors.length ? 6 : 0 }}>{importResult.createdCount} produk berhasil ditambahkan.</div>
                  {importResult.errors.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#dc2626' }}>
                      {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button onClick={() => setShowImportModal(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>Batal</button>
              <button
                onClick={handleImportCsv}
                disabled={!importFile || importing}
                style={{ background: (!importFile || importing) ? '#93c5fd' : '#0085ca', border: 0, borderRadius: '4px', padding: '8px 24px', fontSize: '13px', fontWeight: 'bold', color: '#ffffff', cursor: (!importFile || importing) ? 'not-allowed' : 'pointer' }}
              >
                {importing ? 'Memproses...' : 'Post Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Error Validasi */}
      {validationError && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '24px', maxWidth: '440px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', border: '1px solid #fee2e2', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '24px' }}>⚠️</div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>Gagal</h3>
            <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>{validationError}</p>
            <button
              onClick={() => setValidationError('')}
              style={{ background: '#ef4444', color: '#ffffff', border: 0, borderRadius: '6px', padding: '10px 24px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
