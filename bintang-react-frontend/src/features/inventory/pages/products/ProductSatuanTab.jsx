import { useState } from 'react';
import { Plus, Settings, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import apiClient from '../../../../api/apiClient';

export default function ProductSatuanTab({ product, onUpdated, storeName }) {
  // Read properties with safe defaults
  const isUomEnabled = !!product.uom_enabled;
  const uomSettings = product.uom_settings || { auto_update_price: false };
  const uomUnits = Array.isArray(product.uom_units) ? product.uom_units : [];
  const variants = Array.isArray(product.variants) ? product.variants : [];

  // Local state for modals and forms
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Settings form state
  const [autoUpdatePrice, setAutoUpdatePrice] = useState(!!uomSettings.auto_update_price);

  // Add unit form state
  const [formVariantId, setFormVariantId] = useState(variants.length > 0 ? variants[0].id : 'all');
  const [formNamaSatuan, setFormNamaSatuan] = useState('');
  const [formKodeSatuan, setFormKodeSatuan] = useState('');
  const [formKonverter, setFormKonverter] = useState(0);
  const [formHargaBeli, setFormHargaBeli] = useState('0');
  const [formHargaJualOnline, setFormHargaJualOnline] = useState('0');
  const [formHargaJualToko, setFormHargaJualToko] = useState('0');
  const [formDefaultPos, setFormDefaultPos] = useState(true);

  // Helpers for currency formatting
  const formatCurrency = (numStr) => {
    const cleanStr = (numStr || '').toString().replace(/[^0-9]/g, '');
    if (!cleanStr) return '0';
    return parseInt(cleanStr, 10).toLocaleString('id-ID');
  };

  const parseCurrency = (formattedStr) => {
    const cleanStr = (formattedStr || '').toString().replace(/[^0-9]/g, '');
    if (!cleanStr) return 0;
    return parseInt(cleanStr, 10);
  };

  const formatPriceOutput = (val) => {
    return 'Rp. ' + (val || 0).toLocaleString('id-ID') + ',00';
  };

  // Toggle UOM Activation
  const handleToggleUom = async (checked) => {
    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        uom_enabled: checked
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
    } catch (err) {
      console.error('[SatuanTab] Error toggling UOM activation:', err);
      alert('Gagal memperbarui status aktifkan UOM.');
    }
  };

  // Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        uom_settings: {
          ...uomSettings,
          auto_update_price: autoUpdatePrice
        }
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
      setIsSettingsOpen(false);
    } catch (err) {
      console.error('[SatuanTab] Error saving settings:', err);
      alert('Gagal menyimpan pengaturan satuan.');
    } finally {
      setSaving(false);
    }
  };

  // Add UOM Unit
  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!formNamaSatuan.trim()) {
      setError('Nama satuan wajib diisi.');
      return;
    }
    if (!formKodeSatuan.trim()) {
      setError('Kode satuan wajib diisi.');
      return;
    }
    if (formKodeSatuan.length > 5) {
      setError('Kode satuan maksimal 5 karakter.');
      return;
    }
    if (formKonverter <= 0) {
      setError('Konverter satuan harus lebih besar dari 0.');
      return;
    }

    setSaving(true);
    setError(null);

    const newUnit = {
      id: Date.now().toString(),
      variant_id: formVariantId,
      nama_satuan: formNamaSatuan.trim(),
      kode_satuan: formKodeSatuan.trim(),
      konverter: Number(formKonverter),
      harga_beli: parseCurrency(formHargaBeli),
      harga_jual_online: parseCurrency(formHargaJualOnline),
      harga_jual_toko: parseCurrency(formHargaJualToko),
      default_pos: !!formDefaultPos
    };

    // If default_pos is set to true, unset default_pos on other units of the same variant
    let updatedUnits = [...uomUnits];
    if (newUnit.default_pos) {
      updatedUnits = updatedUnits.map(u => 
        u.variant_id === newUnit.variant_id ? { ...u, default_pos: false } : u
      );
    }
    updatedUnits.push(newUnit);

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        uom_units: updatedUnits
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
      setIsAddOpen(false);
    } catch (err) {
      console.error('[SatuanTab] Error adding unit:', err);
      setError('Gagal menambahkan satuan baru.');
    } finally {
      setSaving(false);
    }
  };

  // Delete UOM Unit
  const handleDeleteUnit = async (unitId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus satuan ini?')) {
      return;
    }

    const updatedUnits = uomUnits.filter(u => u.id !== unitId);

    try {
      const res = await apiClient.patch(`/products/${product.id}/`, {
        uom_units: updatedUnits
      });
      if (onUpdated) {
        onUpdated(res.data);
      }
    } catch (err) {
      console.error('[SatuanTab] Error deleting unit:', err);
      alert('Gagal menghapus satuan.');
    }
  };

  // Group UOM Units by Variant for rendering
  const getGroupedUnits = () => {
    if (variants.length === 0) {
      // Product has no variants: group under product main
      return [{
        id: 'all',
        name: product.nama,
        units: uomUnits.filter(u => u.variant_id === 'all')
      }];
    }
    // Product has variants
    return variants.map(v => ({
      id: v.id,
      name: v.nama_varian,
      units: uomUnits.filter(u => u.variant_id === v.id || u.variant_id === v.id.toString())
    }));
  };

  const groupedData = getGroupedUnits();
  const totalUnitsCount = uomUnits.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>Satuan Produk</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>
            {totalUnitsCount} Satuan
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => {
              setAutoUpdatePrice(!!uomSettings.auto_update_price);
              setIsSettingsOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              color: '#64748b',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Pengaturan"
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => {
              setFormVariantId(variants.length > 0 ? variants[0].id : 'all');
              setFormNamaSatuan('');
              setFormKodeSatuan('');
              setFormKonverter(0);
              setFormHargaBeli('0');
              setFormHargaJualOnline('0');
              setFormHargaJualToko('0');
              setFormDefaultPos(true);
              setError(null);
              setIsAddOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#72be44', // Green per mockup
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
          >
            <Plus size={14} /> Tambah
          </button>
        </div>
      </div>

      {/* Main Activation Card */}
      <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>
          Aktifkan Satuan/UOM di Toko ini
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: isUomEnabled ? '#026da7' : '#94a3b8' }}>
            {isUomEnabled ? 'Ya' : 'Tidak'}
          </span>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isUomEnabled}
              onChange={(e) => handleToggleUom(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: isUomEnabled ? '#026da7' : '#cbd5e1',
                borderRadius: 24,
                transition: '0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  content: '""',
                  height: 18,
                  width: 18,
                  left: isUomEnabled ? 22 : 4,
                  bottom: 3,
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '0.2s'
                }}
              />
            </span>
          </label>
        </div>
      </div>

      {/* UOM List Section */}
      {isUomEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groupedData.map((group) => (
            <div key={group.id} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              
              {/* Group Variant Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span
                  style={{
                    backgroundColor: '#cbd5e1',
                    color: '#334155',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  Varian
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#334155' }}>
                  {group.name}
                </span>
              </div>

              {/* Group units list */}
              {group.units.length === 0 ? (
                <div style={{ padding: '24px 18px', textAlign: 'center', color: '#64748b', fontSize: 13.5, fontStyle: 'italic' }}>
                  Belum ada satuan untuk varian ini
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '12px 18px' }}>Nama Satuan</th>
                        <th style={{ padding: '12px 18px' }}>Konverter Satuan</th>
                        <th style={{ padding: '12px 18px' }}>Harga beli</th>
                        <th style={{ padding: '12px 18px' }}>Harga jual Online</th>
                        <th style={{ padding: '12px 18px' }}>Harga jual Toko</th>
                        <th style={{ padding: '12px 18px' }}>Stok</th>
                        <th style={{ padding: '12px 18px' }}>Default POS</th>
                        <th style={{ padding: '12px 18px', textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.units.map((unit) => (
                        <tr key={unit.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                          <td style={{ padding: '12px 18px', fontWeight: 600, color: '#0f172a' }}>
                            {unit.nama_satuan} ({unit.kode_satuan})
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            {unit.konverter}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 500 }}>
                            {formatPriceOutput(unit.harga_beli)}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 500 }}>
                            {formatPriceOutput(unit.harga_jual_online)}
                          </td>
                          <td style={{ padding: '12px 18px', fontWeight: 500 }}>
                            {formatPriceOutput(unit.harga_jual_toko)}
                          </td>
                          <td style={{ padding: '12px 18px', color: '#64748b' }}>
                            {/* Calculated converted stock */}
                            {Math.floor(Number(product.qty_stok) / (unit.konverter || 1))}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: unit.default_pos ? '#22c55e' : '#cbd5e1',
                                marginRight: 6
                              }}
                            />
                            {unit.default_pos ? 'Ya' : 'Tidak'}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleDeleteUnit(unit.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: 4
                              }}
                              title="Hapus"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ================= MODAL: PENGATURAN SATUAN (GEAR) ================= */}
      {isSettingsOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <form
            onSubmit={handleSaveSettings}
            style={{
              width: '100%',
              maxWidth: 500,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              margin: 16
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Pengaturan Satuan</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#72be44', // Green per mockup
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#334155' }}>Otomatis Memperbarui Harga</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Harga beli dan harga jual terupdate jika ada perubahan harga
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: autoUpdatePrice ? '#72be44' : '#cbd5e1' }}>
                  {autoUpdatePrice ? 'Ya' : 'Tidak'}
                </span>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoUpdatePrice}
                    onChange={(e) => setAutoUpdatePrice(e.target.checked)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: autoUpdatePrice ? '#72be44' : '#cbd5e1',
                      borderRadius: 24,
                      transition: '0.2s',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: 18,
                        width: 18,
                        left: autoUpdatePrice ? 22 : 4,
                        bottom: 3,
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.2s'
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL: TAMBAH SATUAN (SATUAN BARU) ================= */}
      {isAddOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <form
            onSubmit={handleAddUnit}
            style={{
              width: '100%',
              maxWidth: 580,
              background: '#ffffff',
              borderRadius: 12,
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              margin: 16
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', margin: 0 }}>Satuan Baru</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#72be44', // Green per mockup
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '75vh', overflowY: 'auto' }}>
              {error && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#b91c1c', fontSize: 13 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Variant selector (only if the product has variants) */}
              {variants.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Pilih Varian</label>
                  <select
                    value={formVariantId}
                    onChange={(e) => setFormVariantId(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none',
                      backgroundColor: '#fff'
                    }}
                  >
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.nama_varian}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Nama Satuan */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Nama Satuan</label>
                  <input
                    type="text"
                    list="satuan-presets"
                    placeholder="Contoh, Karton"
                    value={formNamaSatuan}
                    onChange={(e) => setFormNamaSatuan(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none'
                    }}
                  />
                  <datalist id="satuan-presets">
                    <option value="Karton" />
                    <option value="Lusin" />
                    <option value="Box" />
                    <option value="Pack" />
                    <option value="Ikat" />
                    <option value="Pcs" />
                  </datalist>
                </div>

                {/* Kode Satuan */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Kode Satuan</label>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                      {formKodeSatuan.length}/5
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="Contoh, krt"
                    value={formKodeSatuan}
                    onChange={(e) => setFormKodeSatuan(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Konverter Satuan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Konverter Satuan</label>
                <input
                  type="number"
                  min={1}
                  placeholder="0"
                  value={formKonverter || ''}
                  onChange={(e) => setFormKonverter(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    fontSize: 13.5,
                    outline: 'none'
                  }}
                />
              </div>

              {/* Harga Beli */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Harga beli</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: 12, fontSize: 13.5, fontWeight: 600, color: '#64748b' }}>Rp.</span>
                  <input
                    type="text"
                    value={formatCurrency(formHargaBeli)}
                    onChange={(e) => setFormHargaBeli(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 42px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      fontSize: 13.5,
                      outline: 'none',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>

              {/* Harga Jual Online & Harga Jual Toko */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Harga Jual Online */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Harga jual Online</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 12, fontSize: 13.5, fontWeight: 600, color: '#64748b' }}>Rp.</span>
                    <input
                      type="text"
                      value={formatCurrency(formHargaJualOnline)}
                      onChange={(e) => setFormHargaJualOnline(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 42px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: 13.5,
                        outline: 'none',
                        fontWeight: 600
                      }}
                    />
                  </div>
                </div>

                {/* Harga Jual Toko */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>Harga jual Toko</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: 12, fontSize: 13.5, fontWeight: 600, color: '#64748b' }}>Rp.</span>
                    <input
                      type="text"
                      value={formatCurrency(formHargaJualToko)}
                      onChange={(e) => setFormHargaJualToko(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 42px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 6,
                        fontSize: 13.5,
                        outline: 'none',
                        fontWeight: 600
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Default POS Choice Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Pilihan Default POS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: formDefaultPos ? '#72be44' : '#cbd5e1' }}>
                    {formDefaultPos ? 'Ya' : 'Tidak'}
                  </span>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formDefaultPos}
                      onChange={(e) => setFormDefaultPos(e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: formDefaultPos ? '#72be44' : '#cbd5e1',
                        borderRadius: 24,
                        transition: '0.2s',
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          content: '""',
                          height: 18,
                          width: 18,
                          left: formDefaultPos ? 22 : 4,
                          bottom: 3,
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: '0.2s'
                        }}
                      />
                    </span>
                  </label>
                </div>
              </div>

            </div>
          </form>
        </div>
      )}
    </div>
  );
}
