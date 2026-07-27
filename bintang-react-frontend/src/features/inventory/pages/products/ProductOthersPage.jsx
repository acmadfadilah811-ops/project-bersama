import { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable';
import { PageHeader, Select, StatusBadge, Toolbar } from '../components/PageShell';
import { formatCurrency } from '../productInventoryData';
import apiClient from '../../../../api/apiClient';

/**
 * Produk Lain-lain = produk yang TIDAK dilacak stoknya (`lacak_inventori = false`),
 * mis. jasa desain, ongkos kirim, biaya tambahan.
 *
 * Bukan entitas terpisah — hanya penyaringan atas data Produk yang sudah ada,
 * sehingga tidak perlu tabel baru dan otomatis ikut terbarui dari menu Produk.
 */
export function ProductOthersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('all');

  const muat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/products/', { params: { page: 1, page_size: 1000 } });
      const rows = res.data.results || res.data || [];
      setItems(rows.filter((p) => !p.lacak_inventori));
    } catch (err) {
      console.error('[ProductOthersPage] gagal memuat:', err);
      setError('Gagal memuat produk lain-lain.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const kategoriTersedia = useMemo(() => {
    const set = new Map();
    items.forEach((p) => {
      if (p.kategori && p.kategori_nama) set.set(p.kategori, p.kategori_nama);
    });
    return Array.from(set, ([id, nama]) => ({ id, nama }));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((p) => {
      if (kategoriFilter !== 'all' && String(p.kategori) !== String(kategoriFilter)) return false;
      if (!q) return true;
      return `${p.nama || ''} ${p.sku || ''}`.toLowerCase().includes(q);
    });
  }, [items, query, kategoriFilter]);

  return (
    <>
      <PageHeader
        title="Produk Lain-lain"
        description="Produk non-stok / jasa tambahan seperti ongkos desain, biaya kirim, atau item lain di luar katalog utama. Ditambahkan lewat menu Produk dengan pelacakan inventori dimatikan."
      />
      <Toolbar
        searchPlaceholder="Cari produk lain-lain"
        searchValue={query}
        onSearchChange={setQuery}
        left={
          <Select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)}>
            <option value="all">Semua Kategori</option>
            {kategoriTersedia.map((k) => (
              <option key={k.id} value={k.id}>{k.nama}</option>
            ))}
          </Select>
        }
      />
      <DataTable
        rows={filtered}
        emptyText={
          loading
            ? 'Memuat produk lain-lain...'
            : error || 'Belum ada produk non-stok. Tambahkan lewat menu Produk dan matikan "Lacak Inventori".'
        }
        columns={[
          { key: 'nama', label: 'Nama' },
          { key: 'sku', label: 'SKU', render: (r) => r.sku || '-' },
          { key: 'kategori', label: 'Kategori', render: (r) => r.kategori_nama || '-' },
          { key: 'satuan', label: 'Satuan', render: (r) => r.satuan || '-' },
          { key: 'harga', label: 'Harga Jual', render: (r) => formatCurrency(Number(r.harga_jual_toko) || 0) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge active={r.is_active} /> },
        ]}
      />
    </>
  );
}
