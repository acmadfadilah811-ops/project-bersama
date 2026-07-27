import { useEffect, useMemo, useState } from 'react';
import { Download, Printer, Search, Trash2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';
import { fetchAllPages } from '../../../../utils/paginatedApi';
import { Button, PageHeader } from '../components/PageShell';
import BarcodeSvg from './BarcodeSvg';
import { downloadSheetPng } from './barcodeSheet';

const PRESETS = {
  tj108: { label: 'Tom & Jerry 108 (3 kolom)', columns: 3, width: 64, height: 33, gap: 3 },
  tj107: { label: 'Tom & Jerry 107 (2 kolom)', columns: 2, width: 96, height: 38, gap: 3 },
  a4: { label: 'A4 bebas (3 kolom)', columns: 3, width: 64, height: 35, gap: 4 },
};

const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
const rows = (data) => Array.isArray(data) ? data : (data?.results || []);

function flattenProducts(products) {
  return products.flatMap((product) => {
    if (product.has_variant && product.variants?.length) {
      return product.variants.map((variant) => ({
        key: `variant-${variant.id}`, type: 'Produk', id: variant.id,
        name: `${product.nama} — ${variant.nama_varian}`,
        altName: variant.nama_alternatif || product.nama_alternatif,
        sku: variant.sku || product.sku, barcode: variant.barcode || variant.sku || product.barcode || product.sku,
        price: variant.harga_jual_toko || product.harga_jual_toko,
      }));
    }
    return [{ key: `product-${product.id}`, type: 'Produk', id: product.id, name: product.nama,
      altName: product.nama_alternatif, sku: product.sku, barcode: product.barcode || product.sku,
      price: product.harga_jual_toko }];
  });
}

export function BarcodePage() {
  const [catalog, setCatalog] = useState([]);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [presetKey, setPresetKey] = useState('tj108');
  const [options, setOptions] = useState({ showSku: true, showName: true, showPrice: true, skuTop: false, nameBottom: false, useAltName: false });

  useEffect(() => {
    Promise.all([fetchAllPages('/products/'), fetchAllPages('/product-packages/')])
      .then(([products, packages]) => {
        const productItems = flattenProducts(products);
        const packageItems = packages.map((pkg) => ({
          key: `package-${pkg.id}`, type: 'Paket', id: pkg.id, name: pkg.nama,
          altName: '', sku: pkg.sku, barcode: pkg.barcode || pkg.sku,
          price: pkg.harga_jual_offline,
        }));
        setCatalog([...productItems, ...packageItems]);
      })
      .catch(() => setError('Gagal memuat produk dan paket produk.'))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((item) => `${item.name} ${item.sku || ''} ${item.barcode || ''}`.toLowerCase().includes(q)).slice(0, 20);
  }, [catalog, query]);

  const labels = useMemo(() => selected.flatMap((item) => Array.from({ length: item.qty }, () => item)), [selected]);
  const preset = PRESETS[presetKey];

  const add = (item) => {
    if (!item.barcode) { setError(`Produk “${item.name}” belum memiliki barcode atau SKU.`); return; }
    setSelected((current) => current.some((row) => row.key === item.key)
      ? current.map((row) => row.key === item.key ? { ...row, qty: row.qty + 1 } : row)
      : [...current, { ...item, qty: 1 }]);
    setQuery(''); setError('');
  };

  const print = () => {
    if (!labels.length) return;
    window.print();
  };

  const simpanPng = async () => {
    if (!labels.length || saving) return;
    setSaving(true); setError('');
    try {
      const tanggal = new Date().toISOString().slice(0, 10);
      await downloadSheetPng(labels, preset, options, `barcode-${tanggal}.png`);
    } catch (err) {
      setError(err.message || 'Gagal menyimpan PNG.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Aksi TIDAK boleh diletakkan di prop `actions` PageHeader: modul ini
          dibungkus .pi-module-full yang menyembunyikan .pi-page-header lewat
          CSS, sehingga tombolnya ikut hilang. */}
      <PageHeader title="Cetak Barcode Produk" description="Pilih produk atau paket, atur kertas Tom & Jerry, lihat preview, lalu cetak." />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>Cetak Barcode Produk</h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            Pilih produk atau paket, atur kertas, lalu cetak atau simpan.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={simpanPng} disabled={!labels.length || saving}>
            <Download size={15} /> {saving ? 'Menyiapkan…' : 'Unduh PNG'}
          </Button>
          <Button variant="primary" onClick={print} disabled={!labels.length}>
            <Printer size={15} /> Cetak / Simpan PDF
          </Button>
        </div>
      </div>
      {error && <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
      <div className="barcode-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, .85fr) minmax(420px, 1.15fr)', gap: 16 }}>
        <section className="pi-card" style={{ padding: 20 }}>
          <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>Cari produk, paket, SKU, atau barcode</label>
          <div style={{ position: 'relative' }}>
            <Search size={17} style={{ position: 'absolute', left: 12, top: 11, color: '#94a3b8' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={loading ? 'Memuat katalog…' : 'Mulai mengetik…'} style={{ width: '100%', padding: '10px 12px 10px 38px', border: '1px solid #cbd5e1', borderRadius: 8 }} />
            {!!results.length && <div style={{ position: 'absolute', zIndex: 20, top: 44, left: 0, right: 0, maxHeight: 260, overflow: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}>
              {results.map((item) => <button key={item.key} type="button" onClick={() => add(item)} style={{ width: '100%', padding: 12, border: 0, borderBottom: '1px solid #f1f5f9', background: 'white', textAlign: 'left', cursor: 'pointer' }}>
                <strong>{item.name}</strong><div style={{ fontSize: 12, color: '#64748b' }}>{item.type} · SKU {item.sku || '-'} · {item.barcode || 'barcode belum diisi'}</div>
              </button>)}
            </div>}
          </div>

          <div style={{ marginTop: 20, display: 'grid', gap: 10 }}>
            {selected.map((item) => <div key={item.key} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}><strong>{item.name}</strong><div style={{ fontSize: 12, color: '#64748b' }}>{item.barcode}</div></div>
              <input type="number" min="1" max="500" value={item.qty} aria-label={`Jumlah label ${item.name}`} onChange={(e) => setSelected((list) => list.map((row) => row.key === item.key ? { ...row, qty: Math.min(500, Math.max(1, Number(e.target.value) || 1)) } : row))} style={{ width: 70, padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }} />
              <button type="button" onClick={() => setSelected((list) => list.filter((row) => row.key !== item.key))} aria-label={`Hapus ${item.name}`} style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', border: 0, borderRadius: 8, color: '#dc2626', background: '#fee2e2' }}><Trash2 size={16} /></button>
            </div>)}
            {!selected.length && <div style={{ padding: 28, textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: 8 }}>Belum ada produk dipilih.</div>}
          </div>

          <div style={{ marginTop: 20, borderTop: '1px solid #e2e8f0', paddingTop: 16, display: 'grid', gap: 12 }}>
            <label><span style={{ display: 'block', fontWeight: 700, marginBottom: 6 }}>Ukuran kertas</span><select value={presetKey} onChange={(e) => setPresetKey(e.target.value)} style={{ width: '100%', padding: 9, border: '1px solid #cbd5e1', borderRadius: 7 }}>{Object.entries(PRESETS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label>
            {Object.entries({ showSku: 'Tampilkan SKU', showName: 'Tampilkan nama produk', showPrice: 'Tampilkan harga', skuTop: 'SKU di atas', nameBottom: 'Nama produk di bawah', useAltName: 'Gunakan nama alternatif' }).map(([key, label]) => <label key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{label}</span><input type="checkbox" checked={options[key]} onChange={(e) => setOptions((old) => ({ ...old, [key]: e.target.checked }))} /></label>)}
          </div>
        </section>

        <section className="pi-card" style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>Preview · {labels.length} label</h3>
          <div id="barcode-print-area" style={{ display: 'grid', gridTemplateColumns: `repeat(${preset.columns}, ${preset.width}mm)`, gap: `${preset.gap}mm`, alignContent: 'start', background: '#f8fafc', border: '1px dashed #cbd5e1', padding: 12, overflow: 'auto', minHeight: 220 }}>
            {labels.map((item, index) => { const name = options.useAltName && item.altName ? item.altName : item.name; return <div key={`${item.key}-${index}`} className="barcode-label" style={{ width: `${preset.width}mm`, height: `${preset.height}mm`, boxSizing: 'border-box', overflow: 'hidden', padding: '2mm', background: 'white', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {options.skuTop && options.showSku && <div style={{ textAlign: 'center', fontSize: 9 }}>{item.sku}</div>}
              {!options.nameBottom && options.showName && <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>}
              <BarcodeSvg value={item.barcode} height={30} showText />
              {options.nameBottom && options.showName && <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>}
              {!options.skuTop && options.showSku && <div style={{ textAlign: 'center', fontSize: 9 }}>SKU: {item.sku || '-'}</div>}
              {options.showPrice && <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 800 }}>{rupiah(item.price)}</div>}
            </div>; })}
          </div>
        </section>
      </div>
      <style>{`@media (max-width: 900px){.barcode-layout{grid-template-columns:1fr!important}} @media print{body *{visibility:hidden!important}#barcode-print-area,#barcode-print-area *{visibility:visible!important}#barcode-print-area{position:absolute;left:0;top:0;padding:0!important;border:0!important;background:white!important;overflow:visible!important}.barcode-label{break-inside:avoid;box-shadow:none!important}}`}</style>
    </>
  );
}
