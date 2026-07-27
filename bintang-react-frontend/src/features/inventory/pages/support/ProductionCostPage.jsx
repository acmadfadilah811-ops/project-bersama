import { useState, useEffect } from 'react';
import { Trash2, Pencil } from 'lucide-react';
import DataTable from '../components/DataTable';
import { Button, PageHeader, Toolbar } from '../components/PageShell';
import apiClient from '../../../../api/apiClient';

const formatRp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(Number(v) || 0);

const FORM_KOSONG = { id: null, nama: '', nilai: '', akun: '' };

/**
 * Master komponen biaya produksi non-bahan.
 *
 * Sebelumnya halaman ini cuma cangkang: rows={[]} hardcoded, nol panggilan
 * API, dan tombol Tambah tidak melakukan apa pun — padahal menunya tampil
 * normal di sidebar sehingga terlihat seperti fitur jadi.
 */
export function ProductionCostPage() {
  const [rows, setRows] = useState([]);
  const [akunList, setAkunList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null); // null = form tertutup
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/production-costs/');
      setRows(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('[ProductionCostPage] gagal memuat biaya produksi:', err);
      setError('Gagal memuat daftar biaya produksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Daftar akun hanya diambil saat form dibuka. Endpoint /finance/akun/
  // dibatasi IsOwnerOrManager, jadi jangan dipanggil saat halaman dimuat —
  // staff/kasir yang cuma melihat daftar akan kena 403 tanpa sebab jelas.
  const bukaForm = async (data = FORM_KOSONG) => {
    setForm(data);
    setError('');
    if (akunList.length === 0) {
      try {
        const res = await apiClient.get('/finance/akun/');
        setAkunList(Array.isArray(res.data) ? res.data : (res.data?.results || []));
      } catch (err) {
        console.error('[ProductionCostPage] gagal memuat akun:', err);
        setError('Gagal memuat daftar akun. Hanya owner/manager/admin yang bisa mengelola biaya produksi.');
      }
    }
  };

  const simpan = async () => {
    setSaving(true);
    setError('');
    try {
      // akun: null, bukan '' — opsional, dan DRF menolak string kosong untuk FK.
      const payload = { nama: form.nama, nilai: form.nilai || 0, akun: form.akun || null };
      if (form.id) {
        await apiClient.patch(`/production-costs/${form.id}/`, payload);
      } else {
        await apiClient.post('/production-costs/', payload);
      }
      setForm(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan biaya produksi.');
    } finally {
      setSaving(false);
    }
  };

  const hapus = async (row) => {
    setError('');
    try {
      await apiClient.delete(`/production-costs/${row.id}/`);
      await fetchData();
    } catch (err) {
      // PROTECT di model: master yang masih dipakai dokumen tidak bisa dihapus.
      console.error('[ProductionCostPage] gagal menghapus:', err);
      setError(`"${row.nama}" tidak bisa dihapus karena masih dipakai dokumen produksi.`);
    }
  };

  const terfilter = rows.filter((r) =>
    r.nama.toLowerCase().includes(search.trim().toLowerCase())
  );

  const kolom = [
    { key: 'nama', label: 'Nama Biaya' },
    { key: 'nilai', label: 'Nilai Biaya', render: (row) => formatRp(row.nilai) },
    {
      key: 'akun',
      label: 'Akun Terkait',
      render: (row) => (row.akun_kode ? `${row.akun_kode} — ${row.akun_nama}` : '-'),
    },
    {
      key: 'aksi',
      label: '',
      render: (row) => (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={() => bukaForm({ id: row.id, nama: row.nama, nilai: row.nilai, akun: row.akun })}
            title="Ubah"
            style={{ border: 0, background: 'transparent', color: '#0ea5e9', cursor: 'pointer' }}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => hapus(row)}
            title="Hapus"
            style={{ border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Biaya Produksi"
        description="Master komponen biaya produksi non-bahan, seperti tenaga kerja, listrik, dan sewa mesin."
        actions={<Button variant="success" onClick={() => bukaForm()}>Tambah</Button>}
      />
      <Toolbar
        searchPlaceholder="Cari biaya"
        searchValue={search}
        onSearchChange={(e) => setSearch(e.target.value)}
      />

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', fontSize: '13px', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {form && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr auto auto', gap: '10px', alignItems: 'center' }}>
            <input
              placeholder="Nama biaya, mis. Listrik"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px', fontSize: '13px', outline: 'none' }}
            />
            <input
              type="number"
              placeholder="Nilai default"
              value={form.nilai}
              onChange={(e) => setForm({ ...form, nilai: e.target.value })}
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px', fontSize: '13px', outline: 'none' }}
            />
            <select
              value={form.akun}
              onChange={(e) => setForm({ ...form, akun: e.target.value })}
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px', fontSize: '13px', outline: 'none', background: '#fff' }}
            >
              <option value="">Akun terkait (opsional)</option>
              {akunList.map((a) => (
                <option key={a.id} value={a.id}>{a.kode_akun} — {a.nama_akun}</option>
              ))}
            </select>
            <Button variant="primary" disabled={!form.nama || saving} onClick={simpan}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
            <button
              type="button"
              onClick={() => { setForm(null); setError(''); }}
              style={{ background: 'transparent', border: 0, fontSize: '13px', color: '#64748b', cursor: 'pointer' }}
            >
              Batal
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '8px 0 0' }}>
            Nilai ini hanya default — saat dipakai di dokumen produksi, nilainya masih bisa diubah.
          </p>
        </div>
      )}

      <DataTable
        rows={terfilter}
        columns={kolom}
        getRowKey={(row) => row.id}
        emptyText={loading ? 'Memuat…' : 'Belum ada biaya produksi'}
      />
    </>
  );
}
