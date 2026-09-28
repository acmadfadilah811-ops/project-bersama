import React, { useState, useEffect, useMemo } from 'react';
import { Image } from 'lucide-react';
import WILAYAH from '../../../data/wilayahIndonesia.json';

// Data wilayah resmi (Kepmendagri No 300.2.2-2138 Tahun 2025): 38 provinsi,
// 514 kabupaten/kota. Sumber: github.com/cahyadsn/wilayah (MIT). Kolom tetap
// teks bebas -- saran hanya membantu, nilai lama/alamat luar negeri tetap bisa
// diketik (2026-09-28: dulu dropdown kaku berisi 21 provinsi & 24 kota).
const PROVINSI = WILAYAH.map((w) => w.provinsi);
const SEMUA_KOTA = WILAYAH.flatMap((w) => w.kota);

function kotaDiProvinsi(provinsi) {
  const cari = (provinsi || '').trim().toLowerCase();
  if (!cari) return SEMUA_KOTA;
  const cocok = WILAYAH.find((w) => w.provinsi.toLowerCase() === cari);
  return cocok ? cocok.kota : SEMUA_KOTA;
}

export default function SupplierFormPage({ supplier, onSave, onCancel, saving }) {
  const fileInputRef = React.useRef(null);
  // File yang baru dipilih (belum diupload) — dikirim ke onSave, BUKAN dibaca
  // jadi base64 lalu disimpan localStorage seperti sebelumnya (foto jadi
  // device-specific, hilang kalau data browser dibersihkan, dan tidak pernah
  // muncul di komputer lain). Sekarang foto sungguhan tersimpan di server
  // lewat field Supplier.foto (bug ditemukan & diperbaiki 2026-09-05).
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
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
      setPhotoFile(null);
      setPhotoPreviewUrl(supplier.foto || '');
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
      setPhotoFile(null);
      setPhotoPreviewUrl('');
    }
  }, [supplier]);

  const isIndonesia = (form.negara || '').trim().toLowerCase() === 'indonesia';
  const daftarKota = useMemo(() => kotaDiProvinsi(form.provinsi), [form.provinsi]);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form, photoFile);
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
                {photoPreviewUrl ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img src={photoPreviewUrl} alt="Supplier Preview" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
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
              <input
                type="text"
                list="supplier-negara-list"
                value={form.negara}
                onChange={e => setForm(p => ({ ...p, negara: e.target.value }))}
                placeholder="Ketik atau pilih negara"
                style={inputStyle}
              />
              <datalist id="supplier-negara-list">
                <option value="Indonesia" />
                <option value="Malaysia" />
                <option value="Singapura" />
                <option value="Tiongkok" />
              </datalist>
            </div>

            {/* Provinsi & Kota/Kabupaten: ketik untuk mencari, atau isi bebas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Provinsi</label>
                <input
                  type="text"
                  list={isIndonesia ? 'supplier-provinsi-list' : undefined}
                  value={form.provinsi}
                  onChange={e => {
                    const provinsi = e.target.value;
                    setForm(p => {
                      // Kota lama dikosongkan bila bukan bagian provinsi baru.
                      const daftar = kotaDiProvinsi(provinsi);
                      const kotaMasih = !p.kota || daftar === SEMUA_KOTA || daftar.includes(p.kota);
                      return { ...p, provinsi, kota: kotaMasih ? p.kota : '' };
                    });
                  }}
                  placeholder="Ketik nama provinsi"
                  autoComplete="off"
                  style={inputStyle}
                />
                <datalist id="supplier-provinsi-list">
                  {PROVINSI.map((prov) => (
                    <option key={prov} value={prov} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Kota/Kabupaten</label>
                <input
                  type="text"
                  list={isIndonesia ? 'supplier-kota-list' : undefined}
                  value={form.kota}
                  onChange={e => setForm(p => ({ ...p, kota: e.target.value }))}
                  placeholder="Ketik nama kota/kabupaten"
                  autoComplete="off"
                  style={inputStyle}
                />
                <datalist id="supplier-kota-list">
                  {daftarKota.map((kota) => (
                    <option key={kota} value={kota} />
                  ))}
                </datalist>
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
