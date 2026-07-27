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
import apiClient from '../../../../api/apiClient';

const emptyForm = { nama: '', kontak_pic: '', phone: '', alamat: '' };

export function SuppliersPage() {
  const [items, setItems] = useState([]);
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
      const res = await apiClient.get('/suppliers/');
      setItems(res.data.results || res.data || []);
    } catch (err) {
      console.error('[SuppliersPage] gagal memuat:', err);
      setError('Gagal memuat data supplier.');
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
      `${it.nama || ''} ${it.kontak_pic || ''} ${it.phone || ''}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      window.alert('Nama supplier wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/suppliers/', {
        nama: form.nama.trim(),
        kontak_pic: form.kontak_pic.trim(),
        phone: form.phone.trim(),
        alamat: form.alamat.trim(),
      });
      setForm(emptyForm);
      setShowForm(false);
      await fetchData();
    } catch (err) {
      console.error('[SuppliersPage] gagal menyimpan:', err);
      window.alert(err.response?.data?.error || 'Gagal menyimpan supplier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, nama) => {
    if (!window.confirm(`Hapus supplier "${nama}"?`)) return;
    try {
      await apiClient.delete(`/suppliers/${id}/`);
      await fetchData();
    } catch (err) {
      console.error('[SuppliersPage] gagal menghapus:', err);
      window.alert('Gagal menghapus supplier. Mungkin masih dipakai di dokumen pembelian.');
    }
  };

  return (
    <>
      <PageHeader
        title="Daftar Supplier"
        description="Kelola data supplier / pemasok bahan baku dan jasa."
        actions={
          <Button variant="success" onClick={() => setShowForm((s) => !s)}>
            <Plus size={15} /> {showForm ? 'Tutup' : 'Tambah Supplier'}
          </Button>
        }
      />
      {showForm && (
        <form className="pi-inline-form" onSubmit={handleAdd}>
          <div className="pi-form-group">
            <label>Nama Supplier</label>
            <input value={form.nama} onChange={set('nama')} placeholder="Nama supplier" />
          </div>
          <div className="pi-form-group">
            <label>Kontak (PIC)</label>
            <input value={form.kontak_pic} onChange={set('kontak_pic')} placeholder="Nama kontak" />
          </div>
          <div className="pi-form-group">
            <label>Telepon</label>
            <input value={form.phone} onChange={set('phone')} placeholder="08xx / 021" />
          </div>
          <div className="pi-form-group">
            <label>Alamat</label>
            <input value={form.alamat} onChange={set('alamat')} placeholder="Alamat" />
          </div>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </form>
      )}
      <Toolbar searchPlaceholder="Cari supplier / kontak / telepon" searchValue={query} onSearchChange={setQuery} />
      <DataTable
        rows={filtered}
        emptyText={loading ? 'Memuat data supplier...' : error || 'Belum ada supplier'}
        columns={[
          { key: 'nama', label: 'Nama Supplier' },
          { key: 'kontak_pic', label: 'Kontak', render: (r) => r.kontak_pic || '-' },
          { key: 'phone', label: 'Telepon', render: (r) => r.phone || '-' },
          { key: 'alamat', label: 'Alamat', render: (r) => r.alamat || '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge active={r.is_active} /> },
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
