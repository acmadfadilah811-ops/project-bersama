import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

/**
 * Email Peringatan Stok.
 * Daftar email disimpan di pengaturan bisnis (`stock_alert_emails`, dipisah koma),
 * dan daftar produk menipis diambil dari laporan `peringatan-stok` yang sudah ada
 * — bukan data contoh.
 */
export function StockAlertPage() {
  const [emailList, setEmailList] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pesan, setPesan] = useState(null);

  const [produkMenipis, setProdukMenipis] = useState([]);
  const [loadingProduk, setLoadingProduk] = useState(true);

  const muat = useCallback(async () => {
    setLoading(true);
    setLoadingProduk(true);
    try {
      const [bs, rep] = await Promise.all([
        apiClient.get('/business-settings/'),
        apiClient.get('/reports/peringatan-stok/').catch(() => null),
      ]);
      const raw = bs.data?.stock_alert_emails || '';
      setEmailList(raw.split(',').map((e) => e.trim()).filter(Boolean));
      setProdukMenipis(rep?.data?.rows || []);
    } catch (err) {
      console.error('[StockAlertPage] gagal memuat:', err);
      setPesan({ tipe: 'error', teks: 'Gagal memuat pengaturan peringatan stok.' });
    } finally {
      setLoading(false);
      setLoadingProduk(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const simpanDaftar = async (daftar) => {
    setSaving(true);
    setPesan(null);
    try {
      await apiClient.patch('/business-settings/', { stock_alert_emails: daftar.join(', ') });
      setEmailList(daftar);
      setPesan({ tipe: 'ok', teks: 'Daftar email berhasil disimpan.' });
    } catch (err) {
      console.error('[StockAlertPage] gagal menyimpan:', err);
      setPesan({ tipe: 'error', teks: 'Gagal menyimpan daftar email.' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Format email tidak valid.');
      return;
    }
    if (emailList.some((x) => x.toLowerCase() === email.toLowerCase())) {
      alert('Email ini sudah terdaftar.');
      return;
    }
    await simpanDaftar([...emailList, email]);
    setNewEmail('');
    setShowAddForm(false);
  };

  const handleDeleteEmail = async (email) => {
    if (!window.confirm(`Hapus ${email} dari daftar penerima?`)) return;
    await simpanDaftar(emailList.filter((x) => x !== email));
  };

  const th = { textAlign: 'left', padding: '10px 12px', fontSize: 12, fontWeight: 700, color: '#64748b' };
  const td = { padding: '10px 12px', fontSize: 13, color: '#334155', borderTop: '1px solid #f1f5f9' };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Email Peringatan Stok</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Daftar email penerima peringatan stok rendah.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((s) => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#10b981', color: '#fff',
            border: 0, borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Plus size={15} /> {showAddForm ? 'Tutup' : 'Tambah Email'}
        </button>
      </div>

      {pesan && (
        <div
          style={{
            margin: '0 0 16px', padding: '12px 14px', borderRadius: 8, fontSize: 13,
            background: pesan.tipe === 'ok' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${pesan.tipe === 'ok' ? '#a7f3d0' : '#fecaca'}`,
            color: pesan.tipe === 'ok' ? '#065f46' : '#991b1b',
          }}
        >
          {pesan.teks}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAddEmail} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="nama@perusahaan.com"
            style={{ flex: 1, maxWidth: 360, border: '1px solid #cbd5e1', borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none' }}
          />
          <button
            type="submit"
            disabled={saving}
            style={{ background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: 10, background: '#eff6ff', border: '1px solid #bfdbfe', padding: 16, borderRadius: 8, color: '#1e3a8a', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
        <span style={{ fontSize: 16 }}>ⓘ</span>
        <div>
          <strong style={{ display: 'block', marginBottom: 2 }}>Peringatan Stok:</strong>
          Produk dianggap menipis bila <strong>Qty Stok</strong> sudah mencapai atau di bawah
          <strong> Stok Minimum</strong> yang diatur pada masing-masing produk.
        </div>
      </div>

      {/* Daftar penerima */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#475569' }}>
          Penerima Email ({emailList.length})
        </div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Memuat...</div>
        ) : emailList.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Belum ada email penerima.
          </div>
        ) : (
          emailList.map((email) => (
            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#334155' }}>{email}</span>
              <button
                type="button"
                onClick={() => handleDeleteEmail(email)}
                title="Hapus"
                style={{ background: 'none', border: 0, color: '#f43f5e', cursor: 'pointer', padding: 4 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Produk yang sedang menipis — data nyata dari laporan peringatan-stok */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#475569' }}>
          Produk Menipis Saat Ini ({produkMenipis.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fff' }}>
              <th style={th}>Produk</th>
              <th style={th}>Kategori</th>
              <th style={{ ...th, textAlign: 'right' }}>Qty Stok</th>
              <th style={{ ...th, textAlign: 'right' }}>Stok Minimum</th>
              <th style={{ ...th, textAlign: 'right' }}>Kekurangan</th>
            </tr>
          </thead>
          <tbody>
            {loadingProduk ? (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>Memuat produk...</td></tr>
            ) : produkMenipis.length === 0 ? (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#94a3b8' }}>
                Tidak ada produk yang stoknya menipis.
              </td></tr>
            ) : (
              produkMenipis.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.produk}</td>
                  <td style={td}>{r.kategori || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.qty_stok}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.stok_minimum}</td>
                  <td style={{ ...td, textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{r.kekurangan}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
