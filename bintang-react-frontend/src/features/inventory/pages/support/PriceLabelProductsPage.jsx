import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Printer, Search, Trash2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { fetchAllPages } from '../../../../utils/paginatedApi';
import BarcodeSvg from './BarcodeSvg';

const DEFAULTS = { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, paperWidth: 210, labelsPerLine: 2, padding: 8, labelWidth: 90, labelHeight: 45, useAltName: true, showBarcode: true, showWeight: true, showPromo: true, storeName: 'Bintang Advertising' };
const list = (data) => Array.isArray(data) ? data : (data?.results || []);
const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);

function flatten(products) {
  return products.flatMap((product) => product.has_variant && product.variants?.length
    ? product.variants.map((variant) => ({ id: `v-${variant.id}`, sourceId: product.id, name: `${product.nama} — ${variant.nama_varian}`, altName: variant.nama_alternatif || product.nama_alternatif, sku: variant.sku || product.sku, barcode: variant.barcode || variant.sku || product.barcode || product.sku, price: variant.harga_jual_toko || product.harga_jual_toko, marketPrice: variant.harga_pasar || product.harga_pasar, weight: variant.berat || product.berat, unit: product.satuan }))
    : [{ id: `p-${product.id}`, sourceId: product.id, name: product.nama, altName: product.nama_alternatif, sku: product.sku, barcode: product.barcode || product.sku, price: product.harga_jual_toko, marketPrice: product.harga_pasar, weight: product.berat, unit: product.satuan }]);
}

export function PriceLabelProductsPage() {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [searchType, setSearchType] = useState('Nama');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('price_label_settings') || '{}') }; } catch { return DEFAULTS; } });

  useEffect(() => { fetchAllPages('/products/').then((products) => setCatalog(flatten(products))).catch((err) => setError('Gagal memuat katalog produk: ' + err.message)); }, []);
  useEffect(() => { const sync = () => { try { setSettings({ ...DEFAULTS, ...JSON.parse(localStorage.getItem('price_label_settings') || '{}') }); } catch { /* noop */ } }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, []);

  const results = useMemo(() => { const q = query.trim().toLowerCase(); if (!q) return []; return catalog.filter((item) => (searchType === 'SKU' ? `${item.sku || ''} ${item.barcode || ''}` : `${item.name} ${item.altName || ''}`).toLowerCase().includes(q)).slice(0, 30); }, [catalog, query, searchType]);
  const labels = useMemo(() => selected.flatMap((item) => Array.from({ length: item.qty }, () => item)), [selected]);
  const add = (item) => { setSelected((items) => items.some((row) => row.id === item.id) ? items.map((row) => row.id === item.id ? { ...row, qty: row.qty + 1 } : row) : [...items, { ...item, qty: 1 }]); setQuery(''); setOpen(false); };

  return <>
    {error && <div style={{ padding: 12, marginBottom: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
    <div className="price-label-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(340px,1fr) minmax(420px,1fr)', gap: 16 }}>
      <section className="pi-card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Pilih Produk</h3>
        <div style={{ display: 'flex', position: 'relative' }}><div style={{ position: 'relative' }}><select value={searchType} onChange={(e) => setSearchType(e.target.value)} style={{ height: 42, padding: '0 34px 0 12px', border: '1px solid #cbd5e1', borderRight: 0, borderRadius: '8px 0 0 8px', appearance: 'none', background: '#f8fafc' }}><option>Nama</option><option>SKU</option></select><ChevronDown size={13} style={{ position: 'absolute', right: 10, top: 15, pointerEvents: 'none' }} /></div><div style={{ flex: 1, position: 'relative' }}><Search size={16} style={{ position: 'absolute', left: 12, top: 13, color: '#94a3b8' }} /><input value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} placeholder="Cari dan pilih produk" style={{ width: '100%', height: 42, padding: '0 12px 0 38px', border: '1px solid #cbd5e1', borderRadius: '0 8px 8px 0' }} />{open && query && <div style={{ position: 'absolute', top: 45, left: 0, right: 0, zIndex: 20, maxHeight: 260, overflow: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}>{results.map((item) => <button key={item.id} type="button" onClick={() => add(item)} style={{ width: '100%', padding: 12, textAlign: 'left', background: 'white', border: 0, borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}><strong>{item.name}</strong><div style={{ fontSize: 12, color: '#64748b' }}>SKU {item.sku || '-'} · {money(item.price)}</div></button>)}{!results.length && <div style={{ padding: 16, color: '#64748b' }}>Produk tidak ditemukan.</div>}</div>}</div></div>
        <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>{selected.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }}><div style={{ flex: 1 }}><strong>{item.name}</strong><div style={{ fontSize: 12, color: '#64748b' }}>SKU {item.sku || '-'} · {money(item.price)}</div></div><input type="number" min="1" max="500" value={item.qty} onChange={(e) => setSelected((items) => items.map((row) => row.id === item.id ? { ...row, qty: Math.min(500, Math.max(1, Number(e.target.value) || 1)) } : row))} style={{ width: 68, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} /><button type="button" onClick={() => setSelected((items) => items.filter((row) => row.id !== item.id))} style={{ width: 40, height: 40, border: 0, borderRadius: 8, background: '#fee2e2', color: '#dc2626' }}><Trash2 size={16} /></button></div>)}{!selected.length && <div style={{ padding: 40, textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: 8, color: '#64748b' }}>Pilih produk yang ingin dicetak label harganya.</div>}</div>
      </section>
      <section className="pi-card" style={{ padding: 20 }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div><h3 style={{ margin: 0 }}>Preview</h3><span style={{ fontSize: 12, color: '#64748b' }}>{labels.length} label</span></div><button type="button" disabled={!labels.length} onClick={() => window.print()} style={{ minHeight: 40, display: 'flex', alignItems: 'center', gap: 7, border: 0, borderRadius: 8, padding: '0 16px', background: labels.length ? '#2783de' : '#cbd5e1', color: 'white', fontWeight: 700 }}><Printer size={15} /> Cetak</button></div>
        <div id="price-label-print-area" style={{ width: `${settings.paperWidth}mm`, maxWidth: '100%', padding: `${settings.marginTop}px ${settings.marginRight}px ${settings.marginBottom}px ${settings.marginLeft}px`, display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, settings.labelsPerLine)}, ${settings.labelWidth}mm)`, gap: `${settings.padding}px`, alignContent: 'start', overflow: 'auto', minHeight: 240, background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          {labels.map((item, index) => { const promo = settings.showPromo && Number(item.marketPrice) > Number(item.price); const name = settings.useAltName && item.altName ? item.altName : item.name; return <article key={`${item.id}-${index}`} className="price-label" style={{ width: `${settings.labelWidth}mm`, height: `${settings.labelHeight}mm`, padding: `${settings.padding}px`, boxSizing: 'border-box', background: 'white', border: promo ? '2px solid #e56458' : '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><div><div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>{settings.storeName}</div><div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div></div>{settings.showBarcode && <BarcodeSvg value={item.barcode} height={28} showText /> }<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 8 }}><div>{promo && <div style={{ fontSize: 9, color: '#64748b', textDecoration: 'line-through' }}>{money(item.marketPrice)}</div>}<div style={{ fontSize: 14, color: promo ? '#dc2626' : '#1667a8', fontWeight: 900 }}>{money(item.price)}</div></div>{settings.showWeight && item.weight && <span style={{ fontSize: 9, color: '#64748b' }}>{item.weight} kg</span>}</div></article>; })}
        </div>
      </section>
    </div>
    <style>{`@media(max-width:900px){.price-label-layout{grid-template-columns:1fr!important}}@media print{body *{visibility:hidden!important}#price-label-print-area,#price-label-print-area *{visibility:visible!important}#price-label-print-area{position:absolute;left:0;top:0;max-width:none!important;border:0!important;overflow:visible!important;background:white!important}.price-label{break-inside:avoid}}`}</style>
  </>;
}
