/**
 * ============================================================================
 * VERSI LAMA — TIDAK DIPAKAI APLIKASI
 * ============================================================================
 * File ini sisa rancangan awal modul Pelanggan & Supplier dan **tidak dirender
 * di mana pun**. Barrel `CustomerPages.jsx` / `SupplierPages.jsx` yang
 * mengekspornya sudah tidak diimpor oleh file mana pun.
 *
 * Halaman yang BENAR-BENAR dipakai: `pages/CustomerSupplierApp.jsx`
 * (rute `/customer-supplier/*` di App.jsx), yang sudah terhubung ke API asli.
 *
 * Jangan jadikan file ini acuan kondisi aplikasi — mengubahnya tidak
 * berpengaruh apa pun ke layar yang dilihat pengguna. Aman untuk dihapus.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import DataTable from '../../../inventory/pages/components/DataTable';
import { Button, PageHeader, StatusBadge, Toolbar } from '../../../inventory/pages/components/PageShell';
import apiClient from '../../../../api/apiClient';

/**
 * Membership diturunkan dari data Pelanggan yang sebenarnya:
 * tier = grup pelanggan, poin = loyalty_points, bergabung = created_at.
 * Tidak ada model Membership terpisah di backend.
 */
export function MembershipPage() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/customers/');
      const rows = res.data.results || res.data || [];
      // Anggota = pelanggan yang punya tier (grup) atau sudah punya poin.
      setMembers(rows.filter((c) => c.customer_group || Number(c.loyalty_points) > 0));
    } catch (err) {
      console.error('[MembershipPage] gagal memuat:', err);
      setError('Gagal memuat data membership.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      `${m.nama || ''} ${m.customer_group_nama || ''}`.toLowerCase().includes(q),
    );
  }, [members, query]);

  const addPoints = async (m) => {
    const poinBaru = (Number(m.loyalty_points) || 0) + 100;
    try {
      await apiClient.patch(`/customers/${m.id}/`, { loyalty_points: poinBaru });
      await fetchData();
    } catch (err) {
      console.error('[MembershipPage] gagal menambah poin:', err);
      window.alert('Gagal menambah poin.');
    }
  };

  const fmtTanggal = (d) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  return (
    <>
      <PageHeader
        title="Membership"
        description="Pelanggan yang tergabung dalam tier/grup beserta poin loyalitasnya."
      />
      <Toolbar searchPlaceholder="Cari nama / tier" searchValue={query} onSearchChange={setQuery} />
      <DataTable
        rows={filtered}
        emptyText={
          loading
            ? 'Memuat data membership...'
            : error || 'Belum ada pelanggan yang tergabung dalam tier atau memiliki poin.'
        }
        columns={[
          { key: 'nama', label: 'Nama Member' },
          {
            key: 'tier',
            label: 'Tier',
            render: (r) => <StatusBadge active label={r.customer_group_nama || 'Tanpa Tier'} />,
          },
          { key: 'points', label: 'Poin', render: (r) => Number(r.loyalty_points) || 0 },
          { key: 'joined', label: 'Bergabung', render: (r) => fmtTanggal(r.created_at) },
          {
            key: 'berakhir',
            label: 'Berakhir',
            render: (r) => fmtTanggal(r.tanggal_berakhir),
          },
          {
            key: 'aksi',
            label: '',
            render: (r) => (
              <Button variant="ghost" onClick={() => addPoints(r)}>
                <Plus size={14} /> 100 Poin
              </Button>
            ),
          },
        ]}
      />
    </>
  );
}
