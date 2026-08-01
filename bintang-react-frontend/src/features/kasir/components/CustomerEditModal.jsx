import React, { useState, useEffect, useMemo } from 'react';
import { Users, X, Calendar } from 'lucide-react';

const DEFAULT_PROVINSI = ['DKI JAKARTA', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten', 'DI Yogyakarta', 'Bali', 'Sumatera Utara', 'Sumatera Selatan'];
const DEFAULT_KOTA = ['Kota Jakarta Pusat', 'Kota Jakarta Selatan', 'Kota Jakarta Barat', 'Kota Jakarta Timur', 'Kota Jakarta Utara', 'Kota Bandung', 'Kota Surabaya', 'Kota Semarang', 'Kota Medan'];
const DEFAULT_KECAMATAN = ['Cempaka Putih', 'Gambir', 'Kemayoran', 'Menteng', 'Senen', 'Coblong', 'Tegalsari'];

export default function CustomerEditModal({ isOpen, contact, contacts = [], onSave, onClose }) {
  const [formData, setFormData] = useState({
    tipe_pelanggan: 'Guest',
    nama: '',
    gender: 'Male',
    tanggal_lahir: '',
    no_keanggotaan: '',
    email: '',
    telepon: '',
    catatan: '',
    alamat: '',
    kode_pos: '',
    negara: 'Indonesia',
    provinsi: 'DKI JAKARTA',
    kota: 'Kota Jakarta Pusat',
    kecamatan: 'Cempaka Putih',
  });

  const [historyProvinsi, setHistoryProvinsi] = useState([]);
  const [historyKota, setHistoryKota] = useState([]);
  const [historyKecamatan, setHistoryKecamatan] = useState([]);

  // Load history from localStorage and existing contacts
  useEffect(() => {
    try {
      const storedProv = JSON.parse(localStorage.getItem('pos_history_provinsi') || '[]');
      const storedKota = JSON.parse(localStorage.getItem('pos_history_kota') || '[]');
      const storedKec = JSON.parse(localStorage.getItem('pos_history_kecamatan') || '[]');

      const contactProv = contacts.map((c) => c.provinsi).filter(Boolean);
      const contactKota = contacts.map((c) => c.kota).filter(Boolean);
      const contactKec = contacts.map((c) => c.kecamatan).filter(Boolean);

      setHistoryProvinsi(Array.from(new Set([...DEFAULT_PROVINSI, ...storedProv, ...contactProv])));
      setHistoryKota(Array.from(new Set([...DEFAULT_KOTA, ...storedKota, ...contactKota])));
      setHistoryKecamatan(Array.from(new Set([...DEFAULT_KECAMATAN, ...storedKec, ...contactKec])));
    } catch {
      setHistoryProvinsi(DEFAULT_PROVINSI);
      setHistoryKota(DEFAULT_KOTA);
      setHistoryKecamatan(DEFAULT_KECAMATAN);
    }
  }, [contacts]);

  useEffect(() => {
    if (contact) {
      setFormData({
        tipe_pelanggan: contact.tipe_pelanggan || contact.kategori || 'Guest',
        nama: contact.nama || '',
        gender: contact.gender || '',
        tanggal_lahir: contact.tanggal_lahir || '',
        no_keanggotaan: contact.no_keanggotaan || contact.kode_pelanggan || '',
        email: contact.email || '',
        telepon: contact.telepon || contact.nomor_wa || '',
        catatan: contact.catatan || '',
        alamat: contact.alamat || '',
        kode_pos: contact.kode_pos || '',
        negara: contact.negara || '',
        provinsi: contact.provinsi || '',
        kota: contact.kota || '',
        kecamatan: contact.kecamatan || '',
      });
    } else {
      setFormData({
        tipe_pelanggan: 'Guest',
        nama: '',
        gender: '',
        tanggal_lahir: '',
        no_keanggotaan: '',
        email: '',
        telepon: '',
        catatan: '',
        alamat: '',
        kode_pos: '',
        negara: '',
        provinsi: '',
        kota: '',
        kecamatan: '',
      });
    }
  }, [contact, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const saveToHistory = (key, value) => {
    if (!value || !value.trim()) return;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      if (!stored.includes(value.trim())) {
        const updated = [value.trim(), ...stored].slice(0, 50);
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {
      // localStorage penuh/diblokir — histori autocomplete opsional, aman diabaikan.
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.provinsi) saveToHistory('pos_history_provinsi', formData.provinsi);
    if (formData.kota) saveToHistory('pos_history_kota', formData.kota);
    if (formData.kecamatan) saveToHistory('pos_history_kecamatan', formData.kecamatan);

    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col transform scale-100 transition-all duration-300">
        {/* Header SS 3 */}
        <div className="bg-[#0088FF] px-6 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <Users size={22} />
            <h3 className="font-extrabold text-sm tracking-wide">
              {contact ? 'Pelanggan (Ubah)' : 'Pelanggan (Tambah)'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body SS 3 */}
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 max-h-[80vh] overflow-y-auto bg-white text-xs">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Tipe Pelanggan</label>
              <select
                value={formData.tipe_pelanggan}
                onChange={(e) => handleChange('tipe_pelanggan', e.target.value)}
                className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-transparent cursor-pointer"
              >
                <option value="Guest">Guest</option>
                <option value="Regular">Regular</option>
                <option value="VIP">VIP</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Nama</label>
              <input
                type="text"
                required
                value={formData.nama}
                onChange={(e) => handleChange('nama', e.target.value)}
                className="w-full border-b border-blue-500 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Gender</label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange('gender', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-transparent cursor-pointer"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Tanggal Lahir</label>
                <div className="flex items-center border-b border-slate-300 pb-1">
                  <input
                    type="text"
                    value={formData.tanggal_lahir}
                    onChange={(e) => handleChange('tanggal_lahir', e.target.value)}
                    className="w-full text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                  />
                  <Calendar size={14} className="text-slate-400 ml-1" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-0.5">No. Keanggotaan</label>
              <input
                type="text"
                value={formData.no_keanggotaan}
                onChange={(e) => handleChange('no_keanggotaan', e.target.value)}
                className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Telpon</label>
              <input
                type="text"
                value={formData.telepon}
                onChange={(e) => handleChange('telepon', e.target.value)}
                className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Catatan</label>
              <input
                type="text"
                value={formData.catatan}
                onChange={(e) => handleChange('catatan', e.target.value)}
                className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Alamat</label>
                <input
                  type="text"
                  placeholder="Masukkan alamat lengkap..."
                  value={formData.alamat}
                  onChange={(e) => handleChange('alamat', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Kode Pos</label>
                <input
                  type="text"
                  value={formData.kode_pos}
                  onChange={(e) => handleChange('kode_pos', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Negara</label>
                <input
                  type="text"
                  value={formData.negara}
                  onChange={(e) => handleChange('negara', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none bg-transparent"
                />
              </div>

              {/* Free-text input + Datalist History for Provinsi */}
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Negara Bagian/Provinsi</label>
                <input
                  type="text"
                  list="provinsi-history-list"
                  placeholder="Ketik/Pilih Provinsi..."
                  value={formData.provinsi}
                  onChange={(e) => handleChange('provinsi', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-transparent"
                />
                <datalist id="provinsi-history-list">
                  {historyProvinsi.map((prov, i) => (
                    <option key={i} value={prov} />
                  ))}
                </datalist>
              </div>

              {/* Free-text input + Datalist History for Kota */}
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Kota / Kabupaten</label>
                <input
                  type="text"
                  list="kota-history-list"
                  placeholder="Ketik/Pilih Kota..."
                  value={formData.kota}
                  onChange={(e) => handleChange('kota', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-transparent"
                />
                <datalist id="kota-history-list">
                  {historyKota.map((kota, i) => (
                    <option key={i} value={kota} />
                  ))}
                </datalist>
              </div>

              {/* Free-text input + Datalist History for Kecamatan */}
              <div>
                <label className="text-[10px] font-medium text-slate-400 block mb-0.5">Kecamatan</label>
                <input
                  type="text"
                  list="kecamatan-history-list"
                  placeholder="Ketik/Pilih Kecamatan..."
                  value={formData.kecamatan}
                  onChange={(e) => handleChange('kecamatan', e.target.value)}
                  className="w-full border-b border-slate-300 pb-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 bg-transparent"
                />
                <datalist id="kecamatan-history-list">
                  {historyKecamatan.map((kec, i) => (
                    <option key={i} value={kec} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-[#0088FF] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
