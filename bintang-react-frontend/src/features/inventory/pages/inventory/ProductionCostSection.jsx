import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

const formatRp = (v) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(Number(v) || 0);

/**
 * Section "Biaya Produksi" pada detail dokumen produksi.
 *
 * Dipisah dari StockProductionPage.jsx yang sudah 900+ baris (batas .jsx di
 * AGENTS.md: 300).
 *
 * Catatan penting: daftar akun (/api/finance/akun/) dibatasi IsOwnerOrManager,
 * jadi HANYA diambil saat form "Buat baru" dibuka — bukan saat section dimuat.
 * Kalau diambil di awal, staff/kasir yang cuma melihat rincian akan kena 403.
 * Untuk menampilkan, nama akun sudah ikut di payload biaya (akun_nama).
 */
export function ProductionCostSection({ documentId, isDraft, biaya = [], totalBiaya, serapKeHpp, onChanged }) {
  const [masterList, setMasterList] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingSerap, setSavingSerap] = useState(false);

  // Form "Buat baru"
  const [showBuatBaru, setShowBuatBaru] = useState(false);
  const [akunList, setAkunList] = useState([]);
  const [formNama, setFormNama] = useState('');
  const [formNilai, setFormNilai] = useState('');
  const [formAkun, setFormAkun] = useState('');

  // Edit nilai baris
  const [editingId, setEditingId] = useState(null);
  const [editNilai, setEditNilai] = useState('');

  const fetchMaster = async () => {
    try {
      const res = await apiClient.get('/production-costs/');
      setMasterList(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('[ProductionCostSection] gagal memuat master biaya:', err);
    }
  };

  useEffect(() => { fetchMaster(); }, []);

  const bukaBuatBaru = async () => {
    setMenuOpen(false);
    setShowBuatBaru(true);
    if (akunList.length === 0) {
      try {
        const res = await apiClient.get('/finance/akun/');
        setAkunList(Array.isArray(res.data) ? res.data : (res.data?.results || []));
      } catch (err) {
        console.error('[ProductionCostSection] gagal memuat akun:', err);
        setError('Gagal memuat daftar akun. Hanya owner/manager/admin yang bisa membuat biaya baru.');
      }
    }
  };

  const tambahBiaya = async (master) => {
    setMenuOpen(false);
    setError('');
    setSaving(true);
    try {
      // Nilai awal disalin dari master, tapi tetap bisa diubah per dokumen.
      await apiClient.post('/stock-production-costs/', {
        document: documentId,
        production_cost: master.id,
        nilai: master.nilai,
      });
      onChanged?.();
    } catch (err) {
      const detail = err.response?.data;
      setError(detail?.error || detail?.non_field_errors?.[0]
        || `"${master.nama}" sudah ada di dokumen ini — ubah nilainya, jangan ditambah lagi.`);
    } finally {
      setSaving(false);
    }
  };

  const simpanBiayaBaru = async () => {
    setError('');
    setSaving(true);
    try {
      const res = await apiClient.post('/production-costs/', {
        nama: formNama,
        nilai: formNilai || 0,
        // null, bukan '' — akun opsional dan DRF menolak string kosong untuk FK.
        akun: formAkun || null,
      });
      setShowBuatBaru(false);
      setFormNama(''); setFormNilai(''); setFormAkun('');
      await fetchMaster();
      await tambahBiaya(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal membuat biaya produksi baru.');
    } finally {
      setSaving(false);
    }
  };

  const simpanNilai = async (id) => {
    setError('');
    try {
      await apiClient.patch(`/stock-production-costs/${id}/`, { nilai: editNilai });
      setEditingId(null);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menyimpan nilai.');
    }
  };

  // Menyimpan langsung ke dokumen (bukan ke baris biaya), karena flag-nya milik
  // header dokumen. Backend menolak PATCH bila dokumen bukan draft.
  const handleToggleSerap = async (checked) => {
    setError('');
    setSavingSerap(true);
    try {
      await apiClient.patch(`/stock-production-documents/${documentId}/`, {
        serap_biaya_ke_hpp: checked,
      });
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengubah opsi penyerapan HPP.');
    } finally {
      setSavingSerap(false);
    }
  };

  const hapusBiaya = async (id) => {
    setError('');
    try {
      await apiClient.delete(`/stock-production-costs/${id}/`);
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal menghapus biaya.');
    }
  };

  const belumDipakai = masterList.filter(
    (m) => !biaya.some((b) => b.production_cost === m.id)
  );

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>Biaya Produksi</span>

        {isDraft && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px',
                padding: '7px 14px', fontSize: '13px', color: '#64748b', cursor: 'pointer',
              }}
            >
              <span>Tambah Biaya Produksi</span>
              <ChevronDown size={14} />
            </button>

            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                {/* Menu dibuka KE ATAS, bukan ke bawah. Section ini ada di
                    paling bawah halaman, dan .pi-full-panel (ProductInventory.css)
                    memakai overflow:hidden — menu yang menjulur ke bawah akan
                    terpotong batas panel. */}
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 4px)', right: 0, zIndex: 41,
                  background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: '240px', maxHeight: '260px',
                  overflowY: 'auto',
                }}>
                  {belumDipakai.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={saving}
                      onClick={() => tambahBiaya(m)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', gap: '12px', width: '100%',
                        border: 0, background: 'transparent', padding: '9px 14px', fontSize: '13px',
                        color: '#334155', cursor: 'pointer', textAlign: 'left',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{m.nama}</span>
                      <span style={{ color: '#94a3b8' }}>{formatRp(m.nilai)}</span>
                    </button>
                  ))}
                  {belumDipakai.length === 0 && (
                    <div style={{ padding: '9px 14px', fontSize: '12px', color: '#94a3b8' }}>
                      Semua biaya sudah ditambahkan
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={bukaBuatBaru}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                      border: 0, borderTop: '1px solid #f1f5f9', background: 'transparent',
                      padding: '9px 14px', fontSize: '13px', color: '#0ea5e9', fontWeight: 'bold',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Plus size={14} />
                    <span>Buat baru</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 20px', background: '#fef2f2', color: '#b91c1c', fontSize: '12px' }}>{error}</div>
      )}

      {showBuatBaru && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.4fr auto auto', gap: '10px', alignItems: 'center' }}>
            <input
              placeholder="Nama biaya, mis. Listrik"
              value={formNama}
              onChange={(e) => setFormNama(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px', fontSize: '13px', outline: 'none' }}
            />
            <input
              type="number"
              placeholder="Nilai"
              value={formNilai}
              onChange={(e) => setFormNilai(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px', fontSize: '13px', outline: 'none' }}
            />
            <select
              value={formAkun}
              onChange={(e) => setFormAkun(e.target.value)}
              style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '7px 10px', fontSize: '13px', outline: 'none', background: '#fff' }}
            >
              <option value="">Akun terkait (opsional)</option>
              {akunList.map((a) => (
                <option key={a.id} value={a.id}>{a.kode_akun} — {a.nama_akun}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!formNama || saving}
              onClick={simpanBiayaBaru}
              style={{
                background: (!formNama || saving) ? '#bae6fd' : '#0ea5e9',
                border: 0, borderRadius: '4px', padding: '7px 16px', fontSize: '13px',
                fontWeight: 'bold', color: '#fff',
                cursor: (!formNama || saving) ? 'not-allowed' : 'pointer',
              }}
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => { setShowBuatBaru(false); setError(''); }}
              style={{ background: 'transparent', border: 0, fontSize: '13px', color: '#64748b', cursor: 'pointer' }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {biaya.length === 0 ? (
        <div style={{ padding: '28px 20px', textAlign: 'center', fontSize: '14px', color: '#64748b', fontWeight: 'bold' }}>
          Belum ada biaya produksi
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>Nama Biaya</th>
              <th style={{ padding: '10px 20px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }}>Akun Terkait</th>
              <th style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 'bold', color: '#475569' }}>Nilai</th>
              {isDraft && <th style={{ padding: '10px 20px' }}></th>}
            </tr>
          </thead>
          <tbody>
            {biaya.map((b) => (
              <tr key={b.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 20px', color: '#1e293b' }}>{b.production_cost_nama}</td>
                <td style={{ padding: '10px 20px', color: '#64748b' }}>
                  {b.akun_kode ? `${b.akun_kode} — ${b.akun_nama}` : '-'}
                </td>
                <td style={{ padding: '10px 20px', textAlign: 'right', color: '#334155', fontWeight: '600' }}>
                  {editingId === b.id ? (
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <input
                        type="number"
                        value={editNilai}
                        onChange={(e) => setEditNilai(e.target.value)}
                        style={{ width: '120px', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '13px', textAlign: 'right', outline: 'none' }}
                      />
                      <button onClick={() => simpanNilai(b.id)} style={{ border: 0, background: 'transparent', color: '#16a34a', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Simpan</button>
                      <button onClick={() => setEditingId(null)} style={{ border: 0, background: 'transparent', color: '#ef4444', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Batal</button>
                    </div>
                  ) : (
                    <span
                      onClick={isDraft ? () => { setEditingId(b.id); setEditNilai(b.nilai); } : undefined}
                      style={{ cursor: isDraft ? 'pointer' : 'default' }}
                      title={isDraft ? 'Klik untuk mengubah nilai' : undefined}
                    >
                      {formatRp(b.nilai)}
                    </span>
                  )}
                </td>
                {isDraft && (
                  <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => hapusBiaya(b.id)}
                      title="Hapus"
                      style={{ border: 0, background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <td colSpan={2} style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 'bold', color: '#475569' }}>Total Biaya</td>
              <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 'bold', color: '#1e293b' }}>{formatRp(totalBiaya)}</td>
              {isDraft && <td />}
            </tr>
          </tfoot>
        </table>
      )}

      <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: isDraft ? 'pointer' : 'default' }}>
          <input
            type="checkbox"
            checked={!!serapKeHpp}
            disabled={!isDraft || savingSerap}
            onChange={(e) => handleToggleSerap(e.target.checked)}
            style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: isDraft ? 'pointer' : 'default' }}
          />
          <span>
            <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
              Serap biaya produksi ke HPP barang jadi
            </span>
            <span style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.5 }}>
              Bila aktif, total biaya di atas dibebankan ke harga pokok barang jadi saat dokumen
              diposting, dibagi proporsional terhadap nilai bahan tiap produk (harga beli x qty) —
              produk yang bahannya lebih mahal menyerap biaya lebih besar. Bila nonaktif, biaya
              tetap tercatat sebagai rincian dokumen tapi HPP hanya memakai harga beli produk.
              Pilihan ini hanya bisa diubah selama dokumen berstatus draft.
            </span>
          </span>
        </label>
      </div>
    </div>
  );
}
