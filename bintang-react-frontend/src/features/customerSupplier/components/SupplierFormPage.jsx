import React, { useState, useEffect } from 'react';
import { Image } from 'lucide-react';

const INDONESIA_PROVINCES = [
  'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten',
  'DI Yogyakarta', 'Bali', 'Sumatera Utara', 'Sumatera Barat', 'Riau',
  'Kepulauan Riau', 'Sumatera Selatan', 'Lampung', 'Kalimantan Barat',
  'Kalimantan Timur', 'Kalimantan Selatan', 'Sulawesi Selatan',
  'Sulawesi Utara', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Papua'
];

const INDONESIA_CITIES = [
  'Jakarta', 'Bandung', 'Semarang', 'Surabaya', 'Yogyakarta', 'Denpasar',
  'Medan', 'Padang', 'Pekanbaru', 'Batam', 'Palembang', 'Bandar Lampung',
  'Pontianak', 'Samarinda', 'Banjarmasin', 'Makassar', 'Manado', 'Mataram',
  'Kupang', 'Jayapura', 'Tangerang', 'Bekasi', 'Depok', 'Bogor'
];

export default function SupplierFormPage({ supplier, onSave, onCancel, saving }) {
  const fileInputRef = React.useRef(null);
  const [photoBase64, setPhotoBase64] = useState('');
  const [form, setForm] = useState({
    nama: '',
    kontak_pic: '',
    email: '',
    phone: '',
    catatan: '',
    negara: 'Indonesia',
    provinsi: '',
    kota: '',
    kode_pos: '',
    alamat: ''
  });

  useEffect(() => {
    if (supplier) {
      setForm({
        nama: supplier.nama || '',
        kontak_pic: supplier.kontak_pic || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        catatan: supplier.catatan || '',
        negara: supplier.negara || 'Indonesia',
        provinsi: supplier.provinsi || '',
        kota: supplier.kota || '',
        kode_pos: supplier.kode_pos || '',
        alamat: supplier.alamat || ''
      });
      const savedPhoto = localStorage.getItem(`supplier_photo_${supplier.id}`);
      if (savedPhoto) {
        setPhotoBase64(savedPhoto);
      } else {
        setPhotoBase64('');
      }
    } else {
      setForm({
        nama: '',
        kontak_pic: '',
        email: '',
        phone: '',
        catatan: '',
        negara: 'Indonesia',
        provinsi: '',
        kota: '',
        kode_pos: '',
        alamat: ''
      });
      setPhotoBase64('');
    }
  }, [supplier]);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoBase64(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form, photoBase64);
  };

  const inputStyle = {
    width: '100%',
    height: '38px',
    padding: '0 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    outline: 'none',
    color: '#334155',
    background: '#ffffff',
    transition: 'border-color 0.15s ease'
  };

  const textareaStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    outline: 'none',
    color: '#334155',
    background: '#ffffff',
    resize: 'vertical',
    minHeight: '80px',
    transition: 'border-color 0.15s ease'
  };

  const labelStyle = {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: '6px',
    display: 'block'
  };

  const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#22c55e', // Green section titles matching Screenshot 4
    marginBottom: '16px',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '8px'
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100%' }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Pelanggan dan Supplier / {supplier ? 'Ubah Supplier' : 'Buat Supplier'}
          </span>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', margin: '4px 0 0 0' }}>
            {supplier ? 'Ubah Supplier' : 'Tambah Supplier'}
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'transparent', border: 0, color: '#0ea5e9', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !form.nama.trim()}
            style={{
              background: '#82c341', // Olsera green
              color: '#ffffff',
              border: 0,
              borderRadius: '6px',
              padding: '0 24px',
              height: '38px',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: (!form.nama.trim() || saving) ? 'not-allowed' : 'pointer',
              opacity: (saving || !form.nama.trim()) ? 0.7 : 1,
              transition: 'opacity 0.2s'
            }}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Two Column Layout Form */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
        {/* Left Column: Rincian Pelanggan */}
        <div>
          <h3 style={sectionTitleStyle}>Rincian Pelanggan</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nama Supplier *</label>
              <input
                type="text"
                value={form.nama}
                onChange={e => setForm(p => ({ ...p, nama: e.target.value }))}
                placeholder="Masukkan Nama Supplier"
                required
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Personal Yg Dihubungi</label>
              <input
                type="text"
                value={form.kontak_pic}
                onChange={e => setForm(p => ({ ...p, kontak_pic: e.target.value }))}
                placeholder="Masukkan Personal Yg Dihubungi"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="Contoh: olsera@gmail.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Telpon</label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="Masukkan angka contoh: 1234"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Catatan</label>
              <textarea
                value={form.catatan}
                onChange={e => setForm(p => ({ ...p, catatan: e.target.value }))}
                placeholder="Masukkan Catatan"
                style={textareaStyle}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Alamat */}
        <div>
          <h3 style={sectionTitleStyle}>Alamat</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Foto Supplier Box */}
            <div>
              <label style={labelStyle}>Foto Supplier</label>
              <div
                onClick={handlePhotoClick}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 16px',
                  background: '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                {photoBase64 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={photoBase64} alt="Supplier Preview" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                    <span style={{ fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>Foto Terpilih</span>
                  </div>
                ) : (
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Pilih Foto Supplier</span>
                )}
                <Image size={18} style={{ color: '#94a3b8' }} />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* Negara */}
            <div>
              <label style={labelStyle}>Negara</label>
              <select
                value={form.negara}
                onChange={e => setForm(p => ({ ...p, negara: e.target.value }))}
                style={inputStyle}
              >
                <option value="Indonesia">Indonesia</option>
                <option value="Malaysia">Malaysia</option>
                <option value="Singapura">Singapura</option>
              </select>
            </div>

            {/* Grid for Provinsi & Kota */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Propinsi</label>
                <select
                  value={form.provinsi}
                  onChange={e => setForm(p => ({ ...p, provinsi: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Pilih salah satu</option>
                  {INDONESIA_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Kota</label>
                <select
                  value={form.kota}
                  onChange={e => setForm(p => ({ ...p, kota: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Pilih salah satu</option>
                  {INDONESIA_CITIES.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Kode Pos */}
            <div>
              <label style={labelStyle}>Kode Pos</label>
              <input
                type="text"
                value={form.kode_pos}
                onChange={e => setForm(p => ({ ...p, kode_pos: e.target.value }))}
                placeholder="Masukkan angka contoh: 1234"
                style={inputStyle}
              />
            </div>

            {/* Alamat */}
            <div>
              <label style={labelStyle}>Alamat</label>
              <textarea
                value={form.alamat}
                onChange={e => setForm(p => ({ ...p, alamat: e.target.value }))}
                placeholder="Masukkan Alamat"
                style={textareaStyle}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
