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
import { Plus, Trash2 } from 'lucide-react';
import DataTable from '../../../inventory/pages/components/DataTable';
import { Button, PageHeader, Toolbar } from '../../../inventory/pages/components/PageShell';
import apiClient from '../../../../api/apiClient';

const emptyForm = { nama: '', diskon_persen: '' };

export function CustomerGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pelanggan ikut diambil hanya untuk menghitung jumlah anggota per grup.
      const [g, c] = await Promise.all([
        apiClient.get('/customer-groups/'),
        apiClient.get('/customers/'),
      ]);
      setGroups(g.data.results || g.data || []);
      setCustomers(c.data.results || c.data || []);
    } catch (err) {
      console.error('[CustomerGroupsPage] gagal memuat:', err);
      setError('Gagal memuat grup pelanggan.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const jumlahAnggota = useMemo(() => {
    const peta = {};
    customers.forEach((c) => {
      if (c.customer_group) peta[c.customer_group] = (peta[c.customer_group] || 0) + 1;
    });
    return peta;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => (g.nama || '').toLowerCase().includes(q));
  }, [groups, query]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      window.alert('Nama grup wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/customer-groups/', {
        nama: form.nama.trim(),
        diskon_persen: Number(form.diskon_persen) || 0,
      });
      setForm(emptyForm);
      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error('[CustomerGroupsPage] gagal menyimpan:', err);
      window.alert(err.response?.data?.nama?.[0] || err.response?.data?.error || 'Gagal menyimpan grup.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nama) => {
    if (!window.confirm(`Hapus grup "${nama}"?`)) return;
    try {
      await apiClient.delete(`/customer-groups/${id}/`);
      await fetchData();
    } catch (err) {
      console.error('[CustomerGroupsPage] gagal menghapus:', err);
      window.alert('Gagal menghapus grup.');
    }
  };

  return (
    <>
      <PageHeader
        title="Grup Pelanggan"
        description="Kelompokkan pelanggan untuk menerapkan diskon khusus per grup."
        actions={
          <Button variant="success" onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} /> {showForm ? 'Tutup' : 'Tambah Grup'}
          </Button>
        }
      />
      {showForm && (
        <form className="pi-inline-form" onSubmit={handleAdd}>
          <div className="pi-form-group">
            <label>Nama Grup</label>
            <input value={form.nama} onChange={set('nama')} placeholder="Nama grup" />
          </div>
          <div className="pi-form-group">
            <label>Diskon (%)</label>
            <input type="number" value={form.diskon_persen} onChange={set('diskon_persen')} placeholder="0" />
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </form>
      )}
      <Toolbar searchPlaceholder="Cari grup" searchValue={query} onSearchChange={setQuery} />
      <DataTable
        rows={filtered}
        emptyText={loading ? 'Memuat grup pelanggan...' : error || 'Belum ada grup pelanggan'}
        columns={[
          { key: 'nama', label: 'Nama Grup' },
          { key: 'diskon', label: 'Diskon', render: (r) => `${Number(r.diskon_persen) || 0}%` },
          { key: 'members', label: 'Jumlah Anggota', render: (r) => jumlahAnggota[r.id] || 0 },
          {
            key: 'aksi',
            label: '',
            render: (r) => (
              <button type="button" className="pi-icon-button" onClick={() => handleDelete(r.id, r.nama)} aria-label="Hapus">
                <Trash2 size={16} />
              </button>
            ),
          },
        ]}
      />
    </>
  );
}
