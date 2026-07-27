import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency } from '../productInventoryData';
import apiClient from '../../../../api/apiClient';
import { PriceInput } from './VariantModal';
import ProductVariantTab from './ProductVariantTab';
import ProductBahanResepTab from './ProductBahanResepTab';
import ProductTingkatanHargaTab from './ProductTingkatanHargaTab';
import ProductTerkaitTab from './ProductTerkaitTab';
import ProductSeriTab from './ProductSeriTab';
import ProductSpesifikasiTab from './ProductSpesifikasiTab';
import ProductSatuanTab from './ProductSatuanTab';

const DETAIL_TABS = [
  { id: 'profil', label: 'Profil' },
  { id: 'variant', label: 'Variant' },
  { id: 'bahan-resep', label: 'Bahan/Resep' },
  { id: 'tingkatan-harga', label: 'Tingkatan Harga' },
  { id: 'terkait', label: 'Terkait' },
  { id: 'seri', label: 'Seri' },
  { id: 'spesifikasi', label: 'Spesifikasi' },
  { id: 'satuan', label: 'Satuan' },
];

const yaTidak = (v) => (v ? 'Ya' : 'Tidak');

const formatTanggal = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
};

// Tinggi bilah tab yang sticky di top:0 (paddingTop 12 + tombol ~34 +
// paddingBottom 8 + border 1). Header Section menempel tepat di bawahnya —
// sebelumnya dipatok 128px, jauh lebih rendah dari bilah tab, sehingga header
// menggantung menutupi baris pertama isi section (kotak upload foto).
const TAB_BAR_HEIGHT = 55;

function Section({ title, headerRight, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 16 }}>
      <div style={{
        position: 'sticky',
        top: TAB_BAR_HEIGHT,
        zIndex: 20,
        background: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '14px 18px',
        borderBottom: '1px solid #e2e8f0',
        borderRadius: '9px 9px 0 0'
      }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b', paddingTop: 6 }}>{title}</h3>
        {headerRight}
      </div>
      <div style={{ padding: '4px 18px 0' }}>{children}</div>
    </div>
  );
}

function EditButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="detail-btn-primary"
      style={{ background: '#026da7', color: '#fff', border: 0, borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
    >
      Ubah
    </button>
  );
}

function SaveCancelHeader({ storeName, onCancel, onSave, saving }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Simpan di:</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#fff',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '4px 10px',
          height: '36px',
          minWidth: '180px',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#f1f5f9',
            color: '#475569',
            fontSize: '12px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
          }}>
            {storeName}
            <span style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', marginLeft: 2 }}>&times;</span>
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="detail-btn-success"
        style={{
          background: '#72b13c',
          color: '#fff',
          border: 0,
          borderRadius: 6,
          padding: '8px 24px',
          fontSize: 13,
          fontWeight: 700,
          cursor: saving ? 'default' : 'pointer',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="detail-btn-secondary"
        style={{
          background: '#fff',
          color: '#334155',
          border: '1px solid #e2e8f0',
          borderRadius: 6,
          padding: '8px 24px',
          fontSize: 13,
          fontWeight: 700,
          cursor: saving ? 'default' : 'pointer',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        Batal
      </button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 11, color: '#0284c7', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{value || value === 0 ? value : '-'}</div>
    </div>
  );
}

const formatIDRCurrency = (val) => {
  const num = parseFloat(val) || 0;
  const formatted = Math.round(num).toLocaleString('id-ID');
  return `IDR ${formatted}`;
};

function ReferVarianCard({ label, aggregate, showEye, onEyeClick }) {
  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 90 }}>
      <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        {showEye && (
          <span style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 13 }} onClick={onEyeClick}>👁️</span>
        )}
      </div>
      <div style={{ background: '#eff6ff', color: '#0284c7', fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid #bfdbfe', fontWeight: 600, textAlign: 'center' }}>
        Refer Ke varian
      </div>
      {aggregate !== undefined && (
        <div style={{ background: '#e2e8f0', color: '#475569', fontSize: 13, fontWeight: 500, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
          {aggregate}
        </div>
      )}
    </div>
  );
}

function PlainCard({ label, value, showEye, onEyeClick }) {
  return (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 90 }}>
      <div style={{ fontSize: 11, color: '#334155', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        {showEye && (
          <span style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 13 }} onClick={onEyeClick}>👁️</span>
        )}
      </div>
      <div style={{ background: '#e2e8f0', color: '#475569', fontSize: 13, fontWeight: 500, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
        {value}
      </div>
    </div>
  );
}

function InfoBox({ text }) {
  return (
    <div style={{
      background: '#eff6ff',
      border: '1px solid #bfdbfe',
      color: '#0284c7',
      fontSize: 13,
      fontWeight: 500,
      padding: '8px 12px',
      borderRadius: 6,
      width: '100%',
      boxSizing: 'border-box',
      marginTop: 4,
      marginBottom: 10
    }}>
      {text}
    </div>
  );
}

function FormRow({ label, desc, children }) {
  return (
    <div className="pi-create-row">
      <div className="pi-row-label-desc">
        <span className="pi-row-label">{label}</span>
        {desc && <span className="pi-row-desc">{desc}</span>}
      </div>
      <div className="pi-row-input">{children}</div>
    </div>
  );
}

export default function ProductDetailPage({ product, onBack, onUpdated, categories = [], brands = [], storeName = 'Bintang Advertising', initialCopyMode = false }) {
  const [activeTab, setActiveTab] = useState('profil');
  const [editingSection, setEditingSection] = useState(null);
  const [savingSection, setSavingSection] = useState(false);
  
  const [localCategories, setLocalCategories] = useState(categories);
  const [localBrands, setLocalBrands] = useState(brands);
  const [collections, setCollections] = useState([]);

  const [formNama, setFormNama] = useState('');
  const [formNamaAlt, setFormNamaAlt] = useState('');
  const [formKategori, setFormKategori] = useState('');
  const [formKoleksi, setFormKoleksi] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formKondisi, setFormKondisi] = useState('Baru');
  const [formBebasPajak, setFormBebasPajak] = useState(false);
  const [formBebasBiayaLayanan, setFormBebasBiayaLayanan] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);

  const [isCopying, setIsCopying] = useState(false);
  const [savingCopy, setSavingCopy] = useState(false);
  const [copyPhoto, setCopyPhoto] = useState(false);
  const [copyVariant, setCopyVariant] = useState(false);
  const [copyTiers, setCopyTiers] = useState(false);
  const [copyBom, setCopyBom] = useState(false);
  const [formHargaSama, setFormHargaSama] = useState(true);
  const [formHargaOnline, setFormHargaOnline] = useState('Rp. 0');
  const [formLacakInventori, setFormLacakInventori] = useState(true);
  const [formRack, setFormRack] = useState('');
  const [formQtyStok, setFormQtyStok] = useState(0);
  const [formStokMinimum, setFormStokMinimum] = useState(5);
  const [formQtyFastMoving, setFormQtyFastMoving] = useState(0);

  // New optional detail fields states
  const [showDetailOptional, setShowDetailOptional] = useState(false);
  const [formHargaDinamis, setFormHargaDinamis] = useState(false);
  const [formSatuan, setFormSatuan] = useState('pcs');
  const [formStokKosong, setFormStokKosong] = useState(false);
  const [formButuhPengiriman, setFormButuhPengiriman] = useState(true);
  const [formBerat, setFormBerat] = useState('0.2000');
  const [formTersediaOnline, setFormTersediaOnline] = useState(true);
  const [formTanggalTersediaOnline, setFormTanggalTersediaOnline] = useState('');
  const [formTidakTersediaOfflinePos, setFormTidakTersediaOfflinePos] = useState(false);
  const [formMetaKeywords, setFormMetaKeywords] = useState('');
  const [formMetaDescription, setFormMetaDescription] = useState('');
  const [formDeskripsi, setFormDeskripsi] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  // Harga section edit states
  const [hargaDinamisEdit, setHargaDinamisEdit] = useState(false);
  const [hargaOnlineSamaEdit, setHargaOnlineSamaEdit] = useState(true);
  const [hargaPasarEdit, setHargaPasarEdit] = useState('0');
  const [hargaBeliEdit, setHargaBeliEdit] = useState('0');
  const [hargaJualOnlineEdit, setHargaJualOnlineEdit] = useState('0');
  const [hargaJualTokoEdit, setHargaJualTokoEdit] = useState('0');
  const [komisiEdit, setKomisiEdit] = useState('0');
  const [komisiTipeEdit, setKomisiTipeEdit] = useState('nominal'); // 'nominal' or 'persen'
  const [minimalPesananEdit, setMinimalPesananEdit] = useState(1);
  const [maksimalPesananEdit, setMaksimalPesananEdit] = useState(0);

  // Inventori section edit states
  const [lacakInventoriEdit, setLacakInventoriEdit] = useState(false);
  const [stokMinimumEdit, setStokMinimumEdit] = useState(5);
  const [satuanEdit, setSatuanEdit] = useState('pcs');
  const [stokKosongEdit, setStokKosongEdit] = useState(false);

  // Pengiriman section edit states
  const [butuhPengirimanEdit, setButuhPengirimanEdit] = useState(true);
  const [beratEdit, setBeratEdit] = useState('0.2');

  // Penjualan section edit states
  const [pesananNoSeriEdit, setPesananNoSeriEdit] = useState(false);

  // Kategori Tambahan section edit states
  const [kategoriUnggulanEdit, setKategoriUnggulanEdit] = useState(false);
  const [kategoriSaleEdit, setKategoriSaleEdit] = useState(false);
  const [kategoriPreorderEdit, setKategoriPreorderEdit] = useState(false);
  const [kategoriRilisTerbaruEdit, setKategoriRilisTerbaruEdit] = useState(false);
  const [kategoriPopulerEdit, setKategoriPopulerEdit] = useState(false);
  const [kategoriBahanMentahEdit, setKategoriBahanMentahEdit] = useState(false);

  // Deskripsi section edit states
  const [deskripsiEdit, setDeskripsiEdit] = useState('');

  // SEO section edit states
  const [metaKeywordsEdit, setMetaKeywordsEdit] = useState('');
  const [metaDescriptionEdit, setMetaDescriptionEdit] = useState('');

  // Ketersediaan section edit states
  const [tersediaOnlineEdit, setTersediaOnlineEdit] = useState(true);
  const [tanggalTersediaOnlineEdit, setTanggalTersediaOnlineEdit] = useState('');
  const [tidakTersediaOfflinePosEdit, setTidakTersediaOfflinePosEdit] = useState(false);

  // Catatan section edit states
  const [catatanEdit, setCatatanEdit] = useState('');

  // Stok Masuk modal states
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [stockInHistory, setStockInHistory] = useState([]);
  const [loadingStockIn, setLoadingStockIn] = useState(false);
  const [stockInSearch, setStockInSearch] = useState('');
  const [stockInRowsPerPage, setStockInRowsPerPage] = useState(10);
  const [stockInPage, setStockInPage] = useState(1);

  useEffect(() => {
    if (showStockInModal && product?.id) {
      const fetchStockInHistory = async () => {
        setLoadingStockIn(true);
        try {
          const res = await apiClient.get(`/products/${product.id}/stock-in-history/`);
          setStockInHistory(res.data || []);
        } catch (err) {
          console.error('Error fetching stock in history:', err);
        } finally {
          setLoadingStockIn(false);
        }
      };
      fetchStockInHistory();
    }
  }, [showStockInModal, product?.id]);

  // Filtered and paginated Stok Masuk
  const filteredStockIn = stockInHistory.filter(item => {
    const searchLower = stockInSearch.toLowerCase();
    return (
      (item.nomor || '').toLowerCase().includes(searchLower) ||
      (item.supplier || '').toLowerCase().includes(searchLower) ||
      (item.variant_nama || '').toLowerCase().includes(searchLower)
    );
  });

  const totalItems = filteredStockIn.length;
  const totalPages = Math.ceil(totalItems / stockInRowsPerPage) || 1;
  const startIndex = (stockInPage - 1) * stockInRowsPerPage;
  const paginatedStockIn = filteredStockIn.slice(startIndex, startIndex + stockInRowsPerPage);

  const refreshDropdowns = async () => {
    try {
      const [catRes, brandRes, collRes] = await Promise.all([
        apiClient.get('/product-categories/'),
        apiClient.get('/brands/'),
        apiClient.get('/collections/'),
      ]);
      setLocalCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data?.results || []);
      setLocalBrands(Array.isArray(brandRes.data) ? brandRes.data : brandRes.data?.results || []);
      setCollections(Array.isArray(collRes.data) ? collRes.data : collRes.data?.results || []);
    } catch (err) {
      console.error('[ProductDetailPage] refreshDropdowns error:', err);
    }
  };

  const startCopyProduct = () => {
    refreshDropdowns(); // dynamically refresh dropdown data in the background
    setFormNama(product.nama || '');
    setFormNamaAlt(product.nama_alternatif || '');
    setFormKategori(product.kategori ? String(product.kategori) : '');
    setFormKoleksi(product.koleksi ? String(product.koleksi) : '');
    setFormBrand(product.brand ? String(product.brand) : '');
    setFormSku(product.sku || '');
    setFormBarcode(product.barcode || '');
    setFormKondisi(product.kondisi || 'Baru');
    setFormBebasPajak(!!product.bebas_pajak);
    setFormBebasBiayaLayanan(!!product.bebas_biaya_layanan);
    setFormHargaSama(!!product.harga_online_sama);
    const initialPriceOnline = product.harga_jual_online ? 'Rp. ' + parseInt(product.harga_jual_online).toLocaleString('id-ID') : 'Rp. 0';
    setFormHargaOnline(initialPriceOnline);
    setFormLacakInventori(!!product.lacak_inventori);
    setFormRack(product.rack || '');
    setFormQtyStok(0);
    setFormStokMinimum(product.stok_minimum || 5);
    setFormQtyFastMoving(product.qty_fast_moving || 0);
    setCopyPhoto(false);
    setCopyVariant(false);
    setCopyTiers(false);
    setCopyBom(false);

    // Populate optional fields
    setFormHargaDinamis(!!product.harga_dinamis);
    setFormSatuan(product.satuan || 'pcs');
    setFormStokKosong(Number(product.qty_stok) <= 0);
    setFormButuhPengiriman(!!product.butuh_pengiriman);
    setFormBerat(product.berat !== null && product.berat !== undefined ? String(product.berat) : '0.2000');
    setFormTersediaOnline(!!product.tersedia_online);
    
    const today = new Date().toISOString().split('T')[0];
    setFormTanggalTersediaOnline(product.tanggal_tersedia_online || today);
    setFormTidakTersediaOfflinePos(!!product.tidak_tersedia_offline_pos);
    setFormMetaKeywords(product.meta_keywords || '');
    setFormMetaDescription(product.meta_description || '');
    setFormDeskripsi(product.deskripsi || '');
    setFormCatatan(product.catatan || '');
    
    setShowDetailOptional(false);
    setIsCopying(true);
  };

  const handleSaveCopy = async () => {
    if (savingCopy) return;
    setSavingCopy(true);
    try {
      const digits = formHargaOnline.replace(/\D/g, '');
      const numericOnlinePrice = digits ? parseInt(digits, 10) : 0;

      const res = await apiClient.post(`/products/${product.id}/copy/`, {
        nama: formNama,
        nama_alternatif: formNamaAlt || null,
        kategori_id: formKategori || null,
        harga_jual_online: numericOnlinePrice,
        harga_online_sama: formHargaSama,
        lacak_inventori: formLacakInventori,
        rack: formRack || '',
        qty_stok: formQtyStok ? parseFloat(formQtyStok) : 0.00,
        stok_minimum: formStokMinimum ? parseFloat(formStokMinimum) : 0.00,
        qty_fast_moving: formQtyFastMoving ? parseFloat(formQtyFastMoving) : 0.00,
        copy_photo: copyPhoto,
        copy_variant: copyVariant,
        copy_tiers: copyTiers,
        copy_bom: copyBom,

        // Optional detail fields
        sku: formSku || null,
        barcode: formBarcode || null,
        koleksi_id: formKoleksi || null,
        brand_id: formBrand || null,
        kondisi: formKondisi,
        deskripsi: formDeskripsi || null,
        catatan: formCatatan || '',
        harga_dinamis: formHargaDinamis,
        satuan: formSatuan,
        butuh_pengiriman: formButuhPengiriman,
        berat: formBerat ? parseFloat(formBerat) : null,
        bebas_pajak: formBebasPajak,
        bebas_biaya_layanan: formBebasBiayaLayanan,
        tersedia_online: formTersediaOnline,
        tanggal_tersedia_online: formTanggalTersediaOnline || null,
        tidak_tersedia_offline_pos: formTidakTersediaOfflinePos,
        meta_keywords: formMetaKeywords || '',
        meta_description: formMetaDescription || ''
      });

      alert('Produk berhasil disalin!');
      onUpdated?.(res.data);
      setIsCopying(false);
    } catch (err) {
      console.error('[ProductDetailPage] copy product error:', err);
      alert('Gagal menyalin produk.');
    } finally {
      setSavingCopy(false);
    }
  };

  useEffect(() => {
    const el = document.querySelector('.pi-content-topbar h1');
    if (el) {
      const original = el.innerText;
      if (isCopying) {
        el.innerText = 'Katalog Produk / Product Copy';
      } else {
        el.innerText = 'Katalog Produk / Detail Produk';
      }
      return () => {
        el.innerText = original;
      };
    }
  }, [isCopying]);

  useEffect(() => {
    apiClient
      .get('/collections/')
      .then((res) => setCollections(Array.isArray(res.data) ? res.data : res.data?.results || []))
      .catch((err) => console.error('[ProductDetailPage] fetch collections error:', err));
  }, []);

  useEffect(() => {
    if (initialCopyMode) {
      startCopyProduct();
    }
  }, [initialCopyMode]);

  if (!product) return null;

  const hasVariant = product.has_variant && product.variants?.length > 0;
  const firstVariant = hasVariant ? product.variants[0] : null;

  const stokKosong = hasVariant
    ? product.variants.every((v) => Number(v.qty_stok) <= 0)
    : Number(product.qty_stok) <= 0;

  const startEditInfoUmum = () => {
    refreshDropdowns(); // dynamically refresh dropdown data
    setFormNama(product.nama || '');
    setFormNamaAlt(product.nama_alternatif || '');
    setFormKategori(product.kategori ? String(product.kategori) : '');
    setFormKoleksi(product.koleksi ? String(product.koleksi) : '');
    setFormBrand(product.brand ? String(product.brand) : '');
    setFormSku(product.sku || '');
    setFormBarcode(product.barcode || '');
    setFormKondisi(product.kondisi || 'Baru');
    setFormBebasPajak(!!product.bebas_pajak);
    setFormBebasBiayaLayanan(!!product.bebas_biaya_layanan);
    setSelectedPhoto(null);
    setPhotoPreviewUrl(product.fotos?.[0]?.foto || null);
    setEditingSection('info_umum');
  };

  const cancelEdit = () => setEditingSection(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const saveInfoUmum = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      await apiClient.patch(`/products/${product.id}/`, {
        nama: formNama,
        nama_alternatif: formNamaAlt || null,
        kategori: formKategori || null,
        koleksi: formKoleksi || null,
        brand: formBrand || null,
        sku: formSku || null,
        barcode: formBarcode || null,
        kondisi: formKondisi,
        bebas_pajak: formBebasPajak,
        bebas_biaya_layanan: formBebasBiayaLayanan,
      });
      if (selectedPhoto) {
        const fd = new FormData();
        fd.append('product', product.id);
        fd.append('is_primary', 'true');
        fd.append('foto', selectedPhoto);
        await apiClient.post('/product-images/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      const fresh = await apiClient.get(`/products/${product.id}/`);
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] save info umum error:', err);
      alert('Gagal menyimpan perubahan.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditHarga = () => {
    setHargaDinamisEdit(!!product.harga_dinamis);
    setHargaOnlineSamaEdit(!!product.harga_online_sama);
    setHargaPasarEdit(product.harga_pasar ? String(Math.round(parseFloat(product.harga_pasar))) : '0');
    setHargaBeliEdit(product.harga_beli ? String(Math.round(parseFloat(product.harga_beli))) : '0');
    setHargaJualOnlineEdit(product.harga_jual_online ? String(Math.round(parseFloat(product.harga_jual_online))) : '0');
    setHargaJualTokoEdit(product.harga_jual_toko ? String(Math.round(parseFloat(product.harga_jual_toko))) : '0');
    setKomisiEdit(product.komisi ? String(Math.round(parseFloat(product.komisi))) : '0');
    setKomisiTipeEdit('nominal');
    setMinimalPesananEdit(product.minimal_pesanan !== null && product.minimal_pesanan !== undefined ? product.minimal_pesanan : 1);
    setMaksimalPesananEdit(product.maksimal_pesanan !== null && product.maksimal_pesanan !== undefined ? product.maksimal_pesanan : 0);
    setEditingSection('harga');
  };

  const saveHarga = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        harga_dinamis: hargaDinamisEdit,
        harga_online_sama: hargaOnlineSamaEdit,
        minimal_pesanan: parseInt(minimalPesananEdit, 10) || 1,
        maksimal_pesanan: parseInt(maksimalPesananEdit, 10) || 0,
      };

      if (!hasVariant) {
        payload.harga_pasar = parseFloat(hargaPasarEdit) || 0;
        payload.harga_beli = parseFloat(hargaBeliEdit) || 0;
        payload.harga_jual_online = parseFloat(hargaJualOnlineEdit) || 0;
        payload.harga_jual_toko = parseFloat(hargaJualTokoEdit) || 0;
        payload.komisi = parseFloat(komisiEdit) || 0;
      }

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Harga berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveHarga error:', err);
      alert('Gagal memperbarui harga.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditInventori = () => {
    setLacakInventoriEdit(!!product.lacak_inventori);
    setStokMinimumEdit(product.stok_minimum !== null && product.stok_minimum !== undefined ? product.stok_minimum : 5);
    setSatuanEdit(product.satuan || 'pcs');
    setStokKosongEdit(!!stokKosong);
    setEditingSection('inventori');
  };

  const saveInventori = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        lacak_inventori: lacakInventoriEdit,
        stok_minimum: parseFloat(stokMinimumEdit) || 0,
        satuan: satuanEdit,
      };

      if (!hasVariant) {
        if (stokKosongEdit) {
          payload.qty_stok = 0;
        }
      }

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Inventori berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveInventori error:', err);
      alert('Gagal memperbarui inventori.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditPengiriman = () => {
    setButuhPengirimanEdit(!!product.butuh_pengiriman);
    setBeratEdit(product.berat !== null && product.berat !== undefined ? String(product.berat) : '0.2');
    setEditingSection('pengiriman');
  };

  const savePengiriman = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        butuh_pengiriman: butuhPengirimanEdit,
        berat: parseFloat(beratEdit) || 0,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Pengiriman berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] savePengiriman error:', err);
      alert('Gagal memperbarui pengiriman.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditPenjualan = () => {
    setPesananNoSeriEdit(!!product.pesanan_no_seri);
    setEditingSection('penjualan');
  };

  const savePenjualan = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        pesanan_no_seri: pesananNoSeriEdit,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Penjualan berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] savePenjualan error:', err);
      alert('Gagal memperbarui penjualan.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditKategoriTambahan = () => {
    setKategoriUnggulanEdit(!!product.kategori_unggulan);
    setKategoriSaleEdit(!!product.kategori_sale);
    setKategoriPreorderEdit(!!product.kategori_preorder);
    setKategoriRilisTerbaruEdit(!!product.kategori_rilis_terbaru);
    setKategoriPopulerEdit(!!product.kategori_populer);
    setKategoriBahanMentahEdit(!!product.kategori_bahan_mentah);
    setEditingSection('kategori_tambahan');
  };

  const saveKategoriTambahan = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        kategori_unggulan: kategoriUnggulanEdit,
        kategori_sale: kategoriSaleEdit,
        kategori_preorder: kategoriPreorderEdit,
        kategori_rilis_terbaru: kategoriRilisTerbaruEdit,
        kategori_populer: kategoriPopulerEdit,
        kategori_bahan_mentah: kategoriBahanMentahEdit,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Kategori tambahan berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveKategoriTambahan error:', err);
      alert('Gagal memperbarui kategori tambahan.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditDeskripsi = () => {
    setDeskripsiEdit(product.deskripsi || '');
    setEditingSection('deskripsi');
  };

  const saveDeskripsi = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        deskripsi: deskripsiEdit,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Deskripsi berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveDeskripsi error:', err);
      alert('Gagal memperbarui deskripsi.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditSEO = () => {
    setMetaKeywordsEdit(product.meta_keywords || '');
    setMetaDescriptionEdit(product.meta_description || '');
    setEditingSection('seo');
  };

  const saveSEO = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        meta_keywords: metaKeywordsEdit,
        meta_description: metaDescriptionEdit,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('SEO berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveSEO error:', err);
      alert('Gagal memperbarui SEO.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditKetersediaan = () => {
    setTersediaOnlineEdit(!!product.tersedia_online);
    const today = new Date().toISOString().split('T')[0];
    setTanggalTersediaOnlineEdit(product.tanggal_tersedia_online || today);
    setTidakTersediaOfflinePosEdit(!!product.tidak_tersedia_offline_pos);
    setEditingSection('ketersediaan');
  };

  const saveKetersediaan = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        tersedia_online: tersediaOnlineEdit,
        tanggal_tersedia_online: tanggalTersediaOnlineEdit || null,
        tidak_tersedia_offline_pos: tidakTersediaOfflinePosEdit,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Ketersediaan berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveKetersediaan error:', err);
      alert('Gagal memperbarui ketersediaan.');
    } finally {
      setSavingSection(false);
    }
  };

  const startEditCatatan = () => {
    setCatatanEdit(product.catatan || '');
    setEditingSection('catatan');
  };

  const saveCatatan = async () => {
    if (savingSection) return;
    setSavingSection(true);
    try {
      const payload = {
        catatan: catatanEdit,
      };

      await apiClient.patch(`/products/${product.id}/`, payload);
      const fresh = await apiClient.get(`/products/${product.id}/`);
      alert('Catatan berhasil diperbarui!');
      onUpdated?.(fresh.data);
      setEditingSection(null);
    } catch (err) {
      console.error('[ProductDetailPage] saveCatatan error:', err);
      alert('Gagal memperbarui catatan.');
    } finally {
      setSavingSection(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      await apiClient.delete(`/products/${product.id}/`);
      alert('Produk berhasil dihapus!');
      onBack?.();
    } catch (err) {
      console.error('[ProductDetailPage] handleDeleteProduct error:', err);
      alert('Gagal menghapus produk.');
    }
  };

  if (isCopying) {
    return (
      <div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' }}>Tambah Produk</h3>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsCopying(false)}
                disabled={savingCopy}
                style={{ color: '#64748b', fontSize: 13, fontWeight: 600, border: 0, background: 'none', cursor: 'pointer', marginRight: 20 }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCopy}
                disabled={savingCopy}
                style={{ background: '#0284c7', color: '#fff', border: 0, borderRadius: 6, padding: '8px 24px', fontSize: 13, fontWeight: 700, cursor: savingCopy ? 'default' : 'pointer' }}
              >
                {savingCopy ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
          <div style={{ padding: '0 18px' }}>
            <FormRow label="Salin Foto" desc="Salin foto dari produk asli">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="pi-switch">
                  <input type="checkbox" checked={copyPhoto} onChange={(e) => setCopyPhoto(e.target.checked)} />
                  <span className="pi-slider">
                    <span className="pi-slider-text">{copyPhoto ? 'Ya' : 'Tidak'}</span>
                  </span>
                </label>
                <span style={{ fontSize: 12, color: '#64748b' }}>{copyPhoto ? 'Ya' : 'Tidak'}</span>
              </div>
            </FormRow>

            <FormRow label="Nama Produk" desc="Tulis nama produk sesuai jenis, merek, dan rincian produk *">
              <input type="text" value={formNama} onChange={(e) => setFormNama(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
            </FormRow>

            <FormRow label="Nama Produk Alternatif" desc="Tulis alternatif nama produk dalam bahasa Mandarin / Latin">
              <input type="text" value={formNamaAlt} onChange={(e) => setFormNamaAlt(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
            </FormRow>

            <FormRow label="Kategori Produk" desc="Pilih dari yang ada atau tambahkan yang baru *">
              <select value={formKategori ? String(formKategori) : ''} onChange={(e) => setFormKategori(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: '#fff' }}>
                <option value="">Pilih salah satu</option>
                {localCategories.map((cat) => (
                  <option key={cat.id} value={String(cat.id)}>{cat.nama}</option>
                ))}
              </select>
            </FormRow>

            <FormRow label="Harga jual online sama dengan harga jual toko">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="pi-switch">
                  <input type="checkbox" checked={formHargaSama} onChange={(e) => setFormHargaSama(e.target.checked)} />
                  <span className="pi-slider">
                    <span className="pi-slider-text">{formHargaSama ? 'Ya' : 'Tidak'}</span>
                  </span>
                </label>
                <span style={{ fontSize: 12, color: '#64748b' }}>{formHargaSama ? 'Ya' : 'Tidak'}</span>
              </div>
            </FormRow>

            {!formHargaSama && (
              <FormRow label="Harga Jual Online">
                <div style={{ width: '100%' }}>
                  <PriceInput value={formHargaOnline} onChange={setFormHargaOnline} />
                </div>
              </FormRow>
            )}

            <FormRow label="Lacak Inventori" desc="Jika anda mengaktifkan lacak inventori, sistem akan mengecek ketersediaan stok barang sebelum menjual ke pembeli">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="pi-switch">
                  <input type="checkbox" checked={formLacakInventori} onChange={(e) => setFormLacakInventori(e.target.checked)} />
                  <span className="pi-slider">
                    <span className="pi-slider-text">{formLacakInventori ? 'Ya' : 'Tidak'}</span>
                  </span>
                </label>
                <span style={{ fontSize: 12, color: '#64748b' }}>{formLacakInventori ? 'Ya' : 'Tidak'}</span>
              </div>
            </FormRow>

            <FormRow label="Rack">
              <input type="text" placeholder="Masukkan Rack" value={formRack} onChange={(e) => setFormRack(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
            </FormRow>

            {formLacakInventori && (
              <FormRow label="Jumlah stok yang tersedia saat ini" desc="Sistem akan mengecek ketersediaan stok barang sebelum menjual ke pembeli. Jika produk memiliki varian, sistem mengecek stok per varian.">
                <input type="number" value={formQtyStok} onChange={(e) => setFormQtyStok(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
              </FormRow>
            )}

            <FormRow label="Peringatan Sisa Stok" desc="Jika stok sudah mencapai batas, maka sistem akan memberi peringatan sebelum stok habis.">
              <input type="number" value={formStokMinimum} onChange={(e) => setFormStokMinimum(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
            </FormRow>

            <FormRow label="Qty Fast Moving">
              <input type="number" value={formQtyFastMoving} onChange={(e) => setFormQtyFastMoving(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
            </FormRow>

            <FormRow label="Salin Variant" desc="Salin variant dari produk asli">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="pi-switch">
                  <input type="checkbox" checked={copyVariant} onChange={(e) => setCopyVariant(e.target.checked)} />
                  <span className="pi-slider">
                    <span className="pi-slider-text">{copyVariant ? 'Ya' : 'Tidak'}</span>
                  </span>
                </label>
                <span style={{ fontSize: 12, color: '#64748b' }}>{copyVariant ? 'Ya' : 'Tidak'}</span>
              </div>
            </FormRow>

            <FormRow label="Salin Tingkatan Harga" desc="Salin tingkatan harga dari produk asli">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="pi-switch">
                  <input type="checkbox" checked={copyTiers} onChange={(e) => setCopyTiers(e.target.checked)} />
                  <span className="pi-slider">
                    <span className="pi-slider-text">{copyTiers ? 'Ya' : 'Tidak'}</span>
                  </span>
                </label>
                <span style={{ fontSize: 12, color: '#64748b' }}>{copyTiers ? 'Ya' : 'Tidak'}</span>
              </div>
            </FormRow>

            <FormRow label="Salin Bahan/Resep" desc="Salin Bahan/Resep dari produk asli">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label className="pi-switch">
                  <input type="checkbox" checked={copyBom} onChange={(e) => setCopyBom(e.target.checked)} />
                  <span className="pi-slider">
                    <span className="pi-slider-text">{copyBom ? 'Ya' : 'Tidak'}</span>
                  </span>
                </label>
                <span style={{ fontSize: 12, color: '#64748b' }}>{copyBom ? 'Ya' : 'Tidak'}</span>
              </div>
            </FormRow>

            <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1e293b', fontWeight: 600 }}>
              <span>Informasi Detail (opsional)</span>
              <button
                type="button"
                onClick={() => setShowDetailOptional(!showDetailOptional)}
                style={{ background: '#f1f5f9', border: 0, borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                {showDetailOptional ? (
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>-</span>
                ) : (
                  <Plus size={16} />
                )}
              </button>
            </div>

            {showDetailOptional && (
              <div style={{ padding: '0 18px 18px 18px', borderTop: '1px solid #f1f5f9' }}>
                <FormRow label="SKU" desc="SKU (Stock Keeping Unit) atau Barcode dapat dipergunakan untuk pencarian produk">
                  <input type="text" placeholder="Masukkan SKU" value={formSku} onChange={(e) => setFormSku(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
                </FormRow>

                <FormRow label="Barcode" desc="Barcode untuk produk Anda">
                  <input type="text" placeholder="Masukkan Barcode" value={formBarcode} onChange={(e) => setFormBarcode(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
                </FormRow>

                 <FormRow label="Koleksi" desc="Nama koleksi produk, e.g. Koleksi Hari Raya, dll.">
                  <select value={formKoleksi ? String(formKoleksi) : ''} onChange={(e) => setFormKoleksi(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: '#fff' }}>
                    <option value="">Pilih salah satu</option>
                    {collections.map((col) => (
                      <option key={col.id} value={String(col.id)}>{col.nama}</option>
                    ))}
                  </select>
                </FormRow>

                <FormRow label="Brand" desc="Pilih dari yang ada atau tambahkan yang baru">
                  <select value={formBrand ? String(formBrand) : ''} onChange={(e) => setFormBrand(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, background: '#fff' }}>
                    <option value="">Pilih salah satu</option>
                    {localBrands.map((b) => (
                      <option key={b.id} value={String(b.id)}>{b.nama}</option>
                    ))}
                  </select>
                </FormRow>

                <FormRow label="Kondisi" desc="Pilih salah satu">
                  <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                    {['Tidak ada', 'Baru', 'Pembaharuan', 'Bekas'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormKondisi(opt)}
                        style={{
                          padding: '8px 16px',
                          fontSize: 13,
                          fontWeight: formKondisi === opt ? 700 : 500,
                          background: formKondisi === opt ? '#f1f5f9' : '#fff',
                          color: '#1e293b',
                          border: 0,
                          borderRight: opt !== 'Bekas' ? '1px solid #cbd5e1' : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </FormRow>

                <FormRow label="Deskripsi Produk">
                  <textarea value={formDeskripsi} onChange={(e) => setFormDeskripsi(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, minHeight: 80 }} />
                </FormRow>

                <FormRow label="Catatan">
                  <textarea placeholder="Masukkan Catatan" value={formCatatan} onChange={(e) => setFormCatatan(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, minHeight: 80 }} />
                </FormRow>

                {/* Harga Produk */}
                <div style={{ padding: '14px 0 8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  Harga Produk
                </div>
                <FormRow label="Harga jual di toko bersifat dinamis" desc="Kasir bisa mengubah harga jual">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formHargaDinamis} onChange={(e) => setFormHargaDinamis(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formHargaDinamis ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formHargaDinamis ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>

                {/* Pemesanan */}
                <div style={{ padding: '14px 0 8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  Pemesanan
                </div>

                {/* Inventori */}
                <div style={{ padding: '14px 0 8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  Inventori
                </div>
                <FormRow label="Unit Pengukuran">
                  <input type="text" value={formSatuan} onChange={(e) => setFormSatuan(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
                </FormRow>
                <FormRow label="Stok kosong" desc="Aktifkan jika stok produk sedang kosong">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formStokKosong} onChange={(e) => setFormStokKosong(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formStokKosong ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formStokKosong ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>

                {/* Pengiriman */}
                <div style={{ padding: '14px 0 8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  Pengiriman
                </div>
                <FormRow label="Butuh Pengiriman" desc="Jika pengiriman dibutuhkan, pastikan daftar harga pengiriman telah diisi dengan benar di bagian menu &quot;Pengaturan > Pengiriman&quot;">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formButuhPengiriman} onChange={(e) => setFormButuhPengiriman(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formButuhPengiriman ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formButuhPengiriman ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>
                <FormRow label="Berat Produk" desc="Berat produk dalam kilogram (kg). Gunakan titik &quot;.&quot; untuk desimal">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <input type="text" value={formBerat} onChange={(e) => setFormBerat(e.target.value)} style={{ flex: 1, border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>kg</span>
                  </div>
                </FormRow>

                {/* Informasi Tambahan */}
                <div style={{ padding: '14px 0 8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  Informasi Tambahan
                </div>
                <FormRow label="Harga produk sudah termasuk pajak" desc="Aktifkan jika produk bebas pajak">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formBebasPajak} onChange={(e) => setFormBebasPajak(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formBebasPajak ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formBebasPajak ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>
                <FormRow label="Produk tidak dikenakan biaya layanan">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formBebasBiayaLayanan} onChange={(e) => setFormBebasBiayaLayanan(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formBebasBiayaLayanan ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formBebasBiayaLayanan ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>
                <FormRow label="Siap publikasikan untuk dijual" desc="Ketika produk anda dipublikasikan untuk dijual, maka pembeli bisa membeli lewat toko online atau POS (Point of Sale), sesuai dengan tanggal mulai dijual/diaktifkan">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formTersediaOnline} onChange={(e) => setFormTersediaOnline(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formTersediaOnline ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formTersediaOnline ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>
                <FormRow label="Tanggal mulai jual">
                  <input type="date" value={formTanggalTersediaOnline} onChange={(e) => setFormTanggalTersediaOnline(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
                </FormRow>
                <FormRow label="Tidak muncul di Point Of Sale" desc="Dengan tidak memunculkan di Point Of Sale, anda tidak akan melihat dan tidak akan bisa menjual produk ini">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="pi-switch">
                      <input type="checkbox" checked={formTidakTersediaOfflinePos} onChange={(e) => setFormTidakTersediaOfflinePos(e.target.checked)} />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{formTidakTersediaOfflinePos ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{formTidakTersediaOfflinePos ? 'Ya' : 'Tidak'}</span>
                  </div>
                </FormRow>

                {/* SEO */}
                <div style={{ padding: '14px 0 8px 0', borderBottom: '1px solid #e2e8f0', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  SEO (Search Engine Optimization)
                </div>
                <FormRow label="Meta Keywords" desc="Kata-kata kunci/hashtags yang sesuai dengan produk Anda. Buatlah 10-15 kata kunci/hashtags yang mewakili produk ini. Tekan &quot;Enter&quot; untuk mengakhiri sebuah kata atau kombinasi kata">
                  <input type="text" value={formMetaKeywords} onChange={(e) => setFormMetaKeywords(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13 }} />
                </FormRow>
                <FormRow label="Meta Description" desc="Paragraf pendek yang menjelaskan produk Anda. Meta description akan muncul di halaman hasil pencarian search engine (google/bing), sehingga sangat penting untuk menulis penjelasan singkat yang menarik.">
                  <textarea value={formMetaDescription} onChange={(e) => setFormMetaDescription(e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, minHeight: 60 }} />
                </FormRow>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <style>{`
        /* Hover styles for interactive elements in ProductDetailPage */
        .detail-btn-primary {
          transition: background-color 0.15s, transform 0.1s;
        }
        .detail-btn-primary:hover {
          background-color: #025887 !important;
        }
        .detail-btn-primary:active {
          transform: scale(0.97);
        }

        .detail-btn-success {
          transition: background-color 0.15s, transform 0.1s;
        }
        .detail-btn-success:hover {
          background-color: #5d9430 !important;
        }
        .detail-btn-success:active {
          transform: scale(0.97);
        }

        .detail-btn-secondary {
          transition: background-color 0.15s, border-color 0.15s, transform 0.1s;
        }
        .detail-btn-secondary:hover {
          background-color: #f8fafc !important;
          border-color: #cbd5e1 !important;
        }
        .detail-btn-secondary:active {
          transform: scale(0.97);
        }

        .detail-btn-back {
          transition: background-color 0.15s, transform 0.1s;
        }
        .detail-btn-back:hover {
          background-color: #e2e8f0 !important;
        }
        .detail-btn-back:active {
          transform: scale(0.97);
        }

        .detail-tab-btn {
          transition: color 0.15s, border-bottom-color 0.15s;
        }
        .detail-tab-btn:hover {
          color: #026da7 !important;
        }
        
        /* General button / link / clickable elements in tabs */
        button:not([disabled]):hover,
        .pi-btn:not([disabled]):hover {
          opacity: 0.9;
        }
        
        /* Make sure all eye icons / custom action spans have hover feedback */
        span[style*="cursor: pointer"]:hover,
        span[style*="cursor:pointer"]:hover {
          opacity: 0.8;
          color: #026da7 !important;
        }
      `}</style>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        background: '#f8fafc',
        paddingTop: 12,
        paddingBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        marginBottom: 24,
        borderBottom: '1px solid #e2e8f0'
      }}>
        <button
          type="button"
          onClick={onBack}
          className="detail-btn-back"
          style={{
            background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer',
            fontSize: 13, fontWeight: 700, color: '#026da7', padding: '8px 16px',
          }}
        >
          Kembali
        </button>
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="detail-tab-btn"
            style={{
              background: 'none',
              border: 0,
              borderBottom: activeTab === tab.id ? '2px solid #026da7' : '2px solid transparent',
              color: activeTab === tab.id ? '#026da7' : '#0f172a',
              fontWeight: 700,
              fontSize: 13,
              padding: '8px 0',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'variant' ? (
        <ProductVariantTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab === 'bahan-resep' ? (
        <ProductBahanResepTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab === 'tingkatan-harga' ? (
        <ProductTingkatanHargaTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab === 'terkait' ? (
        <ProductTerkaitTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab === 'seri' ? (
        <ProductSeriTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab === 'spesifikasi' ? (
        <ProductSpesifikasiTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab === 'satuan' ? (
        <ProductSatuanTab
          product={product}
          onUpdated={onUpdated}
          storeName={storeName}
        />
      ) : activeTab !== 'profil' ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
          Tab ini belum tersedia.
        </div>
      ) : (
        <>
          <Section
            title="Info Umum"
            headerRight={
              editingSection === 'info_umum' ? (
                <SaveCancelHeader storeName={storeName} onCancel={cancelEdit} onSave={saveInfoUmum} saving={savingSection} />
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <EditButton onClick={startEditInfoUmum} />
                  <button
                    type="button"
                    onClick={startCopyProduct}
                    className="detail-btn-secondary"
                    style={{ background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, padding: '7px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Salin
                  </button>
                </div>
              )
            }
          >
            {editingSection === 'info_umum' ? (
              <>
                <FormRow label="Foto" desc="Rekomendasi: 3-5 Gambar Produk. Gunakan 5 foto terbaik untuk produk ini. (Format: JPG, JPEG, PNG, WEBP, max 1 MB)">
                  <label className="pi-upload-square" style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {photoPreviewUrl ? (
                      <img src={photoPreviewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Plus size={24} />
                    )}
                    <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </label>
                </FormRow>
                <FormRow label="Nama Produk" desc="Tulis nama produk sesuai jenis, merek, dan rincian produk">
                  <input type="text" value={formNama} onChange={(e) => setFormNama(e.target.value)} />
                </FormRow>
                <FormRow label="Nama Produk Alternatif" desc="Tulis alternatif nama produk dalam bahasa Mandarin / Latin">
                  <input type="text" value={formNamaAlt} onChange={(e) => setFormNamaAlt(e.target.value)} />
                </FormRow>
                <FormRow label="Grup" desc="Pilih dari yang ada atau tambahkan yang baru">
                  <select value={formKategori ? String(formKategori) : ''} onChange={(e) => setFormKategori(e.target.value)}>
                    <option value="">Pilih salah satu</option>
                    {localCategories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>{cat.nama}</option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Koleksi" desc="Nama koleksi produk, e.g. Koleksi Hari Raya, dll">
                  <select value={formKoleksi ? String(formKoleksi) : ''} onChange={(e) => setFormKoleksi(e.target.value)}>
                    <option value="">Pilih salah satu</option>
                    {collections.map((col) => (
                      <option key={col.id} value={String(col.id)}>{col.nama}</option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="Brand" desc="Pilih dari yang ada atau tambahkan yang baru">
                  <select value={formBrand ? String(formBrand) : ''} onChange={(e) => setFormBrand(e.target.value)}>
                    <option value="">Pilih salah satu</option>
                    {localBrands.map((b) => (
                      <option key={b.id} value={String(b.id)}>{b.nama}</option>
                    ))}
                  </select>
                </FormRow>
                <FormRow label="SKU" desc="SKU (Stock Keeping Unit) atau Barcode dapat dipergunakan untuk pencarian produk">
                  <input type="text" value={formSku} onChange={(e) => setFormSku(e.target.value)} />
                </FormRow>
                <FormRow label="Barcode" desc="Barcode untuk produk Anda">
                  <input type="text" value={formBarcode} onChange={(e) => setFormBarcode(e.target.value)} />
                </FormRow>
                <FormRow label="Kondisi">
                  <select value={formKondisi} onChange={(e) => setFormKondisi(e.target.value)}>
                    <option value="Baru">Baru</option>
                    <option value="Bekas">Bekas</option>
                  </select>
                </FormRow>
                <FormRow label="Product bebas pajak" desc="Aktifkan jika produk bebas pajak">
                  <label className="pi-switch">
                    <input type="checkbox" checked={formBebasPajak} onChange={(e) => setFormBebasPajak(e.target.checked)} />
                    <span className="pi-slider">
                      <span className="pi-slider-text">{formBebasPajak ? 'Ya' : 'Tidak'}</span>
                    </span>
                  </label>
                </FormRow>
                <FormRow label="Produk tidak dikenakan biaya layanan">
                  <label className="pi-switch">
                    <input type="checkbox" checked={formBebasBiayaLayanan} onChange={(e) => setFormBebasBiayaLayanan(e.target.checked)} />
                    <span className="pi-slider">
                      <span className="pi-slider-text">{formBebasBiayaLayanan ? 'Ya' : 'Tidak'}</span>
                    </span>
                  </label>
                </FormRow>
              </>
            ) : (
              <>
                <Row label="Nama Produk" value={product.nama} />
                <Row label="Nama Produk Alternatif" value={product.nama_alternatif} />
                <Row label="Klasifikasi" value={product.klasifikasi} />
                <Row label="Produk Grup" value={product.kategori_nama} />
                <Row label="Koleksi" value={product.koleksi_nama} />
                <Row label="SKU" value={product.sku} />
                <Row label="Barcode" value={product.barcode} />
                <Row label="Brand" value={product.brand_nama} />
              </>
            )}
          </Section>

          <Section
            title="Harga"
            headerRight={
              editingSection === 'harga' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveHarga}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditHarga} />
              )
            }
          >
            {editingSection === 'harga' ? (
              <>
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Harga jual di toko bersifat dinamis</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="pi-switch">
                      <input
                        type="checkbox"
                        checked={hargaDinamisEdit}
                        onChange={(e) => setHargaDinamisEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{hargaDinamisEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      {hargaDinamisEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px 0' }}>
                  {/* Card 1: Harga Pasar */}
                  {hasVariant ? (
                    <ReferVarianCard label="Harga Pasar" aggregate={formatIDRCurrency(firstVariant.harga_pasar)} />
                  ) : (
                    <PlainCard label="Harga Pasar" value={formatIDRCurrency(product.harga_pasar)} />
                  )}

                  {/* Card 2: Harga Beli */}
                  {hasVariant ? (
                    <ReferVarianCard
                      label="Harga Beli"
                      aggregate={formatIDRCurrency(firstVariant.harga_beli)}
                      showEye={true}
                      onEyeClick={() => setShowStockInModal(true)}
                    />
                  ) : (
                    <PlainCard
                      label="Harga Beli"
                      value={formatIDRCurrency(product.harga_beli)}
                      showEye={true}
                      onEyeClick={() => setShowStockInModal(true)}
                    />
                  )}

                  {/* Card 3: Harga Jual Online */}
                  {hasVariant ? (
                    <ReferVarianCard label="Harga Jual Online" aggregate={formatIDRCurrency(firstVariant.harga_jual_online)} />
                  ) : (
                    <PlainCard label="Harga Jual Online" value={formatIDRCurrency(product.harga_jual_online)} />
                  )}

                  {/* Card 4: Harga Jual di Toko */}
                  {hasVariant ? (
                    <ReferVarianCard label="Harga Jual di Toko" aggregate={formatIDRCurrency(firstVariant.harga_jual_toko)} />
                  ) : (
                    <PlainCard label="Harga Jual di Toko" value={formatIDRCurrency(product.harga_jual_toko)} />
                  )}

                  {/* Card 5: Komisi */}
                  {hasVariant ? (
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 90 }}>
                      <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Komisi</div>
                      <div style={{ background: '#eff6ff', color: '#0284c7', fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid #bfdbfe', fontWeight: 600, textAlign: 'center' }}>
                        Refer Ke varian
                      </div>
                      {/* IDR vs % Button Group */}
                      <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                        <button
                          type="button"
                          disabled
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: (firstVariant.komisi_tipe || 'nominal') === 'nominal' ? 700 : 500,
                            background: (firstVariant.komisi_tipe || 'nominal') === 'nominal' ? '#3b82f6' : '#fff',
                            color: (firstVariant.komisi_tipe || 'nominal') === 'nominal' ? '#fff' : '#64748b',
                            border: 0,
                            borderRight: '1px solid #cbd5e1',
                          }}
                        >
                          IDR
                        </button>
                        <button
                          type="button"
                          disabled
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: (firstVariant.komisi_tipe || 'nominal') === 'persen' ? 700 : 500,
                            background: (firstVariant.komisi_tipe || 'nominal') === 'persen' ? '#3b82f6' : '#fff',
                            color: (firstVariant.komisi_tipe || 'nominal') === 'persen' ? '#fff' : '#64748b',
                            border: 0,
                          }}
                        >
                          %
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 90 }}>
                      <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Komisi</div>
                      {/* IDR vs % Button Group */}
                      <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: 6, overflow: 'hidden', width: 'fit-content' }}>
                        <button
                          type="button"
                          onClick={() => setKomisiTipeEdit('nominal')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: komisiTipeEdit === 'nominal' ? 700 : 500,
                            background: komisiTipeEdit === 'nominal' ? '#3b82f6' : '#fff',
                            color: komisiTipeEdit === 'nominal' ? '#fff' : '#64748b',
                            border: 0,
                            cursor: 'pointer',
                            borderRight: '1px solid #cbd5e1',
                          }}
                        >
                          IDR
                        </button>
                        <button
                          type="button"
                          onClick={() => setKomisiTipeEdit('persen')}
                          style={{
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: komisiTipeEdit === 'persen' ? 700 : 500,
                            background: komisiTipeEdit === 'persen' ? '#3b82f6' : '#fff',
                            color: komisiTipeEdit === 'persen' ? '#fff' : '#64748b',
                            border: 0,
                            cursor: 'pointer',
                          }}
                        >
                          %
                        </button>
                      </div>
                      <div style={{ background: '#e2e8f0', color: '#475569', fontSize: 13, fontWeight: 500, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', width: '100%', minHeight: '30px', display: 'flex', alignItems: 'center' }}>
                        {formatIDRCurrency(product.komisi || 0).replace('IDR ', '')}
                      </div>
                    </div>
                  )}

                  {/* Card 6: Minimal Pesanan */}
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 90 }}>
                    <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Minimal Pesanan</div>
                    <input
                      type="number"
                      value={minimalPesananEdit}
                      onChange={(e) => setMinimalPesananEdit(e.target.value)}
                      style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontWeight: 500, color: '#334155', width: '100%', background: '#fff', outline: 'none' }}
                    />
                  </div>

                  {/* Card 7: Maksimal Pesanan */}
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 90 }}>
                    <div style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Maksimal Pesanan</div>
                    <input
                      type="number"
                      value={maksimalPesananEdit}
                      onChange={(e) => setMaksimalPesananEdit(e.target.value)}
                      style={{ border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontWeight: 500, color: '#334155', width: '100%', background: '#fff', outline: 'none' }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Harga jual di toko bersifat dinamis</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.harga_dinamis)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '14px 0' }}>
                  {hasVariant ? (
                    <>
                      <ReferVarianCard label="Harga Pasar" aggregate={formatIDRCurrency(firstVariant.harga_pasar)} />
                      <ReferVarianCard
                        label="Harga Beli"
                        aggregate={formatIDRCurrency(firstVariant.harga_beli)}
                        showEye={true}
                        onEyeClick={() => setShowStockInModal(true)}
                      />
                      <ReferVarianCard label="Harga Jual Online" aggregate={formatIDRCurrency(firstVariant.harga_jual_online)} />
                      <ReferVarianCard label="Harga Jual di Toko" aggregate={formatIDRCurrency(firstVariant.harga_jual_toko)} />
                      <ReferVarianCard label="Komisi" aggregate={(firstVariant.komisi_tipe || 'nominal') === 'persen' ? `${firstVariant.komisi || 0}%` : formatIDRCurrency(firstVariant.komisi || 0)} />
                      <PlainCard label="Minimal Pesanan" value={product.minimal_pesanan} />
                      <PlainCard label="Maksimal Pesanan" value={product.maksimal_pesanan || 'Tidak dibatasi'} />
                    </>
                  ) : (
                    <>
                      <PlainCard label="Harga Pasar" value={formatIDRCurrency(product.harga_pasar)} />
                      <PlainCard
                        label="Harga Beli"
                        value={formatIDRCurrency(product.harga_beli)}
                        showEye={true}
                        onEyeClick={() => setShowStockInModal(true)}
                      />
                      <PlainCard label="Harga Jual Online" value={formatIDRCurrency(product.harga_jual_online)} />
                      <PlainCard label="Harga Jual di Toko" value={formatIDRCurrency(product.harga_jual_toko)} />
                      <PlainCard label="Komisi" value={product.komisi_tipe === 'persen' ? `${product.komisi || 0}%` : formatIDRCurrency(product.komisi || 0)} />
                      <PlainCard label="Minimal Pesanan" value={product.minimal_pesanan} />
                      <PlainCard label="Maksimal Pesanan" value={product.maksimal_pesanan || 'Tidak dibatasi'} />
                    </>
                  )}
                </div>
              </>
            )}
          </Section>

          <Section
            title="Inventori"
            headerRight={
              editingSection === 'inventori' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveInventori}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditInventori} />
              )
            }
          >
            {editingSection === 'inventori' ? (
              <>
                {/* Lacak Inventori */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Lacak Inventori</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="pi-switch">
                      <input
                        type="checkbox"
                        checked={lacakInventoriEdit}
                        onChange={(e) => setLacakInventoriEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{lacakInventoriEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      {lacakInventoriEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* On hold qty */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>On hold qty</div>
                  {hasVariant ? (
                    <InfoBox text="Refer Ke varian" />
                  ) : (
                    <InfoBox text={String(product.on_hold_qty || 0)} />
                  )}
                </div>

                {/* Peringatan jika stock sisa */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Peringatan jika stock sisa</div>
                  <input
                    type="number"
                    value={stokMinimumEdit}
                    onChange={(e) => setStokMinimumEdit(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: '#334155',
                      boxSizing: 'border-box',
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>

                {/* Qty Fast Moving */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Qty Fast Moving</div>
                  {hasVariant ? (
                    <InfoBox text="Refer Ke varian" />
                  ) : (
                    <InfoBox text={String(product.qty_fast_moving || 0)} />
                  )}
                </div>

                {/* Unit Pengukuran */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Unit Pengukuran</div>
                  <select
                    value={satuanEdit}
                    onChange={(e) => setSatuanEdit(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: '#334155',
                      boxSizing: 'border-box',
                      outline: 'none',
                      background: '#fff'
                    }}
                  >
                    <option value="pcs">pcs</option>
                    <option value="box">box</option>
                    <option value="pack">pack</option>
                    <option value="kg">kg</option>
                    <option value="meter">meter</option>
                    <option value="lembar">lembar</option>
                  </select>
                </div>

                {/* Stok kosong */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Stok kosong</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="pi-switch">
                      <input
                        type="checkbox"
                        checked={stokKosongEdit}
                        onChange={(e) => setStokKosongEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{stokKosongEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      {stokKosongEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Lacak Inventori */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Lacak Inventori</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.lacak_inventori)}</div>
                </div>

                {/* On hold qty */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>On hold qty</div>
                  {hasVariant ? (
                    <InfoBox text="Refer Ke varian" />
                  ) : (
                    <InfoBox text={String(product.on_hold_qty || 0)} />
                  )}
                </div>

                {/* Peringatan jika stock sisa */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Peringatan jika stock sisa</div>
                  <InfoBox text={String(product.stok_minimum || 5)} />
                </div>

                {/* Qty Stok */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Qty Stok</div>
                  {hasVariant ? (
                    <InfoBox text="Refer Ke varian" />
                  ) : (
                    <InfoBox text={String(product.qty_stok || 0)} />
                  )}
                </div>

                {/* Qty Fast Moving */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Qty Fast Moving</div>
                  {hasVariant ? (
                    <InfoBox text="Refer Ke varian" />
                  ) : (
                    <InfoBox text={String(product.qty_fast_moving || 0)} />
                  )}
                </div>

                {/* Unit Pengukuran */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Unit Pengukuran</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{product.satuan || 'pcs'}</div>
                </div>

                {/* Stok kosong */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Stok kosong</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(stokKosong)}</div>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Pengiriman"
            headerRight={
              editingSection === 'pengiriman' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={savePengiriman}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditPengiriman} />
              )
            }
          >
            {editingSection === 'pengiriman' ? (
              <>
                {/* Butuh Pengiriman */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Butuh Pengiriman</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="pi-switch">
                      <input
                        type="checkbox"
                        checked={butuhPengirimanEdit}
                        onChange={(e) => setButuhPengirimanEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{butuhPengirimanEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      {butuhPengirimanEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* Berat Produk */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Berat Produk</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setBeratEdit(prev => Math.max(0, parseFloat((parseFloat(prev) - 0.1).toFixed(4))))}
                      style={{
                        width: 36,
                        height: 36,
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px 0 0 6px',
                        background: '#f8fafc',
                        fontSize: 18,
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none'
                      }}
                    >
                      -
                    </button>
                    <input
                      type="text"
                      value={beratEdit}
                      onChange={(e) => setBeratEdit(e.target.value)}
                      style={{
                        width: 80,
                        height: 36,
                        borderTop: '1px solid #cbd5e1',
                        borderBottom: '1px solid #cbd5e1',
                        borderLeft: 'none',
                        borderRight: 'none',
                        textAlign: 'center',
                        fontSize: 13,
                        color: '#334155',
                        outline: 'none',
                        background: '#fff'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setBeratEdit(prev => parseFloat((parseFloat(prev) + 0.1).toFixed(4)))}
                      style={{
                        width: 36,
                        height: 36,
                        border: '1px solid #cbd5e1',
                        borderRadius: '0 6px 6px 0',
                        background: '#f8fafc',
                        fontSize: 18,
                        color: '#64748b',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        outline: 'none'
                      }}
                    >
                      +
                    </button>
                    <span style={{ fontSize: 13, color: '#475569', marginLeft: 12 }}>Kg</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Butuh Pengiriman */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Butuh Pengiriman</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.butuh_pengiriman)}</div>
                </div>

                {/* Berat Produk */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Berat Produk</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{product.berat ? `${product.berat} kg` : '-'}</div>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Penjualan"
            headerRight={
              editingSection === 'penjualan' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={savePenjualan}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditPenjualan} />
              )
            }
          >
            {editingSection === 'penjualan' ? (
              <>
                {/* Pesanan disertai pengisian No Seri. */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Pesanan disertai pengisian No Seri.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="pi-switch">
                      <input
                        type="checkbox"
                        checked={pesananNoSeriEdit}
                        onChange={(e) => setPesananNoSeriEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{pesananNoSeriEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                      {pesananNoSeriEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Pesanan disertai pengisian No Seri. */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Pesanan disertai pengisian No Seri.</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.pesanan_no_seri)}</div>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Kategori Tambahan"
            headerRight={
              editingSection === 'kategori_tambahan' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveKategoriTambahan}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditKategoriTambahan} />
              )
            }
          >
            {editingSection === 'kategori_tambahan' ? (
              <>
                {/* Unggulan */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Kategorikan sebagai Unggulan</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label className="pi-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={kategoriUnggulanEdit}
                        onChange={(e) => setKategoriUnggulanEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{kategoriUnggulanEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kategoriUnggulanEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* Sale */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Kategorikan sebagai Sale</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label className="pi-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={kategoriSaleEdit}
                        onChange={(e) => setKategoriSaleEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{kategoriSaleEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kategoriSaleEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* Pre-order */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Kategorikan sebagai Pre-order</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label className="pi-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={kategoriPreorderEdit}
                        onChange={(e) => setKategoriPreorderEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{kategoriPreorderEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kategoriPreorderEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* Rilis terbaru */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Kategorikan sebagai Rilis terbaru</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label className="pi-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={kategoriRilisTerbaruEdit}
                        onChange={(e) => setKategoriRilisTerbaruEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{kategoriRilisTerbaruEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kategoriRilisTerbaruEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* Populer */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Kategorikan sebagai Populer</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label className="pi-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={kategoriPopulerEdit}
                        onChange={(e) => setKategoriPopulerEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{kategoriPopulerEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kategoriPopulerEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>

                {/* Bahan Mentah */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Kategorikan sebagai Bahan Mentah</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                    <label className="pi-switch" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={kategoriBahanMentahEdit}
                        onChange={(e) => setKategoriBahanMentahEdit(e.target.checked)}
                      />
                      <span className="pi-slider">
                        <span className="pi-slider-text">{kategoriBahanMentahEdit ? 'Ya' : 'Tidak'}</span>
                      </span>
                    </label>
                    <span style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>
                      {kategoriBahanMentahEdit ? 'Ya' : 'Tidak'}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Kategorikan sebagai Unggulan</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.kategori_unggulan)}</div>
                </div>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Kategorikan sebagai Sale</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.kategori_sale)}</div>
                </div>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Kategorikan sebagai Pre-order</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.kategori_preorder)}</div>
                </div>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Kategorikan sebagai Rilis terbaru</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.kategori_rilis_terbaru)}</div>
                </div>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Kategorikan sebagai Populer</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.kategori_populer)}</div>
                </div>
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Kategorikan sebagai Bahan Mentah</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{yaTidak(product.kategori_bahan_mentah)}</div>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Deskripsi"
            headerRight={
              editingSection === 'deskripsi' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveDeskripsi}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditDeskripsi} />
              )
            }
          >
            {editingSection === 'deskripsi' ? (
              <div style={{ padding: '8px 0 14px 0' }}>
                <textarea
                  value={deskripsiEdit}
                  onChange={(e) => setDeskripsiEdit(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: '#334155',
                    boxSizing: 'border-box',
                    outline: 'none',
                    background: '#fff',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            ) : (
              <div style={{ padding: '8px 0 14px 0', fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {product.deskripsi || '-'}
              </div>
            )}
          </Section>

          <Section
            title="SEO (Search Engine Optimization)"
            headerRight={
              editingSection === 'seo' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveSEO}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditSEO} />
              )
            }
          >
            {editingSection === 'seo' ? (
              <>
                {/* Meta Keywords */}
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Meta Keywords</div>
                  <input
                    type="text"
                    value={metaKeywordsEdit}
                    onChange={(e) => setMetaKeywordsEdit(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '0 12px',
                      fontSize: 13,
                      color: '#334155',
                      boxSizing: 'border-box',
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>

                {/* Meta Description */}
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Meta Description</div>
                  <textarea
                    value={metaDescriptionEdit}
                    onChange={(e) => setMetaDescriptionEdit(e.target.value)}
                    style={{
                      width: '100%',
                      height: 60,
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13,
                      color: '#334155',
                      boxSizing: 'border-box',
                      outline: 'none',
                      background: '#fff',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Meta Keywords</div>
                  <div style={{ fontSize: 13, color: '#1e293b' }}>{product.meta_keywords || '-'}</div>
                </div>
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Meta Description</div>
                  <div style={{ fontSize: 13, color: '#1e293b' }}>{product.meta_description || '-'}</div>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Ketersediaan"
            headerRight={
              editingSection === 'ketersediaan' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveKetersediaan}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditKetersediaan} />
              )
            }
          >
            {editingSection === 'ketersediaan' ? (
              <>
                {/* Tersedia Online */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0 10px 0' }}>
                  <input
                    type="checkbox"
                    checked={tersediaOnlineEdit}
                    onChange={(e) => setTersediaOnlineEdit(e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Tersedia Online</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Produk ini tersedia di kanal Online seperti Toko Online dan Online Order
                    </div>
                  </div>
                </div>

                {/* Tanggal Tersedia Online */}
                <div style={{ padding: '8px 0 10px 0', marginLeft: 26 }}>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>Tanggal tersedia Online</div>
                  <input
                    type="date"
                    value={tanggalTersediaOnlineEdit}
                    onChange={(e) => setTanggalTersediaOnlineEdit(e.target.value)}
                    style={{
                      width: 220,
                      height: 38,
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '0 12px',
                      fontSize: 13,
                      color: '#334155',
                      boxSizing: 'border-box',
                      outline: 'none',
                      background: '#fff'
                    }}
                  />
                </div>

                {/* Tidak tersedia Offline (di POS) */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0 14px 0' }}>
                  <input
                    type="checkbox"
                    checked={tidakTersediaOfflinePosEdit}
                    onChange={(e) => setTidakTersediaOfflinePosEdit(e.target.checked)}
                    style={{ width: 16, height: 16, marginTop: 2, cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Tidak tersedia Offline (di POS)</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      Produk ini tidak tersedia di kasir Point Of Sale toko Anda
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Tersedia Online</div>
                  <div style={{ fontSize: 13, color: '#1e293b' }}>{yaTidak(product.tersedia_online)}</div>
                </div>
                <div style={{ padding: '8px 0 10px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Tanggal tersedia Online</div>
                  <div style={{ fontSize: 13, color: '#1e293b' }}>{formatTanggal(product.tanggal_tersedia_online)}</div>
                </div>
                <div style={{ padding: '8px 0 14px 0' }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Tidak tersedia Offline (di POS)</div>
                  <div style={{ fontSize: 13, color: '#1e293b' }}>{yaTidak(product.tidak_tersedia_offline_pos)}</div>
                </div>
              </>
            )}
          </Section>

          <Section
            title="Catatan"
            headerRight={
              editingSection === 'catatan' ? (
                <SaveCancelHeader
                  storeName={storeName}
                  onCancel={cancelEdit}
                  onSave={saveCatatan}
                  saving={savingSection}
                />
              ) : (
                <EditButton onClick={startEditCatatan} />
              )
            }
          >
            {editingSection === 'catatan' ? (
              <div style={{ padding: '8px 0 14px 0' }}>
                <textarea
                  value={catatanEdit}
                  onChange={(e) => setCatatanEdit(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: '#334155',
                    boxSizing: 'border-box',
                    outline: 'none',
                    background: '#fff',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            ) : (
              <div style={{ padding: '8px 0 14px 0' }}>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>Catatan tambahan untuk produk ini</div>
                <div style={{ fontSize: 13, color: '#1e293b' }}>
                  {product.catatan || '-'}
                </div>
              </div>
            )}
          </Section>

          {/* Hapus Produk Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, marginBottom: 16 }}>
            <button
              type="button"
              onClick={handleDeleteProduct}
              style={{
                background: '#f87171',
                color: '#fff',
                border: 0,
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 2px 4px rgba(248, 113, 113, 0.2)',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f87171';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Hapus Produk
            </button>
          </div>
        </>
      )}

      {/* Stok Masuk Popup Modal */}
      {showStockInModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '20px',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
            }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Stok Masuk</span>
              <button
                type="button"
                onClick={() => setShowStockInModal(false)}
                style={{
                  border: 0,
                  background: 'transparent',
                  fontSize: '22px',
                  lineHeight: 1,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: '4px',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Filters */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              background: '#f8fafc',
              gap: '16px',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={stockInRowsPerPage}
                  onChange={(e) => {
                    setStockInRowsPerPage(Number(e.target.value));
                    setStockInPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#334155',
                    background: '#fff',
                    outline: 'none',
                  }}
                >
                  <option value={10}>10 Baris</option>
                  <option value={25}>25 Baris</option>
                  <option value={50}>50 Baris</option>
                </select>
              </div>
              <div style={{ position: 'relative', width: '260px' }}>
                <input
                  type="text"
                  placeholder="Produk/SKU/Barcode/Supplier"
                  value={stockInSearch}
                  onChange={(e) => {
                    setStockInSearch(e.target.value);
                    setStockInPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Modal Body & Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#475569' }}>Stok Masuk</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#475569' }}>Waktu Pembuatan</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#475569' }}>Supplier</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#475569' }}>Variant</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Qty</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Harga Beli</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStockIn ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        Memuat data...
                      </td>
                    </tr>
                  ) : paginatedStockIn.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '50px 0', color: '#94a3b8', fontSize: '14px' }}>
                        No Data
                      </td>
                    </tr>
                  ) : (
                    paginatedStockIn.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600, color: '#0284c7' }}>{item.nomor}</td>
                        <td style={{ padding: '12px 8px' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleString('id-ID', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '-'}
                        </td>
                        <td style={{ padding: '12px 8px' }}>{item.supplier || '-'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          {item.variant_nama ? (
                            <span style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                              {item.variant_nama}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{item.qty}</td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(item.harga_beli)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer (Pagination) */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Total {totalItems}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  disabled={stockInPage <= 1}
                  onClick={() => setStockInPage(p => Math.max(1, p - 1))}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    background: stockInPage <= 1 ? '#f1f5f9' : '#fff',
                    cursor: stockInPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    color: '#475569',
                  }}
                >
                  &lt;
                </button>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                  {stockInPage}
                </span>
                <button
                  type="button"
                  disabled={stockInPage >= totalPages}
                  onClick={() => setStockInPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    background: stockInPage >= totalPages ? '#f1f5f9' : '#fff',
                    cursor: stockInPage >= totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    color: '#475569',
                  }}
                >
                  &gt;
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b' }}>
                <span>Go to</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={stockInPage}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val >= 1 && val <= totalPages) {
                      setStockInPage(val);
                    }
                  }}
                  style={{
                    width: '45px',
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#334155',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
