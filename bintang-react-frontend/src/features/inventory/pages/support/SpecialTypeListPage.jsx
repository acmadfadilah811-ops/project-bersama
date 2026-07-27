import { useEffect, useMemo, useState } from 'react';
import { Ban, Calendar, Compass, Droplet, Lightbulb, Plus, Search, Tag, Trash2, TrendingUp } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { fetchAllPages } from '../../../../utils/paginatedApi';
import { Button, PageHeader } from '../components/PageShell';

const ICONS = { lightbulb: Lightbulb, compass: Compass, tag: Tag, 'trending-up': TrendingUp, ban: Ban, calendar: Calendar, droplet: Droplet };
const list = (data) => Array.isArray(data) ? data : (data?.results || []);

export function SpecialTypeListPage() {
  const [types, setTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [nextTypes, nextProducts] = await Promise.all([fetchAllPages('/special-types/'), fetchAllPages('/products/')]);
      setTypes(nextTypes); setProducts(nextProducts);
      setActiveId((current) => current || nextTypes[0]?.id || null);
    } catch { setError('Gagal memuat tipe spesial dan produk.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const activeType = types.find((item) => item.id === activeId);
  const productTypeIds = (product) => {
    const ids = Array.isArray(product.tipe_specials) ? product.tipe_specials.map(Number) : [];
    if (product.tipe_special) ids.push(Number(product.tipe_special));
    return [...new Set(ids)];
  };
  const assigned = useMemo(() => products.filter((product) => productTypeIds(product).includes(Number(activeId))), [products, activeId]);
  const visible = assigned.filter((product) => `${product.nama} ${product.sku || ''} ${product.kategori_nama || ''}`.toLowerCase().includes(search.toLowerCase()));
  const available = products.filter((product) => !productTypeIds(product).includes(Number(activeId)) && `${product.nama} ${product.sku || ''}`.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 100);

  const updateMembership = async (product, add) => {
    setSavingId(product.id); setError('');
    const current = productTypeIds(product).filter((id) => id !== Number(activeId));
    const next = add ? [...current, Number(activeId)] : current;
    try {
      const response = await apiClient.patch(`/products/${product.id}/`, { tipe_specials: next });
      setProducts((items) => items.map((item) => item.id === product.id ? response.data : item));
    } catch (err) { setError(err.response?.data?.detail || 'Gagal memperbarui tipe spesial produk.'); }
    finally { setSavingId(null); }
  };

  return (
    <>
      <PageHeader title="Tipe Spesial" description="Kelompokkan produk ke beberapa daftar khusus untuk filter POS dan toko online." />
      {error && <div style={{ padding: 12, marginBottom: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
      <div className="special-layout" style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: 16 }}>
        <aside className="pi-card" style={{ padding: 8, alignSelf: 'start' }}>
          {types.map((type) => { const Icon = ICONS[type.icon] || Tag; const active = type.id === activeId; return <button key={type.id} type="button" onClick={() => { setActiveId(type.id); setSearch(''); }} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: 0, borderRadius: 8, background: active ? '#e5f2fc' : 'transparent', color: active ? '#1667a8' : '#475569', fontWeight: active ? 800 : 600, cursor: 'pointer' }}><Icon size={17} />{type.nama}<span style={{ marginLeft: 'auto', fontSize: 12 }}>{products.filter((p) => productTypeIds(p).includes(Number(type.id))).length}</span></button>; })}
          {!types.length && !loading && <div style={{ padding: 16, color: '#64748b' }}>Jalankan migrasi terbaru untuk membuat tipe bawaan.</div>}
        </aside>
        <section className="pi-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}><div><h3 style={{ margin: 0 }}>{`Daftar Produk ${activeType?.nama || ''}`.trim()}</h3><div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{`${assigned.length} produk`}</div></div><Button variant="success" onClick={() => setPickerOpen(true)} disabled={!activeType}><Plus size={15} /> Tambah Produk</Button></div>
          <div style={{ position: 'relative', marginBottom: 14 }}><Search size={16} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, SKU, atau kategori" style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #cbd5e1', borderRadius: 8 }} /></div>
          <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Nama','SKU','Grup',''].map((head) => <th key={head} style={{ padding: 11, textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 12 }}>{head}</th>)}</tr></thead><tbody>
            {visible.map((product) => <tr key={product.id}><td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{product.nama}</td><td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{product.sku || '-'}</td><td style={{ padding: 11, borderBottom: '1px solid #f1f5f9' }}>{product.kategori_nama || '-'}</td><td style={{ padding: 11, borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}><button type="button" disabled={savingId === product.id} onClick={() => updateMembership(product, false)} aria-label={`Hapus ${product.nama}`} style={{ width: 40, height: 40, border: 0, borderRadius: 8, background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}><Trash2 size={15} /></button></td></tr>)}
            {!visible.length && <tr><td colSpan="4" style={{ padding: 36, textAlign: 'center', color: '#64748b' }}>{loading ? 'Memuat…' : 'Belum ada produk pada tipe ini.'}</td></tr>}
          </tbody></table></div>
        </section>
      </div>
      {pickerOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'grid', placeItems: 'center', padding: 16 }}><div style={{ width: 'min(620px,100%)', maxHeight: '80vh', overflow: 'hidden', background: 'white', borderRadius: 12, display: 'flex', flexDirection: 'column' }}><div style={{ padding: 20, borderBottom: '1px solid #e2e8f0' }}><h3 style={{ margin: '0 0 12px' }}>{`Tambah ke ${activeType?.nama || ''}`.trim()}</h3><input autoFocus value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Cari nama atau SKU" style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 8 }} /></div><div style={{ padding: 12, overflow: 'auto', display: 'grid', gap: 8 }}>{available.map((product) => <div key={product.id} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ flex: 1 }}><strong>{product.nama}</strong><div style={{ fontSize: 12, color: '#64748b' }}>SKU {product.sku || '-'}</div></div><Button variant="success" disabled={savingId === product.id} onClick={() => updateMembership(product, true)}>Tambah</Button></div>)}{!available.length && <div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Semua produk sudah ditambahkan atau tidak ditemukan.</div>}</div><div style={{ padding: 16, borderTop: '1px solid #e2e8f0', textAlign: 'right' }}><Button variant="secondary" onClick={() => { setPickerOpen(false); setPickerSearch(''); }}>Selesai</Button></div></div></div>}
      <style>{`@media(max-width:760px){.special-layout{grid-template-columns:1fr!important}}`}</style>
    </>
  );
}
