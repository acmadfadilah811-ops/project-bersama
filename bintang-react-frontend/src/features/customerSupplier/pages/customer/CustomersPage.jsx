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
import { Button, PageHeader, StatusBadge, Toolbar } from '../../../inventory/pages/components/PageShell';
import { formatCurrency } from '../customerSupplierData';
import apiClient from '../../../../api/apiClient';

const emptyForm = { nama: '', handphone: '', email: '', customer_group: '', deposit: '' };

export function CustomersPage() {
  const [items, setItems] = useState([]);
  const [groups, setGroups] = useState([]);
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
      const [c, g] = await Promise.all([
        apiClient.get('/customers/'),
        apiClient.get('/customer-groups/'),
      ]);
      setItems(c.data.results || c.data || []);
      setGroups(g.data.results || g.data || []);
    } catch (err) {
      console.error('[CustomersPage] gagal memuat:', err);
      setError('Gagal memuat data pelanggan.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.nama || ''} ${it.handphone || ''} ${it.email || ''}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      window.alert('Nama pelanggan wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/customers/', {
        nama: form.nama.trim(),
        handphone: form.handphone.trim(),
        email: form.email.trim(),
        customer_group: form.customer_group || null,
        deposit: Number(form.deposit) || 0,
      });
      setForm(emptyForm);
      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error('[CustomersPage] gagal menyimpan:', err);
      window.alert(err.response?.data?.error || 'Gagal menyimpan pelanggan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nama) => {
    if (!window.confirm(`Hapus pelanggan "${nama}"?`)) return;
    try {
      await apiClient.delete(`/customers/${id}/`);
      await fetchData();
    } catch (err) {
      console.error('[CustomersPage] gagal menghapus:', err);
      window.alert('Gagal menghapus pelanggan.');
    }
  };

  return (
    <>
      <PageHeader
        title="Daftar Pelanggan"
        description="Kelola data pelanggan, grup, dan saldo deposit."
        actions={
          <Button variant="success" onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} /> {showForm ? 'Tutup' : 'Tambah Pelanggan'}
          </Button>
        }
      />
      {showForm && (
        <form className="pi-inline-form" onSubmit={handleAdd}>
          <div className="pi-form-group">
            <label>Nama</label>
            <input value={form.nama} onChange={set('nama')} placeholder="Nama pelanggan" />
          </div>
          <div className="pi-form-group">
            <label>Telepon</label>
            <input value={form.handphone} onChange={set('handphone')} placeholder="08xx / 021" />
          </div>
          <div className="pi-form-group">
            <label>Email</label>
            <input value={form.email} onChange={set('email')} placeholder="email@contoh.com" />
          </div>
          <div className="pi-form-group">
            <label>Grup</label>
            <select value={form.customer_group} onChange={set('customer_group')}>
              <option value="">Tanpa grup</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.nama}</option>
              ))}
            </select>
          </div>
          <div className="pi-form-group">
            <label>Saldo Deposit</label>
            <input type="number" value={form.deposit} onChange={set('deposit')} placeholder="0" />
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </form>
      )}
      <Toolbar searchPlaceholder="Cari nama / telepon / email" searchValue={query} onSearchChange={setQuery} />
      <DataTable
        rows={filtered}
        emptyText={loading ? 'Memuat data pelanggan...' : error || 'Belum ada pelanggan'}
        columns={[
          { key: 'nama', label: 'Nama' },
          { key: 'handphone', label: 'Telepon', render: (r) => r.handphone || '-' },
          { key: 'email', label: 'Email', render: (r) => r.email || '-' },
          { key: 'grup', label: 'Grup', render: (r) => r.customer_group_nama || '-' },
          { key: 'deposit', label: 'Saldo Deposit', render: (r) => formatCurrency(Number(r.deposit) || 0) },
          {
            key: 'status',
            label: 'Status',
            // `bekukan` = pelanggan tidak bisa dipakai di POS, jadi dianggap non-aktif.
            render: (r) => <StatusBadge active={r.is_active && !r.bekukan} />,
          },
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
