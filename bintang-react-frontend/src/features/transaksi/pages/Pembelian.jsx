import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, UploadCloud, Settings, ShoppingCart } from 'lucide-react';
import TransactionScaffold, { TButton } from '../components/TransactionScaffold';
import ImportPembelianModal from '../components/ImportPembelianModal';
import PembelianBaruModal from '../components/PembelianBaruModal';
import PembelianSettingsDrawer from '../components/PembelianSettingsDrawer';
import TambahReturModal from '../components/TambahReturModal';
import PembelianDetail from '../components/PembelianDetail';
import { getPembelianColumns, getReturColumns, getCancelColumns } from '../components/pembelianColumns';
import apiClient from '../../../api/apiClient';

export default function Pembelian() {
  const [view, setView] = useState('list');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRetur, setShowRetur] = useState(false);
  const [activeTab, setActiveTab] = useState('butuh-diproses');

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/purchases/');
      setPurchases(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases]);

  const handleSelectDoc = useCallback((id) => {
    setSelectedDocId(id);
    setView('detail');
  }, []);

  const handleCreateSave = async ({ supplier, tanggal, mataUang, catatan }) => {
    try {
      const res = await apiClient.post('/purchases/', {
        supplier,
        tanggal,
        mata_uang: mataUang === 'Rupiah' ? 'IDR' : mataUang,
        catatan,
      });
      setShowCreate(false);
      handleSelectDoc(res.data.id);
      fetchPurchases();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membuat pembelian baru.');
    }
  };

  const handleReturSave = async ({ purchaseId, tanggal, catatan }) => {
    try {
      const res = await apiClient.post(`/purchases/${purchaseId}/create-retur/`, { tanggal, catatan });
      setShowRetur(false);
      handleSelectDoc(res.data.id);
      fetchPurchases();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal membuat retur baru.');
    }
  };

  const handleImportProcess = async (files) => {
    if (!files?.length) return;
    try {
      const docRes = await apiClient.post('/purchases/', {
        tanggal: new Date().toISOString().slice(0, 10),
        catatan: 'Import CSV',
      });
      const docId = docRes.data.id;
      const fd = new FormData();
      fd.append('file', files[0]);
      await apiClient.post(`/purchases/${docId}/import-csv/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowImport(false);
      handleSelectDoc(docId);
      fetchPurchases();
    } catch (err) {
      alert(err.response?.data?.error || 'Gagal memproses import.');
    }
  };

  const columns = useMemo(() => getPembelianColumns(handleSelectDoc), [handleSelectDoc]);
  const returColumns = useMemo(() => getReturColumns(handleSelectDoc), [handleSelectDoc]);
  const cancelColumns = useMemo(() => getCancelColumns(handleSelectDoc), [handleSelectDoc]);

  const tabs = useMemo(() => [
    {
      id: 'butuh-diproses',
      label: 'Butuh Diproses',
      title: 'Pembelian Butuh Diproses',
      unit: 'Pembelian',
      variant: 'table',
      match: (row) => row.status === 'draft' && !row.is_retur,
    },
    {
      id: 'selesai',
      label: 'Telah Diproses',
      title: 'Pembelian Telah Diproses',
      unit: 'Pembelian',
      variant: 'table',
      match: (row) => row.status === 'selesai' && !row.is_retur,
    },
    {
      id: 'retur',
      label: 'Retur',
      title: 'Pembelian Dikembalikan',
      unit: 'Retur',
      variant: 'table',
      columns: returColumns,
      match: (row) => !!row.is_retur,
    },
    {
      id: 'dibatalkan',
      label: 'Dibatalkan',
      title: 'Pembelian Dibatalkan',
      heading: 'Pesanan Dibatalkan',
      unit: 'Pembelian',
      variant: 'table',
      rowsTop: true,
      columns: cancelColumns,
      match: (row) => row.status === 'batal' && !row.is_retur,
    },
  ], [returColumns, cancelColumns]);

  const actions = useMemo(() => {
    if (activeTab === 'butuh-diproses') {
      return (
        <>
          <TButton variant="primary" onClick={() => setShowImport(true)}>
            <UploadCloud size={16} /> Import
          </TButton>
          <TButton variant="success" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> Tambah
          </TButton>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            title="Pengaturan pembelian"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <Settings size={18} />
          </button>
        </>
      );
    }
    if (activeTab === 'retur') {
      return (
        <TButton variant="success" onClick={() => setShowRetur(true)}>
          <Plus size={16} /> Tambah
        </TButton>
      );
    }
    return null;
  }, [activeTab]);

  if (view === 'detail') {
    return (
      <PembelianDetail
        docId={selectedDocId}
        onBack={() => { setView('list'); setSelectedDocId(null); }}
        onSaved={fetchPurchases}
      />
    );
  }

  return (
    <>
      {loading ? (
        <div className="p-8 text-center text-xs font-bold text-slate-400">Memuat data pembelian...</div>
      ) : (
        <TransactionScaffold
          tabs={tabs}
          columns={columns}
          rows={purchases}
          statusOptions={['Semua']}
          searchPlaceholder="Cari Pesanan"
          emptyIcon={ShoppingCart}
          actions={actions}
          onTabChange={setActiveTab}
        />
      )}

      {showImport && <ImportPembelianModal onClose={() => setShowImport(false)} onProcess={handleImportProcess} />}
      {showCreate && <PembelianBaruModal onClose={() => setShowCreate(false)} onSave={handleCreateSave} />}
      {showSettings && <PembelianSettingsDrawer onClose={() => setShowSettings(false)} />}
      {showRetur && <TambahReturModal onClose={() => setShowRetur(false)} onSave={handleReturSave} />}
    </>
  );
}
